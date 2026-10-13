-- (13/10/2026) Aba Logística só com entregas: próprio × terceirizado e Strada × caminhão.
-- Original em lojas-maia-integracao/apis/logistica-v1/sql/0162_entregas_vinculo.sql.

-- (13/10/2026) Aba Logística só com entregas: motorista próprio × terceirizado
-- e entregas por Strada × caminhão. Aplicada no Supabase self-hosted em
-- 13/10/2026. Vai para o sac-kpi-maia como
-- supabase/migrations/0162_entregas_vinculo.sql.
--
-- Pedido do Victor (13/10/2026): tirar da aba tudo o que é assistência
-- técnica, sem cruzar com os dados da assistência. A tela passa a ler a RPC
-- kpis_entregas, que não toca em service_requests nem em part_orders:
--   Índice de Volta  = (insucessos + parciais + devoluções) ÷ visitas
--   Volta Logística  = insucessos de logística (exceto L06) ÷ visitas
-- Motivos da volta: os insucessos abertos pelo código de ocorrência
-- (motivosInsucesso). A kpis_logistica (API /api/logistica/v1, contrato
-- publicado) não muda.
--
-- Vínculo (próprio x terceirizado), conferido pelo Victor em 13/10/2026:
--   - vale POR CARGA, pela transportadora da carga no Protheus (ZAG).
--     TRANSP. LOJAS MAIA / TRANSP. AIAM (nome antigo) / EXPRESSA /
--     EXPRESSA FRETE são as nossas; Ronaldo Transportes, THZ, D&A,
--     Alenilson, Santos e as antigas são terceirizadas. Transportadora nova
--     que não estiver na tabela conta como terceirizada. Carga de
--     terceirizado lançada como TRANSP. LOJAS MAIA foi com caminhão nosso e
--     conta como própria;
--   - carga sem transportadora fica com o vínculo do motorista;
--   - o motorista (coluna da tabela) fica com o vínculo da maioria das
--     cargas dele nos últimos 180 dias (ou de todo o histórico).

create table if not exists transportadoras_logistica (
  transportadora text primary key,
  vinculo text not null check (vinculo in ('Próprio', 'Terceirizado')),
  observacao text,
  atualizado_em timestamptz not null default now()
);

alter table transportadoras_logistica enable row level security;
revoke all on transportadoras_logistica from anon, authenticated;
grant select, insert, update, delete on transportadoras_logistica to service_role;

insert into transportadoras_logistica (transportadora, vinculo, observacao) values
  ('TRANSP. LOJAS MAIA', 'Próprio', 'frota própria'),
  ('TRANSP. AIAM', 'Próprio', 'nome antigo da frota própria (até 12/2025)'),
  ('EXPRESSA', 'Próprio', 'cargas Express da frota própria'),
  ('EXPRESSA FRETE', 'Próprio', 'cargas Express da frota própria (2025)'),
  ('RONALDO TRANSPORTES', 'Terceirizado', null),
  ('THZ', 'Terceirizado', null),
  ('TRANSP. D&A', 'Terceirizado', null),
  ('TRANSP. D-A', 'Terceirizado', null),
  ('TRANSP. ALENILSON', 'Terceirizado', null),
  ('TRANSP. SANTOS', 'Terceirizado', null),
  ('TRANSP. SUCESSO', 'Terceirizado', null),
  ('TRANSP. TERCEIROS', 'Terceirizado', null),
  ('TRANSP. BISOL', 'Terceirizado', null),
  ('JHL', 'Terceirizado', null),
  ('JUNIOR EXPRESS (ANTONIO A', 'Terceirizado', null)
on conflict (transportadora) do nothing;

