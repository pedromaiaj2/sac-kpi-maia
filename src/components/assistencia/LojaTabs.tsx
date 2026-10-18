"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Montagens", href: "/assistencia/loja" },
  { label: "Encomendas", href: "/assistencia/encomendas/caixa" },
  { label: "Trocas", href: "/assistencia/loja/trocas" },
  { label: "Estornos", href: "/assistencia/estornos" },
];

export function LojaTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2 overflow-x-auto min-w-0 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
      {TABS.map((tab) => {
        // "/assistencia/loja" também é prefixo de "/assistencia/loja/trocas", então
        // só marca a aba de Montagens como ativa numa correspondência exata.
        const isActive = tab.href === "/assistencia/loja" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            // Mesma receita de AssistenciaNav.tsx (Design System unificado,
            // 18/10/2026): fundo sutil + hover suave nas inativas, sem borda
            // (era `1px solid var(--border)`, mais "formulário" que pílula).
            className={`text-sm px-4 py-2 rounded-full shrink-0 whitespace-nowrap font-medium tracking-wide transition-colors duration-200 ${
              isActive ? "" : "bg-[var(--surface-2)] hover:bg-[var(--brand-green-soft)]"
            }`}
            style={{
              background: isActive ? "var(--brand-green)" : undefined,
              color: isActive ? "var(--brand-green-ink)" : "var(--text-secondary)",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
