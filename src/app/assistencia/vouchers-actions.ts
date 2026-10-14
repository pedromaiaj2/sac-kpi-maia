"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProfile, requireRole } from "@/lib/dal";
import { CAIXA_COOKIE_NAME, verifyCaixaSession } from "@/lib/caixaAuth";
import { getCaixaStoreId } from "@/lib/caixas";
import {
  emitirVoucher,
  cancelarVoucher,
  consultarVoucherCaixa,
  baixarVoucherCaixa,
  buscarClientePorCpf,
  type VisaoCaixa,
  type CaixaVoucher,
  type ClienteSugerido,
} from "@/lib/vouchers";
import { validarEmissao, lerNumeroBr, hojeRecife } from "@/lib/vouchersCore";

// Vouchers de recuperação -- pedido do Victor 14/10/2026. Toda permissão é
// conferida aqui, no servidor, em cada chamada: admin pelo login de equipe
// (papel admin), caixa pela sessão de caixa (nome + PIN) com a loja buscada
// fresca no banco. Esconder botão na tela não protege nada.

async function exigirAdmin() {
  const profile = await getProfile();
  requireRole(profile, "admin");
  return profile;
}

async function exigirCaixa(): Promise<CaixaVoucher> {
  const cookieStore = await cookies();
  const nome = verifyCaixaSession(cookieStore.get(CAIXA_COOKIE_NAME)?.value);
  const storeId = nome ? await getCaixaStoreId(nome) : null;
  if (!nome || !storeId) throw new Error("Entre com o seu login de caixa para validar vouchers.");
  return { nome, storeId };
}

export type EmitirState = { error?: string; voucherAtivoId?: string } | undefined;

const ORIGENS = ["manual", "estorno", "estorno_request", "nps"];

export async function emitirVoucherAction(_state: EmitirState, formData: FormData): Promise<EmitirState> {
  const profile = await exigirAdmin();
  const txt = (k: string) => String(formData.get(k) ?? "");
  const valor = lerNumeroBr(txt("valor_beneficio"));
  const minimo = lerNumeroBr(txt("valor_minimo_compra"));
  if (Number.isNaN(valor)) return { error: "Valor do benefício inválido." };
  if (Number.isNaN(minimo)) return { error: "Valor mínimo de compra inválido." };

  const v = validarEmissao(
    {
      clienteNome: txt("cliente_nome"),
      clienteCpf: txt("cliente_cpf"),
      clienteTelefone: txt("cliente_telefone") || null,
      tipoBeneficio: txt("tipo_beneficio"),
      valorBeneficio: valor,
      descricaoBeneficio: txt("descricao_beneficio") || null,
      valorMinimoCompra: minimo,
      motivo: txt("motivo"),
      observacao: txt("observacao") || null,
      pedidoOrigem: txt("pedido_origem") || null,
      dataValidade: txt("data_validade"),
    },
    hojeRecife(),
  );
  if (!v.ok) return { error: v.erro };

  const origem = ORIGENS.includes(txt("origem")) ? txt("origem") : "manual";
  const r = await emitirVoucher({ ...v.dados, origem, origemId: txt("origem_id") || null }, { id: profile.id, nome: profile.fullName });
  if (!r.ok) return { error: r.erro, voucherAtivoId: r.voucherAtivoId };
  revalidatePath("/assistencia/vouchers");
  redirect(`/assistencia/vouchers/${r.id}`);
}

export type CancelarState = { error?: string; ok?: boolean } | undefined;

export async function cancelarVoucherAction(_state: CancelarState, formData: FormData): Promise<CancelarState> {
  const profile = await exigirAdmin();
  const id = String(formData.get("id") ?? "");
  const r = await cancelarVoucher(id, String(formData.get("motivo_cancelamento") ?? ""), { id: profile.id, nome: profile.fullName });
  if (!r.ok) return { error: r.erro };
  revalidatePath(`/assistencia/vouchers/${id}`);
  revalidatePath("/assistencia/vouchers");
  return { ok: true };
}

export async function buscarClienteAction(cpf: string): Promise<ClienteSugerido | null> {
  await exigirAdmin();
  return buscarClientePorCpf(cpf);
}

export async function consultarVoucherAction(codigo: string): Promise<VisaoCaixa | { erro: string }> {
  let caixa: CaixaVoucher;
  try {
    caixa = await exigirCaixa();
  } catch (e) {
    return { erro: (e as Error).message };
  }
  return consultarVoucherCaixa(caixa, codigo);
}

export async function baixarVoucherAction(codigo: string, cpf3: string, cupom: string): Promise<VisaoCaixa | { erro: string }> {
  let caixa: CaixaVoucher;
  try {
    caixa = await exigirCaixa();
  } catch (e) {
    return { erro: (e as Error).message };
  }
  if (!/^\d{3}$/.test(cpf3.trim())) return { erro: "Digite os 3 primeiros dígitos do CPF do documento." };
  if (!cupom.trim()) return { erro: "Informe o número do cupom fiscal ou do pedido da venda." };
  return baixarVoucherCaixa(caixa, codigo, cpf3.trim(), cupom.trim().slice(0, 60));
}
