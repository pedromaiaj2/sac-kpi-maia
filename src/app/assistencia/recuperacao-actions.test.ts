import { beforeEach, describe, expect, it, vi } from "vitest";

// A Central de Recuperação é só do Victor: outro admin também é barrado.
const bancoTocado = vi.fn();
vi.mock("@/lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => {
    bancoTocado();
    throw new Error("BANCO");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
const perfil = { atual: null as null | { id: string; fullName: string; role: string; storeId: null } };
vi.mock("@/lib/dal", () => ({
  getProfile: async () => {
    if (!perfil.atual) throw new Error("REDIRECT /assistencia/login");
    return perfil.atual;
  },
}));

const { salvarRecuperacaoAction, historicoRecuperacaoAction } = await import("./recuperacao-actions");
const { RECUPERACAO_DONO_ID } = await import("@/lib/recuperacaoCore");

function form() {
  const f = new FormData();
  f.set("chave", "cpf:52998224725");
  f.set("status", "em_contato");
  return f;
}

beforeEach(() => {
  bancoTocado.mockClear();
  perfil.atual = null;
});

describe("Central de Recuperação", () => {
  it("sem login vai para o login", async () => {
    await expect(salvarRecuperacaoAction(undefined, form())).rejects.toThrow(/REDIRECT/);
    expect(bancoTocado).not.toHaveBeenCalled();
  });

  it("outro admin é barrado", async () => {
    perfil.atual = { id: "672788d9-127f-4193-a363-5459954c8d1b", fullName: "Outro admin", role: "admin", storeId: null };
    await expect(salvarRecuperacaoAction(undefined, form())).rejects.toThrow(/só do Victor/);
    await expect(historicoRecuperacaoAction("cpf:52998224725")).rejects.toThrow(/só do Victor/);
    expect(bancoTocado).not.toHaveBeenCalled();
  });

  it("o dono passa; dado inválido nem chega no banco", async () => {
    perfil.atual = { id: RECUPERACAO_DONO_ID, fullName: "Victor", role: "admin", storeId: null };
    const f = form();
    f.set("status", "qualquer");
    await expect(salvarRecuperacaoAction(undefined, f)).resolves.toEqual({ error: "Dados inválidos." });
    expect(bancoTocado).not.toHaveBeenCalled();
    await expect(salvarRecuperacaoAction(undefined, form())).rejects.toThrow("BANCO");
    expect(bancoTocado).toHaveBeenCalled();
  });
});
