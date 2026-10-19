import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { addContactTag } from "@/lib/ghlClient";
import { NPS_GHL_TAG } from "@/lib/npsDetratores";
import { recordSyncRun } from "@/lib/syncRuns";

// Reprocessamento ÚNICO (não é um cron -- sem gatilho em sync-cron.yml,
// chamado manualmente, pode ser apagado depois de usado) -- achado do
// Victor 19/10/2026: o Workflow "NPS Compra" no GHL ficou em Draft de
// 28/09/2026 até ser publicado em 19/10/2026, sem ninguém perceber.
// Durante esse período, addContactTag (chamado normalmente por
// enrollPendingCompraNps, nps2Meses.ts) continuou "funcionando" do nosso
// lado -- a chamada de API retorna sucesso mesmo que o Workflow de destino
// esteja em Draft, então compra_nps seguiu gravando `enviado_em` pra ~1.109
// pedidos que nunca receberam mensagem de verdade (confirmado via
// Execution Logs do GHL: última execução real em 28/09 5:13am, nada
// depois disso até a publicação). Essa rota reaplica a tag pra cada um
// (agora que o Workflow está Published, a tag realmente dispara) e
// atualiza enviado_em pra agora, pra detectPendingCompraNpsResponses
// (nps2Meses.ts) considerar corretamente respostas a partir do reenvio
// real -- não da tentativa original, que nunca chegou ao cliente.
//
// UPPER_BOUND congela a lista-alvo no momento em que esse achado foi
// confirmado: toda linha reprocessada aqui tem enviado_em atualizado pra
// AGORA (depois do upper bound), o que automaticamente a tira da seleção
// da próxima chamada -- sem precisar de coluna de controle nova, só
// rodar esta rota de novo até "reenviados: 0" pra zerar o resto do lote.
const CUTOFF_DRAFT_INICIO = "2026-09-28T09:00:00Z";
const UPPER_BOUND_CONGELADO = "2026-10-19T20:00:00Z";
const BATCH_LIMIT = 300;
const DELAY_MS = 180;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: rows, error } = await admin
    .from("compra_nps")
    .select("order_id, ghl_contact_id")
    .is("respondido_em", null)
    .gt("enviado_em", CUTOFF_DRAFT_INICIO)
    .lte("enviado_em", UPPER_BOUND_CONGELADO)
    .order("order_id")
    .limit(BATCH_LIMIT);
  if (error) {
    await recordSyncRun("reprocess-compra-nps", false, {}, [error.message]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, reenviados: 0, falhas: 0, restantes: 0, done: true });
  }

  let reenviados = 0;
  const falhas: string[] = [];
  for (const row of rows) {
    try {
      const success = await addContactTag(row.ghl_contact_id as string, NPS_GHL_TAG.compra!);
      if (success) {
        const { error: updError } = await admin
          .from("compra_nps")
          .update({ enviado_em: new Date().toISOString() })
          .eq("order_id", row.order_id);
        if (updError) falhas.push(`${row.order_id}: update falhou -- ${updError.message}`);
        else reenviados++;
      } else {
        falhas.push(`${row.order_id}: addContactTag falhou`);
      }
    } catch (err) {
      falhas.push(`${row.order_id}: ${(err as Error).message}`);
    }
    await delay(DELAY_MS);
  }

  const { count: restantes } = await admin
    .from("compra_nps")
    .select("order_id", { count: "exact", head: true })
    .is("respondido_em", null)
    .gt("enviado_em", CUTOFF_DRAFT_INICIO)
    .lte("enviado_em", UPPER_BOUND_CONGELADO);

  const ok = falhas.length === 0;
  await recordSyncRun("reprocess-compra-nps", ok, { reenviados, falhasCount: falhas.length, restantes }, falhas);
  return NextResponse.json({ ok, reenviados, falhas, restantes, done: (restantes ?? 0) === 0 });
}
