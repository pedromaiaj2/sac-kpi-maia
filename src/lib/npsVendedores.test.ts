import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseAdmin", () => ({ getSupabaseAdmin: vi.fn() }));

const { resumirNps, agruparPorVendedor } = await import("./npsVendedores");

const linha = (score: number | null, seller_id: string | null, seller_name: string, branch = "205") => ({
  score,
  totvs_orders: { seller_id, seller_name, branch, issue_date: "2026-10-20" },
});

describe("resumirNps", () => {
  it("conta só quem respondeu no NPS e na média, e todas as enviadas na taxa", () => {
    const r = resumirNps([5, 4, 3, 1, null, null]);
    expect(r).toMatchObject({ enviadas: 6, respostas: 4, promotores: 2, neutros: 1, detratores: 1, nps: 25, media: 3.25 });
    expect(r.taxaResposta).toBeCloseTo(0.667, 3);
  });

  it("sem resposta, NPS e média ficam nulos", () => {
    expect(resumirNps([null, null])).toMatchObject({ enviadas: 2, respostas: 0, nps: null, media: null });
  });
});

describe("agruparPorVendedor", () => {
  it("agrupa pelo código do Protheus, junta as filiais e ordena pelo NPS", () => {
    const v = agruparPorVendedor([
      linha(2, "L1", "Ana"),
      linha(5, "L2", "Bruno", "207"),
      linha(5, "L2", "BRUNO", "209"),
      linha(1, "L1", "Ana"),
    ]);
    expect(v.map((x) => [x.codigo, x.nps, x.filiais])).toEqual([
      ["L2", 100, ["207", "209"]],
      ["L1", -100, ["205"]],
    ]);
  });
});
