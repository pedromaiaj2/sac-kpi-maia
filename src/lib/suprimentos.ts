import { getSupabaseAdmin } from "./supabaseAdmin";
import { notifyLoja, notifyCd } from "./notifications";
import { SUPRIMENTO_PEDIDO_STATUS_LABELS } from "./assistenciaLabels";

export type SuprimentoPedidoStatus = "solicitado" | "aprovado" | "comprado" | "enviado" | "recebido" | "rejeitado" | "cancelado";

export const SUPRIMENTO_PEDIDO_STATUSES: SuprimentoPedidoStatus[] = [
  "solicitado",
  "aprovado",
  "comprado",
  "enviado",
  "recebido",
  "rejeitado",
  "cancelado",
];

export function isSuprimentoPedidoStatus(value: string | undefined | null): value is SuprimentoPedidoStatus {
  return !!value && (SUPRIMENTO_PEDIDO_STATUSES as string[]).includes(value);
}

// Pedidos ainda não concluídos/recusados -- mesmo espírito de
// OPEN_PEDIDO_ENCOMENDA_STATUSES (pedidosEncomenda.ts).
export const OPEN_SUPRIMENTO_PEDIDO_STATUSES: SuprimentoPedidoStatus[] = ["solicitado", "aprovado", "comprado", "enviado"];

// Transições que o CD (Rafael) pode fazer -- só aprovar/rejeitar o que está
// solicitado, e avançar um passo por vez depois disso. Loja (gerente/caixa)
// não passa por aqui: ela só cria, cancela enquanto "solicitado" e confirma
// "recebido" quando "enviado" -- checado direto nas Server Actions
// (suprimentos-actions.ts), mesmo padrão de canEditPedido (encomendaRequester.ts).
const CD_SUPRIMENTO_TRANSITIONS: Record<string, SuprimentoPedidoStatus[]> = {
  solicitado: ["aprovado", "rejeitado"],
  aprovado: ["comprado"],
  comprado: ["enviado"],
};

export function requireSuprimentoCdTransition(fromStatus: string, toStatus: SuprimentoPedidoStatus): void {
  const allowed = CD_SUPRIMENTO_TRANSITIONS[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new Error(`Ação não permitida -- esse pedido está em "${SUPRIMENTO_PEDIDO_STATUS_LABELS[fromStatus] ?? fromStatus}".`);
  }
}

// --- Catálogo ---------------------------------------------------------------

export type SuprimentoProduto = { id: string; nome: string; categoria: string | null; unidade: string | null; ativo: boolean };

export async function listSuprimentoProdutos(opts: { onlyActive?: boolean } = {}): Promise<SuprimentoProduto[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("suprimento_produtos").select("id, nome, categoria, unidade, ativo").order("nome");
  if (opts.onlyActive) query = query.eq("ativo", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Cadastra um produto novo, ou atualiza categoria/unidade de um já existente
// com o mesmo nome -- mesmo padrão de upsert-por-nome de upsertProdutoEncomenda.
export async function upsertSuprimentoProduto(nome: string, categoria: string | null, unidade: string | null): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("suprimento_produtos")
    .upsert({ nome, categoria, unidade, ativo: true }, { onConflict: "nome" });
  if (error) throw new Error(error.message);
}

export async function setSuprimentoProdutoAtivo(id: string, ativo: boolean): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("suprimento_produtos").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);
}

// --- Pedidos ------------------------------------------------------------------

export type SuprimentoPedidoItem = { id: string; produtoNome: string; quantidade: number; unidade: string | null };

export type SuprimentoPedidoSummary = {
  id: string;
  pedidoNumber: number;
  storeId: string;
  storeName: string;
  status: SuprimentoPedidoStatus;
  requestedByName: string;
  requestedByRole: "gerente" | "caixa";
  notes: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  purchasedAt: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: SuprimentoPedidoItem[];
};

type PedidoRow = {
  id: string;
  pedido_number: number;
  store_id: string;
  status: SuprimentoPedidoStatus;
  requested_by_name: string;
  requested_by_role: "gerente" | "caixa";
  notes: string | null;
  rejection_reason: string | null;
  approved_at: string | null;
  purchased_at: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  stores: { name: string } | null;
  suprimento_pedido_itens:
    | {
        id: string;
        quantidade: number;
        unidade: string | null;
        produto_nome_livre: string | null;
        suprimento_produtos: { nome: string } | null;
      }[]
    | null;
};

