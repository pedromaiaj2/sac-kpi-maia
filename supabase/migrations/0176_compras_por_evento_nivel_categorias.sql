-- Continuacao da correcao de "2a compra" (migration 0175): o mesmo bug de
-- contar NOTA em vez de EVENTO DE COMPRA (compras do mesmo cliente em ate
-- 7 dias da 1a, janela fixa a partir da ancora, contam como uma so)
-- tambem inflava `compras` em v_clientes_agregado_nivel e `qtd_compras`
-- em v_recompra_categorias_por_cliente -- auditoria pedida pelo Victor
-- 16/10/2026 depois da correcao da aba Conversao, encontrou os dois.
--
-- Validado (consulta avulsa, somente leitura) antes desta migration:
-- clientes que batiam "Ouro" so pelo criterio direto de compras (>=3)
-- caiam de 11.624 pra 5.083 (-56%); "Prata" (compras=2) de 21.128 pra
-- 14.685 (-30%); "Bronze" (1 compra) subia de 64.849 pra 77.833. Em
-- v_recompra_categorias_por_cliente, colchao caia de 84.043 pra 56.018
-- notas-de-categoria (muita nota com colchao+box ou colchao+protetor no
-- mesmo evento). Ambas recalculam em menos de 10s -- dentro do orcamento
-- do refresh_clientes_recompra_views() existente (10min, 3 views).
--
-- NENHUM codigo da aplicacao muda nesta migration -- os nomes de coluna
-- de ambas as views continuam os mesmos (client_id/nome/cpf_cnpj/compras/
-- gasto_acumulado/primeira_compra/ultima_compra/branches e client_id/
-- categoria/valor_total/qtd_compras/ultima_data), so o CALCULO de
-- `compras`/`qtd_compras` muda -- clientes.ts (listClientesPorNivel),
-- recompra.ts (buildCategoriasPorCliente/detectarPadraoFidelidade/
-- buildClvProjetadoPorCliente) e recuperacao.ts (nivel da fila) herdam a
-- correcao sem precisar de deploy de app.
--
-- Exclusao de cliente interno/sintetico ENTRA NAS DUAS QUERIES (mesmo
-- motivo da migration 0175: CONSUMIDOR FINAL e as filiais da LOJAS AIAM
-- tem milhares de notas/itens, inviabilizando a CTE recursiva necessaria
-- pro agrupamento por evento) -- diferente da 0175, aqui isso MUDA o
-- conjunto de linhas da view (a view original incluia esses client_ids).
-- Seguro: os dois consumidores de v_clientes_agregado_nivel
-- (listClientesPorNivel, recuperacao.ts) ja descartavam/nunca buscavam
-- esses client_ids (isClienteInterno filtra no app, e recuperacao.ts so
-- busca por CPF de gente real da fila de detratores/estornos).

drop materialized view if exists v_clientes_agregado_nivel;

create materialized view v_clientes_agregado_nivel as
with recursive vendas_rankeadas as (
  select
    client_id,
    issue_date,
    row_number() over (partition by client_id order by issue_date, invoice, serie) as rn
  from totvs_orders
  where type = 'Venda'
    and client_id is not null
    and not (client_cpf_cnpj like '39537682%')
    and not (client_name ilike 'CONSUMIDOR FINAL')
    and regexp_replace(coalesce(client_cpf_cnpj, ''), '\D', '', 'g') not in ('29112864000187', '11672695430')
),
eventos as (
  select client_id, issue_date, rn, issue_date as ancora, 1 as evento_num
  from vendas_rankeadas
  where rn = 1
  union all
  select r.client_id, r.issue_date, r.rn,
    case when r.issue_date - e.ancora <= 7 then e.ancora else r.issue_date end as ancora,
    case when r.issue_date - e.ancora <= 7 then e.evento_num else e.evento_num + 1 end as evento_num
  from vendas_rankeadas r
  join eventos e on e.client_id = r.client_id and e.rn = r.rn - 1
),
compras_por_cliente as (
  select client_id, max(evento_num) as compras
  from eventos
  group by client_id
),
agregado as (
  select
    client_id,
    max(client_name) as nome,
    max(client_cpf_cnpj) as cpf_cnpj,
    sum(invoice_total) as gasto_acumulado,
    min(case when type = 'Venda' then issue_date end) as primeira_compra,
    max(case when type = 'Venda' then issue_date end) as ultima_compra,
    array_remove(array_agg(distinct branch), null) as branches
  from totvs_orders
  where client_id is not null
    and not (client_cpf_cnpj like '39537682%')
    and not (client_name ilike 'CONSUMIDOR FINAL')
    and regexp_replace(coalesce(client_cpf_cnpj, ''), '\D', '', 'g') not in ('29112864000187', '11672695430')
  group by client_id
)
select
  a.client_id,
  a.nome,
  a.cpf_cnpj,
  -- Cliente so com Devolucao (sem nenhuma Venda) nunca aparece em
  -- compras_por_cliente -- mesmo "compras = 0" que count(case when
  -- type='Venda'...) ja dava antes (calcularNivel trata <=0 como
  -- "sem_compra").
  coalesce(c.compras, 0) as compras,
  a.gasto_acumulado,
  a.primeira_compra,
  a.ultima_compra,
  a.branches
