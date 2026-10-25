import { describe, expect, it } from "vitest";
import {
  SEM_ZONA,
  dataOdooParaDate,
  filtrarExpedicao,
  formatarDiaIso,
  montarObservacao,
  moverItem,
  somarVolumes,
  volumesOrdenados,
  zonaUnica,
  type EntregaOdoo,
} from "./logisticaTipos";
import { casarPorNome, lerMapaEnv } from "./motoristaMap";

function entrega(p: Partial<EntregaOdoo>): EntregaOdoo {
  return {
    picking_id: 1, nome: "CD/OUT/1", estado: "assigned", cliente: "Fulano", cliente_id: 1, telefone: "", endereco: "Rua A, Manaíra",
    cep: "58038", zona: "Praia", zona_id: 1, data_programada: false, origem: "", pedido: "S001", pedido_id: 1, modo: "entrega",
    nf5922: "10", nf5117: "", legado: false, zae: "", carga_id: false, carga: "", pendencia: false, pendencia_motivo: "", anotacao: "",
    filial_entrega: "", dias: 1, volumes: 2, volumes_por_categoria: { colchao: 1, base: 1 }, itens: [], ...p,
  };
}

describe("filtrarExpedicao", () => {
  const fila = [entrega({ picking_id: 1 }), entrega({ picking_id: 2, zona: "", zona_id: false, modo: "retira_depois", cliente: "José Ação" })];
  const pend = [entrega({ picking_id: 3, pendencia: true, retorno: true })];
  it("filtra por zona, sem zona e modo", () => {
    expect(filtrarExpedicao(fila, pend, { visao: "fila", zona: "Praia", modo: "", busca: "" }).map((e) => e.picking_id)).toEqual([1]);
    expect(filtrarExpedicao(fila, pend, { visao: "fila", zona: SEM_ZONA, modo: "", busca: "" }).map((e) => e.picking_id)).toEqual([2]);
    expect(filtrarExpedicao(fila, pend, { visao: "fila", zona: "", modo: "retira_depois", busca: "" }).map((e) => e.picking_id)).toEqual([2]);
  });
  it("busca sem acento e muda de visão", () => {
    expect(filtrarExpedicao(fila, pend, { visao: "fila", zona: "", modo: "", busca: "acao" }).map((e) => e.picking_id)).toEqual([2]);
    expect(filtrarExpedicao(fila, pend, { visao: "pendencias", zona: "", modo: "", busca: "" }).map((e) => e.picking_id)).toEqual([3]);
    expect(filtrarExpedicao(fila, pend, { visao: "retornos", zona: "", modo: "", busca: "" }).map((e) => e.picking_id)).toEqual([3]);
  });
});

describe("volumes e zona", () => {
  it("soma e ordena por categoria", () => {
    const s = somarVolumes([entrega({}), entrega({ volumes_por_categoria: { movel: 3, colchao: 1 } })]);
    expect(s).toEqual({ colchao: 2, base: 1, movel: 3 });
    expect(volumesOrdenados(s).map((v) => v.categoria)).toEqual(["colchao", "base", "movel"]);
  });
  it("zona única só quando todas iguais", () => {
    expect(zonaUnica([entrega({ zona_id: 4 }), entrega({ zona_id: 4 })])).toBe(4);
    expect(zonaUnica([entrega({ zona_id: 4 }), entrega({ zona_id: 5 })])).toBeNull();
  });
});

describe("utilitários", () => {
  it("move item nos limites", () => {
    expect(moverItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moverItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
  });
  it("datas do Odoo são UTC", () => {
    expect(dataOdooParaDate("2026-10-24 21:10:03")?.toISOString()).toBe("2026-10-24T21:10:03.000Z");
    expect(dataOdooParaDate(false)).toBeNull();
    expect(formatarDiaIso("2026-10-25")).toBe("25/10/2026");
  });
  it("observação prioriza links das fotos no limite de 500", () => {
    const url = "https://x/api/photos/odoo-entregas/a.jpg";
    expect(montarObservacao("", [])).toBeNull();
    expect(montarObservacao("ok", [url])).toBe(`ok | fotos: ${url}`);
    const longa = montarObservacao("a".repeat(600), [url])!;
    expect(longa.length).toBeLessThanOrEqual(500);
    expect(longa.endsWith(url)).toBe(true);
  });
});

describe("de-para motorista", () => {
  it("lê o mapa do env", () => {
    const m = lerMapaEnv('{"Éverton": 12, "Samuel": {"employeeId": 15}, "x": "y"}');
    expect(m.get("everton")).toBe(12);
    expect(m.get("samuel")).toBe(15);
    expect(m.size).toBe(2);
    expect(() => lerMapaEnv("{")).toThrow();
  });
  it("casa por nome e recusa homônimo", () => {
    expect(casarPorNome("joão  silva", [{ id: 3, nome: "JOAO SILVA" }])).toMatchObject({ ok: true, employeeId: 3 });
    expect(casarPorNome("Ana", [{ id: 1, nome: "Ana" }, { id: 2, nome: "ana" }]).ok).toBe(false);
    expect(casarPorNome("Ana", []).ok).toBe(false);
  });
});
