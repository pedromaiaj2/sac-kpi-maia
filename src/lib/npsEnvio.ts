import type { getSupabaseAdmin } from "./supabaseAdmin";
import { fetchInBatches } from "./supabaseBatch";
import { isPlaceholderPhone, firstPhone } from "./serviceRequests";
import { upsertGhlContact, addContactTag } from "./ghlClient";
import { backfillClientCodes } from "./totvsSync";

// Envio das pesquisas de NPS por pedido (venda, entrega, compra) -- achado
// do Pedro 20/10/2026 (NPS de venda da nota 5341/208 nunca enviado):
// - "já enviado?" fazia um .in() com todos os pedidos da janela numa URL só;
//   passando de ~550 pedidos o PostgREST devolve 400, o erro era ignorado e
//   toda rodada reaplicava a tag nos mesmos 50 (o GHL não reenvia tag que o
//   contato já tem -- conferido nos 94 afetados) até dar chave duplicada,
//   sem nunca chegar nos pedidos novos. Agora em lotes, e erro derruba.
// - o teto de 50 era cortado antes de olhar telefone: quem não tinha
//   cadastro ocupava as vagas toda rodada. Agora o teto é de envios; quem
//   não tem telefone é pulado e a fila segue.
// - a tag ia antes do insert: duas execuções juntas marcavam o mesmo
//   cliente duas vezes. Agora reserva primeiro (ON CONFLICT DO NOTHING) e
//   só marca se a reserva entrou.

type Admin = ReturnType<typeof getSupabaseAdmin>;
export type TabelaNpsPedido = "venda_nps" | "entrega_nps" | "compra_nps";
export type CandidatoNps = { id: string; client_id: string | null; client_name: string | null };
export type ResultadoEnvioNps = { enrolled: number; semTelefone: number; errors: string[]; avisos: string[] };

export async function pedidosComNps(admin: Admin, tabela: TabelaNpsPedido, orderIds: string[]): Promise<Set<string>> {
  const rows = await fetchInBatches<{ order_id: string }>(orderIds, (lote) => admin.from(tabela).select("order_id").in("order_id", lote));
  return new Set(rows.map((r) => r.order_id));
}

export async function telefonesDosClientes(admin: Admin, codigos: string[]): Promise<Map<string, string | null>> {
  const rows = await fetchInBatches<{ protheus_code: string; phone1: string | null }>(codigos, (lote) =>
    admin.from("totvs_clientes").select("protheus_code, phone1").in("protheus_code", lote)
  );
  return new Map(rows.map((r) => [r.protheus_code, r.phone1]));
}

// candidatos já filtrados (sem NPS, fora do não contatar) e na ordem de
// prioridade -- o backfill de cadastro segue a mesma ordem.
//
// avisos x errors (Victor 21/10/2026): problema de UM contato (GHL não acha
// o telefone, tag recusada) vai em avisos e não marca a rodada como falha;
// errors fica pro que impede a pesquisa de andar (banco, consultas).
export async function enviarNpsPorPedido(
  admin: Admin,
  opts: { tabela: TabelaNpsPedido; tag: string; rotulo: string; candidatos: CandidatoNps[]; maxEnvios: number; maxBackfill: number }
): Promise<ResultadoEnvioNps> {
  const errors: string[] = [];
  const avisos: string[] = [];
  const clientIds = [...new Set(opts.candidatos.map((c) => c.client_id).filter((c): c is string => !!c))];
  await backfillClientCodes(admin, new Set(clientIds), opts.maxBackfill);
  const phoneByClientId = await telefonesDosClientes(admin, clientIds);

  let enrolled = 0;
  let semTelefone = 0;
  for (const candidate of opts.candidatos) {
    if (enrolled >= opts.maxEnvios) break;
    const phone = candidate.client_id ? phoneByClientId.get(candidate.client_id) : null;
    if (!phone || isPlaceholderPhone(phone)) {
      semTelefone++;
      continue;
    }

    const contactId = await upsertGhlContact(firstPhone(phone), candidate.client_name);
    if (!contactId) {
      avisos.push(`${opts.rotulo} ${candidate.id}: não achou/criou contato no GHL`);
      continue;
    }
    const { data: reservada, error: reservaError } = await admin
      .from(opts.tabela)
      .upsert(
        { order_id: candidate.id, client_id: candidate.client_id, ghl_contact_id: contactId },
        { onConflict: "order_id", ignoreDuplicates: true }
      )
      .select("order_id");
    if (reservaError) {
      errors.push(`${opts.rotulo} ${candidate.id}: ${reservaError.message}`);
      continue;
    }
    if (!reservada || reservada.length === 0) continue;
    if (!(await addContactTag(contactId, opts.tag))) {
      avisos.push(`${opts.rotulo} ${candidate.id}: falha ao aplicar a tag no GHL`);
      await admin.from(opts.tabela).delete().eq("order_id", candidate.id);
      continue;
    }
    enrolled++;
  }
  return { enrolled, semTelefone, errors, avisos };
}
