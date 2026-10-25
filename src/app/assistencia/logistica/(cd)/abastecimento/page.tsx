import { listarSolicitacoesAbast, mensagemDeErro } from "@/lib/odoo/logistica";
import { AbastecimentoBoard } from "@/components/logisticaOdoo/AbastecimentoBoard";
import { ErroOdoo } from "@/components/logisticaOdoo/ui";

// Pedidos de abastecimento das lojas (antes: solicitação de transferência
// NNS/NNT do Protheus). A loja pede no caixa (Caixa do dia › Pedir
// abastecimento); aqui o CD ajusta o que vai no caminhão e atende: sai a
// NF-e 5152 do CD para a loja e o estoque entra na loja (1152).
export const dynamic = "force-dynamic";

export default async function AbastecimentoPage() {
  let lista;
  try {
    lista = await listarSolicitacoesAbast();
  } catch (err) {
    return <ErroOdoo titulo="Não consegui ler os pedidos das lojas" mensagem={mensagemDeErro(err)} />;
  }
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
        Pedidos de abastecimento das lojas
      </h2>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        A loja pede pelo caixa. Ajuste o que vai no caminhão e clique em Atender: sai a nota de transferência do CD para a loja.
      </p>
      <AbastecimentoBoard solicitacoes={lista} />
    </div>
  );
}
