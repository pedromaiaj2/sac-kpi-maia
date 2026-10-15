import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { PeriodoKpis } from "@/lib/logisticaApi";

// Motorista próprio x terceirizado (migração 0162), pela transportadora
// das cargas dele no Protheus.
export const VINCULOS = ["Próprio", "Terceirizado"] as const;

// Formato devolvido pela RPC kpis_logistica (migração 0157) -- o mesmo
// JSON do GET /api/logistica/v1/kpis/logistica (schema KpisLogistica do
// openapi.yaml em lojas-maia-integracao/apis/logistica-v1).
export type VolumesPorte = { P: number; M: number; G: number; naoClassificado: number };

export type CargaKpi = {
  carga: string;
  dia: string;
  tipo: string | null;
  veiculo: string | null;
  // "placa" | "motorista" (carga sem placa, motorista fixo de um Carro) | "padrao"
  tipoVeiculo: string;
  tipoVeiculoOrigem: string;
  motorista: { codigo: string; nome: string | null } | null;
  pedidos: number;
  entregues: number;
  parciais: number;
  naoEntregues: number;
  canceladas: number;
  volumes: VolumesPorte;
};

export type MotoristaVolta = {
  codigo: string;
  nome: string | null;
  cargas: number;
  visitas: number;
  entregues: number;
  entregasRealizadas: number;
  insucessos: { total: number; cliente: number; logistica: number; cd: number; outros: number };
  parciais: number;
  devolucoes: number;
  assistencias: { total: number; porCarga: number; porCpf: number; transporte: number };
  pecas: { total: number; porNf: number; porCliente: number };
  // Pós-venda consolidado (0159): peças, troca de produto, recolhimento e
  // entrega de produto novo, cada ocorrência uma vez.
  posVenda: PosVenda & { porCarga: number; porNf: number; porCliente: number };
  indiceVolta: number | null;
  indiceVoltaLogistica: number | null;
  indicePecas: number | null;
  indiceAssistencia: number | null;
};

export type PosVenda = { total: number; pecas: number; trocaProduto: number; recolhimento: number; entregaProduto: number };

export type KpisLogistica = {
  periodo: { de: string; ate: string; tipo: string | null; tipoVeiculo: string | null };
  cargasPorDia: { dia: string; cargas: number; pedidos: number }[];
  cargas: CargaKpi[];
  motoristas: MotoristaVolta[];
  pecasPeriodo: { total: number; vinculadas: number };
  posVendaPeriodo: PosVenda & { vinculadas: number };
};

// Formato da RPC kpis_entregas (migração 0162), lida só pela tela
// /kpis/logistica: as mesmas cargas e visitas, sem nada da assistência
// técnica (pedido do Victor 13/10/2026: "quero só entregas").
export type CargaEntregas = CargaKpi & {
  vinculo: string | null;
  transportadora: string | null;
  // não entregues da carga por código de ocorrência ("—" = sem código) -- 0164
  insucessosPorMotivo: Record<string, number>;
};

export type MotoristaEntregas = {
  codigo: string;
  nome: string | null;
  vinculo: string | null;
  transportadora: string | null;
  cargas: number;
  visitas: number;
  entregues: number;
  entregasRealizadas: number;
  entregasPorVeiculo: { Carro: number; "Caminhão": number; "Não identificado": number };
  insucessos: { total: number; cliente: number; logistica: number; cd: number; outros: number };
  parciais: number;
  // Chamados de assistência ligados a entregas dele (migração 0163) -- à
  // parte, não entram no Índice de Volta. porErroMotorista/porAvariaTransporte
  // (migração 0173) são um recorte por causa_raiz (erro_motorista/
  // avaria_transporte) dentro do mesmo total -- um chamado só entra num dos
  // dois (ou em nenhum, se a causa for outra) nunca nos dois.
  assistencias: {
    total: number;
    porCarga: number;
    porProduto: number;
    porCliente: number;
    porErroMotorista: number;
    porAvariaTransporte: number;
  };
  // (insucessos + parciais) ÷ visitas
  indiceVolta: number | null;
  // insucessos de logística (exceto L06) ÷ visitas
  indiceVoltaLogistica: number | null;
};

