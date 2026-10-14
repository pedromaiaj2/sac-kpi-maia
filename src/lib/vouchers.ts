import { randomInt } from "node:crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";
import {
  gerarCodigo,
  normalizarCodigo,
  mascararCpf,
  nomeCurto,
  statusEfetivo,
  hojeRecife,
  somenteDigitos,
  consultaBloqueada,
  LIMITE_CONSULTAS,
  type EmissaoValida,
  type MotivoVoucher,
  type ResultadoVoucher,
  type StatusVoucher,
  type TipoBeneficio,
} from "./vouchersCore";

// Acesso a dados dos vouchers de recuperação (0170_vouchers.sql). Quem
// chama já conferiu o papel/sessão (vouchers-actions.ts e as páginas):
// aqui não há checagem de permissão nenhuma.

export type Voucher = {
  id: string;
  codigo: string;
  clienteNome: string;
  clienteCpf: string;
  clienteTelefone: string | null;
  tipoBeneficio: TipoBeneficio;
  valorBeneficio: number | null;
  descricaoBeneficio: string | null;
  valorMinimo: number | null;
  motivo: MotivoVoucher;
  observacao: string | null;
  pedidoOrigem: string | null;
  origem: string;
  dataEmissao: string;
  dataValidade: string;
  status: StatusVoucher;
  emitidoPorNome: string;
  usadoEm: string | null;
  usadoPor: string | null;
  lojaUso: string | null;
  lojaUsoNome: string | null;
  cupomUso: string | null;
  canceladoEm: string | null;
  canceladoPorNome: string | null;
  motivoCancelamento: string | null;
};

type VoucherDb = {
  id: string;
  codigo: string;
  cliente_nome: string;
  cliente_cpf: string;
  cliente_telefone: string | null;
  tipo_beneficio: TipoBeneficio;
  valor_beneficio: number | string | null;
  descricao_beneficio: string | null;
  valor_minimo_compra: number | string | null;
  motivo: MotivoVoucher;
  observacao: string | null;
  pedido_origem: string | null;
  origem: string;
  data_emissao: string;
  data_validade: string;
  status: StatusVoucher;
  emitido_por_nome: string;
  usado_em: string | null;
  usado_por: string | null;
  loja_uso: string | null;
  cupom_uso: string | null;
  cancelado_em: string | null;
  cancelado_por_nome: string | null;
  motivo_cancelamento: string | null;
  stores: { name: string } | null;
};

const SELECT = "*, stores:loja_uso(name)";

const numOuNull = (v: number | string | null) => (v === null ? null : Number(v));

function mapear(r: VoucherDb, hoje: string): Voucher {
  return {
    id: r.id,
    codigo: r.codigo,
    clienteNome: r.cliente_nome,
    clienteCpf: r.cliente_cpf,
    clienteTelefone: r.cliente_telefone,
    tipoBeneficio: r.tipo_beneficio,
    valorBeneficio: numOuNull(r.valor_beneficio),
    descricaoBeneficio: r.descricao_beneficio,
    valorMinimo: numOuNull(r.valor_minimo_compra),
    motivo: r.motivo,
    observacao: r.observacao,
    pedidoOrigem: r.pedido_origem,
    origem: r.origem,
    dataEmissao: r.data_emissao,
    dataValidade: r.data_validade,
    status: statusEfetivo(r.status, r.data_validade, hoje),
    emitidoPorNome: r.emitido_por_nome,
    usadoEm: r.usado_em,
    usadoPor: r.usado_por,
    lojaUso: r.loja_uso,
    lojaUsoNome: r.stores?.name ?? r.loja_uso,
    cupomUso: r.cupom_uso,
    canceladoEm: r.cancelado_em,
    canceladoPorNome: r.cancelado_por_nome,
    motivoCancelamento: r.motivo_cancelamento,
  };
}

