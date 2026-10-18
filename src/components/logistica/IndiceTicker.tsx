import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Variacao } from "@/lib/kpisLogistica";
import { ThHint } from "./ThHint";

// "Ticker" compacto estilo home broker -- pedido do Victor 09/10/2026
// (evolução do redesenho anterior, PR #584): fileira de mini-cards com
// valor atual + variação vs. período anterior (mesma duração, ver
// periodoAnterior em kpisLogistica.ts). Puramente apresentação -- os
// números em si (Variacao) já vêm prontos calculados em calcularVariacao,
// nenhum dado novo inventado aqui.
//
// Cor por JULGAMENTO (bom/ruim), não por sinal da seta -- índice de volta
// caindo é bom (verde), mesmo a seta apontando pra baixo. Pra contagem
// bruta (cargas, pedidos, volume) não existe "melhor/pior" (mais carga
// despachada não é bom nem ruim por si só), então fica sempre neutro,
// só a seta indicando direção. `melhorou` já vem `null` nesses casos
// (ver calcularVariacao).
function Seta({ delta }: { delta: number | null }) {
  if (delta === null || Math.abs(delta) < 1e-9) return <Minus aria-hidden size={13} />;
  return delta > 0 ? <TrendingUp aria-hidden size={13} /> : <TrendingDown aria-hidden size={13} />;
}

function corVariacao(melhorou: boolean | null): string {
  if (melhorou === null) return "var(--text-muted)";
  return melhorou ? "var(--status-good)" : "var(--status-critical)";
}

type TickerItem = {
  key: string;
  label: string;
  hint: string;
  valor: string;
  // valor clicável (Client Component) no lugar do texto
  valorNode?: React.ReactNode;
  // ocupa 2 colunas sem o destaque
  largo?: boolean;
  // segunda linha de valor, menor (ex.: "167 produtos" sob "70,7 notas")
  complemento?: string;
  // card principal: ocupa 2 colunas e valor maior
  destaque?: boolean;
  variacao: Variacao;
  // texto no lugar da variação quando ela não se aplica (ex.: "dia em
  // andamento" no período Hoje)
  semComparacao?: string;
  // Formata só o delta (sem o valor absoluto) -- cada métrica tem unidade
  // diferente (pp pros índices, inteiro pras contagens).
  formatarDelta: (delta: number) => string;
};

export function IndiceTicker({ items, labelComparacao }: { items: TickerItem[]; labelComparacao: string }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((item, i) => {
        const cor = corVariacao(item.variacao.melhorou);
        return (
          <div
            key={item.key}
            className={`rounded-2xl p-4 flex flex-col gap-1.5 min-w-0 shadow-lg shadow-black/20 ${item.destaque || item.largo ? "lg:col-span-2" : ""}`}
            style={{ background: "var(--surface-1)" }}
          >
            {/* na grade de 6 (1º e último cards ocupando 2), os índices 3, 4, 8 e
                9 ficam encostados na direita: a caixa do "i" abre pra esquerda */}
            <ThHint hint={item.hint} lado={[3, 4, 8, 9].includes(i) ? "direita" : "esquerda"}>
              <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                {item.label}
              </span>
            </ThHint>
            <span className={`${item.destaque ? "text-3xl" : "text-2xl"} font-bold tracking-tight leading-tight tabular-nums`} style={{ color: "var(--text-primary)" }}>
              {item.valorNode ?? item.valor}
            </span>
            {item.complemento && (
              <span className="text-xs tabular-nums leading-tight" style={{ color: "var(--text-secondary)" }}>
                {item.complemento}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] tabular-nums" style={{ color: cor }}>
              {item.variacao.delta === null ? (
                <span style={{ color: "var(--text-muted)" }}>{item.semComparacao ?? `sem ${labelComparacao}`}</span>
              ) : (
                <>
                  <Seta delta={item.variacao.delta} />
                  {item.formatarDelta(item.variacao.delta)}
                  <span style={{ color: "var(--text-muted)" }}>vs. {labelComparacao}</span>
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export type { TickerItem };
