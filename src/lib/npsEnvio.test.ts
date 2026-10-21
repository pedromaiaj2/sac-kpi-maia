import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./totvsSync", () => ({ backfillClientCodes: vi.fn(async () => ({ checked: 0, upserted: 0, errors: [] })) }));
vi.mock("./supabaseBatch", () => ({ fetchInBatches: vi.fn() }));
vi.mock("./ghlClient", () => ({ upsertGhlContact: vi.fn(), addContactTag: vi.fn() }));

const { enviarNpsPorPedido } = await import("./npsEnvio");
const { fetchInBatches } = await import("./supabaseBatch");
const { upsertGhlContact, addContactTag } = await import("./ghlClient");

function adminFalso(reservas: Record<string, boolean>) {
  const apagados: string[] = [];
  const gravadas: Record<string, unknown>[] = [];
  const admin = {
    from: () => ({
      upsert: (linha: { order_id: string }) => ({
        _gravou: gravadas.push(linha),
        select: async () => ({ data: reservas[linha.order_id] === false ? [] : [{ order_id: linha.order_id }], error: null }),
      }),
      delete: () => ({
        eq: async (_col: string, id: string) => {
          apagados.push(id);
          return { error: null };
        },
      }),
    }),
  };
  return { admin: admin as never, apagados, gravadas };
}

const candidato = (id: string, client: string) => ({ id, client_id: client, client_name: `Cliente ${client}` });

describe("enviarNpsPorPedido", () => {
  beforeEach(() => {
    vi.mocked(fetchInBatches).mockResolvedValue([
      { protheus_code: "B", phone1: "83999990001" },
      { protheus_code: "C", phone1: "83999990002" },
    ]);
    vi.mocked(upsertGhlContact).mockImplementation(async (phone) => `contato-${phone}`);
    vi.mocked(addContactTag).mockResolvedValue(true);
    vi.mocked(addContactTag).mockClear();
  });

  it("pula quem não tem telefone sem ocupar vaga e para no teto de envios", async () => {
    const { admin } = adminFalso({});
    const r = await enviarNpsPorPedido(admin, {
      tabela: "venda_nps",
      tag: "nps-atendimento-loja",
      rotulo: "venda-nps",
      candidatos: [candidato("p1", "A"), candidato("p2", "B"), candidato("p3", "C")],
      maxEnvios: 1,
      maxBackfill: 20,
    });
    expect(r).toEqual({ enrolled: 1, semTelefone: 1, errors: [], avisos: [] });
    expect(addContactTag).toHaveBeenCalledTimes(1);
  });

  it("não marca no GHL quando outra execução já reservou o pedido", async () => {
    const { admin } = adminFalso({ p2: false });
    const r = await enviarNpsPorPedido(admin, {
      tabela: "venda_nps",
      tag: "nps-atendimento-loja",
      rotulo: "venda-nps",
      candidatos: [candidato("p2", "B")],
      maxEnvios: 50,
      maxBackfill: 20,
    });
    expect(r.enrolled).toBe(0);
    expect(addContactTag).not.toHaveBeenCalled();
  });

  it("desfaz a reserva se a tag falhar, pra tentar de novo na próxima rodada", async () => {
    vi.mocked(addContactTag).mockResolvedValue(false);
    const { admin, apagados } = adminFalso({});
    const r = await enviarNpsPorPedido(admin, {
      tabela: "venda_nps",
      tag: "nps-atendimento-loja",
      rotulo: "venda-nps",
      candidatos: [candidato("p2", "B")],
      maxEnvios: 50,
      maxBackfill: 20,
    });
    expect(r.enrolled).toBe(0);
    expect(r.errors).toEqual([]);
    expect(r.avisos).toEqual(["venda-nps p2: falha ao aplicar a tag no GHL"]);
    expect(apagados).toEqual(["p2"]);
  });

  it("com subconta, grava ghl_location_id e usa a conta no contato e na tag", async () => {
    const { admin, gravadas } = adminFalso({});
    const conta = { token: "tk", locationId: "loc-lojas-maia" };
    await enviarNpsPorPedido(admin, {
      tabela: "venda_nps",
      tag: "nps-pos-atendimento-loja",
      rotulo: "venda-nps",
      candidatos: [candidato("p2", "B")],
      maxEnvios: 50,
      maxBackfill: 20,
      conta,
    });
    expect(gravadas[0]).toMatchObject({ order_id: "p2", ghl_location_id: "loc-lojas-maia" });
    expect(upsertGhlContact).toHaveBeenLastCalledWith("83999990001", "Cliente B", conta);
    expect(addContactTag).toHaveBeenLastCalledWith("contato-83999990001", "nps-pos-atendimento-loja", conta);
  });
});
