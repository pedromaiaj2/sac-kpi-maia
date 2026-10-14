import { describe, expect, it } from "vitest";
import { randomInt } from "node:crypto";
import {
  ALFABETO_CODIGO,
  PADRAO_CODIGO,
  gerarCodigo,
  normalizarCodigo,
  cpfValido,
  mascararCpf,
  statusEfetivo,
  validarEmissao,
  beneficioTitulo,
  mensagemWhatsapp,
  mensagemResultado,
  consultaBloqueada,
  lerNumeroBr,
  nomeCurto,
  primeiroNome,
  type EmissaoInput,
} from "./vouchersCore";

const CPF_OK = "52998224725";

const base: EmissaoInput = {
  clienteNome: "  maria   da silva souza ",
  clienteCpf: "529.982.247-25",
  clienteTelefone: "(83) 98888-7777",
  tipoBeneficio: "percentual_desconto",
  valorBeneficio: 10,
  descricaoBeneficio: null,
  valorMinimoCompra: null,
  motivo: "atraso_entrega",
  observacao: null,
  pedidoOrigem: null,
  dataValidade: "2026-11-13",
};

describe("código do voucher", () => {
  it("tem o formato MAIA-XXXX-XXXX só com o alfabeto sem ambíguos", () => {
    for (let i = 0; i < 2000; i++) {
      const c = gerarCodigo(randomInt);
      expect(c).toMatch(PADRAO_CODIGO);
      expect(c.slice(5)).not.toMatch(/[01OIL]/);
    }
  });

  it("alfabeto tem 31 caracteres e nenhum ambíguo", () => {
    expect(ALFABETO_CODIGO).toHaveLength(31);
    expect(new Set(ALFABETO_CODIGO).size).toBe(31);
    expect(ALFABETO_CODIGO).not.toMatch(/[01OIL]/);
  });

  it("usa o gerador recebido (criptográfico no servidor) para os 8 caracteres", () => {
    const sorteios: number[] = [];
    gerarCodigo((max) => {
      sorteios.push(max);
      return 0;
    });
    expect(sorteios).toEqual(Array(8).fill(31));
  });

  it("praticamente não repete em 20 mil códigos", () => {
    const vistos = new Set(Array.from({ length: 20000 }, () => gerarCodigo(randomInt)));
    expect(vistos.size).toBeGreaterThan(19990);
  });

  it("normaliza o que o caixa digita", () => {
    expect(normalizarCodigo("maia-7k3q-9xp2")).toBe("MAIA-7K3Q-9XP2");
    expect(normalizarCodigo(" 7K3Q 9XP2 ")).toBe("MAIA-7K3Q-9XP2");
    expect(normalizarCodigo("MAIA7K3Q9XP2")).toBe("MAIA-7K3Q-9XP2");
    expect(normalizarCodigo("MAIA-0K3Q-9XP2")).toBeNull();
    expect(normalizarCodigo("MAIA-7K3Q")).toBeNull();
    expect(normalizarCodigo("'; drop table vouchers; --")).toBeNull();
  });
});

describe("CPF", () => {
  it("valida dígitos verificadores", () => {
    expect(cpfValido(CPF_OK)).toBe(true);
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224726")).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
    expect(cpfValido("123")).toBe(false);
  });

  it("máscara esconde os 3 primeiros e os 2 últimos (LGPD)", () => {
    expect(mascararCpf(CPF_OK)).toBe("***.982.247-**");
    expect(mascararCpf(CPF_OK)).not.toContain("529");
    expect(mascararCpf("abc")).toBe("***.***.***-**");
  });
});

describe("status efetivo", () => {
  it("ativo vencido vale como expirado mesmo sem a rotina ter passado", () => {
    expect(statusEfetivo("ativo", "2026-10-13", "2026-10-14")).toBe("expirado");
    expect(statusEfetivo("ativo", "2026-10-14", "2026-10-14")).toBe("ativo");
    expect(statusEfetivo("usado", "2026-01-01", "2026-10-14")).toBe("usado");
    expect(statusEfetivo("cancelado", "2026-01-01", "2026-10-14")).toBe("cancelado");
  });
});

