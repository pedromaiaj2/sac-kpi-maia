import { volumesOrdenados, type VolumesPorCategoria } from "@/lib/odoo/logisticaTipos";

// Peças visuais pequenas da logística do Odoo, nos tokens do sistema do
// Victor (var(--surface-1), var(--brand-green), .cartao...).

export function VolumesChips({ volumes, total }: { volumes: VolumesPorCategoria; total?: number }) {
  const lista = volumesOrdenados(volumes);
  return (
    <div className="flex flex-wrap gap-1.5">
      {typeof total === "number" ? <Chip forte>{total} vol.</Chip> : null}
      {lista.map((v) => (
        <Chip key={v.categoria}>
          {v.qtd} {v.label.toLowerCase()}
        </Chip>
      ))}
    </div>
  );
}

export function Chip({ children, forte, cor }: { children: React.ReactNode; forte?: boolean; cor?: string }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{
        background: cor ? `color-mix(in srgb, ${cor} 16%, var(--surface-1))` : forte ? "var(--brand-green-soft)" : "var(--surface-2)",
        color: cor ?? (forte ? "var(--brand-green)" : "var(--text-secondary)"),
        fontWeight: forte || cor ? 700 : 500,
      }}
    >
      {children}
    </span>
  );
}

export function ErroOdoo({ titulo, mensagem }: { titulo: string; mensagem: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg p-4 text-sm"
      style={{ background: "color-mix(in srgb, var(--status-critical) 10%, var(--surface-1))", border: "1px solid var(--status-critical)", color: "var(--text-primary)" }}
    >
      <b>{titulo}</b>
      <div className="mt-1" style={{ color: "var(--text-secondary)" }}>
        {mensagem}
      </div>
    </div>
  );
}

export function Kpi({ rotulo, valor, detalhe }: { rotulo: string; valor: React.ReactNode; detalhe?: React.ReactNode }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-2)" }}>
      <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {rotulo}
      </div>
      <div className="text-xl font-extrabold" style={{ color: "var(--brand-green)" }}>
        {valor}
      </div>
      {detalhe ? <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{detalhe}</div> : null}
    </div>
  );
}

export const inputClass = "rounded-lg border px-3 py-2 text-sm w-full";
export const inputStyle = { borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" } as const;
export const botaoClass = "text-sm font-semibold rounded-lg px-3 py-2 border disabled:opacity-50";
export const botaoStyle = { borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" } as const;
export const botaoPrimarioStyle = { borderColor: "var(--brand-green)", background: "var(--brand-green)", color: "var(--brand-green-ink)" } as const;
export const botaoLaranjaStyle = { borderColor: "var(--brand-orange)", background: "var(--brand-orange)", color: "#fff" } as const;
export const botaoPerigoStyle = { borderColor: "var(--status-critical)", background: "var(--surface-1)", color: "var(--status-critical)" } as const;
