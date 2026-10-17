import { SidebarApp } from "./SidebarApp";

// Casca de todas as telas do painel (Início, KPIs, Clientes, Avaliações...):
// menu lateral + área de conteúdo sobre o fundo do tema (.painel, ver
// globals.css). Usada pelos layout.tsx de cada seção e pela tela inicial.
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="painel flex-1 md:flex">
      <SidebarApp />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
