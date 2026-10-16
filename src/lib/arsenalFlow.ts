import { getSupabaseAdmin } from "./supabaseAdmin.ts";
import { isArsenalCategory, type ArsenalCategory, type ArsenalHighlightType } from "./arsenalSac.ts";

export type ArsenalFlowNode = {
  id: string;
  parentId: string | null;
  slug: string;
  label: string;
  question: string | null;
  body: string | null;
  highlightType: ArsenalHighlightType;
  listCategory: ArsenalCategory | null;
  orderIndex: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type ArsenalFlowNodeRow = {
  id: string;
  parent_id: string | null;
  slug: string;
  label: string;
  question: string | null;
  body: string | null;
  highlight_type: string;
  list_category: string | null;
  order_index: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const NODE_COLUMNS = "id, parent_id, slug, label, question, body, highlight_type, list_category, order_index, active, created_at, updated_at";

function toArsenalFlowNode(row: ArsenalFlowNodeRow): ArsenalFlowNode {
  return {
    id: row.id,
    parentId: row.parent_id,
    slug: row.slug,
    label: row.label,
    question: row.question,
    body: row.body,
    highlightType: (row.highlight_type as ArsenalHighlightType) ?? "normal",
    listCategory: isArsenalCategory(row.list_category) ? row.list_category : null,
    orderIndex: row.order_index,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Árvore inteira (hoje ~25 nós) num SELECT só -- o wizard (client component)
// monta a navegação em memória a partir da lista plana, sem round-trip ao
// servidor a cada clique (pedido do Victor: "mais dinâmico"). `onlyActive`
// false é usado só pela tela de administração (precisa ver/editar nó
// desativado).
export async function listArsenalFlowNodes(opts: { onlyActive?: boolean } = {}): Promise<ArsenalFlowNode[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("arsenal_flow_nodes").select(NODE_COLUMNS).order("parent_id", { nullsFirst: true }).order("order_index");
  if (opts.onlyActive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ArsenalFlowNodeRow[]).map(toArsenalFlowNode);
}

// Mesma função de slug de arsenalSac.ts (buildArsenalSlug), mas incorporando
// o caminho do pai -- "Sim"/"Não" se repete em vários ramos, só o prefixo
// do pai garante slug único em toda a árvore.
function normalizeSlugPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildArsenalFlowSlug(parentSlug: string | null, label: string): string {
  const part = normalizeSlugPart(label);
  return parentSlug ? `${parentSlug}-${part}` : part;
}

export type ArsenalFlowNodeInput = {
  parentId: string | null;
  label: string;
  question: string | null;
  body: string | null;
  highlightType: ArsenalHighlightType;
  listCategory: ArsenalCategory | null;
};

// Slug não é recalculado num update (mesmo motivo de updateArsenalEntry em
// arsenalSac.ts) -- precisa ser estável pra reseed idempotente não duplicar.
export async function createArsenalFlowNode(input: ArsenalFlowNodeInput): Promise<void> {
  const admin = getSupabaseAdmin();
  let parentSlug: string | null = null;
  if (input.parentId) {
    const { data, error } = await admin.from("arsenal_flow_nodes").select("slug").eq("id", input.parentId).maybeSingle();
    if (error) throw new Error(error.message);
    parentSlug = data?.slug ?? null;
  }
  const slug = buildArsenalFlowSlug(parentSlug, input.label);
  let siblingsQuery = admin.from("arsenal_flow_nodes").select("order_index").order("order_index", { ascending: false }).limit(1);
  siblingsQuery = input.parentId ? siblingsQuery.eq("parent_id", input.parentId) : siblingsQuery.is("parent_id", null);
  const { data: siblings, error: siblingsError } = await siblingsQuery;
  if (siblingsError) throw new Error(siblingsError.message);
  const nextOrder = ((siblings?.[0] as { order_index: number } | undefined)?.order_index ?? -1) + 1;

  const { error } = await admin.from("arsenal_flow_nodes").insert({
    parent_id: input.parentId,
    slug,
    label: input.label.trim(),
    question: input.question?.trim() || null,
    body: input.body?.trim() || null,
    highlight_type: input.highlightType,
    list_category: input.listCategory,
    order_index: nextOrder,
  });
  if (error) throw new Error(error.message);
}

export async function updateArsenalFlowNode(id: string, input: Omit<ArsenalFlowNodeInput, "parentId">): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("arsenal_flow_nodes")
    .update({
      label: input.label.trim(),
      question: input.question?.trim() || null,
      body: input.body?.trim() || null,
      highlight_type: input.highlightType,
      list_category: input.listCategory,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setArsenalFlowNodeActive(id: string, active: boolean): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("arsenal_flow_nodes").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}

// Troca a ordem com o irmão anterior/seguinte (mesmo nível) -- setas
// pra cima/baixo na tela de admin, sem drag-and-drop na v1.
export async function moveArsenalFlowNode(id: string, direction: "up" | "down"): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: node, error: nodeError } = await admin.from("arsenal_flow_nodes").select("id, parent_id, order_index").eq("id", id).maybeSingle();
  if (nodeError) throw new Error(nodeError.message);
  if (!node) return;

  let siblingQuery = admin
    .from("arsenal_flow_nodes")
    .select("id, order_index")
    .order("order_index", { ascending: direction === "up" ? false : true })
    .limit(1);
  siblingQuery = node.parent_id ? siblingQuery.eq("parent_id", node.parent_id) : siblingQuery.is("parent_id", null);
  siblingQuery = direction === "up" ? siblingQuery.lt("order_index", node.order_index) : siblingQuery.gt("order_index", node.order_index);
  const { data: siblings, error: siblingError } = await siblingQuery;
  if (siblingError) throw new Error(siblingError.message);
  const sibling = siblings?.[0] as { id: string; order_index: number } | undefined;
  if (!sibling) return;

  const { error: errA } = await admin.from("arsenal_flow_nodes").update({ order_index: sibling.order_index }).eq("id", node.id);
  if (errA) throw new Error(errA.message);
  const { error: errB } = await admin.from("arsenal_flow_nodes").update({ order_index: node.order_index }).eq("id", sibling.id);
  if (errB) throw new Error(errB.message);
}
