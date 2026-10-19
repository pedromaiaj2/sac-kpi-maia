-- NPS "Pós-venda" -- pedido do Victor 19/10/2026: avaliação do ATENDIMENTO
-- EM LOJA, disparada assim que a venda é registrada no Protheus (sem
-- esperar entrega/montagem/assistência nenhuma por trás). Mesmo espírito de
-- compra_nps/entrega_nps (0115/0137) -- por PEDIDO de venda (totvs_orders),
-- não por chamado de assistência -- só que com janela ainda mais curta
-- (mesmo dia/poucos dias, não 1-2 dias ou 20 dias, ver TARGET_DAYS_AGO em
-- vendaNps.ts) e sem depender de totvs_delivery_cargas (a venda já é o
-- gatilho, entrega nem precisa ter acontecido ainda).
create table if not exists venda_nps (
  order_id uuid primary key references totvs_orders(id) on delete cascade,
  client_id text not null,
  ghl_contact_id text not null,
  enviado_em timestamptz not null default now(),
  respondido_em timestamptz,
  score smallint check (score is null or (score >= 1 and score <= 5)),
  comentario text
);

create index if not exists venda_nps_pendente_idx
  on venda_nps (enviado_em)
  where respondido_em is null;

alter table nps_detrator_status drop constraint if exists nps_detrator_status_origem_check;
alter table nps_detrator_status add constraint nps_detrator_status_origem_check
  check (origem in ('sac', 'montagem', 'assistencia_tecnica', 'entrega', 'compra', 'venda'));
