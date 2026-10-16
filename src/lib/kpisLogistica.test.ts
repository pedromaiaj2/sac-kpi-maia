import { describe, expect, it } from "vitest";
import {
  calcularVariacao,
  gradeVeiculos,
  periodoAnterior,
  produtosPorMotorista,
  resumirLogistica,
  volumesPorDia,
  type CargaEntregas,
  type KpisEntregas,
  type MotoristaEntregas,
} from "./kpisLogistica";

function carga(carga: string, dia: string, P: number, M: number, G: number, naoClassificado = 0, tipoVeiculo = "Caminhão"): CargaEntregas {
  return {
    carga, dia, tipo: "Entrega", veiculo: null, tipoVeiculo, tipoVeiculoOrigem: "placa", motorista: null,
    vinculo: "Próprio", transportadora: "TRANSP. LOJAS MAIA", insucessosPorMotivo: {},
    pedidos: 2, entregues: 2, parciais: 0, naoEntregues: 0, canceladas: 0,
    volumes: { P, M, G, naoClassificado },
  };
}

function motorista(visitas: number, entregues: number, extra: Partial<MotoristaEntregas> = {}): MotoristaEntregas {
  return {
    codigo: "1", nome: "X", vinculo: "Próprio", transportadora: "TRANSP. LOJAS MAIA",
    cargas: 1, visitas, entregues, entregasRealizadas: entregues,
    entregasPorVeiculo: { Carro: 0, "Caminhão": entregues, "Não identificado": 0 },
    insucessos: { total: 0, cliente: 0, logistica: 0, cd: 0, outros: 0 },
    parciais: 0,
    assistencias: { total: 0, porCarga: 0, porProduto: 0, porCliente: 0, porErroMotorista: 0, porAvariaTransporte: 0 },
    indiceVolta: null, indiceVoltaLogistica: null,
    ...extra,
  };
}

const base: KpisEntregas = {
  periodo: { de: "2026-10-01", ate: "2026-10-02", tipo: null, tipoVeiculo: null, vinculo: null },
  cargasPorDia: [{ dia: "2026-10-01", cargas: 2, pedidos: 4 }, { dia: "2026-10-02", cargas: 1, pedidos: 2 }],
  cargas: [carga("A", "2026-10-02", 1, 0, 3), carga("B", "2026-10-01", 2, 1, 0, 1), carga("C", "2026-10-01", 0, 2, 2, 0, "Carro")],
  motoristas: [
    motorista(80, 60, {
      insucessos: { total: 10, cliente: 7, logistica: 1, cd: 2, outros: 0 },
      parciais: 2,
      assistencias: { total: 4, porCarga: 1, porProduto: 2, porCliente: 1, porErroMotorista: 1, porAvariaTransporte: 1 },
      entregasPorVeiculo: { Carro: 0, "Caminhão": 55, "Não identificado": 5 },
    }),
    motorista(20, 20, { vinculo: "Terceirizado", entregasPorVeiculo: { Carro: 5, "Caminhão": 15, "Não identificado": 0 } }),
  ],
  entregasPorVeiculo: [
    { vinculo: "Próprio", tipoVeiculo: "Caminhão", cargas: 2, pedidos: 4, entregas: 60 },
    { vinculo: "Próprio", tipoVeiculo: "Carro", cargas: 1, pedidos: 2, entregas: 5 },
    { vinculo: "Próprio", tipoVeiculo: "Não identificado", cargas: 0, pedidos: 0, entregas: 0 },
    { vinculo: "Terceirizado", tipoVeiculo: "Caminhão", cargas: 0, pedidos: 0, entregas: 15 },
  ],
  motivosInsucesso: [{ codigo: "C01", descricao: "Cliente Ausente", categoria: "Cliente", total: 7 }],
  assistencias: [],
  assistenciasPeriodo: { total: 6, vinculadas: 4 },
  ocorrencias: {},
  insucessos: [],
  parciais: [],
  produtosPorte: [],
  regrasPorte: [],
  veiculosPorDia: [
    { dia: "2026-10-01", vinculo: "Próprio", tipoVeiculo: "Caminhão", veiculos: 2 },
    { dia: "2026-10-01", vinculo: "Próprio", tipoVeiculo: "Carro", veiculos: 1 },
    { dia: "2026-10-02", vinculo: "Próprio", tipoVeiculo: "Caminhão", veiculos: 1 },
    { dia: "2026-10-02", vinculo: "Terceirizado", tipoVeiculo: "Caminhão", veiculos: 1 },
    { dia: "2026-10-02", vinculo: "Próprio", tipoVeiculo: "Não identificado", veiculos: 1 },
  ],
};

