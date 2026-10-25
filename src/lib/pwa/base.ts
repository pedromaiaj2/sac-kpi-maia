// Prefixo de caminho (basePath) em que o app está servido. As instâncias por
// IP rodam sob /apps ou /apps/sac (NEXT_BASE_PATH, ver next.config.ts); no
// domínio próprio é "". Mesmo jeito que o resto do repo descobre no client
// (CompartilharVoucher, NotaFiscalPdf): o prefixo vem da própria URL.
export function basePathDe(pathname: string): string {
  const m = /^(.*?)\/assistencia(?:\/|$)/.exec(pathname);
  return m ? m[1] : "";
}

export function appBase(): string {
  return typeof window === "undefined" ? "" : basePathDe(window.location.pathname);
}

// URL absoluta (com basePath) de um caminho do app que começa com "/".
export function urlDoApp(caminho: string): string {
  return `${appBase()}${caminho}`;
}
