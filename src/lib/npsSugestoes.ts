import { getSupabaseAdmin } from "./supabaseAdmin";

// Sugestões de melhoria em texto livre -- pedido do Victor 23/10/2026,
// capturadas hoje só na pesquisa "Pós-entrega" (ver entregaNps.ts,
// detectPendingEntregaSugestoes). `origem` já vem aberto pra outro momento
// da jornada entrar depois sem precisar de migração nova.
export type NpsSugestao = {
  id: string;
  origem: string;
  clientName: string | null;
  storeId: string | null;
  storeName: string | null;
  mensagem: string;
  capturadaEm: string;
  lida: boolean;
};

type StoreJoin = { name: string | null } | { name: string | null }[] | null;

export async function listNpsSugestoes(): Promise<NpsSugestao[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("nps_sugestoes")
    .select("id, origem, client_name, store_id, mensagem, capturada_em, lida, stores(name)")
    .order("capturada_em", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const storeJoin = r.stores as StoreJoin;
    const store = Array.isArray(storeJoin) ? storeJoin[0] : storeJoin;
    return {
      id: r.id as string,
      origem: r.origem as string,
      clientName: r.client_name as string | null,
      storeId: r.store_id as string | null,
      storeName: store?.name ?? null,
      mensagem: r.mensagem as string,
      capturadaEm: r.capturada_em as string,
      lida: r.lida as boolean,
    };
  });
}

export async function setNpsSugestaoLida(id: string, lida: boolean): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("nps_sugestoes").update({ lida }).eq("id", id);
  if (error) throw new Error(error.message);
}
