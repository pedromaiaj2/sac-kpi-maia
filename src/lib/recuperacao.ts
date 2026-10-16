import { getSupabaseAdmin } from "./supabaseAdmin";
import { listNpsDetratores, registrarStatusDetrator, NPS_DETRATOR_ORIGEM_LABELS, type NpsDetrator } from "./npsDetratores";
import { listEstornos } from "./estornos";
import { listAllEstornoRequests } from "./estornoRequests";
import { calcularNivel, mesesEntre, type ClienteNivel } from "./clientes";
import { statusEfetivo, hojeRecife, primeiroNome, type StatusVoucher } from "./vouchersCore";
import {
  chaveCliente,
  calcularPrioridade,
  statusInicial,
  notaEscala5,
  diasEntreDatas,
  STATUS_PARA_DETRATOR,
  STATUS_RECUPERACAO,
  CAUSAS_RECUPERACAO,
  type StatusRecuperacao,
  type CausaRecuperacao,
} from "./recuperacaoCore";

// Central de Recuperação (0171_recuperacao.sql): junta por cliente os
// detratores de todas as pesquisas e os estornos (histórico do painel +
// solicitações das lojas), com o que o Victor decidiu sobre cada um. Quem
// chama já conferiu que é ele (recuperacao-actions.ts e a página).

export type CasoRecuperacao =
  | { tipo: "detrator"; id: string; data: string; titulo: string; detalhe: string | null; nota: number; statusEquipe: string }
  | { tipo: "estorno"; id: string; data: string; titulo: string; detalhe: string | null; valor: number; pendente: boolean; loja: string; situacao: string };

export type ClienteRecuperacao = {
  chave: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  casos: CasoRecuperacao[];
  ultimoCaso: string;
  nivel: ClienteNivel | null;
  comprouDepois: boolean;
  ultimaCompra: string | null;
  voucher: { id: string; codigo: string; status: StatusVoucher } | null;
  status: StatusRecuperacao;
  causa: CausaRecuperacao | null;
  anotacao: string | null;
  proximoContato: string | null;
  atualizadoEm: string | null;
  pontos: number;
  motivos: string[];
  detratores: { origem: NpsDetrator["origem"]; origemId: string; motivo: string | null }[];
};

const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const PAGINA = 1000;

async function todasAsLinhas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    linhas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return linhas;
  }
}

// Cliente manual com status de quem ainda reclama ("cobrando", "questionando").
const ESTORNO_EM_ABERTO = /cobrando|questionando|insistindo/i;

