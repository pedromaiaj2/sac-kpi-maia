import { getSupabaseAdmin } from "./supabaseAdmin";
import { isMostruarioRequest, isPlaceholderPhone, firstPhone } from "./serviceRequests";
import { listClientesNaoContatar } from "./recompra";
import { upsertGhlContact, addContactTag, findGhlConversationId, fetchGhlMessages } from "./ghlClient";
import { NPS_GHL_TAG, NPS_1_5_PATTERN } from "./npsDetratores";
import { backfillClientCodes } from "./totvsSync";

// NPS "Pós-venda" -- pedido do Victor 19/10/2026: avaliar o ATENDIMENTO EM
// LOJA, disparado assim que a venda é registrada no Protheus. Mais simples
// que Pós-entrega/Compra (entregaNps.ts/nps2Meses.ts): o gatilho é a venda
// em si (totvs_orders.issue_date), sem precisar cruzar com
// totvs_delivery_cargas (não depende de entrega nenhuma ter acontecido --
// é sobre o vendedor/a loja, não sobre o produto/a logística).
const MAX_ENROLL_PER_RUN = 50;
// Mesmo racional de entregaNps.ts/nps2Meses.ts: cada código faltante de
// totvs_clientes é uma chamada de verdade ao Protheus, e esta função
// compete pelo mesmo orçamento de tempo do /api/sync que as outras 3
// pesquisas de NPS (--max-time 290, ver sync-cron.yml).
const BACKFILL_MAX_CODES_PER_RUN = 20;

// TARGET_DAYS_AGO=0 (não 1+ como as outras) -- "assim que a venda for
// feita" pede o mínimo de espera possível: o pedido já é elegível no
// mesmo dia que aparece sincronizado em totvs_orders, sem esperar virar
// o dia. WINDOW_DAYS=2 só como rede de segurança (absorve o sync ficando
// fora do ar por um tempo sem perder venda nenhuma), mesmo espírito do
// WINDOW_DAYS de entregaNps.ts/nps2Meses.ts.
const WINDOW_DAYS = 2;
const TARGET_DAYS_AGO = 0;

type OrderRow = { id: string; client_id: string | null; client_name: string | null; invoice: string | null };

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function enrollPendingVendaNps(): Promise<{ enrolled: number; semTelefone: number; errors: string[] }> {
  const admin = getSupabaseAdmin();
  const errors: string[] = [];

  // 1. Vendas recentes -- direto em totvs_orders, sem passar por cargas
  // (diferente de entregaNps.ts/nps2Meses.ts).
  const fromDate = isoDaysAgo(TARGET_DAYS_AGO + WINDOW_DAYS);
  const toDate = isoDaysAgo(TARGET_DAYS_AGO);
  const { data: orderRows, error: ordersError } = await admin
    .from("totvs_orders")
    .select("id, client_id, client_name, invoice")
    .not("client_id", "is", null)
    .gte("issue_date", fromDate)
    .lte("issue_date", toDate)
    .returns<OrderRow[]>();
  if (ordersError) return { enrolled: 0, semTelefone: 0, errors: [`venda-nps pedidos: ${ordersError.message}`] };
  const candidates = (orderRows ?? []).filter((o) => o.client_id);
  if (candidates.length === 0) return { enrolled: 0, semTelefone: 0, errors: [] };

  // 2. Já enviado pra esse pedido? Já opt-out desse cliente?
  const { data: already } = await admin
    .from("venda_nps")
    .select("order_id")
    .in("order_id", candidates.map((c) => c.id));
  const alreadySent = new Set((already ?? []).map((r) => r.order_id as string));
  const naoContatar = await listClientesNaoContatar();

  const eligible = candidates
    .filter((c) => !alreadySent.has(c.id) && !naoContatar.has(c.client_id as string) && !isMostruarioRequest(c.invoice, c.client_name))
    .slice(0, MAX_ENROLL_PER_RUN);
  if (eligible.length === 0) return { enrolled: 0, semTelefone: 0, errors: [] };

  // 3. Telefone -- mesmo gap/mesmo backfill reativo de entregaNps.ts/
  // nps2Meses.ts (totvs_orders não tem telefone, só o cadastro).
  const clientIds = [...new Set(eligible.map((c) => c.client_id as string))];
  await backfillClientCodes(admin, new Set(clientIds), BACKFILL_MAX_CODES_PER_RUN);
  const { data: clienteRows } = await admin.from("totvs_clientes").select("protheus_code, phone1").in("protheus_code", clientIds);
  const phoneByClientId = new Map((clienteRows ?? []).map((r) => [r.protheus_code as string, r.phone1 as string | null]));

  let enrolled = 0;
  let semTelefone = 0;
  for (const candidate of eligible) {
    const phone = phoneByClientId.get(candidate.client_id as string);
    if (!phone || isPlaceholderPhone(phone)) {
      semTelefone++;
      continue;
    }

    const contactId = await upsertGhlContact(firstPhone(phone), candidate.client_name);
    if (!contactId) {
      errors.push(`venda-nps ${candidate.id}: não achou/criou contato no GHL`);
      continue;
    }
    if (!(await addContactTag(contactId, NPS_GHL_TAG.venda!))) {
      errors.push(`venda-nps ${candidate.id}: falha ao aplicar a tag no GHL`);
      continue;
    }
    const { error: insertError } = await admin
      .from("venda_nps")
      .insert({ order_id: candidate.id, client_id: candidate.client_id, ghl_contact_id: contactId });
    if (insertError) errors.push(`venda-nps ${candidate.id}: ${insertError.message}`);
    else enrolled++;
  }
  return { enrolled, semTelefone, errors };
}

export async function detectPendingVendaNpsResponses(): Promise<number> {
  const admin = getSupabaseAdmin();
  const { data: pending } = await admin
    .from("venda_nps")
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
    await admin.from("venda_nps").update({ score, respondido_em: reply.dateAdded }).eq("order_id", row.order_id);
    answered++;
  }
  return answered;
}
