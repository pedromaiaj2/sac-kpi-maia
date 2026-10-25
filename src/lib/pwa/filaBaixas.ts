// Fila offline das baixas do motorista (Entreguei / Entrega parcial / Não
// consegui + observação + fotos), guardada no IndexedDB do celular.
//
// Fluxo (outbox): o toque no botão grava a baixa aqui PRIMEIRO (com
// evento_uid e as fotos como Blob) e só então tenta enviar. Com rede, sai na
// hora; sem rede, fica guardada e vai quando a conexão voltar -- pelo
// Background Sync do service worker (Chrome/Android) ou, onde não há (iOS,
// navegador do WhatsApp), quando o app abre/volta ao primeiro plano/fica
// online (PwaShell). Envio: cada foto sem URL sobe pela rota de foto (uma por
// requisição, limite de 10 MB do proxy) e a URL fica gravada no registro
// (não sobe 2x); depois a baixa vai por POST JSON com o evento_uid.
//
// O service worker repete este envio em JS puro (public/assistencia/sw.js);
// os dois usam o mesmo Web Lock para não enviarem ao mesmo tempo.

import { urlDoApp } from "./base";
import {
  FILA_CANAL,
  FILA_DB,
  FILA_DB_VERSAO,
  FILA_LOCK,
  FILA_STORE,
  FILA_SYNC_TAG,
  corpoDaBaixa,
  desfechoDoStatus,
  interrompeFila,
  saiDaFila,
  type BaixaPendente,
  type Desfecho,
} from "./filaBaixasRegras";

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") return rej(new Error("IndexedDB indisponível neste navegador."));
    const req = indexedDB.open(FILA_DB, FILA_DB_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FILA_STORE)) db.createObjectStore(FILA_STORE, { keyPath: "evento_uid" });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error ?? new Error("Falha ao abrir o IndexedDB."));
    req.onblocked = () => rej(new Error("IndexedDB bloqueado por outra aba."));
  });
}

async function comStore<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await abrirDb();
  try {
    return await new Promise<T | undefined>((res, rej) => {
      const tx = db.transaction(FILA_STORE, modo);
      const req = fn(tx.objectStore(FILA_STORE));
      tx.oncomplete = () => res(req ? req.result : undefined);
      tx.onerror = () => rej(tx.error ?? new Error("Falha no IndexedDB."));
      tx.onabort = () => rej(tx.error ?? new Error("Transação do IndexedDB abortada (sem espaço?)."));
    });
  } finally {
    db.close();
  }
}

function avisarMudanca() {
  try {
    const c = new BroadcastChannel(FILA_CANAL);
    c.postMessage({ tipo: "mudou" });
    c.close();
  } catch {
    /* navegador sem BroadcastChannel: o PwaShell também relê ao focar */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(FILA_CANAL));
}

export async function listarFila(): Promise<BaixaPendente[]> {
  const todos = ((await comStore<BaixaPendente[]>("readonly", (s) => s.getAll())) ?? []) as BaixaPendente[];
  return todos.sort((a, b) => a.registradoEm.localeCompare(b.registradoEm));
}

export async function lerDaFila(uid: string): Promise<BaixaPendente | undefined> {
  return (await comStore<BaixaPendente>("readonly", (s) => s.get(uid) as IDBRequest<BaixaPendente>)) ?? undefined;
}

export async function guardarNaFila(b: BaixaPendente): Promise<void> {
  await comStore("readwrite", (s) => s.put(b));
  avisarMudanca();
}

export async function tirarDaFila(uid: string): Promise<void> {
  await comStore("readwrite", (s) => s.delete(uid));
  avisarMudanca();
}

export async function filaDisponivel(): Promise<boolean> {
  try {
    (await abrirDb()).close();
    return true;
  } catch {
    return false;
  }
}

// Pede ao service worker um Background Sync (Chrome/Android). Sem suporte
// (iOS/Safari, Firefox, sem SW), não faz nada: o PwaShell reenvia ao abrir.
export async function pedirSyncEmSegundoPlano(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = (await navigator.serviceWorker.getRegistration(urlDoApp("/assistencia/"))) as
      | (ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })
      | undefined;
    await reg?.sync?.register(FILA_SYNC_TAG);
  } catch {
    /* sem permissão / sem suporte: cai no reenvio ao abrir o app */
  }
}

type Tentativa = { desfecho: Desfecho; erro: string | null; dados?: { pendentes?: number } };

