import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import type { getSupabaseAdmin } from "./supabaseAdmin";

// Trava de execução única pra jobs fora do Protheus -- achado do Pedro
// 20/10/2026: depois do reboot da VPS, três /api/sync rodaram juntos
// (14:43, 14:51, 14:53). Mesmas funções da trava do totvsSync.ts
// (0155_sync_locks.sql), outra chave. Sem renovação: o TTL cobre a rodada
// mais longa com folga e, se o processo morrer, a trava expira sozinha.
export type TravaOcupada = { skipped: "em_execucao"; origem: string | null; desde: string | null };

export async function comTrava<T>(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  job: string,
  origem: string,
  ttlSegundos: number,
  fn: () => Promise<T>
): Promise<T | TravaOcupada> {
  const dono = randomUUID();
  const { data, error } = await supabase
    .rpc("adquirir_trava", {
      p_job: job,
      p_dono: dono,
      p_origem: `${origem}@${process.env.name ?? hostname()}`,
      p_ttl_segundos: ttlSegundos,
    })
    .single<{ adquirida: boolean; origem: string | null; desde: string | null }>();
  if (error || !data) throw new Error(`adquirir_trava ${job}: ${error?.message ?? "sem resposta"}`);
  if (!data.adquirida) return { skipped: "em_execucao", origem: data.origem, desde: data.desde };

  try {
    return await fn();
  } finally {
    const { error: liberarError } = await supabase.rpc("liberar_trava", { p_job: job, p_dono: dono });
    if (liberarError) console.error(`[travaSync] liberar_trava ${job}:`, liberarError.message);
  }
}
