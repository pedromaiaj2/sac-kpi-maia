"use client";

import { useCallback, useEffect, useState } from "react";
import { RESULTADO_LABELS } from "@/lib/odoo/logisticaTipos";
import { urlDoApp } from "@/lib/pwa/base";
import { enviarFila, filaDisponivel, guardarNaFila, listarFila, tirarDaFila } from "@/lib/pwa/filaBaixas";
import { FILA_CANAL, textoPendentes, type BaixaPendente } from "@/lib/pwa/filaBaixasRegras";

// Peças da PWA que valem para toda a área /assistencia (montado no
// layout dela):
//  1. registra o service worker -- só em produção e em contexto seguro
//     (HTTPS ou localhost). Nas instâncias por IP (http) não registra, e o
//     painel segue funcionando como sempre;
//  2. aviso "Nova versão disponível" quando há SW novo em espera;
//  3. indicador "N baixas aguardando envio" da fila offline do motorista e
//     reenvio automático ao abrir o app, ao voltar ao primeiro plano e quando
//     a rede volta (fallback do Background Sync, que o iOS não tem).
// Não renderiza nada quando não há fila nem atualização.

function registrarSw(onEspera: (w: ServiceWorker) => void) {
  if (process.env.NODE_ENV !== "production") return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) return;
  // Dentro de iframe (instância ESTORNO_EMBED no portal da AIAM) não é app.
  if (window.top !== window.self) return;
  const escopo = urlDoApp("/assistencia/");
  navigator.serviceWorker
    .register(urlDoApp("/assistencia/sw.js"), { scope: escopo })
    .then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) onEspera(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const novo = reg.installing;
        novo?.addEventListener("statechange", () => {
          // "installed" com controller = atualização (sem controller = 1ª instalação)
          if (novo.state === "installed" && navigator.serviceWorker.controller) onEspera(novo);
        });
      });
      // procura versão nova a cada 30 min com o app aberto
      window.setInterval(() => void reg.update().catch(() => {}), 30 * 60_000);
    })
    .catch((e) => console.warn("[pwa] service worker não registrado", e));

  let recarregando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recarregando) return;
    recarregando = true;
    window.location.reload();
  });
}

