// Fonte única das fábricas PRÓPRIAS -- usada tanto no formulário de
// encomenda quanto na validação do server action (ver
// supabase/migrations/0052_pedido_encomenda_fornecedor.sql). Fábricas
// externas não têm lista fixa aqui (pedido do Victor 23/10/2026: a lista
// fixa de 8 nomes tinha ficado defasada do cadastro de fornecedores real,
// que já tinha 42 -- precisava pedir pra um dev toda vez que entrava um
// fornecedor novo). Fornecedor externo agora usa o mesmo cadastro de
// `suppliers` que Pedidos a Fornecedores/Devoluções já usam (ver
// listSuppliers em partOrders.ts) -- um fornecedor novo cadastrado no admin
// já aparece aqui sozinho, sem precisar mexer em código.
export type InternalFabrica = { id: string; nome: string };

// Cidade na frente do nome de propósito -- pessoal confundia as duas
// fábricas próprias (mesmo grupo Beds/Aiam, unidades diferentes).
export const INTERNAL_FABRICAS: InternalFabrica[] = [
  { id: "colchoes", nome: "(Conde) Beds/Aiam Colchões" },
  { id: "estofados", nome: "(Bayeux) Beds/Aiam Estofados" },
];

export function findInternalFabrica(id: string | null | undefined): InternalFabrica | undefined {
  return INTERNAL_FABRICAS.find((f) => f.id === id);
}
