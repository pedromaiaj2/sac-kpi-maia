-- Nova sub-aba "Conversão 1ª → 2ª Compra" em /clientes (pedido do Victor
-- 13/10/2026): precisa, por cliente, da data/loja/forma de pagamento da 1ª
-- compra e da data da 2ª (se existir). Isso exige uma window function
-- sobre totvs_orders inteira (168k+ linhas tipo Venda) -- caro demais pra
-- recalcular a cada carregamento de página.
--
-- Mesmo padrão já validado em produção pelas migrations 0124/0129/0130
-- (materialized view + refresh via pg_cron, não view normal): a 0123 (view
-- normal recalculada a cada consulta) derrubou produção em 12/09/2026
-- porque o código pagina em paralelo e múltiplas consultas concorrentes
-- esgotaram o Postgres. Aqui só adiciono a view nova na MESMA função de
-- refresh que o pg_cron já chama a cada 30min -- sem job novo.
--
-- Mais barata que v_recompra_categorias_por_cliente (~3s hoje): não faz
-- join com totvs_order_items, só uma window function sobre totvs_orders.
create materialized view v_clientes_primeira_segunda_compra as
with vendas_rankeadas as (
  select
    client_id,
    issue_date,
    branch,
    payment_method,
    row_number() over (partition by client_id order by issue_date, invoice, serie) as rn
  from totvs_orders
  where type = 'Venda' and client_id is not null
)
select
  client_id,
  max(case when rn = 1 then issue_date end) as primeira_compra,
  max(case when rn = 1 then branch end) as loja_primeira_compra,
  max(case when rn = 1 then payment_method end) as forma_pagamento_primeira_compra,
  max(case when rn = 2 then issue_date end) as segunda_compra
from vendas_rankeadas
where rn <= 2
group by client_id
with data;

create unique index v_clientes_primeira_segunda_compra_idx
  on v_clientes_primeira_segunda_compra (client_id);

-- Mesma função de sempre (migration 0129), só adicionando o refresh dessa
-- view nova -- mesma assinatura, mesmo SET statement_timeout, mesmo grant.
-- O pg_cron (migration 0130) já chama essa função a cada 30min.
create or replace function refresh_clientes_recompra_views()
returns void
language plpgsql
security definer
set search_path = public
set statement_timeout = '10min'
as $$
begin
  refresh materialized view concurrently v_clientes_agregado_nivel;
  refresh materialized view concurrently v_recompra_categorias_por_cliente;
  refresh materialized view concurrently v_clientes_primeira_segunda_compra;
end;
$$;

grant execute on function refresh_clientes_recompra_views() to service_role;
