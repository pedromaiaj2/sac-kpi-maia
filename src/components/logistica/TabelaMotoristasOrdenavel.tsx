"use client";

import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, X } from "lucide-react";
import { StatusPill } from "@/components/KpiCardShell";
import { ThHint } from "./ThHint";
import { pct, VISITAS_MINIMAS, toneIndiceVolta } from "@/lib/logisticaFormat";
import type { MotoristaEntregas } from "@/lib/kpisLogistica";

// Versão "order book" da tabela de Índice de Volta -- pedido do Victor
// 09/10/2026 (evolução do PR #584, estilo home broker): "ordenar
// instantaneamente por qualquer coluna". Client Component só por causa
// disso (estado de ordenação) -- o resto (dado, regras de negócio) é
// idêntico ao TabelaMotoristas anterior, só virou clicável.
type SortKey =
  | "nome"
  | "vinculo"
  | "cargas"
  | "visitas"
  | "entregas"
  | "produtosPorCarga"
  | "insucessos"
  | "parciais"
  | "devolucoes"
  | "indiceVolta"
  | "indiceVoltaLogistica";

const COLUNAS: { key: SortKey; label: string; hint: string; alinhar?: "left" }[] = [
  {
    key: "vinculo",
    label: "Vínculo",
    hint: "Próprio ou terceirizado pela maioria das cargas do motorista. Nos totais, cada carga conta pela transportadora dela: terceirizado dirigindo caminhão nosso (carga lançada como TRANSP. LOJAS MAIA) entra nos próprios.",
    alinhar: "left",
  },
  { key: "cargas", label: "Cargas", hint: "Cargas despachadas com o motorista, pela data da carga (previsão do CD)." },
  {
    key: "visitas",
    label: "Visitas",
    hint: "Cada vez que um pedido saiu numa carga dele e voltou com resultado (entregue, parcial ou não entregue). Pedido que sai duas vezes conta duas visitas. É a base dos índices de volta.",
  },
  {
    key: "entregas",
    label: "Entregas",
    hint: "Visitas com o produto entregue, completa ou parcial. Passe o mouse no número pra ver quantas foram de Strada e de caminhão.",
  },
  { key: "produtosPorCarga", label: "Produtos/carga", hint: "Média de produtos (unidades) por carga do motorista no período." },
  {
    key: "insucessos",
    label: "Insucessos",
    hint: "Visitas em que o pedido voltou sem entregar. Passe o mouse no número pra ver por motivo: cliente (ausente, recusa, endereço), logística (rota estourada, veículo quebrado), CD (L06, pedido não carregado) e outros.",
  },
  { key: "parciais", label: "Parciais", hint: "Visitas em que só parte do pedido foi entregue." },
  {
    key: "devolucoes",
    label: "≈ Devoluções",
    hint: "Notas de devolução no Protheus até 30 dias depois de uma entrega ao mesmo CPF, ligadas ao motorista dessa entrega. Estimado, por isso o ≈.",
  },
  {
    key: "indiceVolta",
    label: "Volta total",
    hint: "De cada 100 visitas, quantas voltaram com problema: (insucessos + parciais + devoluções) ÷ visitas. Mede o retrabalho, não a culpa do motorista (cliente ausente entra aqui). Verde até 5%, amarelo até 10%, vermelho acima.",
  },
  {
    key: "indiceVoltaLogistica",
    label: "Volta logística",
    hint: "Só a parte que é falha do transporte: insucessos com motivo de logística (L01 rota estourada, L02 veículo quebrado...) ÷ visitas. L06 (pedido não carregado) é do CD e fica fora.",
  },
]

function valorOrdenavel(m: MotoristaEntregas, key: SortKey, produtos: Record<string, number>): number | string {
  switch (key) {
    case "nome":
      return m.nome ?? m.codigo;
    case "vinculo":
      return m.vinculo ?? "";
    case "cargas":
      return m.cargas;
    case "visitas":
      return m.visitas;
    case "entregas":
      return m.entregasRealizadas;
    case "produtosPorCarga":
      return m.cargas > 0 ? (produtos[m.codigo] ?? 0) / m.cargas : -1;
    case "insucessos":
      return m.insucessos.total;
    case "parciais":
      return m.parciais;
    case "devolucoes":
      return m.devolucoes;
    case "indiceVolta":
      return m.indiceVolta ?? -1;
    case "indiceVoltaLogistica":
      return m.indiceVoltaLogistica ?? -1;
  }
}

const th = "px-2 py-1.5 font-semibold whitespace-nowrap";
const thStyle = { color: "var(--text-secondary)" };

