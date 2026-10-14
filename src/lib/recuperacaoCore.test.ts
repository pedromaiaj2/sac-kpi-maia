import { describe, expect, it } from "vitest";
import { chaveCliente, calcularPrioridade, statusInicial, notaEscala5, normalizarNome, type EntradaPrioridade } from "./recuperacaoCore";

const base: EntradaPrioridade = {
  status: "novo",
  proximoContato: null,
  hoje: "2026-10-14",
  estornoPendente: false,
  valorEstornos: 0,
  piorNota: null,
  diasDesdeUltimoCaso: 200,
  nivel: null,
  temDetrator: false,
  temEstorno: false,
};

describe("chave do cliente", () => {
  it("CPF primeiro, depois os 8 últimos dígitos do telefone, depois o nome", () => {
    expect(chaveCliente({ cpf: "529.982.247-25", telefone: "83988887777" })).toBe("cpf:52998224725");
    expect(chaveCliente({ cpf: "123", telefone: "(83) 9 8888-7777" })).toBe("tel:88887777");
    expect(chaveCliente({ telefone: "5583988887777" })).toBe(chaveCliente({ telefone: "83 88887777" }));
    expect(chaveCliente({ nome: "José da Silva (repetida)" })).toBe("nome:JOSE DA SILVA");
    expect(chaveCliente({})).toBeNull();
  });

  it("normaliza nome sem acento e sem sufixo entre parênteses", () => {
    expect(normalizarNome("  Ana   Conceição (NF) ")).toBe("ANA CONCEICAO");
  });
});

describe("prioridade", () => {
  it("encerrado vai para o fim", () => {
    expect(calcularPrioridade({ ...base, status: "recuperado", estornoPendente: true }).pontos).toBe(0);
    expect(calcularPrioridade({ ...base, status: "nao_contatar", piorNota: 1 }).pontos).toBe(0);
  });

  it("estorno pendente + nota 1 + recente passa na frente de caso antigo", () => {
    const urgente = calcularPrioridade({ ...base, estornoPendente: true, valorEstornos: 1500, piorNota: 1, diasDesdeUltimoCaso: 3, temDetrator: true, temEstorno: true });
    const antigo = calcularPrioridade({ ...base, piorNota: 2, diasDesdeUltimoCaso: 400, temDetrator: true });
    expect(urgente.pontos).toBeGreaterThan(antigo.pontos);
    expect(urgente.motivos).toEqual(expect.arrayContaining(["estorno pendente", "nota 1 no NPS", "caso desta semana", "detrator e estorno"]));
  });

  it("contato atrasado sobe; contato marcado para o futuro desce", () => {
    const atrasado = calcularPrioridade({ ...base, status: "em_contato", proximoContato: "2026-10-10" });
    const futuro = calcularPrioridade({ ...base, status: "em_contato", proximoContato: "2026-10-20" });
    const sem = calcularPrioridade({ ...base, status: "em_contato" });
    expect(atrasado.pontos).toBeGreaterThan(sem.pontos);
    expect(futuro.pontos).toBeLessThanOrEqual(sem.pontos);
    expect(atrasado.motivos[0]).toContain("atrasado");
  });

  it("cliente Diamante pesa mais que Bronze", () => {
    expect(calcularPrioridade({ ...base, nivel: "diamante" }).pontos).toBeGreaterThan(calcularPrioridade({ ...base, nivel: "bronze" }).pontos);
  });
});

describe("status", () => {
  it("cliente sem nada salvo herda o status mais avançado dos detratores", () => {
    expect(statusInicial([])).toBe("novo");
    expect(statusInicial(["nao_contatado", "em_contato"])).toBe("em_contato");
    expect(statusInicial(["sem_resposta"])).toBe("aguardando_cliente");
    expect(statusInicial(["em_contato", "recuperado"])).toBe("recuperado");
  });

  it("nota 0-10 vira escala 1-5", () => {
    expect(notaEscala5(2, "1-5")).toBe(2);
    expect(notaEscala5(0, "0-10")).toBe(1);
    expect(notaEscala5(6, "0-10")).toBe(3);
  });
});
