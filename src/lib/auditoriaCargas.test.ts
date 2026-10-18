import { describe, expect, it } from "vitest";
import { compararCarga, type ApiPedido, type LinhaAuditoria } from "./auditoriaCargas";

function linha(over: Partial<LinhaAuditoria> = {}): LinhaAuditoria {
  return {
    id: "L1",
    carga: "005453",
    status_entrega_codigo: "3",
    dt_previsao: "2026-10-17",
    dt_retorno: "2026-10-17",
    hr_retorno: "14:13",
    motorista_codigo: "000077",
    veiculo: "JHM9815",
    nota_fiscal: "000054473",
    totvs_deliveries: { pedido: "061524", filial_venda: "212", client_cpf_cnpj: "123" },
    totvs_delivery_carga_itens: [{ item: "01", produto: "P1", quantidade: 1, status_codigo: "3" }],
    ...over,
  };
}

function pedido(over: Partial<ApiPedido["cargas"] extends (infer C)[] | undefined ? C : never> = {}): ApiPedido {
  return {
    order: "061524",
    branch: "212",
    cliente: { documento: "123" },
    cargas: [
      {
        carga: "005453",
        dtPrevisao: "2026-10-17",
        statusEntregaCodigo: "3",
        motorista: { codigo: "000077" },
        veiculo: "JHM9815",
        invoice: "000054473",
        dtRetorno: "17/10/2026",
        hrRetorno: "14:13",
        itens: [{ item: "01", produto: "P1", quantidade: 1, statusCodigo: "3" }],
        ...over,
      },
    ],
  };
}

describe("compararCarga", () => {
  it("tudo igual (data da baixa em dd/mm/aaaa no Protheus) -> nada", () => {
    expect(compararCarga("005453", [pedido()], [linha()])).toEqual([]);
  });

  it("pedido só no Protheus -> faltando, com o documento pra reconsultar", () => {
    const d = compararCarga("005453", [pedido()], []);
    expect(d).toMatchObject([{ tipo: "pedido faltando", pedido: "061524/212", documento: "123" }]);
  });

  it("pedido só no painel -> sobrando, com a linha", () => {
    const d = compararCarga("005453", [], [linha()]);
    expect(d).toMatchObject([{ tipo: "pedido sobrando", linhaId: "L1", documento: "123" }]);
  });

  it("situação, hora e nota diferentes -> uma divergência de cada", () => {
    const d = compararCarga("005453", [pedido({ statusEntregaCodigo: "1", hrRetorno: "14:20", invoice: "000054474" })], [linha()]);
    expect(d.map((x) => x.tipo).sort()).toEqual(["hora da baixa", "nota fiscal", "situação"]);
  });

  it("item com outra quantidade, item a mais e a menos", () => {
    const api = pedido({ itens: [{ item: "01", produto: "P1", quantidade: 2, statusCodigo: "3" }, { item: "02", produto: "P2", quantidade: 1 }] });
    const banco = linha({
      totvs_delivery_carga_itens: [
        { item: "01", produto: "P1", quantidade: 1, status_codigo: "3" },
        { item: "03", produto: "P3", quantidade: 1, status_codigo: null },
      ],
    });
    expect(compararCarga("005453", [api], [banco]).map((x) => x.tipo).sort()).toEqual(["item diferente", "item faltando", "item sobrando"]);
  });

  it("sem o campo itens no Protheus -> não compara itens", () => {
    const api = pedido({ itens: undefined });
    expect(compararCarga("005453", [api], [linha()])).toEqual([]);
  });
});