// Cargas e pedidos pela data da carga; entregas pela data da visita.
export type EntregasVeiculo = { vinculo: string; tipoVeiculo: string; cargas: number; pedidos: number; entregas: number };

export type KpisEntregas = {
  periodo: { de: string; ate: string; tipo: string | null; tipoVeiculo: string | null; vinculo: string | null };
  cargasPorDia: { dia: string; cargas: number; pedidos: number }[];
  cargas: CargaEntregas[];
  motoristas: MotoristaEntregas[];
  entregasPorVeiculo: EntregasVeiculo[];
  // Insucessos do período pelo código de ocorrência do Protheus (C01
  // cliente ausente, L01 rota estourada...), do mais comum ao menos.
  motivosInsucesso: MotivoInsucesso[];
  // Chamados de assistência do período ligados a uma entrega (lista que abre
  // ao clicar no número do motorista) e quantos chamados o período teve.
  assistencias: AssistenciaEntrega[];
  assistenciasPeriodo: { total: number; vinculadas: number };
  // Descrição/categoria de cada código de ocorrência do Protheus e cada
  // pedido que voltou sem entregar no período (abre ao clicar no motivo) -- 0164.
  ocorrencias: Record<string, { descricao: string | null; categoria: string | null }>;
  insucessos: InsucessoDetalhe[];
  // Produtos das cargas do período por classe de porte e as regras de
  // classificação por descrição -- abre ao clicar em P/M/G (0165).
  produtosPorte: ProdutoPorte[];
  regrasPorte: { padrao: string; porte: "P" | "M" | "G" }[];
  // Veículos na rua por dia (0167): placas distintas; carga sem placa usa a
  // placa do motorista no dia ou conta pelo motorista. Estimativa.
  veiculosPorDia: { dia: string; vinculo: string; tipoVeiculo: string; veiculos: number }[];
};

// porte "N" = sem classe (nenhuma regra bateu). origem: "regra" (padrão
// na descrição), "nenhuma", ou a origem do cadastro manual em produto_porte.
export type ProdutoPorte = {
  porte: "P" | "M" | "G" | "N";
  produto: string;
  descricao: string | null;
  unidades: number;
  cargas: number;
  origem: string | null;
};

export type InsucessoDetalhe = {
  dia: string;
  carga: string;
  motoristaCodigo: string;
  codigo: string | null;
  notaFiscal: string | null;
  tentativa: number | null;
  pedido: string | null;
  cliente: string | null;
  cpf: string | null;
  produtos: string | null;
};

// atribuicao: "carga" (carga informada no chamado), "produto" (entrega ao
// mesmo cliente com o produto do chamado) ou "cliente" (só pelo cliente,
// a entrega mais recente -- provável).
export type AssistenciaEntrega = {
  id: string;
  origem: "chamado" | "pedido_peca";
  ticket: string | null;
  tipo: string;
  frente: string;
  dia: string;
  produto: string | null;
  causaRaiz: string | null;
  motoristaCodigo: string;
  carga: string;
  diaEntrega: string | null;
  atribuicao: "carga" | "produto" | "cliente";
};

export type MotivoInsucesso = { codigo: string | null; descricao: string; categoria: string | null; total: number };

export function unidades(v: VolumesPorte): number {
  return v.P + v.M + v.G + v.naoClassificado;
}

export async function getKpisEntregas({ de, ate, tipo, tipoVeiculo, vinculo }: PeriodoKpis & { vinculo: string | null }): Promise<KpisEntregas> {
  const { data, error } = await getSupabaseAdmin().rpc("kpis_entregas", {
    p_de: de,
    p_ate: ate,
    p_tipo: tipo,
    p_tipo_veiculo: tipoVeiculo,
    p_vinculo: vinculo,
  });
  if (error) throw new Error(`kpis_entregas: ${error.message}`);
  return data as KpisEntregas;
}

