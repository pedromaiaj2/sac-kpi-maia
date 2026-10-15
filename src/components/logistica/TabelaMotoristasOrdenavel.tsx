"use client";

import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, X } from "lucide-react";
import { ThHint } from "./ThHint";
import { pct, VISITAS_MINIMAS, toneIndiceVolta, TONE_COLOR } from "@/lib/logisticaFormat";
import type { MotoristaEntregas } from "@/lib/kpisLogistica";

// Versão "order book" da tabela de Índice de Volta -- pedido do Victor
// 09/10/2026 (evolução do PR #584, estilo home broker): "ordenar
// instantaneamente por qualquer coluna". Client Component só por causa
// disso (estado de ordenação) -- o resto (dado, regras de negócio) é
// idêntico ao TabelaMotoristas anterior, só virou clicável.
type SortKey =
  | "nome"
  | "cargas"
  | "visitas"
  | "produtosPorCarga"
  | "insucessos"
  | "parciais"
  | "assistencias"
  | "assistenciasErroMotorista"
  | "assistenciasAvariaTransporte"
  | "indiceVolta"
  | "indiceVoltaLogistica";

const COLUNAS: { key: SortKey; label: string; hint: string }[] = [
  { key: "cargas", label: "Cargas", hint: "Cargas despachadas com o motorista, pela data da carga (previsão do CD)." },
  {
    key: "visitas",
    label: "Notas",
    hint: "Notas que saíram nas cargas dele e já voltaram com resultado (ficou com o cliente, ficou em parte ou voltou). Nota que sai duas vezes conta duas. É a base dos índices de volta. Passe o mouse no número pra ver quantas foram de Strada e de caminhão.",
  },
  { key: "produtosPorCarga", label: "Prod./carga", hint: "Média de produtos (unidades) por carga do motorista no período." },
  {
    key: "insucessos",
    label: "Insucessos",
    hint: "Notas que voltaram (o cliente não ficou com nada). Passe o mouse no número pra ver por motivo: cliente (ausente, recusa, endereço), logística (rota estourada, veículo quebrado), CD (L06, pedido não carregado) e outros.",
  },
  { key: "parciais", label: "Parciais", hint: "Notas em que só parte dos produtos ficou com o cliente." },
  {
    key: "indiceVolta",
    label: "Volta total",
    hint: "De cada 100 notas, quantas voltaram com problema: (insucessos + parciais) ÷ notas. Mede o retrabalho, não a culpa do motorista (cliente ausente entra aqui). Verde até 5%, amarelo até 10%, vermelho acima.",
  },
  {
    key: "indiceVoltaLogistica",
    label: "Volta logística",
    hint: "Só a parte que é falha do transporte: insucessos com motivo de logística (L01 rota estourada, L02 veículo quebrado...) ÷ notas. L06 (pedido não carregado) é do CD e fica fora.",
  },
  {
    key: "assistencias",
    label: "Assistências",
    hint: "Chamados de assistência técnica abertos no período (troca, peça, recolhimento, envio de produto novo) ligados a uma nota que saiu numa carga deste motorista. Não entram no Índice de Volta. Ligação: carga informada no chamado, ou nota ao mesmo cliente com o produto do chamado; sem o produto, a nota mais recente ao cliente (≈). Clique no número pra ver os chamados.",
  },
  {
    key: "assistenciasErroMotorista",
    label: "Erro motorista",
    hint: "Das Assistências ao lado, quantas têm causa raiz \"Erro do motorista\" -- recorte dentro do mesmo total, não soma a mais. Também não entra no Índice de Volta.",
  },
  {
    key: "assistenciasAvariaTransporte",
    label: "Avaria transporte",
    hint: "Das Assistências ao lado, quantas têm causa raiz \"Avaria no transporte\" (produto avariado no transporte) -- recorte dentro do mesmo total, não soma a mais. Também não entra no Índice de Volta.",
  },
]

function valorOrdenavel(m: MotoristaEntregas, key: SortKey, produtos: Record<string, number>): number | string {
  switch (key) {
    case "nome":
      return m.nome ?? m.codigo;
    case "cargas":
      return m.cargas;
    case "visitas":
      return m.visitas;
    case "produtosPorCarga":
      return m.cargas > 0 ? (produtos[m.codigo] ?? 0) / m.cargas : -1;
    case "insucessos":
      return m.insucessos.total;
    case "parciais":
      return m.parciais;
    case "assistencias":
      return m.assistencias.total;
    case "assistenciasErroMotorista":
      return m.assistencias.porErroMotorista;
    case "assistenciasAvariaTransporte":
      return m.assistencias.porAvariaTransporte;
    case "indiceVolta":
      return m.indiceVolta ?? -1;
    case "indiceVoltaLogistica":
      return m.indiceVoltaLogistica ?? -1;
  }
}

// Cabeçalho fixo (sticky) -- pedido do Victor 13/10/2026: continua visível
// ao rolar a tabela. O fundo precisa estar no próprio <th>.
const th = "sticky top-0 z-10 px-1.5 py-2 font-semibold whitespace-nowrap";
const thStyle = { color: "var(--text-secondary)", background: "var(--surface-2)" };

