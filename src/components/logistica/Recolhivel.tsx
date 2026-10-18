"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ThHint } from "./ThHint";

// Seção que recolhe e expande -- pedido do Victor 18/10/2026: "possibilidade
// de recolher e expandir... todos dessa tela que façam sentido". O título vira
// um botão com seta; o "i" da explicação fica fora dele (não é botão dentro de
// botão). A escolha fica salva neste navegador por seção (`id`).
// variante "cartao": a seção inteira num cartão (blocos da tela);
// "simples": só o cabeçalho, sem cartão (grupos do mural Rotas de hoje).
// Começa recolhida (Victor 18/10/2026: "traga todos os campos recolhidos");
// chave "v2" pra quem já tinha aberto alguma também começar recolhido.
const CHAVE = (id: string) => `logistica:secao:v2:${id}`;

export function Recolhivel({
  id,
  titulo,
  hint,
  extra,
  inicialAberto = false,
  variante = "cartao",
  className = "",
  tituloClassName = "text-base font-semibold",
  children,
}: {
  id: string;
  titulo: React.ReactNode;
  hint?: string;
  // conteúdo à direita do cabeçalho (resumo), visível mesmo recolhido
  extra?: React.ReactNode;
  inicialAberto?: boolean;
  variante?: "cartao" | "simples";
  className?: string;
  tituloClassName?: string;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(inicialAberto);
  const conteudoId = useId();

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE(id));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- escolha salva só existe no navegador
      if (salvo === "1" || salvo === "0") setAberto(salvo === "1");
    } catch {
      // storage bloqueado: fica no padrão
    }
  }, [id]);

  function alternar() {
    setAberto((a) => {
      try {
        localStorage.setItem(CHAVE(id), a ? "0" : "1");
      } catch {
        // a troca vale nesta visita mesmo sem salvar
      }
      return !a;
    });
  }

  const cabecalho = (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          type="button"
          onClick={alternar}
          aria-expanded={aberto}
          aria-controls={conteudoId}
          className={`inline-flex items-center gap-2 min-w-0 rounded-lg -ml-1 px-1 py-0.5 text-left transition-colors hover:bg-[var(--surface-2)] ${tituloClassName}`}
          style={{ color: "var(--text-primary)" }}
          title={aberto ? "Recolher" : "Expandir"}
        >
          <ChevronDown
            aria-hidden
            size={18}
            className={`shrink-0 transition-transform duration-200 ${aberto ? "" : "-rotate-90"}`}
            style={{ color: "var(--text-muted)" }}
          />
          <span className="min-w-0">{titulo}</span>
        </button>
        {hint ? <ThHint hint={hint}>{null}</ThHint> : null}
      </div>
      {extra}
    </div>
  );

  if (variante === "simples") {
    return (
      <div className={`flex flex-col gap-3 min-w-0 ${className}`}>
        {cabecalho}
        <div id={conteudoId} hidden={!aberto}>
          {aberto ? children : null}
        </div>
      </div>
    );
  }

  return (
    <section
      className={`rounded-2xl p-5 sm:p-6 flex flex-col ${aberto ? "gap-4" : "gap-0"} min-w-0 shadow-lg shadow-black/20 ${className}`}
      style={{ background: "var(--surface-1)" }}
    >
      {cabecalho}
      <div id={conteudoId} hidden={!aberto} className="min-w-0">
        {aberto ? children : null}
      </div>
    </section>
  );
}