const PEDIDO_COLUMNS =
  "id, pedido_number, store_id, status, requested_by_name, requested_by_role, notes, rejection_reason, approved_at, purchased_at, sent_at, received_at, created_at, updated_at, stores(name), suprimento_pedido_itens(id, quantidade, unidade, produto_nome_livre, suprimento_produtos(nome))";

function toSummary(row: PedidoRow): SuprimentoPedidoSummary {
  return {
    id: row.id,
    pedidoNumber: row.pedido_number,
    storeId: row.store_id,
    storeName: row.stores?.name ?? row.store_id,
    status: row.status,
    requestedByName: row.requested_by_name,
    requestedByRole: row.requested_by_role,
    notes: row.notes,
    rejectionReason: row.rejection_reason,
    approvedAt: row.approved_at,
    purchasedAt: row.purchased_at,
    sentAt: row.sent_at,
    receivedAt: row.received_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.suprimento_pedido_itens ?? []).map((i) => ({
      id: i.id,
      produtoNome: i.produto_nome_livre ?? i.suprimento_produtos?.nome ?? "Produto removido",
      quantidade: i.quantidade,
      unidade: i.unidade,
    })),
  };
}

export async function listSuprimentoPedidosByStores(
  storeIds: string[],
  opts: { onlyOpen?: boolean } = {}
): Promise<SuprimentoPedidoSummary[]> {
  if (storeIds.length === 0) return [];
  const admin = getSupabaseAdmin();
  let query = admin.from("suprimento_pedidos").select(PEDIDO_COLUMNS).in("store_id", storeIds);
  if (opts.onlyOpen) query = query.in("status", OPEN_SUPRIMENTO_PEDIDO_STATUSES);
  query = query.order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PedidoRow[]).map(toSummary);
}

export async function listAllSuprimentoPedidos(
  opts: { status?: SuprimentoPedidoStatus; onlyOpen?: boolean; storeId?: string } = {}
): Promise<SuprimentoPedidoSummary[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("suprimento_pedidos").select(PEDIDO_COLUMNS);
  if (opts.status) {
    query = query.eq("status", opts.status);
  } else if (opts.onlyOpen) {
    query = query.in("status", OPEN_SUPRIMENTO_PEDIDO_STATUSES);
  }
  if (opts.storeId) query = query.eq("store_id", opts.storeId);
  // Ascendente -- fila FIFO, mais antigo primeiro, mesmo critério de
  // listAllPedidos (pedidosEncomenda.ts).
  query = query.order("created_at", { ascending: true });
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PedidoRow[]).map(toSummary);
}

export type SuprimentoPedidoEvent = {
  id: string;
  actorName: string;
  actorRole: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
};

type EventRow = {
  id: string;
  pedido_id: string;
  actor_name: string;
  actor_role: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
};

export async function listSuprimentoEventsForPedidos(pedidoIds: string[]): Promise<Map<string, SuprimentoPedidoEvent[]>> {
  const map = new Map<string, SuprimentoPedidoEvent[]>();
  if (pedidoIds.length === 0) return map;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("suprimento_pedido_events")
    .select("id, pedido_id, actor_name, actor_role, event_type, from_status, to_status, note, created_at")
    .in("pedido_id", pedidoIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as unknown as EventRow[]) {
    const event: SuprimentoPedidoEvent = {
      id: row.id,
      actorName: row.actor_name,
      actorRole: row.actor_role,
      eventType: row.event_type,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      note: row.note,
      createdAt: row.created_at,
    };
    const list = map.get(row.pedido_id);
    if (list) list.push(event);
    else map.set(row.pedido_id, [event]);
  }
  return map;
}

export type NewSuprimentoPedidoItem = { produtoId: string | null; produtoNomeLivre: string | null; quantidade: number; unidade: string | null };

