"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarParadaAction } from "@/app/assistencia/motorista/odoo/odoo-actions";
import type { CatalogosOdoo, ResultadoParada } from "@/lib/odoo/logisticaTipos";
import { useAcaoOdoo } from "./useAcaoOdoo";

function lerGeo(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((res) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => res(null),
      { timeout: 8000, maximumAge: 60_000, enableHighAccuracy: true },
    );
  });
}

// Baixa da parada do Odoo: foto do comprovante (opcional por enquanto),
// Entreguei / Entrega parcial / Não consegui (motivo do catálogo do Odoo +
// observação). Geolocalização best-effort no momento da baixa.
export function ParadaOdooBaixa({ cargaId, paradaId, motivos }: { cargaId: number; paradaId: number; motivos: CatalogosOdoo["motivos"] }) {
  const router = useRouter();
  const { pending, run, showToast } = useAcaoOdoo();
  const [fotos, setFotos] = useState<string[]>([]);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const ocupado = pending || enviandoFoto;

  async function enviarFoto(file: File) {
    setEnviandoFoto(true);
    try {
      const fd = new FormData();
      fd.set("photo", file);
      fd.set("cargaId", String(cargaId));
      fd.set("paradaId", String(paradaId));
      // POST comum (navegador embutido do WhatsApp), igual ao upload do Victor;
      // aqui a rota devolve a URL da foto, que vai na observação da baixa.
      const res = await fetch("/assistencia/motorista/odoo/foto", { method: "POST", body: fd, signal: AbortSignal.timeout(45_000) });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || `Não foi possível enviar a foto (erro ${res.status}).`);
      setFotos((f) => [...f, data.url as string]);
      showToast("Foto enviada.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Falha ao enviar a foto.", "error");
    } finally {
      setEnviandoFoto(false);
      setInputKey((k) => k + 1);
    }
  }

  function baixa(resultado: ResultadoParada) {
    if (resultado === "insucesso" && !motivo) {
      showToast("Escolha o motivo.", "error");
      return;
    }
    run(
      async () => {
        const g = await lerGeo();
        return registrarParadaAction(cargaId, paradaId, { resultado, motivo: motivo || null, obs: obs || null, geoLat: g?.lat ?? null, geoLng: g?.lng ?? null, fotoUrls: fotos });
      },
      (d) => `Registrado. Faltam ${d.pendentes} parada(s).`,
      () => router.push("/assistencia/motorista/odoo"),
    );
  }

  const fotoLabel = (texto: string, icone: string, capture: boolean) => (
    <label
      className="text-sm rounded-xl px-3 py-5 font-semibold text-center cursor-pointer flex flex-col items-center gap-1"
      style={{ border: "2px dashed var(--status-warning)", color: "var(--status-warning)", opacity: ocupado ? 0.6 : 1, pointerEvents: ocupado ? "none" : "auto" }}
    >
      <span className="text-2xl leading-none">{icone}</span>
      {enviandoFoto ? "Enviando…" : texto}
      <input
        key={`${capture ? "cam" : "gal"}-${inputKey}`}
        type="file"
        accept={capture ? "image/*" : "image/jpeg,image/png,image/webp,image/heic,image/heif"}
        {...(capture ? { capture: "environment" as const } : {})}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void enviarFoto(f);
        }}
        className="hidden"
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg p-4 flex flex-col gap-3" style={{ background: "color-mix(in srgb, var(--status-warning) 8%, var(--surface-1))", border: "2px solid var(--status-warning)" }}>
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          📝 Comprovante (foto do canhoto assinado)
        </h3>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          A foto fica guardada aqui e o link vai junto da baixa para o Odoo.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {fotoLabel("Tirar foto", "📷", true)}
          {fotoLabel("Da galeria", "🖼️", false)}
        </div>
        {fotos.length ? (
          <div className="flex gap-2 flex-wrap">
            {fotos.map((u) => (
              <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="Comprovante" className="h-20 w-20 object-cover rounded-lg border" style={{ borderColor: "var(--border)" }} />
              </a>
            ))}
          </div>
        ) : null}
      </div>

      <button type="button" disabled={ocupado} onClick={() => baixa("entregue")} className="text-base font-bold rounded-xl px-4 py-4 disabled:opacity-60" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
        {pending ? "Registrando…" : "✅ Entreguei"}
      </button>
      <button type="button" disabled={ocupado} onClick={() => baixa("entrega_parcial")} className="text-base font-semibold rounded-xl px-4 py-3 border disabled:opacity-60" style={{ borderColor: "var(--status-warning)", color: "var(--text-primary)", background: "var(--surface-1)" }}>
        Entrega parcial
      </button>

      <div className="rounded-lg p-4 flex flex-col gap-2" style={{ background: "var(--surface-2)" }}>
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Não consegui entregar
        </h3>
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}>
          <option value="">Motivo…</option>
          {motivos.map((m) => (
            <option key={m.id} value={m.codigo}>
              {m.nome}
            </option>
          ))}
        </select>
        <textarea
          rows={2}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Observação (vale também para entrega parcial)"
          className="rounded-lg border px-3 py-2.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        />
        <button type="button" disabled={ocupado} onClick={() => baixa("insucesso")} className="text-sm font-semibold rounded-xl px-4 py-3 border disabled:opacity-60" style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)", background: "var(--surface-1)" }}>
          Registrar que não consegui
        </button>
      </div>
    </div>
  );
}
