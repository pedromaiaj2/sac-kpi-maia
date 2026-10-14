// Visual da imagem do voucher (PNG 1080x1350 mandado pelo WhatsApp) --
// trocar logo ou cores é só mexer aqui. A logo é lida do disco na hora de
// gerar a imagem (caminho relativo à raiz do projeto); PNG ou JPG.
export const VOUCHER_VISUAL = {
  logoArquivo: "public/logo.png",
  // Geist (licença OFL, assets/voucher/OFL-Geist.txt): a fonte padrão da
  // geração de imagem só tem o peso normal.
  fonteRegular: "assets/voucher/Geist-Regular.ttf",
  fonteNegrito: "assets/voucher/Geist-Bold.ttf",
  largura: 1080,
  altura: 1350,
  cores: {
    fundo: "#1b5e3c", // verde Lojas Maia (--brand-green)
    destaque: "#f2871a", // laranja Lojas Maia (--brand-orange)
    cartao: "#ffffff",
    texto: "#1d2420",
    textoSuave: "#5b6660",
    textoNoDestaque: "#ffffff",
  },
} as const;
