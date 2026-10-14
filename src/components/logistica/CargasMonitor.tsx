"use client";

import type { CargaEntregas } from "@/lib/kpisLogistica";

// Coluna 1 do "terminal" -- lista compacta e rolável das cargas do período
// selecionado (pedido do Victor 09/10/2026: "monitor de cargas e rotas
// ativas"). Clicar numa carga filtra a tabela de motoristas abaixo pelo
// motorista dessa carga (ver LogisticaTerminal.tsx, que guarda a seleção)
// -- clicar de novo na mesma linha desmarca.
//
// "Status" não é uma coluna que existe no banco -- é derivado aqui dos
// mesmos campos que já vêm na API (pedidos/entregues/parciais/
// naoEntregues/canceladas), mesmo dado que a tabela "Ver as N cargas"
// (expandível, abaixo) já mostrava cru -- só resumido em uma palavra +
// cor pra escaneamento rápido.
// Pedido do Victor 13/10/2026: o "Alerta" passa a dizer o motivo e a cor
// segue o responsável -- vermelho só quando voltou por falha de logística
// (L01 rota estourada, L02 veículo quebrado...; L06 é do CD e não conta),
// amarelo quando voltou por cliente, CD ou outro motivo, ou teve cancelamento.
type Ocorrencias = Record<string, { descricao: string | null; categoria: string | null }>;

function motivosTexto(c: CargaEntregas, ocorrencias: Ocorrencias): string {
  const partes = Object.entries(c.insucessosPorMotivo)
    .sort((a, b) => b[1] - a[1])
    .map(([cod, n]) => `${n} × ${cod === "—" ? "sem motivo informado" : `${cod} ${ocorrencias[cod]?.descricao ?? ""}`.trim()}`);
  const linhas = [];
  if (c.naoEntregues > 0) linhas.push(`${c.naoEntregues} nota${c.naoEntregues === 1 ? "" : "s"} ${c.naoEntregues === 1 ? "voltou" : "voltaram"}: ${partes.join(", ")}`);
  if (c.canceladas > 0) linhas.push(`${c.canceladas} cancelado${c.canceladas === 1 ? "" : "s"}`);
  return linhas.join(" · ");
}

function statusCarga(c: CargaEntregas, ocorrencias: Ocorrencias): { label: string; color: string; detalhe?: string } {
  if (c.canceladas > 0 || c.naoEntregues > 0) {
    const logistica = Object.keys(c.insucessosPorMotivo).some((cod) => cod.startsWith("L") && cod !== "L06");
    return logistica
      ? { label: "Falha logística", color: "var(--status-critical)", detalhe: motivosTexto(c, ocorrencias) }
      : { label: "Voltou", color: "var(--status-warning)", detalhe: motivosTexto(c, ocorrencias) };
  }
  if (c.pedidos > 0 && c.entregues === c.pedidos) return { label: "Concluída", color: "var(--status-good)" };
  return { label: "Em rota", color: "var(--series-5)" };
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function dataBr(dia: string) {
  return dia.split("-").reverse().join("/");
}

export function CargasMonitor({
  cargas,
  ocorrencias,
  selecionada,
  onSelect,
}: {
  cargas: CargaEntregas[];
  ocorrencias: Ocorrencias;
  selecionada: string | null;
  onSelect: (carga: CargaEntregas) => void;
}) {
  if (cargas.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhuma carga despachada no período.
      </p>
    );
  }
  return (
    <div className="flex flex-col divide-y max-h-[420px] overflow-y-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
      {cargas.map((c) => {
        const status = statusCarga(c, ocorrencias);
        const unidades = c.volumes.P + c.volumes.M + c.volumes.G + c.volumes.naoClassificado;
        const ativa = selecionada === c.motorista?.codigo;
        return (
          <button
            key={c.carga}
            type="button"
            onClick={() => onSelect(c)}
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs w-full"
            style={{ background: ativa ? "var(--surface-2)" : "transparent", borderColor: "var(--border)" }}
            title={`${dataBr(c.dia)} · ${c.tipo ?? "Tipo não informado"} · ${c.tipoVeiculo}${c.veiculo ? ` (${c.veiculo})` : ""}${c.vinculo ? ` · ${c.vinculo}` : ""}${c.transportadora ? ` (${c.transportadora})` : ""}${status.detalhe ? `\n${status.detalhe}` : ""}`}
          >
            <span className="flex flex-col min-w-0">
              <span className="font-semibold tabular-nums truncate" style={{ color: "var(--text-primary)" }}>
                #{c.carga}
                <span className="ml-1.5 font-normal" style={{ color: "var(--text-muted)" }}>
                  {dataBr(c.dia)}
                </span>
              </span>
              <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                {c.motorista?.nome ?? c.motorista?.codigo ?? "Sem motorista"}
              </span>
            </span>
            <span className="flex flex-col items-end gap-0.5 shrink-0">
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 rounded-full"
                style={{ color: "var(--text-primary)", background: `color-mix(in srgb, ${status.color} 22%, var(--surface-1))` }}
              >
                <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: status.color }} />
                {status.label}
              </span>
              <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                {c.naoEntregues > 0 ? `${c.naoEntregues} volt${c.naoEntregues === 1 ? "ou" : "aram"} · ` : ""}
                {fmt(unidades)} un.
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
