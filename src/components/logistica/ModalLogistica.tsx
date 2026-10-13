"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

// Janela de detalhe da aba Logística (chamados de um motorista, pedidos de
// um motivo de insucesso): fundo escurecido, fecha no X, no clique fora e
// no Esc. Só apresentação -- quem chama passa o conteúdo pronto.
export function ModalLogistica({
  titulo,
  subtitulo,
  onFechar,
  children,
}: {
  titulo: string;
  subtitulo?: React.ReactNode;
  onFechar: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-label={titulo}>
      <button type="button" aria-label="Fechar" className="absolute inset-0 cursor-default" style={{ background: "rgb(0 0 0 / 0.45)" }} onClick={onFechar} />
      <div
        className="relative w-full max-w-5xl max-h-[85vh] flex flex-col rounded-xl overflow-hidden shadow-xl"
        style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              {titulo}
            </h3>
            {subtitulo && (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {subtitulo}
              </p>
            )}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="shrink-0 rounded-full p-1" style={{ color: "var(--text-secondary)" }}>
            <X size={18} />
          </button>
        </div>
        <div className="overflow-auto">{children}</div>
      </div>
    </div>
  );
}
