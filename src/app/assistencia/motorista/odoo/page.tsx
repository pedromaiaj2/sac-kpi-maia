import Link from "next/link";
import { redirect } from "next/navigation";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { getMotoristaSessao } from "@/lib/odoo/logisticaAuth";
import { carregarRotaMotoristaOdoo } from "@/lib/odoo/rotaMotorista";
import { RESULTADO_LABELS, volumesOrdenados } from "@/lib/odoo/logisticaTipos";
import { MotoristaOdooAbas } from "@/components/logisticaOdoo/MotoristaOdooAbas";
import { RotaOdooBotoes } from "@/components/logisticaOdoo/RotaOdooBotoes";
import { Chip, ErroOdoo } from "@/components/logisticaOdoo/ui";

// "Entregas Odoo" no app do motorista: cargas liberadas/em rota dele no
// Odoo (entrega de venda), ao lado das rotas de troca/recolhimento do
// Victor (/assistencia/motorista). Mesmo login PIN.
export const dynamic = "force-dynamic";

const COR: Record<string, string> = {
  entregue: "var(--status-good)",
  entrega_parcial: "var(--status-warning)",
  insucesso: "var(--status-critical)",
  reagendada: "var(--status-info)",
};

export default async function MotoristaOdooPage() {
  const sessao = await getMotoristaSessao();
  if (!sessao) redirect("/assistencia/motorista/login");
  const rota = await carregarRotaMotoristaOdoo(sessao);

  return (
    <ToastProvider>
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-5 w-full min-w-0">
        <AssistenciaHeader title={`Olá, ${sessao.nome}`} subtitle={sessao.supervisor ? "Todas as cargas do Odoo em rota (só visualização)." : "Suas entregas de venda do dia (Odoo)."}>
          <Link href="/assistencia" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            ← Voltar
          </Link>
        </AssistenciaHeader>
        <MotoristaOdooAbas ativa="odoo" />

        {!rota.casamento.ok && !sessao.supervisor ? <ErroOdoo titulo="Seu cadastro não está ligado ao Odoo" mensagem={rota.casamento.motivo} /> : null}
        {rota.erros.map((e, i) => (
          <ErroOdoo key={i} titulo="Falha ao ler o Odoo" mensagem={e} />
        ))}

        {rota.cargas.length === 0 && (rota.casamento.ok || sessao.supervisor) && rota.erros.length === 0 ? (
          <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Nenhuma carga liberada ou em rota para você.
            </p>
          </div>
        ) : null}

        {rota.cargas.map((c) => {
          const faltam = c.paradas.filter((p) => !p.resultado).length;
          const dono = !sessao.supervisor && rota.casamento.ok && c.motorista_id === rota.casamento.employeeId;
          return (
            <section key={c.carga_id} className="rounded-lg p-4 flex flex-col gap-3" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <b style={{ color: "var(--text-primary)" }}>{c.romaneio}</b>
                <Chip cor={c.estado === "em_rota" ? "var(--status-serious)" : "var(--brand-green)"}>{c.estado === "em_rota" ? "Em rota" : "Liberada"}</Chip>
              </div>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {[c.zona, `${c.qtd_paradas} paradas`, `${c.volumes} volumes`, c.veiculo, sessao.supervisor ? c.motorista : ""].filter(Boolean).join(" · ")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {volumesOrdenados(c.volumes_por_categoria).map((v) => (
                  <Chip key={v.categoria}>
                    {v.qtd} {v.label.toLowerCase()}
                  </Chip>
                ))}
              </div>
              {dono ? <RotaOdooBotoes cargaId={c.carga_id} estado={c.estado} faltam={faltam} /> : null}
              <ol className="flex flex-col">
                {c.paradas.map((p, i) => (
                  <li key={p.parada_id}>
                    <Link
                      href={`/assistencia/motorista/odoo/${c.carga_id}/${p.parada_id}`}
                      className="flex items-center justify-between gap-3 py-3"
                      style={{ borderBottom: "1px solid var(--border)", color: "var(--text-primary)" }}
                    >
                      <span className="min-w-0">
                        <b>
                          {i + 1}. {p.cliente}
                        </b>
                        <span className="block text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                          {p.endereco}
                        </span>
                      </span>
                      {p.resultado ? <Chip cor={COR[p.resultado]}>{RESULTADO_LABELS[p.resultado]}</Chip> : <Chip>pendente</Chip>}
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </ToastProvider>
  );
}
