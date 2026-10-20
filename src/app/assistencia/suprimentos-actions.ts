"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveEncomendaRequester, type EncomendaRequester } from "@/lib/encomendaRequester";
import { requireSuprimentoCdActor } from "@/lib/suprimentoAuth";
import { getClientIp, checkAndRecordPublicSubmission } from "@/lib/rateLimit";
import {
  createSuprimentoPedido,
  updateSuprimentoPedidoStatus,
  requireSuprimentoCdTransition,
  type NewSuprimentoPedidoItem,
  type SuprimentoPedidoStatus,
} from "@/lib/suprimentos";
import { notifyTelegramNewSuprimento } from "@/lib/telegram";

export type FormState = { error?: string } | undefined;

const SOLICITAR_PATH = "/assistencia/suprimentos/solicitar";
const FILA_PATH = "/assistencia/suprimentos/fila";

// Só gerente/caixa agem como "loja" nesse módulo -- CD/fábrica/SAC não têm
// motivo pra solicitar suprimento de uma loja (diferente de Encomendas, que
// eles também lançam em nome da loja). canEditPedido (encomendaRequester.ts)
// não serve aqui porque a janela de ação varia por ação (cancelar só em
// "solicitado", confirmar recebimento só em "enviado") -- essa função checa
// o status que a chamada específica permite.
function canStoreActOnPedido(
  requester: EncomendaRequester,
  pedido: { status: string; storeId: string },
  allowedStatus: string
): boolean {
  if (pedido.status !== allowedStatus) return false;
  if (requester.kind === "gerente") return requester.storeIds.includes(pedido.storeId);
  if (requester.kind === "caixa") return requester.storeId === pedido.storeId;
  return false;
}

// Gerente/caixa lançam o pedido direto pela tela de Suprimentos -- gated por
// resolveEncomendaRequester (mesma sessão PIN já usada em Encomendas, cookie
// path "/assistencia", chega aqui sem logar de novo).
export async function createSuprimentoPedidoAction(_state: FormState, formData: FormData): Promise<FormState> {
  const ip = await getClientIp();
  const { allowed } = await checkAndRecordPublicSubmission(ip);
  if (!allowed) {
    return { error: "Muitas solicitações enviadas em pouco tempo. Aguarde alguns minutos e tente de novo." };
  }

  const requester = await resolveEncomendaRequester();
  if (!requester) return { error: "Sessão expirada. Faça login de novo." };
  if (requester.kind !== "gerente" && requester.kind !== "caixa") {
    return { error: "Só gerente ou caixa de loja podem solicitar suprimento." };
  }

  let storeId: string;
  if (requester.kind === "gerente") {
    if (requester.storeIds.length === 1) {
      storeId = requester.storeIds[0];
    } else {
      const chosenStoreId = String(formData.get("store_id") ?? "").trim();
      if (!requester.storeIds.includes(chosenStoreId)) return { error: "Selecione uma loja válida." };
      storeId = chosenStoreId;
    }
  } else {
    storeId = requester.storeId;
  }

  const admin = getSupabaseAdmin();
  const { data: store } = await admin.from("stores").select("name").eq("id", storeId).maybeSingle();
  if (!store) return { error: "Loja inválida." };

  const produtoIds = formData.getAll("item_produto_id").map((v) => String(v).trim() || null);
  const produtoNomesLivres = formData.getAll("item_produto_nome_livre").map((v) => String(v).trim() || null);
  const unidades = formData.getAll("item_unidade").map((v) => String(v).trim() || null);
  const quantidades = formData.getAll("item_quantidade").map((v) => {
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  });
  const items: NewSuprimentoPedidoItem[] = produtoIds
    .map((produtoId, i) => ({
      produtoId,
      produtoNomeLivre: produtoNomesLivres[i] ?? null,
      quantidade: quantidades[i] ?? 1,
      unidade: unidades[i] ?? null,
    }))
    .filter((item) => item.produtoId || item.produtoNomeLivre);

  if (items.length === 0) return { error: "Adicione pelo menos um item." };

  const notes = String(formData.get("notes") ?? "").trim() || null;

  let pedidoNumber: number;
  try {
    const result = await createSuprimentoPedido({
      storeId,
      requestedByName: requester.name,
      requestedByRole: requester.kind,
      notes,
      items,
    });
    pedidoNumber = result.pedidoNumber;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível criar o pedido." };
  }

  await notifyTelegramNewSuprimento({
    pedidoNumber,
    storeName: store.name,
    requestedByName: requester.name,
    items: items.map((i) => i.produtoNomeLivre ?? "Item do catálogo"),
  });

  revalidatePath(SOLICITAR_PATH);
  revalidatePath(FILA_PATH);
  redirect(`${SOLICITAR_PATH}?enviado=1&pedido=${pedidoNumber}`);
}

