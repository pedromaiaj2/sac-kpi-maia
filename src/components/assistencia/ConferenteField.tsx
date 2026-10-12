"use client";

import { useState, type CSSProperties } from "react";
import { CONFERENTE_NOMES, CONFERENTE_OUTRO_VALUE } from "@/lib/conferentes";

// Campo "Conferente" de erro_conferencia/sujeira_conferencia, usado nos 3
// lugares que registram isso (NovaEntregaAssistenciaForm.tsx,
// SacCreateRequestForm.tsx, EditRequestForm.tsx) -- antes era um <input>
// de texto livre, agora dropdown com os conferentes conhecidos do CD (ver
// conferentes.ts) + "Outro" com campo de texto, mesmo padrão já usado em
// "Fornecedor" (NewPartOrderForm.tsx/EditPartOrderForm.tsx). Pedido do
// Victor 12/10/2026: "ele tenha a opção de colocar quem foi o conferente
// já numa lista e caso não tenha sido nenhum conferente do CD, teria um
// campo pra ele digitar". O servidor (actions.ts) resolve
// causa_conferente/causa_conferente_other pro valor final, igual
// supplier/supplier_other.
export function ConferenteField({
  defaultValue,
  inputStyle,
}: {
  // Valor já salvo (edição de chamado existente) -- undefined/null em
  // formulário de criação.
  defaultValue?: string | null;
  inputStyle: CSSProperties;
}) {
  const normalized = (defaultValue ?? "").trim().toUpperCase();
  const isKnown = normalized !== "" && CONFERENTE_NOMES.includes(normalized);
  const [choice, setChoice] = useState(() => {
    if (!defaultValue) return "";
    return isKnown ? normalized : CONFERENTE_OUTRO_VALUE;
  });

  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      Conferente *
      <select
        name="causa_conferente"
        required
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        className="rounded border px-3 py-2"
        style={inputStyle}
      >
        <option value="" disabled>
          Selecione…
        </option>
        {CONFERENTE_NOMES.map((nome) => (
          <option key={nome} value={nome}>
            {nome}
          </option>
        ))}
        <option value={CONFERENTE_OUTRO_VALUE}>Outro (não é do CD)…</option>
      </select>
      {choice === CONFERENTE_OUTRO_VALUE ? (
        <input
          name="causa_conferente_other"
          defaultValue={isKnown ? "" : (defaultValue ?? "")}
          placeholder="Nome de quem conferiu a carga"
          className="rounded border px-3 py-2 mt-1"
          style={inputStyle}
        />
      ) : null}
    </label>
  );
}
