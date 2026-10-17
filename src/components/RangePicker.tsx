import Link from "next/link";
import type { DateRange } from "@/lib/dateRange";

const PRESETS: { key: DateRange["preset"]; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "month", label: "Este mês" },
  { key: "year", label: "Este ano" },
  { key: "all", label: "Tudo" },
];

// Pílulas do design system (17/10/2026): trilho único com a ativa
// preenchida em verde; datas livres e "Aplicar" no mesmo formato.
function pillStyle(active: boolean) {
  return {
    color: active ? "#fff" : "var(--text-secondary)",
    background: active ? "var(--brand-green)" : "transparent",
  };
}

const campoData = "rounded-full px-3 py-1.5 text-xs outline-none";
const campoDataStyle = { background: "var(--surface-1)", color: "var(--text-primary)", boxShadow: "inset 0 0 0 1px var(--border)" };

// Mesmo fuso de dateRange.ts (America/Fortaleza, UTC-3) -- desde a correção
// de 15/10/2026, `range.to` de um período customizado é 23:59:59.999 LOCAL
// (pode cair no dia seguinte em UTC), então um slice cru de `.toISOString()`
// mostraria o dia errado de volta no input. Essa função devolve o dia-
// calendário correto pro <input type="date">.
function toLocalDateInputValue(date: Date): string {
  return new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// `basePath` -- reaproveitado em /avaliacoes (pedido do Victor 19/08/2026:
// nova aba própria com o NPS "duplicado" do SAC), default "/kpis" pra não
// quebrar o uso original.
export function RangePicker({ range, basePath = "/kpis" }: { range: DateRange; basePath?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap items-center gap-0.5 rounded-full p-1" style={{ background: "var(--surface-2)" }}>
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={`${basePath}?range=${p.key}`}
            aria-current={range.preset === p.key ? "true" : undefined}
            className={`text-sm font-medium tracking-wide px-3.5 py-1.5 rounded-full transition-colors duration-200 ${range.preset === p.key ? "" : "hover:bg-[var(--surface-1)]"}`}
            style={pillStyle(range.preset === p.key)}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <form method="get" className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
        <input
          type="date"
          name="from"
          defaultValue={range.preset === "custom" && range.from ? toLocalDateInputValue(range.from) : undefined}
          aria-label="De"
          className={campoData}
          style={campoDataStyle}
        />
        <span className="text-xs">até</span>
        <input
          type="date"
          name="to"
          defaultValue={range.preset === "custom" ? toLocalDateInputValue(range.to) : undefined}
          aria-label="Até"
          className={campoData}
          style={campoDataStyle}
        />
        <button
          type="submit"
          className="text-xs font-semibold tracking-wide px-3.5 py-1.5 rounded-full transition-opacity hover:opacity-90"
          style={{ background: "var(--brand-orange)", color: "#fff" }}
        >
          Aplicar
        </button>
      </form>
    </div>
  );
}
