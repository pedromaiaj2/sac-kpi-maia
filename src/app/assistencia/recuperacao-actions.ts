"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/dal";
import { RECUPERACAO_DONO_ID } from "@/lib/recuperacaoCore";
import { salvarCliente, validarAlteracao, listarHistorico } from "@/lib/recuperacao";
import { NPS_DETRATOR_ORIGENS, type NpsDetratorOrigem } from "@/lib/npsDetratores";

// Central de Recuperação: só a conta do Victor (pedido dele, 14/10/2026).
// Conferido aqui em toda chamada, não só na página.
async function exigirDono() {
  const profile = await getProfile();
  if (profile.id !== RECUPERACAO_DONO_ID) throw new Error("A Central de Recuperação é só do Victor.");
  return profile;
}

export type SalvarRecuperacaoState = { error?: string; ok?: boolean } | undefined;

export async function salvarRecuperacaoAction(_state: SalvarRecuperacaoState, formData: FormData): Promise<SalvarRecuperacaoState> {
  const profile = await exigirDono();
  const chave = String(formData.get("chave") ?? "");
  if (!/^(cpf:[0-9]{11}|tel:[0-9]{8}|nome:.+)$/.test(chave)) return { error: "Cliente inválido." };
  const nova = validarAlteracao({
    status: String(formData.get("status") ?? ""),
    causa: String(formData.get("causa") ?? ""),
    anotacao: String(formData.get("anotacao") ?? ""),
    proximoContato: String(formData.get("proximo_contato") ?? ""),
  });
  if (!nova) return { error: "Dados inválidos." };

  // "origem:id|motivo" de cada detrator do cliente, pra levar o status pra
  // tela de Avaliações sem apagar o motivo que a equipe escreveu lá.
  const detratores = formData
    .getAll("detrator")
    .map(String)
    .flatMap((s) => {
      const [chaveDet, ...resto] = s.split("|");
      const [origem, origemId] = chaveDet.split(":");
      if (!(NPS_DETRATOR_ORIGENS as readonly string[]).includes(origem) || !origemId) return [];
      return [{ origem: origem as NpsDetratorOrigem, origemId, motivo: resto.join("|") || null }];
    });

  await salvarCliente(chave, nova, detratores, profile.fullName);
  revalidatePath("/assistencia/recuperacao");
  return { ok: true };
}

export async function historicoRecuperacaoAction(chave: string) {
  await exigirDono();
  return listarHistorico(chave);
}
