"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProductDefectRateStat } from "@/lib/kpiAssistencia";

// "Produtos com mais defeito de fabricação" com filtro Nossa fábrica x
// Outros fornecedores -- pedido do Victor 13/10/2026: "comparar o número
// de defeitos dos produtos da nossa fábrica e dos produtos de outros
// fornecedores, baseado... no número de venda de cada produto". Mesmo
// espírito/visual de ProductBreakageRanking.tsx (barra = Taxa de Quebra,
// não volume cru), só que: (1) já vem filtrado pra causa_raiz =
// 'defeito_fabricacao' do servidor (ver byProductDefeitoFabricacaoTaxa,
// kpiAssistencia.ts), e (2) o filtro por fabricanteGrupo é só aqui no
// cliente (os 3 grupos vêm juntos, sem corte de top 20 -- ver comentário
// no servidor) -- troca de pill não precisa de round-trip nenhum.
const PRODUCT_RANKING_LIMIT = 20;
const MAX_TICK_LABEL_LENGTH = 24;

function truncateTick(label: string): string {
  return label.length > MAX_TICK_LABEL_LENGTH ? `${label.slice(0, MAX_TICK_LABEL_LENGTH - 1)}…` : label;
}

type Filtro = "todos" | "interna" | "externa";

const FILTRO_LABELS: Record<Filtro, string> = {
  todos: "Todos",
  interna: "Nossa fábrica",
  externa: "Outros fornecedores",
};

const FABRICANTE_GRUPO_LABELS: Record<ProductDefectRateStat["fabricanteGrupo"], string> = {
  interna: "Nossa fábrica (AIAM)",
  externa: "Outro fornecedor",
  indefinido: "Fabricante não identificado",
};

type ChartRow = ProductDefectRateStat & { barValue: number };

function DefectTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const isNaoIdentificado = d.partCode === "9999";
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs flex flex-col gap-1 max-w-[240px]"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)", color: "var(--text-primary)" }}
    >
      <span className="font-semibold">{d.label}</span>
      <span>{FABRICANTE_GRUPO_LABELS[d.fabricanteGrupo]}</span>
      <span>Chamados por defeito: {d.count}</span>
      <span>Unidades trocadas/enviadas: {d.itensQuantidade}</span>
      {!isNaoIdentificado ? <span>Vendas no período: {d.vendaQtd}</span> : null}
      <span>Taxa de defeito: {d.taxaQuebraPct != null ? `${d.taxaQuebraPct.toFixed(1)}%` : "N/A"}</span>
    </div>
  );
}

export function ProductDefectRateRanking({
  data,
  onSelect,
}: {
  data: ProductDefectRateStat[];
  onSelect?: (item: ProductDefectRateStat) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const counts: Record<Filtro, number> = {
    todos: data.length,
    interna: data.filter((d) => d.fabricanteGrupo === "interna").length,
    externa: data.filter((d) => d.fabricanteGrupo === "externa").length,
  };

  const filtered = filtro === "todos" ? data : data.filter((d) => d.fabricanteGrupo === filtro);
  const chartData: ChartRow[] = filtered.slice(0, PRODUCT_RANKING_LIMIT).map((d) => ({ ...d, barValue: d.taxaQuebraPct ?? 0 }));
  const height = Math.max(160, chartData.length * 36 + 24);

  return (
    <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        Produtos com mais defeito de fabricação (top {Math.min(PRODUCT_RANKING_LIMIT, chartData.length)})
      </h3>
      <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
        Chamados de defeito de fabricação ÷ vendas do mesmo produto no período. &quot;Nossa fábrica&quot; = fabricante AIAM
        (Beds/Aiam); produto sem fabricante identificado no TOTVS fica de fora dos dois filtros.
      </p>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {(Object.keys(FILTRO_LABELS) as Filtro[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFiltro(key)}
            className="text-xs px-2.5 py-1 rounded-full border transition-colors"
            style={
              filtro === key
                ? { background: "var(--brand-green)", borderColor: "var(--brand-green)", color: "#fff" }
                : { background: "transparent", borderColor: "var(--border)", color: "var(--text-secondary)" }
            }
          >
            {FILTRO_LABELS[key]} ({counts[key]})
          </button>
        ))}
      </div>
      {chartData.length > 0 ? (
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Passe o mouse numa barra pra ver o detalhe. Clique pra ver os chamados.
        </p>
      ) : null}
      {chartData.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem dados suficientes nesse filtro.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--gridline)" />
            <XAxis type="number" allowDecimals={false} unit="%" stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="label"
              width={140}
              tickFormatter={truncateTick}
              stroke="var(--axis)"
              tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            />
            <Tooltip content={<DefectTooltip />} cursor={{ fill: "var(--gridline)" }} />
            <Bar
              dataKey="barValue"
              fill="var(--status-critical)"
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
              cursor={onSelect ? "pointer" : undefined}
              onClick={onSelect ? (bar: { payload?: ChartRow }) => bar.payload && onSelect(bar.payload) : undefined}
            >
              <LabelList
                dataKey="taxaQuebraPct"
                position="insideRight"
                formatter={(label: unknown) => {
                  const value = label == null ? NaN : Number(label);
                  return Number.isFinite(value) ? `${value.toFixed(0)}%` : "N/A";
                }}
                style={{ fill: "#fff", fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