from agregado a
left join compras_por_cliente c on c.client_id = a.client_id
with data;

create unique index v_clientes_agregado_nivel_client_id_idx
  on v_clientes_agregado_nivel (client_id);

drop materialized view if exists v_recompra_categorias_por_cliente;

create materialized view v_recompra_categorias_por_cliente as
with recursive itens as (
  select
    o.client_id,
    case
      when oi.description ilike '%PROTETOR%' then 'protetor'
      when oi.description ilike '%TRAVESSEIRO%' or oi.description ilike '%TRAV %' then 'travesseiro'
      when oi.description ilike '%COLCHAO%' or oi.description ilike '%BOX %' then 'colchao'
      when oi.description ilike '%SOFA%' or oi.description ilike '%ESTOFAD%' or oi.description ilike '%POLTRONA%' then 'estofado'
      when oi.description ilike '%BERCO%' or oi.description ilike '%BELICHE%' or oi.description ilike '%CAMA %' then 'cama'
      when oi.description ilike '%ROUPEIRO%' or oi.description ilike '%GUARDA-ROUPA%' or oi.description ilike '%GUARDA ROUPA%' or oi.description ilike '%ARMARIO%' or oi.description ilike '%MULTI-USO%' then 'roupeiro'
      when oi.description ilike '%MESA%' or oi.description ilike '%RACK%' or oi.description ilike '%ESTANTE%' or oi.description ilike '%COMODA%' then 'mesa'
    end as categoria,
    oi.total,
    o.issue_date
  from totvs_order_items oi
  join totvs_orders o on o.id = oi.order_id
  where o.type = 'Venda' and o.client_id is not null
    and not (o.client_cpf_cnpj like '39537682%')
    and not (o.client_name ilike 'CONSUMIDOR FINAL')
    and regexp_replace(coalesce(o.client_cpf_cnpj, ''), '\D', '', 'g') not in ('29112864000187', '11672695430')
),
itens_cat as (
  select * from itens where categoria is not null
),
-- Datas distintas por (cliente, categoria) -- 2 itens da MESMA categoria
-- na MESMA nota nao podem virar 2 posicoes diferentes antes de agrupar
-- por evento (senao o rn duplica dentro do mesmo dia e o agrupamento por
-- ancora quebra).
datas_distintas as (
  select distinct client_id, categoria, issue_date from itens_cat
),
datas_rankeadas as (
  select client_id, categoria, issue_date,
    row_number() over (partition by client_id, categoria order by issue_date) as rn
  from datas_distintas
),
eventos as (
  select client_id, categoria, issue_date, rn, issue_date as ancora, 1 as evento_num
  from datas_rankeadas
  where rn = 1
  union all
  select r.client_id, r.categoria, r.issue_date, r.rn,
    case when r.issue_date - e.ancora <= 7 then e.ancora else r.issue_date end as ancora,
    case when r.issue_date - e.ancora <= 7 then e.evento_num else e.evento_num + 1 end as evento_num
  from datas_rankeadas r
  join eventos e on e.client_id = r.client_id and e.categoria = r.categoria and e.rn = r.rn - 1
),
compras_por_categoria as (
  select client_id, categoria, max(evento_num) as qtd_compras
  from eventos
  group by client_id, categoria
)
select
  i.client_id,
  i.categoria,
  sum(i.total) as valor_total,
  c.qtd_compras,
  max(i.issue_date) as ultima_data
from itens_cat i
join compras_por_categoria c on c.client_id = i.client_id and c.categoria = i.categoria
group by i.client_id, i.categoria, c.qtd_compras
with data;

create unique index v_recompra_categorias_por_cliente_idx
  on v_recompra_categorias_por_cliente (client_id, categoria);

-- Corpo inalterado (migration 0129/0161) -- so documentando que ja cobre
-- as duas views recriadas acima (mesmos nomes).
comment on materialized view v_clientes_agregado_nivel is
  'Refeita pela migration 0176: compras conta EVENTO de compra (janela de 7 dias a partir da ancora), nao nota -- ver comentario no topo da migration.';
comment on materialized view v_recompra_categorias_por_cliente is
  'Refeita pela migration 0176: qtd_compras conta EVENTO de compra por categoria (janela de 7 dias a partir da ancora), nao item de nota -- ver comentario no topo da migration.';
