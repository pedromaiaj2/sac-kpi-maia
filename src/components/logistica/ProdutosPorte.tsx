"use client";

import { ModalLogistica } from "./ModalLogistica";
import type { KpisEntregas, ProdutoPorte } from "@/lib/kpisLogistica";

// Produtos de uma classe de porte -- abre ao clicar em P/M/G na legenda do
// gráfico (pedido do Victor 13/10/2026: "quais são os produtos de cada
// classe"). Lista pronta da RPC (kpis_entregas.produtosPorte, 0165): os
// produtos que saíram nas cargas do período, mais as regras que definem a
// classe (produto_porte_regras), pra explicar por que cada um caiu ali.
export const NOME_PORTE: Record<ProdutoPorte["porte"], string> = { P: "P (pequeno)", M: "M (médio)", G: "G (grande)", N: "Sem classe" };

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function origemLabel(origem: string | null) {
  if (origem === "regra") return "Regra da descrição";
  if (!origem || origem === "nenhuma") return "Nenhuma regra";
  return "Cadastro manual";
}

export function ProdutosPorte({
  porte,
  produtos,
  regras,
  onFechar,
}: {
  porte: ProdutoPorte["porte"];
  produtos: ProdutoPorte[];
  regras: KpisEntregas["regrasPorte"];
  onFechar: () => void;
}) {
  const unidades = produtos.reduce((s, p) => s + p.unidades, 0);
  const regrasDaClasse = regras.filter((r) => r.porte === porte);
  return (
    <ModalLogistica
      titulo={`Produtos ${NOME_PORTE[porte]}`}
      subtitulo={`${fmt(produtos.length)} produto${produtos.length === 1 ? "" : "s"} diferente${produtos.length === 1 ? "" : "s"} · ${fmt(unidades)} unidades nas cargas do período, do mais despachado.`}
      onFechar={onFechar}
    >
      <div className="px-4 py-3 border-b flex flex-col gap-2" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {porte === "N"
            ? "Nenhuma regra bateu com a descrição desses produtos e eles não têm cadastro manual. Pra classificar, é só criar uma regra ou cadastrar o produto."
            : "Entra nesta classe o produto com cadastro manual nela ou cuja descrição bate com uma destas regras (vale a de maior prioridade; % = qualquer texto):"}
        </p>
        {porte !== "N" && (
          <div className="flex flex-wrap gap-1.5">
            {regrasDaClasse.map((r) => (
              <span
                key={r.padrao}
                className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}
              >
                {r.padrao.trim()}
              </span>
            ))}
          </div>
        )}
      </div>
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0" style={{ background: "var(--surface-2)" }}>
          <tr>
            <th className="px-2 py-1.5 text-left font-semibold" style={{ color: "var(--text-secondary)" }}>
              Produto
            </th>
            <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
              Código
            </th>
            <th className="px-2 py-1.5 text-right font-semibold whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
              Unidades
            </th>
            <th className="px-2 py-1.5 text-right font-semibold whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
              Cargas
            </th>
            <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
              Classificado por
            </th>
          </tr>
        </thead>
        <tbody>
          {produtos.map((p) => (
            <tr key={p.produto} className="border-t" style={{ borderColor: "var(--border)" }}>
              <td className="px-2 py-1.5 font-semibold" style={{ color: "var(--text-primary)" }}>
                {p.descricao ?? "—"}
              </td>
              <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{p.produto}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmt(p.unidades)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.cargas)}</td>
              <td className="px-2 py-1.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                {origemLabel(p.origem)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ModalLogistica>
  );
}
