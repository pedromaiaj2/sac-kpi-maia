"use client";

import { useState } from "react";
import type { SolicitacaoAbast } from "@/lib/odoo/logisticaTipos";
import { atenderAbastAction, cancelarAbastAction } from "@/app/assistencia/logistica/logistica-actions";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { botaoClass, botaoPerigoStyle, botaoPrimarioStyle, inputClass, inputStyle } from "./ui";

function semHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function Cartao({ s }: { s: SolicitacaoAbast }) {
  const { pending, run } = useAcaoOdoo();
  const [qtd, setQtd] = useState<Record<string, number>>(() =>
    Object.fromEntries(s.itens.map((i) => [i.codigo, Math.max(0, Math.min(i.qtd, i.saldo_cd))])),
  );
  const obs = semHtml(s.obs || "");
  return (
    <div className="cartao p-4 flex flex-col gap-3">
      <div className="flex justify-between gap-2 flex-wrap">
        <b style={{ color: "var(--text-primary)" }}>
          {s.loja} · {s.nome}
        </b>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {s.criado.slice(0, 16)} UTC · {s.solicitante}
        </span>
      </div>
      {obs ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          obs: {obs}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--text-secondary)" }}>
              <th className="text-left py-1">Produto</th>
              <th>Pedido</th>
              <th>CD tem</th>
              <th>Loja tem</th>
              <th>Vai no caminhão</th>
            </tr>
          </thead>
          <tbody>
            {s.itens.map((i) => (
              <tr key={i.codigo} style={{ color: "var(--text-primary)" }}>
                <td className="py-1">
                  <b>{i.codigo}</b> {i.nome.slice(0, 60)}
                </td>
                <td className="text-center">{i.qtd}</td>
                <td className="text-center" style={{ color: i.saldo_cd >= i.qtd ? "var(--status-ok, #1B7E3B)" : "var(--status-critical)" }}>
                  {i.saldo_cd}
                </td>
                <td className="text-center">{i.saldo_loja}</td>
                <td className="text-center">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className={inputClass}
                    style={{ ...inputStyle, width: 80 }}
                    value={qtd[i.codigo] ?? 0}
                    onChange={(e) => setQtd((q) => ({ ...q, [i.codigo]: Number(e.target.value) }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          className={botaoClass}
          style={botaoPrimarioStyle}
          disabled={pending}
          onClick={() => {
            if (!confirm(`Atender o pedido ${s.nome} e emitir a NF de transferência para ${s.loja}?`)) return;
            run(
              () => atenderAbastAction(s.id, Object.entries(qtd).map(([codigo, q]) => ({ codigo, qtd: q }))),
              (d) => `Atendido: transferência ${d.saida ?? ""} · NF ${d.numero ?? ""}`,
            );
          }}
        >
          {pending ? "Emitindo a nota…" : "✅ Atender (sai a NF de transferência)"}
        </button>
        <button
          type="button"
          className={botaoClass}
          style={botaoPerigoStyle}
          disabled={pending}
          onClick={() => {
            const m = prompt("Motivo do cancelamento:", "");
            if (m === null) return;
            run(() => cancelarAbastAction(s.id, m), "Pedido cancelado.");
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function AbastecimentoBoard({ solicitacoes }: { solicitacoes: SolicitacaoAbast[] }) {
  if (!solicitacoes.length) {
    return (
      <div className="cartao p-6 text-sm" style={{ color: "var(--text-secondary)" }}>
        Nenhum pedido de abastecimento aberto.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {solicitacoes.map((s) => (
        <Cartao key={s.id} s={s} />
      ))}
    </div>
  );
}
