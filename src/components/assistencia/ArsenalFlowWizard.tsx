"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronLeft, RotateCcw, Search } from "lucide-react";
import type { ArsenalFlowNode } from "@/lib/arsenalFlow";
import type { ArsenalEntry } from "@/lib/arsenalSac";
import { ARSENAL_HIGHLIGHT_LABELS, ARSENAL_HIGHLIGHT_COLORS } from "@/lib/assistenciaLabels";

const ROOT_QUESTION = "Qual é a situação do cliente?";

// Acento próprio desse fluxo (laranja da marca, já existe em globals.css
// como --brand-orange) -- diferente do verde usado no resto do app, pra dar
// identidade visual de "modo guiado" sem inventar paleta nova nem fugir do
// tema claro/escuro que o resto do sistema já respeita. Inspirado no
// print que o Victor mandou (trilha de passos + cartão central + botões
// grandes), adaptado aos tokens do projeto em vez de cores fixas.
const ACCENT = "var(--brand-orange)";
const ACCENT_SOFT = "var(--brand-orange-soft)";

const HIGHLIGHT_ICONS: Record<string, string> = { regra_ouro: "★", atencao: "⚠" };

function childrenOf(nodes: ArsenalFlowNode[], parentId: string | null): ArsenalFlowNode[] {
  return nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.orderIndex - b.orderIndex);
}

function OptionButton({ label, onClick, index }: { label: string; onClick: () => void; index: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 w-full text-left rounded-2xl px-4 py-3.5 transition-all duration-150"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = ACCENT)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      <span
        className="shrink-0 flex items-center justify-center rounded-full font-mono text-xs font-semibold w-7 h-7"
        style={{ background: ACCENT_SOFT, color: ACCENT }}
      >
        {index}
      </span>
      <span className="flex-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
      <ChevronRight size={16} className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" style={{ color: "var(--text-muted)" }} />
    </button>
  );
}

function Tratativa({ node }: { node: ArsenalFlowNode }) {
  const highlightColor = node.highlightType !== "normal" ? ARSENAL_HIGHLIGHT_COLORS[node.highlightType] : null;
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: highlightColor ? `color-mix(in srgb, ${highlightColor} 7%, var(--surface-1))` : "var(--surface-1)",
        border: `1px solid ${highlightColor ? `color-mix(in srgb, ${highlightColor} 40%, transparent)` : "var(--border)"}`,
        borderLeft: `4px solid ${highlightColor ?? ACCENT}`,
      }}
    >
      {highlightColor ? (
        <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: highlightColor }}>
          <span aria-hidden>{HIGHLIGHT_ICONS[node.highlightType]}</span>
          {ARSENAL_HIGHLIGHT_LABELS[node.highlightType]}
        </span>
      ) : null}
      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>
        {node.body}
      </p>
    </div>
  );
}

// Ramos 8/9 (contato interno, fornecedor) não são pergunta em cascata --
// é busca/lista direta, reaproveitando as entradas que já existem em
// arsenal_sac_entries (sem duplicar dado nem o fluxo de admin de lá).
function ListaCategoria({ entries, onVoltar }: { entries: ArsenalEntry[]; onVoltar: () => void }) {
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((e) => e.title.toLowerCase().includes(term) || e.keywords?.toLowerCase().includes(term));
  }, [entries, q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <Search size={15} style={{ color: "var(--text-muted)" }} aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome…"
          className="flex-1 text-sm bg-transparent outline-none"
          style={{ color: "var(--text-primary)" }}
        />
      </div>
      <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1">
        {filtradas.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
            Nada encontrado.
          </p>
        ) : (
          filtradas.map((entry) =>
            aberto === entry.id ? (
              <div key={entry.id} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: "var(--surface-1)", border: `1px solid ${ACCENT}` }}>
                <button type="button" onClick={() => setAberto(null)} className="self-start text-xs font-semibold" style={{ color: ACCENT }}>
                  ← {entry.title}
                </button>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>
                  {entry.body}
                </p>
              </div>
            ) : (
              <button
                key={entry.id}
                type="button"
                onClick={() => setAberto(entry.id)}
                className="flex items-center justify-between gap-2 w-full text-left rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-150"
                style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                {entry.title}
                <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
              </button>
            )
          )
        )}
      </div>
      <button type="button" onClick={onVoltar} className="self-start flex items-center gap-1 text-xs font-semibold mt-1" style={{ color: "var(--text-secondary)" }}>
        <ChevronLeft size={14} /> Voltar
      </button>
    </div>
  );
}

