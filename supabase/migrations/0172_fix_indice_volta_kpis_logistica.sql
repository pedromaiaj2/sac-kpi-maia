-- (15/10/2026) Alinha indiceVolta/indiceVoltaLogistica da API externa
-- (kpis_logistica) com a tela interna (kpis_entregas, migração 0169).
--
-- Achado na revisão geral de KPIs de 15/10/2026: a 0159 (08/10/2026) decidiu
-- explicitamente manter o Índice de Volta da API "como estava" (insucessos +
-- parciais + devoluções + assistências) quando o Índice de Assistência
-- consolidado foi criado -- decisão válida na época. Só que em 13/10/2026 o
-- Victor pediu pra tela interna (kpis_entregas) ficar restrita a só
-- insucessos + parciais ("quero só entregas"), e essa mudança nunca foi
-- replicada aqui -- as duas RPCs passaram a devolver, no mesmo nome de
-- campo (indiceVolta), dois números diferentes pro mesmo motorista/período.
-- Confirmado com o Victor (15/10/2026): alinhar a API com a tela. Isso muda
-- o valor que consumidores externos (AIAM/Gabriel) recebem nesse campo --
-- vale avisar quem consome lojas-maia-integracao/apis/logistica-v1.
--
-- Única mudança: as duas linhas de indiceVolta/indiceVoltaLogistica dentro
-- de kpis_logistica. Resto da função é cópia exata da última versão (0159).

