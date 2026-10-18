import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { runAuditoriaCargas } from "@/lib/totvsSync";

// Conferência noturna das cargas com o Protheus (ver runAuditoriaCargas),
// chamada pelo cron da VPS de madrugada. O prefixo /api/totvs-sync faz a rota
// passar direto no proxy. Mesma autenticação e mesma trava do sync.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const r = await runAuditoriaCargas(getSupabaseAdmin(), "rota-auditoria");
    if ("skipped" in r) return NextResponse.json(r);
    const { restantes, ...resumo } = r;
    return NextResponse.json({ ...resumo, restantes: restantes.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
