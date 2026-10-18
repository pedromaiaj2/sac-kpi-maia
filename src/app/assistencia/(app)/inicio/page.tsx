import Link from "next/link";
import { getProfile, redirectIfSac, canSeeOwnAssemblerStoreRequests } from "@/lib/dal";
import { countRequestsOverview } from "@/lib/serviceRequests";
import { countPartOrdersOverview } from "@/lib/partOrders";
import { countPendingPayments } from "@/lib/payments";
import { OWN_ASSEMBLER_STORE_IDS } from "@/lib/assistenciaLabels";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";

// Redesenho 18/10/2026 -- migração pro Design System unificado (pedido do
// Victor: "mantenha o fundo claro... e as cores corporativas originais dos
// cards e menus", "números de métricas/KPIs devem ser grandes, limpos e
// destacados -- text-3xl ou text-4xl font-bold"). Badge arredondado (era
// uma bolinha discreta) pra "precisa de atenção" -- continua cor só no
// indicador, não no número (mesma régua de StatusBadge/CountBadge), só que
// agora como selo, não mais um ponto quase invisível.
function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
      <span className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
        {label}
        {warn && value > 0 ? (
          <span
            className="text-[10px] font-bold rounded-full px-1.5 py-0.5 normal-case tracking-normal"
            style={{ background: "var(--brand-orange-soft)", color: "var(--brand-orange)" }}
          >
            atenção
          </span>
        ) : null}
      </span>
    </div>
  );
}

// Cartão `.cartao` (rounded-2xl, sem borda, sombra suave -- mesma casca do
// Design System unificado já usado em /kpis/logistica) + traço fino colorido
// no topo carregando a identidade de cada setor (era borderTop 4px sólido
// junto com borda cinza inteira em volta -- "bordas superiores coloridas
// muito finas ou sombras suaves", pedido do Victor 18/10/2026). Padding e
// respiro maiores (p-6/gap-4, eram p-5/gap-3) -- "aumente o padding interno
// de cada card... pra eliminar a sensação de informações espremidas".
function Card({
  href,
  title,
  description,
  accent,
  children,
}: {
  href: string;
  title: string;
  description: string;
  accent: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="cartao p-6 flex flex-col gap-4 transition-transform duration-200 hover:-translate-y-0.5"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-bold tracking-wide" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>
      </div>
      {children ? <div className="flex flex-wrap gap-6">{children}</div> : null}
    </Link>
  );
}

export default async function InicioPage() {
  const profile = await getProfile();
  redirectIfSac(profile);
  // Ver OWN_ASSEMBLER_STORE_IDS -- mesma exclusão da aba Solicitações.
  const excludeOwnAssemblerStoreIds = canSeeOwnAssemblerStoreRequests(profile) ? undefined : [...OWN_ASSEMBLER_STORE_IDS];
  const [requests, parts, pendingPayments] = await Promise.all([
    countRequestsOverview(excludeOwnAssemblerStoreIds),
    countPartOrdersOverview(),
    countPendingPayments(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <RealtimeQueueRefresher />
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Olá, {profile.fullName.split(" ")[0]}. Aqui está o que precisa da sua atenção agora — tudo o que antes era
        controlado por planilha já é lançado direto aqui.
      </p>

      {/* sm:grid-cols-2 -- lg:grid-cols-3/xl:grid-cols-4 aproveitam a
          largura total que o layout ganhou (pedido do Victor 31/08/2026);
          sem esses breakpoints extras os cards ficariam com espaço vazio
          enorme dos dois lados numa tela de desktop. */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <Card href="/assistencia/fila" title="Solicitações" description="Montagem, desmontagem, recolhimento, troca de peça, vistoria e notificações." accent="var(--series-1)">
          <Stat label="Abertas sem contato" value={requests.openNoContact} warn />
          <Stat label="Aguardando aprovação de prazo" value={requests.pendingDeadline} />
          <Stat label="Concluídas hoje" value={requests.completedToday} />
        </Card>

        <Card href="/assistencia/agenda" title="Agenda" description="Visitas técnicas agendadas na casa do cliente." accent="var(--series-5)">
          <Stat label="Agendadas para hoje" value={requests.scheduledToday} />
          <Stat label="Aguardando remarcação" value={requests.needsReschedule} warn />
        </Card>

        <Card href="/assistencia/pecas" title="Peças" description="Pedidos de peça de reposição junto aos fornecedores." accent="var(--series-3)">
          <Stat label="Aguardando chegar" value={parts.awaiting} />
          <Stat label="Prontas para enviar" value={parts.readyToSend} />
        </Card>

        {/* "Fornecedores" inativada (tirada de exibição) -- pedido do Victor
            30/09/2026, mesmo padrão de Cargas/Prazos de produtos. Rota
            continua existindo, só não tem mais entrada de card aqui nem
            aba em pecas/estoque/fornecedores (ver lá). */}

        {/* --series-4 (violeta) -- mesma cor do card "Total a pagar a
            montadores" em relatorios/page.tsx (KpiCardWhite), pra manter
            o mesmo domínio (pagamento de montador) reconhecível pela cor
            em telas diferentes. */}
        <Card href="/assistencia/pagamentos" title="Pagamentos" description="Valor por item e liberação de pagamento do montador." accent="var(--series-4)">
          <Stat label="Pendentes de liberação" value={pendingPayments} warn />
        </Card>

        <Card href="/assistencia/estoque" title="Estoque" description="Registrar retiradas, devoluções e reparos no CD." accent="var(--series-7)" />

        <Card href="/assistencia/encomendas/fila" title="Encomendas" description="Pedido de produto: loja pede, fábrica produz, CD expede." accent="var(--series-2)" />

        {profile.role === "admin" ? (
          <Card href="/assistencia/admin" title="Administração" description="Contas da equipe, montadores e fornecedores." accent="var(--series-8)" />
        ) : null}

        {profile.role === "admin" ? (
          <Card
            href="https://sac.lojasmaia.com.br"
            title="KPIs do SAC ↗"
            description="Painel de indicadores de atendimento (outro sistema, domínio separado)."
            accent="var(--brand-orange)"
          />
        ) : null}
      </div>
    </div>
  );
}
