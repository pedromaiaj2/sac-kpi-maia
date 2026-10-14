import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { preencherDeEstorno, preencherDeNps } from "@/lib/voucherPrefill";
import { hojeRecife, somarDias, VALIDADE_PADRAO_DIAS, type PreenchimentoVoucher } from "@/lib/vouchersCore";
import { EmitirVoucherForm } from "@/components/vouchers/EmitirVoucherForm";

export const dynamic = "force-dynamic";

export default async function NovoVoucherPage({ searchParams }: { searchParams: Promise<{ estorno?: string; nps?: string }> }) {
  const profile = await getProfile();
  if (profile.role !== "admin") redirect("/assistencia");
  const { estorno, nps } = await searchParams;
  let inicial: PreenchimentoVoucher = {};
  if (estorno) inicial = (await preencherDeEstorno(estorno)) ?? { avisoOrigem: "Estorno não encontrado. Preencha os dados à mão." };
  else if (nps) inicial = (await preencherDeNps(nps)) ?? { avisoOrigem: "Detrator não encontrado. Preencha os dados à mão." };
  const hoje = hojeRecife();

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <Link href="/assistencia/vouchers" className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
        ← Vouchers
      </Link>
      <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
        Emitir voucher
      </h1>
      <section className="rounded-xl p-5" style={{ border: "2px solid var(--brand-green)", background: "var(--surface-1)" }}>
        <EmitirVoucherForm inicial={inicial} validadePadrao={somarDias(hoje, VALIDADE_PADRAO_DIAS)} hoje={hoje} />
      </section>
    </div>
  );
}
