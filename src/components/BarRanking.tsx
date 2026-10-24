"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, type LabelProps } from "recharts";
import type { Count, Coverage } from "@/lib/kpi";

// Achado 27/08/2026 (KPIs da Assistência, "Chamados por produto"): label
// longo (descrição crua do produto, até ~45 caracteres) estourava a
// largura do eixo Y e ficava sobreposto com a linha de cima/baixo,
// ilegível. Trunca só o texto do eixo (com "…") -- o Tooltip continua
// mostrando o label INTEIRO ao passar o mouse (usa o dado bruto, não o
// tickFormatter), então nenhuma informação se perde, só a barra some de
// visual poluído.
const MAX_TICK_LABEL_LENGTH = 24;

function truncateTick(label: string): string {
  return label.length > MAX_TICK_LABEL_LENGTH ? `${label.slice(0, MAX_TICK_LABEL_LENGTH - 1)}…` : label;
}

export function BarRanking({
  title,
  data,
  coverage,
  onSelect,
  showPercent,
  showCount,
}: {
  title: string;
  data: Count[];
  coverage?: Coverage;
  onSelect?: (item: Count) => void;
  // Percentual de cada barra sobre o total, escrito DENTRO da própria
  // barra -- pedido do Victor 29/08/2026 (voltando atrás da lista abaixo
  // do gráfico de rosca, que ele achou desnecessária): "só precisa
  // colocar esse percentual dentro da barra horizontal de cada causa no
  // grafico de 'chamados por causa raiz'". Opt-in (não muda os outros
  // rankings que usam esse mesmo componente, tipo produto/rota/loja) --
  // só o de causa raiz pediu isso.
  showPercent?: boolean;
  // Mesma ideia, só que o número bruto (não percentual) -- pedido do
  // Victor 08/09/2026 pros rankings de "quem mais errou" (conferente/
  // motorista). Opt-in igual ao de cima, os dois nunca são usados juntos
  // no mesmo gráfico.
  showCount?: boolean;
}) {
  const height = Math.max(160, data.length * 36 + 24);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <div
      className="cartao p-5"
    >
      <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      {coverage ? (
        <>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Cobertura: {coverage.pct}% dos chamados têm essa informação ({coverage.withValue} de {coverage.total})
          </p>
          {/* "Cobertura" acima mede só "tem o campo preenchido", não "aparece
              no gráfico" -- com mais valores distintos do que o corte (ver
              `limit` em topCounts, kpi.ts), ela podia acusar 95%+ sem avisar
              que o gráfico esconde a cauda longa. Achado na auditoria de
              24/10/2026 -- mesmo cenário que o Victor já tinha pego antes no
              painel de Assistência ("136 produtos distintos, só 20 no
              gráfico"). */}
          {coverage.distinctCount !== undefined && coverage.distinctCount > data.length ? (
            <p className="text-xs mb-3" style={{ color: "var(--status-warning)" }}>
              Mostrando as {data.length} maiores de {coverage.distinctCount} diferentes — o restante fica fora do gráfico.
            </p>
          ) : (
            <div className="mb-3" />
          )}
        </>
      ) : (
        <div className="mb-3" />
      )}
      {onSelect && data.length > 0 ? (
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Clique numa barra pra ver os chamados.
        </p>
      ) : null}
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem dados suficientes ainda.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--gridline)" />
            <XAxis type="number" allowDecimals={false} stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="label"
              width={140}
              tickFormatter={truncateTick}
              stroke="var(--axis)"
              tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--gridline)" }}
              contentStyle={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="count"
              fill="var(--series-1)"
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
              cursor={onSelect ? "pointer" : undefined}
              onClick={onSelect ? (bar: { payload?: Count }) => bar.payload && onSelect(bar.payload) : undefined}
            >
              {showPercent ? (
                <LabelList
                  dataKey="count"
                  position="insideRight"
                  formatter={(label: unknown) => {
                    const value = Number(label);
                    return total > 0 && Number.isFinite(value) ? `${((value / total) * 100).toFixed(0)}%` : "";
                  }}
                  style={{ fill: "#fff", fontSize: 11, fontWeight: 600 }}
                />
              ) : null}
              {showCount ? (
                <LabelList
                  dataKey="count"
                  position="insideRight"
                  // Percentual ao lado do número, entre parênteses -- pedido
                  // do Victor 22/10/2026: já existia no texto do eixo/tooltip
                  // (label completo, ver kpiAssistencia.ts), faltava aparecer
                  // dentro da própria barra. `content` (em vez de `formatter`)
                  // porque só ele dá acesso ao índice da linha, pra buscar o
                  // `pct` daquele item específico em `data` -- o `formatter`
                  // do Recharts só recebe o valor cru do dataKey ("count").
                  content={(props: LabelProps) => {
                    const x = Number(props.x ?? 0);
                    const y = Number(props.y ?? 0);
                    const width = Number(props.width ?? 0);
                    const height = Number(props.height ?? 0);
                    const index = (props as { index?: number }).index;
                    const pct = index !== undefined ? data[index]?.pct : undefined;
                    const text = pct !== undefined ? `${props.value} · ${pct.toFixed(pct < 1 ? 2 : 1)}%` : `${props.value}`;
                    return (
                      <text x={x + width - 6} y={y + height / 2} dy={4} textAnchor="end" fill="#fff" fontSize={11} fontWeight={600}>
                        {text}
                      </text>
                    );
                  }}
                />
              ) : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
