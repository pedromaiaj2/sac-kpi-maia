import { NextRequest, NextResponse } from "next/server";
import { baixarRomaneioPdf, mensagemDeErro } from "@/lib/odoo/logistica";
import { getOperadorLogistica } from "@/lib/odoo/logisticaAuth";

// Romaneio da carga (PDF gerado pelo Odoo, ordem LIFO de carregamento).
// GET pra abrir em nova aba/imprimir; a chave da ponte fica no servidor.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const op = await getOperadorLogistica();
  if (!op) return NextResponse.json({ error: "Sessão do CD expirada." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const { bytes, nome } = await baixarRomaneioPdf(Number(id), op.operadorOdoo);
    return new NextResponse(bytes, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome}"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json({ error: mensagemDeErro(err) }, { status: 502 });
  }
}