export function VinculoTag({ vinculo, transportadora }: { vinculo: string | null; transportadora?: string | null }) {
  if (!vinculo) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const cor = vinculo === "Próprio" ? "var(--brand-green)" : "var(--series-5)";
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: cor, background: `color-mix(in srgb, ${cor} 14%, var(--surface-1))` }}
      title={transportadora ?? undefined}
    >
      {vinculo}
    </span>
  );
}

export function TabelaMotoristasOrdenavel({
  motoristas,
  produtos,
  filtroCodigo,
  onLimparFiltro,
}: {
  motoristas: MotoristaEntregas[];
  // Produtos (unidades) nas cargas de cada motorista -- ver produtosPorMotorista.
  produtos: Record<string, number>;
  // Código do motorista selecionado no Monitor de Cargas (coluna 1) --
  // filtra pra só essa linha, com um aviso pra limpar (ver
  // LogisticaTerminal.tsx, dono do estado de seleção).
  filtroCodigo: string | null;
  onLimparFiltro: () => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "indiceVolta", dir: "desc" });

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }

  const linhas = useMemo(() => {
    const base = filtroCodigo ? motoristas.filter((m) => m.codigo === filtroCodigo) : motoristas;
    const sorted = [...base].sort((a, b) => {
      const va = valorOrdenavel(a, sort.key, produtos);
      const vb = valorOrdenavel(b, sort.key, produtos);
      const cmp = typeof va === "string" || typeof vb === "string" ? String(va).localeCompare(String(vb), "pt-BR") : (va as number) - (vb as number);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [motoristas, produtos, filtroCodigo, sort]);

  if (motoristas.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhuma visita registrada no período.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {filtroCodigo ? (
        <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-1.5 self-start" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
          Filtrado pela carga selecionada no monitor
          <button type="button" onClick={onLimparFiltro} className="flex items-center gap-0.5 font-semibold underline" style={{ color: "var(--text-primary)" }}>
            <X aria-hidden size={12} />
            limpar
          </button>
        </div>
      ) : null}
      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <th className={`${th} text-left`} style={thStyle}>
                <button type="button" onClick={() => toggleSort("nome")} className="inline-flex items-center gap-1">
                  Motorista
                  {sort.key === "nome" ? sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowUpDown size={12} style={{ color: "var(--text-muted)" }} />}
                </button>
              </th>
              {COLUNAS.map((c, i) => (
                <th key={c.key} className={`${th} ${c.alinhar === "left" ? "text-left" : "text-right"}`} style={thStyle}>
                  <ThHint hint={c.hint} lado={i >= COLUNAS.length / 2 ? "direita" : "esquerda"}>
                    <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1">
                      {c.label}
                      {sort.key === c.key ? (
                        sort.dir === "asc" ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={12} style={{ color: "var(--text-muted)" }} />
                      )}
                    </button>
                  </ThHint>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((m) => {
              const poucas = m.visitas < VISITAS_MINIMAS;
              return (
                <tr key={m.codigo} className="border-b" style={{ borderColor: "var(--border)", opacity: poucas ? 0.55 : 1 }}>
                  <td className="px-2 py-1.5">
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      {m.nome ?? "Sem nome"}
                    </span>
                    <span className="ml-2 tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {m.codigo}
                      {poucas ? " · poucas visitas" : ""}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <VinculoTag vinculo={m.vinculo} transportadora={m.transportadora} />
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{m.cargas}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{m.visitas}</td>
                  <td
                    className="px-2 py-1.5 text-right tabular-nums font-semibold"
                    title={`Strada ${m.entregasPorVeiculo.Carro} · caminhão ${m.entregasPorVeiculo["Caminhão"]}`}
                  >
                    {m.entregasRealizadas}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                    {m.cargas > 0 ? ((produtos[m.codigo] ?? 0) / m.cargas).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
                  </td>
                  <td
                    className="px-2 py-1.5 text-right tabular-nums font-semibold"
                    title={`Cliente ${m.insucessos.cliente} · logística ${m.insucessos.logistica} · CD ${m.insucessos.cd} · outros ${m.insucessos.outros}`}
                  >
                    {m.insucessos.total}
                    {m.insucessos.cd > 0 && (
                      <span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>
                        ({m.insucessos.cd} CD)
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{m.parciais}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{m.devolucoes}</td>
                  <td className="px-2 py-1.5 text-right">
                    <StatusPill label={pct(m.indiceVolta)} tone={toneIndiceVolta(m.indiceVolta)} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <StatusPill label={pct(m.indiceVoltaLogistica)} tone={toneIndiceVolta(m.indiceVoltaLogistica)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
