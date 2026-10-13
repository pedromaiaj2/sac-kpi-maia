import type { MotivoInsucesso } from "@/lib/kpisLogistica";

// Motivo de cada insucesso pelo código de ocorrência do Protheus -- pedido
// do Victor 13/10/2026 ("o ponto principal dessa tela é ... motivo da
// volta"). Mesma cor por categoria do gráfico Causas da Volta: logística
// em vermelho (controlável), CD (L06) à parte, o resto neutro.
function corMotivo(m: MotivoInsucesso): string {
  if (m.codigo === "L06") return "var(--series-5)";
  if (m.codigo?.startsWith("L")) return "var(--status-critical)";
  if (m.codigo?.startsWith("C")) return "var(--series-7)";
  return "var(--text-muted)";
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function MotivosInsucesso({ motivos }: { motivos: MotivoInsucesso[] }) {
  const total = motivos.reduce((s, m) => s + m.total, 0);
  if (total === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhum insucesso no período.
      </p>
    );
  }
  const maior = motivos[0]?.total ?? 1;
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
      {motivos.map((m) => {
        const cor = corMotivo(m);
        return (
          <li key={m.codigo ?? "sem"} className="flex flex-col gap-0.5 text-xs min-w-0">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate" style={{ color: "var(--text-primary)" }}>
                <span className="font-bold tabular-nums mr-1.5" style={{ color: cor }}>
                  {m.codigo ?? "—"}
                </span>
                {m.descricao}
                {m.categoria && <span style={{ color: "var(--text-muted)" }}> · {m.categoria}</span>}
              </span>
              <span className="shrink-0 tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
                {fmt(m.total)}
                <span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>
                  {((m.total / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
                </span>
              </span>
            </span>
            <span className="h-1.5 rounded-full" style={{ background: "var(--surface-2)" }}>
              <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (m.total / maior) * 100)}%`, background: cor }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
