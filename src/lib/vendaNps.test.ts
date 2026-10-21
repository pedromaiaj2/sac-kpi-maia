import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseAdmin", () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("./npsEnvio", () => ({ enviarNpsPorPedido: vi.fn(), pedidosComNps: vi.fn() }));
vi.mock("./recompra", () => ({ listClientesNaoContatar: vi.fn() }));

const { priorizarVendas } = await import("./vendaNps");

describe("priorizarVendas", () => {
  it("põe na frente quem vence a janela hoje e mantém o resto na ordem da consulta", () => {
    const vendas = [
      { id: "hoje-2", issue_date: "2026-10-21" },
      { id: "hoje-1", issue_date: "2026-10-21" },
      { id: "ontem", issue_date: "2026-10-20" },
      { id: "vence-a", issue_date: "2026-10-19" },
      { id: "vence-b", issue_date: "2026-10-19" },
    ];
    expect(priorizarVendas(vendas, "2026-10-19").map((v) => v.id)).toEqual(["vence-a", "vence-b", "hoje-2", "hoje-1", "ontem"]);
  });
});
