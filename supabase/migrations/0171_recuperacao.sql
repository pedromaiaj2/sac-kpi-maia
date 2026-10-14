-- Central de Recuperação -- pedido do Victor 14/10/2026: uma tela só dele
-- com os clientes a recontatar (detratores de NPS + quem pediu estorno),
-- juntos por cliente, com classificação, anotação e próximo contato.
-- Os casos em si vêm das tabelas de origem (NPS, estornos); aqui fica só o
-- que ele decide sobre cada CLIENTE (chave = CPF, ou telefone sem CPF).
-- O status dos detratores também é gravado em nps_detrator_status, pra
-- tela de Avaliações não contradizer esta.

create table recuperacao_clientes (
  chave text primary key check (chave ~ '^(cpf:[0-9]{11}|tel:[0-9]{8}|nome:.+)$'),
  status text not null default 'novo'
    check (status in ('novo', 'em_contato', 'aguardando_cliente', 'recuperado', 'perdido', 'nao_contatar')),
  causa text check (causa in ('atraso_entrega', 'defeito_assistencia', 'atendimento', 'produto', 'preco', 'outro')),
  anotacao text,
  proximo_contato date,
  atualizado_em timestamptz not null default now(),
  atualizado_por text not null
);

create table recuperacao_eventos (
  id bigint generated always as identity primary key,
  chave text not null,
  campo text not null,
  de text,
  para text,
  por text not null,
  em timestamptz not null default now()
);

create index recuperacao_eventos_chave_idx on recuperacao_eventos (chave, em desc);

alter table recuperacao_clientes enable row level security;
alter table recuperacao_eventos enable row level security;

grant select, insert, update, delete on recuperacao_clientes to service_role;
grant select, insert, update, delete on recuperacao_eventos to service_role;
revoke all on recuperacao_clientes from anon, authenticated;
revoke all on recuperacao_eventos from anon, authenticated;

notify pgrst, 'reload schema';
