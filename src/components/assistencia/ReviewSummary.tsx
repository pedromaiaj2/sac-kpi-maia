// Extraído de PublicRequestForm.tsx -- pedido do Victor 24/10/2026: "ao
// finalizar uma notificação de assistencia, apareça um resumo da
// notificação com uma mensagem bem explicita... CONFIRA TODAS AS
// INFORMAÇÕES E VERIFIQUE SE ESTÁ TUDO CORRETO ANTES DE PROSSEGUIR". O
// PublicRequestForm já tinha esse padrão de revisão (reviewing/snapshot +
// SummaryRow local), só sem o aviso explícito -- em vez de duplicar
// SummaryRow em cada um dos 4 formulários novos, compartilha daqui.
export function SummaryRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

export function ReviewWarningBanner() {
  return (
    <div
      className="rounded-lg border-2 px-3 py-2 text-sm font-bold text-center"
      style={{
        borderColor: "var(--status-warning)",
        background: "color-mix(in srgb, var(--status-warning) 12%, var(--surface-1))",
        color: "var(--text-primary)",
      }}
    >
      ⚠️ CONFIRA TODAS AS INFORMAÇÕES ABAIXO E VERIFIQUE SE ESTÁ TUDO CORRETO ANTES DE PROSSEGUIR
    </div>
  );
}