create or replace view v_motoristas_vinculo with (security_invoker = true) as
with por_transp as (
  select c.motorista_codigo, trim(c.transportadora) as transportadora,
         coalesce(t.vinculo, 'Terceirizado') as vinculo,
         count(distinct c.carga) filter (where c.dt_previsao >= current_date - 180) as recentes,
         count(distinct c.carga) as total
  from v_cargas_producao c
  left join transportadoras_logistica t on t.transportadora = trim(c.transportadora)
  where coalesce(c.motorista_codigo, '') <> '' and coalesce(trim(c.transportadora), '') <> ''
  group by 1, 2, 3
),
por_vinculo as (
  select motorista_codigo, vinculo, sum(recentes) as recentes, sum(total) as total
  from por_transp group by 1, 2
),
vinculo as (
  select distinct on (motorista_codigo) motorista_codigo, vinculo
  from por_vinculo
  order by motorista_codigo, recentes desc, total desc
)
select v.motorista_codigo as codigo, v.vinculo,
       (select p.transportadora from por_transp p
         where p.motorista_codigo = v.motorista_codigo and p.vinculo = v.vinculo
         order by p.recentes desc, p.total desc limit 1) as transportadora
from vinculo v;

revoke all on v_motoristas_vinculo from anon, authenticated;
grant select on v_motoristas_vinculo to service_role;

create or replace view v_cargas_vinculo with (security_invoker = true) as
select c.carga, c.transportadora,
       coalesce(t.vinculo, case when c.transportadora is not null then 'Terceirizado' end, mv.vinculo) as vinculo
from (
  select carga, max(nullif(trim(transportadora), '')) as transportadora,
         max(nullif(motorista_codigo, '')) as motorista_codigo
  from v_cargas_producao group by carga
) c
left join transportadoras_logistica t on t.transportadora = c.transportadora
left join v_motoristas_vinculo mv on mv.codigo = c.motorista_codigo;

revoke all on v_cargas_vinculo from anon, authenticated;
grant select on v_cargas_vinculo to service_role;