async function postar(url: string, init: RequestInit, timeoutMs: number): Promise<{ status: number | null; corpo: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    const corpo = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, corpo };
  } catch {
    return { status: null, corpo: {} };
  }
}

function msg(corpo: Record<string, unknown>, padrao: string): string {
  const e = corpo.erro ?? corpo.error;
  return typeof e === "string" && e ? e : padrao;
}

// Uma tentativa de envio completa de um registro. `gravar` persiste o
// progresso (URL de foto já enviada) -- no-op quando não há IndexedDB.
export async function enviarRegistro(b: BaixaPendente, gravar: (b: BaixaPendente) => Promise<void>): Promise<Tentativa> {
  for (const foto of b.fotos) {
    if (foto.url) continue;
    const fd = new FormData();
    fd.set("photo", new File([foto.blob], foto.nome || "comprovante.jpg", { type: foto.blob.type || "image/jpeg" }));
    fd.set("cargaId", String(b.cargaId));
    fd.set("paradaId", String(b.paradaId));
    const r = await postar(urlDoApp("/assistencia/motorista/odoo/foto"), { method: "POST", body: fd }, 60_000);
    const d = desfechoDoStatus(r.status);
    if (d !== "enviado" || typeof r.corpo.url !== "string") {
      return { desfecho: d === "enviado" ? "transitorio" : d, erro: r.status === null ? "Sem conexão." : msg(r.corpo, `Foto não enviada (erro ${r.status}).`) };
    }
    foto.url = r.corpo.url;
    await gravar(b);
  }
  const r = await postar(
    urlDoApp("/assistencia/motorista/odoo/baixa"),
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpoDaBaixa(b)) },
    45_000,
  );
  const d = desfechoDoStatus(r.status);
  return {
    desfecho: d,
    erro: d === "enviado" ? null : r.status === null ? "Sem conexão." : msg(r.corpo, `Erro ${r.status} ao registrar.`),
    dados: (r.corpo.dados as { pendentes?: number } | undefined) ?? undefined,
  };
}

export type ResumoEnvio = {
  enviados: number;
  jaRegistradas: { rotulo: string; erro: string }[];
  recusadas: number;
  sessaoExpirada: boolean;
  semRede: boolean;
  porUid: Record<string, Tentativa>;
};

async function comLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined) ?? undefined;
  if (!locks) return fn();
  return locks.request(FILA_LOCK, fn) as Promise<T>;
}

// Envia a fila (ou só um uid). Registros "erro" só vão quando pedidos
// explicitamente (somente = uid) -- o motorista decide no "Tentar de novo".
export async function enviarFila(opcoes: { somente?: string } = {}): Promise<ResumoEnvio> {
  const resumo: ResumoEnvio = { enviados: 0, jaRegistradas: [], recusadas: 0, sessaoExpirada: false, semRede: false, porUid: {} };
  await comLock(async () => {
    const lista = await listarFila();
    for (const item of lista) {
      if (opcoes.somente ? item.evento_uid !== opcoes.somente : item.estado !== "pendente") continue;
      const b = item;
      const t = await enviarRegistro(b, guardarNaFila);
      resumo.porUid[b.evento_uid] = t;
      if (saiDaFila(t.desfecho)) {
        await tirarDaFila(b.evento_uid);
        if (t.desfecho === "enviado") resumo.enviados++;
        else resumo.jaRegistradas.push({ rotulo: b.rotulo, erro: t.erro ?? "Parada já registrada." });
        continue;
      }
      b.tentativas += 1;
      b.ultimoErro = t.erro;
      b.atualizadoEm = new Date().toISOString();
      if (t.desfecho === "recusada") {
        b.estado = "erro";
        resumo.recusadas++;
      }
      await guardarNaFila(b);
      if (interrompeFila(t.desfecho)) {
        if (t.desfecho === "sessao") resumo.sessaoExpirada = true;
        else resumo.semRede = true;
        break;
      }
    }
  });
  return resumo;
}

// Redução da foto antes de guardar (rede ruim na rua + espaço no celular):
// lado maior até 1600 px, JPEG 0,82. Se o navegador não decodificar (HEIC no
// Android, por exemplo), guarda o arquivo original.
export async function reduzirFoto(file: File, ladoMax = 1600): Promise<Blob> {
  try {
    if (typeof createImageBitmap !== "function" || !file.type.startsWith("image/")) return file;
    const bmp = await createImageBitmap(file);
    const escala = Math.min(1, ladoMax / Math.max(bmp.width, bmp.height));
    if (escala === 1 && file.size < 1_500_000) {
      bmp.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
