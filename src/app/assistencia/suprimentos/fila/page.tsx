import Link from "next/link";
import { requireSuprimentoCdActor } from "@/lib/suprimentoAuth";
import { listAllSuprimentoPedidos, isSuprimentoPedidoStatus, OPEN_SUPRIMENTO_PEDIDO_STATUSES } from "@/lib/suprimentos";
import { SUPRIMENTO_PEDIDO_STATUS_COLORS } from "@/lib/assistenciaLabels";
import { SuprimentoPedidoStatusBadge } from "@/components/assistencia/SuprimentoPedidoStatusBadge";
import { SuprimentoCdActions } from "@/components/assistencia/SuprimentoCdActions";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { NotificationBell } from "@/components/assistencia/NotificationBell";
import { listFabricaOuCdNotificationsAction } from "@/app/assistencia/notifications-actions";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { cdSignOut } from "@/app/assistencia/cd-actions";
import { signOut } from "@/app/assistencia/actions";

export const dynamic = "force-dynamic";

function buildHref(status?: string) {
  return status ? `/assistencia/suprimentos/fila?status=${status}` : "/assistencia/suprimentos/fila";
}

const FILTERS: { label: string; value: string | null }[] = [
  { label: "Em andamento", value: null },
  { label: "Todos", value: "todos" },
  { label: "Solicitado", value: "solicitado" },
  { label: "Aprovado", value: "aprovado" },
  { label: "Comprado", value: "comprado" },
  { label: "Enviado pra loja", value: "enviado" },
  { label: "Recebido na loja", value: "recebido" },
  { label: "Rejeitado", value: "rejeitado" },
  { label: "Cancelado", value: "cancelado" },
];

export default async function SuprimentosFilaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const actor = await requireSuprimentoCdActor();
  const { status } = await searchParams;
  const filterStatus = isSuprimentoPedidoStatus(status) ? status : undefined;
  const showAllStatuses = status === "todos";

  const [pedidos, allForCounts] = await Promise.all([
    listAllSuprimentoPedidos({ status: filterStatus, onlyOpen: !filterStatus && !showAllStatuses }),
    listAllSuprimentoPedidos({}),
  ]);
  const statusCounts = new Map<string, number>();
  for (const p of allForCounts) statusCounts.set(p.status, (statusCounts.get(p.status) ?? 0) + 1);
  const openCount = allForCounts.filter((p) => (OPEN_SUPRIMENTO_PEDIDO_STATUSES as string[]).includes(p.status)).length;

  const signOutAction = actor.role === "cd" ? cdSignOut : signOut;

  return (
    <ToastProvider>
      <div className="w-full max-w-[1600px] mx-auto p-6 flex flex-col gap-4 min-w-0">
        <RealtimeQueueRefresher
          table="suprimento_pedidos"
          eventsTable="suprimento_pedido_events"
          notifyOnInsert="Novo pedido de suprimento recebido!"
        />

        <AssistenciaHeader title="Suprimentos" subtitle={`${actor.name} · fila de solicitações das lojas`}>
          <div className="flex items-center gap-4 flex-wrap">
            {actor.role === "admin" ? (
              <Link href="/assistencia/inicio" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
                ← Voltar
              </Link>
            ) : null}
            {actor.role === "cd" ? <NotificationBell fetchAction={listFabricaOuCdNotificationsAction} storageKey="cd" /> : null}
            {actor.role === "cd" ? (
              <Link href="/assistencia/encomendas/fila" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
                Encomendas
              </Link>
            ) : null}
            <form action={signOutAction}>
              <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
                Sair
              </button>
            </form>
          </div>
        </AssistenciaHeader>

        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap -mx-1 px-1">
          {FILTERS.filter((f) => {
            if (f.value === null || f.value === "todos") return true;
            const activeValue = showAllStatuses ? "todos" : (filterStatus ?? null);
            if (f.value === activeValue) return true;
            return (statusCounts.get(f.value) ?? 0) > 0;
          }).map((f) => {
            const activeValue = showAllStatuses ? "todos" : (filterStatus ?? null);
            const selected = (f.value ?? null) === activeValue;
            const isStatusPill = !!f.value && f.value !== "todos";
            const count = f.value === null ? openCount : f.value === "todos" ? allForCounts.length : (statusCounts.get(f.value) ?? 0);
            return (
              <FilterPill
                key={f.label}
                href={buildHref(f.value ?? undefined)}
                label={`${f.label} (${count})`}
                selected={selected}
                color={isStatusPill ? SUPRIMENTO_PEDIDO_STATUS_COLORS[f.value as string] : undefined}
              />
            );
          })}
        </div>

        {pedidos.length === 0 ? (
          <div className="rounded-2xl shadow-lg shadow-black/20 p-6 text-center" style={{ background: "var(--surface-1)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Nenhum pedido encontrado.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl shadow-lg shadow-black/20 overflow-hidden" style={{ background: "var(--surface-1)" }}>
            <div className="divide-y divide-[var(--border)]">
              {pedidos.map((p) => (
                <details key={p.id} className="p-4">
                  <summary className="flex items-start justify-between gap-3 cursor-pointer list-none flex-wrap">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-muted)" }}>
                          #{p.pedidoNumber}
                        </span>
                        <SuprimentoPedidoStatusBadge status={p.status} />
                        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {p.storeName}
                        </span>
                      </div>
                      <ul className="text-sm" style={{ color: "var(--text-primary)" }}>
                        {p.items.map((i) => (
                          <li key={i.id}>
                            {i.quantidade}x {i.produtoNome}
                            {i.unidade ? ` (${i.unidade})` : ""}
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Solicitado por {p.requestedByName}
                      </p>
                    </div>
                    <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                      {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </summary>
                  <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)" }}>
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
                    <SuprimentoCdActions pedidoId={p.id} status={p.status} />
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
