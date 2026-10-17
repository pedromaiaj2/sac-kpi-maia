"use client";

import { ModalLogistica } from "./ModalLogistica";
import { situacaoDepois, type InsucessoDetalhe, type SituacaoDepois } from "@/lib/kpisLogistica";

// Pedidos que voltaram por um motivo -- abre ao clicar no
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

const COR_TOM: Record<SituacaoDepois["tom"], string> = {
  bom: "var(--status-good)",
  atencao: "var(--status-warning)",
  critico: "var(--status-critical)",
  neutro: "var(--text-muted)",
};

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
  // A visita que falhou conta no índice mesmo que a nota seja entregue
  // depois em outra carga -- achado do Victor 17/10/2026: sem a "Situação
  // hoje", a lista parecia dizer que a nota nunca foi entregue.
  const entreguesDepois = itens.filter((i) => situacaoDepois(i).tom === "bom").length;
  return (
    <ModalLogistica
      titulo={titulo}
      subtitulo={`${itens.length} nota${itens.length === 1 ? "" : "s"} que voltaram nesta visita, da mais recente${
        entreguesDepois > 0 ? ` · ${entreguesDepois} já entregue${entreguesDepois === 1 ? "" : "s"} depois` : ""
      }.`}
      onFechar={onFechar}
    >
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0" style={{ background: "var(--surface-2)" }}>
          <tr>
            {["Data", "Cliente", "Situação hoje", "CPF/CNPJ", "Produto", "Motivo", "Vendedor", "NF / pedido", "Carga", "Motorista"].map((h) => (
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
              <SituacaoHoje s={situacaoDepois(i)} />
              <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{formatarDocumento(i.cpf)}</td>
              <td className="px-2 py-1.5 min-w-[220px]" style={{ color: "var(--text-primary)" }}>
                {i.produtos ?? "—"}
              </td>
              <td className="px-2 py-1.5 min-w-[160px]" style={{ color: "var(--text-primary)" }}>
                {i.motivo ?? "—"}
              </td>
              <td
                className="px-2 py-1.5 min-w-[140px] whitespace-nowrap"
                style={{ color: "var(--text-secondary)" }}
                title={i.vendedor ? "Aproximado: último pedido de venda desse cliente antes da carga, não um cruzamento exato pela nota." : undefined}
              >
                {i.vendedor ?? "—"}
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

function SituacaoHoje({ s }: { s: SituacaoDepois }) {
  return (
    <td className="px-2 py-1.5 min-w-[150px]">
      <span className="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
        <span aria-hidden className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: COR_TOM[s.tom] }} />
        {s.rotulo}
      </span>
      {s.detalhe && (
        <span className="block" style={{ color: "var(--text-muted)" }}>
          {s.detalhe}
        </span>
      )}
    </td>
  );
}
