"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Plus, Pencil } from "lucide-react";
import {
  createArsenalFlowNodeAction,
  updateArsenalFlowNodeAction,
  setArsenalFlowNodeActiveAction,
  moveArsenalFlowNodeAction,
} from "@/app/assistencia/arsenal-flow-actions";
import { useQuickAction } from "./useQuickAction";
import type { ArsenalFlowNode } from "@/lib/arsenalFlow";
import { ARSENAL_CATEGORIES, ARSENAL_HIGHLIGHT_TYPES, type ArsenalCategory, type ArsenalHighlightType } from "@/lib/arsenalSac";
import { ARSENAL_CATEGORY_LABELS, ARSENAL_HIGHLIGHT_LABELS } from "@/lib/assistenciaLabels";

const fieldClass =
  "rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150 w-full";

function NodeForm({
  node,
  parentId,
  onDone,
}: {
  node?: ArsenalFlowNode;
  parentId: string | null;
  onDone: () => void;
}) {
  const { pending, run } = useQuickAction();
  const [label, setLabel] = useState(node?.label ?? "");
  const [question, setQuestion] = useState(node?.question ?? "");
  const [body, setBody] = useState(node?.body ?? "");
  const [highlightType, setHighlightType] = useState<ArsenalHighlightType>(node?.highlightType ?? "normal");
  const [listCategory, setListCategory] = useState<ArsenalCategory | "">(node?.listCategory ?? "");

  function submit() {
    const input = { parentId, label, question, body, highlightType, listCategory };
    run(async () => {
      if (node) {
        await updateArsenalFlowNodeAction(node.id, input);
      } else {
        await createArsenalFlowNodeAction(input);
      }
      onDone();
    }, node ? "Nó atualizado." : "Nó criado.");
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 flex flex-col gap-2">
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rótulo (texto do botão)" className={fieldClass} />
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Pergunta mostrada ao entrar aqui (só se tiver sub-opções, ex.: 'Tem montagem?')"
        className={fieldClass}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Tratativa (texto final) — deixe em branco se este nó só leva a mais perguntas"
        className={fieldClass}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
          Destaque
          <select value={highlightType} onChange={(e) => setHighlightType(e.target.value as ArsenalHighlightType)} className={fieldClass}>
            <option value="normal">Nenhum</option>
            {ARSENAL_HIGHLIGHT_TYPES.filter((t) => t !== "normal").map((t) => (
              <option key={t} value={t}>
                {ARSENAL_HIGHLIGHT_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
          Abre lista de (em vez de perguntas)
          <select value={listCategory} onChange={(e) => setListCategory(e.target.value as ArsenalCategory | "")} className={fieldClass}>
            <option value="">Nenhuma</option>
            {ARSENAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {ARSENAL_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={pending || !label.trim()}
          onClick={submit}
          className="text-xs rounded-lg px-3.5 py-2 font-semibold text-white shadow-sm disabled:opacity-60"
          style={{ background: "#1B5E3C" }}
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        <button onClick={onDone} className="text-xs font-medium text-gray-500 dark:text-gray-400">
          cancelar
        </button>
      </div>
    </div>
  );
}

function NodeRow({ node, allNodes, depth }: { node: ArsenalFlowNode; allNodes: ArsenalFlowNode[]; depth: number }) {
  const { pending, run } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(depth < 1);
  const children = allNodes.filter((n) => n.parentId === node.id).sort((a, b) => a.orderIndex - b.orderIndex);

  if (editing) return <div style={{ marginLeft: depth * 18 }}>{<NodeForm node={node} parentId={node.parentId} onDone={() => setEditing(false)} />}</div>;

  return (
    <div className="flex flex-col gap-1.5" style={{ marginLeft: depth * 18 }}>
      <div
        className="flex items-center gap-2 rounded-lg border p-2.5"
        style={{
          borderColor: node.active ? "#E5E7EB" : "#F3F4F6",
          background: node.active ? "#fff" : "#FAFAFA",
          opacity: node.active ? 1 : 0.6,
        }}
      >
        <div className="flex flex-col shrink-0">
          <button onClick={() => run(() => moveArsenalFlowNodeAction(node.id, "up"))} disabled={pending} className="text-gray-400 hover:text-gray-600">
            <ChevronUp size={13} />
          </button>
          <button onClick={() => run(() => moveArsenalFlowNodeAction(node.id, "down"))} disabled={pending} className="text-gray-400 hover:text-gray-600">
            <ChevronDown size={13} />
          </button>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left text-sm font-medium text-gray-800 dark:text-gray-100 flex items-center gap-1.5"
        >
          {node.label}
          {node.listCategory ? <span className="text-xs text-gray-400">(lista: {ARSENAL_CATEGORY_LABELS[node.listCategory]})</span> : null}
          {children.length > 0 ? <span className="text-xs text-gray-400">({children.length})</span> : null}
          {!node.body && children.length === 0 && !node.listCategory ? <span className="text-xs" style={{ color: "var(--status-critical)" }}>vazio</span> : null}
        </button>
        <button onClick={() => setAdding((v) => !v)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5 shrink-0">
          <Plus size={13} /> filho
        </button>
        <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-600 shrink-0">
          <Pencil size={13} />
        </button>
        <button
          disabled={pending}
          onClick={() => run(() => setArsenalFlowNodeActiveAction(node.id, !node.active), node.active ? "Nó desativado." : "Nó reativado.")}
          className="text-xs font-medium shrink-0"
          style={{ color: node.active ? "var(--status-critical)" : "var(--status-good)" }}
        >
          {node.active ? "desativar" : "reativar"}
        </button>
      </div>
      {adding ? (
        <div style={{ marginLeft: 18 }}>
          <NodeForm parentId={node.id} onDone={() => setAdding(false)} />
        </div>
      ) : null}
      {expanded && children.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {children.map((c) => (
            <NodeRow key={c.id} node={c} allNodes={allNodes} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ArsenalFlowAdmin({ nodes }: { nodes: ArsenalFlowNode[] }) {
  const [addingRoot, setAddingRoot] = useState(false);
  const roots = nodes.filter((n) => n.parentId === null).sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Editar árvore (Fluxo guiado)</h3>
        <button onClick={() => setAddingRoot((v) => !v)} className="text-xs font-semibold flex items-center gap-1" style={{ color: "var(--brand-green)" }}>
          <Plus size={13} /> novo ramo principal
        </button>
      </div>
      {addingRoot ? <NodeForm parentId={null} onDone={() => setAddingRoot(false)} /> : null}
      <div className="flex flex-col gap-1.5">
        {roots.map((n) => (
          <NodeRow key={n.id} node={n} allNodes={nodes} depth={0} />
        ))}
      </div>
    </div>
  );
}
