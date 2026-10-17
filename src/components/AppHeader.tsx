"use client";
import Image from "next/image";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOutDashboard } from "@/app/login/actions";
import { ThemeToggle } from "@/components/ThemeToggle";

// "Relatório de Assistência" saiu daqui 27/08/2026 (pedido do Victor:
// "precisa estar dentro da aba KPIs e dentro dessa aba subaba com SAC e
// outra aba Assistencia") -- virou sub-aba de "KPIs" (KpisSectionTabs.tsx,
// dentro de /kpis e /kpis-assistencia), não item solto aqui. `pathname.
// startsWith("/kpis")` já cobre as duas rotas de propósito (mesmo prefixo).
// "Vendas" inativada (tirada de exibição) -- pedido do Victor 28/09/2026.
// A rota /vendas continua existindo, só não aparece mais aqui nem no card
// da tela inicial (ver page.tsx).
const TABS = [
  { key: "home", label: "Início", href: "/" },
  { key: "kpis", label: "KPIs", href: "/kpis" },
  { key: "clientes", label: "Clientes", href: "/clientes" },
  { key: "avaliacoes", label: "Avaliações", href: "/avaliacoes" },
];

export function AppHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    // Barra flutuante arredondada (design system 17/10/2026) no lugar da
    // faixa laranja de 3px embaixo do cabeçalho.
    <header className="cartao flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 flex-wrap">
      <Image src="/logo.png" alt="Lojas Maia" width={225} height={225} className="h-10 w-10 object-contain shrink-0" />
      {/* Abas somem na tela inicial -- pedido do Victor 24/09/2026: os 4
          cards centrais já fazem essa navegação, repetir em cima poluía o
          topo. Nas outras telas (KPIs, Clientes, Vendas, Avaliações) as
          abas continuam, é a única forma de trocar de seção por ali. */}
      {!isHome ? (
        <nav className="flex-1 flex items-center gap-1 flex-wrap">
          {TABS.map((tab) => {
            const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`text-sm tracking-wide px-4 py-1.5 rounded-full whitespace-nowrap transition-colors duration-200 ${active ? "" : "hover:bg-[var(--surface-2)]"}`}
                style={{
                  background: active ? "var(--brand-orange)" : "transparent",
                  color: active ? "#fff" : "var(--text-secondary)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      ) : (
        <div className="flex-1" />
      )}
      <ThemeToggle />
      <form action={signOutDashboard}>
        <button
          type="submit"
          className="text-sm font-medium px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 shrink-0 transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--status-critical)_10%,transparent)] hover:text-[var(--status-critical)]"
          style={{ color: "var(--text-secondary)" }}
        >
          <LogOut size={14} /> Sair
        </button>
      </form>
    </header>
  );
}
