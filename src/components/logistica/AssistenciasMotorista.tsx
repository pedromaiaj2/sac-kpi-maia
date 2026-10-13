"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { REQUEST_TYPE_LABELS, CAUSA_RAIZ_LABELS } from "@/lib/assistenciaLabels";
import type { AssistenciaEntrega } from "@/lib/kpisLogistica";

// Chamados de assistência de um motorista -- abre ao clicar no número da
// coluna "Assistências" (pedido do Victor 13/10/2026: "quando eu clicasse
// no número de assistência daquele motorista, ele abriria os dados de o
// que foi aquela assistência"). Só mostra a lista que a RPC já mandou
// (kpis_entregas.assistencias); nada é buscado de novo.
const ATRIBUICAO: Record<AssistenciaEntrega["atribuicao"], { label: string; hint: string; cor: string }> = {
  carga: { label: "Carga do chamado", hint: "A carga foi informada no próprio chamado.", cor: "var(--status-good)" },
  produto: {
    label: "Cliente + produto",
    hint: "Entrega a esse cliente (CPF ou código no Protheus) em que saiu o produto do chamado.",
    cor: "var(--brand-green)",
  },
  cliente: {
    label: "≈ Só o cliente",
    hint: "O produto não bateu com nenhuma entrega: ligado à entrega mais recente ao cliente. Provável, não certo.",
    cor: "var(--status-warning)",
  },
};

function dataBr(dia: string | null) {
  return dia ? dia.split("-").reverse().join("/") : "—";
}

function tipoLabel(a: AssistenciaEntrega) {
  if (a.origem === "pedido_peca") return "Pedido de peça (fila de peças)";
  return REQUEST_TYPE_LABELS[a.tipo] ?? a.tipo;
}

export function AssistenciasMotorista({
  nome,
  itens,
  onFechar,
}: {
  nome: string;
  itens: AssistenciaEntrega[];
  onFechar: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  const porAtribuicao = (k: AssistenciaEntrega["atribuicao"]) => itens.filter((i) => i.atribuicao === k).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-label={`Assistências de ${nome}`}>
      <button type="button" aria-label="Fechar" className="absolute inset-0 cursor-default" style={{ background: "rgb(0 0 0 / 0.45)" }} onClick={onFechar} />
      <div
        className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl overflow-hidden shadow-xl"
        style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Assistências · {nome}
            </h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {itens.length} chamado{itens.length === 1 ? "" : "s"} no período: {porAtribuicao("carga")} pela carga do chamado,{" "}
              {porAtribuicao("produto")} pelo cliente + produto, {porAtribuicao("cliente")} só pelo cliente (≈).
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="shrink-0 rounded-full p-1" style={{ color: "var(--text-secondary)" }}>
            <X size={18} />
          </button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0" style={{ background: "var(--surface-2)" }}>
              <tr>
                {["Chamado", "Aberto em", "Tipo", "Produto", "Causa", "Entrega", "Ligado por"].map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.map((a) => {
                const at = ATRIBUICAO[a.atribuicao];
                return (
                  <tr key={`${a.origem}-${a.id}`} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
                    <td className="px-2 py-1.5 font-semibold tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                      {a.ticket ? `#${a.ticket}` : "—"}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{dataBr(a.dia)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{tipoLabel(a)}</td>
                    <td className="px-2 py-1.5 min-w-[180px]" style={{ color: "var(--text-primary)" }}>
                      {a.produto ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 min-w-[120px]">{a.causaRaiz ? (CAUSA_RAIZ_LABELS[a.causaRaiz] ?? a.causaRaiz) : "—"}</td>
                    <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                      #{a.carga}
                      <span className="block" style={{ color: "var(--text-muted)" }}>
                        {dataBr(a.diaEntrega)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap" title={at.hint}>
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ color: at.cor, background: `color-mix(in srgb, ${at.cor} 14%, var(--surface-1))` }}
                      >
                        {at.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
