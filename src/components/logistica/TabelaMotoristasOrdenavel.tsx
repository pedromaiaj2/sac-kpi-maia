"use client";

import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, X } from "lucide-react";
import { ThHint } from "./ThHint";
import { pct, VISITAS_MINIMAS, toneIndiceVolta, TONE_COLOR } from "@/lib/logisticaFormat";
import type { MotoristaEntregas } from "@/lib/kpisLogistica";

// Tipo de detalhe que cada número da tabela abre -- pedido do Victor
// 16/10/2026: "todos os números fiquem clicáveis... pra ver detalhes de
// cargas, notas... e todas as colunas". Quem decide o que cada tipo abre
// é o LogisticaTerminal (dono dos dados de cargas/insucessos/parciais/
// assistências); esta tabela só avisa qual motorista + qual coluna.
export type TipoDetalheMotorista =
  | "cargas"
  | "insucessos"
  | "parciais"
  | "voltaTotal"
  | "voltaLogistica"
  | "assistencias"
  | "assistenciasErroMotorista"
  | "assistenciasAvariaTransporte";

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
    label: "Notas c/ resultado",
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
    hint: "Chamados de assistência técnica (troca, peça, recolhimento, envio de produto novo) referentes às notas que este motorista entregou no período -- conta pela data da entrega, não pelo dia em que o chamado foi aberto (o número de um período pode crescer depois, quando chegam chamados novos). Não entram no Índice de Volta. Ligação: carga informada no chamado, ou nota ao mesmo cliente com o produto do chamado; sem o produto, a nota mais recente ao cliente (≈). Clique no número pra ver os chamados.",
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
const th = "sticky top-0 z-10 px-1.5 py-2.5 font-medium whitespace-nowrap";
const thStyle = { color: "var(--text-muted)", background: "var(--surface-1)", boxShadow: "inset 0 -1px 0 var(--border)" };

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

// Número clicável padrão da tabela -- sublinhado pontilhado + cor de marca,
// igual ao botão de Assistências que já existia. 0 não é clicável (nada
// pra ver): aparece neutro, sem sublinhado.
function NumBtn({ valor, onClick, title }: { valor: number; onClick: () => void; title?: string }) {
  if (valor <= 0) return <span style={{ color: "var(--text-muted)" }}>{valor}</span>;
  return (
    <button type="button" onClick={onClick} className="underline decoration-dotted underline-offset-2 font-bold" style={{ color: "var(--brand-green)" }} title={title}>
      {valor}
    </button>
  );
}

type FiltroVinculo = "todos" | "Próprio" | "Terceirizado";
const FILTROS_VINCULO: { valor: FiltroVinculo; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "Próprio", rotulo: "Próprios" },
  { valor: "Terceirizado", rotulo: "Terceirizados" },
];

