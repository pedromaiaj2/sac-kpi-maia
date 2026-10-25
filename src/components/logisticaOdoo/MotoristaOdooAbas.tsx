import Link from "next/link";

// Alterna entre as rotas de troca/recolhimento (sistema do Victor) e as
// entregas de venda (Odoo) dentro do app do motorista.
export function MotoristaOdooAbas({ ativa }: { ativa: "assistencia" | "odoo" }) {
  const item = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      className="text-xs px-3 py-1.5 rounded-full border"
      style={{
        borderColor: "var(--border)",
        background: on ? "var(--surface-1)" : "transparent",
        color: on ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: on ? 600 : 400,
      }}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {item("/assistencia/motorista", "Trocas e recolhimentos", ativa === "assistencia")}
      {item("/assistencia/motorista/odoo", "🚚 Entregas Odoo", ativa === "odoo")}
    </div>
  );
}
