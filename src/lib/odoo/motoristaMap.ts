// De-para motorista deste sistema (tabela drivers, chave = nome, login PIN)
// x motorista do Odoo (hr.employee, id numérico, usado em carga.motorista_id
// e no evento da parada).
//
// Ordem de resolução (a primeira que achar vence):
//  1. ODOO_MOTORISTA_MAP (env, JSON) -- {"Everton": 12, "Samuel": {"employeeId": 15}}
//     Explícito, sem banco. É o caminho enquanto a tabela proposta
//     (docs/sql/proposta-odoo-motorista-map.sql) não for aplicada pelo Victor.
//  2. Nome igual (sem acento/maiúscula/espaço duplo) na lista de motoristas
//     do Odoo (/logistica/catalogos). Ambíguo (2 com o mesmo nome) = NÃO
//     casa -- melhor não mostrar rota nenhuma do que mostrar a de outro.
//
// Quando a tabela odoo_motorista_map existir, ela entra como passo 0 (com
// CPF para desempatar homônimos).

import { lerCatalogos } from "./logistica";
import { nomeNormalizado } from "./logisticaTipos";

export type CasamentoMotorista =
  | { ok: true; employeeId: number; via: "env" | "nome"; nomeOdoo?: string }
  | { ok: false; motivo: string };

export function lerMapaEnv(bruto: string | undefined = process.env.ODOO_MOTORISTA_MAP): Map<string, number> {
  const out = new Map<string, number>();
  if (!bruto) return out;
  let dados: unknown;
  try {
    dados = JSON.parse(bruto);
  } catch {
    throw new Error("ODOO_MOTORISTA_MAP não é um JSON válido.");
  }
  if (!dados || typeof dados !== "object") return out;
  for (const [nome, v] of Object.entries(dados as Record<string, unknown>)) {
    const id = typeof v === "number" ? v : typeof v === "object" && v ? Number((v as { employeeId?: unknown }).employeeId) : NaN;
    if (Number.isInteger(id) && id > 0) out.set(nomeNormalizado(nome), id);
  }
  return out;
}

export function casarPorNome(nomeDriver: string, motoristasOdoo: { id: number; nome: string }[]): CasamentoMotorista {
  const alvo = nomeNormalizado(nomeDriver);
  const iguais = motoristasOdoo.filter((m) => nomeNormalizado(m.nome) === alvo);
  if (iguais.length === 1) return { ok: true, employeeId: iguais[0].id, via: "nome", nomeOdoo: iguais[0].nome };
  if (iguais.length > 1) return { ok: false, motivo: `Há ${iguais.length} motoristas "${nomeDriver}" no Odoo. Cadastre o de-para (ODOO_MOTORISTA_MAP).` };
  return { ok: false, motivo: `Motorista "${nomeDriver}" não encontrado no Odoo. Cadastre no Odoo (cargo Motorista) ou no de-para.` };
}

export async function resolverMotoristaOdoo(nomeDriver: string, companyId: number): Promise<CasamentoMotorista> {
  const env = lerMapaEnv().get(nomeNormalizado(nomeDriver));
  if (env) return { ok: true, employeeId: env, via: "env" };
  const cat = await lerCatalogos(companyId, "motorista");
  return casarPorNome(nomeDriver, cat.motoristas);
}