describe("validação da emissão", () => {
  it("aceita e normaliza nome, CPF e telefone", () => {
    const r = validarEmissao(base, "2026-10-14");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dados.clienteNome).toBe("maria da silva souza");
      expect(r.dados.clienteCpf).toBe(CPF_OK);
      expect(r.dados.clienteTelefone).toBe("83988887777");
    }
  });

  it("recusa CPF inválido, validade no passado e desconto sem valor", () => {
    expect(validarEmissao({ ...base, clienteCpf: "123.456.789-00" }, "2026-10-14")).toMatchObject({ ok: false });
    expect(validarEmissao({ ...base, dataValidade: "2026-10-13" }, "2026-10-14")).toMatchObject({ ok: false });
    expect(validarEmissao({ ...base, valorBeneficio: null }, "2026-10-14")).toMatchObject({ ok: false });
    expect(validarEmissao({ ...base, valorBeneficio: 150 }, "2026-10-14")).toMatchObject({ ok: false });
  });

  it("brinde exige descrição; motivo outro exige observação", () => {
    expect(validarEmissao({ ...base, tipoBeneficio: "brinde", valorBeneficio: null }, "2026-10-14")).toMatchObject({ ok: false });
    expect(validarEmissao({ ...base, tipoBeneficio: "brinde", valorBeneficio: null, descricaoBeneficio: "Jogo de copos" }, "2026-10-14")).toMatchObject({
      ok: true,
    });
    expect(validarEmissao({ ...base, motivo: "outro" }, "2026-10-14")).toMatchObject({ ok: false });
  });

  it("frete grátis descarta valor digitado", () => {
    const r = validarEmissao({ ...base, tipoBeneficio: "frete_gratis", valorBeneficio: 99 }, "2026-10-14");
    expect(r.ok && r.dados.valorBeneficio).toBeNull();
  });
});

describe("textos", () => {
  it("benefício em destaque", () => {
    const b = { valorBeneficio: 10, descricaoBeneficio: null, valorMinimo: null };
    expect(beneficioTitulo({ ...b, tipoBeneficio: "percentual_desconto" })).toBe("10% de desconto");
    expect(beneficioTitulo({ ...b, tipoBeneficio: "valor_desconto", valorBeneficio: 150 })).toMatch(/R\$\s?150,00 de desconto/);
    expect(beneficioTitulo({ ...b, tipoBeneficio: "brinde", descricaoBeneficio: "Brinde: jogo de copos" })).toBe("Brinde: jogo de copos");
  });

  it("mensagem de WhatsApp tem código e validade e nenhum CPF", () => {
    const m = mensagemWhatsapp({
      clienteNome: "MARIA DA SILVA",
      codigo: "MAIA-7K3Q-9XP2",
      dataValidade: "2026-11-13",
      tipoBeneficio: "frete_gratis",
      valorBeneficio: null,
      descricaoBeneficio: null,
      valorMinimo: null,
    });
    expect(m).toContain("Olá, Maria!");
    expect(m).toContain("MAIA-7K3Q-9XP2");
    expect(m).toContain("13/11/2026");
    expect(m).not.toMatch(/\d{3}\.\d{3}/);
  });

  it("mensagem de já utilizado mostra data, hora e loja", () => {
    const m = mensagemResultado("usado", { usadoEm: "2026-10-14T13:05:00Z", lojaUso: "Mangabeira" });
    expect(m).toContain("14/10/2026");
    expect(m).toContain("10:05");
    expect(m).toContain("Mangabeira");
  });

  it("nomes", () => {
    expect(primeiroNome("MARIA DA SILVA")).toBe("Maria");
    expect(nomeCurto("maria da silva souza")).toBe("Maria Souza");
  });

  it("número em formato brasileiro", () => {
    expect(lerNumeroBr("1.234,56")).toBe(1234.56);
    expect(lerNumeroBr("10")).toBe(10);
    expect(lerNumeroBr("")).toBeNull();
    expect(lerNumeroBr("abc")).toBeNaN();
  });
});

describe("limite de consultas", () => {
  it("bloqueia com 10 códigos inexistentes ou 60 consultas em 15 min", () => {
    expect(consultaBloqueada({ inexistentes: 9, total: 20 })).toBe(false);
    expect(consultaBloqueada({ inexistentes: 10, total: 10 })).toBe(true);
    expect(consultaBloqueada({ inexistentes: 0, total: 60 })).toBe(true);
  });
});