// Lida direto no servidor pela rota da API -- a X-API-Key só protege a
// rota HTTP para consumidores de fora; aqui o service_role já fica no
// servidor e nada chega ao navegador.
export async function getKpisLogistica({ de, ate, tipo, tipoVeiculo }: PeriodoKpis): Promise<KpisLogistica> {
  const { data, error } = await getSupabaseAdmin().rpc("kpis_logistica", {
    p_de: de,
    p_ate: ate,
    p_tipo: tipo,
    p_tipo_veiculo: tipoVeiculo,
  });
  if (error) throw new Error(`kpis_logistica: ${error.message}`);
  return data as KpisLogistica;
}

// Quebra das causas que compõem o Índice de Volta (soma = numerador de
// indiceVolta) -- pedido do Victor 09/10/2026: "detalhamento das causas da
// volta" na tela. Cada chave já existia espalhada por motorista
// (MotoristaEntregas.insucessos/.parciais); aqui é
// só a soma agregada do período inteiro, pra alimentar o gráfico de
// distribuição sem recalcular nada.
export type CausasVolta = {
  insucessoCliente: number;
  insucessoLogistica: number;
  insucessoCd: number;
  insucessoOutros: number;
  parciais: number;
};

export type ResumoLogistica = {
  cargas: number;
  dias: number;
  pedidos: number;
  volumes: VolumesPorte & { total: number };
  visitas: number;
  entregues: number;
  indiceVolta: number | null;
  indiceVoltaLogistica: number | null;
  insucessosCd: number;
  causasVolta: CausasVolta;
  entregasRealizadas: number;
  entregasCarro: number;
  entregasCaminhao: number;
  entregasNaoIdentificado: number;
  // médias por dia de operação (dias com carga)
  caminhoesDia: number | null;
  stradasDia: number | null;
  naoIdentificadosDia: number | null;
};

// Coluna da grade/contagem de cada tipo de veículo. Caminhão só o que é
// caminhão de fato; carga própria sem placa fica em "Não identificado" (0169).
export type ColunaVeiculo = "Carro" | "Caminhão" | "Não identificado";
export function colunaVeiculo(tipoVeiculo: string | null | undefined): ColunaVeiculo {
  if (tipoVeiculo === "Carro" || tipoVeiculo === "Caminhão") return tipoVeiculo;
  return "Não identificado";
}

