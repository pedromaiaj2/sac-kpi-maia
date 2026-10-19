import { describe, expect, it } from "vitest";
import { grupoDaCarga, minutosDesde, regioesVisiveis, resumirRotas, situacaoBaixa, type CargaRota, formatarDocumento } from "./rotasDoDiaCore";

function carga(over: Partial<CargaRota>): CargaRota {
  return {
    carga: "005454", dia: "2026-10-17", ultimaBaixaDia: "2026-10-17", statusCodigo: "5", status: "Em Rota", tipo: "Entrega",
    motorista: { codigo: "000003", nome: "RONALDO" }, veiculo: "FORD", tipoVeiculo: "Caminhão",
    vinculo: "Terceirizado", transportadora: "RONALDO TRANSPORTES", regioes: ["Zona Sul"],
    notas: 20, entregues: 3, parciais: 0, naoEntregues: 0, canceladas: 0, pendentes: 17,
    primeiraBaixa: "07:11", ultimaBaixa: "08:20", volumes: { P: 7, M: 27, G: 21, naoClassificado: 3 },
    insucessos: [], notasLista: [],
    ...over,
  };
}

describe("rotas do dia", () => {
  it("grupo: sem motorista fica no CD; sem vínculo com motorista conta como próprio", () => {
    expect(grupoDaCarga(carga({}))).toBe("Terceirizado");
    expect(grupoDaCarga(carga({ vinculo: "Próprio" }))).toBe("Próprio");
    expect(grupoDaCarga(carga({ vinculo: null }))).toBe("Próprio");
    expect(grupoDaCarga(carga({ motorista: null, vinculo: null }))).toBe("No CD");
  });

  it("resumo soma notas e mede o andamento pelas notas com resultado", () => {
    const r = resumirRotas([
      carga({}),
      carga({ carga: "005453", notas: 10, entregues: 6, naoEntregues: 2, canceladas: 1, pendentes: 1 }),
      carga({ carga: "005456", statusCodigo: "1", notas: 5, entregues: 0, pendentes: 5 }),
    ]);
    expect(r).toEqual({ cargas: 3, emRota: 2, notas: 35, entregues: 9, parciais: 0, naoEntregues: 3, pendentes: 23, andamento: 12 / 35 });
    expect(resumirRotas([]).andamento).toBeNull();
  });

  it("esconde 'Sem Regiao'", () => {
    expect(regioesVisiveis(["Sem Regiao", "Zona Sul"])).toEqual(["Zona Sul"]);
  });

  it("minutos desde a última baixa", () => {
    expect(minutosDesde("08:20", "09:05")).toBe(45);
    expect(minutosDesde(null, "09:05")).toBeNull();
    expect(minutosDesde("10:00", "09:05")).toBeNull();
  });
});

describe("situacaoBaixa", () => {
  const base = { statusCodigo: "5", pendentes: 4, ultimaBaixa: "08:20", ultimaBaixaDia: "2026-10-17", dia: "2026-10-17" };

  it("mesmo dia: minutos desde a baixa e parada só passando de 1h30", () => {
    expect(situacaoBaixa(base, "2026-10-17", "09:30")).toEqual({ desde: 70, parada: false, texto: "última baixa 08:20" });
    expect(situacaoBaixa(base, "2026-10-17", "10:00").parada).toBe(true);
  });

  it("carga de ontem ainda em rota: baixa com data e parada", () => {
    expect(situacaoBaixa({ ...base, dia: "2026-10-16", ultimaBaixaDia: "2026-10-16", ultimaBaixa: "17:50" }, "2026-10-17", "08:00")).toEqual({
      desde: null,
      parada: true,
      texto: "última baixa 16/10 17:50",
    });
    expect(situacaoBaixa({ ...base, dia: "2026-10-16", ultimaBaixa: null, ultimaBaixaDia: null }, "2026-10-17", "08:00").texto).toBe("sem baixa desde 16/10");
  });

  it("encerrada ou sem pendência nunca está parada", () => {
    expect(situacaoBaixa({ ...base, statusCodigo: "6" }, "2026-10-17", "15:00").parada).toBe(false);
    expect(situacaoBaixa({ ...base, pendentes: 0 }, "2026-10-17", "15:00").parada).toBe(false);
  });
});

describe("formatarDocumento", () => {
  it("CPF, CNPJ e vazio", () => {
    expect(formatarDocumento("09787952450")).toBe("097.879.524-50");
    expect(formatarDocumento("12345678000199")).toBe("12.345.678/0001-99");
    expect(formatarDocumento(null)).toBeNull();
    expect(formatarDocumento("123")).toBe("123");
  });
});