create or replace function kpis_logistica(p_de date, p_ate date, p_tipo text default null,
                                          p_tipo_veiculo text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
-- materialized: o planejador estima 1 carga no período (são ~300) e faria
-- nested loop recalculando motoristas e portes por carga (5 s em vez de ms).
with base as materialized (
  select c.* from v_cargas_logistica c
  where c.despachada and c.dia between p_de and p_ate
    and (p_tipo is null or c.tipo = p_tipo)
    and (p_tipo_veiculo is null or c.tipo_veiculo = p_tipo_veiculo)
),
-- cargas do tipo de veículo pedido, de qualquer data: visitas e voltas são
-- filtradas pela data delas, não pela da carga.
veic as materialized (
  select carga from v_cargas_logistica where p_tipo_veiculo is not null and tipo_veiculo = p_tipo_veiculo
),
nomes as materialized (select codigo, nome from v_motoristas_protheus),
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
visitas as (
  select motorista_codigo, count(*) as visitas,
         count(*) filter (where status_entrega_codigo = '1') as entregues,
         count(*) filter (where status_entrega_codigo in ('1', '2')) as entregas_realizadas
  from v_visitas_motorista
  where dia between p_de and p_ate
    and (p_tipo_veiculo is null or carga in (select carga from veic))
  group by 1
),
voltas as (
  select motorista_codigo,
         count(*) filter (where tipo = 'insucesso') as insucessos,
         count(*) filter (where tipo = 'insucesso' and categoria = 'C') as insucessos_cliente,
         count(*) filter (where tipo = 'insucesso' and categoria = 'L' and detalhe <> 'L06') as insucessos_logistica,
         count(*) filter (where tipo = 'insucesso' and detalhe = 'L06') as insucessos_cd,
         count(*) filter (where tipo = 'insucesso' and coalesce(categoria, '') not in ('C', 'L')) as insucessos_outros,
         count(*) filter (where tipo = 'parcial') as parciais,
         count(*) filter (where tipo = 'devolucao') as devolucoes,
         count(*) filter (where tipo = 'assistencia') as assistencias,
         count(*) filter (where tipo = 'assistencia' and atribuicao = 'causa_carga') as assistencias_por_carga,
         count(*) filter (where tipo = 'assistencia' and categoria in ('erro_motorista', 'avaria_transporte')) as assistencias_transporte
  from v_volta_eventos
  where dia between p_de and p_ate
    and (p_tipo_veiculo is null or carga in (select carga from veic))
  group by 1
),
pecas_periodo as materialized (
  select * from v_pecas_entrega where dia between p_de and p_ate
),
pecas as (
  select motorista_codigo, count(*) as pecas,
         count(*) filter (where atribuicao = 'nf') as pecas_por_nf
  from pecas_periodo
  where motorista_codigo is not null
    and (p_tipo_veiculo is null or carga in (select carga from veic))
  group by 1
),
pos_venda_periodo as materialized (
  select * from v_assistencias_entrega where dia between p_de and p_ate
),
pos_venda as (
  select motorista_codigo, count(*) as pv_total,
         count(*) filter (where frente = 'peca') as pv_peca,
         count(*) filter (where frente = 'troca_produto') as pv_troca,
         count(*) filter (where frente = 'recolhimento') as pv_recolhimento,
         count(*) filter (where frente = 'entrega_produto') as pv_entrega,
         count(*) filter (where atribuicao = 'carga') as pv_por_carga,
         count(*) filter (where atribuicao = 'nf') as pv_por_nf
  from pos_venda_periodo
  where motorista_codigo is not null
    and (p_tipo_veiculo is null or carga in (select carga from veic))
  group by 1
),
motoristas as (
  select m.codigo, m.nome, coalesce(v.visitas, 0) as visitas, coalesce(v.entregues, 0) as entregues,
         coalesce(v.entregas_realizadas, 0) as entregas_realizadas,
         coalesce(x.insucessos, 0) as insucessos, coalesce(x.insucessos_cliente, 0) as insucessos_cliente,
         coalesce(x.insucessos_logistica, 0) as insucessos_logistica, coalesce(x.insucessos_cd, 0) as insucessos_cd,
         coalesce(x.insucessos_outros, 0) as insucessos_outros,
         coalesce(x.parciais, 0) as parciais, coalesce(x.devolucoes, 0) as devolucoes,
         coalesce(x.assistencias, 0) as assistencias, coalesce(x.assistencias_por_carga, 0) as assistencias_por_carga,
         coalesce(x.assistencias_transporte, 0) as assistencias_transporte,
         coalesce(pc.pecas, 0) as pecas, coalesce(pc.pecas_por_nf, 0) as pecas_por_nf,
         coalesce(pv.pv_total, 0) as pv_total, coalesce(pv.pv_peca, 0) as pv_peca,
         coalesce(pv.pv_troca, 0) as pv_troca, coalesce(pv.pv_recolhimento, 0) as pv_recolhimento,
         coalesce(pv.pv_entrega, 0) as pv_entrega, coalesce(pv.pv_por_carga, 0) as pv_por_carga,
         coalesce(pv.pv_por_nf, 0) as pv_por_nf,
         (select count(*) from cargas c where c.motorista_codigo = m.codigo) as cargas
  from v_motoristas_protheus m
  left join visitas v on v.motorista_codigo = m.codigo
  left join voltas x on x.motorista_codigo = m.codigo
  left join pecas pc on pc.motorista_codigo = m.codigo
  left join pos_venda pv on pv.motorista_codigo = m.codigo
  where v.visitas > 0 or x.motorista_codigo is not null or pc.motorista_codigo is not null
     or pv.motorista_codigo is not null
)
select jsonb_build_object(
  'periodo', jsonb_build_object('de', p_de, 'ate', p_ate, 'tipo', p_tipo, 'tipoVeiculo', p_tipo_veiculo),
  'cargasPorDia', coalesce((
    select jsonb_agg(jsonb_build_object('dia', dia, 'cargas', n, 'pedidos', pedidos) order by dia)
    from (select dia, count(*) as n, sum(pedidos) as pedidos from cargas group by dia) d), '[]'::jsonb),
  'cargas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'carga', carga, 'dia', dia, 'tipo', tipo, 'veiculo', veiculo,
      'tipoVeiculo', tipo_veiculo, 'tipoVeiculoOrigem', tipo_veiculo_origem,
      'motorista', case when motorista_codigo is null then null
                        else jsonb_build_object('codigo', motorista_codigo, 'nome', motorista_nome) end,
      'pedidos', pedidos, 'entregues', entregues, 'parciais', parciais,
      'naoEntregues', nao_entregues, 'canceladas', canceladas,
      'volumes', jsonb_build_object('P', qtd_p, 'M', qtd_m, 'G', qtd_g, 'naoClassificado', qtd_n))
      order by dia desc, carga)
    from cargas), '[]'::jsonb),
  'motoristas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'codigo', codigo, 'nome', nome, 'cargas', cargas, 'visitas', visitas, 'entregues', entregues,
      'entregasRealizadas', entregas_realizadas,
      'insucessos', jsonb_build_object('total', insucessos, 'cliente', insucessos_cliente,
                                       'logistica', insucessos_logistica, 'cd', insucessos_cd,
                                       'outros', insucessos_outros),
      'parciais', parciais, 'devolucoes', devolucoes,
      'assistencias', jsonb_build_object('total', assistencias, 'porCarga', assistencias_por_carga,
                                         'porCpf', assistencias - assistencias_por_carga,
                                         'transporte', assistencias_transporte),
      'pecas', jsonb_build_object('total', pecas, 'porNf', pecas_por_nf, 'porCliente', pecas - pecas_por_nf),
      -- Alinhado com kpis_entregas (0169) em 15/10/2026 -- antes somava
      -- devolucoes + assistencias aqui, divergindo da tela interna.
      'indiceVolta', case when visitas = 0 then null
        else round((insucessos + parciais)::numeric / visitas, 4) end,
      'indiceVoltaLogistica', case when visitas = 0 then null
        else round(insucessos_logistica::numeric / visitas, 4) end,
      'indicePecas', case when entregas_realizadas = 0 then null
        else round(pecas::numeric / entregas_realizadas, 4) end,
      'posVenda', jsonb_build_object('total', pv_total, 'pecas', pv_peca, 'trocaProduto', pv_troca,
                                     'recolhimento', pv_recolhimento, 'entregaProduto', pv_entrega,
                                     'porCarga', pv_por_carga, 'porNf', pv_por_nf,
                                     'porCliente', pv_total - pv_por_carga - pv_por_nf),
      'indiceAssistencia', case when entregas_realizadas = 0 then null
        else round(pv_total::numeric / entregas_realizadas, 4) end)
      order by visitas desc)
    from motoristas), '[]'::jsonb),
  -- pedidos de peça do período (sem filtro de veículo): quantos acharam a entrega
  'pecasPeriodo', (
    select jsonb_build_object('total', count(*),
                              'vinculadas', count(*) filter (where motorista_codigo is not null))
    from pecas_periodo),
  -- ocorrências de pós-venda do período (sem filtro de veículo), por frente
  'posVendaPeriodo', (
    select jsonb_build_object('total', count(*),
                              'vinculadas', count(*) filter (where motorista_codigo is not null),
                              'pecas', count(*) filter (where frente = 'peca'),
                              'trocaProduto', count(*) filter (where frente = 'troca_produto'),
                              'recolhimento', count(*) filter (where frente = 'recolhimento'),
                              'entregaProduto', count(*) filter (where frente = 'entrega_produto'))
    from pos_venda_periodo)
);
$$;

revoke execute on function kpis_logistica(date, date, text, text) from public, anon, authenticated;
grant execute on function kpis_logistica(date, date, text, text) to service_role;
