export type RangePreset = "7d" | "month" | "year" | "all";

export type DateRange = {
  preset: RangePreset | "custom";
  from: Date | null;
  to: Date;
};

// America/Fortaleza, UTC-3, sem horário de verão -- mesmo valor de
// BUSINESS_TZ_OFFSET_MS em kpi.ts / FORTALEZA_OFFSET_MS em cronogramaSac.ts.
// Achado na revisão de 15/10/2026: os presets "month"/"year" abaixo usavam
// `new Date(ano, mês, 1)`, que no servidor (VPS roda em UTC, sem TZ setada
// no PM2) corta o mês/ano às 21h do dia anterior em horário de Brasília --
// um chamado aberto entre 21h-23h59 do último dia do mês/ano já contava no
// período seguinte. Os métodos UTC abaixo ficam independentes do fuso do
// processo (mesmo truque de getPreviousWeekRange em kpi.ts).
const BUSINESS_TZ_OFFSET_MS = -3 * 60 * 60 * 1000;

function startOfLocalMonth(nowUtc: Date): Date {
  const local = new Date(nowUtc.getTime() + BUSINESS_TZ_OFFSET_MS);
  const monthStartLocal = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1));
  return new Date(monthStartLocal.getTime() - BUSINESS_TZ_OFFSET_MS);
}

function startOfLocalYear(nowUtc: Date): Date {
  const local = new Date(nowUtc.getTime() + BUSINESS_TZ_OFFSET_MS);
  const yearStartLocal = new Date(Date.UTC(local.getUTCFullYear(), 0, 1));
  return new Date(yearStartLocal.getTime() - BUSINESS_TZ_OFFSET_MS);
}

export function resolveRange(
  searchParams: {
    range?: string;
    from?: string;
    to?: string;
  },
  // Cada tela que reaproveita esse helper (kpis, avaliacoes) pode querer um
  // ponto de partida diferente quando ninguém escolheu nada na URL ainda --
  // pedido do Victor 20/08/2026: "no painel de kpis... deixe por padrão o
  // tempo selecionado como 'este mês'". "all" continua sendo o default
  // geral (comportamento de sempre) pra quem não passar nada explícito.
  defaultPreset: RangePreset = "all"
): DateRange {
  const now = new Date();

  if (searchParams.from) {
    // "De/Até" vem de <input type="date"> (YYYY-MM-DD), sempre em horário
    // de Brasília pra quem tá preenchendo. Achado na revisão de 15/10/2026:
    // sem o "-03:00" explícito, `new Date("2026-10-15")` virava meia-noite
    // em UTC (21h do dia 14 no Brasil) -- "De" vazava ~3h do dia anterior
    // pra dentro, e pior, "Até" (usado como teto em filtro <=) cortava as
    // 21h-23h59 do próprio dia escolhido, perdendo quase o dia inteiro de
    // "Até". Agora "De" é 00:00 local e "Até" é 23:59:59.999 local do dia
    // escolhido -- ver toLocalDateString em kpi.ts/kpiAssistencia.ts pra
    // quem precisar devolver isso pra string de dia (ex: comparar com
    // issue_date, coluna DATE sem hora).
    const from = new Date(`${searchParams.from}T00:00:00-03:00`);
    const to = searchParams.to ? new Date(`${searchParams.to}T23:59:59.999-03:00`) : now;
    return { preset: "custom", from, to };
  }

  const preset = (searchParams.range as RangePreset) ?? defaultPreset;

  if (preset === "7d") {
    return { preset, from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
  }
  if (preset === "month") {
    return { preset, from: startOfLocalMonth(now), to: now };
  }
  if (preset === "year") {
    return { preset, from: startOfLocalYear(now), to: now };
  }
  return { preset: "all", from: null, to: now };
}
