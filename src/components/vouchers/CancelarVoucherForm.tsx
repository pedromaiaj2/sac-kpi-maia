"use client";

import { useActionState, useState } from "react";
import { cancelarVoucherAction, type CancelarState } from "@/app/assistencia/vouchers-actions";

export function CancelarVoucherForm({ id, codigo }: { id: string; codigo: string }) {
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState<CancelarState, FormData>(cancelarVoucherAction, undefined);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="self-start text-sm font-semibold px-4 py-2 rounded-lg"
        style={{ border: "1px solid var(--status-critical)", color: "var(--text-primary)" }}
      >
        Cancelar voucher
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg p-3" style={{ border: "1px solid var(--status-critical)" }}>
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
        Motivo do cancelamento de {codigo} (obrigatório, não dá pra desfazer)
        <textarea name="motivo_cancelamento" required rows={2} className="text-sm rounded border px-2.5 py-2" style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-1)" }} />
      </label>
      {state?.error ? (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
          style={{ background: "var(--status-critical)", color: "#fff" }}
        >
          {pending ? "Cancelando…" : "Confirmar cancelamento"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          Voltar
        </button>
      </div>
    </form>
  );
}
