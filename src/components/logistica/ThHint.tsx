import { Info } from "lucide-react";

// Rótulo com ícone "i" que abre a explicação -- pedido do Victor
// 13/10/2026 ("coloque o i, dizendo o que cada uma significa"). Antes era
// só o tooltip nativo (`title`), que demora a aparecer e não abre no
// celular. Agora é uma caixinha só de CSS: abre ao passar o mouse e ao
// tocar/focar o ícone (tabIndex), sem JS -- renderiza igual em Server e
// Client Component. `hidden` (display none) enquanto fechada, pra não
// criar rolagem horizontal. `lado="direita"` ancora a caixa pela direita,
// pra colunas encostadas na borda direita.
export function ThHint({ children, hint, lado = "esquerda" }: { children: React.ReactNode; hint: string; lado?: "esquerda" | "direita" }) {
  return (
    <span className="group relative inline-flex items-center gap-1 min-w-0">
      {children}
      <span
        tabIndex={0}
        role="button"
        aria-label={`O que é: ${hint}`}
        className="shrink-0 inline-flex items-center justify-center rounded-full cursor-help focus:outline-none focus-visible:ring-2"
        style={{ color: "var(--brand-green)" }}
      >
        <Info aria-hidden size={13} />
      </span>
      <span
        role="tooltip"
        className={`hidden group-hover:block group-focus-within:block absolute top-full z-30 mt-1 w-64 max-w-[80vw] rounded-lg border px-2.5 py-2 text-[11px] font-normal normal-case tracking-normal leading-snug text-left whitespace-normal shadow-lg ${
          lado === "direita" ? "right-0" : "left-0"
        }`}
        style={{ background: "var(--surface-1)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        {hint}
      </span>
    </span>
  );
}
