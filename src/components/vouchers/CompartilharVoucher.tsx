"use client";

import { useState } from "react";
import { Copy, Check, Download, MessageCircle } from "lucide-react";

// Botões da imagem do voucher: baixar o PNG, copiar a mensagem pronta e
// abrir a conversa no WhatsApp (o envio da imagem é manual, anexando o PNG).
export function CompartilharVoucher({ imagemUrl, mensagem, whatsappUrl }: { imagemUrl: string; mensagem: string; whatsappUrl: string | null }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  // Nas instâncias por IP o app roda sob um basePath (/apps, /apps/sac), que
  // um href absoluto ignoraria: o prefixo vem da própria URL da página.
  function baixar() {
    const base = window.location.pathname.split("/assistencia/")[0];
    const a = document.createElement("a");
    a.href = `${base}${imagemUrl}?download=1`;
    a.download = "";
    a.click();
  }

  const botao = "inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={baixar} className={botao} style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
          <Download size={16} aria-hidden />
          Baixar imagem
        </button>
        <button type="button" onClick={copiar} className={botao} style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
          {copiado ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copiado ? "Mensagem copiada" : "Copiar mensagem do WhatsApp"}
        </button>
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={botao}
            style={{ background: "color-mix(in srgb, #25d366 18%, transparent)", color: "var(--text-primary)" }}
          >
            <MessageCircle size={16} aria-hidden />
            Abrir conversa
          </a>
        ) : null}
      </div>
      <pre className="text-xs whitespace-pre-wrap rounded-lg p-3" style={{ background: "var(--surface-2)", color: "var(--text-secondary)", fontFamily: "inherit" }}>
        {mensagem}
      </pre>
    </div>
  );
}