export function resumirLogistica(k: KpisEntregas): ResumoLogistica {
  const volumes = { P: 0, M: 0, G: 0, naoClassificado: 0 };
  for (const c of k.cargas) {
    volumes.P += c.volumes.P;
    volumes.M += c.volumes.M;
    volumes.G += c.volumes.G;
    volumes.naoClassificado += c.volumes.naoClassificado;
  }
  let visitas = 0;
  let entregues = 0;
  let voltas = 0;
  let voltasLogistica = 0;
  let insucessosCd = 0;
  let entregasRealizadas = 0;
  let entregasCarro = 0;
  let entregasCaminhao = 0;
  let entregasNaoIdentificado = 0;
  const causasVolta: CausasVolta = {
    insucessoCliente: 0,
    insucessoLogistica: 0,
    insucessoCd: 0,
    insucessoOutros: 0,
    parciais: 0,
  };
  for (const m of k.motoristas) {
    entregasRealizadas += m.entregasRealizadas;
    entregasCarro += m.entregasPorVeiculo.Carro;
    entregasCaminhao += m.entregasPorVeiculo["Caminhão"];
    entregasNaoIdentificado += m.entregasPorVeiculo["Não identificado"] ?? 0;
    visitas += m.visitas;
    entregues += m.entregues;
    voltas += m.insucessos.total + m.parciais;
    voltasLogistica += m.insucessos.logistica;
    insucessosCd += m.insucessos.cd;
    causasVolta.insucessoCliente += m.insucessos.cliente;
    causasVolta.insucessoLogistica += m.insucessos.logistica;
    causasVolta.insucessoCd += m.insucessos.cd;
    causasVolta.insucessoOutros += m.insucessos.outros;
    causasVolta.parciais += m.parciais;
  }
  const dias = k.cargasPorDia.length;
  const somaVeiculos = (tipo: string) => k.veiculosPorDia.filter((v) => colunaVeiculo(v.tipoVeiculo) === tipo).reduce((s, v) => s + v.veiculos, 0);
  return {
    cargas: k.cargas.length,
    dias,
    pedidos: k.cargas.reduce((s, c) => s + c.pedidos, 0),
    volumes: { ...volumes, total: volumes.P + volumes.M + volumes.G + volumes.naoClassificado },
    visitas,
    entregues,
    indiceVolta: visitas > 0 ? voltas / visitas : null,
    indiceVoltaLogistica: visitas > 0 ? voltasLogistica / visitas : null,
    insucessosCd,
    causasVolta,
    entregasRealizadas,
    entregasCarro,
    entregasCaminhao,
    entregasNaoIdentificado,
    caminhoesDia: dias > 0 ? somaVeiculos("Caminhão") / dias : null,
    stradasDia: dias > 0 ? somaVeiculos("Carro") / dias : null,
    naoIdentificadosDia: dias > 0 ? somaVeiculos("Não identificado") / dias : null,
  };
}

export type VolumeDia = { dia: string; cargas: number; caminhoes: number; stradas: number; naoIdentificados: number } & VolumesPorte;

export function volumesPorDia(k: KpisEntregas): VolumeDia[] {
  const porDia = new Map<string, VolumeDia>();
  for (const c of k.cargas) {
    const d = porDia.get(c.dia) ?? { dia: c.dia, cargas: 0, caminhoes: 0, stradas: 0, naoIdentificados: 0, P: 0, M: 0, G: 0, naoClassificado: 0 };
    d.cargas += 1;
    d.P += c.volumes.P;
    d.M += c.volumes.M;
    d.G += c.volumes.G;
    d.naoClassificado += c.volumes.naoClassificado;
    porDia.set(c.dia, d);
  }
  for (const v of k.veiculosPorDia) {
    const d = porDia.get(v.dia);
    if (!d) continue;
    const coluna = colunaVeiculo(v.tipoVeiculo);
    if (coluna === "Carro") d.stradas += v.veiculos;
    else if (coluna === "Caminhão") d.caminhoes += v.veiculos;
    else d.naoIdentificados += v.veiculos;
  }
  return [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia));
}

// produtos = unidades nas cargas (soma das quantidades dos itens);
// veiculos = soma, dia a dia, dos veículos na rua (÷ dias = média por dia).
export type CelulaVeiculo = { cargas: number; pedidos: number; entregas: number; produtos: number; veiculos: number };
export type LinhaVeiculo = { vinculo: string; total: CelulaVeiculo } & Record<ColunaVeiculo, CelulaVeiculo>;

