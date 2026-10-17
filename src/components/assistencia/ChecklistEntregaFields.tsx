"use client";

import { useState } from "react";
import { PRODUCT_CHECKLIST_LOCATION_OPTIONS, PRODUCT_CHECKLIST_LOCATION_LABELS } from "@/lib/assistenciaLabels";

const inputStyle = { borderColor: "var(--border)" };

// Checklist antes de finalizar -- pedido do Victor 17/10/2026: "preciso de
// um checklist antes que o atendente finalize a solicitação [de envio de
// peça, troca com recolhimento ou entrega de produto]... Ele deverá poder
// salvar como rascunho, mas só entra de verdade na rota, depois que
// preencher o checklist". Autocontido (estado próprio, só os `name`s
// precisam bater com o que o servidor lê -- ver readChecklistFields,
// actions.ts) pra não duplicar essa UI nos 3 formulários que usam (criação
// SAC/assistência e edição do chamado, ver CHECKLIST_REQUIRED_TYPES,
// assistenciaLabels.ts).
export function ChecklistEntregaFields({
  initial,
}: {
  initial?: { estoque: boolean; separado: boolean; placa: boolean; localizacao: string | null };
}) {
  const [estoque, setEstoque] = useState(initial?.estoque ?? false);
  const [separado, setSeparado] = useState(initial?.separado ?? false);
  const [placa, setPlaca] = useState(initial?.placa ?? false);
  const [localizacao, setLocalizacao] = useState(initial?.localizacao ?? "");
  const completo = estoque && separado && placa && !!localizacao;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex flex-col gap-2">
        {[
          { name: "checklist_estoque", label: "Produto consta em estoque", checked: estoque, onChange: setEstoque },
          { name: "checklist_separado", label: "Produto separado", checked: separado, onChange: setSeparado },
          { name: "checklist_placa", label: "Produto sinalizado com placa", checked: placa, onChange: setPlaca },
        ].map((item) => (
          <label key={item.name} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
            <input
              type="checkbox"
              name={item.name}
              checked={item.checked}
              onChange={(e) => item.onChange(e.target.checked)}
              className="rounded"
            />
            {item.label}
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
        Onde o produto está
        <select
          name="checklist_localizacao"
          value={localizacao}
          onChange={(e) => setLocalizacao(e.target.value)}
          className="rounded border px-3 py-2"
          style={inputStyle}
        >
          <option value="">Selecione…</option>
          {PRODUCT_CHECKLIST_LOCATION_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {PRODUCT_CHECKLIST_LOCATION_LABELS[l]}
            </option>
          ))}
        </select>
      </label>

      {completo ? (
        <p className="text-xs font-medium" style={{ color: "var(--status-good)" }}>
          ✓ Checklist completo -- pode entrar na rota.
        </p>
      ) : (
        <p className="text-xs font-medium" style={{ color: "var(--status-critical)" }}>
          ⚠ Checklist incompleto -- vai salvar como rascunho (não entra na rota até completar, aqui ou editando depois).
        </p>
      )}
    </div>
  );
}