// Cria o pedido + itens + evento "created" numa sequência só -- mesma
// ressalva de createPedidoEncomenda: sem transação multi-tabela (PostgREST),
// então se os itens falharem depois do cabeçalho já criado, o pedido fica
// visível na fila sem item (pra alguém notar e corrigir) em vez de
// desaparecer silenciosamente.
export async function createSuprimentoPedido(input: {
  storeId: string;
  requestedByName: string;
  requestedByRole: "gerente" | "caixa";
  notes: string | null;
  items: NewSuprimentoPedidoItem[];
}): Promise<{ id: string; pedidoNumber: number }> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("suprimento_pedidos")
    .insert({
      store_id: input.storeId,
      requested_by_name: input.requestedByName,
      requested_by_role: input.requestedByRole,
      notes: input.notes,
    })
    .select("id, pedido_number")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Não foi possível criar o pedido.");

  const { error: itemsError } = await admin.from("suprimento_pedido_itens").insert(
    input.items.map((item) => ({
      pedido_id: data.id,
      produto_id: item.produtoId,
      produto_nome_livre: item.produtoNomeLivre,
      quantidade: item.quantidade,
      unidade: item.unidade,
    }))
  );
  if (itemsError) throw new Error(`Pedido criado, mas falhou ao salvar os itens: ${itemsError.message}`);

  await admin.from("suprimento_pedido_events").insert({
    pedido_id: data.id,
    actor_name: input.requestedByName,
    actor_role: "loja",
    event_type: "created",
    to_status: "solicitado",
  });

  await notifyCd({
    type: "novo_suprimento",
    title: `Novo pedido de suprimento #${data.pedido_number}`,
    message: `${input.items.length} ite${input.items.length === 1 ? "m" : "ns"} · pedido por ${input.requestedByName}`,
    link: `/assistencia/suprimentos/fila`,
  });

  return { id: data.id, pedidoNumber: data.pedido_number };
}

// Avança/encerra o status de um pedido, com trava otimista pelo status que a
// tela viu (fromStatus) -- mesma proteção de updatePedidoStatus
// (pedidosEncomenda.ts) contra duas pessoas agindo quase ao mesmo tempo no
// mesmo pedido.
export async function updateSuprimentoPedidoStatus(
  id: string,
  actor: { name: string; role: "loja" | "cd" | "admin" },
  fromStatus: string,
  toStatus: SuprimentoPedidoStatus,
  opts: { note?: string; rejectionReason?: string } = {}
): Promise<void> {
  const admin = getSupabaseAdmin();

  const patch: Record<string, string | null> = { status: toStatus };
  if (toStatus === "aprovado") patch.approved_at = new Date().toISOString();
  if (toStatus === "comprado") patch.purchased_at = new Date().toISOString();
  if (toStatus === "enviado") patch.sent_at = new Date().toISOString();
  if (toStatus === "recebido") patch.received_at = new Date().toISOString();
  if (toStatus === "rejeitado") patch.rejection_reason = opts.rejectionReason?.trim() || "Sem motivo informado.";

  const { data, error } = await admin
    .from("suprimento_pedidos")
    .update(patch)
    .eq("id", id)
    .eq("status", fromStatus)
    .select("id, pedido_number, store_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Esse pedido já foi atualizado por outra pessoa. Recarregue a página e tente de novo.");

  await admin.from("suprimento_pedido_events").insert({
    pedido_id: id,
    actor_name: actor.name,
    actor_role: actor.role,
    event_type: "status_changed",
    from_status: fromStatus,
    to_status: toStatus,
    note: opts.note?.trim() || opts.rejectionReason?.trim() || null,
  });

  const statusLabel = SUPRIMENTO_PEDIDO_STATUS_LABELS[toStatus] ?? toStatus;
  const title = `Suprimento #${data.pedido_number}: ${statusLabel}`;
  // CD muda status -> avisa a loja; loja muda status (cancela/confirma
  // recebimento) -> avisa o CD. actor.role "admin" (supervisão) conta como
  // CD pra esse aviso -- quem precisa saber é sempre a loja.
  if (actor.role === "loja") {
    await notifyCd({ type: "status_changed", title, message: opts.note, link: "/assistencia/suprimentos/fila" });
  } else {
    await notifyLoja(data.store_id, { type: "status_changed", title, message: opts.note, link: "/assistencia/suprimentos/solicitar" });
  }
}