// Grade vínculo (linhas) x veículo (colunas) a partir de entregasPorVeiculo,
// com a linha "Total" no fim. Vínculos na ordem de VINCULOS; "Sem vínculo"
// (carga sem motorista) só aparece se tiver algo. Os produtos vêm das
// cargas da lista (mesma base das cargas da grade).
export function gradeVeiculos(k: KpisEntregas): LinhaVeiculo[] {
  const vazia = (): CelulaVeiculo => ({ cargas: 0, pedidos: 0, entregas: 0, produtos: 0, veiculos: 0 });
  const somar = (a: CelulaVeiculo, b: Partial<CelulaVeiculo>) => {
    a.cargas += b.cargas ?? 0;
    a.pedidos += b.pedidos ?? 0;
    a.entregas += b.entregas ?? 0;
    a.produtos += b.produtos ?? 0;
    a.veiculos += b.veiculos ?? 0;
  };
  const nova = (vinculo: string): LinhaVeiculo => ({ vinculo, Carro: vazia(), "Caminhão": vazia(), "Não identificado": vazia(), total: vazia() });
  const linhas = new Map<string, LinhaVeiculo>();
  for (const v of VINCULOS) linhas.set(v, nova(v));
  const total = nova("Total");
  for (const e of k.entregasPorVeiculo) {
    const linha = linhas.get(e.vinculo) ?? nova(e.vinculo);
    linhas.set(e.vinculo, linha);
    const coluna = colunaVeiculo(e.tipoVeiculo);
    for (const alvo of [linha[coluna], linha.total, total[coluna], total.total]) somar(alvo, e);
  }
  for (const c of k.cargas) {
    const linha = linhas.get(c.vinculo ?? "Sem vínculo");
    if (!linha) continue;
    const coluna = colunaVeiculo(c.tipoVeiculo);
    const produtos = { produtos: unidades(c.volumes) };
    for (const alvo of [linha[coluna], linha.total, total[coluna], total.total]) somar(alvo, produtos);
  }
  for (const v of k.veiculosPorDia) {
    const linha = linhas.get(v.vinculo);
    if (!linha) continue;
    const coluna = colunaVeiculo(v.tipoVeiculo);
    const veiculos = { veiculos: v.veiculos };
    for (const alvo of [linha[coluna], linha.total, total[coluna], total.total]) somar(alvo, veiculos);
  }
  return [...linhas.values(), total];
}

// Produtos (unidades) nas cargas do período, por motorista.
export function produtosPorMotorista(cargas: CargaEntregas[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const c of cargas) {
    if (!c.motorista) continue;
    m[c.motorista.codigo] = (m[c.motorista.codigo] ?? 0) + unidades(c.volumes);
  }
  return m;
}

// Período imediatamente anterior, com a MESMA duração em dias do período
// selecionado -- pedido do Victor 09/10/2026 ("ticker" com variação vs.
// período anterior, estilo home broker). Ex.: de=01/10 ate=09/10 (9 dias)
// -> anterior = de=22/09 ate=30/09 (também 9 dias, termina 1 dia antes do
// início do período atual). Comparação só faz sentido com a mesma
// duração -- 7 dias contra 30 dias distorceria qualquer variação.
export function periodoAnterior(de: string, ate: string): { de: string; ate: string } {
  const ini = new Date(`${de}T00:00:00Z`);
  const fim = new Date(`${ate}T00:00:00Z`);
  const dias = Math.round((fim.getTime() - ini.getTime()) / 86400000) + 1;
  const anteriorFim = new Date(ini);
  anteriorFim.setUTCDate(anteriorFim.getUTCDate() - 1);
  const anteriorIni = new Date(anteriorFim);
  anteriorIni.setUTCDate(anteriorIni.getUTCDate() - (dias - 1));
  return { de: anteriorIni.toISOString().slice(0, 10), ate: anteriorFim.toISOString().slice(0, 10) };
}

// Variação de um indicador entre dois períodos -- "pp" (pontos
// percentuais) pros índices (0-1), valor bruto pros outros. `null` quando
// falta base de comparação (ex.: período anterior sem visita nenhuma).
// `melhorou` só é computado quando `menorEhMelhor` é passado (índices de
// volta/assistência) -- pra contagem bruta (cargas, pedidos, volume) não
// existe "melhor/pior", só "mais/menos" (ver IndiceTicker.tsx).
export type Variacao = { atual: number; anterior: number | null; delta: number | null; melhorou: boolean | null };

export function calcularVariacao(atual: number, anterior: number | null, menorEhMelhor?: boolean): Variacao {
  const delta = anterior === null ? null : atual - anterior;
  const melhorou = delta === null || menorEhMelhor === undefined ? null : menorEhMelhor ? delta < 0 : delta > 0;
  return { atual, anterior, delta, melhorou };
}
