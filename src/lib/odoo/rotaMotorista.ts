// Rota do dia do motorista vinda do Odoo: cargas liberadas/em rota cujo
// motorista (hr.employee) é o motorista logado aqui (casado por
// motoristaMap.ts). Supervisor de expedição (Everton/Samuel) vê todas, só
// leitura -- mesma regra da rota de trocas/recolhimento do Victor.

import { lerCarga, listarCargas, mensagemDeErro } from "./logistica";
import { empresasDoMotorista, type MotoristaSessao } from "./logisticaAuth";
import { resolverMotoristaOdoo, type CasamentoMotorista } from "./motoristaMap";
import type { CargaDetalhe, CargaOdoo } from "./logisticaTipos";

export type RotaMotoristaOdoo = {
  casamento: CasamentoMotorista;
  cargas: CargaDetalhe[];
  erros: string[];
};

export async function resolverEmQualquerEmpresa(nome: string): Promise<CasamentoMotorista> {
  let ultimo: CasamentoMotorista = { ok: false, motivo: "Nenhuma empresa configurada (ODOO_COMPANY_IDS_MOTORISTA)." };
  for (const companyId of empresasDoMotorista()) {
    ultimo = await resolverMotoristaOdoo(nome, companyId);
    if (ultimo.ok) return ultimo;
  }
  return ultimo;
}

export async function carregarRotaMotoristaOdoo(sessao: MotoristaSessao): Promise<RotaMotoristaOdoo> {
  const erros: string[] = [];
  let casamento: CasamentoMotorista;
  try {
    casamento = await resolverEmQualquerEmpresa(sessao.nome);
  } catch (err) {
    return { casamento: { ok: false, motivo: mensagemDeErro(err) }, cargas: [], erros: [mensagemDeErro(err)] };
  }
  if (!casamento.ok && !sessao.supervisor) return { casamento, cargas: [], erros };

  const resumo: CargaOdoo[] = [];
  for (const companyId of empresasDoMotorista()) {
    try {
      const lista = await listarCargas(companyId, { estados: ["liberada", "em_rota"], dias: 7, perfil: "motorista" });
      resumo.push(...lista.filter((c) => sessao.supervisor || (casamento.ok && c.motorista_id === casamento.employeeId)));
    } catch (err) {
      erros.push(`Empresa ${companyId}: ${mensagemDeErro(err)}`);
    }
  }
  const detalhes = await Promise.allSettled(resumo.map((c) => lerCarga(c.carga_id, "motorista")));
  const cargas: CargaDetalhe[] = [];
  detalhes.forEach((r, i) => {
    if (r.status === "fulfilled") cargas.push(r.value);
    else erros.push(`Carga ${resumo[i].romaneio}: ${mensagemDeErro(r.reason)}`);
  });
  // em rota primeiro, depois liberadas; dentro, a mais antiga primeiro
  cargas.sort((a, b) => (a.estado === b.estado ? a.carga_id - b.carga_id : a.estado === "em_rota" ? -1 : 1));
  return { casamento, cargas, erros };
}

// Para as ações (sair, baixa, encerrar, foto): a carga precisa ser DESTE
// motorista. Supervisor não age (só visualiza), igual à rota do Victor.
export async function exigirCargaDoMotorista(sessao: MotoristaSessao, cargaId: number): Promise<{ carga: CargaDetalhe; employeeId: number }> {
  const casamento = await resolverEmQualquerEmpresa(sessao.nome);
  if (!casamento.ok) throw new Error(casamento.motivo);
  const carga = await lerCarga(cargaId, "motorista");
  if (carga.motorista_id !== casamento.employeeId) throw new Error("Essa carga não é sua.");
  return { carga, employeeId: casamento.employeeId };
}