export async function expirarVouchers(): Promise<number> {
  const { data, error } = await getSupabaseAdmin().rpc("vouchers_expirar");
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

async function registrarEvento(e: {
  voucherId: string | null;
  codigo: string | null;
  acao: "emissao" | "consulta" | "cancelamento";
  resultado: string;
  atorTipo: "admin" | "caixa";
  atorNome: string;
  atorId?: string | null;
  lojaId?: string | null;
  detalhe?: string | null;
}) {
  const { error } = await getSupabaseAdmin()
    .from("voucher_eventos")
    .insert({
      voucher_id: e.voucherId,
      codigo_consultado: e.codigo,
      acao: e.acao,
      resultado: e.resultado,
      ator_tipo: e.atorTipo,
      ator_nome: e.atorNome,
      ator_id: e.atorId ?? null,
      loja_id: e.lojaId ?? null,
      detalhe: e.detalhe ?? null,
    });
  if (error) throw new Error(error.message);
}

export type ResultadoEmissao = { ok: true; id: string } | { ok: false; erro: string; voucherAtivoId?: string };

export async function emitirVoucher(
  dados: EmissaoValida & { origem?: string; origemId?: string | null },
  emissor: { id: string; nome: string },
): Promise<ResultadoEmissao> {
  const admin = getSupabaseAdmin();
  // Vencido ainda marcado como ativo travaria o índice de 1 ativo por CPF.
  await expirarVouchers();

  const { data: ativo } = await admin
    .from("vouchers")
    .select("id, codigo")
    .eq("cliente_cpf", dados.clienteCpf)
    .eq("status", "ativo")
    .maybeSingle();
  if (ativo) {
    return { ok: false, erro: `Este CPF já tem um voucher ativo (${ativo.codigo}). Cancele o atual antes de emitir outro.`, voucherAtivoId: ativo.id };
  }

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigo(randomInt);
    const { data, error } = await admin
      .from("vouchers")
      .insert({
        codigo,
        cliente_nome: dados.clienteNome,
        cliente_cpf: dados.clienteCpf,
        cliente_telefone: dados.clienteTelefone,
        tipo_beneficio: dados.tipoBeneficio,
        valor_beneficio: dados.valorBeneficio,
        descricao_beneficio: dados.descricaoBeneficio,
        valor_minimo_compra: dados.valorMinimoCompra,
        motivo: dados.motivo,
        observacao: dados.observacao,
        pedido_origem: dados.pedidoOrigem,
        origem: dados.origem ?? "manual",
        origem_id: dados.origemId ?? null,
        data_validade: dados.dataValidade,
        emitido_por_id: emissor.id,
        emitido_por_nome: emissor.nome,
      })
      .select("id")
      .single();
    if (!error && data) {
      await registrarEvento({ voucherId: data.id, codigo, acao: "emissao", resultado: "ok", atorTipo: "admin", atorNome: emissor.nome, atorId: emissor.id });
      return { ok: true, id: data.id };
    }
    // 23505 = unique: no código, gera outro; no CPF, alguém emitiu junto.
    if (error?.code === "23505" && error.message.includes("vouchers_um_ativo_por_cpf")) {
      return { ok: false, erro: "Este CPF acabou de ganhar um voucher ativo. Atualize a lista." };
    }
    if (error?.code !== "23505") throw new Error(error?.message ?? "Falha ao emitir o voucher");
  }
  throw new Error("Não foi possível gerar um código único. Tente de novo.");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getVoucher(id: string): Promise<Voucher | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await getSupabaseAdmin().from("vouchers").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapear(data as unknown as VoucherDb, hojeRecife()) : null;
}

export type EventoVoucher = { id: number; acao: string; resultado: string; atorTipo: string; atorNome: string; lojaId: string | null; detalhe: string | null; criadoEm: string };

export async function listarEventos(voucherId: string): Promise<EventoVoucher[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("voucher_eventos")
    .select("id, acao, resultado, ator_tipo, ator_nome, loja_id, detalhe, criado_em")
    .eq("voucher_id", voucherId)
    .order("criado_em", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => ({
    id: e.id,
    acao: e.acao,
    resultado: e.resultado,
    atorTipo: e.ator_tipo,
    atorNome: e.ator_nome,
    lojaId: e.loja_id,
    detalhe: e.detalhe,
    criadoEm: e.criado_em,
  }));
}

