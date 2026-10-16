import { describe, it, expect } from "vitest";
import { inferCategoriaCiclo, calcularSegmento, sugerirCrossSell, extrairCodigosFormaPagamento, contarEventosDeCompra, CATEGORIAS_CICLO } from "./recompra";

const colchao = CATEGORIAS_CICLO.find((c) => c.key === "colchao")!;
const protetor = CATEGORIAS_CICLO.find((c) => c.key === "protetor")!;
const travesseiro = CATEGORIAS_CICLO.find((c) => c.key === "travesseiro")!;

describe("inferCategoriaCiclo", () => {
  it("reconhece colchão", () => {
    expect(inferCategoriaCiclo("COLCHAO ORQUIDEA D20 LISO 12CMX1,88MX88CM")?.key).toBe("colchao");
  });

  it("protetor de colchão vira categoria própria, não colchão -- keyword mais específica vence", () => {
    expect(inferCategoriaCiclo("PROTETOR DE COLCHAO POLIESTER BEDS 140X190X40CM")?.key).toBe("protetor");
  });

  it("reconhece box", () => {
    expect(inferCategoriaCiclo("BOX 138X188X30 OXFORD PRETO")?.key).toBe("colchao");
  });

  it("reconhece roupeiro/multi-uso", () => {
    expect(inferCategoriaCiclo("MULTI-USO VALDEMOVEIS NATAL S/ CHAVE - CIN")?.key).toBe("roupeiro");
  });

  it("reconhece travesseiro", () => {
    expect(inferCategoriaCiclo("TRAV ORTOBOM AMORE 50X70")?.key).toBe("travesseiro");
  });

  it("descrição sem categoria cíclica reconhecida retorna null", () => {
    expect(inferCategoriaCiclo("FRETE")).toBeNull();
  });

  it("descrição nula retorna null", () => {
    expect(inferCategoriaCiclo(null)).toBeNull();
  });
});

describe("calcularSegmento", () => {
  it("na janela + atrito baixo -> contato direto", () => {
    expect(calcularSegmento(true, false)).toBe("contato_direto");
  });

  it("na janela + atrito alto -> reparar antes", () => {
    expect(calcularSegmento(true, true)).toBe("reparar_antes");
  });

  it("fora da janela + atrito baixo -> nutrir", () => {
    expect(calcularSegmento(false, false)).toBe("nutrir");
  });

  it("fora da janela + atrito alto -> não é lead", () => {
    expect(calcularSegmento(false, true)).toBe("nao_e_lead");
  });
});

describe("sugerirCrossSell", () => {
  it("sugere a categoria associada mais forte que o cliente ainda não tem", () => {
    const afinidade = new Map([
      [colchao.key, [{ categoria: protetor, score: 0.8 }, { categoria: travesseiro, score: 0.3 }]],
    ]);
    // Cliente só tem colchão -- a mais associada (protetor, 0.8) que ele
    // ainda não tem vence.
    expect(sugerirCrossSell(new Set([colchao.key]), afinidade)?.key).toBe("protetor");
  });

  it("pula a associada mais forte se o cliente já tem, cai pra próxima", () => {
    const afinidade = new Map([
      [colchao.key, [{ categoria: protetor, score: 0.8 }, { categoria: travesseiro, score: 0.3 }]],
    ]);
    // Já tem colchão E protetor -- a próxima associada não possuída
    // (travesseiro) é a sugestão.
    expect(sugerirCrossSell(new Set([colchao.key, protetor.key]), afinidade)?.key).toBe("travesseiro");
  });

  it("sem categoria reconhecida nenhuma -> null", () => {
    expect(sugerirCrossSell(new Set(), new Map())).toBeNull();
  });

  it("já tem todas as associadas de tudo que possui -> null", () => {
    const afinidade = new Map([[colchao.key, [{ categoria: protetor, score: 0.8 }]]]);
    expect(sugerirCrossSell(new Set([colchao.key, protetor.key]), afinidade)).toBeNull();
  });
});

describe("extrairCodigosFormaPagamento", () => {
  it("extrai um código só de uma forma simples", () => {
    expect(extrairCodigosFormaPagamento("PIX 500.00")).toEqual(["PIX"]);
  });

  it("extrai TODOS os códigos de um pagamento combinado (achado 16/10/2026: antes só pegava o 1º)", () => {
    expect(extrairCodigosFormaPagamento("CC 350.00 (7x) | R$ 40.00")).toEqual(["CC", "R$"]);
  });

  it("nulo vira lista vazia, não '(sem forma)' (isso é tratado em agruparFormaPagamento)", () => {
    expect(extrairCodigosFormaPagamento(null)).toEqual([]);
  });

  it("sempre maiúsculo, mesmo se o código vier em minúsculo", () => {
    expect(extrairCodigosFormaPagamento("crd 300.00")).toEqual(["CRD"]);
  });
});

describe("contarEventosDeCompra", () => {
  it("lista vazia -> 0 eventos", () => {
    expect(contarEventosDeCompra([])).toBe(0);
  });

  it("uma data só -> 1 evento", () => {
    expect(contarEventosDeCompra(["2026-01-10"])).toBe(1);
  });

  it("2ª data a 7 dias exatos da 1ª -> mesmo evento (limite inclusivo)", () => {
    expect(contarEventosDeCompra(["2026-01-10", "2026-01-17"])).toBe(1);
  });

  it("2ª data a 8 dias da 1ª -> evento novo", () => {
    expect(contarEventosDeCompra(["2026-01-10", "2026-01-18"])).toBe(2);
  });

  it("janela é FIXA a partir da âncora, não encadeada", () => {
    // 01/01 (âncora), 07/01 (+6, mesmo evento), 13/01 (+12 da âncora,
    // mesmo que só +6 da compra anterior) -- deveria abrir evento novo,
    // porque conta a partir da âncora do evento, não da última compra.
    expect(contarEventosDeCompra(["2026-01-01", "2026-01-07", "2026-01-13"])).toBe(2);
  });

  it("datas fora de ordem e duplicadas são tratadas igual (ordena e deduplica antes)", () => {
    expect(contarEventosDeCompra(["2026-01-17", "2026-01-10", "2026-01-10"])).toBe(1);
  });

  it("3 grupos bem separados -> 3 eventos", () => {
    expect(contarEventosDeCompra(["2026-01-01", "2026-03-01", "2026-06-01"])).toBe(3);
  });
});
