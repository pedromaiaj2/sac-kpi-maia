"use client";

import { useEffect } from "react";

// Rede de segurança pra QUALQUER rota sob /assistencia/* -- achado do
// Victor 24/09/2026: montador mateusjp em conexão de celular instável
// (rede caindo no meio da resposta do servidor -- "The destination
// stream closed early" nos logs) às vezes teve uma ação de servidor
// esperada (ex.: validação de "envie foto antes de concluir") escapar do
// try/catch normal (useQuickAction.ts) e cair direto na tela crua de
// erro do React/Next ("Minified React error #441"), sem UI nenhuma nem
// jeito de tentar de novo sem sair da tela e voltar. Nenhuma rota sob
// /assistencia tinha error.tsx até então -- Next usa o fallback padrão
// (a tela crua) quando falta um.
//
// `retry` (não `reset`) -- achado na revisão de 15/10/2026 (reclamação:
// "não consigo fazer solicitação de estorno, quando está quase finalizado
// o sistema volta ao início"): essa tela usava a API antiga `reset()`, que
// só LIMPA o estado de erro e re-renderiza com o MESMO bundle JS já
// carregado -- sem buscar nada novo do servidor (ver node_modules/next/dist/docs/
// .../file-conventions/error.md, "Version History": retry virou estável na
// v16.3.0). O formulário de estorno é longo; sempre que um deploy reinicia
// `sac`/`assistencia` enquanto alguém está com a página aberta, o ID da
// Server Action que o navegador guardou fica obsoleto ("Failed to find
// Server Action... This request might be from an older or newer
// deployment" -- 3500+ ocorrências achadas nos logs de produção, não é
// raro) e cai aqui. Com `reset()`, "Tentar de novo" só limpava o
// formulário E MANTINHA o mesmo bundle obsoleto -- preencher tudo de novo
// e enviar batia no MESMO erro, num loop sem saída real (exatamente o que
// foi reportado). `retry()` busca o segmento de novo no servidor, troca
// pros chunks/Server Actions da build atual -- preencher de novo e enviar
// já funciona. Mesmo padrão já usado em src/app/error.tsx (global) desde
// 10/09/2026.
export default function AssistenciaError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[assistencia] erro não tratado:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--background)" }}>
      <div
        className="max-w-sm w-full rounded-xl border p-6 flex flex-col items-center gap-3 text-center"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <span className="text-3xl" aria-hidden>
          ⚠️
        </span>
        <h1 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
          Algo deu errado
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Pode ter sido a conexão. Toque em tentar de novo — se continuar, avise a assistência.
        </p>
        <button
          onClick={() => retry()}
          className="text-sm px-4 py-2.5 rounded-lg font-semibold w-full"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Tentar de novo
        </button>
        {error.digest ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Código: {error.digest}
          </span>
        ) : null}
      </div>
    </div>
  );
}
