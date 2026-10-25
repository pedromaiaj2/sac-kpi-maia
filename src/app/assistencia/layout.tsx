import type { Metadata, Viewport } from "next";
import { PwaShell } from "@/components/pwa/PwaShell";

// basePath das instâncias por IP (/apps, /apps/sac -- ver next.config.ts).
// Os links abaixo vão crus para o <head> (o Next não prefixa basePath em
// `manifest`/`icons` declarados aqui), então o prefixo entra à mão.
const BASE = process.env.NEXT_BASE_PATH ?? "";

// Título/descrição do painel de KPIs (src/app/layout.tsx) não fazem sentido
// pra esse sistema -- mesmo repositório, mas é um produto totalmente
// diferente (domínio separado, assistencia.lojasmaia.com.br). Sem isso,
// qualquer link de /assistencia/* compartilhado (WhatsApp, etc.) mostra a
// prévia errada ("Painel de KPIs — SAC Maia").
//
// PWA "Maia Entregas" (25/10/2026): manifest e ícones moram em
// public/assistencia/ (escopo /assistencia/, start_url = app do motorista);
// só esta área linka o manifest -- o painel de KPIs não vira app.
export const metadata: Metadata = {
  title: "Sistema Integrado - Lojas Maia",
  description: "Solicitações, encomendas, agenda e equipe da assistência técnica.",
  openGraph: {
    title: "Sistema Integrado - Lojas Maia",
    description: "Solicitações, encomendas, agenda e equipe da assistência técnica.",
  },
  manifest: `${BASE}/assistencia/manifest.webmanifest`,
  applicationName: "Maia Entregas",
  appleWebApp: { capable: true, title: "Maia Entregas", statusBarStyle: "default" },
  // Declarar `icons` aqui substitui o ícone de arquivo (src/app/icon.png)
  // nesta área -- por isso o favicon entra de novo, explícito.
  icons: {
    icon: [{ url: `${BASE}/icon.png`, type: "image/png", sizes: "225x225" }],
    apple: [{ url: `${BASE}/assistencia/pwa/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
  },
  // O Next 16 só emite "mobile-web-app-capable"; iOS anterior ao 16.4 ainda
  // lê o nome antigo para abrir em tela cheia pela tela de início.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#1b5e3c",
};

export default function AssistenciaRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PwaShell />
    </>
  );
}
