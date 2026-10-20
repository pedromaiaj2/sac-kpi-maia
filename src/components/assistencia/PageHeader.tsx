// Título H1 + descrição + CTA no canto direito -- padrão único pras telas
// de operação (Agenda, Entregas/Fila, Solicitações, Estoque, Reclamações),
// pedido do Victor 25/08/2026 ("guia de padronização"): "Todas as telas
// devem começar com o Título H1 alinhado à esquerda, seguido de uma breve
// descrição em texto cinza abaixo... botão principal de criação sempre
// fixado no canto superior direito". Não confundir com AssistenciaHeader
// (logo + "Assistência — Lojas Maia", identidade do app inteiro, um por
// layout) -- esse aqui é o título de CADA tela, renderizado abaixo dele.
export function PageHeader({ title, description, cta }: { title: string; description?: string; cta?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      {/* Tipografia alinhada com o mural "Rotas de hoje" da Logística
          (RotasDoDia.tsx, pedido do Victor 20/10/2026: levar esse visual
          pras telas de Solicitações/Controle Assistência) -- título maior
          em negrito nos tokens do tema, substitui o cinza-800 fixo do
          Guia de Componentes de 01/09/2026 (decisão deliberada da época,
          atualizada agora por pedido explícito). */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        {description ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {description}
          </p>
        ) : null}
      </div>
      {cta}
    </div>
  );
}
