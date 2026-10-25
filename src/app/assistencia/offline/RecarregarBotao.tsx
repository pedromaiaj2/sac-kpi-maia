"use client";

export function RecarregarBotao() {
  return (
    <button type="button" onClick={() => window.location.reload()} className="mx-auto rounded-xl px-5 py-3 font-bold" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
      Tentar de novo
    </button>
  );
}
