"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { marcarNpsSugestaoLidaAction } from "@/app/kpis/actions";
import type { NpsSugestao } from "@/lib/npsSugestoes";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Sugestões de melhoria dos clientes, capturadas em texto livre (ver
// entregaNps.ts/detectPendingEntregaSugestoes) -- pedido do Victor
// 23/10/2026. Lista simples + botão "marcar como lida", mesmo espírito de
// edição inline que ReclamacaoTableRow.tsx já usa (sem abrir formulário
// nenhum só pra isso).
export function NpsSugestoesSection({ sugestoes }: { sugestoes: NpsSugestao[] }) {
  const router = useRouter();
  const [showLidas, setShowLidas] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const visiveis = showLidas ? sugestoes : sugestoes.filter((s) => !s.lida);
  const naoLidas = sugestoes.filter((s) => !s.lida).length;

  async function toggleLida(s: NpsSugestao) {
    setSavingId(s.id);
    try {
      await marcarNpsSugestaoLidaAction(s.id, !s.lida);
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Pergunta extra na pesquisa &quot;Pós-entrega&quot; -- {naoLidas} sugestão{naoLidas === 1 ? "" : "ões"} não lida
          {naoLidas === 1 ? "" : "s"}.
        </p>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={showLidas} onChange={(e) => setShowLidas(e.target.checked)} />
          Mostrar já lidas
        </label>
      </div>

      {visiveis.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {showLidas ? "Nenhuma sugestão capturada ainda." : "Nenhuma sugestão pendente."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visiveis.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border p-3 flex flex-col gap-1.5"
              style={{ borderColor: "var(--border)", background: s.lida ? "transparent" : "var(--surface-2)" }}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                  {s.clientName ?? "Cliente sem nome"} {s.storeName ? `· ${s.storeName}` : ""}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {formatDateTime(s.capturadaEm)}
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {s.mensagem}
              </p>
              <div>
                <button
                  type="button"
                  disabled={savingId === s.id}
                  onClick={() => toggleLida(s)}
                  className="text-xs font-medium px-3 py-1 rounded-full border disabled:opacity-60"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  {savingId === s.id ? "salvando…" : s.lida ? "Marcar como não lida" : "Marcar como lida"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
