import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { getVoucher, listarEventos } from "@/lib/vouchers";
import {
  MOTIVO_VOUCHER_LABELS,
  beneficioTitulo,
  beneficioDetalhe,
  dataBr,
  formatarCpf,
  mensagemWhatsapp,
} from "@/lib/vouchersCore";
import { whatsappHref } from "@/lib/phone";
import { formatDateTimeBr } from "@/lib/formatDateTime";
import { VoucherStatusBadge } from "@/components/vouchers/VoucherStatusBadge";
import { CompartilharVoucher } from "@/components/vouchers/CompartilharVoucher";
import { CancelarVoucherForm } from "@/components/vouchers/CancelarVoucherForm";

export const dynamic = "force-dynamic";

const ACAO_LABELS: Record<string, string> = {
  emissao: "Emissão",
  consulta: "Consulta",
  baixa: "Baixa",
  cancelamento: "Cancelamento",
  expiracao: "Expiração",
  correcao_banco: "Correção no banco",
};

const RESULTADO_LABELS: Record<string, string> = {
  ok: "ok",
  inexistente: "código inexistente",
  usado: "já usado",
  expirado: "expirado",
  cancelado: "cancelado",
  cpf_nao_confere: "CPF não confere",
  bloqueado: "bloqueado (tentativas)",
};

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {rotulo}
      </dt>
      <dd className="text-sm" style={{ color: "var(--text-primary)" }}>
        {children}
      </dd>
    </div>
  );
}

export default async function VoucherDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  if (profile.role !== "admin") redirect("/assistencia");
  const { id } = await params;
  const v = await getVoucher(id);
  if (!v) notFound();
  const eventos = await listarEventos(v.id);
  const mensagem = mensagemWhatsapp(v);
  const imagemUrl = `/assistencia/vouchers/${v.id}/imagem`;
  const detalhe = beneficioDetalhe(v);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/assistencia/vouchers" className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
        ← Vouchers
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {v.codigo}
        </h1>
        <VoucherStatusBadge status={v.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-5 items-start">
        <section className="rounded-xl p-3 flex flex-col gap-3" style={{ border: "2px solid var(--brand-green)", background: "var(--surface-1)" }}>
          <Image src={imagemUrl} alt={`Voucher ${v.codigo}`} width={1080} height={1350} unoptimized className="w-full h-auto rounded-lg" />
          {v.status === "ativo" ? (
            <CompartilharVoucher imagemUrl={imagemUrl} mensagem={mensagem} whatsappUrl={v.clienteTelefone ? whatsappHref(v.clienteTelefone, mensagem) : null} />
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Voucher não está ativo: a imagem fica só para consulta.
            </p>
          )}
        </section>

        <div className="flex flex-col gap-5 min-w-0">
          <section className="rounded-xl p-4" style={{ border: "2px solid var(--brand-green)", background: "var(--surface-1)" }}>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Dado rotulo="Cliente">{v.clienteNome}</Dado>
              <Dado rotulo="CPF">{formatarCpf(v.clienteCpf)}</Dado>
              <Dado rotulo="Telefone">{v.clienteTelefone ?? "—"}</Dado>
              <Dado rotulo="Benefício">
                {beneficioTitulo(v)}
                {detalhe ? <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{detalhe}</span> : null}
              </Dado>
              <Dado rotulo="Motivo">
                {MOTIVO_VOUCHER_LABELS[v.motivo]}
                {v.observacao ? <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{v.observacao}</span> : null}
              </Dado>
              <Dado rotulo="Pedido / protocolo de origem">{v.pedidoOrigem ?? "—"}</Dado>
              <Dado rotulo="Emitido">
                {formatDateTimeBr(v.dataEmissao)} por {v.emitidoPorNome}
              </Dado>
              <Dado rotulo="Válido até">{dataBr(v.dataValidade)}</Dado>
              {v.usadoEm ? (
                <Dado rotulo="Usado">
                  {formatDateTimeBr(v.usadoEm)} · {v.lojaUsoNome} · caixa {v.usadoPor} · cupom/pedido {v.cupomUso}
                </Dado>
              ) : null}
              {v.canceladoEm ? (
                <Dado rotulo="Cancelado">
                  {formatDateTimeBr(v.canceladoEm)} por {v.canceladoPorNome}: {v.motivoCancelamento}
                </Dado>
              ) : null}
            </dl>
          </section>

          {v.status === "ativo" || v.status === "expirado" ? <CancelarVoucherForm id={v.id} codigo={v.codigo} /> : null}

          <section className="rounded-xl p-4 flex flex-col gap-2" style={{ border: "1px solid var(--border)", background: "var(--surface-1)" }}>
            <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Histórico (auditoria)
            </h2>
            <table className="w-full text-xs">
              <tbody>
                {eventos.map((e) => (
                  <tr key={e.id} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
                    <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {formatDateTimeBr(e.criadoEm)}
                    </td>
                    <td className="py-1.5 pr-3 font-semibold" style={{ color: "var(--text-primary)" }}>
                      {ACAO_LABELS[e.acao] ?? e.acao}
                    </td>
                    <td className="py-1.5 pr-3" style={{ color: e.resultado === "ok" ? "var(--text-secondary)" : "var(--status-critical)" }}>
                      {RESULTADO_LABELS[e.resultado] ?? e.resultado}
                    </td>
                    <td className="py-1.5" style={{ color: "var(--text-secondary)" }}>
                      {e.atorTipo === "caixa" ? `caixa ${e.atorNome}${e.lojaId ? ` · loja ${e.lojaId}` : ""}` : e.atorNome}
                      {e.detalhe ? ` · ${e.detalhe}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}
