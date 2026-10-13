"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { InsucessosMotivo } from "./InsucessosMotivo";
import type { InsucessoDetalhe, MotivoInsucesso } from "@/lib/kpisLogistica";

// Motivo de cada insucesso pelo código de ocorrência do Protheus -- pedido
// do Victor 13/10/2026 ("o ponto principal dessa tela é ... motivo da
// volta"), com a opção de ver em barras ordenadas ou em rosca.
//
// Barras: cor pela categoria (logística em vermelho, que é o controlável;
// L06 do CD à parte; o resto neutro). Rosca: 5 cores fixas por posição
// (--viz-1..5, validadas pra daltônico) + cinza pra "Outros" -- nunca uma
// 6ª cor gerada. Texto sempre neutro; a cor fica só na bolinha/barra.
function corCategoria(m: MotivoInsucesso): string {
  if (m.codigo === "L06") return "var(--series-5)";
  if (m.codigo?.startsWith("L")) return "var(--status-critical)";
  if (m.codigo?.startsWith("C")) return "var(--series-7)";
  return "var(--text-muted)";
}

const CORES_ROSCA = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-5)"];

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function pct(n: number, total: number) {
  return `${((n / total) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function rotulo(m: MotivoInsucesso) {
  return `${m.codigo ?? "—"} ${m.descricao}`;
}

function Barras({ motivos, total, onAbrir }: { motivos: MotivoInsucesso[]; total: number; onAbrir: (m: MotivoInsucesso) => void }) {
  const maior = motivos[0]?.total ?? 1;
  return (
    <ul className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-3">
      {motivos.map((m) => {
        const cor = corCategoria(m);
        return (
          <li key={m.codigo ?? "sem"} className="min-w-0">
            <button
              type="button"
              onClick={() => onAbrir(m)}
              className="w-full flex flex-col gap-1 text-sm text-left rounded-md -mx-1.5 px-1.5 py-1 hover:bg-[var(--surface-2)]"
              title="Clique pra ver os pedidos (cliente, CPF e produto)"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0" style={{ color: "var(--text-primary)" }}>
                  <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cor }} />
                  <span className="truncate">
                    <span className="font-bold tabular-nums mr-1.5">{m.codigo ?? "—"}</span>
                    {m.descricao}
                    {m.categoria && <span style={{ color: "var(--text-muted)" }}> · {m.categoria}</span>}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums font-semibold text-right" style={{ color: "var(--text-primary)" }}>
                  {fmt(m.total)}
                  <span className="ml-1.5 font-normal" style={{ color: "var(--text-muted)" }}>
                    {pct(m.total, total)}
                  </span>
                </span>
              </span>
              <span className="h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(2, (m.total / maior) * 100)}%`,
                    background: cor,
                  }}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Rosca({ motivos, total, onAbrir }: { motivos: MotivoInsucesso[]; total: number; onAbrir: (m: MotivoInsucesso | null) => void }) {
  const principais = motivos.slice(0, CORES_ROSCA.length);
  const resto = motivos.slice(CORES_ROSCA.length).reduce((s, m) => s + m.total, 0);
  const fatias = [
    ...principais.map((m, i) => ({
      key: m.codigo ?? "sem",
      nome: rotulo(m),
      valor: m.total,
      cor: CORES_ROSCA[i],
      motivo: m as MotivoInsucesso | null,
    })),
    ...(resto > 0
      ? [
          {
            key: "outros",
            nome: "Outros motivos",
            valor: resto,
            cor: "var(--text-muted)",
            motivo: null,
          },
        ]
      : []),
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 items-center">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius={62} outerRadius={100} paddingAngle={2} isAnimationActive={false}>
            {fatias.map((f) => (
              <Cell key={f.key} fill={f.cor} stroke="var(--surface-1)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [`${fmt(Number(value ?? 0))} (${pct(Number(value ?? 0), total)})`, name]}
            contentStyle={{
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex flex-col gap-2">
        {fatias.map((f) => (
          <li key={f.key}>
            <button
              type="button"
              onClick={() => onAbrir(f.motivo)}
              className="w-full flex items-center justify-between gap-3 text-sm text-left rounded-md -mx-1.5 px-1.5 py-1 hover:bg-[var(--surface-2)]"
              title="Clique pra ver os pedidos (cliente, CPF e produto)"
            >
              <span className="flex items-center gap-2 min-w-0" style={{ color: "var(--text-primary)" }}>
                <span aria-hidden className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: f.cor }} />
                <span className="truncate">{f.nome}</span>
              </span>
              <span className="shrink-0 tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
                {fmt(f.valor)}
                <span className="ml-1.5 font-normal" style={{ color: "var(--text-muted)" }}>
                  {pct(f.valor, total)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MotivosInsucesso({
  motivos,
  insucessos,
  nomes,
}: {
  motivos: MotivoInsucesso[];
  insucessos: InsucessoDetalhe[];
  nomes: Record<string, string>;
}) {
  const [modo, setModo] = useState<"barras" | "rosca">("barras");
  // undefined = fechado; null = "Outros motivos" (os que não têm fatia própria na rosca)
  const [aberto, setAberto] = useState<MotivoInsucesso | null | undefined>(undefined);
  const total = motivos.reduce((s, m) => s + m.total, 0);
  if (total === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhum insucesso no período.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div
        className="inline-flex self-start rounded-lg p-0.5"
        role="group"
        aria-label="Forma de visualizar"
        style={{ background: "var(--surface-2)" }}
      >
        {(["barras", "rosca"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            aria-pressed={modo === m}
            className="text-xs font-semibold px-3 py-1 rounded-md"
            style={{
              background: modo === m ? "var(--surface-1)" : "transparent",
              color: modo === m ? "var(--text-primary)" : "var(--text-secondary)",
              boxShadow: modo === m ? "0 1px 2px rgb(0 0 0 / 0.12)" : undefined,
            }}
          >
            {m === "barras" ? "Barras" : "Rosca"}
          </button>
        ))}
      </div>
      {modo === "barras" ? (
        <Barras motivos={motivos} total={total} onAbrir={setAberto} />
      ) : (
        <Rosca motivos={motivos} total={total} onAbrir={setAberto} />
      )}
      {aberto !== undefined && (
        <InsucessosMotivo
          titulo={aberto ? `Insucessos · ${rotulo(aberto)}` : "Insucessos · outros motivos"}
          itens={
            aberto
              ? insucessos.filter((i) => i.codigo === aberto.codigo)
              : insucessos.filter((i) => !motivos.slice(0, CORES_ROSCA.length).some((m) => m.codigo === i.codigo))
          }
          nomes={nomes}
          onFechar={() => setAberto(undefined)}
        />
      )}
    </div>
  );
}
