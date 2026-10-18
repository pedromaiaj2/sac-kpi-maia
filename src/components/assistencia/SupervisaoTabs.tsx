import Link from "next/link";

// Menu de abas da Supervisão (papel "supervisao", só leitura) -- pedido
// do Victor 28/09/2026 (conta da Akyla Thais). As 4 telas moram em rotas
// espalhadas (dentro e fora do grupo (app), como o SacTabs), então cada
// página que ela acessa renderiza isso informando qual aba é a sua.
const TABS = [
  { key: "estornos", label: "Estornos", href: "/assistencia/financeiro" },
  { key: "notificacoes", label: "Notificação de Assistência", href: "/assistencia/sac/notificacoes" },
  { key: "visitas", label: "Visitas", href: "/assistencia/fila" },
  { key: "reclamacoes", label: "Reclamações", href: "/assistencia/reclamacoes" },
] as const;

export type SupervisaoTabKey = (typeof TABS)[number]["key"];

// Pílulas (era sublinhado) -- mesma migração de SacTabs.tsx (Design System
// unificado, pedido do Victor 18/10/2026).
export function SupervisaoTabs({ active }: { active: SupervisaoTabKey }) {
  return (
    <nav className="flex items-center gap-1.5 overflow-x-auto min-w-0 -mx-1 px-1 pb-1">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`text-sm font-medium tracking-wide px-3.5 py-1.5 rounded-full shrink-0 whitespace-nowrap transition-colors duration-200 ${
              isActive ? "" : "bg-[var(--surface-2)] hover:bg-[var(--brand-green-soft)]"
            }`}
            style={{
              background: isActive ? "var(--brand-green)" : undefined,
              color: isActive ? "var(--brand-green-ink)" : "var(--text-secondary)",
              fontWeight: isActive ? 600 : 500,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
