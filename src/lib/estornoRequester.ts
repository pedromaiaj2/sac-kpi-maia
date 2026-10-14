import { getCaixaSession } from "@/app/assistencia/caixa-actions";
import { getLojaGerenteSession } from "@/app/assistencia/loja-actions";
import { getCaixaStoreId } from "./caixas";
import { getGerenteStoreIds } from "./gerentes";
import { getSupabaseAdmin } from "./supabaseAdmin";

// Quem pode solicitar estorno: caixa (PIN por pessoa, 1 loja fixa), gerente
// (login que ele já usa em /assistencia/loja, pode ter mais de uma loja), ou
// "embed" (pedido do Gabriel/financeiro 14/10/2026: essa tela embutida via
// iframe no portal de conciliação da AIAM, loja identificada só pela URL
// ?filial=, sem cookie nenhum -- só existe quando ESTORNO_EMBED está
// setada, nas 4 instâncias de produção normais isso nunca é alcançado).
// Mesmo espírito de resolveEncomendaRequester (encomendaRequester.ts).
export type EstornoRequester =
  | { kind: "caixa"; storeId: string; name: string }
  | { kind: "gerente"; storeIds: string[]; name: string }
  | { kind: "embed"; storeId: string; name: string };

// Gerente vem antes de caixa -- mesmo motivo de resolveEncomendaRequester:
// os cookies têm paths diferentes e podem coexistir no mesmo navegador, e a
// identidade de gerente (mais ampla) deve prevalecer. O fallback "embed" só
// entra em jogo quando nenhum cookie resolveu nada -- login normal sempre
// vence, mesmo dentro da instância embutida.
export async function resolveEstornoRequester(filial?: string | null): Promise<EstornoRequester | null> {
  const gerenteName = await getLojaGerenteSession();
  if (gerenteName) {
    const storeIds = await getGerenteStoreIds(gerenteName);
    if (storeIds.length > 0) return { kind: "gerente", storeIds, name: gerenteName };
  }

  const caixaName = await getCaixaSession();
  if (caixaName) {
    const storeId = await getCaixaStoreId(caixaName);
    if (storeId) return { kind: "caixa", storeId, name: caixaName };
  }

  if (process.env.ESTORNO_EMBED && filial) {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("stores").select("id").eq("id", filial).maybeSingle();
    if (data) return { kind: "embed", storeId: filial, name: "Caixa (portal conciliação)" };
  }

  return null;
}
