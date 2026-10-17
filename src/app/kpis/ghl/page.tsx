import { Info } from "lucide-react";
import { KpisSectionTabs } from "@/components/KpisSectionTabs";
import { UnderlineTab } from "@/components/UnderlineTab";
import { SUBCONTAS, resumoAtendimentos, type SubcontaKey } from "@/lib/ghlSubcontas";

export const revalidate = 60;

const SUB_KEYS = Object.keys(SUBCONTAS) as SubcontaKey[];

function formatMinutos(value: number | null): string {
  if (value === null) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} min`;
}

export default async function KpisGhlPage({ searchParams }: { searchParams: Promise<{ sub?: string }> }) {
  const { sub } = await searchParams;
  const key: SubcontaKey = sub === "lider" ? "lider" : "lojas_maia";
  const { porAtendente, atualizadoEm } = await resumoAtendimentos(key);

  const totalConversas = porAtendente.reduce((sum, a) => sum + a.conversas, 0);
  const totalRespondidas = porAtendente.reduce((sum, a) => sum + a.respondidas, 0);

  return (
    <>
      <div className="max-w-6xl mx-auto px-6 pt-6 pb-12 flex flex-col gap-5">
        <KpisSectionTabs active="ghl" />
        <div className="flex flex-wrap items-center gap-1.5">
          {SUB_KEYS.map((k) => (
            <UnderlineTab key={k} href={`/kpis/ghl?sub=${k === "lider" ? "lider" : "lojas_maia"}`} label={SUBCONTAS[k].label} active={k === key} color="var(--brand-orange)" pilula />
          ))}
        </div>
        {/* Aviso em cartão discreto e tabela em cartão com linhas sutis --
            design system do painel (17/10/2026). */}
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm leading-relaxed"
          style={{ background: "color-mix(in srgb, var(--brand-orange) 9%, var(--surface-1))", color: "var(--text-secondary)" }}
        >
          <Info aria-hidden size={16} className="mt-0.5 shrink-0" style={{ color: "var(--brand-orange)" }} />
          <p>
            Conversas atribuídas aos atendentes do SAC nos últimos 60 dias. Tempo medido da última mensagem do cliente até a primeira resposta do próprio atendente, em horário comercial. Respostas acima de 3 dias úteis ficam fora da média e aparecem à parte.
            <span style={{ color: "var(--text-muted)" }}>
              {atualizadoEm ? ` Última atualização: ${new Date(atualizadoEm).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}.` : " Ainda sem dados sincronizados."}
            </span>
          </p>
        </div>
        <div className="cartao overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ boxShadow: "inset 0 -1px 0 var(--border)" }}>
                {["Atendente", "Conversas", "Com resposta", "Tempo médio 1ª resposta", "Acima de 3 dias úteis"].map((h, i) => (
                  <th
                    key={h}
                    className={`${i === 0 ? "text-left" : "text-right"} px-5 py-3.5 text-xs font-semibold uppercase tracking-wide whitespace-nowrap`}
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {porAtendente.map((a) => (
                <tr key={a.nome} className="transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: "var(--border)" }}>
                  <td className="px-5 py-3.5 font-semibold" style={{ color: "var(--text-primary)" }}>
                    {a.nome}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {a.conversas}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {a.respondidas}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
                    {formatMinutos(a.tempoMedioMin)}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: a.acimaDoLimite > 0 ? "var(--status-warning)" : "var(--text-secondary)" }}>
                    {a.acimaDoLimite}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ boxShadow: "inset 0 1px 0 var(--border)" }}>
                <td className="px-5 py-3.5 font-bold" style={{ color: "var(--text-primary)" }}>
                  Total
                </td>
                <td className="px-5 py-3.5 text-right font-bold tabular-nums">{totalConversas}</td>
                <td className="px-5 py-3.5 text-right font-bold tabular-nums">{totalRespondidas}</td>
                <td className="px-5 py-3.5 text-right" style={{ color: "var(--text-muted)" }}>
                  —
                </td>
                <td className="px-5 py-3.5 text-right font-bold tabular-nums">{porAtendente.reduce((sum, a) => sum + a.acimaDoLimite, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