// Loja desiste do próprio pedido -- só enquanto ainda "solicitado" (ninguém
// do CD mexeu ainda). Depois disso, quem decide é o Rafael (rejeitar).
export async function cancelSuprimentoPedidoAction(pedidoId: string, note: string): Promise<void> {
  const requester = await resolveEncomendaRequester();
  if (!requester) throw new Error("Sessão expirada. Faça login de novo.");

  const admin = getSupabaseAdmin();
  const { data: current, error } = await admin.from("suprimento_pedidos").select("status, store_id").eq("id", pedidoId).single();
  if (error || !current) throw new Error("Pedido não encontrado.");

  if (!canStoreActOnPedido(requester, { status: current.status, storeId: current.store_id }, "solicitado")) {
    throw new Error('Esse pedido não pode mais ser cancelado por aqui -- ou já saiu de "solicitado", ou não é seu.');
  }

  await updateSuprimentoPedidoStatus(pedidoId, { name: requester.name, role: "loja" }, current.status, "cancelado", {
    note: note.trim() || undefined,
  });

  revalidatePath(SOLICITAR_PATH);
  revalidatePath(FILA_PATH);
}

// Loja confirma que o suprimento chegou -- fecha o ciclo com rastreabilidade
// completa (igual part_orders/supplier_returns, sempre há uma confirmação de
// "chegou", não só "foi enviado").
export async function confirmarRecebimentoSuprimentoAction(pedidoId: string): Promise<void> {
  const requester = await resolveEncomendaRequester();
  if (!requester) throw new Error("Sessão expirada. Faça login de novo.");

  const admin = getSupabaseAdmin();
  const { data: current, error } = await admin.from("suprimento_pedidos").select("status, store_id").eq("id", pedidoId).single();
  if (error || !current) throw new Error("Pedido não encontrado.");

  if (!canStoreActOnPedido(requester, { status: current.status, storeId: current.store_id }, "enviado")) {
    throw new Error('Só dá pra confirmar recebimento de um pedido "enviado" da própria loja.');
  }

  await updateSuprimentoPedidoStatus(pedidoId, { name: requester.name, role: "loja" }, current.status, "recebido");

  revalidatePath(SOLICITAR_PATH);
  revalidatePath(FILA_PATH);
}

// Avanço de status pela fila do Rafael -- cada transição validada contra
// CD_SUPRIMENTO_TRANSITIONS (suprimentos.ts), mesmo espírito de
// requireEncomendaAction (dal.ts) só que bem mais simples (sem fábrica).
async function advanceSuprimentoStatus(pedidoId: string, toStatus: SuprimentoPedidoStatus, opts: { rejectionReason?: string } = {}): Promise<void> {
  const actor = await requireSuprimentoCdActor();

  const admin = getSupabaseAdmin();
  const { data: current, error } = await admin.from("suprimento_pedidos").select("status").eq("id", pedidoId).single();
  if (error || !current) throw new Error("Pedido não encontrado.");

  requireSuprimentoCdTransition(current.status, toStatus);
  await updateSuprimentoPedidoStatus(pedidoId, actor, current.status, toStatus, opts);

  revalidatePath(FILA_PATH);
  revalidatePath(SOLICITAR_PATH);
}

export async function aprovarSuprimentoAction(pedidoId: string): Promise<void> {
  await advanceSuprimentoStatus(pedidoId, "aprovado");
}

export async function rejeitarSuprimentoAction(pedidoId: string, reason: string): Promise<void> {
  if (!reason.trim()) throw new Error("Informe o motivo da recusa.");
  await advanceSuprimentoStatus(pedidoId, "rejeitado", { rejectionReason: reason });
}

export async function marcarCompradoSuprimentoAction(pedidoId: string): Promise<void> {
  await advanceSuprimentoStatus(pedidoId, "comprado");
}

export async function marcarEnviadoSuprimentoAction(pedidoId: string): Promise<void> {
  await advanceSuprimentoStatus(pedidoId, "enviado");
}
