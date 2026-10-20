"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { listNpsRespostasPorFaseAction, getVendaSellerRankingAction } from "@/app/kpis/actions";
import { NPS_DETRATOR_ORIGEM_LABELS, type NpsDetratorOrigem, type NpsResposta } from "@/lib/npsDetratores";
import type { VendedorRankingEntry } from "@/lib/vendaNps";
import { formatDateTimeBr } from "@/lib/formatDateTime";
import { NPS_SCORE_LABELS } from "./NpsCard";

// Ouro/prata/bronze pro pódio -- mesmo critério de GoogleReviewsSection.tsx
// (RANK_COLORS), cores fixas de medalha, não variam com claro/escuro.
const RANK_COLORS: Record<number, string> = {
  1: "#D4AF37",
  2: "#A8A9AD",
  3: "#CD7F32",
};

// CPF/CNPJ só pra leitura -- máscara simples (11 dígitos = CPF, resto
// mostra cru). Sem validação de dígito verificador aqui, é só exibição de
// um dado que já veio pronto do cadastro/pedido.
function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function scoreColor(score: number): string {
  if (score <= 2) return "var(--status-critical)";
  if (score === 3) return "var(--status-warning)";
  return "var(--status-good)";
}

// NPS índice (-100 a 100, não nota 1-5) -- mesmo critério de metaColor em
// AvaliacoesResumo.tsx: negativo é crítico de verdade, 0-39 é alerta, 40+
// é bom (NPS de mercado costuma considerar 0-30 "razoável" e 50+ "excelente"
// -- 40 como corte aqui é só visual, não é meta oficial nenhuma).
function npsIndexColor(npsIndex: number): string {
  if (npsIndex < 0) return "var(--status-critical)";
  if (npsIndex < 40) return "var(--status-warning)";
  return "var(--status-good)";
}

// Card clicável no Resumo -- pedido do Victor 28/09/2026: "ver o nome das
// pessoas que avaliaram com algum tipo de dado delas, cpf, nome e a nota".
// Busca sob demanda (só quando o modal abre, não precarrega as 5 fases na
// tela de Resumo). CPF vem null pra "sac" (conversa do GHL, sem venda por
// trás) -- mostra telefone nesse caso, mesmo critério já usado na lista de
// Detratores.
export function NpsRespostasModal({ origem, onClose }: { origem: NpsDetratorOrigem; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [respostas, setRespostas] = useState<NpsResposta[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Ranking de vendedores -- só existe pra "venda" (pedido do Victor
  // 19/10/2026, botão dentro do card "Pós-venda"). Busca sob demanda, só
  // quando o botão é clicado pela primeira vez -- não precarrega junto com
  // a lista de respostas.
  const [showRanking, setShowRanking] = useState(false);
  const [ranking, setRanking] = useState<VendedorRankingEntry[] | null>(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    listNpsRespostasPorFaseAction(origem)
      .then(setRespostas)
      .catch(() => setError("Não foi possível carregar as respostas."))
      .finally(() => setLoading(false));
  }, [origem]);

  function toggleRanking() {
    setShowRanking((v) => !v);
    if (ranking === null) {
      setRankingLoading(true);
      getVendaSellerRankingAction()
        .then(setRanking)
        .catch(() => setRankingError("Não foi possível carregar o ranking."))
        .finally(() => setRankingLoading(false));
    }
  }

  return (
    <>
      <button
        aria-label="Fechar"
        onClick={onClose}
        className="fixed inset-0 z-40 backdrop-blur-sm transition-opacity duration-200"
        style={{ background: "rgba(0,0,0,0.5)", opacity: visible ? 1 : 0 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-[6vh] z-50 mx-auto max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl transition-all duration-200 ease-out"
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.96) translateY(8px)",
        }}
      >
        <div
          className="sticky top-0 z-10 flex items-start justify-between gap-4 p-5 border-b"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <div className="min-w-0">
            <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              {NPS_DETRATOR_ORIGEM_LABELS[origem]}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {loading ? "Carregando…" : `${respostas.length} resposta${respostas.length === 1 ? "" : "s"}`}
              {origem === "sac" ? " · sem CPF nessa fonte (conversa do GHL, sem venda por trás) -- mostra telefone" : ""}
            </p>
            {origem === "venda" ? (
              <button
                type="button"
                onClick={toggleRanking}
                className="text-xs font-medium mt-1.5 rounded-full px-3 py-1"
                style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
              >
                {showRanking ? "Ver respostas" : "Ranking de vendedores"}
              </button>
            ) : null}
          </div>
          <button aria-label="Fechar" onClick={onClose} className="rounded-lg p-1.5 shrink-0 hover:opacity-70 transition-opacity" style={{ color: "var(--text-muted)" }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5">
          {showRanking ? (
            rankingLoading ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Carregando…
              </p>
            ) : rankingError ? (
              <p className="text-sm" style={{ color: "var(--status-critical)" }}>
                {rankingError}
              </p>
            ) : !ranking || ranking.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Nenhuma resposta com vendedor identificado ainda.
              </p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="px-2 py-2 text-right font-semibold" style={{ color: "var(--text-secondary)" }}>
                      #
                    </th>
                    <th className="px-2 py-2 text-left font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Vendedor
                    </th>
                    <th className="px-2 py-2 text-left font-semibold" style={{ color: "var(--text-secondary)" }}>
                      NPS
                    </th>
                    <th className="px-2 py-2 text-left font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Nota média
                    </th>
                    <th className="px-2 py-2 text-left font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Respostas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((v, i) => {
                    const rank = i + 1;
                    const rankColor = RANK_COLORS[rank];
                    return (
                      <tr
                        key={v.sellerName}
                        className="border-b"
                        style={{
                          borderColor: "var(--gridline)",
                          background: rankColor ? `color-mix(in srgb, ${rankColor} 22%, var(--surface-1))` : undefined,
                        }}
                      >
                        <td className="px-2 py-2 text-right font-semibold" style={{ color: rankColor ?? "var(--text-muted)" }}>
                          {rank}
                        </td>
                        <td className="px-2 py-2" style={{ color: "var(--text-primary)" }}>
                          {v.sellerName}
                        </td>
                        <td className="px-2 py-2 font-semibold" style={{ color: npsIndexColor(v.npsIndex) }}>
                          {v.npsIndex}
                        </td>
                        <td className="px-2 py-2 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                          {v.avgScore.toFixed(1)}
                        </td>
                        <td className="px-2 py-2 tabular-nums" style={{ color: "var(--text-muted)" }}>
                          {v.responseCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : loading ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Carregando…
            </p>
          ) : error ? (
            <p className="text-sm" style={{ color: "var(--status-critical)" }}>
              {error}
            </p>
          ) : respostas.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Nenhuma resposta ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {respostas.map((r) => (
                <div
                  key={r.origemId}
                  className="rounded-lg border p-3 flex items-center justify-between gap-3 flex-wrap"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {r.clientName ?? "Sem nome"}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {r.clientCpf ? formatCpf(r.clientCpf) : r.clientPhone ? r.clientPhone : "Sem CPF/telefone"}
                      {" · "}
                      {formatDateTimeBr(r.respondidoEm)}
                    </p>
                    {r.sellerName ? (
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        Vendedor: {r.sellerName}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-sm font-semibold shrink-0" style={{ color: scoreColor(r.score) }}>
                    {NPS_SCORE_LABELS[r.score] ?? r.score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
