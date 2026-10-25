import type { Metadata } from "next";
import { RecarregarBotao } from "./RecarregarBotao";

// Página que o service worker mostra quando uma navegação falha sem rede.
// Estática de propósito (nenhum dado de cliente, nenhuma sessão): é a ÚNICA
// página que o SW guarda em cache. A fila de baixas pendentes aparece aqui
// pelo PwaShell do layout de /assistencia.
export const dynamic = "force-static";

export const metadata: Metadata = { title: "Sem conexão — Maia Entregas" };

export default function OfflinePage() {
  return (
    <main className="max-w-md mx-auto p-6 flex flex-col gap-4 w-full min-h-[70vh] justify-center text-center">
      <div className="text-5xl" aria-hidden>
        📶
      </div>
      <h1 className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>
        Sem conexão
      </h1>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Esta tela precisa de internet para abrir. As baixas que você já registrou ficam guardadas neste celular e são enviadas sozinhas quando a rede voltar.
      </p>
      <RecarregarBotao />
    </main>
  );
}
