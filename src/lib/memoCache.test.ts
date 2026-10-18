import { describe, expect, it, vi } from "vitest";
import { memoizeWithTtl } from "./memoCache";

describe("memoizeWithTtl", () => {
  it("chamadas simultâneas da mesma chave dividem uma consulta só", async () => {
    let resolver: (v: number) => void = () => {};
    const fn = vi.fn<(k: string) => Promise<number>>(() => new Promise<number>((r) => (resolver = r)));
    const m = memoizeWithTtl(fn, 60_000);
    const a = m("x");
    const b = m("x");
    resolver(7);
    expect(await a).toBe(7);
    expect(await b).toBe(7);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("guarda até o TTL e chave diferente consulta de novo", async () => {
    vi.useFakeTimers();
    const fn = vi.fn(async (k: string) => k.length);
    const m = memoizeWithTtl(fn, 1000);
    await m("ab");
    await m("ab");
    await m("abc");
    expect(fn).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1001);
    await m("ab");
    expect(fn).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("erro não fica guardado", async () => {
    let falhar = true;
    const fn = vi.fn(async () => {
      if (falhar) throw new Error("timeout");
      return 1;
    });
    const m = memoizeWithTtl(fn, 60_000);
    await expect(m()).rejects.toThrow("timeout");
    falhar = false;
    expect(await m()).toBe(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
