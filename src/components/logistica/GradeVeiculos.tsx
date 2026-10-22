"use client";

import { useState } from "react";
import { ThHint } from "./ThHint";
import { ModalLogistica } from "./ModalLogistica";
import { num, pct } from "@/lib/logisticaFormat";
import type { CelulaVeiculo, ColunaVeiculo, LinhaVeiculo } from "@/lib/kpisLogistica";

const th = "px-3 pb-3 text-xs font-medium whitespace-nowrap";
const thStyle = { color: "var(--text-muted)" };

const ROTULO_VINCULO: Record<string, string> = { "Próprio": "Próprios", Terceirizado: "Terceirizados" };
const COR_VINCULO: Record<string, string> = { "Próprio": "var(--brand-green)", Terceirizado: "var(--series-5)" };

type Coluna = ColunaVeiculo | "total";
// rótulo da coluna e como chamar o veículo na média por dia
const COLUNAS: { key: Coluna; rotulo: string; veiculo: string }[] = [
  { key: "Carro", rotulo: "Strada", veiculo: "Stradas" },
  { key: "Caminhão", rotulo: "Caminhão", veiculo: "caminhões" },
  { key: "Não identificado", rotulo: "Não identificado", veiculo: "sem placa" },
  { key: "total", rotulo: "Todos os veículos", veiculo: "veículos" },
];

const decimal = (n: number, d: number) => (d > 0 ? (n / d).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—");

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface-2)" }}>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {rotulo}
      </p>
      <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
        {valor}
      </p>
    </div>
  );
}

// Grade vínculo x veículo -- pedido do Victor 13/10/2026: separar os
// motoristas nossos dos terceirizados e mostrar o volume das Stradas e dos
// caminhões. Victor 14/10/2026: na célula só as notas e o %; o resto
// (cargas, produtos, médias por carga e por dia) abre num modal ao clicar.
export function GradeVeiculos({ linhas, dias }: { linhas: LinhaVeiculo[]; dias: number }) {
  const [aberta, setAberta] = useState<{ vinculo: string; coluna: (typeof COLUNAS)[number]; c: CelulaVeiculo } | null>(null);
  const total = linhas[linhas.length - 1].total.pedidos;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              <th className={`${th} text-left`} style={thStyle}>
                <ThHint hint="Próprios = motoristas da nossa frota (TRANSP. LOJAS MAIA, EXPRESSA). Terceirizados = motoristas de transportadora de fora (Ronaldo, THZ, D&A, Alenilson, Santos...). Vale o vínculo do motorista (a transportadora pela qual ele mais rodou nos últimos 180 dias), não a transportadora lançada em cada carga.">
                  Motoristas
                </ThHint>
              </th>
              <th className={`${th} text-right`} style={thStyle}>
                <ThHint hint="Fiat Strada: as placas fixas do Eduardo, Joalison e Joanderson (e a TPA9E78, compartilhada).">Strada (carro)</ThHint>
              </th>
              <th className={`${th} text-right`} style={thStyle}>
                <ThHint hint="Placa que não é de Strada, e carga de terceirizado (terceirizado não tem Strada). Carga própria sem placa fica em Não identificado." lado="direita">
                  Caminhão
                </ThHint>
              </th>
              <th className={`${th} text-right`} style={thStyle}>
                <ThHint
                  hint="Carga da frota própria lançada sem placa no Protheus (veículo 'AIAM', 'FRETIST'...): não dá pra saber se foi Strada ou caminhão, então fica à parte em vez de distorcer a média dos caminhões. Some quando o Protheus trouxer a placa."
                  lado="direita"
                >
                  Não identificado
                </ThHint>
              </th>
              <th className={`${th} text-right`} style={thStyle}>
                <ThHint hint="Notas que saíram nas cargas e a fatia do total. Clique no número pra ver cargas, produtos e as médias." lado="direita">
                  Total
                </ThHint>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const ehTotal = l.vinculo === "Total";
              const cor = COR_VINCULO[l.vinculo] ?? "var(--text-muted)";
              return (
                <tr key={l.vinculo} className={ehTotal ? "" : "border-b"} style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-4 align-middle">
                    <span className="flex items-center gap-2 font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                      {!ehTotal && <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: cor }} />}
                      {ROTULO_VINCULO[l.vinculo] ?? l.vinculo}
                    </span>
                  </td>
                  {COLUNAS.map((col) => {
                    const c = l[col.key];
                    const destaque = col.key === "total";
                    return (
                      <td key={col.key} className="px-3 py-4 text-right align-middle">
                        <button
                          type="button"
                          onClick={() => setAberta({ vinculo: l.vinculo, coluna: col, c })}
                          className="inline-flex items-baseline gap-1 rounded-lg px-2 py-1 tabular-nums transition-colors hover:bg-[var(--surface-2)]"
                          style={{ color: "var(--text-primary)" }}
                          title="Ver cargas, produtos e médias"
                        >
                          <span className={destaque || ehTotal ? "text-xl font-bold" : "text-lg font-semibold"}>{num(c.pedidos)}</span>
                          <span className="text-[11px] font-normal" style={{ color: "var(--text-secondary)" }}>
                            notas
                          </span>
                          {total > 0 && (
                            <span className="ml-1 text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>
                              {pct(c.pedidos / total)}
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {aberta && (
        <ModalLogistica
          titulo={`${aberta.vinculo === "Total" ? "Todos os motoristas" : (ROTULO_VINCULO[aberta.vinculo] ?? aberta.vinculo)} · ${aberta.coluna.rotulo}`}
          subtitulo={`${num(aberta.c.pedidos)} notas${total > 0 ? ` · ${pct(aberta.c.pedidos / total)} das notas do período` : ""}`}
          onFechar={() => setAberta(null)}
        >
          <div className="p-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Dado rotulo="Cargas" valor={num(aberta.c.cargas)} />
              <Dado rotulo="Notas" valor={num(aberta.c.pedidos)} />
              <Dado rotulo="Produtos" valor={num(aberta.c.produtos)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Dado rotulo="Notas por carga" valor={decimal(aberta.c.pedidos, aberta.c.cargas)} />
              <Dado rotulo="Produtos por carga" valor={decimal(aberta.c.produtos, aberta.c.cargas)} />
              <Dado rotulo={`${aberta.coluna.veiculo} na rua por dia`} valor={decimal(aberta.c.veiculos, dias)} />
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Pela data da carga (ZAG_DTPREV). Por dia = média nos dias com carga no período; veículo = placa distinta (sem placa, pelo motorista -- estimativa).
            </p>
          </div>
        </ModalLogistica>
      )}
    </>
  );
}