describe("resumirLogistica", () => {
  it("soma volumes, pedidos e calcula os índices ponderados por visita", () => {
    const r = resumirLogistica(base);
    expect(r).toMatchObject({ cargas: 3, dias: 2, pedidos: 6, visitas: 100, entregues: 80, insucessosCd: 2 });
    expect(r.volumes).toEqual({ P: 3, M: 3, G: 5, naoClassificado: 1, total: 12 });
    expect(r.indiceVolta).toBeCloseTo(12 / 100);
    expect(r.indiceVoltaLogistica).toBeCloseTo(1 / 100);
    expect(r).toMatchObject({ entregasRealizadas: 80, entregasCarro: 5, entregasCaminhao: 70, entregasNaoIdentificado: 5 });
    // 2 dias com carga: (2 + 1 + 1) caminhões e 1 Strada
    expect(r.caminhoesDia).toBeCloseTo(4 / 2);
    expect(r.stradasDia).toBeCloseTo(1 / 2);
    expect(r.naoIdentificadosDia).toBeCloseTo(1 / 2);
    // Soma das causas bate com o numerador de indiceVolta (12/100 acima).
    expect(r.causasVolta).toEqual({
      insucessoCliente: 7,
      insucessoLogistica: 1,
      insucessoCd: 2,
      insucessoOutros: 0,
      parciais: 2,
    });
  });

  it("sem visitas, índices nulos em vez de divisão por zero", () => {
    const r = resumirLogistica({ ...base, motoristas: [] });
    expect(r.indiceVolta).toBeNull();
    expect(r.indiceVoltaLogistica).toBeNull();
  });
});

describe("volumesPorDia", () => {
  it("agrupa as cargas por dia, em ordem crescente", () => {
    expect(volumesPorDia(base)).toEqual([
      { dia: "2026-10-01", cargas: 2, caminhoes: 2, stradas: 1, naoIdentificados: 0, P: 2, M: 3, G: 2, naoClassificado: 1 },
      { dia: "2026-10-02", cargas: 1, caminhoes: 2, stradas: 0, naoIdentificados: 1, P: 1, M: 0, G: 3, naoClassificado: 0 },
    ]);
  });
});

describe("periodoAnterior", () => {
  it("devolve o período imediatamente anterior, com a mesma duração", () => {
    expect(periodoAnterior("2026-10-01", "2026-10-09")).toEqual({ de: "2026-09-22", ate: "2026-09-30" });
  });

  it("funciona pra 1 dia só", () => {
    expect(periodoAnterior("2026-10-05", "2026-10-05")).toEqual({ de: "2026-10-04", ate: "2026-10-04" });
  });

  it("atravessa virada de mês/ano corretamente", () => {
    expect(periodoAnterior("2026-01-01", "2026-01-03")).toEqual({ de: "2025-12-29", ate: "2025-12-31" });
  });
});

describe("calcularVariacao", () => {
  it("índice de volta caiu (menor é melhor) -- melhorou", () => {
    const v = calcularVariacao(0.1, 0.15, true);
    expect(v).toMatchObject({ atual: 0.1, anterior: 0.15, melhorou: true });
    expect(v.delta).toBeCloseTo(-0.05);
  });

  it("índice de volta subiu (menor é melhor) -- piorou", () => {
    const v = calcularVariacao(0.21, 0.19, true);
    expect(v).toMatchObject({ atual: 0.21, anterior: 0.19, melhorou: false });
    expect(v.delta).toBeCloseTo(0.02);
  });

  it("contagem bruta (cargas) sobe -- sem julgamento de melhor/pior", () => {
    expect(calcularVariacao(296, 284)).toEqual({ atual: 296, anterior: 284, delta: 12, melhorou: null });
  });

  it("sem período anterior pra comparar -- delta e melhorou nulos", () => {
    expect(calcularVariacao(0.1, null, true)).toEqual({ atual: 0.1, anterior: null, delta: null, melhorou: null });
  });
});

describe("gradeVeiculos", () => {
  it("monta vínculo x veículo com totais por linha e a linha Total", () => {
    const g = gradeVeiculos(base);
    expect(g.map((l) => l.vinculo)).toEqual(["Próprio", "Terceirizado", "Total"]);
    expect(g[0]).toEqual({
      vinculo: "Próprio",
      Carro: { cargas: 1, pedidos: 2, entregas: 5, produtos: 4, veiculos: 1 },
      "Caminhão": { cargas: 2, pedidos: 4, entregas: 60, produtos: 8, veiculos: 3 },
      "Não identificado": { cargas: 0, pedidos: 0, entregas: 0, produtos: 0, veiculos: 1 },
      total: { cargas: 3, pedidos: 6, entregas: 65, produtos: 12, veiculos: 5 },
    });
    expect(g[2].Carro.entregas).toBe(5);
    expect(g[2]["Caminhão"].entregas).toBe(75);
    expect(g[2].total).toEqual({ cargas: 3, pedidos: 6, entregas: 80, produtos: 12, veiculos: 6 });
    expect(g[0]["Não identificado"].veiculos).toBe(1);
  });

  it("vínculos sem nada no período aparecem zerados; Sem vínculo só se existir", () => {
    const g = gradeVeiculos({
      ...base,
      entregasPorVeiculo: [{ vinculo: "Sem vínculo", tipoVeiculo: "Caminhão", cargas: 1, pedidos: 3, entregas: 0 }],
      veiculosPorDia: [],
    });
    expect(g.map((l) => l.vinculo)).toEqual(["Próprio", "Terceirizado", "Sem vínculo", "Total"]);
    expect(g[1].total).toEqual({ cargas: 0, pedidos: 0, entregas: 0, produtos: 0, veiculos: 0 });
  });
});

describe("produtosPorMotorista", () => {
  it("soma as unidades das cargas de cada motorista", () => {
    const comMotorista = (c: ReturnType<typeof carga>, codigo: string) => ({ ...c, motorista: { codigo, nome: null } });
    const m = produtosPorMotorista([comMotorista(base.cargas[0], "1"), comMotorista(base.cargas[1], "1"), comMotorista(base.cargas[2], "2"), base.cargas[0]]);
    expect(m).toEqual({ "1": 8, "2": 4 });
  });
});
