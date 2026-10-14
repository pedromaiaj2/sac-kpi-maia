import { StatTile } from "@/components/StatTile";
import { MOTIVO_VOUCHER_LABELS } from "@/lib/vouchersCore";
import type { ResumoVouchers } from "@/lib/vouchers";

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

// Painel dos vouchers (sem dado pessoal): usado na tela do admin e na aba
// Vouchers de /clientes.
export function VoucherResumo({ r }: { r: ResumoVouchers }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <StatTile label="Emitidos" value={r.emitidos} />
        <StatTile label="Ativos" value={r.ativos} accent="var(--status-good)" />
        <StatTile label="Usados" value={r.usados} accent="var(--series-5)" />
        <StatTile label="Expirados" value={r.expirados} accent="var(--status-warning)" />
        <StatTile label="Cancelados" value={r.cancelados} accent="var(--status-critical)" />
        <StatTile label="Taxa de uso" value={pct(r.taxaUso)} accent="var(--brand-orange)" note="usados ÷ (emitidos − cancelados)" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Tabela
          titulo="Uso por loja"
          cabecalho={["Loja", "Usados"]}
          linhas={r.porLoja.map((l) => [l.loja, String(l.usados)])}
          vazio="Nenhum voucher usado ainda."
        />
        <Tabela
          titulo="Por motivo"
          cabecalho={["Motivo", "Emitidos", "Usados", "Uso"]}
          linhas={r.porMotivo.map((m) => [MOTIVO_VOUCHER_LABELS[m.motivo], String(m.emitidos), String(m.usados), pct(m.emitidos ? m.usados / m.emitidos : null)])}
          vazio="Nenhum voucher emitido ainda."
        />
      </div>
    </div>
  );
}

function Tabela({ titulo, cabecalho, linhas, vazio }: { titulo: string; cabecalho: string[]; linhas: string[][]; vazio: string }) {
  return (
    <section className="rounded-xl p-4 flex flex-col gap-2" style={{ border: "2px solid var(--brand-green)", background: "var(--surface-1)" }}>
      <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        {titulo}
      </h3>
      {linhas.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {vazio}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr>
              {cabecalho.map((h, i) => (
                <th key={h} className={`py-1 text-xs font-semibold ${i === 0 ? "text-left" : "text-right"}`} style={{ color: "var(--text-muted)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l[0]} className="border-t" style={{ borderColor: "var(--border)" }}>
                {l.map((c, i) => (
                  <td key={i} className={`py-1 tabular-nums ${i === 0 ? "text-left" : "text-right font-semibold"}`} style={{ color: "var(--text-primary)" }}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