export function PwaShell() {
  const [espera, setEspera] = useState<ServiceWorker | null>(null);
  const [fila, setFila] = useState<BaixaPendente[]>([]);
  const [online, setOnline] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const reler = useCallback(async () => {
    try {
      setFila(await listarFila());
    } catch {
      setFila([]);
    }
  }, []);

  const enviar = useCallback(
    async (manual: boolean) => {
      if (!(await filaDisponivel())) return;
      const antes = await listarFila().catch(() => [] as BaixaPendente[]);
      if (!antes.some((b) => b.estado === "pendente")) {
        await reler();
        return;
      }
      setEnviando(true);
      try {
        const r = await enviarFila();
        const partes: string[] = [];
        if (r.enviados) partes.push(r.enviados === 1 ? "1 baixa enviada." : `${r.enviados} baixas enviadas.`);
        for (const j of r.jaRegistradas) partes.push(`${j.rotulo}: ${j.erro}`);
        if (r.recusadas) partes.push(`${r.recusadas} recusada(s) — veja na lista.`);
        if (r.sessaoExpirada) partes.push("Sessão expirada: entre de novo para enviar.");
        else if (r.semRede && manual) partes.push("Ainda sem conexão.");
        if (partes.length) setAviso(partes.join(" "));
      } finally {
        setEnviando(false);
        await reler();
      }
    },
    [reler],
  );

  useEffect(() => {
    registrarSw((w) => setEspera(w));
  }, []);

  useEffect(() => {
    const atualizarRede = async () => {
      await Promise.resolve();
      setOnline(navigator.onLine);
    };
    const aoFicarOnline = () => {
      void atualizarRede();
      void enviar(false);
    };
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void enviar(false);
    };
    const aoMudar = () => void reler();
    let canal: BroadcastChannel | null = null;
    try {
      canal = new BroadcastChannel(FILA_CANAL);
      canal.onmessage = aoMudar;
    } catch {
      canal = null;
    }
    window.addEventListener("online", aoFicarOnline);
    window.addEventListener("offline", atualizarRede);
    window.addEventListener(FILA_CANAL, aoMudar);
    document.addEventListener("visibilitychange", aoVoltar);
    void atualizarRede();
    const abertura = window.setTimeout(() => void enviar(false), 0); // "ao abrir o app"
    return () => {
      window.clearTimeout(abertura);
      canal?.close();
      window.removeEventListener("online", aoFicarOnline);
      window.removeEventListener("offline", atualizarRede);
      window.removeEventListener(FILA_CANAL, aoMudar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [enviar, reler]);

  async function tentarDeNovo(b: BaixaPendente) {
    await guardarNaFila({ ...b, estado: "pendente", ultimoErro: null });
    await enviar(true);
  }

  async function descartar(b: BaixaPendente) {
    if (!window.confirm(`Descartar a baixa de ${b.rotulo}? Ela NÃO será enviada ao Odoo.`)) return;
    await tirarDaFila(b.evento_uid);
    await reler();
  }

  const comErro = fila.filter((b) => b.estado === "erro").length;

  return (
    <>
      {espera ? (
        <div role="status" className="fixed top-2 inset-x-2 z-[60] mx-auto max-w-md rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 text-sm" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
          <span className="flex-1 font-semibold">Nova versão disponível.</span>
          <button type="button" onClick={() => espera.postMessage({ tipo: "SKIP_WAITING" })} className="rounded-lg px-3 py-1.5 font-bold" style={{ background: "var(--brand-green-ink)", color: "var(--brand-green)" }}>
            Atualizar
          </button>
        </div>
      ) : null}

      {fila.length ? (
        <div className="fixed bottom-2 inset-x-2 z-[55] mx-auto max-w-md rounded-xl shadow-lg text-sm" style={{ background: "var(--surface-1)", border: `2px solid ${comErro ? "var(--status-critical)" : "var(--status-warning)"}`, color: "var(--text-primary)" }}>
          <button type="button" onClick={() => setAberto((a) => !a)} className="w-full flex items-center gap-2 px-4 py-3 text-left" aria-expanded={aberto}>
            <span aria-hidden>{online ? "⏳" : "📶"}</span>
            <span className="flex-1 font-bold">
              {textoPendentes(fila.length)}
              {comErro ? ` · ${comErro} com erro` : ""}
            </span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {enviando ? "enviando…" : online ? (aberto ? "fechar" : "ver") : "sem rede"}
            </span>
          </button>
          {aviso ? (
            <p className="px-4 pb-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              {aviso}
            </p>
          ) : null}
          {aberto ? (
            <div className="px-4 pb-3 flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
              {fila.map((b) => (
                <div key={b.evento_uid} className="rounded-lg p-2.5 flex flex-col gap-1" style={{ background: "var(--surface-2)" }}>
                  <div className="font-semibold">
                    {b.rotulo} · {RESULTADO_LABELS[b.resultado]}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Registrada {new Date(b.registradoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {b.fotos.length ? ` · ${b.fotos.length} foto(s)` : ""}
                    {b.tentativas ? ` · ${b.tentativas} tentativa(s)` : ""}
                  </div>
                  {b.ultimoErro ? (
                    <div className="text-xs" style={{ color: b.estado === "erro" ? "var(--status-critical)" : "var(--text-muted)" }}>
                      {b.ultimoErro}
                    </div>
                  ) : null}
                  {b.estado === "erro" ? (
                    <div className="flex gap-2 pt-1">
                      <button type="button" disabled={enviando} onClick={() => void tentarDeNovo(b)} className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
                        Tentar de novo
                      </button>
                      <button type="button" disabled={enviando} onClick={() => void descartar(b)} className="rounded-lg px-3 py-1.5 text-xs font-semibold border disabled:opacity-60" style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}>
                        Descartar
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              <div className="flex gap-2 items-center">
                <button type="button" disabled={enviando} onClick={() => void enviar(true)} className="rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-60" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
                  {enviando ? "Enviando…" : "Enviar agora"}
                </button>
                <a href={urlDoApp("/assistencia/motorista/login")} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
                  Entrar de novo
                </a>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
