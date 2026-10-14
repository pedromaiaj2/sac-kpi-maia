// Regras puras dos vouchers de recuperação (sem banco) -- ver
// supabase/migrations/0170_vouchers.sql e src/lib/vouchers.ts.

// Sem 0/O, 1/I/L: o caixa lê o código em voz alta ou digita de um print.
export const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const PADRAO_CODIGO = /^MAIA-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;

export const TIPOS_BENEFICIO = ["percentual_desconto", "valor_desconto", "frete_gratis", "brinde"] as const;
export type TipoBeneficio = (typeof TIPOS_BENEFICIO)[number];
export const TIPO_BENEFICIO_LABELS: Record<TipoBeneficio, string> = {
  percentual_desconto: "Desconto em %",
  valor_desconto: "Desconto em R$",
  frete_gratis: "Frete grátis",
  brinde: "Brinde",
};

export const MOTIVOS_VOUCHER = ["atraso_entrega", "defeito_assistencia", "outro"] as const;
export type MotivoVoucher = (typeof MOTIVOS_VOUCHER)[number];
export const MOTIVO_VOUCHER_LABELS: Record<MotivoVoucher, string> = {
  atraso_entrega: "Atraso na entrega",
  defeito_assistencia: "Defeito / assistência",
  outro: "Outro",
};

export const STATUS_VOUCHER = ["ativo", "usado", "expirado", "cancelado"] as const;
export type StatusVoucher = (typeof STATUS_VOUCHER)[number];
export const STATUS_VOUCHER_LABELS: Record<StatusVoucher, string> = {
  ativo: "Ativo",
  usado: "Usado",
  expirado: "Expirado",
  cancelado: "Cancelado",
};
export const STATUS_VOUCHER_COLORS: Record<StatusVoucher, string> = {
  ativo: "var(--status-good)",
  usado: "var(--series-5)",
  expirado: "var(--status-warning)",
  cancelado: "var(--status-critical)",
};

export const VALIDADE_PADRAO_DIAS = 30;

export const REGRAS_VOUCHER =
  "Válido uma única vez. Apresente este voucher e um documento com foto do titular em qualquer loja Maia. Não cumulativo com outras promoções. Não pode ser trocado por dinheiro.";

// `rand` tem que ser criptográfico (crypto.randomInt no servidor, ver
// vouchers.ts) -- recebido por parâmetro pra este arquivo não puxar
// node:crypto pro bundle das telas que usam os rótulos daqui.
export function gerarCodigo(rand: (max: number) => number): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALFABETO_CODIGO[rand(ALFABETO_CODIGO.length)];
  return `MAIA-${s.slice(0, 4)}-${s.slice(4)}`;
}

// Aceita o que o caixa digitar: minúsculas, espaços, com ou sem "MAIA-" e
// hífens. Devolve null se não tem cara de código (nem chega no banco, mas
// conta como consulta inexistente pro limite).
export function normalizarCodigo(entrada: string): string | null {
  const limpo = entrada.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const corpo = limpo.startsWith("MAIA") && limpo.length === 12 ? limpo.slice(4) : limpo;
  if (corpo.length !== 8) return null;
  const codigo = `MAIA-${corpo.slice(0, 4)}-${corpo.slice(4)}`;
  return PADRAO_CODIGO.test(codigo) ? codigo : null;
}

export function somenteDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

