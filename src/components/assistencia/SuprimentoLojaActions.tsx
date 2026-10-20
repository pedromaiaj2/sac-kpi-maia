"use client";

import { useState } from "react";
import { cancelSuprimentoPedidoAction, confirmarRecebimentoSuprimentoAction } from "@/app/assistencia/suprimentos-actions";
import { useQuickAction } from "./useQuickAction";

export function SuprimentoLojaActions({ pedidoId, status }: { pedidoId: string; status: string }) {
  const { pending, run } = useQuickAction();
  const [note, setNote] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  if (status === "enviado") {
    return (
      <button
        disabled={pending}
        onClick={() => run(() => confirmarRecebimentoSuprimentoAction(pedidoId), "Recebimento confirmado.")}
        className="text-sm rounded px-3 py-2 font-medium disabled:opacity-60"
        style={{ background: "var(--status-good)", color: "#fff" }}
      >
        Confirmar recebimento
      </button>
    );
  }

  if (status !== "solicitado") return null;

  if (!showCancel) {
    return (
      <button onClick={() => setShowCancel(true)} className="text-sm underline self-start" style={{ color: "var(--status-critical)" }}>
        Cancelar pedido
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Motivo do cancelamento (opcional)…"
        className="rounded border px-3 py-2 text-sm"
        style={{ borderColor: "var(--status-critical)" }}
      />
      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          onClick={() =>
            run(async () => {
              await cancelSuprimentoPedidoAction(pedidoId, note);
              setShowCancel(false);
            }, "Pedido cancelado.")
          }
          className="text-sm rounded px-3 py-2 disabled:opacity-60"
          style={{ background: "var(--status-critical)", color: "#fff" }}
        >
          Confirmar cancelamento
        </button>
        <button onClick={() => setShowCancel(false)} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          Voltar
        </button>
      </div>
    </div>
  );
}
