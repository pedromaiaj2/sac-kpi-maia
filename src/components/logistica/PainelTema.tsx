"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Claro/escuro do painel da Logística -- pedido do Victor 17/10/2026
// ("mantenha a opção clara e dark"). O painel nasce escuro (tela de
// monitoramento) e a escolha fica salva só pra ele, separada do tema do resto
// do app (ThemeToggle/"theme").
type Tema = "escuro" | "claro";
const CHAVE = "tema-logistica";

const TemaContexto = createContext<{ tema: Tema; alternar: () => void }>({ tema: "escuro", alternar: () => {} });

export function PainelTema({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>("escuro");

  useEffect(() => {
    try {
      // Só depois de montar: o servidor não sabe a escolha salva.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(CHAVE) === "claro") setTema("claro");
    } catch {
      // storage bloqueado: fica no escuro
    }
  }, []);

  function alternar() {
    setTema((t) => {
      const novo = t === "escuro" ? "claro" : "escuro";
      try {
        localStorage.setItem(CHAVE, novo);
      } catch {
        // a troca vale nesta visita mesmo sem salvar
      }
      return novo;
    });
  }

  return (
    <TemaContexto.Provider value={{ tema, alternar }}>
      <div className={`${tema === "escuro" ? "painel-escuro" : "painel-claro"} flex-1 md:flex`}>{children}</div>
    </TemaContexto.Provider>
  );
}

export function BotaoTemaPainel() {
  const { tema, alternar } = useContext(TemaContexto);
  const escuro = tema === "escuro";
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={escuro ? "Mudar para modo claro" : "Mudar para modo escuro"}
      title={escuro ? "Modo claro" : "Modo escuro"}
      className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 min-w-[64px] text-[11px] text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
    >
      {escuro ? <Sun aria-hidden size={20} strokeWidth={1.75} /> : <Moon aria-hidden size={20} strokeWidth={1.75} />}
      {escuro ? "Claro" : "Escuro"}
    </button>
  );
}
