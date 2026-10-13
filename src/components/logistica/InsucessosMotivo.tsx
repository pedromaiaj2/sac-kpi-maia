"use client";

import { ModalLogistica } from "./ModalLogistica";
import type { InsucessoDetalhe } from "@/lib/kpisLogistica";

// Pedidos que voltaram sem entregar por um motivo -- abre ao clicar no
// motivo (pedido do Victor 13/10/2026: "ao clicar, mostrar o nome do
// cliente, cpf e produto"). Lista pronta da RPC (kpis_entregas.insucessos).
function dataBr(dia: string) {
  return dia.split("-").reverse().join("/");
}

export function formatarDocumento(doc: string | null): string {
  const d = (doc ?? "").replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return doc || "—";
}

export function InsucessosMotivo({
  titulo,
  itens,
  nomes,
  onFechar,
}: {
  titulo: string;
  itens: InsucessoDetalhe[];
  // nome do motorista por código
  nomes: Record<string, string>;
  onFechar: () => void;
}) {
  return (
    <ModalLogistica
      titulo={titulo}
      subtitulo={`${itens.length} pedido${itens.length === 1 ? "" : "s"} que voltaram sem entregar no período, do mais recente.`}
      onFechar={onFechar}
    >
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0" style={{ background: "var(--surface-2)" }}>
          <tr>
            {["Data", "Cliente", "CPF/CNPJ", "Produto", "NF / pedido", "Carga", "Motorista"].map((h) => (
              <th key={h} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <tr key={`${i.carga}-${i.notaFiscal}-${i.pedido}-${i.dia}`} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
              <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                {dataBr(i.dia)}
                {i.tentativa && i.tentativa > 1 && (
                  <span className="block" style={{ color: "var(--text-muted)" }}>
                    {i.tentativa}ª tentativa
                  </span>
                )}
              </td>
              <td className="px-2 py-1.5 font-semibold min-w-[140px]" style={{ color: "var(--text-primary)" }}>
                {i.cliente ?? "—"}
              </td>
              <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{formatarDocumento(i.cpf)}</td>
              <td className="px-2 py-1.5 min-w-[220px]" style={{ color: "var(--text-primary)" }}>
                {i.produtos ?? "—"}
              </td>
              <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                {i.notaFiscal ?? "—"}
                <span className="block" style={{ color: "var(--text-muted)" }}>
                  {i.pedido ?? ""}
                </span>
              </td>
              <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">#{i.carga}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">{nomes[i.motoristaCodigo] ?? i.motoristaCodigo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ModalLogistica>
  );
}
