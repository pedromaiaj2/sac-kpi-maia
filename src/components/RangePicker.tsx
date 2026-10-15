import Link from "next/link";
import type { DateRange } from "@/lib/dateRange";

const PRESETS: { key: DateRange["preset"]; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "month", label: "Este mês" },
  { key: "year", label: "Este ano" },
  { key: "all", label: "Tudo" },
];

function pillStyle(active: boolean) {
  return {
    color: active ? "var(--surface-1)" : "var(--text-secondary)",
    background: active ? "var(--brand-green)" : "transparent",
    border: `1px solid ${active ? "var(--brand-green)" : "var(--border)"}`,
  };
}

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
      {PRESETS.map((p) => (
        <Link
          key={p.key}
          href={`${basePath}?range=${p.key}`}
          className="text-sm px-3 py-1 rounded-full"
          style={pillStyle(range.preset === p.key)}
        >
          {p.label}
        </Link>
      ))}
      <form method="get" className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
        <input
          type="date"
          name="from"
          defaultValue={range.preset === "custom" && range.from ? toLocalDateInputValue(range.from) : undefined}
          className="rounded px-2 py-1 text-xs"
          style={{ border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        />
        <span>até</span>
        <input
          type="date"
          name="to"
          defaultValue={range.preset === "custom" ? toLocalDateInputValue(range.to) : undefined}
          className="rounded px-2 py-1 text-xs"
          style={{ border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        />
        <button
          type="submit"
          className="text-xs px-2 py-1 rounded"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          Aplicar
        </button>
      </form>
    </div>
  );
}
