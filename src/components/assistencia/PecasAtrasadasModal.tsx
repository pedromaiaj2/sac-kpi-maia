"use client";

import type { PecaAtrasadaItem } from "@/lib/kpiAssistencia";
import { formatDateTimeBr } from "@/lib/formatDateTime";

// Mesmo padrão visual de AssistenciaTicketsModal.tsx, só que pra peça de
// pedido de fornecedor (PecaAtrasadaItem, kpiAssistencia.ts) em vez de
// chamado (ReportRowItem) -- formato de dado diferente demais pra reusar
// o mesmo componente. Pedido do Victor 12/10/2026: "quando clicar no
// fornecedor aparecem quais peças e há quanto tempo estamos esperando".
export function PecasAtrasadasModal({
  fornecedor,
  items,
  onClose,
}: {
  fornecedor: string;
  items: PecaAtrasadaItem[];
  onClose: () => void;
}) {
  return (
    <>
      <button
        aria-label="Fechar lista de peças"
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.4)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-[10vh] z-50 mx-auto max-w-lg max-h-[75vh] overflow-y-auto rounded-lg border p-4 shadow-lg"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between gap-4 mb-1">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {fornecedor}
          </h3>
          <button aria-label="Fechar" onClick={onClose} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-muted)" }}>
            Fechar
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          {items.length} peça{items.length === 1 ? "" : "s"} atrasada{items.length === 1 ? "" : "s"} (mais de 30 dias esperando), ordenadas da mais antiga pra mais recente.
        </p>
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
          {items.map((p) => (
            <div key={p.id} className="flex flex-col gap-1 py-2.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-xs font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
                    #{p.externalReference ?? p.ticketNumber}
                  </span>
                  <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {p.clientName ?? "Sem cliente"}
                  </span>
                </div>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: "color-mix(in srgb, var(--status-critical) 20%, var(--surface-1))", color: "var(--status-critical)" }}
                >
                  {p.diasEsperando} dias esperando
                </span>
              </div>
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                🔩 {p.partName}
                {p.partCode ? ` (${p.partCode})` : ""}
              </span>
              {p.product ? (
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Produto: {p.product}
                </span>
              ) : null}
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Pedido aberto em {formatDateTimeBr(p.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
