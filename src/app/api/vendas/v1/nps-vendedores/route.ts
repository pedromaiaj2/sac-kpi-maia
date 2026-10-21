import { NextRequest, NextResponse } from "next/server";
import { apiKeyValida } from "@/lib/logisticaApi";
import { getNpsVendedores, NPS_VENDEDORES_JANELA_MAXIMA_DIAS } from "@/lib/npsVendedores";

// NPS de atendimento em loja por vendedor, pro app onde os vendedores lançam
// venda (Pedro). Só leitura, lê do Supabase -- nunca do Protheus. Contrato em
// lojas-maia-integracao/apis/vendas-v1/README.md. Chave própria
// (VENDAS_API_KEYS), separada da API de logística.
function dataValida(valor: string | null): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

function erro(status: number, codigo: string, mensagem: string) {
  return NextResponse.json({ erro: codigo, mensagem }, { status });
}

export async function GET(req: NextRequest) {
  if (!apiKeyValida(req.headers.get("x-api-key"), process.env.VENDAS_API_KEYS)) {
    return erro(401, "nao_autorizado", "X-API-Key ausente ou inválida.");
  }

  const p = req.nextUrl.searchParams;
  const de = p.get("de");
  const ate = p.get("ate");
  if (!dataValida(de) || !dataValida(ate)) return erro(400, "periodo_invalido", "Informe de e ate no formato AAAA-MM-DD.");
  if (ate < de) return erro(400, "periodo_invalido", "ate não pode ser anterior a de.");
  const dias = (Date.parse(ate) - Date.parse(de)) / 86_400_000 + 1;
  if (dias > NPS_VENDEDORES_JANELA_MAXIMA_DIAS) {
    return erro(400, "periodo_invalido", `Janela máxima de ${NPS_VENDEDORES_JANELA_MAXIMA_DIAS} dias.`);
  }
  const filial = p.get("filial");
  if (filial !== null && !/^\d{3}$/.test(filial)) return erro(400, "filial_invalida", "filial deve ter 3 dígitos (ex.: 205).");
  const vendedor = p.get("vendedor");
  if (vendedor !== null && !/^[A-Za-z0-9]{1,10}$/.test(vendedor)) {
    return erro(400, "vendedor_invalido", "vendedor deve ser o código do Protheus (letras e números).");
  }

  try {
    const data = await getNpsVendedores({ de, ate, filial, vendedor });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[vendas/nps-vendedores]", (err as Error).message);
    return erro(500, "erro_interno", "Falha ao calcular o NPS.");
  }
}
