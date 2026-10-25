import { readFileSync, existsSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { basePathDe } from "./base";
import { corpoDaBaixa, desfechoDoStatus, interrompeFila, novoEventoUid, saiDaFila, textoPendentes, type BaixaPendente } from "./filaBaixasRegras";
import { eventoUidValido } from "@/lib/odoo/baixaIdempotencia";

const raiz = path.resolve(__dirname, "../../..");
const swFonte = readFileSync(path.join(raiz, "public/assistencia/sw.js"), "utf8");

// Extrai a função desfechoDoStatus do sw.js (JS puro) para conferir que o
// service worker classifica igual à página.
function desfechoDoSw(): (s: number | null) => string {
  const m = /function desfechoDoStatus\(status\) \{[\s\S]*?\n\}/.exec(swFonte);
  if (!m) throw new Error("desfechoDoStatus não encontrada no sw.js");
  return new Function(`${m[0]}; return desfechoDoStatus;`)() as (s: number | null) => string;
}

function baixa(extra: Partial<BaixaPendente> = {}): BaixaPendente {
  return {
    evento_uid: "0b6f2f1e-9a4c-4c1d-8f00-1234567890ab",
    cargaId: 28,
    paradaId: 7,
    rotulo: "Maria",
    resultado: "entregue",
    motivo: null,
    obs: "deixado com o porteiro",
    geoLat: -7.1,
    geoLng: -34.8,
    registradoEm: "2026-10-25T13:00:00.000Z",
    fotos: [],
    estado: "pendente",
    tentativas: 0,
    ultimoErro: null,
    atualizadoEm: "2026-10-25T13:00:00.000Z",
    ...extra,
  };
}

describe("fila offline: desfecho pelo status HTTP", () => {
  it("contrato da rota baixa", () => {
    expect(desfechoDoStatus(200)).toBe("enviado");
    expect(desfechoDoStatus(409)).toBe("ja_registrada");
    expect(desfechoDoStatus(401)).toBe("sessao");
    expect(desfechoDoStatus(422)).toBe("recusada");
    expect(desfechoDoStatus(503)).toBe("transitorio");
    expect(desfechoDoStatus(null)).toBe("transitorio");
  });
  it("404/500/502/504 nunca descartam a baixa", () => {
    for (const s of [404, 408, 429, 500, 502, 504]) {
      expect(desfechoDoStatus(s)).toBe("transitorio");
      expect(saiDaFila(desfechoDoStatus(s))).toBe(false);
    }
  });
  it("só enviado/ja_registrada saem; sessão e sem rede param a fila", () => {
    expect(saiDaFila("enviado")).toBe(true);
    expect(saiDaFila("ja_registrada")).toBe(true);
    expect(saiDaFila("recusada")).toBe(false);
    expect(interrompeFila("sessao")).toBe(true);
    expect(interrompeFila("transitorio")).toBe(true);
    expect(interrompeFila("recusada")).toBe(false);
  });
  it("service worker classifica igual à página", () => {
    const sw = desfechoDoSw();
    for (const s of [null, 200, 201, 204, 400, 401, 403, 404, 409, 413, 422, 429, 500, 502, 503, 504]) {
      expect(sw(s)).toBe(desfechoDoStatus(s));
    }
  });
});

describe("fila offline: corpo e uid", () => {
  it("corpo leva evento_uid, hora do toque e só fotos já enviadas", () => {
    const c = corpoDaBaixa(
      baixa({
        fotos: [
          { id: "a", blob: new Blob(["x"]), nome: "a.jpg", url: "https://x/api/photos/odoo-entregas/a.jpg" },
          { id: "b", blob: new Blob(["y"]), nome: "b.jpg", url: null },
        ],
      }),
    );
    expect(c.eventoUid).toBe("0b6f2f1e-9a4c-4c1d-8f00-1234567890ab");
    expect(c.registradoEm).toBe("2026-10-25T13:00:00.000Z");
    expect(c.fotoUrls).toEqual(["https://x/api/photos/odoo-entregas/a.jpg"]);
    expect(c).not.toHaveProperty("fotos");
  });
  it("sw.js manda os mesmos campos que a página", () => {
    for (const k of Object.keys(corpoDaBaixa(baixa()))) expect(swFonte).toContain(`${k}:`);
  });
  it("uid v4 válido com e sem randomUUID", () => {
    expect(eventoUidValido(novoEventoUid())).toBe(true);
    const semRandomUUID = { getRandomValues: <T extends ArrayBufferView | null>(a: T) => globalThis.crypto.getRandomValues(a as Uint8Array) as unknown as T };
    const uid = novoEventoUid(semRandomUUID as Pick<Crypto, "getRandomValues">);
    expect(eventoUidValido(uid)).toBe(true);
    expect(uid).not.toBe(novoEventoUid(semRandomUUID as Pick<Crypto, "getRandomValues">));
  });
  it("texto do indicador", () => {
    expect(textoPendentes(1)).toBe("1 baixa aguardando envio");
    expect(textoPendentes(3)).toBe("3 baixas aguardando envio");
  });
});

describe("basePath", () => {
  it("domínio próprio e instâncias por IP", () => {
    expect(basePathDe("/assistencia/motorista/odoo")).toBe("");
    expect(basePathDe("/apps/assistencia/motorista")).toBe("/apps");
    expect(basePathDe("/apps/sac/assistencia/")).toBe("/apps/sac");
    expect(basePathDe("/apps/assistencia")).toBe("/apps");
    expect(basePathDe("/kpis")).toBe("");
  });
});

describe("manifest e service worker", () => {
  const manifest = JSON.parse(readFileSync(path.join(raiz, "public/assistencia/manifest.webmanifest"), "utf8"));
  it("nome, escopo e start_url relativos (respeitam o basePath)", () => {
    expect(manifest.name).toBe("Maia Entregas");
    expect(manifest.short_name).toBe("Maia Entregas");
    expect(manifest.display).toBe("standalone");
    expect(manifest.scope).toBe("./");
    expect(manifest.start_url).toBe("./motorista");
    // resolvidos contra a URL do manifest, com e sem basePath
    expect(new URL(manifest.start_url, "https://a.b/assistencia/manifest.webmanifest").pathname).toBe("/assistencia/motorista");
    expect(new URL(manifest.scope, "https://a.b/apps/assistencia/manifest.webmanifest").pathname).toBe("/apps/assistencia/");
  });
  it("ícones 192/512 any e maskable existem", () => {
    const tamanhos = (p: string) => manifest.icons.filter((i: { purpose: string }) => i.purpose === p).map((i: { sizes: string }) => i.sizes);
    expect(tamanhos("any")).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(tamanhos("maskable")).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const i of manifest.icons) expect(existsSync(path.join(raiz, "public/assistencia", i.src))).toBe(true);
    expect(existsSync(path.join(raiz, "public/assistencia/pwa/apple-touch-icon.png"))).toBe(true);
  });
  it("sw.js não intercepta API, POST, RSC nem fotos e não cacheia páginas", () => {
    expect(swFonte).toMatch(/req\.method !== "GET"/);
    expect(swFonte).toMatch(/\/api\//);
    expect(swFonte).toMatch(/_rsc/);
    expect(swFonte).toMatch(/Next-Action/);
    expect(swFonte).toMatch(/nunca vai para o cache/);
    expect(swFonte).toMatch(/const SW_VERSAO = "/);
  });
});
