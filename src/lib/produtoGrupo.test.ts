import { describe, it, expect } from "vitest";
import { grupoProduto, gruposPorPorte } from "./produtoGrupo";

describe("grupoProduto", () => {
  it("reconhece colchão e base", () => {
    expect(grupoProduto("COLCHAO ORQUIDEA D20 LISO")?.chave).toBe("colchao");
    expect(grupoProduto("SUPER BOX 138X188")?.chave).toBe("colchao");
  });

  it("reconhece sofá", () => {
    expect(grupoProduto("SOFA 3 LUGARES RETRATIL")?.chave).toBe("sofa");
  });

  it("reconhece cadeira", () => {
    expect(grupoProduto("CADEIRA KALUNGA PRETA")?.chave).toBe("cadeira");
  });

  it("reconhece guarda-roupa/armário, inclusive com acento variando", () => {
    expect(grupoProduto("GUARDA ROUPA 6 PORTAS")?.chave).toBe("roupeiro");
    expect(grupoProduto("ARMARIO COZINHA PADUA")?.chave).toBe("cozinha");
  });

  it("abreviações que caíam em outros (18/10/2026)", () => {
    expect(grupoProduto("SUPERBOX CONFORT MOLA ENS.C/AUX DE MOLA ENS 50CMX1,88MX88CM")?.chave).toBe("colchao");
    expect(grupoProduto("UNIBOX GIRASSOL PREMIUM 54CMX1,88MX88CM MARROM")?.chave).toBe("colchao");
    expect(grupoProduto("CM KANSAS - 28CMX1,98MX1,58M PROBEL")?.chave).toBe("colchao");
    expect(grupoProduto("CONJ. 2 CAD VALDEMOVEIS AURORA - GRA96 CIN")?.chave).toBe("cadeira");
    expect(grupoProduto("COMP COZ DAY 5PC 9PT 1GAV FREIJO UV/OFF ACETINADO - POLIMAN")?.chave).toBe("cozinha");
    expect(grupoProduto("KIT MURANO 7PT 2GAV FREIJO UV/OFF ACETINADO - POLIMAN")?.chave).toBe("cozinha");
    expect(grupoProduto("KIT PRATIKA ACO 6 PTS 3VD 2 GAV 105 BRANCO/PRETO  - ITATIAIA")?.chave).toBe("cozinha");
    expect(grupoProduto("FRUTEIRA 2PTS 1GAV - BRANCO - ARAMOVEIS")?.chave).toBe("cozinha");
    expect(grupoProduto("ESCRIVANINHA VALDEMOVEIS OFFICE - CIN/OFF - 6121.230")?.chave).toBe("mesa");
    expect(grupoProduto("KIT 4 ESP. NORTON - ESPELHO HENN")?.chave).toBe("espelho");
  });

  it("medida em cm não vira colchão", () => {
    expect(grupoProduto("CADEIRA 45CM PRETA")?.chave).toBe("cadeira");
  });

  it("descrição sem grupo reconhecido cai em outros", () => {
    expect(grupoProduto("FRETE")?.chave).toBe("outros");
  });

  it("descrição nula cai em outros", () => {
    expect(grupoProduto(null)?.chave).toBe("outros");
  });
});

describe("gruposPorPorte", () => {
  it("soma unidades por grupo dentro de cada porte, do maior pro menor", () => {
    const r = gruposPorPorte([
      { porte: "G", descricao: "COLCHAO D33", unidades: 3 },
      { porte: "G", descricao: "GUARDA ROUPA 6 PORTAS", unidades: 5 },
      { porte: "G", descricao: "SUPERBOX 138", unidades: 4 },
      { porte: "P", descricao: "CADEIRA KALUNGA", unidades: 2 },
    ]);
    expect(r.G).toEqual([
      { chave: "colchao", label: "Colchão e base", unidades: 7 },
      { chave: "roupeiro", label: "Guarda-roupa e armário", unidades: 5 },
    ]);
    expect(r.P).toEqual([{ chave: "cadeira", label: "Cadeira", unidades: 2 }]);
  });
});