export function cpfValido(entrada: string): boolean {
  const cpf = somenteDigitos(entrada);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

// ***.456.789-** -- o que fica escondido (3 primeiros e 2 últimos) é o que
// o caixa confere com o documento: os 3 primeiros.
export function mascararCpf(cpf: string): string {
  const d = somenteDigitos(cpf);
  if (d.length !== 11) return "***.***.***-**";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function formatarCpf(cpf: string): string {
  const d = somenteDigitos(cpf);
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf;
}

export function primeiroNome(nome: string): string {
  const p = nome.trim().split(/\s+/)[0] ?? "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "";
}

// Nome pra tela do caixa e da imagem: primeiro nome + último sobrenome.
export function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (partes.length <= 1) return partes.map(cap).join("");
  return `${cap(partes[0])} ${cap(partes[partes.length - 1])}`;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type Beneficio = {
  tipoBeneficio: TipoBeneficio;
  valorBeneficio: number | null;
  descricaoBeneficio: string | null;
  valorMinimo: number | null;
};

export function beneficioTitulo(b: Beneficio): string {
  switch (b.tipoBeneficio) {
    case "percentual_desconto":
      return `${(b.valorBeneficio ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% de desconto`;
    case "valor_desconto":
      return `${brl(b.valorBeneficio ?? 0)} de desconto`;
    case "frete_gratis":
      return "Frete grátis";
    case "brinde":
      return b.descricaoBeneficio?.trim() ? `Brinde: ${b.descricaoBeneficio.trim().replace(/^brinde:\s*/i, "")}` : "Brinde";
  }
}

export function beneficioDetalhe(b: Beneficio): string | null {
  const partes: string[] = [];
  if (b.tipoBeneficio !== "brinde" && b.descricaoBeneficio?.trim()) partes.push(b.descricaoBeneficio.trim());
  if (b.valorMinimo) partes.push(`Em compras a partir de ${brl(b.valorMinimo)}`);
  return partes.length ? partes.join(" · ") : null;
}

// Vencido continua "ativo" no banco até a rotina passar -- pra tela e pra
// baixa, vale a data.
export function statusEfetivo(status: StatusVoucher, dataValidade: string, hoje: string): StatusVoucher {
  return status === "ativo" && dataValidade < hoje ? "expirado" : status;
}

export function hojeRecife(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(agora);
}

export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dataBr(dia: string): string {
  return dia.slice(0, 10).split("-").reverse().join("/");
}

export function mensagemWhatsapp(v: { clienteNome: string; codigo: string; dataValidade: string } & Beneficio): string {
  const detalhe = beneficioDetalhe(v);
  return [
    `Olá, ${primeiroNome(v.clienteNome)}! Aqui é da Lojas Maia.`,
    "",
    `Sentimos muito pelo transtorno e preparamos um presente para você: *${beneficioTitulo(v)}*${detalhe ? ` (${detalhe.charAt(0).toLowerCase()}${detalhe.slice(1)})` : ""}.`,
    "",
    `Seu código: *${v.codigo}*`,
    `Válido até ${dataBr(v.dataValidade)}.`,
    "",
    "É só apresentar a imagem do voucher e um documento com foto em qualquer loja Maia. O voucher vale uma única vez, só para você, não é cumulativo com outras promoções e não pode ser trocado por dinheiro.",
  ].join("\n");
}

export const RESULTADOS_CONSULTA = ["ok", "inexistente", "usado", "expirado", "cancelado", "cpf_nao_confere", "bloqueado"] as const;
export type ResultadoVoucher = (typeof RESULTADOS_CONSULTA)[number];

export function mensagemResultado(r: ResultadoVoucher, extra?: { usadoEm?: string | null; lojaUso?: string | null }): string {
  switch (r) {
    case "ok":
      return "Voucher válido.";
    case "inexistente":
      return "Código não encontrado. Confira as letras e números do voucher.";
    case "usado": {
      if (!extra?.usadoEm) return "Este voucher já foi utilizado.";
      const quando = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Recife",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(extra.usadoEm));
      return `Este voucher já foi utilizado em ${quando}${extra.lojaUso ? `, na loja ${extra.lojaUso}` : ""}.`;
    }
    case "expirado":
      return "Este voucher está vencido e não pode mais ser usado.";
    case "cancelado":
      return "Este voucher foi cancelado e não pode ser usado.";
    case "cpf_nao_confere":
      return "Os 3 primeiros dígitos do CPF não conferem com o titular do voucher. Confira o documento com foto.";
    case "bloqueado":
      return "Muitas tentativas erradas. Aguarde alguns minutos ou fale com o SAC.";
  }
}

// Limites de consulta do caixa (adivinhação de código): contados na tabela
// de auditoria, por caixa.
export const LIMITE_CONSULTAS = { janelaMin: 15, inexistentes: 10, total: 60 } as const;

export function consultaBloqueada(c: { inexistentes: number; total: number }): boolean {
  return c.inexistentes >= LIMITE_CONSULTAS.inexistentes || c.total >= LIMITE_CONSULTAS.total;
}

export type EmissaoInput = {
  clienteNome: string;
  clienteCpf: string;
  clienteTelefone: string | null;
  tipoBeneficio: string;
  valorBeneficio: number | null;
  descricaoBeneficio: string | null;
  valorMinimoCompra: number | null;
  motivo: string;
  observacao: string | null;
  pedidoOrigem: string | null;
  dataValidade: string;
};

export type EmissaoValida = Omit<EmissaoInput, "tipoBeneficio" | "motivo"> & { tipoBeneficio: TipoBeneficio; motivo: MotivoVoucher };

// Mesmas regras dos CHECKs da tabela, com mensagem legível antes de ir pro banco.
export function validarEmissao(i: EmissaoInput, hoje: string): { ok: true; dados: EmissaoValida } | { ok: false; erro: string } {
  const nome = i.clienteNome.trim().replace(/\s+/g, " ");
  const cpf = somenteDigitos(i.clienteCpf);
  if (!nome) return { ok: false, erro: "Informe o nome do cliente." };
  if (!cpfValido(cpf)) return { ok: false, erro: "CPF inválido. Confira os 11 dígitos." };
  if (!(TIPOS_BENEFICIO as readonly string[]).includes(i.tipoBeneficio)) return { ok: false, erro: "Escolha o tipo de benefício." };
  const tipo = i.tipoBeneficio as TipoBeneficio;
  if (!(MOTIVOS_VOUCHER as readonly string[]).includes(i.motivo)) return { ok: false, erro: "Escolha o motivo." };
  const motivo = i.motivo as MotivoVoucher;
  const valor = i.valorBeneficio;
  if ((tipo === "percentual_desconto" || tipo === "valor_desconto") && !(valor && valor > 0)) {
    return { ok: false, erro: "Informe o valor do desconto." };
  }
  if (tipo === "percentual_desconto" && valor !== null && valor > 100) return { ok: false, erro: "Desconto em % não pode passar de 100." };
  if (tipo === "brinde" && !i.descricaoBeneficio?.trim()) return { ok: false, erro: "Descreva o brinde." };
  if (i.valorMinimoCompra !== null && !(i.valorMinimoCompra > 0)) return { ok: false, erro: "Valor mínimo de compra inválido." };
  if (motivo === "outro" && !i.observacao?.trim()) return { ok: false, erro: "Com motivo \"Outro\", escreva a observação." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.dataValidade) || i.dataValidade < hoje) {
    return { ok: false, erro: "A validade tem que ser hoje ou depois." };
  }
  const tel = i.clienteTelefone ? somenteDigitos(i.clienteTelefone) : "";
  return {
    ok: true,
    dados: {
      ...i,
      clienteNome: nome,
      clienteCpf: cpf,
      clienteTelefone: tel || null,
      tipoBeneficio: tipo,
      motivo,
      valorBeneficio: tipo === "percentual_desconto" || tipo === "valor_desconto" ? valor : null,
      descricaoBeneficio: i.descricaoBeneficio?.trim() || null,
      observacao: i.observacao?.trim() || null,
      pedidoOrigem: i.pedidoOrigem?.trim() || null,
    },
  };
}

// "10,5" / "1.234,56" / "10.5" -> número; vazio -> null; lixo -> NaN.
export function lerNumeroBr(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(norm.replace(/[^\d.-]/g, ""));
  return /\d/.test(t) ? n : Number.NaN;
}

// Dados que o atalho "Emitir voucher" (estorno, detrator) já traz pro formulário.
export type PreenchimentoVoucher = {
  clienteNome?: string;
  clienteCpf?: string;
  clienteTelefone?: string;
  motivo?: string;
  observacao?: string;
  pedidoOrigem?: string;
  origem?: string;
  origemId?: string;
  avisoOrigem?: string;
};
