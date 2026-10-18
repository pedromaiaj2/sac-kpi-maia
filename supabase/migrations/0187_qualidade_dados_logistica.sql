-- (18/10/2026) Revisão da tela /kpis/logistica (pedido do Victor): bloco
-- "Qualidade dos dados" com os lançamentos do Protheus que distorcem a tela,
-- pra corrigir na origem (Pedro). Três casos, todos já vistos em produção:
-- - previsão incoerente: baixa mais de 3 dias ANTES da previsão ou mais de 7
--   dias DEPOIS (ex.: 005249 com previsão 03/11/2026 e baixas em 03 e
--   05/10 -- a carga some do mês certo);
-- - transportadora da carga com vínculo diferente do motorista (ex.: Bruno
--   THZ e Ronaldo com carga lançada como TRANSP. LOJAS MAIA);
-- - carga própria sem placa de motorista sem veículo cadastrado (cai em
--   "Não identificado" na grade de veículos).
-- Só leitura; cargas com previsão ou baixa no período.

create or replace function qualidade_dados_logistica(p_de date, p_ate date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with rel as materialized (
  select array_agg(distinct carga) as cargas from totvs_delivery_cargas
  where dt_previsao between p_de and p_ate or dt_retorno between p_de and p_ate
),
info as materialized (
  select c.carga,
         max(c.dt_previsao) as previsao,
         min(c.dt_retorno) filter (where c.status_origem = 'ENTREGA') as primeira_baixa,
         max(c.dt_retorno) filter (where c.status_origem = 'ENTREGA') as ultima_baixa,
         max(nullif(c.motorista_codigo, '')) as motorista_codigo,
         max(nullif(trim(c.transportadora), '')) as transportadora,
         max(nullif(c.veiculo, '')) as veiculo
  from totvs_delivery_cargas c
  where c.carga = any((select cargas from rel)::text[])
  group by 1
),
nomes as materialized (select codigo, nome from v_motoristas_protheus),
mv as materialized (select codigo, vinculo, transportadora from v_motoristas_vinculo)
select jsonb_build_object(
  'previsaoIncoerente', coalesce((
    select jsonb_agg(jsonb_build_object('carga', i.carga, 'previsao', i.previsao, 'primeiraBaixa', i.primeira_baixa,
                                        'ultimaBaixa', i.ultima_baixa, 'motorista', n.nome)
                     order by i.previsao desc, i.carga)
    from info i left join nomes n on n.codigo = i.motorista_codigo
    where i.ultima_baixa is not null
      and (i.previsao - i.ultima_baixa > 3 or i.primeira_baixa - i.previsao > 7)), '[]'::jsonb),
  'transportadoraDivergente', coalesce((
    select jsonb_agg(jsonb_build_object('carga', i.carga, 'previsao', i.previsao, 'motorista', n.nome,
                                        'transportadora', i.transportadora, 'vinculoTransportadora', t.vinculo,
                                        'vinculoMotorista', m.vinculo, 'transportadoraMotorista', m.transportadora)
                     order by i.previsao desc, i.carga)
    from info i
    join transportadoras_logistica t on t.transportadora = i.transportadora
    join mv m on m.codigo = i.motorista_codigo
    left join nomes n on n.codigo = i.motorista_codigo
    where i.previsao between p_de and p_ate and t.vinculo <> m.vinculo), '[]'::jsonb),
  'semPlaca', coalesce((
    select jsonb_agg(jsonb_build_object('carga', l.carga, 'previsao', l.dia, 'motorista', n.nome, 'veiculo', l.veiculo)
                     order by l.dia desc, l.carga)
    from v_cargas_logistica l
    left join nomes n on n.codigo = l.motorista_codigo
    where l.carga = any((select cargas from rel)::text[])
      and l.despachada and l.dia between p_de and p_ate
      and l.tipo_veiculo = 'Não identificado'), '[]'::jsonb)
);
$$;

revoke all on function qualidade_dados_logistica(date, date) from public, anon, authenticated;
grant execute on function qualidade_dados_logistica(date, date) to service_role;
