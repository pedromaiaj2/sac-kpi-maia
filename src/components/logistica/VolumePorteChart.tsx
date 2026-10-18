"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ProdutosPorte } from "./ProdutosPorte";
import { gruposPorPorte } from "@/lib/produtoGrupo";
import type { KpisEntregas, ProdutoPorte, VolumeDia } from "@/lib/kpisLogistica";

const SERIES = [
  { key: "P", porte: "P", label: "P (pequeno)", color: "var(--porte-p)" },
  { key: "M", porte: "M", label: "M (médio)", color: "var(--porte-m)" },
  { key: "G", porte: "G", label: "G (grande)", color: "var(--porte-g)" },
  { key: "naoClassificado", porte: "N", label: "Sem classe", color: "var(--axis)" },
] as const;

function formatDia(dia: unknown) {
  if (typeof dia !== "string") return "";
  const [, mes, d] = dia.split("-");
  return `${d}/${mes}`;
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function TooltipVolume({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) {
  const d = payload?.[0]?.payload as VolumeDia | undefined;
  if (!active || !d) return null;
  const total = d.P + d.M + d.G + d.naoClassificado;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-sm"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
    >
      <p className="font-semibold mb-1">
        {formatDia(d.dia)} · {d.cargas} carga{d.cargas === 1 ? "" : "s"}
      </p>
      <p className="mb-1 tabular-nums" style={{ color: "var(--text-secondary)" }}>
        Na rua: {d.caminhoes} caminh{d.caminhoes === 1 ? "ão" : "ões"} · {d.stradas} Strada{d.stradas === 1 ? "" : "s"}
        {d.naoIdentificados > 0 ? ` · ${d.naoIdentificados} sem placa` : ""}
      </p>
      {[...SERIES].reverse().map((s) => (
        <p key={s.key} className="flex items-center gap-2 tabular-nums">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
          <span style={{ color: "var(--text-secondary)" }}>{s.label}</span>
          <span className="ml-auto font-medium">{fmt(d[s.key])}</span>
        </p>
      ))}
      <p className="mt-1 pt-1 flex justify-between font-semibold tabular-nums" style={{ borderTop: "1px solid var(--border)" }}>
        <span>Total</span>
        <span>{fmt(total)} un.</span>
      </p>
    </div>
  );
}

// Legenda clicável (pedido do Victor 13/10/2026): cada classe abre a lista
// dos produtos dela nas cargas do período (ProdutosPorte).
export function VolumePorteChart({
  data,
  produtos,
  regras,
}: {
  data: VolumeDia[];
  produtos: ProdutoPorte[];
  regras: KpisEntregas["regrasPorte"];
}) {
  const [aberto, setAberto] = useState<ProdutoPorte["porte"] | null>(null);
  const unidades = (key: (typeof SERIES)[number]["key"]) => data.reduce((t, d) => t + d[key], 0);
  const porGrupo = gruposPorPorte(produtos);
  return (
    <div className="pb-4">
      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setAberto(s.porte)}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 hover:bg-[var(--surface-2)]"
            style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
            title={`Ver os ${produtos.filter((p) => p.porte === s.porte).length} produtos diferentes ${s.label}`}
          >
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }} />
            {s.label}
            <span className="font-bold tabular-nums">· {fmt(unidades(s.key))} produtos</span>
          </button>
        ))}
      </div>
      {aberto && (
        <ProdutosPorte porte={aberto} produtos={produtos.filter((p) => p.porte === aberto)} regras={regras} onFechar={() => setAberto(null)} />
      )}
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhuma carga despachada no período.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 12 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--gridline)" />
            <XAxis dataKey="dia" tickFormatter={formatDia} stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <YAxis allowDecimals={false} stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={44} />
            <Tooltip content={(p) => <TooltipVolume active={p.active} payload={p.payload} />} cursor={{ fill: "var(--surface-2)" }} />
            {SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="porte"
                fill={s.color}
                stroke="var(--surface-1)"
                strokeWidth={1}
                radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : undefined}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
      {produtos.length > 0 && (
        // Divisão por grupo de produto dentro de cada porte, sem precisar
        // abrir a lista (pedido do Victor 18/10/2026).
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {SERIES.filter((s) => s.porte !== "N").map((s) => {
            const grupos = porGrupo[s.porte] ?? [];
            const maior = grupos[0]?.unidades ?? 1;
            return (
              <div key={s.porte} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setAberto(s.porte)}
                  className="flex items-center justify-between gap-2 text-left text-sm font-semibold rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-[var(--surface-2)]"
                  style={{ color: "var(--text-primary)" }}
                  title="Ver os produtos"
                >
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="tabular-nums">{fmt(unidades(s.key))}</span>
                </button>
                <ul className="flex flex-col gap-1.5">
                  {grupos.map((g) => (
                    <li key={g.chave} className="flex flex-col gap-0.5 text-xs">
                      <span className="flex justify-between gap-2" style={{ color: "var(--text-secondary)" }}>
                        <span className="truncate">{g.label}</span>
                        <span className="tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
                          {fmt(g.unidades)}
                        </span>
                      </span>
                      <span className="h-1 rounded-full" style={{ background: "var(--surface-2)" }}>
                        <span className="block h-full rounded-full" style={{ width: `${Math.max(3, (g.unidades / maior) * 100)}%`, background: s.color }} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
