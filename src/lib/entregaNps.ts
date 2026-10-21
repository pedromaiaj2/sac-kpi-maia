import { getSupabaseAdmin } from "./supabaseAdmin";
import { isMostruarioRequest } from "./serviceRequests";
import { listClientesNaoContatar } from "./recompra";
import { RESOLVIDO_LABELS } from "./entregasRisco";
import { findGhlConversationId, fetchGhlMessages } from "./ghlClient";
import { fetchInBatches } from "./supabaseBatch";
import { enviarNpsPorPedido, pedidosComNps } from "./npsEnvio";
import { NPS_GHL_TAG, NPS_1_5_PATTERN } from "./npsDetratores";

// NPS "Pós-entrega" -- pedido do Victor 22/09/2026: pergunta sobre a
// entrega ORIGINAL da compra (o caminhão leva o móvel pela primeira vez),
// não um chamado de assistência -- mesmo mecanismo de "20 dias
// pós-recebimento" (nps2Meses.ts/compra_nps, TARGET_DAYS_AGO=20 desde
// 28/09/2026), copiado quase igual daqui (mesma fonte
// totvs_delivery_cargas/totvs_orders, mesmo cruzamento por nota fiscal +
// série), só com uma janela bem mais curta -- pergunta logo depois da
// entrega, não semanas depois. Sem o limite de 90 dias por
// cliente que a Compra tem (pergunta diferente, sobre uma entrega
// específica, não sobre a experiência geral -- um cliente com 2 entregas
// na mesma semana pode legitimamente receber as duas pesquisas).
const MAX_ENROLL_PER_RUN = 50;
// Teto próprio pro backfill de cadastro (menor que MAX_ENROLL_PER_RUN) --
// cada código faltante custa uma chamada de verdade ao Protheus (SearchQuery),
// e /api/sync já reúne as 4 pesquisas de NPS numa chamada só, com um
// orçamento de tempo apertado (ver .github/workflows/sync-cron.yml,
// --max-time 290). 20 é conservador o bastante pra não estourar isso
// sozinho -- o resto dos códigos sem cadastro fica pra próxima rodada.
const BACKFILL_MAX_CODES_PER_RUN = 20;

// 1-2 dias depois da entrega -- dá tempo do cliente abrir a caixa/montar
// antes de perguntar, mas ainda perto o bastante da experiência pra
// lembrar dos detalhes. Ajustável se o Victor achar cedo/tarde demais
// depois de ver os números reais.
const WINDOW_DAYS = 1;
const TARGET_DAYS_AGO = 1;

