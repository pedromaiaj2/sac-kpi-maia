// Idempotência e classificação de falha da baixa do motorista (PWA, fila
// offline). Funções puras + um registro em memória por processo -- sem
// banco, sem Supabase (logística não grava nada aqui, ver LOGISTICA-ODOO.md).
//
// Por que existe: com rede ruim o celular pode reenviar a MESMA baixa
// (mesmo evento_uid) -- resposta perdida no caminho, Background Sync do
// service worker e a página tentando ao mesmo tempo. Defesas, em camadas:
//   1. no celular: Web Locks (uma fila enviando por vez);
//   2. aqui: evento_uid já concluído devolve a mesma resposta; em andamento
//      devolve "transitório" (o celular tenta de novo depois);
//   3. no servidor: a action recusa parada que já tem resultado
//      ("ja_registrada" -> o celular tira da fila);
//   4. FALTA no Odoo: deduplicar por evento_uid (a ponte ignora o campo hoje).
// A camada 2 é por processo: com várias instâncias atrás de balanceador ela
// só ajuda dentro da mesma instância (a 3 continua valendo).

import { OdooBridgeError } from "./logistica";

export type FalhaBaixa = "sessao" | "ja_registrada" | "recusada" | "transitorio";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function eventoUidValido(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

// Erro de transporte/infra (rede, timeout, 5xx, chave da ponte) = tentar de
// novo mais tarde; recusa de negócio do Odoo (HTTP 4xx com mensagem) ou da
// nossa validação = o motorista precisa ver e decidir.
export function classificarErroBaixa(err: unknown): FalhaBaixa {
  if (err instanceof OdooBridgeError) {
    if (err.status === null || err.status >= 500 || err.status === 401) return "transitorio";
    return "recusada";
  }
  return "recusada";
}

// Status HTTP da rota /assistencia/motorista/odoo/baixa para cada falha (o
// service worker e a página classificam pelo status, ver filaBaixasRegras).
export const STATUS_DA_FALHA: Record<FalhaBaixa, number> = {
  sessao: 401,
  ja_registrada: 409,
  recusada: 422,
  transitorio: 503,
};

type Item<R> = { estado: "andamento"; desde: number } | { estado: "feito"; resposta: R; em: number };

export type InicioDedup<R> = { tipo: "novo" } | { tipo: "andamento" } | { tipo: "feito"; resposta: R };

// Registro em memória dos evento_uid vistos. "andamento" expira (processo
// que morreu no meio não pode travar o uid para sempre); "feito" guarda a
// resposta pelo TTL.
export function criarDedupEventos<R>(opcoes: { ttlMs?: number; andamentoMaxMs?: number; max?: number } = {}) {
  const ttl = opcoes.ttlMs ?? 30 * 60_000;
  const andamentoMax = opcoes.andamentoMaxMs ?? 3 * 60_000;
  const max = opcoes.max ?? 5000;
  const itens = new Map<string, Item<R>>();

  function limpar(agora: number) {
    for (const [uid, it] of itens) {
      const velho = it.estado === "feito" ? agora - it.em > ttl : agora - it.desde > andamentoMax;
      if (velho) itens.delete(uid);
    }
    while (itens.size > max) {
      const primeiro = itens.keys().next().value;
      if (primeiro === undefined) break;
      itens.delete(primeiro);
    }
  }

  return {
    iniciar(uid: string, agora = Date.now()): InicioDedup<R> {
      limpar(agora);
      const it = itens.get(uid);
      if (it?.estado === "feito") return { tipo: "feito", resposta: it.resposta };
      if (it?.estado === "andamento") return { tipo: "andamento" };
      itens.set(uid, { estado: "andamento", desde: agora });
      return { tipo: "novo" };
    },
    concluir(uid: string, resposta: R, agora = Date.now()) {
      itens.set(uid, { estado: "feito", resposta, em: agora });
    },
    // Falha que pode ser reenviada: libera o uid para a próxima tentativa.
    liberar(uid: string) {
      itens.delete(uid);
    },
    tamanho() {
      return itens.size;
    },
  };
}

// Baixa feita sem rede chega minutos/horas depois: o Odoo grava a hora da
// recepção, então a hora real do toque vai no começo da observação.
export function observacaoComHorario(obs: string | null | undefined, registradoEm: string | null | undefined, agora = Date.now(), fuso = "America/Fortaleza"): string | null {
  const texto = (obs ?? "").trim();
  const t = registradoEm ? Date.parse(registradoEm) : NaN;
  if (!Number.isFinite(t) || agora - t < 2 * 60_000) return texto || null;
  const quando = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(t));
  return `[baixa offline ${quando.replace(",", "")}]${texto ? ` ${texto}` : ""}`;
}
