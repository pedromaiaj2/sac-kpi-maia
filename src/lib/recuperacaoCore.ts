// Regras puras da Central de Recuperação (sem banco) -- ver
// supabase/migrations/0171_recuperacao.sql e src/lib/recuperacao.ts.

// A tela é só do Victor (pedido dele, 14/10/2026: "só eu") -- não basta o
// papel admin, que outra pessoa também tem.
export const RECUPERACAO_DONO_ID = "8089880c-ee01-435d-8eeb-523a5c37e8a8";

export const STATUS_RECUPERACAO = ["novo", "em_contato", "aguardando_cliente", "recuperado", "perdido", "nao_contatar"] as const;
export type StatusRecuperacao = (typeof STATUS_RECUPERACAO)[number];
export const STATUS_RECUPERACAO_LABELS: Record<StatusRecuperacao, string> = {
  novo: "Novo",
  em_contato: "Em contato",
  aguardando_cliente: "Aguardando cliente",
  recuperado: "Recuperado",
  perdido: "Perdido",
  nao_contatar: "Não contatar",
};
export const STATUS_RECUPERACAO_COLORS: Record<StatusRecuperacao, string> = {
  novo: "var(--brand-orange)",
  em_contato: "var(--series-5)",
  aguardando_cliente: "var(--status-warning)",
  recuperado: "var(--status-good)",
  perdido: "var(--status-critical)",
  nao_contatar: "var(--text-muted)",
};
export const STATUS_ENCERRADOS: readonly StatusRecuperacao[] = ["recuperado", "perdido", "nao_contatar"];

export const CAUSAS_RECUPERACAO = ["atraso_entrega", "defeito_assistencia", "atendimento", "produto", "preco", "outro"] as const;
export type CausaRecuperacao = (typeof CAUSAS_RECUPERACAO)[number];
export const CAUSA_RECUPERACAO_LABELS: Record<CausaRecuperacao, string> = {
  atraso_entrega: "Atraso na entrega",
  defeito_assistencia: "Defeito / assistência",
  atendimento: "Atendimento",
  produto: "Produto",
  preco: "Preço",
  outro: "Outro",
};

// Status da central <-> status do detrator (nps_detrator_status, tela de
// Avaliações). "Não contatar" vira "perdido" lá (não tem equivalente).
export const STATUS_PARA_DETRATOR: Record<StatusRecuperacao, "nao_contatado" | "em_contato" | "recuperado" | "perdido" | "sem_resposta"> = {
  novo: "nao_contatado",
  em_contato: "em_contato",
  aguardando_cliente: "sem_resposta",
  recuperado: "recuperado",
  perdido: "perdido",
  nao_contatar: "perdido",
};
const DETRATOR_PARA_STATUS: Record<string, StatusRecuperacao> = {
  nao_contatado: "novo",
  em_contato: "em_contato",
  sem_resposta: "aguardando_cliente",
  recuperado: "recuperado",
  perdido: "perdido",
};

// Cliente sem nada salvo na central: herda o status mais avançado que a
// equipe já deu a algum detrator dele em Avaliações.
export function statusInicial(statusDetratores: string[]): StatusRecuperacao {
  const ordem: StatusRecuperacao[] = ["recuperado", "perdido", "em_contato", "aguardando_cliente", "novo"];
  const mapeados = statusDetratores.map((s) => DETRATOR_PARA_STATUS[s]).filter(Boolean);
  return ordem.find((s) => mapeados.includes(s)) ?? "novo";
}

const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// O mesmo cliente nas várias origens: CPF quando tem; sem CPF, os 8 últimos
// dígitos do telefone (não mudam com DDD/9 na frente); sem nenhum, o nome.
export function chaveCliente(c: { cpf?: string | null; telefone?: string | null; nome?: string | null }): string | null {
  const cpf = digitos(c.cpf);
  if (cpf.length === 11) return `cpf:${cpf}`;
  const tel = digitos(c.telefone);
  if (tel.length >= 8) return `tel:${tel.slice(-8)}`;
  const nome = c.nome ? normalizarNome(c.nome) : "";
  return nome ? `nome:${nome}` : null;
}

export type EntradaPrioridade = {
  status: StatusRecuperacao;
  proximoContato: string | null;
  hoje: string;
  estornoPendente: boolean;
  valorEstornos: number;
  // pior nota de NPS já na escala 1-5 (null = não é detrator)
  piorNota: number | null;
  diasDesdeUltimoCaso: number | null;
  nivel: string | null;
  temDetrator: boolean;
  temEstorno: boolean;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const diaBr = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

// Quem vale mais a pena contatar primeiro, com o porquê de cada ponto (a
// tela mostra os motivos). Caso encerrado fica sempre no fim (0 ponto).
export function calcularPrioridade(e: EntradaPrioridade): { pontos: number; motivos: string[] } {
  if (STATUS_ENCERRADOS.includes(e.status)) return { pontos: 0, motivos: [] };
  let pontos = 0;
  const motivos: string[] = [];
  const somar = (n: number, motivo: string) => {
    pontos += n;
    if (n > 0) motivos.push(motivo);
  };

  if (e.proximoContato) {
    if (e.proximoContato <= e.hoje) somar(40, e.proximoContato < e.hoje ? `contato atrasado (era ${diaBr(e.proximoContato)})` : "contato marcado para hoje");
    else pontos -= 30;
  }
  if (e.estornoPendente) somar(35, "estorno pendente");
  if (e.valorEstornos > 0) somar(Math.min(15, Math.round(e.valorEstornos / 200)) || 1, `estorno de ${brl(e.valorEstornos)}`);
  if (e.piorNota !== null) somar(e.piorNota <= 1 ? 25 : 15, `nota ${e.piorNota} no NPS`);
  if (e.diasDesdeUltimoCaso !== null) {
    if (e.diasDesdeUltimoCaso <= 7) somar(20, "caso desta semana");
    else if (e.diasDesdeUltimoCaso <= 30) somar(12, "caso do último mês");
    else if (e.diasDesdeUltimoCaso <= 90) somar(5, "caso dos últimos 3 meses");
  }
  if (e.nivel === "diamante") somar(15, "cliente Diamante");
  else if (e.nivel === "ouro") somar(10, "cliente Ouro");
  else if (e.nivel === "prata") somar(5, "cliente Prata");
  if (e.temDetrator && e.temEstorno) somar(10, "detrator e estorno");
  if (e.status === "novo") somar(5, "ainda sem contato");
  return { pontos: Math.max(pontos, 1), motivos };
}

// NPS 0-10 (pesquisas antigas) -> mesma régua 1-5 da tela.
export function notaEscala5(score: number, escala: "1-5" | "0-10"): number {
  if (escala === "1-5") return score;
  return Math.max(1, Math.min(5, Math.round(score / 2)));
}

export function diasEntreDatas(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${de.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}
