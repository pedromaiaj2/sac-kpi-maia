// Grupo de produto pela descrição -- pedido do Victor 16/10/2026: "nos
// produtos por porte, quando abrir o médio, grande ou pequeno, ele precisa
// estar dividido por grupos dentro do modal: colchão e base, sofá,
// cadeira...". Mesmo vocabulário das regras de porte (produto_porte_regras,
// migração 0157) -- um produto já tem um padrão conhecido pelo porte, aqui
// só agrupa esse padrão num grupo mais amplo pra navegação.
export type GrupoProduto = { chave: string; label: string; padroes: RegExp[] };

const GRUPOS: GrupoProduto[] = [
  { chave: "colchao", label: "Colchão e base", padroes: [/COLCHAO/, /\bCOL\b/, /\bBOX\b/, /BASE/, /BAU/, /COLCHONETE/, /ESPUMA/] },
  { chave: "sofa", label: "Sofá e poltrona", padroes: [/SOFA/, /POLTRONA/, /ESTOFAD/] },
  { chave: "cadeira", label: "Cadeira", padroes: [/CADEIRA/, /BANQUETA/] },
  { chave: "cama", label: "Cama, berço e beliche", padroes: [/\bCAMA\b/, /BELICHE/, /BERCO/, /CABECEIRA/] },
  // Checado antes de "roupeiro" -- "ARMARIO DE COZINHA" é cozinha, não
  // guarda-roupa (mesma prioridade das regras de porte: padrão mais
  // específico vence).
  { chave: "cozinha", label: "Cozinha", padroes: [/COZINHA/, /PANELEIRO/, /BANCADA/] },
  { chave: "roupeiro", label: "Guarda-roupa e armário", padroes: [/GUARDA.?ROUPA/, /ROUPEIRO/, /\bROUP\b/, /ARMARIO/, /MULTI.?USO/] },
  {
    chave: "mesa",
    label: "Mesa, rack e estante",
    padroes: [/\bMESA\b/, /RACK/, /ESTANTE/, /AEREO/, /PAINEL/, /BALCAO/, /\bHOME\b/, /CRISTALEIRA/, /BUFFET/, /APARADOR/, /COMODA/, /SAPATEIRA/, /PENTEADEIRA/, /TORRE/],
  },
  { chave: "travesseiro", label: "Travesseiro e protetor", padroes: [/TRAVESSEIRO/, /\bTRAV\b/, /PROTETOR/, /ENCOSTO/] },
  { chave: "eletro", label: "Eletrodoméstico", padroes: [/GELADEIRA/, /REFRIGERADOR/, /LAVADORA/] },
];

const OUTROS: GrupoProduto = { chave: "outros", label: "Outros", padroes: [] };

export const GRUPOS_PRODUTO: GrupoProduto[] = [...GRUPOS, OUTROS];

export function grupoProduto(descricao: string | null): GrupoProduto {
  if (!descricao) return OUTROS;
  const desc = descricao.toUpperCase();
  for (const g of GRUPOS) {
    if (g.padroes.some((p) => p.test(desc))) return g;
  }
  return OUTROS;
}
