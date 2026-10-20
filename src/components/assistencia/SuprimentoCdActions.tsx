"use client";

import { useState } from "react";
import {
  aprovarSuprimentoAction,
  rejeitarSuprimentoAction,
  marcarCompradoSuprimentoAction,
  marcarEnviadoSuprimentoAction,
} from "@/app/assistencia/suprimentos-actions";
import { useQuickAction } from "./useQuickAction";

const NEXT_STEP: Record<string, { action: (id: string) => Promise<void>; label: string } | undefined> = {
  aprovado: { action: marcarCompradoSuprimentoAction, label: "Marcar como comprado" },
  comprado: { action: marcarEnviadoSuprimentoAction, label: "Marcar como enviado pra loja" },
};

export function SuprimentoCdActions({ pedidoId, status }: { pedidoId: string; status: string }) {
  const { pending, run } = useQuickAction();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  if (status === "solicitado") {
    if (showReject) {
      return (
        <div className="flex flex-col gap-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Motivo da recusa…"
            className="rounded border px-3 py-2 text-sm"
            style={{ borderColor: "var(--status-critical)" }}
          />
          <div className="flex items-center gap-2">
            <button
              disabled={pending || !reason.trim()}
              onClick={() =>
                run(async () => {
                  await rejeitarSuprimentoAction(pedidoId, reason);
                  setShowReject(false);
                }, "Pedido rejeitado.")
              }
              className="text-sm rounded px-3 py-2 disabled:opacity-60"
              style={{ background: "var(--status-critical)", color: "#fff" }}
            >
              Confirmar recusa
            </button>
            <button onClick={() => setShowReject(false)} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              Voltar
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <button
          disabled={pending}
          onClick={() => run(() => aprovarSuprimentoAction(pedidoId), "Pedido aprovado.")}
          className="text-sm rounded px-3 py-2 font-medium disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Aprovar
        </button>
        <button
          disabled={pending}
          onClick={() => setShowReject(true)}
          className="text-sm rounded px-3 py-2 font-medium border disabled:opacity-60"
          style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
        >
          Rejeitar
        </button>
      </div>
    );
  }

  const next = NEXT_STEP[status];
  if (!next) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhuma ação disponível neste momento.
      </p>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() => run(() => next.action(pedidoId), "Status atualizado.")}
      className="text-sm rounded px-3 py-2 font-medium disabled:opacity-60"
      style={{ background: "var(--brand-orange)", color: "#fff" }}
    >
      {next.label}
    </button>
  );
}
