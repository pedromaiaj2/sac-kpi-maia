import { NextRequest, NextResponse } from "next/server";
import { getEstornoRequestsSummaryByStore } from "@/lib/estornoRequests";

// Rota pedida pelo Gabriel/financeiro 14/10/2026: resumo de estornos
// pendentes por loja, pros cards da tela dos caixas no portal de
// conciliação da AIAM (ver src/proxy.ts, ESTORNO_EMBED). Só contagem e
// valor agregado, sem dado pessoal -- de propósito sem autenticação, igual
// a /api/photos (ver PASSTHROUGH_PREFIXES em proxy.ts).
export async function GET(req: NextRequest) {
  const filial = req.nextUrl.searchParams.get("filial") ?? undefined;
  try {
    const resumo = await getEstornoRequestsSummaryByStore(filial);
    return NextResponse.json(resumo);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao buscar resumo." }, { status: 500 });
  }
}
