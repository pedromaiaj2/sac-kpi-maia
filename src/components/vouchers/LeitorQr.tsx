"use client";

import { useEffect, useRef, useState } from "react";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

// Lê o QR do voucher pela câmera (traseira no celular, webcam no PC). Usa o
// leitor nativo do navegador quando existe (Chrome/Android/Edge) e o jsQR
// no resto (Safari/iPhone). Câmera só funciona em HTTPS.
export function LeitorQr({ onLido, onFechar }: { onLido: (texto: string) => void; onFechar: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let parar = false;
    let stream: MediaStream | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro("Este navegador não libera a câmera aqui. Digite o código.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        setErro("Não consegui abrir a câmera (permissão negada ou sem câmera). Digite o código.");
        return;
      }
      const video = videoRef.current;
      if (!video || parar) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const Nativo = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      const nativo = Nativo ? new Nativo({ formats: ["qr_code"] }) : null;
      const jsQR = nativo ? null : (await import("jsqr")).default;

      while (!parar) {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          let texto: string | null = null;
          if (nativo) {
            const achados = await nativo.detect(video).catch(() => []);
            texto = achados[0]?.rawValue ?? null;
          } else if (jsQR && ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            texto = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
          }
          if (texto) {
            onLido(texto);
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    iniciar();
    return () => {
      parar = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onLido]);

  return (
    <div className="flex flex-col gap-2">
      {erro ? (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
          {erro}
        </p>
      ) : (
        <video ref={videoRef} muted playsInline className="w-full max-w-sm rounded-lg bg-black aspect-square object-cover" />
      )}
      <button type="button" onClick={onFechar} className="self-start text-sm underline" style={{ color: "var(--text-secondary)" }}>
        Fechar câmera
      </button>
    </div>
  );
}
