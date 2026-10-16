import { describe, it, expect } from "vitest";
import { resolveRotaForDate, regiaoDoBairro, type RotaWeekdayConfig, type RotaWeekdayScheduleEntry } from "./rotas";

// Padrão-base atual (segunda a sábado) usado nos testes -- mesmo que
// rota_weekday_config tem hoje.
const BASE: RotaWeekdayConfig = { 0: null, 1: "centro", 2: "praia", 3: "sul", 4: "centro", 5: "praia", 6: "sul" };

// Mudança agendada pra 14/09/2026 (segunda) -- pedido do Victor 08/09/2026:
// Sul seg/qua/sex, Centro qui/sáb, Praia só terça.
const SCHEDULE: RotaWeekdayScheduleEntry[] = [
  { weekday: 1, rota: "sul", effectiveFrom: "2026-09-14" },
  { weekday: 2, rota: "praia", effectiveFrom: "2026-09-14" },
  { weekday: 3, rota: "sul", effectiveFrom: "2026-09-14" },
  { weekday: 4, rota: "centro", effectiveFrom: "2026-09-14" },
  { weekday: 5, rota: "sul", effectiveFrom: "2026-09-14" },
  { weekday: 6, rota: "centro", effectiveFrom: "2026-09-14" },
];

describe("resolveRotaForDate", () => {
  it("antes da virada, usa o padrão-base mesmo com mudança agendada existindo", () => {
    // Sábado 12/09/2026 -- ainda essa semana, mudança só vale a partir de 14/09.
    expect(resolveRotaForDate("2026-09-12", BASE, SCHEDULE)).toBe("sul");
  });

  it("no dia exato da virada, já usa a mudança agendada", () => {
    // Segunda 14/09/2026.
    expect(resolveRotaForDate("2026-09-14", BASE, SCHEDULE)).toBe("sul");
    // Terça 15/09/2026 -- muda de "praia" (base) continua "praia" (agendado), mas por outro motivo.
    expect(resolveRotaForDate("2026-09-15", BASE, SCHEDULE)).toBe("praia");
    // Sábado 19/09/2026 -- base seria "sul", agendado vira "centro".
    expect(resolveRotaForDate("2026-09-19", BASE, SCHEDULE)).toBe("centro");
  });

  it("sem nenhuma mudança agendada pro dia da semana, cai no padrão-base", () => {
    // Segunda 14/09/2026, sem nenhuma entrada agendada -- usa o padrão-base direto.
    expect(resolveRotaForDate("2026-09-14", BASE, [])).toBe("centro");
    // Domingo continua sem rota nenhuma, mudança ou não.
    expect(resolveRotaForDate("2026-09-20", BASE, SCHEDULE)).toBe(null);
  });

  it("com duas mudanças agendadas pro mesmo dia da semana, usa a mais recente que já valha", () => {
    const schedule: RotaWeekdayScheduleEntry[] = [
      { weekday: 1, rota: "sul", effectiveFrom: "2026-09-14" },
      { weekday: 1, rota: "praia", effectiveFrom: "2026-10-05" },
    ];
    // Antes da 2ª mudança -- vale a 1ª.
    expect(resolveRotaForDate("2026-09-21", BASE, schedule)).toBe("sul");
    // Depois da 2ª mudança -- vale a mais recente.
    expect(resolveRotaForDate("2026-10-05", BASE, schedule)).toBe("praia");
  });
});

describe("regiaoDoBairro", () => {
  it("acha a região certa nas 3 rotas, sem acento e em qualquer caixa", () => {
    expect(regiaoDoBairro("Manaíra")).toBe("praia");
    expect(regiaoDoBairro("TAMBAUZINHO")).toBe("centro");
    expect(regiaoDoBairro("mangabeira")).toBe("sul");
  });

  it("'Centro' sozinho cai em centro/oeste, o caso mais comum", () => {
    expect(regiaoDoBairro("Centro")).toBe("centro");
  });

  it("'Centro' vira praia quando o texto menciona Cabedelo", () => {
    expect(regiaoDoBairro("Centro - Cabedelo")).toBe("praia");
    expect(regiaoDoBairro("Cabedelo")).toBe("praia");
  });

  it("aceita variação/complemento no texto digitado (endereço livre)", () => {
    expect(regiaoDoBairro("Jardim Oceania, perto da praia")).toBe("praia");
    expect(regiaoDoBairro("Mangabeira III")).toBe("sul");
    expect(regiaoDoBairro("Tibiri II")).toBe("centro");
  });

  it("sem bairro ou sem bater com nada conhecido, devolve null", () => {
    expect(regiaoDoBairro(null)).toBe(null);
    expect(regiaoDoBairro("")).toBe(null);
    expect(regiaoDoBairro("Bairro Inexistente De Outra Cidade")).toBe(null);
  });
});
