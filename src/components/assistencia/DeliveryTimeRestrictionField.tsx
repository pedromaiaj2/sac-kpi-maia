"use client";

import { useState } from "react";
import { SHIFTS, type TimeRestrictionMode } from "@/lib/serviceRequests";
import { SHIFT_LABELS } from "@/lib/assistenciaLabels";

const inputStyle = { borderColor: "var(--border)" };

// Restrição de horário de ENTREGA -- pedido do Victor 21/10/2026: trocar o
// texto livre opcional por 3 opções mutuamente exclusivas e OBRIGATÓRIAS
// (sem restrição / turno específico / horário específico). O servidor valida
// de novo (parseDeliveryTimeRestriction, serviceRequests.ts) -- isso aqui é
// só a UI, `required` nos radios é reforço, não a única barreira.
export function DeliveryTimeRestrictionField({
  defaultMode = null,
  defaultShift = "",
  defaultFrom = "",
  defaultTo = "",
}: {
  defaultMode?: TimeRestrictionMode | null;
  defaultShift?: string;
  defaultFrom?: string;
  defaultTo?: string;
}) {
  const [mode, setMode] = useState<TimeRestrictionMode | null>(defaultMode);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        Restrição de horário *
      </span>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
          <input
            type="radio"
            name="time_restriction_mode"
            value="sem_restricao"
            checked={mode === "sem_restricao"}
            onChange={() => setMode("sem_restricao")}
            required
          />
          Sem restrição
        </label>

        <label className="flex items-center gap-2 text-sm flex-wrap" style={{ color: "var(--text-primary)" }}>
          <input
            type="radio"
            name="time_restriction_mode"
            value="turno"
            checked={mode === "turno"}
            onChange={() => setMode("turno")}
            required
          />
          Restrição de turno
          {mode === "turno" ? (
            <select name="time_restriction_shift" defaultValue={defaultShift} required className="rounded border px-2 py-1 text-sm" style={inputStyle}>
              <option value="" disabled>
                Selecione…
              </option>
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {SHIFT_LABELS[s]}
                </option>
              ))}
            </select>
          ) : null}
        </label>

        <label className="flex items-center gap-2 text-sm flex-wrap" style={{ color: "var(--text-primary)" }}>
          <input
            type="radio"
            name="time_restriction_mode"
            value="hora"
            checked={mode === "hora"}
            onChange={() => setMode("hora")}
            required
          />
          Restrição de horário
          {mode === "hora" ? (
            <>
              <input type="time" name="time_restriction_from" defaultValue={defaultFrom} required className="rounded border px-2 py-1 text-sm" style={inputStyle} />
              <span style={{ color: "var(--text-muted)" }}>às</span>
              <input type="time" name="time_restriction_to" defaultValue={defaultTo} required className="rounded border px-2 py-1 text-sm" style={inputStyle} />
            </>
          ) : null}
        </label>
      </div>
    </div>
  );
}
