// Código do conferente no Protheus (tabela AC4) -> nome. Curado manualmente
// a partir da tela de consulta do Protheus (print do Victor, 12/10/2026) --
// não tem endpoint que devolva esse cadastro, só o browse dentro do
// sistema. Fonte única pra duas coisas: cruzar com
// totvs_delivery_cargas.conferente_codigo (ver kpiAssistencia.ts, ranking
// "Conferente que mais errou") e popular o dropdown "Conferente" nos
// formulários de registro de erro (ver CONFERENTE_NOMES abaixo) -- pedido
// do Victor 12/10/2026: "na hora que um atendente for colocar o nome do
// conferente que errou, ele tenha a opção de colocar quem foi o conferente
// já numa lista e caso não tenha sido nenhum conferente do CD, teria um
// campo pra ele digitar". "4" e "5" são dois ROBERTOS diferentes (ambíguo
// na origem, sem jeito de distinguir só pelo nome).
export const CONFERENTE_CODIGO_NOME: Record<string, string> = {
  "1": "ERYCK",
  "2": "LUAN",
  "3": "FLAVIO",
  "4": "ROBERTO",
  "5": "ROBERTO",
  "6": "FILIPE",
  "7": "SAMUEL",
  "8": "EVERTON",
  "9": "FABRICIO",
  A: "PEDRO MAIA",
  B: "CARLOS GABRIEL",
  C: "WILLIAM GABRIEL",
  D: "DIEGO",
  E: "GABRIEL",
  F: "SERGIO",
  G: "COLETA LOJA",
  H: "JEFFERSON",
  I: "PEDRO LUCAS",
  J: "KELVIN",
  K: "VINICIUS JP",
};

// Lista única de nomes (sem o código) pro dropdown -- "4"/"5" (os dois
// ROBERTOS) viram uma opção só, não dá pra diferenciar no formulário
// também.
export const CONFERENTE_NOMES: string[] = [...new Set(Object.values(CONFERENTE_CODIGO_NOME))].sort((a, b) =>
  a.localeCompare(b, "pt-BR")
);

// Valor sentinela do <select> pra "não é ninguém dessa lista" -- mesmo
// padrão já usado em "Fornecedor" (NewPartOrderForm.tsx/EditPartOrderForm.tsx,
// supplier/supplier_other). O campo de texto livre que aparece junto some
// "causa_conferente_other" no FormData, resolvido pelo servidor
// (src/app/assistencia/actions.ts) do mesmo jeito que supplier_other.
export const CONFERENTE_OUTRO_VALUE = "__outro__";
