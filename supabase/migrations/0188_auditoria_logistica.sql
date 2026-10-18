-- (18/10/2026) Conferência noturna com o Protheus (pedido do Victor: "todos
-- os números fidedignos"). Toda madrugada /api/totvs-sync-auditoria compara as
-- cargas dos últimos 45 dias com o load=<carga> da API, corrige o que dá
-- (reconsulta pelo documento do cliente) e grava aqui o resultado e o que
-- continuou diferente. O bloco "Qualidade dos dados" de /kpis/logistica
-- mostra a última. Só o servidor (service_role) lê e escreve.
create table if not exists auditoria_logistica (
  id bigint generated always as identity primary key,
  executada_em timestamptz not null default now(),
  de date not null,
  ate date not null,
  cargas integer not null,
  linhas integer not null,
  itens integer not null,
  falhas integer not null,
  encontradas integer not null,
  removidas integer not null,
  -- [{tipo, carga, pedido, detalhe}] que continuaram diferentes depois da correção
  divergencias jsonb not null default '[]',
  erros jsonb not null default '[]'
);

create index if not exists auditoria_logistica_executada_em_idx on auditoria_logistica (executada_em desc);

alter table auditoria_logistica enable row level security;
revoke all on public.auditoria_logistica from anon, authenticated;
grant select, insert on public.auditoria_logistica to service_role;
