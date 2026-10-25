"use client";

import { encerrarRotaAction, sairParaRotaAction } from "@/app/assistencia/motorista/odoo/odoo-actions";
import type { EstadoCarga } from "@/lib/odoo/logisticaTipos";
import { useAcaoOdoo } from "./useAcaoOdoo";

export function RotaOdooBotoes({ cargaId, estado, faltam }: { cargaId: number; estado: EstadoCarga; faltam: number }) {
  const { pending, run } = useAcaoOdoo();
  if (estado === "liberada") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Confirmar saída para a rota? As notas de entrega (5117) são emitidas agora.")) return;
          run(() => sairParaRotaAction(cargaId), (r) => `Boa rota! ${r.notas?.filter((n) => n.nf5117).length ?? 0} nota(s) emitida(s).`);
        }}
        className="text-base font-bold rounded-xl px-4 py-4 disabled:opacity-60"
        style={{ background: "var(--brand-orange)", color: "#fff" }}
      >
        {pending ? "Emitindo as notas…" : "🚚 Saí para a rota"}
      </button>
    );
  }
  if (estado === "em_rota" && faltam === 0) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => encerrarRotaAction(cargaId), "Rota encerrada.")}
        className="text-base font-bold rounded-xl px-4 py-4 disabled:opacity-60"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        {pending ? "Encerrando…" : "✅ Encerrar rota"}
      </button>
    );
  }
  return null;
}
