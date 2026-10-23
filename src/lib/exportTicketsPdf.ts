import type { ReportRowItem } from "./serviceRequests";
import { REQUEST_TYPE_LABELS, STATUS_LABELS } from "./assistenciaLabels";
import { formatDateTimeBr } from "./formatDateTime";

// "Salvar relatório" no modal de chamados (AssistenciaTicketsModal.tsx) --
// pedido do Victor 23/10/2026: poder baixar em PDF os chamados de um
// conferente específico (ou qualquer outro drill-down desse painel) pra
// mandar pra pessoa com a quantidade e o detalhe de cada erro. Primeira
// geração de PDF de verdade do projeto -- import dinâmico do jsPDF (só
// carrega quando o botão é clicado, não pesa o bundle de quem nunca usa).

const MARGIN_X = 40;
const LINE_HEIGHT = 13;
const PAGE_BOTTOM_MARGIN = 40;

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

export async function exportTicketsPdf(title: string, totalCount: number, tickets: ReportRowItem[]): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - MARGIN_X * 2;
  let y = 50;

  function ensureSpace(nextLineHeight: number) {
    if (y + nextLineHeight > pageHeight - PAGE_BOTTOM_MARGIN) {
      doc.addPage();
      y = 50;
    }
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN_X, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Gerado em ${formatDateTimeBr(new Date().toISOString())}`, MARGIN_X, y);
  y += LINE_HEIGHT + 1;
  doc.text(`${tickets.length} de ${totalCount} chamado${totalCount === 1 ? "" : "s"}`, MARGIN_X, y);
  y += 18;

  if (tickets.length === 0) {
    doc.text("Nenhum chamado encontrado pra esse período.", MARGIN_X, y);
  }

  for (const t of tickets) {
    ensureSpace(LINE_HEIGHT * 2);
    doc.setDrawColor(220);
    doc.line(MARGIN_X, y, pageWidth - MARGIN_X, y);
    y += 16;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`#${t.ticketNumber} · ${STATUS_LABELS[t.status] ?? t.status}`, MARGIN_X, y);
    y += LINE_HEIGHT + 1;

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

    if (t.reason) {
      const lines: string[] = doc.splitTextToSize(`Motivo: ${t.reason}`, maxWidth);
      for (const line of lines) {
        ensureSpace(LINE_HEIGHT);
        doc.text(line, MARGIN_X, y);
        y += LINE_HEIGHT;
      }
    }
    y += 6;
  }

  const fileName = `relatorio-${slugify(title)}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