export function ArsenalFlowWizard({
  nodes,
  fornecedores,
  contatos,
}: {
  nodes: ArsenalFlowNode[];
  fornecedores: ArsenalEntry[];
  contatos: ArsenalEntry[];
}) {
  // Trilha = ids do caminho desde a raiz. [] = raiz ("Qual é a situação?").
  const [path, setPath] = useState<string[]>([]);

  const current = path.length > 0 ? (nodes.find((n) => n.id === path[path.length - 1]) ?? null) : null;
  const options = childrenOf(nodes, current?.id ?? null);
  const isLeaf = !!current && options.length === 0 && !current.listCategory;

  function selecionar(id: string) {
    setPath((prev) => [...prev, id]);
  }
  function voltarPara(index: number) {
    // index -1 = raiz
    setPath((prev) => prev.slice(0, index + 1));
  }
  function recomecar() {
    setPath([]);
  }

  const trilha = path.map((id) => nodes.find((n) => n.id === id)).filter((n): n is ArsenalFlowNode => !!n);

  return (
    <div className="flex flex-col gap-4">
      {/* Trilha -- mesmo espírito da trilha de passos do print de referência,
          adaptada: aqui a profundidade varia por ramo, então em vez de
          "passo 1 de 5" é uma cadeia de rótulos clicáveis pra voltar sem
          perder o caminho. */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        <button
          type="button"
          onClick={recomecar}
          className="font-semibold px-2.5 py-1 rounded-full transition-colors duration-150"
          style={current ? { color: "var(--text-secondary)" } : { background: ACCENT_SOFT, color: ACCENT }}
        >
          Início
        </button>
        {trilha.map((n, i) => (
          <span key={n.id} className="flex items-center gap-1.5">
            <span style={{ color: "var(--text-muted)" }} aria-hidden>
              ›
            </span>
            <button
              type="button"
              onClick={() => voltarPara(i)}
              className="font-semibold px-2.5 py-1 rounded-full max-w-[220px] truncate transition-colors duration-150"
              style={i === trilha.length - 1 ? { background: ACCENT_SOFT, color: ACCENT } : { color: "var(--text-secondary)" }}
              title={n.label}
            >
              {n.label}
            </button>
          </span>
        ))}
      </div>

      {/* Cartão central -- mesmo papel do cartão de imagem do print: é o
          foco único da tela, sem ruído em volta. */}
      <div className="rounded-3xl p-5 sm:p-7 flex flex-col gap-5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        {!current ? (
          <>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: ACCENT }}>
              Arsenal · Atendimento guiado
            </span>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {ROOT_QUESTION}
            </h2>
          </>
        ) : current.listCategory ? (
          <>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: ACCENT }}>
              {current.label}
            </span>
          </>
        ) : (
          <>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: ACCENT }}>
              {current.label}
            </span>
            {current.question || !isLeaf ? (
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {current.question ?? current.label}
              </h2>
            ) : null}
            {current.body && !isLeaf ? (
              <p className="text-sm -mt-2" style={{ color: "var(--text-secondary)" }}>
                {current.body}
              </p>
            ) : null}
          </>
        )}

        {current?.listCategory ? (
          <ListaCategoria entries={current.listCategory === "fornecedores" ? fornecedores : contatos} onVoltar={() => voltarPara(trilha.length - 2)} />
        ) : isLeaf ? (
          <>
            <Tratativa node={current!} />
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => voltarPara(trilha.length - 2)}
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                <ChevronLeft size={14} /> Voltar
              </button>
              <button type="button" onClick={recomecar} className="flex items-center gap-1 text-xs font-semibold" style={{ color: ACCENT }}>
                <RotateCcw size={13} /> Recomeçar
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {options.map((opt, i) => (
              <OptionButton key={opt.id} label={opt.label} index={i + 1} onClick={() => selecionar(opt.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
