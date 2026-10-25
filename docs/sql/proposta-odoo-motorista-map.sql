-- PROPOSTA (NÃO APLICADA, NÃO está em supabase/migrations de propósito):
-- de-para motorista deste sistema (drivers.name) x motorista do Odoo
-- (hr.employee.id). Hoje o código usa ODOO_MOTORISTA_MAP (env) ou nome
-- exato; com esta tabela, ela vira o passo 0 de lib/odoo/motoristaMap.ts e
-- o CPF desempata homônimos. Victor decide número da migração e RLS.

create table if not exists odoo_motorista_map (
  driver_name       text primary key references drivers(name) on update cascade on delete cascade,
  odoo_employee_id  integer not null,
  odoo_company_id   integer,              -- res.company onde o motorista roda (CD = 13?)
  cpf               text check (cpf is null or cpf ~ '^\d{11}$'),
  ativo             boolean not null default true,
  atualizado_em     timestamptz not null default now(),
  atualizado_por    text,
  unique (odoo_employee_id)
);

-- Só o servidor (service role) lê/escreve; nenhuma policy para anon/auth.
alter table odoo_motorista_map enable row level security;
