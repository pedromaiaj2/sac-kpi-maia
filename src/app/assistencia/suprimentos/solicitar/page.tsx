import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveEncomendaRequester } from "@/lib/encomendaRequester";
import { caixaSignOut } from "@/app/assistencia/caixa-actions";
import { lojaGerenteSignOut } from "@/app/assistencia/loja-actions";
import { listSuprimentoPedidosByStores, listSuprimentoProdutos, OPEN_SUPRIMENTO_PEDIDO_STATUSES } from "@/lib/suprimentos";
import { SuprimentoPedidoForm } from "@/components/assistencia/SuprimentoPedidoForm";
import { SuprimentoPedidoStatusBadge } from "@/components/assistencia/SuprimentoPedidoStatusBadge";
import { SuprimentoLojaActions } from "@/components/assistencia/SuprimentoLojaActions";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { ToastProvider } from "@/components/assistencia/ToastProvider";

export const dynamic = "force-dynamic";

export default async function SolicitarSuprimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string; pedido?: string }>;
}) {
  const { enviado, pedido } = await searchParams;

  const requester = await resolveEncomendaRequester();
  if (!requester) redirect("/assistencia/encomendas");
  // Suprimento é requisição interna da loja -- só gerente/caixa pedem aqui.
  // CD/fábrica/SAC/assistência não têm loja fixa pra isso; Rafael processa
  // pela própria fila (ver suprimentos/fila/page.tsx).
  if (requester.kind !== "gerente" && requester.kind !== "caixa") {
    redirect("/assistencia/suprimentos/fila");
  }

  const admin = getSupabaseAdmin();

  let fixedStoreName: string | undefined;
  let storeOptions: { id: string; name: string }[] | undefined;
  const storeIds = requester.kind === "gerente" ? requester.storeIds : [requester.storeId];

  if (requester.kind === "gerente" && requester.storeIds.length > 1) {
    const { data } = await admin.from("stores").select("id, name").in("id", requester.storeIds).order("name");
    storeOptions = data ?? [];
  } else {
    const { data: store } = await admin.from("stores").select("name").eq("id", storeIds[0]).maybeSingle();
    fixedStoreName = store?.name ?? storeIds[0];
  }

  const [produtos, pedidos] = await Promise.all([
    listSuprimentoProdutos({ onlyActive: true }),
    listSuprimentoPedidosByStores(storeIds),
  ]);

  const signOutAction = requester.kind === "caixa" ? caixaSignOut : lojaGerenteSignOut;
  const openPedidos = pedidos.filter((p) => (OPEN_SUPRIMENTO_PEDIDO_STATUSES as string[]).includes(p.status));
  const closedPedidos = pedidos.filter((p) => !(OPEN_SUPRIMENTO_PEDIDO_STATUSES as string[]).includes(p.status));

  return (
    <ToastProvider>
      <div className="max-w-xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
        <RealtimeQueueRefresher table="suprimento_pedidos" eventsTable="suprimento_pedido_events" />
        <AssistenciaHeader title="Suprimentos" subtitle="Peça pro CD produtos de limpeza, copos e outros itens da loja.">
          <form action={signOutAction}>
            <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              Sair
            </button>
          </form>
        </AssistenciaHeader>

        {enviado ? (
          <div className="rounded-lg border p-4 flex flex-col gap-1" style={{ background: "var(--surface-1)", borderColor: "var(--status-good)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--status-good)" }}>
              Pedido enviado com sucesso!{pedido ? ` Pedido #${pedido}.` : ""}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              O CD já enxerga esse pedido na fila dele.
            </p>
          </div>
        ) : null}

        <SuprimentoPedidoForm fixedStoreName={fixedStoreName} storeOptions={storeOptions} produtos={produtos} />

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Meus pedidos
          </h2>
          {pedidos.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Nenhum pedido de suprimento ainda.
            </p>
          ) : (
            <div className="rounded-2xl shadow-lg shadow-black/20 overflow-hidden" style={{ background: "var(--surface-1)" }}>
              <div className="divide-y divide-[var(--border)]">
                {[...openPedidos, ...closedPedidos].map((p) => (
                  <details key={p.id} className="p-4">
                    <summary className="flex items-start justify-between gap-2 cursor-pointer list-none flex-wrap">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-muted)" }}>
                            #{p.pedidoNumber}
                          </span>
                          <SuprimentoPedidoStatusBadge status={p.status} />
                        </div>
                        <ul className="text-sm" style={{ color: "var(--text-primary)" }}>
                          {p.items.map((i) => (
                            <li key={i.id}>
                              {i.quantidade}x {i.produtoNome}
                              {i.unidade ? ` (${i.unidade})` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </summary>
                    <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)" }}>
                      {storeIds.length > 1 ? (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Loja: {p.storeName}
                        </p>
                      ) : null}
                      {p.notes ? (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Observações: {p.notes}
                        </p>
                      ) : null}
                      {p.rejectionReason ? (
                        <p className="text-xs" style={{ color: "var(--status-critical)" }}>
                          Motivo da recusa: {p.rejectionReason}
                        </p>
                      ) : null}
                      <SuprimentoLojaActions pedidoId={p.id} status={p.status} />
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>

        <Link href={requester.kind === "gerente" ? "/assistencia/loja" : "/assistencia/encomendas/caixa"} className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </div>
    </ToastProvider>
  );
}