type CargaRow = { nota_fiscal: string | null; serie: string | null };
type OrderRow = { id: string; invoice: string | null; serie: string | null; client_id: string | null; client_name: string | null };

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function enrollPendingEntregaNps(): Promise<{ enrolled: number; semTelefone: number; errors: string[] }> {
  const admin = getSupabaseAdmin();

  // 1. Cargas entregues (de verdade, não "Cancelada"/"Em rota") na janela
  // curta -- mesmo critério de resolvido que entregasRisco.ts/recompra.ts/
  // nps2Meses.ts já usam.
  const fromDate = isoDaysAgo(TARGET_DAYS_AGO + WINDOW_DAYS);
  const toDate = isoDaysAgo(TARGET_DAYS_AGO);
  const { data: cargas, error: cargasError } = await admin
    .from("totvs_delivery_cargas")
    .select("nota_fiscal, serie")
    .not("nota_fiscal", "is", null)
    .gte("dt_retorno", fromDate)
    .lte("dt_retorno", toDate)
    .in("status_entrega", RESOLVIDO_LABELS)
    .returns<CargaRow[]>();
  if (cargasError) return { enrolled: 0, semTelefone: 0, errors: [`entrega-nps cargas: ${cargasError.message}`] };
  if (!cargas || cargas.length === 0) return { enrolled: 0, semTelefone: 0, errors: [] };

  // 2. Cruza com o pedido de venda -- mesmo join (invoice+serie, sem
  // branch/filial) já descoberto e usado em recompra.ts/nps2Meses.ts.
  const notasFiscais = [...new Set(cargas.map((c) => c.nota_fiscal).filter((n): n is string => !!n))];
  const seriesByNota = new Map<string, Set<string>>();
  for (const c of cargas) {
    if (!c.nota_fiscal || !c.serie) continue;
    const set = seriesByNota.get(c.nota_fiscal) ?? new Set<string>();
    set.add(c.serie);
    seriesByNota.set(c.nota_fiscal, set);
  }

  let orderRows: OrderRow[];
  try {
    orderRows = await fetchInBatches<OrderRow>(notasFiscais, (lote) =>
      admin.from("totvs_orders").select("id, invoice, serie, client_id, client_name").in("invoice", lote)
    );
  } catch (err) {
    return { enrolled: 0, semTelefone: 0, errors: [`entrega-nps pedidos: ${(err as Error).message}`] };
  }

  const candidates = orderRows.filter((o) => o.invoice && o.serie && seriesByNota.get(o.invoice)?.has(o.serie) && o.client_id);
  if (candidates.length === 0) return { enrolled: 0, semTelefone: 0, errors: [] };

  // 3. Já enviado pra esse pedido? Já opt-out desse cliente (mesma lista
  // do Motor de Recompra, "legítimo interesse" pede opção de saída)?
  let alreadySent: Set<string>;
  try {
    alreadySent = await pedidosComNps(admin, "entrega_nps", candidates.map((c) => c.id));
  } catch (err) {
    return { enrolled: 0, semTelefone: 0, errors: [`entrega-nps já enviados: ${(err as Error).message}`] };
  }
  const naoContatar = await listClientesNaoContatar();

  const eligible = candidates.filter(
    (c) => !alreadySent.has(c.id) && !naoContatar.has(c.client_id as string) && !isMostruarioRequest(c.invoice, c.client_name)
  );
  if (eligible.length === 0) return { enrolled: 0, semTelefone: 0, errors: [] };

  // 4. Telefone -- totvs_orders não tem, precisa do cadastro (mesmo join
  // client_id = protheus_code do resto do projeto). `totvs_clientes` só
  // cobre uma fração de quem já comprou (mesmo gap documentado em
  // totvsLookup.ts/findTotvsClientByCode): diferente de montagem/
  // assistência técnica (telefone vem direto do chamado), aqui a fonte é
  // só a venda no Protheus. Backfill reativo (achado do Victor 26/09/2026:
  // a listagem em massa do Protheus não traz vários clientes reais, mas
  // SearchQuery por código funciona) antes de checar telefone; quem segue
  // sem telefone conta em `semTelefone` (limite de dado conhecido, não
  // erro) e é pulado sem ocupar vaga (ver npsEnvio.ts).
  return enviarNpsPorPedido(admin, {
    tabela: "entrega_nps",
    tag: NPS_GHL_TAG.entrega!,
    rotulo: "entrega-nps",
    candidatos: eligible,
    maxEnvios: MAX_ENROLL_PER_RUN,
    maxBackfill: BACKFILL_MAX_CODES_PER_RUN,
  });
}

export async function detectPendingEntregaNpsResponses(): Promise<number> {
  const admin = getSupabaseAdmin();
  const { data: pending } = await admin
    .from("entrega_nps")
    .select("order_id, ghl_contact_id, enviado_em")
    .is("respondido_em", null)
    .limit(100);
  if (!pending || pending.length === 0) return 0;

  let answered = 0;
  for (const row of pending) {
    const conversationId = await findGhlConversationId(row.ghl_contact_id);
    if (!conversationId) continue;
    const msgs = await fetchGhlMessages(conversationId);
    if (!msgs) continue;
    const sentAtMs = new Date(row.enviado_em).getTime();
    const reply = msgs.find(
      (m) => m.direction === "inbound" && new Date(m.dateAdded).getTime() > sentAtMs && NPS_1_5_PATTERN.test((m.body ?? "").trim())
    );
    if (!reply) continue;
    const score = Number(NPS_1_5_PATTERN.exec(reply.body!.trim())![1]);
    await admin.from("entrega_nps").update({ score, respondido_em: reply.dateAdded }).eq("order_id", row.order_id);
    answered++;
  }
  return answered;
}