export async function montarFila(): Promise<ClienteRecuperacao[]> {
  const admin = getSupabaseAdmin();
  const hoje = hojeRecife();
  const [detratores, estornosManuais, solicitacoes, cadastro, estado, vouchers] = await Promise.all([
    listNpsDetratores({ todoHistorico: true }),
    listEstornos(),
    listAllEstornoRequests(),
    todasAsLinhas<{ name: string; cpf_cnpj: string | null; phone1: string | null; phone2: string | null }>((de, ate) =>
      admin.from("totvs_clientes").select("name, cpf_cnpj, phone1, phone2").order("id").range(de, ate),
    ),
    todasAsLinhas<{ chave: string; status: StatusRecuperacao; causa: CausaRecuperacao | null; anotacao: string | null; proximo_contato: string | null; atualizado_em: string }>(
      (de, ate) => admin.from("recuperacao_clientes").select("chave, status, causa, anotacao, proximo_contato, atualizado_em").order("chave").range(de, ate),
    ),
    todasAsLinhas<{ id: string; codigo: string; cliente_cpf: string; status: StatusVoucher; data_validade: string; data_emissao: string }>((de, ate) =>
      admin.from("vouchers").select("id, codigo, cliente_cpf, status, data_validade, data_emissao").order("data_emissao").range(de, ate),
    ),
  ]);

  // telefone (8 últimos dígitos) -> CPF, só quando um único cliente usa o número
  const cpfPorTelefone = new Map<string, string | null>();
  const telefonePorCpf = new Map<string, string>();
  for (const c of cadastro) {
    const cpf = digitos(c.cpf_cnpj);
    if (cpf.length !== 11) continue;
    for (const tel of [c.phone1, c.phone2]) {
      const fim = digitos(tel).slice(-8);
      if (fim.length < 8) continue;
      const atual = cpfPorTelefone.get(fim);
      cpfPorTelefone.set(fim, atual === undefined || atual === cpf ? cpf : null);
      if (!telefonePorCpf.has(cpf)) telefonePorCpf.set(cpf, digitos(tel));
    }
  }

  const clientes = new Map<string, ClienteRecuperacao>();
  const pegar = (chave: string, nome: string, cpf: string | null, telefone: string | null) => {
    let c = clientes.get(chave);
    if (!c) {
      c = {
        chave,
        nome,
        cpf,
        telefone,
        casos: [],
        ultimoCaso: "",
        nivel: null,
        comprouDepois: false,
        ultimaCompra: null,
        voucher: null,
        status: "novo",
        causa: null,
        anotacao: null,
        proximoContato: null,
        atualizadoEm: null,
        pontos: 0,
        motivos: [],
        detratores: [],
      };
      clientes.set(chave, c);
    }
    if (!c.cpf && cpf) c.cpf = cpf;
    if (!c.telefone && telefone) c.telefone = telefone;
    if ((!c.nome || c.nome === "Sem nome") && nome) c.nome = nome;
    return c;
  };

  for (const d of detratores) {
    const fim = digitos(d.clientPhone).slice(-8);
    const cpf = (fim.length === 8 && cpfPorTelefone.get(fim)) || null;
    const chave = chaveCliente({ cpf, telefone: d.clientPhone, nome: d.clientName });
    if (!chave) continue;
    const c = pegar(chave, d.clientName ?? "Sem nome", cpf, digitos(d.clientPhone) || null);
    const nota = notaEscala5(d.score, d.escala);
    c.casos.push({
      tipo: "detrator",
      id: `${d.origem}:${d.origemId}`,
      data: d.respondidoEm,
      titulo: `Detrator ${NPS_DETRATOR_ORIGEM_LABELS[d.origem]} · nota ${nota}`,
      detalhe: d.motivo ?? d.motivoSugerido,
      nota,
      statusEquipe: d.status,
    });
    c.detratores.push({ origem: d.origem, origemId: d.origemId, motivo: d.motivo });
  }

  const addEstorno = (e: { id: string; nome: string; cpf: string | null; data: string; valor: number; motivo: string | null; produto: string | null; loja: string; situacao: string; pendente: boolean }) => {
    const cpf = digitos(e.cpf).length === 11 ? digitos(e.cpf) : null;
    const nome = e.nome.replace(/\s*\([^)]*\)\s*$/, "");
    const chave = chaveCliente({ cpf, nome });
    if (!chave) return;
    const c = pegar(chave, nome, cpf, cpf ? (telefonePorCpf.get(cpf) ?? null) : null);
    c.casos.push({
      tipo: "estorno",
      id: e.id,
      data: e.data,
      titulo: `Estorno ${e.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · ${e.loja}`,
      detalhe: [e.motivo, e.produto].filter(Boolean).join(" · ") || null,
      valor: e.valor,
      pendente: e.pendente,
      loja: e.loja,
      situacao: e.situacao,
    });
  };
  for (const e of estornosManuais) {
    addEstorno({
      id: e.id,
      nome: e.cliente,
      cpf: e.cpfCnpj,
      data: e.dataSolicitacao,
      valor: e.valorReembolso,
      motivo: e.motivo,
      produto: e.produto,
      loja: e.loja,
      situacao: e.status || "registrado",
      pendente: ESTORNO_EM_ABERTO.test(e.status ?? ""),
    });
  }
  for (const r of solicitacoes) {
    addEstorno({
      id: `req-${r.id}`,
      nome: r.clienteNome,
      cpf: r.cpf,
      data: r.createdAt,
      valor: r.valorReembolso,
      motivo: r.motivo,
      produto: r.produto,
      loja: r.storeName,
      situacao: r.status === "pendente" ? "pendente no financeiro" : r.status === "concluido" ? "estornado" : "recusado",
      pendente: r.status === "pendente",
    });
  }

  // Nível e última compra (Protheus), só pros CPFs da fila.
  const cpfs = [...new Set([...clientes.values()].map((c) => c.cpf).filter((x): x is string => !!x))];
  const agregados = new Map<string, { compras: number; gasto_acumulado: number; primeira_compra: string | null; ultima_compra: string | null }>();
  for (let i = 0; i < cpfs.length; i += 200) {
    const { data, error } = await admin
      .from("v_clientes_agregado_nivel")
      .select("cpf_cnpj, compras, gasto_acumulado, primeira_compra, ultima_compra")
      .in("cpf_cnpj", cpfs.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const a of data ?? []) {
      const cpf = digitos(a.cpf_cnpj);
      const atual = agregados.get(cpf);
      // CPF com mais de um código no Protheus: soma.
      agregados.set(cpf, {
        compras: (atual?.compras ?? 0) + Number(a.compras),
        gasto_acumulado: (atual?.gasto_acumulado ?? 0) + Number(a.gasto_acumulado),
        primeira_compra: [atual?.primeira_compra, a.primeira_compra].filter(Boolean).sort()[0] ?? null,
        ultima_compra: [atual?.ultima_compra, a.ultima_compra].filter(Boolean).sort().at(-1) ?? null,
      });
    }
  }

  const voucherPorCpf = new Map<string, (typeof vouchers)[number]>();
  for (const v of vouchers) voucherPorCpf.set(v.cliente_cpf, v);
  const estadoPorChave = new Map(estado.map((e) => [e.chave, e]));
  const agora = new Date();

  for (const c of clientes.values()) {
    c.casos.sort((a, b) => b.data.localeCompare(a.data));
    c.ultimoCaso = c.casos[0]?.data ?? "";
    const a = c.cpf ? agregados.get(c.cpf) : undefined;
    if (a) {
      c.nivel = calcularNivel(a.compras, a.gasto_acumulado, a.primeira_compra ? mesesEntre(a.primeira_compra, agora) : null);
      c.ultimaCompra = a.ultima_compra;
      c.comprouDepois = !!a.ultima_compra && a.ultima_compra.slice(0, 10) > c.ultimoCaso.slice(0, 10);
    }
    const v = c.cpf ? voucherPorCpf.get(c.cpf) : undefined;
    if (v) c.voucher = { id: v.id, codigo: v.codigo, status: statusEfetivo(v.status, v.data_validade, hoje) };
    const salvo = estadoPorChave.get(c.chave);
    c.status = salvo?.status ?? statusInicial(c.casos.flatMap((x) => (x.tipo === "detrator" ? [x.statusEquipe] : [])));
    c.causa = salvo?.causa ?? null;
    c.anotacao = salvo?.anotacao ?? null;
    c.proximoContato = salvo?.proximo_contato ?? null;
    c.atualizadoEm = salvo?.atualizado_em ?? null;
    const notas = c.casos.flatMap((x) => (x.tipo === "detrator" ? [x.nota] : []));
    const estornos = c.casos.filter((x): x is Extract<CasoRecuperacao, { tipo: "estorno" }> => x.tipo === "estorno");
    const p = calcularPrioridade({
      status: c.status,
      proximoContato: c.proximoContato,
      hoje,
      estornoPendente: estornos.some((e) => e.pendente),
      valorEstornos: estornos.reduce((t, e) => t + e.valor, 0),
      piorNota: notas.length ? Math.min(...notas) : null,
      diasDesdeUltimoCaso: c.ultimoCaso ? diasEntreDatas(c.ultimoCaso, hoje) : null,
      nivel: c.nivel,
      temDetrator: notas.length > 0,
      temEstorno: estornos.length > 0,
    });
    c.pontos = p.pontos;
    c.motivos = p.motivos;
  }

  return [...clientes.values()].sort((a, b) => b.pontos - a.pontos || b.ultimoCaso.localeCompare(a.ultimoCaso));
}

