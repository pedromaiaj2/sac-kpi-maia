import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { memoizeWithTtl } from "@/lib/memoCache";
import type { RotasDoDia } from "@/lib/rotasDoDiaCore";

// 1 min em memória: as cargas do dia chegam do Protheus a cada 10 min.
export const getRotasDoDia = memoizeWithTtl(async (dia: string): Promise<RotasDoDia> => {
  const { data, error } = await getSupabaseAdmin().rpc("rotas_do_dia", { p_dia: dia });
  if (error) throw new Error(`rotas_do_dia: ${error.message}`);
  return data as RotasDoDia;
}, 60_000);
