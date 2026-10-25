"use server";

// Verbos do motorista sobre a carga do Odoo: sair para a rota (emite as NF
// 5117 da carga), dar baixa em cada parada (entregue / parcial / não
// consegui com motivo do catálogo, observação, geo e links das fotos) e
// encerrar a rota. A sessão é o login PIN do motorista deste sistema.

import { revalidatePath } from "next/cache";
import { executarAcaoCarga, mensagemDeErro, registrarResultadoParada } from "@/lib/odoo/logistica";
import { getMotoristaSessao } from "@/lib/odoo/logisticaAuth";
import { exigirCargaDoMotorista } from "@/lib/odoo/rotaMotorista";
import {
  montarObservacao,
  type AcaoCargaResposta,
  type ResultadoAcao,
  type ResultadoParada,
  type ResultadoParadaResposta,
} from "@/lib/odoo/logisticaTipos";

const BASE = "/assistencia/motorista/odoo";
const RESULTADOS: ResultadoParada[] = ["entregue", "entrega_parcial", "insucesso"];

async function sessaoOuErro() {
  const s = await getMotoristaSessao();
  if (!s) throw new Error("Sessão expirada. Faça login de novo.");
  return s;
}

export async function sairParaRotaAction(cargaId: number): Promise<ResultadoAcao<AcaoCargaResposta>> {
  try {
    const s = await sessaoOuErro();
    const { carga, employeeId } = await exigirCargaDoMotorista(s, cargaId);
    if (carga.estado !== "liberada") return { ok: false, erro: `A carga está "${carga.estado}", não "liberada".` };
    const r = await executarAcaoCarga(cargaId, "sair", { operador: `Motorista ${s.nome}`, motorista_id: employeeId, perfil: "motorista" });
    revalidatePath(BASE);
    return { ok: true, dados: r };
  } catch (err) {
    console.error("[motorista-odoo] sair", err);
    return { ok: false, erro: mensagemDeErro(err) };
  }
}

export async function encerrarRotaAction(cargaId: number): Promise<ResultadoAcao<AcaoCargaResposta>> {
  try {
    const s = await sessaoOuErro();
    const { carga } = await exigirCargaDoMotorista(s, cargaId);
    if (carga.estado !== "em_rota") return { ok: false, erro: "Só dá para encerrar uma rota em andamento." };
    const faltam = carga.paradas.filter((p) => !p.resultado).length;
    if (faltam) return { ok: false, erro: `Ainda falta dar baixa em ${faltam} parada(s).` };
    const r = await executarAcaoCarga(cargaId, "finalizar", { operador: `Motorista ${s.nome}`, perfil: "motorista" });
    revalidatePath(BASE);
    return { ok: true, dados: r };
  } catch (err) {
    console.error("[motorista-odoo] finalizar", err);
    return { ok: false, erro: mensagemDeErro(err) };
  }
}

export async function registrarParadaAction(
  cargaId: number,
  paradaId: number,
  entrada: {
    resultado: ResultadoParada;
    motivo?: string | null;
    obs?: string | null;
    geoLat?: number | null;
    geoLng?: number | null;
    fotoUrls?: string[];
  },
): Promise<ResultadoAcao<ResultadoParadaResposta>> {
  try {
    const s = await sessaoOuErro();
    if (!RESULTADOS.includes(entrada.resultado)) return { ok: false, erro: "Resultado inválido." };
    if (entrada.resultado === "insucesso" && !entrada.motivo) return { ok: false, erro: "Escolha o motivo." };
    const { carga, employeeId } = await exigirCargaDoMotorista(s, cargaId);
    if (carga.estado !== "em_rota") return { ok: false, erro: "A baixa só abre com a carga em rota (aperte “Saí para a rota”)." };
    const parada = carga.paradas.find((p) => p.parada_id === paradaId);
    if (!parada) return { ok: false, erro: "Essa parada não é desta carga." };
    if (parada.resultado) return { ok: false, erro: `Parada já registrada como "${parada.resultado}".` };

    // Links só do nosso próprio storage de fotos (não aceita URL arbitrária
    // vinda do navegador dentro do histórico do Odoo).
    const fotos = (entrada.fotoUrls ?? []).filter((u) => /^https?:\/\/[^\s]+\/api\/photos\/odoo-entregas\//.test(u)).slice(0, 4);
    const geoOk = typeof entrada.geoLat === "number" && typeof entrada.geoLng === "number" && Number.isFinite(entrada.geoLat) && Number.isFinite(entrada.geoLng);
    const r = await registrarResultadoParada(paradaId, {
      resultado: entrada.resultado,
      motivo: entrada.resultado === "insucesso" ? entrada.motivo : null,
      geo_lat: geoOk ? entrada.geoLat : null,
      geo_lng: geoOk ? entrada.geoLng : null,
      origem: "app",
      motorista_id: employeeId,
      obs: montarObservacao(entrada.obs, fotos),
    });
    revalidatePath(BASE);
    return { ok: true, dados: r };
  } catch (err) {
    console.error("[motorista-odoo] parada", err);
    return { ok: false, erro: mensagemDeErro(err) };
  }
}