export type AlteracaoRecuperacao = {
  status: StatusRecuperacao;
  causa: CausaRecuperacao | null;
  anotacao: string | null;
  proximoContato: string | null;
};

export function validarAlteracao(a: { status: string; causa: string; anotacao: string; proximoContato: string }): AlteracaoRecuperacao | null {
  if (!(STATUS_RECUPERACAO as readonly string[]).includes(a.status)) return null;
  if (a.causa && !(CAUSAS_RECUPERACAO as readonly string[]).includes(a.causa)) return null;
  if (a.proximoContato && !/^\d{4}-\d{2}-\d{2}$/.test(a.proximoContato)) return null;
  return {
    status: a.status as StatusRecuperacao,
    causa: (a.causa || null) as CausaRecuperacao | null,
    anotacao: a.anotacao.trim().slice(0, 2000) || null,
    proximoContato: a.proximoContato || null,
  };
}

// Grava o que mudou, registra cada campo alterado no histórico e leva o
// status pros detratores do cliente (tela de Avaliações), mantendo o
// motivo que a equipe já tinha escrito lá.
export async function salvarCliente(
  chave: string,
  nova: AlteracaoRecuperacao,
  detratores: { origem: NpsDetrator["origem"]; origemId: string; motivo: string | null }[],
  por: string,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: antes } = await admin.from("recuperacao_clientes").select("status, causa, anotacao, proximo_contato").eq("chave", chave).maybeSingle();
  const { error } = await admin.from("recuperacao_clientes").upsert({
    chave,
    status: nova.status,
    causa: nova.causa,
    anotacao: nova.anotacao,
    proximo_contato: nova.proximoContato,
    atualizado_em: new Date().toISOString(),
    atualizado_por: por,
  });
  if (error) throw new Error(error.message);

  const mudancas = (
    [
      ["status", antes?.status ?? null, nova.status],
      ["causa", antes?.causa ?? null, nova.causa],
      ["anotacao", antes?.anotacao ?? null, nova.anotacao],
      ["proximo_contato", antes?.proximo_contato ?? null, nova.proximoContato],
    ] as const
  ).filter(([, de, para]) => (de ?? null) !== (para ?? null));
  if (mudancas.length) {
    const { error: e2 } = await admin.from("recuperacao_eventos").insert(mudancas.map(([campo, de, para]) => ({ chave, campo, de, para, por })));
    if (e2) throw new Error(e2.message);
  }
  if (antes?.status !== nova.status) {
    for (const d of detratores) {
      await registrarStatusDetrator(d.origem, d.origemId, { status: STATUS_PARA_DETRATOR[nova.status], motivo: d.motivo });
    }
  }
}

