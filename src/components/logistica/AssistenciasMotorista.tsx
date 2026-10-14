"use client";

import { ModalLogistica } from "./ModalLogistica";
import { REQUEST_TYPE_LABELS, CAUSA_RAIZ_LABELS } from "@/lib/assistenciaLabels";
import type { AssistenciaEntrega } from "@/lib/kpisLogistica";

// Chamados de assistência de um motorista -- abre ao clicar no número da
// coluna "Assistências" (pedido do Victor 13/10/2026: "quando eu clicasse
// no número de assistência daquele motorista, ele abriria os dados de o
// que foi aquela assistência"). Só mostra a lista que a RPC já mandou
// (kpis_entregas.assistencias); nada é buscado de novo.
const ATRIBUICAO: Record<AssistenciaEntrega["atribuicao"], { label: string; hint: string; cor: string }> = {
  carga: {
    label: "Carga do chamado",
    hint: "A carga foi informada no próprio chamado.",
    cor: "var(--status-good)",
  },
  produto: {
    label: "Cliente + produto",
    hint: "Nota a esse cliente (CPF ou código no Protheus) em que saiu o produto do chamado.",
    cor: "var(--brand-green)",
  },
  cliente: {
    label: "≈ Só o cliente",
    hint: "O produto não bateu com nenhuma nota: ligado à nota mais recente ao cliente. Provável, não certo.",
    cor: "var(--status-warning)",
  },
};

function dataBr(dia: string | null) {
  return dia ? dia.split("-").reverse().join("/") : "—";
}

function tipoLabel(a: AssistenciaEntrega) {
  if (a.origem === "pedido_peca") return "Pedido de peça (fila de peças)";
  return REQUEST_TYPE_LABELS[a.tipo] ?? a.tipo;
}

export function AssistenciasMotorista({ nome, itens, onFechar }: { nome: string; itens: AssistenciaEntrega[]; onFechar: () => void }) {
  const porAtribuicao = (k: AssistenciaEntrega["atribuicao"]) => itens.filter((i) => i.atribuicao === k).length;

  return (
    <ModalLogistica
      titulo={`Assistências · ${nome}`}
      subtitulo={`${itens.length} chamado${itens.length === 1 ? "" : "s"} no período: ${porAtribuicao("carga")} pela carga do chamado, ${porAtribuicao(
        "produto",
      )} pelo cliente + produto, ${porAtribuicao("cliente")} só pelo cliente (≈).`}
      onFechar={onFechar}
    >
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0" style={{ background: "var(--surface-2)" }}>
          <tr>
            {["Chamado", "Aberto em", "Tipo", "Produto", "Causa", "Saiu na carga", "Ligado por"].map((h) => (
              <th key={h} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {itens.map((a) => {
            const at = ATRIBUICAO[a.atribuicao];
            return (
              <tr key={`${a.origem}-${a.id}`} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
                <td className="px-2 py-1.5 font-semibold tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                  {a.ticket ? `#${a.ticket}` : "—"}
                </td>
                <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{dataBr(a.dia)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{tipoLabel(a)}</td>
                <td className="px-2 py-1.5 min-w-[180px]" style={{ color: "var(--text-primary)" }}>
                  {a.produto ?? "—"}
                </td>
                <td className="px-2 py-1.5 min-w-[120px]">{a.causaRaiz ? (CAUSA_RAIZ_LABELS[a.causaRaiz] ?? a.causaRaiz) : "—"}</td>
                <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                  #{a.carga}
                  <span className="block" style={{ color: "var(--text-muted)" }}>
                    {dataBr(a.diaEntrega)}
                  </span>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap" title={at.hint}>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{
                      color: "var(--text-primary)",
                      background: `color-mix(in srgb, ${at.cor} 22%, var(--surface-1))`,
                    }}
                  >
                    <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: at.cor }} />
                    {at.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ModalLogistica>
  );
}
