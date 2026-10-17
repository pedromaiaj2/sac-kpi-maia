"use client";

import type { CausasVolta } from "@/lib/kpisLogistica";

// Detalhamento das causas do Índice de Volta -- pedido do Victor
// 09/10/2026 ("detalhamento das causas da volta" na tela de KPIs de
// logística). A soma das 5 barras é exatamente o numerador de
// resumo.indiceVolta (ver resumirLogistica, kpisLogistica.ts) -- nenhum
// número novo, só a mesma conta já feita por motorista, agregada e
// exposta aqui.
//
// Cor: só "Insucesso de logística" vai em --status-critical -- é
// literalmente a definição de "Volta Logística" na tela (insucessos de
// logística), a única causa 100%
// nossa/controlável dessa lista. Insucesso de CD fica de fora dessa conta
// de propósito (ver nota "Volta Logística" na tela -- "exceto L06"), então
// não leva a cor crítica também, mesmo sendo "nosso". O resto (cliente, CD,
// outros, parciais) são causas externas ou
// mistas -- tons neutros da paleta categórica, mesmo critério de
// CausaRaizDonutChart.tsx (causa externa/decisão do cliente = tom neutro,
// só erro interno controlável vira vermelho). Painel escuro 17/10/2026:
// barras horizontais finas (mesmo padrão de Motivos dos insucessos), com o
// número e o % escritos ao lado -- a cor nunca é a única pista.
const CAUSAS: { key: keyof CausasVolta; label: string; color: string; hint: string }[] = [
  {
    key: "insucessoLogistica",
    label: "Insucesso — logística",
    color: "var(--status-critical)",
    hint: "Nota que voltou por falha do transporte/motorista -- a única causa 100% controlável por nós (conta em Volta Logística).",
  },
  {
    key: "insucessoCliente",
    label: "Insucesso — cliente",
    color: "var(--series-3)",
    hint: "Nota que voltou por recusa, ausência ou indisponibilidade do cliente.",
  },
  {
    key: "insucessoCd",
    label: "Insucesso — CD",
    color: "var(--series-5)",
    hint: "Falha do CD antes de a nota sair (L06, pedido não carregado etc.) -- fica fora de Volta Logística de propósito.",
  },
  { key: "parciais", label: "Parcial", color: "var(--series-7)", hint: "Nota em que só parte dos produtos ficou com o cliente." },
  {
    key: "insucessoOutros",
    label: "Insucesso — outros",
    color: "var(--text-muted)",
    hint: "Nota que voltou por outro motivo, sem categoria própria.",
  },
];

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

type Linha = { key: string; label: string; value: number; color: string; hint: string };

export function CausasVoltaChart({ causas }: { causas: CausasVolta }) {
  const total = Object.values(causas).reduce((s, v) => s + v, 0);
  const data: Linha[] = CAUSAS.map((c) => ({ key: c.key, label: c.label, value: causas[c.key], color: c.color, hint: c.hint })).sort(
    (a, b) => b.value - a.value
  );
  const maior = data[0]?.value || 1;

  if (total === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhuma volta registrada no período.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {data.map((d) => (
        <li key={d.key} className="flex flex-col gap-1.5" title={d.hint}>
          <span className="flex items-baseline justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 min-w-0" style={{ color: "var(--text-primary)" }}>
              <span aria-hidden className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="truncate">{d.label}</span>
            </span>
            <span className="shrink-0 tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
              {fmt(d.value)}
              <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                {((d.value / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
              </span>
            </span>
          </span>
          <span className="h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
            <span className="block h-full rounded-full" style={{ width: `${d.value > 0 ? Math.max(2, (d.value / maior) * 100) : 0}%`, background: d.color }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
