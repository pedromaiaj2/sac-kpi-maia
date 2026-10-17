import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { RotasDoDia } from "@/lib/rotasDoDiaCore";

export async function getRotasDoDia(dia: string): Promise<RotasDoDia> {
  const { data, error } = await getSupabaseAdmin().rpc("rotas_do_dia", { p_dia: dia });
  if (error) throw new Error(`rotas_do_dia: ${error.message}`);
  return data as RotasDoDia;
}
