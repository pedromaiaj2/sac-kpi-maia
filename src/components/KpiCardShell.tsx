import type { ReactNode, KeyboardEvent } from "react";

// Casca visual compartilhada pelos cards da fileira de KPIs (Total de
// chamados, Prejuízo, Produtos/Lojas/Rotas) -- pedido do Victor 21/09/2026:
// "refatorar os outros cards dessa mesma fileira... para manter a
// consistência visual" com o MetricCard (ver MetricCard.tsx, que passou a
// usar essa casca também). Deliberadamente FORA do StatTile genérico (usado
// em 8+ outras telas do painel, ex. prazos-produtos, encomendas, loja,
// vendas) -- mudar o visual dele mudaria todas essas telas junto, que não
// foi pedido. `h-full` + grid pai com `items-stretch` (padrão) = todos os
// cards da fileira com a mesma altura, mesmo com quantidade de conteúdo
// diferente.
export function KpiCardShell({
  children,
  accentColor,
  onClick,
}: {
  children: ReactNode;
  // Cor do traço de status no topo -- sutil, mesma lógica de status do
  // MetricCard: verde/vermelho quando o card tem meta, ou omitido
  // (sem borda colorida) pra cards sem meta definida (neutro).
  accentColor?: string;
  onClick?: () => void;
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  }

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      className={`cartao p-5 flex flex-col gap-3 min-w-0 h-full ${
        onClick ? "cursor-pointer transition-transform duration-200 hover:-translate-y-0.5" : ""
      }`}
    >
      {/* Cor de status num traço curto no topo (design system 17/10/2026),
          no lugar da borda superior de 3px; sem status, o espaço fica
          reservado pra os rótulos da fileira alinharem. */}
      <span aria-hidden className="block h-1 w-10 rounded-full" style={{ background: accentColor ?? "transparent" }} />
      {children}
    </div>
  );
}

// Tag leve (fundo claro + texto na mesma cor, via color-mix -- funciona em
// claro/escuro sem precisar de classes red-100/red-800 fixas) -- mesmo
// estilo da tag "Fora da meta"/"Dentro da meta" do MetricCard, extraído
// aqui pra reaproveitar no card de Prejuízo (pedido do Victor: "substitua
// o balão vermelho escuro e pesado... por uma tag leve no mesmo estilo do
// primeiro card").
export function StatusPill({
  label,
  tone,
  title,
  icon,
}: {
  label: string;
  // "warning" adicionado 09/10/2026 (semáforo de 3 cores do Índice de
  // Volta/Volta Logística na tela de KPIs de logística -- verde/amarelo/
  // vermelho, não só "dentro"/"fora" da meta).
  tone: "critical" | "warning" | "good" | "neutral";
  title?: string;
  icon?: ReactNode;
}) {
  const color =
    tone === "critical"
      ? "var(--status-critical)"
      : tone === "warning"
        ? "var(--status-warning)"
        : tone === "good"
          ? "var(--status-good)"
          : "var(--text-muted)";
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 shrink-0 ${title ? "cursor-help" : ""}`}
      style={{ background: `color-mix(in srgb, ${color} 16%, var(--surface-1))`, color }}
    >
      {icon}
      {label}
    </span>
  );
}
