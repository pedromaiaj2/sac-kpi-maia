"use client";

import { useEffect, useState } from "react";

// Nota fiscal em PDF desenhada como imagem (uma por página) -- achado do
// Victor 14/10/2026: a notificação saía com folha em branco no lugar da
// nota. O Chrome novo (155) abre o PDF de um <embed> num processo à parte e
// não imprime esse conteúdo (reproduzido: a página impressa vem vazia). Imagem
// sempre imprime. O PDF é lido aqui mesmo, no navegador, com o pdf.js
// (pdfjs-dist), carregado só nas telas de impressão.
//
// Enquanto desenha, o bloco fica com data-nota-pdf="carregando": o
// PrintButton espera isso sumir antes de abrir a impressão.

type Estado = { tipo: "carregando" } | { tipo: "pronto"; paginas: string[] } | { tipo: "erro" };

// 2x a resolução CSS: legível no papel sem pesar demais (nota de 1-2 páginas).
const ESCALA = 2;

export function NotaFiscalPdf({ url }: { url: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        // Nas instâncias por IP o app roda sob um basePath (/apps...), que a
        // URL da foto (/api/photos/...) não traz: o prefixo vem da página.
        const base = window.location.pathname.split("/assistencia/")[0];
        const tarefa = pdfjs.getDocument({ url: `${window.location.origin}${base}${url}` });
        const doc = await tarefa.promise;
        const paginas: string[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const pagina = await doc.getPage(n);
          const viewport = pagina.getViewport({ scale: ESCALA });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await pagina.render({ canvas, viewport }).promise;
          paginas.push(canvas.toDataURL("image/png"));
        }
        await tarefa.destroy();
        if (!cancelado) setEstado({ tipo: "pronto", paginas });
      } catch {
        if (!cancelado) setEstado({ tipo: "erro" });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [url]);

  if (estado.tipo === "carregando") {
    return (
      <p data-nota-pdf="carregando" className="text-sm py-6" style={{ color: "var(--text-muted)" }}>
        Preparando a nota fiscal para impressão…
      </p>
    );
  }
  if (estado.tipo === "erro") {
    return (
      <p className="text-sm py-6" style={{ color: "var(--status-critical)" }}>
        Não consegui preparar a nota para impressão.{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
          Abrir o PDF da nota
        </a>{" "}
        e imprimir à parte.
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 print:gap-0 w-full">
      {estado.paginas.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- data URL gerada aqui, sem otimização do Next
        <img
          key={i}
          src={src}
          alt={`Nota fiscal, página ${i + 1}`}
          style={{ maxWidth: "100%", maxHeight: "260mm", objectFit: "contain", breakInside: "avoid", pageBreakInside: "avoid" }}
          className={i > 0 ? "print:break-before-page" : undefined}
        />
      ))}
    </div>
  );
}