export type FiltrosVoucher = { status?: StatusVoucher; de?: string; ate?: string; motivo?: MotivoVoucher; emissor?: string; q?: string };

export async function listarVouchers(f: FiltrosVoucher, limite = 300): Promise<Voucher[]> {
  const hoje = hojeRecife();
  let q = getSupabaseAdmin().from("vouchers").select(SELECT).order("data_emissao", { ascending: false }).limit(limite);
  // "expirado" na tela inclui o ativo vencido que a rotina ainda não marcou.
  if (f.status === "ativo") q = q.eq("status", "ativo").gte("data_validade", hoje);
  else if (f.status === "expirado") q = q.or(`status.eq.expirado,and(status.eq.ativo,data_validade.lt.${hoje})`);
  else if (f.status) q = q.eq("status", f.status);
  if (f.de) q = q.gte("data_emissao", `${f.de}T00:00:00-03:00`);
  if (f.ate) q = q.lte("data_emissao", `${f.ate}T23:59:59.999-03:00`);
  if (f.motivo) q = q.eq("motivo", f.motivo);
  if (f.emissor) q = q.eq("emitido_por_nome", f.emissor);
  const busca = f.q?.trim();
  if (busca) {
    const digitos = somenteDigitos(busca);
    const codigo = normalizarCodigo(busca);
    if (codigo) q = q.eq("codigo", codigo);
    else if (digitos.length >= 3 && digitos.length === busca.replace(/[\s.\-/]/g, "").length) q = q.like("cliente_cpf", `%${digitos}%`);
    else q = q.ilike("cliente_nome", `%${busca.replace(/[%_]/g, "")}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as VoucherDb[]).map((r) => mapear(r, hoje));
}

export async function listarEmissores(): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin().from("vouchers").select("emitido_por_nome");
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r) => r.emitido_por_nome as string))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function cancelarVoucher(id: string, motivo: string, quem: { id: string; nome: string }): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!UUID.test(id)) return { ok: false, erro: "Voucher não encontrado." };
  const m = motivo.trim();
  if (!m) return { ok: false, erro: "Informe o motivo do cancelamento." };
  const { data, error } = await getSupabaseAdmin()
    .from("vouchers")
    .update({ status: "cancelado", cancelado_em: new Date().toISOString(), cancelado_por_id: quem.id, cancelado_por_nome: quem.nome, motivo_cancelamento: m })
    .eq("id", id)
    .in("status", ["ativo", "expirado"])
    .select("id, codigo")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ok: false, erro: "Só dá pra cancelar voucher ativo ou expirado (usado e cancelado são definitivos)." };
  await registrarEvento({ voucherId: data.id, codigo: data.codigo, acao: "cancelamento", resultado: "ok", atorTipo: "admin", atorNome: quem.nome, atorId: quem.id, detalhe: m });
  return { ok: true };
}

// ---------------------------------------------------------------- caixa

// O que o caixa vê: nunca CPF completo, telefone, motivo nem observação.
export type VisaoCaixa = {
  resultado: ResultadoVoucher;
  codigo: string | null;
  voucher: {
    codigo: string;
    status: StatusVoucher;
    tipoBeneficio: TipoBeneficio;
    valorBeneficio: number | null;
    descricaoBeneficio: string | null;
    valorMinimo: number | null;
    dataValidade: string;
    nome: string;
    cpfMascarado: string;
    usadoEm: string | null;
    lojaUsoNome: string | null;
  } | null;
};

function visaoCaixa(v: Voucher, resultado: ResultadoVoucher): VisaoCaixa {
  return {
    resultado,
    codigo: v.codigo,
    voucher: {
      codigo: v.codigo,
      status: v.status,
      tipoBeneficio: v.tipoBeneficio,
      valorBeneficio: v.valorBeneficio,
      descricaoBeneficio: v.descricaoBeneficio,
      valorMinimo: v.valorMinimo,
      dataValidade: v.dataValidade,
      nome: nomeCurto(v.clienteNome),
      cpfMascarado: mascararCpf(v.clienteCpf),
      usadoEm: v.usadoEm,
      lojaUsoNome: v.lojaUsoNome,
    },
  };
}

const RESULTADO_POR_STATUS: Record<StatusVoucher, ResultadoVoucher> = { ativo: "ok", usado: "usado", expirado: "expirado", cancelado: "cancelado" };

export type CaixaVoucher = { nome: string; storeId: string };

async function contarConsultasRecentes(caixa: string): Promise<{ inexistentes: number; total: number }> {
  const desde = new Date(Date.now() - LIMITE_CONSULTAS.janelaMin * 60_000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("voucher_eventos")
    .select("resultado")
    .eq("ator_tipo", "caixa")
    .eq("ator_nome", caixa)
    .in("acao", ["consulta", "baixa"])
    .gte("criado_em", desde);
  if (error) throw new Error(error.message);
  const linhas = data ?? [];
  return { inexistentes: linhas.filter((l) => l.resultado === "inexistente").length, total: linhas.length };
}

export async function consultarVoucherCaixa(caixa: CaixaVoucher, entrada: string): Promise<VisaoCaixa> {
  const codigo = normalizarCodigo(entrada);
  const digitado = entrada.trim().slice(0, 40);
  if (consultaBloqueada(await contarConsultasRecentes(caixa.nome))) {
    await registrarEvento({ voucherId: null, codigo: codigo ?? digitado, acao: "consulta", resultado: "bloqueado", atorTipo: "caixa", atorNome: caixa.nome, lojaId: caixa.storeId });
    return { resultado: "bloqueado", codigo, voucher: null };
  }
  const { data, error } = codigo
    ? await getSupabaseAdmin().from("vouchers").select(SELECT).eq("codigo", codigo).maybeSingle()
    : { data: null, error: null };
  if (error) throw new Error(error.message);
  if (!data) {
    await registrarEvento({ voucherId: null, codigo: codigo ?? digitado, acao: "consulta", resultado: "inexistente", atorTipo: "caixa", atorNome: caixa.nome, lojaId: caixa.storeId });
    return { resultado: "inexistente", codigo, voucher: null };
  }
  const v = mapear(data as unknown as VoucherDb, hojeRecife());
  const resultado = RESULTADO_POR_STATUS[v.status];
  await registrarEvento({ voucherId: v.id, codigo: v.codigo, acao: "consulta", resultado, atorTipo: "caixa", atorNome: caixa.nome, lojaId: caixa.storeId });
  return visaoCaixa(v, resultado);
}

export async function baixarVoucherCaixa(caixa: CaixaVoucher, entrada: string, cpf3: string, cupom: string): Promise<VisaoCaixa> {
  const codigo = normalizarCodigo(entrada);
  if (consultaBloqueada(await contarConsultasRecentes(caixa.nome))) {
    return { resultado: "bloqueado", codigo, voucher: null };
  }
  if (!codigo) {
    await registrarEvento({ voucherId: null, codigo: entrada.trim().slice(0, 40), acao: "consulta", resultado: "inexistente", atorTipo: "caixa", atorNome: caixa.nome, lojaId: caixa.storeId });
    return { resultado: "inexistente", codigo: null, voucher: null };
  }
  const { data, error } = await getSupabaseAdmin().rpc("voucher_baixar", {
    p_codigo: codigo,
    p_cpf3: somenteDigitos(cpf3),
    p_cupom: cupom,
    p_caixa: caixa.nome,
    p_loja: caixa.storeId,
  });
  if (error) throw new Error(error.message);
  const resultado = (data as { resultado: ResultadoVoucher }).resultado;
  const { data: row } = await getSupabaseAdmin().from("vouchers").select(SELECT).eq("codigo", codigo).maybeSingle();
  if (!row) return { resultado, codigo, voucher: null };
  return visaoCaixa(mapear(row as unknown as VoucherDb, hojeRecife()), resultado);
}

// ---------------------------------------------------------------- painel

export type ResumoVouchers = {
  emitidos: number;
  ativos: number;
  usados: number;
  expirados: number;
  cancelados: number;
  taxaUso: number | null;
  porLoja: { loja: string; usados: number }[];
  porMotivo: { motivo: MotivoVoucher; emitidos: number; usados: number }[];
};

// Taxa de uso = usados ÷ (emitidos - cancelados): cancelado nunca teve
// chance de ser usado.
export async function resumoVouchers(f: { de?: string; ate?: string } = {}): Promise<ResumoVouchers> {
  const hoje = hojeRecife();
  let q = getSupabaseAdmin().from("vouchers").select("status, data_validade, motivo, loja_uso, stores:loja_uso(name)");
  if (f.de) q = q.gte("data_emissao", `${f.de}T00:00:00-03:00`);
  if (f.ate) q = q.lte("data_emissao", `${f.ate}T23:59:59.999-03:00`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const linhas = ((data ?? []) as unknown as { status: StatusVoucher; data_validade: string; motivo: MotivoVoucher; loja_uso: string | null; stores: { name: string } | null }[]).map(
    (r) => ({ ...r, status: statusEfetivo(r.status, r.data_validade, hoje) }),
  );
  const conta = (s: StatusVoucher) => linhas.filter((l) => l.status === s).length;
  const porLoja = new Map<string, number>();
  const porMotivo = new Map<MotivoVoucher, { emitidos: number; usados: number }>();
  for (const l of linhas) {
    if (l.status === "usado") {
      const loja = l.stores?.name ?? l.loja_uso ?? "—";
      porLoja.set(loja, (porLoja.get(loja) ?? 0) + 1);
    }
    const m = porMotivo.get(l.motivo) ?? { emitidos: 0, usados: 0 };
    m.emitidos += 1;
    if (l.status === "usado") m.usados += 1;
    porMotivo.set(l.motivo, m);
  }
  const usados = conta("usado");
  const base = linhas.length - conta("cancelado");
  return {
    emitidos: linhas.length,
    ativos: conta("ativo"),
    usados,
    expirados: conta("expirado"),
    cancelados: conta("cancelado"),
    taxaUso: base > 0 ? usados / base : null,
    porLoja: [...porLoja].map(([loja, n]) => ({ loja, usados: n })).sort((a, b) => b.usados - a.usados),
    porMotivo: [...porMotivo].map(([motivo, v]) => ({ motivo, ...v })).sort((a, b) => b.emitidos - a.emitidos),
  };
}

// ---------------------------------------------------------------- pré-preenchimento

export type ClienteSugerido = { nome: string; telefone: string | null; cpf: string | null };

export async function buscarClientePorCpf(cpf: string): Promise<ClienteSugerido | null> {
  const d = somenteDigitos(cpf);
  if (d.length !== 11) return null;
  const { data } = await getSupabaseAdmin()
    .from("totvs_clientes")
    .select("name, phone1, phone2")
    .eq("cpf_cnpj", d)
    .limit(1)
    .maybeSingle();
  return data ? { nome: data.name, telefone: data.phone1 || data.phone2 || null, cpf: d } : null;
}

// Telefone do detrator -> cadastro do Protheus (pelos 8 últimos dígitos,
// que não mudam com DDD/9 na frente). Mais de um cliente com o mesmo
// número: não sugere CPF nenhum.
export async function buscarClientePorTelefone(telefone: string): Promise<ClienteSugerido | null> {
  const fim = somenteDigitos(telefone).slice(-8);
  if (fim.length < 8) return null;
  const { data } = await getSupabaseAdmin()
    .from("totvs_clientes")
    .select("name, cpf_cnpj, phone1, phone2")
    .or(`phone1.like.%${fim},phone2.like.%${fim}`)
    .limit(3);
  const cpfs = (data ?? []).filter((c) => somenteDigitos(c.cpf_cnpj ?? "").length === 11);
  if (cpfs.length !== 1) return null;
  return { nome: cpfs[0].name, telefone: cpfs[0].phone1 || cpfs[0].phone2 || null, cpf: somenteDigitos(cpfs[0].cpf_cnpj) };
}
