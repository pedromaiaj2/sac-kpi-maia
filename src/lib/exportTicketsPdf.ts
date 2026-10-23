import type { ReportRowItem } from "./serviceRequests";
import { REQUEST_TYPE_LABELS, STATUS_LABELS } from "./assistenciaLabels";
import { formatDateTimeBr } from "./formatDateTime";

// "Salvar relatório" no modal de chamados (AssistenciaTicketsModal.tsx) --
// pedido do Victor 23/10/2026: poder baixar em PDF os chamados de um
// conferente específico (ou qualquer outro drill-down desse painel) pra
// mandar pra pessoa com a quantidade e o detalhe de cada erro. Pedido
// seguinte (mesmo dia): "sair um pouco mais organizado, com uma identidade
// visual" -- cabeçalho com a cor/logo da Lojas Maia em vez de só texto
// corrido, e cada chamado com uma faixa colorida pelo status (mesmas cores
// de STATUS_COLORS/assistenciaLabels.ts, mas em hex -- jsPDF não resolve
// var(--...) do CSS). Primeira geração de PDF de verdade do projeto --
// import dinâmico do jsPDF (só carrega quando o botão é clicado, não pesa
// o bundle de quem nunca usa).

const MARGIN_X = 40;
const LINE_HEIGHT = 13;
const PAGE_TOP_MARGIN = 46;
const PAGE_BOTTOM_MARGIN = 46;
const BRAND_GREEN = "#1b5e3c";
const TEXT_MUTED = "#6e6c66";
const TEXT_PRIMARY = "#1f2421";

// Mesmas cores de STATUS_COLORS (assistenciaLabels.ts), em hex -- só o
// subconjunto usado nos tipos de DELIVERY_REQUEST_TYPES (os únicos que
// entram nesse relatório, ver getAssistenciaKpiData).
const STATUS_COLOR_HEX: Record<string, string> = {
  aberta: "#fab219",
  em_contato: "#2a78d6",
  em_andamento: "#f2871a",
  aguardando_aprovacao: "#eda100",
  remarcar: "#d03b3b",
  concluida: "#0ca30c",
  cancelada: "#6e6c66",
};

function statusColor(status: string): string {
  return STATUS_COLOR_HEX[status] ?? TEXT_MUTED;
}

function slugify(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 60);
  return slug || "relatorio";
}

// Logo embutido no cabeçalho -- busca /logo.png (mesmo arquivo do
// public/, já usado no resto do site) e converte pra data URL, formato que
// jsPDF aceita direto em addImage. Best-effort: se não conseguir buscar
// (ex. offline), o cabeçalho sai só com o texto, sem travar o PDF inteiro
// por causa de uma imagem.
async function fetchLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportTicketsPdf(title: string, totalCount: number, tickets: ReportRowItem[]): Promise<void> {
  const [{ default: jsPDF }, logoDataUrl] = await Promise.all([import("jspdf"), fetchLogoDataUrl()]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - MARGIN_X * 2;

  // Cabeçalho verde -- só na 1ª página (o resto é conteúdo corrido, não
  // repete o banner pra não gastar espaço útil de cada página nova).
  function drawHeader() {
    doc.setFillColor(BRAND_GREEN);
    doc.rect(0, 0, pageWidth, 70, "F");
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, "PNG", MARGIN_X, 14, 42, 42);
      } catch {
        // best-effort, ver comentário em fetchLogoDataUrl.
      }
    }
    const textX = logoDataUrl ? MARGIN_X + 54 : MARGIN_X;
    doc.setTextColor("#ffffff");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(title, textX, 34, { maxWidth: pageWidth - textX - MARGIN_X });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      `Relatório de Assistência · Gerado em ${formatDateTimeBr(new Date().toISOString())} · ${tickets.length} de ${totalCount} chamado${totalCount === 1 ? "" : "s"}`,
      textX,
      52,
      { maxWidth: pageWidth - textX - MARGIN_X }
    );
    doc.setTextColor(TEXT_PRIMARY);
  }

  drawHeader();
  let y = 70 + 30;

  function ensureSpace(nextBlockHeight: number) {
    if (y + nextBlockHeight > pageHeight - PAGE_BOTTOM_MARGIN) {
      doc.addPage();
      y = PAGE_TOP_MARGIN;
    }
  }

  if (tickets.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(TEXT_MUTED);
    doc.text("Nenhum chamado encontrado pra esse período.", MARGIN_X, y);
  }

  for (const t of tickets) {
    ensureSpace(LINE_HEIGHT * 3);

    // Topo do bloco -- marcado aqui pra desenhar a faixa colorida da
    // esquerda só DEPOIS de escrever o texto todo (só então sabemos a
    // altura real do bloco, ver doc.rect mais abaixo).
    const blockTop = y - 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(TEXT_PRIMARY);
    doc.text(`#${t.ticketNumber}`, MARGIN_X, y);
    doc.setTextColor(statusColor(t.status));
    doc.text(STATUS_LABELS[t.status] ?? t.status, MARGIN_X + 50, y);
    doc.setTextColor(TEXT_PRIMARY);
    y += LINE_HEIGHT + 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${t.clientName ?? "Sem nome"} — ${formatDateTimeBr(t.createdAt)}`, MARGIN_X, y);
    y += LINE_HEIGHT;
    doc.text(`${REQUEST_TYPE_LABELS[t.type] ?? t.type} · ${t.storeName}`, MARGIN_X, y);
    y += LINE_HEIGHT;

    if (t.productSummary) {
      ensureSpace(LINE_HEIGHT);
      doc.text(`Produto: ${t.productSummary}`, MARGIN_X, y);
      y += LINE_HEIGHT;
    }

    if (t.numeroCarga) {
      ensureSpace(LINE_HEIGHT);
      doc.text(`Carga: ${t.numeroCarga}`, MARGIN_X, y);
      y += LINE_HEIGHT;
    }

    if (t.reason) {
      const lines: string[] = doc.splitTextToSize(`Motivo: ${t.reason}`, maxWidth);
      for (const line of lines) {
        ensureSpace(LINE_HEIGHT);
        doc.text(line, MARGIN_X, y);
        y += LINE_HEIGHT;
      }
    }

    // Faixa colorida de verdade (agora que já sabemos onde o bloco termina)
    // + linha divisória sutil embaixo.
    doc.setFillColor(statusColor(t.status));
    doc.rect(MARGIN_X - 10, blockTop, 3, y - blockTop - 4, "F");
    y += 6;
    doc.setDrawColor(230);
    doc.line(MARGIN_X, y, pageWidth - MARGIN_X, y);
    y += 16;
  }

  // Rodapé "Página X de Y" -- só dá pra saber o total depois de montar o
  // documento inteiro, por isso um 2º passe sobre todas as páginas já
  // criadas (getNumberOfPages/setPage, API padrão do jsPDF pra isso).
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(TEXT_MUTED);
    doc.text(`Lojas Maia · Página ${page} de ${totalPages}`, pageWidth / 2, pageHeight - 20, { align: "center" });
  }

  const fileName = `relatorio-${slugify(title)}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
