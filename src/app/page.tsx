import Link from "next/link";
import { BarChart3, Users, SquareStar } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { requireDashboardAuth } from "@/lib/dashboardSession";

// Redesenho pedido pelo Victor 24/09/2026: seção central mais imponente
// (título + subtítulo) e cards com ícone/hover mais trabalhados -- as abas
// do cabeçalho somem nessa tela (ver AppHeader.tsx), já que esses 4 cards
// fazem a mesma navegação.
const AREAS = [
  {
    href: "/kpis",
    icon: BarChart3,
    color: "var(--brand-orange)",
    title: "KPIs",
    description: "Indicadores de atendimento do SAC e desempenho da assistência técnica.",
  },
  {
    href: "/clientes",
    icon: Users,
    color: "var(--brand-green)",
    title: "Clientes",
    description: "Gestão e perfil de relacionamento de clientes ativos e inativos.",
  },
  {
    href: "/avaliacoes",
    icon: SquareStar,
    color: "var(--brand-green)",
    title: "Avaliações",
    description: "Evolução do NPS do SAC e monitoramento de avaliações do Google por loja.",
  },
];

export default async function Home() {
  await requireDashboardAuth();
  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-10">
      <AppHeader />

      <div className="flex flex-col items-center gap-2 text-center pt-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Bem-vindo ao Painel de Controle
        </h1>
        <p className="text-sm tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Selecione uma área para gerenciar
        </p>
      </div>

      {/* Cards flutuantes (design system 17/10/2026): sem borda, ícone
          grande no centro, sobem levemente no hover. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full">
        {AREAS.map((area) => {
          const Icon = area.icon;
          return (
            <Link
              key={area.href}
              href={area.href}
              className="group cartao p-7 flex flex-col items-center text-center gap-4 transition-transform duration-200 hover:-translate-y-1"
            >
              <span
                className="rounded-2xl p-4 transition-transform duration-200 group-hover:scale-105"
                style={{ background: `color-mix(in srgb, ${area.color} 14%, transparent)`, color: area.color }}
              >
                <Icon size={30} strokeWidth={1.75} />
              </span>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-lg font-bold tracking-wide" style={{ color: "var(--text-primary)" }}>
                  {area.title}
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {area.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
