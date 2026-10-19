// Mural "Rotas de hoje" de /kpis/logistica (pedido do Victor 17/10/2026):
// formato da RPC rotas_do_dia (migração 0180) e as contas do mural, sem
// acesso ao banco (testável e usável no navegador).

export type NotaRota = {
  notaFiscal: string | null;
  pedido: string | null;
  cliente: string | null;
  // CPF/CNPJ só com dígitos, como vem do Protheus (0189)
  cpf?: string | null;
  bairro: string | null;
  // "1" entregue, "2" parcial, "3" não entregue, "4" cancelada; null = sem resultado ainda
  status: string | null;
  hora: string | null;
  tentativa: number | null;
  ocorrencia: string | null;
};

export type CargaRota = {
  carga: string;
  // previsão da carga -- pode ser de até 3 dias antes do mural se ela
  // continua Em Rota (0186)
  dia: string;
  statusCodigo: string | null;
  status: string | null;
  tipo: string | null;
  motorista: { codigo: string; nome: string | null } | null;
  veiculo: string | null;
  tipoVeiculo: string | null;
  vinculo: string | null;
  transportadora: string | null;
  regioes: string[];
  notas: number;
  entregues: number;
  parciais: number;
  naoEntregues: number;
  canceladas: number;
  pendentes: number;
  primeiraBaixa: string | null;
  ultimaBaixa: string | null;
  // dia da última baixa (pode não ser o do mural) -- 0186
  ultimaBaixaDia: string | null;
  volumes: { P: number; M: number; G: number; naoClassificado: number };
  insucessos: { codigo: string; descricao: string | null; n: number }[];
  notasLista: NotaRota[];
};

// ultimoDiaComCargas: último dia com carga antes deste, pro mural mostrar
// quando o dia não tem nenhuma (domingo) -- 0186
export type RotasDoDia = { dia: string; ultimoDiaComCargas: string | null; cargas: CargaRota[] };

export type GrupoRota = "Próprio" | "Terceirizado" | "No CD";

// Carga sem motorista ainda (montagem/separação) fica no grupo "No CD".
export function grupoDaCarga(c: Pick<CargaRota, "vinculo" | "motorista">): GrupoRota {
  if (!c.motorista) return "No CD";
  return c.vinculo === "Terceirizado" ? "Terceirizado" : "Próprio";
}

export type ResumoRotas = {
  cargas: number;
  emRota: number;
  notas: number;
  entregues: number;
  parciais: number;
  naoEntregues: number;
  pendentes: number;
  // notas com resultado ÷ notas
  andamento: number | null;
};

export function resumirRotas(cargas: CargaRota[]): ResumoRotas {
  const soma = (f: (c: CargaRota) => number) => cargas.reduce((t, c) => t + f(c), 0);
  const notas = soma((c) => c.notas);
  const pendentes = soma((c) => c.pendentes);
  return {
    cargas: cargas.length,
    emRota: cargas.filter((c) => c.statusCodigo === "5").length,
    notas,
    entregues: soma((c) => c.entregues),
    parciais: soma((c) => c.parciais),
    naoEntregues: soma((c) => c.naoEntregues + c.canceladas),
    pendentes,
    andamento: notas > 0 ? (notas - pendentes) / notas : null,
  };
}

// CPF (11 dígitos) ou CNPJ (14) com pontuação; outro formato fica como veio.
export function formatarDocumento(doc: string | null | undefined): string | null {
  if (!doc) return null;
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return doc;
}

// Regiões sem a etiqueta "Sem Regiao" do Protheus.
export function regioesVisiveis(regioes: string[]): string[] {
  return regioes.filter((r) => !/^sem regi/i.test(r));
}

export const STATUS_CARGA_ORDEM: Record<string, string> = {
  "0": "Em montagem",
  "1": "Em separação",
  "2": "Programada",
  "3": "Faturada",
  "5": "Em rota",
  "6": "Encerrada",
};

// Em rota sem nenhuma baixa nova há mais que isso: carga parada.
export const MINUTOS_SEM_BAIXA_ALERTA = 90;

function diaBr(iso: string): string {
  return iso.split("-").reverse().slice(0, 2).join("/");
}

// Última baixa da carga em relação ao dia do mural: há quantos minutos (se
// foi no próprio dia), o texto pra mostrar e se a carga está parada (em rota,
// com nota pendente e sem baixa há mais de MINUTOS_SEM_BAIXA_ALERTA, ou com a
// última baixa num dia anterior).
export function situacaoBaixa(
  c: Pick<CargaRota, "statusCodigo" | "pendentes" | "ultimaBaixa" | "ultimaBaixaDia" | "dia">,
  diaMural: string,
  agora: string,
): { desde: number | null; parada: boolean; texto: string | null } {
  const emRota = c.statusCodigo === "5" && c.pendentes > 0;
  if (!c.ultimaBaixa || !c.ultimaBaixaDia) {
    const deOutroDia = c.dia < diaMural;
    return { desde: null, parada: emRota && deOutroDia, texto: emRota && deOutroDia ? `sem baixa desde ${diaBr(c.dia)}` : null };
  }
  if (c.ultimaBaixaDia < diaMural) {
    return { desde: null, parada: emRota, texto: `última baixa ${diaBr(c.ultimaBaixaDia)} ${c.ultimaBaixa}` };
  }
  const desde = minutosDesde(c.ultimaBaixa, agora);
  return { desde, parada: emRota && desde !== null && desde > MINUTOS_SEM_BAIXA_ALERTA, texto: `última baixa ${c.ultimaBaixa}` };
}

// Minutos desde a última baixa (hora "HH:MM" de Recife, no dia de hoje).
export function minutosDesde(hora: string | null, agoraRecife: string): number | null {
  if (!hora || !/^\d{2}:\d{2}$/.test(hora)) return null;
  const [h, m] = hora.split(":").map(Number);
  const [ah, am] = agoraRecife.split(":").map(Number);
  const d = ah * 60 + am - (h * 60 + m);
  return d >= 0 ? d : null;
}
