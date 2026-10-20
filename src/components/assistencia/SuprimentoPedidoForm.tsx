"use client";

import { useActionState, useState } from "react";
import { createSuprimentoPedidoAction, type FormState } from "@/app/assistencia/suprimentos-actions";
import type { SuprimentoProduto } from "@/lib/suprimentos";
import { FormSection } from "./FormSection";

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

const OUTRO_VALUE = "__outro__";

type Item = { produtoId: string; nomeLivre: string; quantidade: number; unidade: string };

export function SuprimentoPedidoForm({
  fixedStoreName,
  storeOptions,
  produtos,
}: {
  fixedStoreName?: string;
  storeOptions?: { id: string; name: string }[];
  produtos: SuprimentoProduto[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createSuprimentoPedidoAction, undefined);
  const [items, setItems] = useState<Item[]>([{ produtoId: produtos[0]?.id ?? OUTRO_VALUE, nomeLivre: "", quantidade: 1, unidade: "" }]);

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function addItem() {
    setItems((prev) => [...prev, { produtoId: produtos[0]?.id ?? OUTRO_VALUE, nomeLivre: "", quantidade: 1, unidade: "" }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <FormSection title="Loja" number={1}>
        {storeOptions ? (
          <Field label="Loja *">
            <select name="store_id" required defaultValue="" className="rounded border px-3 py-2" style={inputStyle}>
              <option value="" disabled>
                Selecione…
              </option>
              {storeOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Loja">
            <input
              value={fixedStoreName}
              disabled
              className="rounded border px-3 py-2"
              style={{ ...inputStyle, background: "var(--gridline)", color: "var(--text-secondary)" }}
            />
          </Field>
        )}
      </FormSection>

      <FormSection title="Itens" number={2} hint='Escolha um item do catálogo ou "Outro" pra digitar o nome.'>
        <div className="flex flex-col gap-3">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg p-2" style={{ background: "var(--surface-2)" }}>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={item.produtoId}
                  onChange={(e) => updateItem(i, { produtoId: e.target.value })}
                  className="flex-1 min-w-[160px] rounded border px-3 py-2 text-sm"
                  style={inputStyle}
                >
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                      {p.categoria ? ` · ${p.categoria}` : ""}
                    </option>
                  ))}
                  <option value={OUTRO_VALUE}>Outro…</option>
                </select>
                {/* value real só vai como produto_id quando não for "outro" --
                    senão o input de nome livre (abaixo) é que preenche o
                    campo correspondente. */}
                <input type="hidden" name="item_produto_id" value={item.produtoId === OUTRO_VALUE ? "" : item.produtoId} />
                <input
                  name="item_quantidade"
                  type="number"
                  min={1}
                  value={item.quantidade}
                  onChange={(e) => updateItem(i, { quantidade: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-20 rounded border px-3 py-2 text-sm"
                  style={inputStyle}
                />
                <input
                  name="item_unidade"
                  value={item.unidade}
                  onChange={(e) => updateItem(i, { unidade: e.target.value })}
                  placeholder="Unidade (un, cx, L…)"
                  className="w-32 rounded border px-3 py-2 text-sm"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1}
                  className="text-sm px-2 py-2 disabled:opacity-40"
                  style={{ color: "var(--status-critical)" }}
                  aria-label="Remover item"
                >
                  remover
                </button>
              </div>
              {item.produtoId === OUTRO_VALUE ? (
                <input
                  name="item_produto_nome_livre"
                  value={item.nomeLivre}
                  onChange={(e) => updateItem(i, { nomeLivre: e.target.value })}
                  required
                  placeholder="Nome do item"
                  className="rounded border px-3 py-2 text-sm"
                  style={inputStyle}
                />
              ) : (
                <input type="hidden" name="item_produto_nome_livre" value="" />
              )}
            </div>
          ))}
          <button type="button" onClick={addItem} className="text-sm self-start underline" style={{ color: "var(--text-secondary)" }}>
            + adicionar item
          </button>
        </div>
      </FormSection>

      <FormSection title="Observações" number={3}>
        <Field label="Observações (opcional)">
          <textarea name="notes" rows={3} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </FormSection>

      {state?.error ? (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded px-4 py-2 font-medium self-start disabled:opacity-60"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        {pending ? "Enviando…" : "Enviar pedido"}
      </button>
    </form>
  );
}
