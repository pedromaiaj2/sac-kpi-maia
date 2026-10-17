import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { runTotvsSyncCargasDoDia } from "@/lib/totvsSync";

// Rodada rápida das cargas do dia (mural "Rotas de hoje" em /kpis/logistica),
// chamada pelo cron da VPS a cada 10 min entre as rodadas completas de
// /api/totvs-sync. Mesma autenticação e mesma trava do sync completo.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runTotvsSyncCargasDoDia(getSupabaseAdmin(), "rota-cargas"));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
