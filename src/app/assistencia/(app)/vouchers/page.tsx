import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { listarVouchers, listarEmissores, resumoVouchers, type FiltrosVoucher } from "@/lib/vouchers";
import {
  MOTIVOS_VOUCHER,
  MOTIVO_VOUCHER_LABELS,
  STATUS_VOUCHER,
  STATUS_VOUCHER_LABELS,
  beneficioTitulo,
  dataBr,
  formatarCpf,
  type MotivoVoucher,
  type StatusVoucher,
} from "@/lib/vouchersCore";
import { formatDateOnlyBr } from "@/lib/formatDateTime";
import { VoucherResumo } from "@/components/vouchers/VoucherResumo";
import { VoucherStatusBadge } from "@/components/vouchers/VoucherStatusBadge";

export const dynamic = "force-dynamic";

type Params = { status?: string; de?: string; ate?: string; motivo?: string; emissor?: string; q?: string };

const campo = "text-sm rounded border px-2.5 py-1.5";
const campoStyle = { borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-1)" };
const dia = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

// Vouchers de recuperação -- só admin (pedido do Victor 14/10/2026). A
// checagem vale também nas actions (vouchers-actions.ts); aqui é pra não
// mostrar a tela.
export default async function VouchersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const profile = await getProfile();
  if (profile.role !== "admin") redirect("/assistencia");
  const p = await searchParams;
  const filtros: FiltrosVoucher = {
    status: (STATUS_VOUCHER as readonly string[]).includes(p.status ?? "") ? (p.status as StatusVoucher) : undefined,
    de: dia(p.de),
    ate: dia(p.ate),
    motivo: (MOTIVOS_VOUCHER as readonly string[]).includes(p.motivo ?? "") ? (p.motivo as MotivoVoucher) : undefined,
    emissor: p.emissor || undefined,
    q: p.q?.slice(0, 80) || undefined,
  };
  const [vouchers, emissores, resumo] = await Promise.all([listarVouchers(filtros), listarEmissores(), resumoVouchers({ de: filtros.de, ate: filtros.ate })]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Vouchers de recuperação
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Presentes para reconquistar detratores e clientes que pediram estorno. Uso único, só para o titular.
          </p>
        </div>
        <Link href="/assistencia/vouchers/novo" className="text-sm font-semibold px-4 py-2.5 rounded-lg" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
          + Emitir voucher
        </Link>
      </div>

      <VoucherResumo r={resumo} />

      <form method="GET" className="flex flex-wrap items-end gap-2 rounded-xl p-3" style={{ border: "1px solid var(--border)", background: "var(--surface-1)" }}>
        <input name="q" defaultValue={filtros.q ?? ""} placeholder="Nome, CPF ou código" className={`${campo} flex-1 min-w-[200px]`} style={campoStyle} />
        <select name="status" defaultValue={filtros.status ?? ""} className={campo} style={campoStyle}>
          <option value="">Todos os status</option>
          {STATUS_VOUCHER.map((s) => (
            <option key={s} value={s}>
              {STATUS_VOUCHER_LABELS[s]}
            </option>
          ))}
        </select>
        <select name="motivo" defaultValue={filtros.motivo ?? ""} className={campo} style={campoStyle}>
          <option value="">Todos os motivos</option>
          {MOTIVOS_VOUCHER.map((m) => (
            <option key={m} value={m}>
              {MOTIVO_VOUCHER_LABELS[m]}
            </option>
          ))}
        </select>
        <select name="emissor" defaultValue={filtros.emissor ?? ""} className={campo} style={campoStyle}>
          <option value="">Todos os emissores</option>
          {emissores.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Emitidos de
          <input type="date" name="de" defaultValue={filtros.de ?? ""} className={campo} style={campoStyle} />
        </label>
        <label className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          até
          <input type="date" name="ate" defaultValue={filtros.ate ?? ""} className={campo} style={campoStyle} />
        </label>
        <button type="submit" className="text-sm font-semibold px-4 py-1.5 rounded" style={{ background: "var(--brand-orange)", color: "#fff" }}>
          Filtrar
        </button>
        <Link href="/assistencia/vouchers" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          Limpar
        </Link>
      </form>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {vouchers.length} voucher{vouchers.length === 1 ? "" : "s"}
        {vouchers.length >= 300 ? " (mostrando os 300 mais recentes; use os filtros)" : ""}
      </p>

      {vouchers.length === 0 ? (
        <p className="text-sm rounded-lg p-6 text-center" style={{ background: "var(--surface-1)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          Nenhum voucher encontrado.
        </p>
      ) : (
        <div className="rounded-xl overflow-x-auto" style={{ border: "2px solid var(--brand-green)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)", background: "var(--surface-2)" }}>
                {["Código", "Cliente", "Benefício", "Motivo", "Emitido", "Validade", "Status", "Uso"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-2 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.id} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 whitespace-nowrap font-semibold">
                    <Link href={`/assistencia/vouchers/${v.id}`} className="underline" style={{ color: "var(--text-primary)" }}>
                      {v.codigo}
                    </Link>
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>
                    {v.clienteNome}
                    <span className="block text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {formatarCpf(v.clienteCpf)}
                    </span>
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>
                    {beneficioTitulo(v)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                    {MOTIVO_VOUCHER_LABELS[v.motivo]}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                    {formatDateOnlyBr(v.dataEmissao)}
                    <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                      {v.emitidoPorNome}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {dataBr(v.dataValidade)}
                  </td>
                  <td className="px-3 py-2">
                    <VoucherStatusBadge status={v.status} />
                  </td>
                  <td className="px-3 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {v.usadoEm ? `${formatDateOnlyBr(v.usadoEm)} · ${v.lojaUsoNome ?? ""}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