export async function listarHistorico(chave: string): Promise<{ campo: string; de: string | null; para: string | null; por: string; em: string }[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("recuperacao_eventos")
    .select("campo, de, para, por, em")
    .eq("chave", chave)
    .order("em", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Roteiro de ligação pronto pra cada cliente da fila -- pedido do Victor
// 16/10/2026: "um botão em cada um dos clientes em que eu possa copiar o
// roteiro de conversa". Função pura (sem I/O), montada só com o que já está
// em ClienteRecuperacao -- mesmo espírito de calcularPrioridade
// (recuperacaoCore.ts). Não tenta ser definitivo: é um rascunho que já
// parte das informações reais do caso, pra economizar o trabalho de reler
// tudo antes de ligar -- o Victor ajusta/completa antes de usar.
const brlRoteiro = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const diaBrRoteiro = (s: string) => s.slice(0, 10).split("-").reverse().join("/");

export function gerarRoteiro(c: ClienteRecuperacao): string {
  const nome = primeiroNome(c.nome) || "cliente";
  const linhas: string[] = [];

  if (!c.telefone) {
    linhas.push("⚠️ Sem telefone cadastrado — resolver isso antes de ligar (checar com a loja ou o Protheus).", "");
  }

  const estornos = c.casos.filter((x): x is Extract<CasoRecuperacao, { tipo: "estorno" }> => x.tipo === "estorno");
  const detratores = c.casos.filter((x): x is Extract<CasoRecuperacao, { tipo: "detrator" }> => x.tipo === "detrator");
  const pendentes = estornos.filter((e) => e.pendente);
  const recusados = estornos.filter((e) => !e.pendente && /recusad/i.test(e.situacao));
  const concluidos = estornos.filter((e) => !e.pendente && !/recusad/i.test(e.situacao));
  const piorNota = detratores.length ? Math.min(...detratores.map((d) => d.nota)) : null;

  // "Já em contato" com anotação registrada = retomar de onde parou, não
  // abrir como se fosse a 1ª vez (mesmo cuidado que já foi pedido antes
  // pra casos assim -- ver conversa sobre a Edilene, 15/10/2026).
  const jaEmContato = (c.status === "em_contato" || c.status === "aguardando_cliente") && !!c.anotacao;

  if (jaEmContato) {
    linhas.push(`${nome}, retomando o que já estava sendo tratado com você:`, `"${c.anotacao}"`, "", "Roteiro de confirmação (NÃO é o 1º contato):");
  } else {
    linhas.push(`Oi ${nome}, aqui é o Victor, da Lojas Maia.`);
  }

  if (estornos.length > 1) {
    linhas.push("", `Esse cliente tem ${estornos.length} casos de estorno — revise cada um antes de ligar, pra não misturar:`);
    for (const e of estornos) linhas.push(`- ${diaBrRoteiro(e.data)} · ${brlRoteiro(e.valor)} · ${e.situacao}${e.detalhe ? ` · ${e.detalhe}` : ""}`);
  }

  if (pendentes.length) {
    const e = pendentes[0];
    linhas.push(
      "",
      `Reconheça o problema sem rodeio${e.detalhe ? ` (${e.detalhe})` : ""} e confirme que você está acompanhando o caso.`,
      `Dê uma posição concreta sobre o estorno de ${brlRoteiro(e.valor)} (${e.loja}) — prazo real, não "em breve". Se não souber o prazo exato, prometa retornar em até 24h com a data.`
    );
  }
  if (recusados.length) {
    linhas.push(
      "",
      `${recusados.length > 1 ? `${recusados.length} estornos foram` : "Um estorno foi"} recusado — confirme com quem recusou o motivo real antes de ligar, pra não prometer nada que não pode cumprir.`,
      "Pergunte ao cliente: o problema já foi resolvido de outra forma, ou ele ainda está sem o produto e sem o dinheiro? Esse é o ponto mais grave da ligação."
    );
  }
  if (concluidos.length) {
    linhas.push("", `O estorno de ${brlRoteiro(concluidos[0].valor)} já foi concluído — confirme que ele recebeu o valor (não dê por certo), sem tratar como pendente.`);
  }
  if (piorNota !== null) {
    linhas.push("", `Ele deixou nota ${piorNota} numa pesquisa — pergunte diretamente como avalia o atendimento agora, dê espaço pra ele falar, não justifique demais.`);
  }
  if (c.causa === "atraso_entrega") {
    linhas.push("", "Causa registrada: atraso na entrega — se ainda não resolveu, ofereça uma posição clara sobre o prazo real.");
  } else if (c.causa === "defeito_assistencia") {
    linhas.push("", "Causa registrada: defeito/assistência — confirme se o chamado de assistência já foi aberto e qual o status.");
  } else if (c.causa === "atendimento") {
    linhas.push("", "Causa registrada: atendimento — reconheça a falha específica antes de qualquer outra coisa, sem justificar o setor que errou.");
  }

  linhas.push("", "Encerre perguntando se ele toparia comprar com a Maia de novo e o que precisaria ser diferente — anote a resposta.");
  if (c.motivos.length) linhas.push("", `(Por que esse cliente está no topo da fila: ${c.motivos.join(" · ")})`);

  return linhas.join("\n");
}
