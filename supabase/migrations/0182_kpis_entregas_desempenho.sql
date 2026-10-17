-- (17/10/2026) A tela /kpis/logistica?periodo=hoje caiu com "canceling
-- statement due to statement timeout": kpis_entregas levava ~2,4 s mesmo
-- pra 1 dia (média 3,2 s, máximo 7,9 s em produção) e, com a página
-- chamando a função 2x em paralelo (período atual e anterior) mais o sync
-- rodando, passava dos 8 s do PostgREST. EXPLAIN ANALYZE do corpo (1 dia):
-- ~1,5 s em "portes" (v_carga_portes agrega os itens de TODAS as cargas e
-- só depois filtra) e ~0,7 s em v_cargas_logistica montada 2x (veic e base).
--
-- Mudança (última versão: 0179), sem mudar nenhum resultado (conferido
-- byte a byte contra a 0179 em vários períodos/filtros):
-- - índice novo em totvs_delivery_cargas (carga);
-- - veic só com as cargas com previsão ou baixa no período (CTE rel);
-- - base sai de veic (veic agora carrega as colunas de v_cargas_logistica);
-- - portes soma direto dos itens das cargas do período (itens_base);
-- - motoristas usa a CTE nomes em vez de reabrir v_motoristas_protheus.

-- Índice por carga: sem ele, "carga = any(...)" lia a tabela inteira (o
-- sync, as views de carga e rotas_do_dia também filtram por carga). Com
-- ele, em produção: hoje 1,8 s -> 0,7 s; 30 dias 3,4 s -> 1,8 s;
-- 90 dias 6,0 s -> 4,7 s.
create index if not exists totvs_delivery_cargas_carga_idx on totvs_delivery_cargas (carga);

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
-- (0182) só as cargas que a função usa: previsão ou baixa no período (as
-- visitas, voltas e assistências do período são todas de carga com baixa
-- nele). "= any(array)" deixa o Postgres filtrar dentro das views por carga
-- em vez de montar as ~4 mil cargas do histórico.
rel as materialized (
  select array_agg(distinct carga) as cargas from totvs_delivery_cargas
  where dt_previsao between p_de and p_ate or dt_retorno between p_de and p_ate
),
veic as materialized (
  select l.*, l.tipo as tipo_carga, cv.vinculo, cv.transportadora
  from v_cargas_logistica l
  left join (select * from v_cargas_vinculo where carga = any((select cargas from rel)::text[])) cv on cv.carga = l.carga
  where l.carga = any((select cargas from rel)::text[])
),
-- (0182) sai de veic em vez de montar v_cargas_logistica de novo
base as materialized (
  select c.* from veic c
  where c.despachada and c.dia between p_de and p_ate
    and (p_tipo is null or c.tipo = p_tipo)
    and (p_tipo_veiculo is null or c.tipo_veiculo = p_tipo_veiculo)
    and (p_vinculo is null or c.vinculo = p_vinculo)
),
-- produtos das cargas do período por classe de porte (lista que abre ao
-- clicar em P/M/G na legenda): v_produto_porte só dos produtos dessas cargas
itens_base as materialized (
  select i.produto, i.descricao, i.quantidade, dc.carga
  from totvs_delivery_carga_itens i
  join v_cargas_producao dc on dc.id = i.delivery_carga_id
  where dc.carga in (select carga from base)
),
porte_produtos as materialized (
  select pp.produto, pp.porte, pp.origem
  from v_produto_porte pp where pp.produto in (select produto from itens_base)
),
-- (0182) mesma conta de v_carga_portes, só sobre os itens das cargas do
-- período (a view somava as ~4 mil cargas do histórico antes de filtrar)
portes as materialized (
  select i.carga,
         sum(i.quantidade) filter (where p.porte = 'P') as qtd_p,
         sum(i.quantidade) filter (where p.porte = 'M') as qtd_m,
         sum(i.quantidade) filter (where p.porte = 'G') as qtd_g,
         sum(i.quantidade) filter (where p.porte = 'N') as qtd_nao_classificado
  from itens_base i join porte_produtos p on p.produto = i.produto
  group by i.carga
),
-- não entregues de cada carga por código de ocorrência (alerta do monitor)
carga_insucessos as (
  select carga, jsonb_object_agg(codigo, n) as por_motivo
  from (
    select c.carga, coalesce(nullif(c.ocorrencia_codigo, ''), '—') as codigo, count(*) as n
    from v_cargas_producao c
    where c.carga in (select carga from base)
      and c.status_origem = 'ENTREGA' and c.status_entrega_codigo = '3'
    group by 1, 2
  ) x
  group by 1
),
cargas as (
  select c.*, m.nome as motorista_nome, ci.por_motivo,
         coalesce(p.qtd_p, 0) as qtd_p, coalesce(p.qtd_m, 0) as qtd_m,
         coalesce(p.qtd_g, 0) as qtd_g, coalesce(p.qtd_nao_classificado, 0) as qtd_n
  from base c
  left join nomes m on m.codigo = c.motorista_codigo
  left join portes p on p.carga = c.carga
  left join carga_insucessos ci on ci.carga = c.carga
),
visitas_periodo as materialized (
  select v.motorista_codigo, v.status_entrega_codigo, ve.tipo_veiculo, ve.vinculo
  from v_visitas_motorista v
  left join veic ve on ve.carga = v.carga
  where v.dia between p_de and p_ate
    and (p_tipo is null or ve.tipo_carga = p_tipo)
    and (p_tipo_veiculo is null or ve.tipo_veiculo = p_tipo_veiculo)
    and (p_vinculo is null or ve.vinculo = p_vinculo)
),
visitas as (
  select motorista_codigo, count(*) as visitas,
         count(*) filter (where status_entrega_codigo = '1') as entregues,
         count(*) filter (where status_entrega_codigo in ('1', '2')) as entregas_realizadas,
         count(*) filter (where status_entrega_codigo in ('1', '2') and tipo_veiculo = 'Carro') as entregas_carro,
         count(*) filter (where status_entrega_codigo in ('1', '2') and tipo_veiculo = 'Caminhão') as entregas_caminhao,
         count(*) filter (where status_entrega_codigo in ('1', '2') and tipo_veiculo is distinct from 'Carro'
                                and tipo_veiculo is distinct from 'Caminhão') as entregas_nao_identificado
  from visitas_periodo
  group by 1
),
eventos as materialized (
  select e.* from v_volta_eventos e
  left join veic ve on ve.carga = e.carga
  where e.tipo in ('insucesso', 'parcial')
    and e.dia between p_de and p_ate
    and (p_tipo is null or ve.tipo_carga = p_tipo)
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
         count(*) filter (where e.tipo = 'parcial') as parciais
  from eventos e
  group by 1
),
-- motivo de cada insucesso (código de ocorrência do Protheus); a descrição
-- é a mais comum do código (há linhas com acentuação quebrada).
-- chamados de assistência criados no período, ligados à entrega original
-- (v_assistencias_produto_entrega); veículo e vínculo são os da carga
-- dessa entrega.
-- Pela data da ENTREGA ligada ao chamado, não pela abertura (0179): o
-- chamado aberto hoje sobre uma entrega de setembro conta em setembro. O
-- chamado é sempre aberto depois da entrega, daí o a.dia >= p_de (só pra
-- não montar a ligação de todo o histórico).
assist_periodo as materialized (
  select a.*, ve.tipo_carga, ve.tipo_veiculo, ve.vinculo
  from v_assistencias_produto_entrega a
  left join veic ve on ve.carga = a.carga
  where a.dia >= p_de and a.dia_entrega between p_de and p_ate
),
-- chamados ABERTOS no período e quantos acharam uma entrega (o "sem nota
-- ligada" do card do topo)
assist_abertos as materialized (
  select a.motorista_codigo from v_assistencias_produto_entrega a
  where a.dia between p_de and p_ate
),
assist_filtrado as materialized (
  select * from assist_periodo
  where motorista_codigo is not null
    and (p_tipo is null or tipo_carga = p_tipo)
    and (p_tipo_veiculo is null or tipo_veiculo = p_tipo_veiculo)
    and (p_vinculo is null or vinculo = p_vinculo)
),
assist as (
  select motorista_codigo, count(*) as total,
         count(*) filter (where atribuicao = 'carga') as por_carga,
         count(*) filter (where atribuicao = 'produto') as por_produto,
         count(*) filter (where atribuicao = 'cliente') as por_cliente,
         -- Detalhamento por causa (15/10/2026) -- mesmos valores de causa_raiz
         -- usados em assistencias_transporte na kpis_logistica (migração 0157).
         count(*) filter (where causa_raiz = 'erro_motorista') as por_erro_motorista,
         count(*) filter (where causa_raiz = 'avaria_transporte') as por_avaria_transporte
  from assist_filtrado group by 1
),
motivos as (
  select nullif(e.detalhe, '') as codigo, count(*) as total
  from eventos e where e.tipo = 'insucesso' group by 1
),
-- descrição mais comum de cada código (há linhas com acentuação quebrada)
descricoes as materialized (
  select ocorrencia_codigo as codigo,
         mode() within group (order by ocorrencia_descricao) as descricao,
         mode() within group (order by ocorrencia_categoria) as categoria
  from totvs_delivery_cargas
  where coalesce(ocorrencia_codigo, '') <> ''
  group by 1
),
-- cada pedido que voltou sem entregar no período (mesma base dos motivos),
-- com cliente, CPF e produtos -- abre ao clicar no motivo. "motivo" (texto
-- da ocorrência lançada naquela carga, pode ser mais específico que a
-- descrição agregada por código) e "vendedor" são novos (16/10/2026) --
-- vendedor cruzado com totvs_orders por nota fiscal + série + filial da
-- venda (mesmo cruzamento de src/lib/entregasRisco.ts, só que com o filial
-- a mais pra não pegar nota de outra filial com o mesmo número).
insucessos_det as materialized (
  select v.dia, v.carga, v.motorista_codigo, nullif(v.ocorrencia_codigo, '') as codigo,
         v.nota_fiscal, v.tentativa, d.pedido, d.client_name as cliente, d.client_cpf_cnpj as cpf,
         c.ocorrencia_descricao as motivo,
         case when vend.seller_name is not null then '~ ' || vend.seller_name end as vendedor,
         (select string_agg(trim(i.descricao)
                            || case when i.quantidade > 1 then ' (' || round(i.quantidade)::text || ' un.)' else '' end,
                            ' · ' order by i.item)
            from totvs_delivery_carga_itens i where i.delivery_carga_id = v.delivery_carga_id) as produtos,
         d.status_atual as situacao_atual,
         case when dep.carga is not null then jsonb_build_object(
           'carga', dep.carga, 'statusOrigem', dep.status_origem, 'statusCodigo', dep.status_entrega_codigo,
           'statusCarga', dep.status_carga, 'dia', dep.dt_retorno, 'hora', dep.hr_retorno,
           'motorista', dep.motorista_nome) end as depois
  from v_visitas_motorista v
  join totvs_delivery_cargas c on c.id = v.delivery_carga_id
  join totvs_deliveries d on d.id = c.delivery_id
  left join veic ve on ve.carga = v.carga
  left join lateral (
    select o.seller_name from totvs_orders o
    where o.client_id = d.client_id and o.type = 'Venda' and o.issue_date <= v.dia
    order by o.issue_date desc limit 1
  ) vend on true
  left join lateral (
    select c2.carga, c2.status_origem, c2.status_entrega_codigo, c2.status_carga,
           c2.dt_retorno, c2.hr_retorno, nullif(trim(c2.motorista_nome), '') as motorista_nome
    from totvs_delivery_cargas c2
    where c2.delivery_id = c.delivery_id and c2.id <> c.id
      and (coalesce(c2.tentativa, 0), c2.dt_previsao, c2.carga) > (coalesce(c.tentativa, 0), c.dt_previsao, c.carga)
    order by coalesce(c2.tentativa, 0) desc, c2.dt_previsao desc, c2.carga desc
    limit 1
  ) dep on true
  where v.status_entrega_codigo = '3'
    and v.dia between p_de and p_ate
    and (p_tipo is null or ve.tipo_carga = p_tipo)
    and (p_tipo_veiculo is null or ve.tipo_veiculo = p_tipo_veiculo)
    and (p_vinculo is null or ve.vinculo = p_vinculo)
),
-- mesma coisa, pras notas que ficaram parciais com o cliente (status '2')
-- -- pedido do Victor 16/10/2026: "Parciais" também abre lista nota a nota.
parciais_det as materialized (
  select v.dia, v.carga, v.motorista_codigo, nullif(v.ocorrencia_codigo, '') as codigo,
         v.nota_fiscal, v.tentativa, d.pedido, d.client_name as cliente, d.client_cpf_cnpj as cpf,
         c.ocorrencia_descricao as motivo,
         case when vend.seller_name is not null then '~ ' || vend.seller_name end as vendedor,
         (select string_agg(trim(i.descricao)
                            || case when i.quantidade > 1 then ' (' || round(i.quantidade)::text || ' un.)' else '' end,
                            ' · ' order by i.item)
            from totvs_delivery_carga_itens i where i.delivery_carga_id = v.delivery_carga_id) as produtos,
         d.status_atual as situacao_atual,
         case when dep.carga is not null then jsonb_build_object(
           'carga', dep.carga, 'statusOrigem', dep.status_origem, 'statusCodigo', dep.status_entrega_codigo,
           'statusCarga', dep.status_carga, 'dia', dep.dt_retorno, 'hora', dep.hr_retorno,
           'motorista', dep.motorista_nome) end as depois
  from v_visitas_motorista v
  join totvs_delivery_cargas c on c.id = v.delivery_carga_id
  join totvs_deliveries d on d.id = c.delivery_id
  left join veic ve on ve.carga = v.carga
  left join lateral (
    select o.seller_name from totvs_orders o
    where o.client_id = d.client_id and o.type = 'Venda' and o.issue_date <= v.dia
    order by o.issue_date desc limit 1
  ) vend on true
  left join lateral (
    select c2.carga, c2.status_origem, c2.status_entrega_codigo, c2.status_carga,
           c2.dt_retorno, c2.hr_retorno, nullif(trim(c2.motorista_nome), '') as motorista_nome
    from totvs_delivery_cargas c2
    where c2.delivery_id = c.delivery_id and c2.id <> c.id
      and (coalesce(c2.tentativa, 0), c2.dt_previsao, c2.carga) > (coalesce(c.tentativa, 0), c.dt_previsao, c.carga)
    order by coalesce(c2.tentativa, 0) desc, c2.dt_previsao desc, c2.carga desc
    limit 1
  ) dep on true
  where v.status_entrega_codigo = '2'
    and v.dia between p_de and p_ate
    and (p_tipo is null or ve.tipo_carga = p_tipo)
    and (p_tipo_veiculo is null or ve.tipo_veiculo = p_tipo_veiculo)
    and (p_vinculo is null or ve.vinculo = p_vinculo)
),
motoristas as (
  select m.codigo, m.nome, vi.vinculo, vi.transportadora,
         coalesce(v.visitas, 0) as visitas, coalesce(v.entregues, 0) as entregues,
         coalesce(v.entregas_realizadas, 0) as entregas_realizadas,
         coalesce(v.entregas_carro, 0) as entregas_carro, coalesce(v.entregas_caminhao, 0) as entregas_caminhao,
         coalesce(v.entregas_nao_identificado, 0) as entregas_nao_identificado,
         coalesce(x.insucessos, 0) as insucessos, coalesce(x.insucessos_cliente, 0) as insucessos_cliente,
         coalesce(x.insucessos_logistica, 0) as insucessos_logistica, coalesce(x.insucessos_cd, 0) as insucessos_cd,
         coalesce(x.insucessos_outros, 0) as insucessos_outros,
         coalesce(x.parciais, 0) as parciais,
         coalesce(a.total, 0) as assist_total, coalesce(a.por_carga, 0) as assist_carga,
         coalesce(a.por_produto, 0) as assist_produto, coalesce(a.por_cliente, 0) as assist_cliente,
         coalesce(a.por_erro_motorista, 0) as assist_erro_motorista,
         coalesce(a.por_avaria_transporte, 0) as assist_avaria_transporte,
         (select count(*) from cargas c where c.motorista_codigo = m.codigo) as cargas
  from nomes m
  left join vinc vi on vi.codigo = m.codigo
  left join visitas v on v.motorista_codigo = m.codigo
  left join voltas x on x.motorista_codigo = m.codigo
  left join assist a on a.motorista_codigo = m.codigo
  where v.visitas > 0 or x.motorista_codigo is not null or a.motorista_codigo is not null
),
-- matriz vínculo × veículo: cargas e pedidos pela data da carga, entregas
-- pela data da visita (mesma regra do resto da tela).
-- veículos na rua por dia: o campo veiculo nem sempre é placa ("AIAM",
-- "FORD", "FRETIST"...). Carga sem placa usa a placa que o mesmo motorista
-- usou no dia, no mesmo tipo de veículo; sem nenhuma, conta pelo motorista
-- (um motorista sai num veículo por dia). Sem isso, a Strada com uma carga
-- "TPB0A58" e outra "AIAM" no mesmo dia contava duas vezes.
veiculos_dia as (
  select dia, vinculo, tipo_veiculo, count(distinct chave) as veiculos
  from (
    select c.dia, coalesce(c.vinculo, 'Sem vínculo') as vinculo, c.tipo_veiculo,
           coalesce(case when c.placa_ok then c.veiculo end,
                    max(case when c.placa_ok then c.veiculo end)
                      over (partition by c.dia, c.motorista_codigo, c.tipo_veiculo),
                    'motorista:' || coalesce(c.motorista_codigo, c.carga)) as chave
    from (select *, coalesce(veiculo, '') ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{1,2}$' as placa_ok from cargas) c
  ) x
  group by 1, 2, 3
),
grade as (
  select coalesce(vinculo, 'Sem vínculo') as vinculo, tipo_veiculo,
         count(*) as cargas, sum(pedidos) as pedidos, 0::bigint as entregas
  from cargas group by 1, 2
  union all
  select coalesce(v.vinculo, 'Sem vínculo'), coalesce(v.tipo_veiculo, 'Não identificado'), 0, 0, count(*)
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
      'insucessosPorMotivo', coalesce(por_motivo, '{}'::jsonb),
      'volumes', jsonb_build_object('P', qtd_p, 'M', qtd_m, 'G', qtd_g, 'naoClassificado', qtd_n))
      order by dia desc, carga)
    from cargas), '[]'::jsonb),
  'motoristas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'codigo', codigo, 'nome', nome, 'vinculo', vinculo, 'transportadora', transportadora,
      'cargas', cargas, 'visitas', visitas, 'entregues', entregues,
      'entregasRealizadas', entregas_realizadas,
      'entregasPorVeiculo', jsonb_build_object('Carro', entregas_carro, 'Caminhão', entregas_caminhao,
                                               'Não identificado', entregas_nao_identificado),
      'insucessos', jsonb_build_object('total', insucessos, 'cliente', insucessos_cliente,
                                       'logistica', insucessos_logistica, 'cd', insucessos_cd,
                                       'outros', insucessos_outros),
      'parciais', parciais,
      'assistencias', jsonb_build_object('total', assist_total, 'porCarga', assist_carga,
                                         'porProduto', assist_produto, 'porCliente', assist_cliente,
                                         'porErroMotorista', assist_erro_motorista,
                                         'porAvariaTransporte', assist_avaria_transporte),
      'indiceVolta', case when visitas = 0 then null
        else round((insucessos + parciais)::numeric / visitas, 4) end,
      'indiceVoltaLogistica', case when visitas = 0 then null
        else round(insucessos_logistica::numeric / visitas, 4) end)
      order by visitas desc)
    from motoristas), '[]'::jsonb),
  'veiculosPorDia', coalesce((
    select jsonb_agg(jsonb_build_object('dia', dia, 'vinculo', vinculo, 'tipoVeiculo', tipo_veiculo, 'veiculos', veiculos)
                     order by dia, vinculo, tipo_veiculo)
    from veiculos_dia), '[]'::jsonb),
  'entregasPorVeiculo', coalesce((
    select jsonb_agg(jsonb_build_object('vinculo', vinculo, 'tipoVeiculo', tipo_veiculo,
                                        'cargas', cargas, 'pedidos', pedidos, 'entregas', entregas)
                     order by vinculo, tipo_veiculo)
    from (select vinculo, tipo_veiculo, sum(cargas) as cargas, sum(pedidos) as pedidos, sum(entregas) as entregas
          from grade group by 1, 2) g), '[]'::jsonb),
  'produtosPorte', coalesce((
    select jsonb_agg(jsonb_build_object('porte', porte, 'produto', produto, 'descricao', descricao,
                                        'unidades', unidades, 'cargas', cargas, 'origem', origem)
                     order by porte, unidades desc, descricao)
    from (
      select coalesce(p.porte, 'N') as porte, i.produto, max(trim(i.descricao)) as descricao,
             sum(i.quantidade) as unidades, count(distinct i.carga) as cargas, max(p.origem) as origem
      from itens_base i left join porte_produtos p on p.produto = i.produto
      group by 1, 2
    ) x), '[]'::jsonb),
  -- regras de classificação por descrição (a 1ª que bate, pela prioridade)
  'regrasPorte', coalesce((
    select jsonb_agg(jsonb_build_object('padrao', padrao, 'porte', porte) order by porte, prioridade, padrao)
    from produto_porte_regras), '[]'::jsonb),
  'motivosInsucesso', coalesce((
    select jsonb_agg(jsonb_build_object('codigo', m.codigo,
                                        'descricao', coalesce(d.descricao, 'Sem motivo informado'),
                                        'categoria', d.categoria, 'total', m.total)
                     order by m.total desc, m.codigo)
    from motivos m left join descricoes d on d.codigo = m.codigo), '[]'::jsonb),
  -- descrição/categoria de todo código de ocorrência (tooltip do monitor)
  'ocorrencias', coalesce((
    select jsonb_object_agg(codigo, jsonb_build_object('descricao', descricao, 'categoria', categoria))
    from descricoes), '{}'::jsonb),
  'insucessos', coalesce((
    select jsonb_agg(jsonb_build_object(
      'dia', dia, 'carga', carga, 'motoristaCodigo', motorista_codigo, 'codigo', codigo,
      'notaFiscal', nota_fiscal, 'tentativa', tentativa, 'pedido', pedido,
      'cliente', cliente, 'cpf', cpf, 'produtos', produtos, 'motivo', motivo, 'vendedor', vendedor,
      'situacaoAtual', situacao_atual, 'depois', depois)
      order by dia desc, carga, nota_fiscal)
    from insucessos_det), '[]'::jsonb),
  'parciais', coalesce((
    select jsonb_agg(jsonb_build_object(
      'dia', dia, 'carga', carga, 'motoristaCodigo', motorista_codigo, 'codigo', codigo,
      'notaFiscal', nota_fiscal, 'tentativa', tentativa, 'pedido', pedido,
      'cliente', cliente, 'cpf', cpf, 'produtos', produtos, 'motivo', motivo, 'vendedor', vendedor,
      'situacaoAtual', situacao_atual, 'depois', depois)
      order by dia desc, carga, nota_fiscal)
    from parciais_det), '[]'::jsonb),
  -- lista dos chamados ligados (para abrir ao clicar no motorista)
  'assistencias', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'origem', origem, 'ticket', ticket_number, 'tipo', tipo, 'frente', frente,
      'dia', dia, 'produto', produto, 'causaRaiz', causa_raiz,
      'motoristaCodigo', motorista_codigo, 'carga', carga, 'diaEntrega', dia_entrega,
      'atribuicao', atribuicao)
      order by dia desc, ticket_number)
    from assist_filtrado), '[]'::jsonb),
  -- chamados abertos no período (sem filtro de veículo/vínculo): quantos acharam a entrega
  'assistenciasPeriodo', (
    select jsonb_build_object('total', count(*),
                              'vinculadas', count(*) filter (where motorista_codigo is not null))
    from assist_abertos)
);
$$;

revoke all on function kpis_entregas(date, date, text, text, text) from public, anon, authenticated;
grant execute on function kpis_entregas(date, date, text, text, text) to service_role;
