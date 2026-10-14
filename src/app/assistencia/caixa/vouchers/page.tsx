import Link from "next/link";
import { redirect } from "next/navigation";
import { getCaixaSession, caixaSignOut } from "@/app/assistencia/caixa-actions";
import { getCaixaStoreId } from "@/lib/caixas";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ValidarVoucherCaixa } from "@/components/vouchers/ValidarVoucherCaixa";

export const dynamic = "force-dynamic";

// Validação de voucher de recuperação no caixa da loja -- pedido do Victor
// 14/10/2026. Só o login de caixa (nome + PIN): a baixa grava qual caixa e
// qual loja. Sem lista, sem busca por cliente: só o código.
export default async function CaixaVouchersPage() {
  const nome = await getCaixaSession();
  const storeId = nome ? await getCaixaStoreId(nome) : null;
  if (!nome || !storeId) redirect("/assistencia/encomendas/caixa/login");
  const { data: loja } = await getSupabaseAdmin().from("stores").select("name").eq("id", storeId).maybeSingle();

  return (
    <div className="w-full max-w-[1600px] mx-auto p-6 flex flex-col gap-6 min-w-0">
      <AssistenciaHeader title="Validar voucher" subtitle={`${nome} · ${loja?.name ?? `Loja ${storeId}`}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/assistencia/encomendas/caixa"
            className="text-sm px-4 py-2.5 rounded-lg font-semibold whitespace-nowrap border"
            style={{ borderColor: "var(--brand-orange)", color: "var(--brand-orange)" }}
          >
            Encomendas
          </Link>
          <form action={caixaSignOut}>
            <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              Sair
            </button>
          </form>
        </div>
      </AssistenciaHeader>
      <ValidarVoucherCaixa />
    </div>
  );
}
