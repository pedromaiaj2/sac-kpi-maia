import { NextRequest, NextResponse } from "next/server";
import { baixarDanfePdf, mensagemDeErro } from "@/lib/odoo/logistica";
import { getOperadorLogistica } from "@/lib/odoo/logisticaAuth";

// DANFE A4 da NF-e do pedido (?doc=5117 padrão | 5922). Só CD/equipe por
// enquanto: o detalhe da carga do Odoo ainda não traz o pedido_id nas
// paradas, então não dá pra provar que o pedido é da carga do motorista
// logado (pendência no Odoo, ver docs/LOGISTICA-ODOO.md).
export async function GET(req: NextRequest, ctx: { params: Promise<{ pedidoId: string }> }) {
  const op = await getOperadorLogistica();
  if (!op) return NextResponse.json({ error: "Sessão do CD expirada." }, { status: 401 });
  const { pedidoId } = await ctx.params;
  const doc = req.nextUrl.searchParams.get("doc") === "5922" ? "5922" : "5117";
  try {
    const { bytes, nome } = await baixarDanfePdf(Number(pedidoId), doc, "logistica");
    return new NextResponse(bytes, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome}"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json({ error: mensagemDeErro(err) }, { status: 502 });
  }
}
