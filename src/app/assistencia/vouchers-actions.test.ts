import { beforeEach, describe, expect, it, vi } from "vitest";

// Permissões dos vouchers checadas no servidor: as actions são chamadas
// direto (como um POST forjado faria), sem tela nenhuma na frente.

const bancoTocado = vi.fn();
vi.mock("@/lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => {
    bancoTocado();
    throw new Error("BANCO");
  },
}));

const cookieCaixa = { value: undefined as string | undefined };
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieCaixa.value ? { value: cookieCaixa.value } : undefined) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const perfil = { atual: null as null | { id: string; fullName: string; role: string; storeId: null } };
vi.mock("@/lib/dal", async () => {
  const real = await vi.importActual<typeof import("@/lib/dal")>("@/lib/dal");
  return {
    ...real,
    // Sem login de equipe, o getProfile real manda pro login (redirect).
    getProfile: async () => {
      if (!perfil.atual) throw new Error("REDIRECT /assistencia/login");
      return perfil.atual;
    },
  };
});

vi.mock("@/lib/caixaAuth", () => ({
  CAIXA_COOKIE_NAME: "encomenda_caixa_session",
  verifyCaixaSession: (t: string | undefined) => (t === "sessao-valida" ? "Ana Caixa" : null),
}));
vi.mock("@/lib/caixas", () => ({ getCaixaStoreId: async (nome: string) => (nome === "Ana Caixa" ? "03" : null) }));

const { emitirVoucherAction, cancelarVoucherAction, buscarClienteAction, consultarVoucherAction, baixarVoucherAction } = await import("./vouchers-actions");

function formEmissao() {
  const f = new FormData();
  f.set("cliente_nome", "Maria da Silva");
  f.set("cliente_cpf", "52998224725");
  f.set("tipo_beneficio", "frete_gratis");
  f.set("motivo", "atraso_entrega");
  f.set("data_validade", "2099-12-31");
  return f;
}

beforeEach(() => {
  bancoTocado.mockClear();
  perfil.atual = null;
  cookieCaixa.value = undefined;
});

describe("rotas de admin", () => {
  it("caixa logado (sem login de equipe) não emite, não cancela, não busca cliente", async () => {
    cookieCaixa.value = "sessao-valida";
    await expect(emitirVoucherAction(undefined, formEmissao())).rejects.toThrow(/REDIRECT \/assistencia\/login/);
    const c = new FormData();
    c.set("id", "00000000-0000-0000-0000-000000000000");
    c.set("motivo_cancelamento", "teste");
    await expect(cancelarVoucherAction(undefined, c)).rejects.toThrow(/REDIRECT/);
    await expect(buscarClienteAction("52998224725")).rejects.toThrow(/REDIRECT/);
    expect(bancoTocado).not.toHaveBeenCalled();
  });

  it("equipe sem papel admin (SAC, assistência, supervisão) é barrada", async () => {
    for (const role of ["sac", "assistencia", "supervisao"]) {
      perfil.atual = { id: "u1", fullName: "Fulano", role, storeId: null };
      await expect(emitirVoucherAction(undefined, formEmissao())).rejects.toThrow(/não permitida/);
      await expect(buscarClienteAction("52998224725")).rejects.toThrow(/não permitida/);
    }
    expect(bancoTocado).not.toHaveBeenCalled();
  });

  it("admin passa da checagem e chega no banco", async () => {
    perfil.atual = { id: "u1", fullName: "Victor", role: "admin", storeId: null };
    await expect(emitirVoucherAction(undefined, formEmissao())).rejects.toThrow("BANCO");
    expect(bancoTocado).toHaveBeenCalled();
  });

  it("admin com dado inválido nem chega no banco", async () => {
    perfil.atual = { id: "u1", fullName: "Victor", role: "admin", storeId: null };
    const f = formEmissao();
    f.set("cliente_cpf", "12345678900");
    await expect(emitirVoucherAction(undefined, f)).resolves.toEqual({ error: expect.stringMatching(/CPF inválido/) });
    expect(bancoTocado).not.toHaveBeenCalled();
  });
});

describe("rotas do caixa", () => {
  it("sem sessão de caixa não consulta nem dá baixa (mesmo sendo admin)", async () => {
    perfil.atual = { id: "u1", fullName: "Victor", role: "admin", storeId: null };
    await expect(consultarVoucherAction("MAIA-7K3Q-9XP2")).resolves.toEqual({ erro: expect.stringMatching(/login de caixa/) });
    await expect(baixarVoucherAction("MAIA-7K3Q-9XP2", "529", "123")).resolves.toEqual({ erro: expect.stringMatching(/login de caixa/) });
    expect(bancoTocado).not.toHaveBeenCalled();
  });

  it("sessão forjada/expirada é recusada", async () => {
    cookieCaixa.value = "assinatura-falsa";
    await expect(consultarVoucherAction("MAIA-7K3Q-9XP2")).resolves.toEqual({ erro: expect.any(String) });
    expect(bancoTocado).not.toHaveBeenCalled();
  });

  it("baixa exige 3 dígitos do CPF e o cupom antes de ir ao banco", async () => {
    cookieCaixa.value = "sessao-valida";
    await expect(baixarVoucherAction("MAIA-7K3Q-9XP2", "52", "123")).resolves.toEqual({ erro: expect.stringMatching(/3 primeiros/) });
    await expect(baixarVoucherAction("MAIA-7K3Q-9XP2", "529", "  ")).resolves.toEqual({ erro: expect.stringMatching(/cupom/) });
    expect(bancoTocado).not.toHaveBeenCalled();
  });

  it("caixa válido passa da checagem e chega no banco", async () => {
    cookieCaixa.value = "sessao-valida";
    await expect(consultarVoucherAction("MAIA-7K3Q-9XP2")).rejects.toThrow("BANCO");
    expect(bancoTocado).toHaveBeenCalled();
  });
});