const ROTULO_TOM: Record<"good" | "warning" | "critical" | "neutral", string> = {
  good: "dentro da meta (até 5%)",
  warning: "atenção (5% a 10%)",
  critical: "crítico (acima de 10%)",
  neutral: "sem notas",
};

// Badge do semáforo da volta: fundo na cor do status, texto sempre neutro,
// bolinha na cor cheia (padrão de badges do painel).
function VoltaBadge({ valor }: { valor: number | null }) {
  const tom = toneIndiceVolta(valor);
  const cor = TONE_COLOR[tom];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums rounded-full px-2.5 py-1"
      style={{
        background: tom === "neutral" ? "var(--surface-2)" : `color-mix(in srgb, ${cor} 22%, var(--surface-1))`,
        color: "var(--text-primary)",
      }}
      title={ROTULO_TOM[tom]}
    >
      {tom !== "neutral" && <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: cor }} />}
      {pct(valor)}
    </span>
  );
}

export function VinculoTag({ vinculo, transportadora }: { vinculo: string | null; transportadora?: string | null }) {
  if (!vinculo) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const cor = vinculo === "Próprio" ? "var(--brand-green)" : "var(--series-5)";
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: "var(--text-primary)", background: "var(--surface-2)" }}
      title={transportadora ?? undefined}
    >
      <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
      {vinculo}
    </span>
  );
}

export function TabelaMotoristasOrdenavel({
  motoristas,
  produtos,
  filtroCodigo,
  onLimparFiltro,
  onAbrirAssistencias,
}: {
  motoristas: MotoristaEntregas[];
  // Produtos (unidades) nas cargas de cada motorista -- ver produtosPorMotorista.
  produtos: Record<string, number>;
  // Código do motorista selecionado no Monitor de Cargas (coluna 1) --
  // filtra pra só essa linha, com um aviso pra limpar (ver
  // LogisticaTerminal.tsx, dono do estado de seleção).
  filtroCodigo: string | null;
  onLimparFiltro: () => void;
  onAbrirAssistencias: (m: MotoristaEntregas) => void;
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
        Nenhuma nota com resultado no período.
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
      <div className="rounded-lg border overflow-auto max-h-[70vh]" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className={`${th} text-left`} style={thStyle}>
                <button type="button" onClick={() => toggleSort("nome")} className="inline-flex items-center gap-1">
                  Motorista
                  {sort.key === "nome" ? sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowUpDown size={12} style={{ color: "var(--text-muted)" }} />}
                </button>
              </th>
              {COLUNAS.map((c, i) => (
                <th key={c.key} className={`${th} text-right`} style={thStyle}>
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
                  <td className="px-1.5 py-1.5 min-w-[150px]" title={poucas ? `Menos de ${VISITAS_MINIMAS} notas no período: índice instável` : undefined}>
                    <span className="block font-semibold" style={{ color: "var(--text-primary)" }}>
                      {m.nome ?? "Sem nome"}
                    </span>
                    <span className="flex items-center gap-1.5 mt-0.5 tabular-nums" style={{ color: "var(--text-muted)" }}>
                      <VinculoTag vinculo={m.vinculo} transportadora={m.transportadora} />
                      {m.codigo}
                    </span>
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold">{m.cargas}</td>
                  <td
                    className="px-1.5 py-1.5 text-right tabular-nums font-semibold"
                    title={`Notas que ficaram com o cliente (todas ou em parte): Strada ${m.entregasPorVeiculo.Carro} · caminhão ${m.entregasPorVeiculo["Caminhão"]} · sem placa ${m.entregasPorVeiculo["Não identificado"] ?? 0}`}
                  >
                    {m.visitas}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold">
                    {m.cargas > 0 ? ((produtos[m.codigo] ?? 0) / m.cargas).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—"}
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
                  <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold">{m.parciais}</td>
                  <td className="px-1.5 py-1.5 text-right">
                    <VoltaBadge valor={m.indiceVolta} />
                  </td>
                  <td className="px-1.5 py-1.5 text-right">
                    <VoltaBadge valor={m.indiceVoltaLogistica} />
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold">
                    {m.assistencias.total > 0 ? (
                      <button
                        type="button"
                        onClick={() => onAbrirAssistencias(m)}
                        className="underline decoration-dotted underline-offset-2 font-bold"
                        style={{ color: "var(--brand-green)" }}
                        title={`${m.assistencias.porCarga} pela carga do chamado · ${m.assistencias.porProduto} pelo cliente + produto · ${m.assistencias.porCliente} só pelo cliente (≈). Clique pra ver.`}
                      >
                        {m.assistencias.total}
                      </button>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>0</span>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold">
                    {m.assistencias.porErroMotorista > 0 ? m.assistencias.porErroMotorista : <span style={{ color: "var(--text-muted)" }}>0</span>}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold">
                    {m.assistencias.porAvariaTransporte > 0 ? m.assistencias.porAvariaTransporte : <span style={{ color: "var(--text-muted)" }}>0</span>}
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
