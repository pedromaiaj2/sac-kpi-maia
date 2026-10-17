import Image from "next/image";
import Link from "next/link";
import { Home, Users, Star, MessageSquare, Wrench, MessagesSquare, Truck, LogOut } from "lucide-react";
import { signOutDashboard } from "@/app/login/actions";

// Menu lateral do painel escuro da Logística (pedido do Victor 17/10/2026):
// os mesmos destinos do AppHeader + sub-abas de KPIs, só que em ícones
// contornados. No celular vira uma faixa rolável no topo.
const ITENS = [
  { href: "/", rotulo: "Início", Icone: Home },
  { href: "/clientes", rotulo: "Clientes", Icone: Users },
  { href: "/avaliacoes", rotulo: "Avaliações", Icone: Star },
  { href: "/kpis", rotulo: "SAC", Icone: MessageSquare },
  { href: "/kpis-assistencia", rotulo: "Assistência", Icone: Wrench },
  { href: "/kpis/ghl", rotulo: "GHL", Icone: MessagesSquare },
  { href: "/kpis/logistica", rotulo: "Logística", Icone: Truck },
] as const;

const ATIVO = "/kpis/logistica";

function Item({ href, rotulo, Icone }: (typeof ITENS)[number]) {
  const ativo = href === ATIVO;
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 min-w-[64px] text-[11px] transition-colors hover:bg-[var(--surface-2)]"
      style={{ color: ativo ? "var(--text-primary)" : "var(--text-muted)", background: ativo ? "var(--surface-2)" : undefined }}
    >
      <Icone aria-hidden size={20} strokeWidth={1.75} style={{ color: ativo ? "var(--brand-green)" : undefined }} />
      <span className={ativo ? "font-semibold" : undefined}>{rotulo}</span>
    </Link>
  );
}

export function SidebarPainel() {
  return (
    <>
      <aside
        className="hidden md:flex sticky top-0 h-screen w-[88px] shrink-0 flex-col items-center gap-2 py-5 border-r"
        style={{ borderColor: "var(--border)", background: "var(--canvas)" }}
      >
        <Image src="/logo.png" alt="Lojas Maia" width={225} height={225} className="h-10 w-10 object-contain mb-3" />
        <nav className="flex flex-col gap-1" aria-label="Seções">
          {ITENS.map((i) => (
            <Item key={i.href} {...i} />
          ))}
        </nav>
        <form action={signOutDashboard} className="mt-auto">
          <button
            type="submit"
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 min-w-[64px] text-[11px] hover:bg-[var(--surface-2)]"
            style={{ color: "var(--text-muted)" }}
          >
            <LogOut aria-hidden size={20} strokeWidth={1.75} />
            Sair
          </button>
        </form>
      </aside>
      <nav
        className="md:hidden flex items-center gap-1 overflow-x-auto px-3 py-2 border-b"
        style={{ borderColor: "var(--border)", background: "var(--canvas)" }}
        aria-label="Seções"
      >
        <Image src="/logo.png" alt="Lojas Maia" width={225} height={225} className="h-8 w-8 object-contain shrink-0 mr-1" />
        {ITENS.map((i) => (
          <Item key={i.href} {...i} />
        ))}
        <form action={signOutDashboard}>
          <button type="submit" className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 min-w-[64px] text-[11px]" style={{ color: "var(--text-muted)" }}>
            <LogOut aria-hidden size={20} strokeWidth={1.75} />
            Sair
          </button>
        </form>
      </nav>
    </>
  );
}
