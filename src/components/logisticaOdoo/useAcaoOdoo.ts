"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/assistencia/ToastProvider";
import type { ResultadoAcao } from "@/lib/odoo/logisticaTipos";

// Mesmo papel do useQuickAction do Victor, mas para as actions da
// logística do Odoo, que devolvem {ok, erro} em vez de lançar (a mensagem
// real do Odoo precisa chegar no operador).
export function useAcaoOdoo() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  function run<T>(acao: () => Promise<ResultadoAcao<T>>, sucesso?: string | ((dados: T) => string), depois?: (dados: T) => void) {
    startTransition(async () => {
      try {
        const r = await acao();
        if (!r.ok) {
          showToast(r.erro, "error");
          return;
        }
        const msg = typeof sucesso === "function" ? sucesso(r.dados) : sucesso;
        if (msg) showToast(msg, "success");
        depois?.(r.dados);
        router.refresh();
      } catch (e) {
        // Falha de transporte (deploy novo trocou o ID da action, rede caiu)
        showToast(e instanceof Error ? `${e.message} — recarregue a página.` : "Erro inesperado — recarregue a página.", "error");
      }
    });
  }

  return { pending, run, showToast };
}
