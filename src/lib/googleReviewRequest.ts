import type { getSupabaseAdmin } from "./supabaseAdmin";
import { setGhlContactCustomField, addContactTag, type GhlConta } from "./ghlClient";
import { listClientesNaoContatar } from "./recompra";

// Pedido de avaliação Google pros clientes promotores -- pedido do Victor
// 23/10/2026. Chamada de dentro de cada "detectPendingXxxNpsResponses" logo
// depois que o score da pesquisa original é gravado, reaproveitando o
// ghlContactId que aquela pesquisa já resolveu (sem telefone/contato de
// novo). Mesma mecânica de tag + Workflow do GHL que as pesquisas de NPS já
// usam (ver npsEnvio.ts) -- só que aqui o Workflow (criado no GHL, fora
// daqui) espera o link da loja num custom field do contato, porque cada
// loja tem um link diferente (stores.google_maps_url) e todo template de
// NPS até hoje é texto fixo.
//
// Best-effort de propósito: nunca lança -- um problema aqui (loja sem link,
// GHL fora do ar) não pode derrubar a detecção da pesquisa original por
// trás, que já rodou e gravou o score antes de chamar isso.
export type GoogleReviewOrigem = "venda" | "entrega" | "compra" | "montagem" | "assistencia_tecnica";

const GOOGLE_REVIEW_TAG = "pedir-avaliacao-google";
// Field Key do custom field no GHL -- precisa bater exatamente com o
// cadastrado lá (ver plano/README do Workflow "Pedir avaliação Google").
const GOOGLE_REVIEW_CUSTOM_FIELD_KEY = "link_avaliacao_google";

type Admin = ReturnType<typeof getSupabaseAdmin>;

export async function maybeRequestGoogleReview(
  admin: Admin,
  opts: {
    origem: GoogleReviewOrigem;
    origemId: string;
    clientId: string | null;
    score: number;
    ghlContactId: string;
    storeId: string | null;
    conta?: GhlConta;
  }
): Promise<void> {
  if (opts.score < 4) return;
  if (!opts.storeId) return;

  try {
    const { data: store } = await admin.from("stores").select("google_maps_url").eq("id", opts.storeId).single();
    const link = (store?.google_maps_url as string | null) ?? null;
    if (!link) return;

    if (opts.clientId) {
      const naoContatar = await listClientesNaoContatar();
      if (naoContatar.has(opts.clientId)) return;
    }

    // Reserva antes de mexer no GHL (mesmo motivo de npsEnvio.ts): só
    // segue se a linha entrou agora, evita pedir duas vezes em execuções
    // paralelas ou já ter pedido antes por outro pedido/chamado do mesmo
    // cliente.
    const { data: reservada, error } = await admin
      .from("google_review_requests")
      .upsert(
        {
          origem: opts.origem,
          origem_id: opts.origemId,
          client_id: opts.clientId,
          store_id: opts.storeId,
          score: opts.score,
          ghl_contact_id: opts.ghlContactId,
        },
        { onConflict: "origem,origem_id", ignoreDuplicates: true }
      )
      .select("id");
    if (error || !reservada || reservada.length === 0) return;

    await setGhlContactCustomField(opts.ghlContactId, GOOGLE_REVIEW_CUSTOM_FIELD_KEY, link, opts.conta);
    await addContactTag(opts.ghlContactId, GOOGLE_REVIEW_TAG, opts.conta);
  } catch {
    // best-effort, ver comentário no topo do arquivo.
  }
}
