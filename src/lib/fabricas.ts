// Fonte única das fábricas próprias e externas -- usada tanto no formulário
// de encomenda quanto na validação do server action (ver
// supabase/migrations/0052_pedido_encomenda_fornecedor.sql). Fábricas
// externas não viram tabela: não têm login/PIN/status próprios, só entram
// como rótulo no pedido.

export type InternalFabrica = { id: string; nome: string };

// Cidade na frente do nome de propósito -- pessoal confundia as duas
// fábricas próprias (mesmo grupo Beds/Aiam, unidades diferentes).
export const INTERNAL_FABRICAS: InternalFabrica[] = [
  { id: "colchoes", nome: "(Conde) Beds/Aiam Colchões" },
  { id: "estofados", nome: "(Bayeux) Beds/Aiam Estofados" },
];

export const EXTERNAL_FABRICAS: string[] = [
  "Nesher",
  "Conceito Estofados",
  "Probel",
  "Kappesberg",
  "Tekshine",
  "Tuboarte",
  "Valdemoveis",
  "MGM",
];

export function findInternalFabrica(id: string | null | undefined): InternalFabrica | undefined {
  return INTERNAL_FABRICAS.find((f) => f.id === id);
}

export function isExternalFabrica(nome: string | null | undefined): boolean {
  return !!nome && EXTERNAL_FABRICAS.includes(nome);
}

// Classificação "nossa fábrica x outros fornecedores" por PRODUTO (não por
// pedido de encomenda, ver EXTERNAL_FABRICAS acima -- lista curada pro
// formulário, cobre só 8 nomes, insuficiente pra isso) -- pedido do Victor
// 13/10/2026: comparar defeito de fabricação próprio vs. terceiros no
// gráfico de KPIs, baseado em totvs_stock.manufacturer/
// totvs_order_items.manufacturer (sincronizado do TOTVS). Checado direto
// em produção 13/10/2026: 71 valores distintos de manufacturer em
// totvs_stock (3.772 produtos, 100% preenchido) -- "AIAM" é o único usado
// pelas duas plantas próprias (INTERNAL_FABRICAS acima, mesmo grupo
// Beds/Aiam); "INDEFINIDO"/"OUTROS" são placeholders que o próprio TOTVS
// grava quando não sabe quem fabricou (18% do catálogo) -- NÃO contam como
// "nossa fábrica" por padrão (diferente de isExternalFabrica, que faz
// "não identificado = interno"; aqui isso vira um 3º grupo, "indefinido",
// pra não distorcer a comparação). Os outros ~68 valores são fornecedor
// externo real (Ortobom, Plumatex, Topázio, Tuboarte, Rufato, Colibri
// etc.) -- não precisam estar em nenhuma lista, qualquer coisa que não seja
// AIAM/indefinido já é "externa".
export type FabricanteGrupo = "interna" | "externa" | "indefinido";

const FABRICA_PROPRIA_MANUFACTURER = "AIAM";
const FABRICANTE_INDEFINIDO_VALUES = new Set(["INDEFINIDO", "OUTROS"]);

export function classificarFabricanteGrupo(manufacturer: string | null | undefined): FabricanteGrupo {
  const value = (manufacturer ?? "").trim().toUpperCase();
  if (!value || FABRICANTE_INDEFINIDO_VALUES.has(value)) return "indefinido";
  return value === FABRICA_PROPRIA_MANUFACTURER ? "interna" : "externa";
}
