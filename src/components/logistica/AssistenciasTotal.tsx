"use client";

import { useState } from "react";
import { AssistenciasMotorista } from "./AssistenciasMotorista";
import { num } from "@/lib/logisticaFormat";
import type { AssistenciaEntrega } from "@/lib/kpisLogistica";

// Card "Assistências" do topo -- pedido do Victor 14/10/2026: o total de
// chamados ligados a uma nota do período, clicável pra ver cada um.
export function AssistenciasTotal({
  itens,
  nomesMotoristas,
  periodo,
}: {
  itens: AssistenciaEntrega[];
  nomesMotoristas: Record<string, string>;
  periodo: { de: string; ate: string };
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={itens.length === 0}
        className="self-start underline decoration-dotted underline-offset-4 disabled:no-underline"
        title="Ver os chamados"
      >
        {num(itens.length)}
      </button>
      {aberto && <AssistenciasMotorista nome="todos os motoristas" itens={itens} nomesMotoristas={nomesMotoristas} periodo={periodo} onFechar={() => setAberto(false)} />}
    </>
  );
}
