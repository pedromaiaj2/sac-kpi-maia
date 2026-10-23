-- Pedido de avaliação Google pros clientes promotores (nota 4-5 em
-- qualquer uma das pesquisas de NPS por pedido/chamado) -- pedido do Victor
-- 23/10/2026: "aos clientes promotores, o envio para fazerem uma avaliação
-- do google da loja onde compraram". Reaproveita a mesma mecânica de tag +
-- Workflow do GHL que as pesquisas de NPS já usam (ver npsEnvio.ts) -- essa
-- tabela só serve pra não pedir duas vezes pro mesmo pedido/chamado
-- (unique(origem, origem_id)), mesmo papel de "reserva antes da tag" que
-- venda_nps/entrega_nps/compra_nps já cumprem pra pesquisa em si.
--
-- `origem_id` é o id do pedido (totvs_orders, origem 'venda'/'entrega'/
-- 'compra') ou do chamado (service_requests, origem 'montagem'/
-- 'assistencia_tecnica') que gerou a nota -- guardado como texto porque as
-- duas fontes são uuid de tabelas diferentes, sem FK direta (mesmo porquê
-- de nps_detrator_status.origem_id, já texto solto).
create table if not exists google_review_requests (
  id uuid primary key default gen_random_uuid(),
  origem text not null,
  origem_id text not null,
  client_id text,
  store_id text references stores(id),
  score smallint not null check (score >= 1 and score <= 5),
  ghl_contact_id text not null,
  enviado_em timestamptz not null default now(),
  unique (origem, origem_id)
);
