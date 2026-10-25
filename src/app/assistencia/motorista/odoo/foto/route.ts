import { NextRequest, NextResponse } from "next/server";
import { getMotoristaSessao } from "@/lib/odoo/logisticaAuth";
import { exigirCargaDoMotorista } from "@/lib/odoo/rotaMotorista";
import { mensagemDeErro } from "@/lib/odoo/logistica";
import { uploadLoosePhotoBytes } from "@/lib/servicePhotos";
import { photoPublicUrl } from "@/lib/localPhotoStorage";

// Foto do comprovante da entrega do Odoo. POST comum (não Server Action) --
// mesmo motivo de /api/motorista/upload-photo: motorista abre pelo
// navegador embutido do WhatsApp. Mora sob /assistencia (não /api) pra
// passar no proxy.ts sem precisar de exceção nova; a sessão é conferida
// aqui (cookie driver_session, path "/").
//
// A API do Odoo ainda NÃO recebe arquivo: a foto fica no disco de fotos
// deste sistema (PHOTO_STORAGE_DIR) e a URL vai no texto da observação da
// baixa (ver registrarParadaAction). Pendência documentada em
// docs/LOGISTICA-ODOO.md.
export async function POST(req: NextRequest) {
  try {
    const sessao = await getMotoristaSessao();
    if (!sessao) return NextResponse.json({ error: "Sessão expirada. Faça login de novo." }, { status: 401 });

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Não foi possível ler o envio. Tente de novo." }, { status: 400 });
    }
    const cargaId = Number(form.get("cargaId"));
    const paradaId = Number(form.get("paradaId"));
    if (!Number.isInteger(cargaId) || cargaId <= 0 || !Number.isInteger(paradaId) || paradaId <= 0) {
      return NextResponse.json({ error: "Parada inválida." }, { status: 400 });
    }

    try {
      const { carga } = await exigirCargaDoMotorista(sessao, cargaId);
      if (!carga.paradas.some((p) => p.parada_id === paradaId)) {
        return NextResponse.json({ error: "Essa parada não é desta carga." }, { status: 403 });
      }
    } catch (err) {
      return NextResponse.json({ error: mensagemDeErro(err) }, { status: 403 });
    }

    const file = form.get("photo");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Selecione uma foto." }, { status: 400 });

    const path = await uploadLoosePhotoBytes(`odoo-entregas/carga-${cargaId}/parada-${paradaId}`, file);
    const base = (process.env.APP_PUBLIC_URL ?? req.nextUrl.origin).replace(/\/+$/, "");
    return NextResponse.json({ ok: true, url: `${base}${photoPublicUrl(path)}` });
  } catch (err) {
    console.error("[motorista-odoo-foto]", err);
    return NextResponse.json({ error: (err as Error)?.message ?? "Erro inesperado no servidor." }, { status: 500 });
  }
}
