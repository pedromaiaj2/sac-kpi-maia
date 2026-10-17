// Mural "Rotas de hoje" de /kpis/logistica (pedido do Victor 17/10/2026):
// formato da RPC rotas_do_dia (migração 0180) e as contas do mural, sem
// acesso ao banco (testável e usável no navegador).

export type NotaRota = {
  notaFiscal: string | null;
  pedido: string | null;
  cliente: string | null;
  bairro: string | null;
  // "1" entregue, "2" parcial, "3" não entregue, "4" cancelada; null = sem resultado ainda
  status: string | null;
  hora: string | null;
  tentativa: number | null;
  ocorrencia: string | null;
};

export type CargaRota = {
  carga: string;
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
  volumes: { P: number; M: number; G: number; naoClassificado: number };
  insucessos: { codigo: string; descricao: string | null; n: number }[];
  notasLista: NotaRota[];
};

export type RotasDoDia = { dia: string; cargas: CargaRota[] };

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

// Minutos desde a última baixa (hora "HH:MM" de Recife, no dia de hoje).
export function minutosDesde(hora: string | null, agoraRecife: string): number | null {
  if (!hora || !/^\d{2}:\d{2}$/.test(hora)) return null;
  const [h, m] = hora.split(":").map(Number);
  const [ah, am] = agoraRecife.split(":").map(Number);
  const d = ah * 60 + am - (h * 60 + m);
  return d >= 0 ? d : null;
}