------------------------------------------------------------------------------
-- RPC da tela: só entregas (sem assistência).
------------------------------------------------------------------------------
create or replace function kpis_entregas(p_de date, p_ate date, p_tipo text default null,
                                         p_tipo_veiculo text default null, p_vinculo text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with vinc as materialized (select * from v_motoristas_vinculo),
nomes as materialized (select codigo, nome from v_motoristas_protheus),
-- tipo de veículo e vínculo de toda carga: visitas e voltas são filtradas
-- pela data delas, não pela da carga.
veic as materialized (
  select l.carga, l.tipo_veiculo, cv.vinculo, cv.transportadora
  from v_cargas_logistica l left join v_cargas_vinculo cv on cv.carga = l.carga
),
base as materialized (
  select c.*, ve.vinculo, ve.transportadora from v_cargas_logistica c
  join veic ve on ve.carga = c.carga
  where c.despachada and c.dia between p_de and p_ate
    and (p_tipo is null or c.tipo = p_tipo)
    and (p_tipo_veiculo is null or c.tipo_veiculo = p_tipo_veiculo)
    and (p_vinculo is null or ve.vinculo = p_vinculo)
),
portes as materialized (
  select p.* from v_carga_portes p where p.carga in (select carga from base)
),
cargas as (
  select c.*, m.nome as motorista_nome,
         coalesce(p.qtd_p, 0) as qtd_p, coalesce(p.qtd_m, 0) as qtd_m,
         coalesce(p.qtd_g, 0) as qtd_g, coalesce(p.qtd_nao_classificado, 0) as qtd_n
  from base c
  left join nomes m on m.codigo = c.motorista_codigo
  left join portes p on p.carga = c.carga
),
visitas_periodo as materialized (
  select v.motorista_codigo, v.status_entrega_codigo, ve.tipo_veiculo, ve.vinculo
  from v_visitas_motorista v
  left join veic ve on ve.carga = v.carga
  where v.dia between p_de and p_ate
    and (p_tipo_veiculo is null or ve.tipo_veiculo = p_tipo_veiculo)
    and (p_vinculo is null or ve.vinculo = p_vinculo)
),
visitas as (
  select motorista_codigo, count(*) as visitas,
         count(*) filter (where status_entrega_codigo = '1') as entregues,
         count(*) filter (where status_entrega_codigo in ('1', '2')) as entregas_realizadas,
         count(*) filter (where status_entrega_codigo in ('1', '2') and tipo_veiculo = 'Carro') as entregas_carro,
         count(*) filter (where status_entrega_codigo in ('1', '2') and tipo_veiculo is distinct from 'Carro') as entregas_caminhao
  from visitas_periodo
  group by 1
),
eventos as materialized (
  select e.* from v_volta_eventos e
  left join veic ve on ve.carga = e.carga
  where e.tipo in ('insucesso', 'parcial', 'devolucao')
    and e.dia between p_de and p_ate
    and (p_tipo_veiculo is null or ve.tipo_veiculo = p_tipo_veiculo)
    and (p_vinculo is null or ve.vinculo = p_vinculo)
),
voltas as (
  select e.motorista_codigo,
         count(*) filter (where e.tipo = 'insucesso') as insucessos,
         count(*) filter (where e.tipo = 'insucesso' and e.categoria = 'C') as insucessos_cliente,
         count(*) filter (where e.tipo = 'insucesso' and e.categoria = 'L' and e.detalhe <> 'L06') as insucessos_logistica,
         count(*) filter (where e.tipo = 'insucesso' and e.detalhe = 'L06') as insucessos_cd,
         count(*) filter (where e.tipo = 'insucesso' and coalesce(e.categoria, '') not in ('C', 'L')) as insucessos_outros,
         count(*) filter (where e.tipo = 'parcial') as parciais,
         count(*) filter (where e.tipo = 'devolucao') as devolucoes
  from eventos e
  group by 1
),
-- motivo de cada insucesso (código de ocorrência do Protheus); a descrição
-- é a mais comum do código (há linhas com acentuação quebrada).
motivos as (
  select nullif(e.detalhe, '') as codigo, count(*) as total
  from eventos e where e.tipo = 'insucesso' group by 1
),
descricoes as (
  select ocorrencia_codigo as codigo,
         mode() within group (order by ocorrencia_descricao) as descricao,
         mode() within group (order by ocorrencia_categoria) as categoria
  from totvs_delivery_cargas
  where ocorrencia_codigo in (select codigo from motivos)
  group by 1
),
motoristas as (
  select m.codigo, m.nome, vi.vinculo, vi.transportadora,
         coalesce(v.visitas, 0) as visitas, coalesce(v.entregues, 0) as entregues,
         coalesce(v.entregas_realizadas, 0) as entregas_realizadas,
         coalesce(v.entregas_carro, 0) as entregas_carro, coalesce(v.entregas_caminhao, 0) as entregas_caminhao,
         coalesce(x.insucessos, 0) as insucessos, coalesce(x.insucessos_cliente, 0) as insucessos_cliente,
         coalesce(x.insucessos_logistica, 0) as insucessos_logistica, coalesce(x.insucessos_cd, 0) as insucessos_cd,
         coalesce(x.insucessos_outros, 0) as insucessos_outros,
         coalesce(x.parciais, 0) as parciais, coalesce(x.devolucoes, 0) as devolucoes,
         (select count(*) from cargas c where c.motorista_codigo = m.codigo) as cargas
  from v_motoristas_protheus m
  left join vinc vi on vi.codigo = m.codigo
  left join visitas v on v.motorista_codigo = m.codigo
  left join voltas x on x.motorista_codigo = m.codigo
  where v.visitas > 0 or x.motorista_codigo is not null
),
-- matriz vínculo × veículo: cargas e pedidos pela data da carga, entregas
-- pela data da visita (mesma regra do resto da tela).
grade as (
  select coalesce(vinculo, 'Sem vínculo') as vinculo, tipo_veiculo,
         count(*) as cargas, sum(pedidos) as pedidos, 0::bigint as entregas
  from cargas group by 1, 2
  union all
  select coalesce(v.vinculo, 'Sem vínculo'), coalesce(v.tipo_veiculo, 'Caminhão'), 0, 0, count(*)
  from visitas_periodo v
  where v.status_entrega_codigo in ('1', '2')
  group by 1, 2
)
select jsonb_build_object(
  'periodo', jsonb_build_object('de', p_de, 'ate', p_ate, 'tipo', p_tipo,
                                'tipoVeiculo', p_tipo_veiculo, 'vinculo', p_vinculo),
  'cargasPorDia', coalesce((
    select jsonb_agg(jsonb_build_object('dia', dia, 'cargas', n, 'pedidos', pedidos) order by dia)
    from (select dia, count(*) as n, sum(pedidos) as pedidos from cargas group by dia) d), '[]'::jsonb),
  'cargas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'carga', carga, 'dia', dia, 'tipo', tipo, 'veiculo', veiculo,
      'tipoVeiculo', tipo_veiculo, 'tipoVeiculoOrigem', tipo_veiculo_origem,
      'vinculo', vinculo, 'transportadora', transportadora,
      'motorista', case when motorista_codigo is null then null
                        else jsonb_build_object('codigo', motorista_codigo, 'nome', motorista_nome) end,
      'pedidos', pedidos, 'entregues', entregues, 'parciais', parciais,
      'naoEntregues', nao_entregues, 'canceladas', canceladas,
      'volumes', jsonb_build_object('P', qtd_p, 'M', qtd_m, 'G', qtd_g, 'naoClassificado', qtd_n))
      order by dia desc, carga)
    from cargas), '[]'::jsonb),
  'motoristas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'codigo', codigo, 'nome', nome, 'vinculo', vinculo, 'transportadora', transportadora,
      'cargas', cargas, 'visitas', visitas, 'entregues', entregues,
      'entregasRealizadas', entregas_realizadas,
      'entregasPorVeiculo', jsonb_build_object('Carro', entregas_carro, 'Caminhão', entregas_caminhao),
      'insucessos', jsonb_build_object('total', insucessos, 'cliente', insucessos_cliente,
                                       'logistica', insucessos_logistica, 'cd', insucessos_cd,
                                       'outros', insucessos_outros),
      'parciais', parciais, 'devolucoes', devolucoes,
      'indiceVolta', case when visitas = 0 then null
        else round((insucessos + parciais + devolucoes)::numeric / visitas, 4) end,
      'indiceVoltaLogistica', case when visitas = 0 then null
        else round(insucessos_logistica::numeric / visitas, 4) end)
      order by visitas desc)
    from motoristas), '[]'::jsonb),
  'entregasPorVeiculo', coalesce((
    select jsonb_agg(jsonb_build_object('vinculo', vinculo, 'tipoVeiculo', tipo_veiculo,
                                        'cargas', cargas, 'pedidos', pedidos, 'entregas', entregas)
                     order by vinculo, tipo_veiculo)
    from (select vinculo, tipo_veiculo, sum(cargas) as cargas, sum(pedidos) as pedidos, sum(entregas) as entregas
          from grade group by 1, 2) g), '[]'::jsonb),
  'motivosInsucesso', coalesce((
    select jsonb_agg(jsonb_build_object('codigo', m.codigo,
                                        'descricao', coalesce(d.descricao, 'Sem motivo informado'),
                                        'categoria', d.categoria, 'total', m.total)
                     order by m.total desc, m.codigo)
    from motivos m left join descricoes d on d.codigo = m.codigo), '[]'::jsonb)
);
$$;

revoke all on function kpis_entregas(date, date, text, text, text) from public, anon, authenticated;
grant execute on function kpis_entregas(date, date, text, text, text) to service_role;
