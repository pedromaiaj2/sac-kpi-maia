"use client";

import type { Count } from "@/lib/kpi";

// Ranking numerado (1º, 2º, 3º...) por PERCENTUAL -- pedido do Victor
// 13/10/2026, revertendo a 1ª tentativa (gráfico de barra com filtro
// nossa fábrica x fornecedores, "não gostei"): "só coloque num formato de
// ranking, levando em consideração o numero de vendas por produto...
// rankeie, 1º, 2, 3º... e além disso, faça um ranking também para os
// erros dos conferentes, levando em conta o percentual de erros/notas".
// Mesmo visual de ProdutoRankingList.tsx (posição numerada + linha
// dividida), genérico o bastante pra servir os dois rankings (produto com
// defeito de fabricação e conferente que mais errou) -- cada chamador
// converte seu próprio tipo de dado pra PercentualRankingRow na hora de
// renderizar, o componente em si não sabe de onde veio o número.
export type PercentualRankingRow = Count & {
  // null = sem base suficiente pra calcular % (sem código TOTVS
  // identificado, ou venda abaixo do mínimo) -- aparece como "N/A", cai
  // pro fim da lista (ordenação já vem pronta do servidor).
  pct: number | null;
  pctLabel: string;
  // Linha secundária, menor, embaixo do nome -- ex. "18 chamados de 146
  // vendidos" ou "5 de 1.026 notas".
  detail: string;
};

export function PercentualRankingList({
  title,
  subtitle,
  items,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  items: PercentualRankingRow[];
  onSelect?: (item: PercentualRankingRow) => void;
}) {
  return (
    <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      {subtitle ? (
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      ) : (
        <div className="mb-3" />
      )}
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem dados suficientes ainda.
        </p>
      ) : (
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
          {items.map((item, i) => {
            const key = item.tag ?? `${item.label}-${i}`;
            return (
              <button
                key={key}
                type="button"
                onClick={onSelect ? () => onSelect(item) : undefined}
                disabled={!onSelect}
                className="flex items-center gap-3 py-2.5 text-left w-full disabled:cursor-default"
                style={{ cursor: onSelect ? "pointer" : "default", background: "transparent", border: "none" }}
              >
                <span className="text-sm font-bold shrink-0 w-7 text-center" style={{ color: i < 3 ? "var(--brand-green)" : "var(--text-muted)" }}>
                  {i + 1}º
                </span>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {item.label}
                  </span>
                  <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {item.detail}
                  </span>
                </div>
                <span
                  className="text-sm font-bold shrink-0"
                  style={{ color: item.pct != null ? "var(--status-critical)" : "var(--text-muted)" }}
                >
                  {item.pctLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
