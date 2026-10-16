import { describe, expect, it } from "vitest";
import { gerarRoteiro, type ClienteRecuperacao, type CasoRecuperacao } from "./recuperacao";

function cliente(extra: Partial<ClienteRecuperacao> = {}, casos: CasoRecuperacao[] = []): ClienteRecuperacao {
  return {
    chave: "cpf:12345678901",
    nome: "Maria da Silva",
    cpf: "12345678901",
    telefone: "83988887777",
    casos,
    ultimoCaso: casos[0]?.data ?? "",
    nivel: null,
    comprouDepois: false,
    ultimaCompra: null,
    voucher: null,
    status: "novo",
    causa: null,
    anotacao: null,
    proximoContato: null,
    atualizadoEm: null,
    pontos: 10,
    motivos: [],
    detratores: [],
    ...extra,
  };
}

const estornoPendente: CasoRecuperacao = {
  tipo: "estorno",
  id: "1",
  data: "2026-10-10",
  titulo: "Estorno R$ 1.000,00 · Líder Mangabeira",
  detalhe: "sem estoque",
  valor: 1000,
  pendente: true,
  loja: "Líder Mangabeira",
  situacao: "pendente no financeiro",
};

const estornoRecusado: CasoRecuperacao = {
  ...estornoPendente,
  id: "2",
  pendente: false,
  situacao: "recusado",
};

const detratorNota1: CasoRecuperacao = {
  tipo: "detrator",
  id: "d1",
  data: "2026-09-24",
  titulo: "Detrator SAC · nota 1",
  detalhe: null,
  nota: 1,
  statusEquipe: "nao_contatado",
};

describe("gerarRoteiro", () => {
  it("avisa quando não tem telefone cadastrado", () => {
    const texto = gerarRoteiro(cliente({ telefone: null }));
    expect(texto).toContain("Sem telefone cadastrado");
  });

  it("estorno pendente pede posição concreta sobre o prazo", () => {
    const texto = gerarRoteiro(cliente({}, [estornoPendente]));
    // toLocaleString BRL usa espaço não separável entre "R$" e o valor --
    // não compara a string exata, só o conteúdo.
    expect(texto).toMatch(/1\.000,00/);
    expect(texto).toContain("prazo real");
  });

  it("estorno recusado pergunta se o cliente ainda está sem produto e sem dinheiro", () => {
    const texto = gerarRoteiro(cliente({}, [estornoRecusado]));
    expect(texto).toContain("recusado");
    expect(texto).toContain("sem o produto e sem o dinheiro");
  });

  it("lista todos os casos quando tem mais de um estorno", () => {
    const texto = gerarRoteiro(cliente({}, [estornoPendente, estornoRecusado]));
    expect(texto).toContain("2 casos de estorno");
  });

  it("detrator entra no roteiro com a nota", () => {
    const texto = gerarRoteiro(cliente({}, [detratorNota1]));
    expect(texto).toContain("nota 1");
  });

  it("cliente já em contato com anotação retoma do que já foi registrado, sem abrir como 1º contato", () => {
    const texto = gerarRoteiro(cliente({ status: "em_contato", anotacao: "Já confirmei que ela quer o estorno, não a troca." }));
    expect(texto).toContain("retomando o que já estava sendo tratado");
    expect(texto).toContain("Já confirmei que ela quer o estorno");
    expect(texto).not.toContain("Oi Maria, aqui é o Victor");
  });

  it("sem anotação, mesmo em contato, abre como 1º contato normal", () => {
    const texto = gerarRoteiro(cliente({ status: "em_contato", anotacao: null }));
    expect(texto).toContain("Oi Maria, aqui é o Victor");
  });
});
