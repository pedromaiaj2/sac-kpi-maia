// Grupo de produto pela descrição -- pedido do Victor 16/10/2026: "nos
// produtos por porte, quando abrir o médio, grande ou pequeno, ele precisa
// estar dividido por grupos dentro do modal: colchão e base, sofá,
// cadeira...". Mesmo vocabulário das regras de porte (produto_porte_regras,
// migração 0157) -- um produto já tem um padrão conhecido pelo porte, aqui
// só agrupa esse padrão num grupo mais amplo pra navegação.
export type GrupoProduto = { chave: string; label: string; padroes: RegExp[] };

const GRUPOS: GrupoProduto[] = [
  // SUPERBOX/UNIBOX/"CM KANSAS" (18/10/2026: eram os mais vendidos de "Outros")
  { chave: "colchao", label: "Colchão e base", padroes: [/COLCHAO/, /\bCOL\b/, /\bBOX\b/, /SUPERBOX/, /UNIBOX/, /\bCM\b/, /BASE/, /BAU/, /COLCHONETE/, /ESPUMA/] },
  { chave: "sofa", label: "Sofá e poltrona", padroes: [/SOFA/, /POLTRONA/, /ESTOFAD/] },
  { chave: "cadeira", label: "Cadeira", padroes: [/CADEIRA/, /BANQUETA/, /\bCAD\b/] },
  { chave: "cama", label: "Cama, berço e beliche", padroes: [/\bCAMA\b/, /BELICHE/, /BERCO/, /CABECEIRA/] },
  // Checado antes de "roupeiro" -- "ARMARIO DE COZINHA" é cozinha, não
  // guarda-roupa (mesma prioridade das regras de porte: padrão mais
  // específico vence).
  // "COMP COZ" e "KIT ... 6 PTS" (kit de cozinha em aço/MDP) -- 18/10/2026
  { chave: "cozinha", label: "Cozinha", padroes: [/COZINHA/, /\bCOZ\b/, /PANELEIRO/, /BANCADA/, /FRUTEIRA/, /CANTINHO/, /\bKIT\b.*\b\d+ ?PTS?\b/] },
  { chave: "roupeiro", label: "Guarda-roupa e armário", padroes: [/GUARDA.?ROUPA/, /ROUPEIRO/, /\bROUP\b/, /ARMARIO/, /MULTI.?USO/] },
  {
    chave: "mesa",
    label: "Mesa, rack e estante",
    padroes: [/\bMESA\b/, /RACK/, /ESTANTE/, /ESCRIVANINHA/, /BUFFER/, /AEREO/, /PAINEL/, /BALCAO/, /\bHOME\b/, /CRISTALEIRA/, /BUFFET/, /APARADOR/, /COMODA/, /SAPATEIRA/, /PENTEADEIRA/, /TORRE/],
  },
  { chave: "travesseiro", label: "Travesseiro e protetor", padroes: [/TRAVESSEIRO/, /\bTRAV\b/, /PROTETOR/, /ENCOSTO/] },
  { chave: "eletro", label: "Eletrodoméstico", padroes: [/GELADEIRA/, /REFRIGERADOR/, /LAVADORA/] },
  { chave: "espelho", label: "Espelho e decoração", padroes: [/ESPELHO/, /\bESP\./] },
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

// Unidades por grupo dentro de cada porte, do maior pro menor -- divisão que
// aparece direto embaixo do gráfico de porte (pedido do Victor 18/10/2026).
export function gruposPorPorte(
  produtos: { porte: string; descricao: string | null; unidades: number }[],
): Record<string, { chave: string; label: string; unidades: number }[]> {
  const porPorte = new Map<string, Map<string, { chave: string; label: string; unidades: number }>>();
  for (const p of produtos) {
    const g = grupoProduto(p.descricao);
    const grupos = porPorte.get(p.porte) ?? new Map();
    const acc = grupos.get(g.chave) ?? { chave: g.chave, label: g.label, unidades: 0 };
    acc.unidades += Number(p.unidades);
    grupos.set(g.chave, acc);
    porPorte.set(p.porte, grupos);
  }
  return Object.fromEntries([...porPorte].map(([porte, gs]) => [porte, [...gs.values()].sort((a, b) => b.unidades - a.unidades)]));
}