// Índice do grupo de motoristas na tela (mesma conta do card do topo).
function resumoGrupo(ms: MotoristaEntregas[]) {
  const notas = ms.reduce((t, m) => t + m.visitas, 0);
  const voltas = ms.reduce((t, m) => t + m.insucessos.total + m.parciais, 0);
  const logistica = ms.reduce((t, m) => t + m.insucessos.logistica, 0);
  return { notas, indiceVolta: notas > 0 ? voltas / notas : null, indiceVoltaLogistica: notas > 0 ? logistica / notas : null };
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
  onAbrirDetalhe,
}: {
  motoristas: MotoristaEntregas[];
  // Produtos (unidades) nas cargas de cada motorista -- ver produtosPorMotorista.
  produtos: Record<string, number>;
  // Código do motorista selecionado no Monitor de Cargas (coluna 1) --
  // filtra pra só essa linha, com um aviso pra limpar (ver
  // LogisticaTerminal.tsx, dono do estado de seleção).
  filtroCodigo: string | null;
  onLimparFiltro: () => void;
  onAbrirDetalhe: (m: MotoristaEntregas, tipo: TipoDetalheMotorista) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "indiceVolta", dir: "desc" });
  // Próprios x terceirizados só nesta tabela -- pedido do Victor 17/10/2026.
  const [vinculo, setVinculo] = useState<FiltroVinculo>("todos");

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }

  const linhas = useMemo(() => {
    const doVinculo = vinculo === "todos" ? motoristas : motoristas.filter((m) => m.vinculo === vinculo);
    const base = filtroCodigo ? doVinculo.filter((m) => m.codigo === filtroCodigo) : doVinculo;
    const sorted = [...base].sort((a, b) => {
      const va = valorOrdenavel(a, sort.key, produtos);
      const vb = valorOrdenavel(b, sort.key, produtos);
      const cmp = typeof va === "string" || typeof vb === "string" ? String(va).localeCompare(String(vb), "pt-BR") : (va as number) - (vb as number);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [motoristas, produtos, filtroCodigo, sort, vinculo]);
  const grupo = resumoGrupo(linhas);

  if (motoristas.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhuma nota com resultado no período.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="inline-flex rounded-full p-1" role="group" aria-label="Motoristas" style={{ background: "var(--surface-2)" }}>
          {FILTROS_VINCULO.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setVinculo(f.valor)}
              aria-pressed={vinculo === f.valor}
              className="text-xs font-semibold px-3.5 py-1.5 rounded-full"
              style={{
                background: vinculo === f.valor ? "var(--text-primary)" : "transparent",
                color: vinculo === f.valor ? "var(--canvas)" : "var(--text-secondary)",
              }}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
        <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
          {linhas.length} motorista{linhas.length === 1 ? "" : "s"} · {grupo.notas.toLocaleString("pt-BR")} notas com resultado · volta total{" "}
          <b style={{ color: "var(--text-primary)" }}>{pct(grupo.indiceVolta)}</b> · volta logística{" "}
          <b style={{ color: "var(--text-primary)" }}>{pct(grupo.indiceVoltaLogistica)}</b>
        </span>
      </div>
      {filtroCodigo ? (
        <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-1.5 self-start" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
          Filtrado pela carga selecionada no monitor
          <button type="button" onClick={onLimparFiltro} className="flex items-center gap-0.5 font-semibold underline" style={{ color: "var(--text-primary)" }}>
            <X aria-hidden size={12} />
            limpar
          </button>
        </div>
      ) : null}
      <div className="rounded-xl overflow-auto max-h-[70vh]">
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
                  <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold">
                    <NumBtn valor={m.cargas} onClick={() => onAbrirDetalhe(m, "cargas")} title="Clique pra ver as cargas dele no período." />
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold">
                    <NumBtn
                      valor={m.visitas}
                      onClick={() => onAbrirDetalhe(m, "cargas")}
                      title={`Notas que ficaram com o cliente (todas ou em parte): Strada ${m.entregasPorVeiculo.Carro} · caminhão ${m.entregasPorVeiculo["Caminhão"]} · sem placa ${m.entregasPorVeiculo["Não identificado"] ?? 0}. Clique pra ver as cargas dele.`}
                    />
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold">
                    {m.cargas > 0 ? (
                      <button
                        type="button"
                        onClick={() => onAbrirDetalhe(m, "cargas")}
                        className="underline decoration-dotted underline-offset-2 font-bold"
                        style={{ color: "var(--brand-green)" }}
                        title="Clique pra ver as cargas dele (com os volumes de cada uma)."
                      >
                        {((produtos[m.codigo] ?? 0) / m.cargas).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                    <NumBtn
                      valor={m.insucessos.total}
                      onClick={() => onAbrirDetalhe(m, "insucessos")}
                      title={`Cliente ${m.insucessos.cliente} · logística ${m.insucessos.logistica} · CD ${m.insucessos.cd} · outros ${m.insucessos.outros}. Clique pra ver nota a nota.`}
                    />
                    {m.insucessos.cd > 0 && (
                      <span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>
                        ({m.insucessos.cd} CD)
                      </span>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold">
                    <NumBtn valor={m.parciais} onClick={() => onAbrirDetalhe(m, "parciais")} title="Clique pra ver nota a nota." />
                  </td>
                  <td className="px-1.5 py-1.5 text-right">
                    <button type="button" className="inline-flex" onClick={() => onAbrirDetalhe(m, "voltaTotal")} title="Insucessos + parciais. Clique pra ver nota a nota.">
                      <VoltaBadge valor={m.indiceVolta} />
                    </button>
                  </td>
                  <td className="px-1.5 py-1.5 text-right">
                    <button
                      type="button"
                      className="inline-flex"
                      onClick={() => onAbrirDetalhe(m, "voltaLogistica")}
                      title="Só insucessos de categoria logística (exceto L06, do CD). Clique pra ver nota a nota."
                    >
                      <VoltaBadge valor={m.indiceVoltaLogistica} />
                    </button>
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold">
                    <NumBtn
                      valor={m.assistencias.total}
                      onClick={() => onAbrirDetalhe(m, "assistencias")}
                      title={`${m.assistencias.porCarga} pela carga do chamado · ${m.assistencias.porProduto} pelo cliente + produto · ${m.assistencias.porCliente} só pelo cliente (≈). Clique pra ver.`}
                    />
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold">
                    <NumBtn valor={m.assistencias.porErroMotorista} onClick={() => onAbrirDetalhe(m, "assistenciasErroMotorista")} />
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold">
                    <NumBtn valor={m.assistencias.porAvariaTransporte} onClick={() => onAbrirDetalhe(m, "assistenciasAvariaTransporte")} />
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
