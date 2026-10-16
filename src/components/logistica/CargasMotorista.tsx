"use client";

import { ModalLogistica } from "./ModalLogistica";
import { dataBr } from "@/lib/logisticaFormat";
import type { CargaEntregas } from "@/lib/kpisLogistica";

// Cargas de um motorista -- abre ao clicar em "Cargas", "Notas" ou
// "Prod./carga" na tabela de Índice de Volta (pedido do Victor 16/10/2026:
// "todos os números fiquem clicáveis... pra ver detalhes de cargas,
// notas"). Mesma lista que já vem na RPC (kpis_entregas.cargas), só
// filtrada por motorista -- sem nota a nota (cliente/produto) aqui porque
// a maioria das notas é entrega OK; quem quer nota a nota de insucesso ou
// parcial já tem colunas próprias pra isso.
function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function CargasMotorista({ nome, itens, onFechar }: { nome: string; itens: CargaEntregas[]; onFechar: () => void }) {
  const pedidos = itens.reduce((s, c) => s + c.pedidos, 0);
  const unidades = itens.reduce((s, c) => s + c.volumes.P + c.volumes.M + c.volumes.G + c.volumes.naoClassificado, 0);
  return (
    <ModalLogistica
      titulo={`Cargas · ${nome}`}
      subtitulo={`${itens.length} carga${itens.length === 1 ? "" : "s"} no período, da mais recente: ${fmt(pedidos)} notas e ${fmt(unidades)} unidades.`}
      onFechar={onFechar}
    >
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0" style={{ background: "var(--surface-2)" }}>
          <tr>
            {["Carga", "Dia", "Tipo", "Veículo", "Notas", "Entregues", "Parciais", "Não entregues", "Canceladas", "Volumes (P/M/G/N)"].map((h) => (
              <th key={h} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {itens.map((c) => (
            <tr key={c.carga} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
              <td className="px-2 py-1.5 font-semibold tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                #{c.carga}
              </td>
              <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{dataBr(c.dia)}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">{c.tipo ?? "—"}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                {c.tipoVeiculo}
                {c.veiculo && (
                  <span className="block" style={{ color: "var(--text-muted)" }}>
                    {c.veiculo}
                  </span>
                )}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{c.pedidos}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{c.entregues}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{c.parciais}</td>
              <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: c.naoEntregues > 0 ? "var(--status-critical)" : undefined }}>
                {c.naoEntregues}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{c.canceladas}</td>
              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                {c.volumes.P}/{c.volumes.M}/{c.volumes.G}/{c.volumes.naoClassificado}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ModalLogistica>
  );
}
