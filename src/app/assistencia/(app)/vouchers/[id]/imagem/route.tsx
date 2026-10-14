import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { getOptionalProfile } from "@/lib/dal";
import { getVoucher } from "@/lib/vouchers";
import { VOUCHER_VISUAL } from "@/lib/voucherVisual";
import { beneficioTitulo, beneficioDetalhe, dataBr, mascararCpf, nomeCurto, primeiroNome, REGRAS_VOUCHER } from "@/lib/vouchersCore";

export const dynamic = "force-dynamic";

// PNG do voucher pro WhatsApp. Só admin: a imagem tem nome e parte do CPF.
// O QR leva só o código -- nenhum dado pessoal.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getOptionalProfile();
  if (!profile || profile.role !== "admin") return new Response("Acesso negado", { status: 403 });
  const { id } = await params;
  const v = await getVoucher(id);
  if (!v) return new Response("Voucher não encontrado", { status: 404 });

  const { cores, largura, altura } = VOUCHER_VISUAL;
  const logoExt = path.extname(VOUCHER_VISUAL.logoArquivo).toLowerCase() === ".png" ? "png" : "jpeg";
  const logo = `data:image/${logoExt};base64,${(await readFile(path.join(/* turbopackIgnore: true */ process.cwd(), VOUCHER_VISUAL.logoArquivo))).toString("base64")}`;
  const qr = await QRCode.toDataURL(v.codigo, { margin: 1, width: 340, errorCorrectionLevel: "M" });
  const [regular, negrito] = await Promise.all([
    readFile(path.join(/* turbopackIgnore: true */ process.cwd(), VOUCHER_VISUAL.fonteRegular)),
    readFile(path.join(/* turbopackIgnore: true */ process.cwd(), VOUCHER_VISUAL.fonteNegrito)),
  ]);
  const detalhe = beneficioDetalhe(v);

  const imagem = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: cores.fundo, padding: 48, fontFamily: "Geist" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            background: cores.cartao,
            borderRadius: 40,
            padding: "40px 56px",
            color: cores.texto,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse só aceita <img> */}
            <img src={logo} width={170} height={170} alt="" />
            <div style={{ display: "flex", fontSize: 54, fontWeight: 700, marginTop: 16 }}>Olá, {primeiroNome(v.clienteNome)}!</div>
            <div style={{ display: "flex", fontSize: 36, color: cores.textoSuave, marginTop: 4 }}>Preparamos um presente para você</div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              background: cores.destaque,
              color: cores.textoNoDestaque,
              borderRadius: 28,
              padding: "26px 32px",
            }}
          >
            <div style={{ display: "flex", fontSize: v.tipoBeneficio === "brinde" ? 52 : 74, fontWeight: 700, textAlign: "center", lineHeight: 1.1 }}>
              {beneficioTitulo(v)}
            </div>
            {detalhe ? <div style={{ display: "flex", fontSize: 30, marginTop: 10, textAlign: "center" }}>{detalhe}</div> : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 36 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse só aceita <img> */}
            <img src={qr} width={340} height={340} alt="" />
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ display: "flex", fontSize: 26, color: cores.textoSuave }}>Código do voucher</div>
              <div style={{ display: "flex", fontSize: 48, fontWeight: 700, letterSpacing: 1, marginTop: 4 }}>{v.codigo}</div>
              <div style={{ display: "flex", fontSize: 26, color: cores.textoSuave, marginTop: 22 }}>Titular</div>
              <div style={{ display: "flex", fontSize: 32, fontWeight: 700 }}>{nomeCurto(v.clienteNome)}</div>
              <div style={{ display: "flex", fontSize: 30 }}>CPF {mascararCpf(v.clienteCpf)}</div>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, marginTop: 22, color: cores.fundo }}>Válido até {dataBr(v.dataValidade)}</div>
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 24, color: cores.textoSuave, textAlign: "center", lineHeight: 1.35 }}>{REGRAS_VOUCHER}</div>
        </div>
      </div>
    ),
    {
      width: largura,
      height: altura,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: negrito, weight: 700, style: "normal" },
      ],
    },
  );

  const download = new URL(req.url).searchParams.has("download");
  const headers = new Headers(imagem.headers);
  headers.set("Cache-Control", "private, no-store");
  if (download) headers.set("Content-Disposition", `attachment; filename="voucher-${v.codigo}.png"`);
  return new Response(imagem.body, { status: 200, headers });
}
