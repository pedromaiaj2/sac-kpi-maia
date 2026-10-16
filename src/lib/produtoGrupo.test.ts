import { describe, it, expect } from "vitest";
import { grupoProduto } from "./produtoGrupo";

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

  it("descrição sem grupo reconhecido cai em outros", () => {
    expect(grupoProduto("FRETE")?.chave).toBe("outros");
  });

  it("descrição nula cai em outros", () => {
    expect(grupoProduto(null)?.chave).toBe("outros");
  });
});
