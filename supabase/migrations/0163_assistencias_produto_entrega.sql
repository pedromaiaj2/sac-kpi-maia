-- (13/10/2026) Assistências por motorista (à parte) e volta sem devoluções.
-- Original em lojas-maia-integracao/apis/logistica-v1/sql/0163_assistencias_produto_entrega.sql.

-- (13/10/2026) Assistências por motorista na aba Logística, à parte do
-- Índice de Volta, e volta sem devoluções. Aplicada no Supabase
-- self-hosted em 13/10/2026. Vai para o sac-kpi-maia como
-- supabase/migrations/0163_assistencias_produto_entrega.sql.
--
-- Pedido do Victor (13/10/2026):
--   - Índice de Volta = (insucessos + parciais) ÷ visitas. As devoluções
--     (notas de devolução do Protheus) saem: a nota não traz motivo e ~40%
--     delas são trocas/recolhimentos da assistência;
--   - número de chamados de assistência por motorista, cruzado com as
--     entregas, numa coluna à parte (não entra no índice), com a lista dos
--     chamados ao clicar.
--
-- Chamados: service_requests de pós-venda (peça, troca de produto,
-- recolhimento, entrega de produto novo), só o raiz, sem cancelados, e os
-- pedidos da fila de peças que não são o mesmo caso de um chamado de peça
-- (mesma regra da 0159).
--
-- Vínculo com a entrega, em cascata (180 dias antes do chamado):
--   carga ..... carga informada no chamado (causa_carga)
--   produto ... entrega ao mesmo cliente (CPF ou código do Protheus) em que
--               saiu o produto do chamado: código do produto
--               (service_request_items.part_code = item da carga) ou os 25
--               primeiros caracteres da descrição
--   cliente ... só pelo cliente: a entrega mais recente a ele (provável)
-- 90 dias até 13/10: 785 chamados; 376 pelo produto, 494 pelo CPF.

create or replace view v_assistencias_produto_entrega with (security_invoker = true) as
with ocorrencias as (
  select 'chamado'::text as origem, s.id, s.ticket_number::text as ticket_number, s.type as tipo,
         case when s.type in ('envio_peca', 'troca_peca', 'envio_recolhimento_peca') then 'peca'
              when s.type = 'troca_produto' then 'troca_produto'
              when s.type in ('recolhimento_produto', 'recolhimento') then 'recolhimento'
              else 'entrega_produto' end as frente,
         s.created_at::date as dia, s.causa_raiz,
         s.client_cpf as cpf_bruto, s.client_protheus_code as codigo, s.causa_carga,
         it.cods, it.descs, it.produto
  from service_requests s
  left join lateral (
    select array_agg(distinct trim(i.part_code)) filter (where trim(i.part_code) ~ '^[A-Z0-9]{6,7}$') as cods,
           array_agg(distinct upper(left(trim(i.product), 25))) filter (where coalesce(trim(i.product), '') <> '') as descs,
           string_agg(distinct trim(i.product), ' · ') as produto
    from service_request_items i where i.request_id = s.id
  ) it on true
  where s.status <> 'cancelada'
    and s.parent_request_id is null
    and s.type in ('envio_peca', 'troca_peca', 'envio_recolhimento_peca', 'troca_produto',
                   'recolhimento_produto', 'recolhimento', 'entrega_produto')
  union all
  select 'pedido_peca', po.id, po.ticket_number::text, 'pedido_peca', 'peca',
         po.created_at::date, null, po.client_cpf, null, null,
         null::text[],
         case when coalesce(trim(po.product), '') <> '' then array[upper(left(trim(po.product), 25))] end,
         nullif(trim(po.product), '')
  from part_orders po
  where po.status <> 'cancelada'
    and not exists (
      select 1 from service_requests s
       where s.status <> 'cancelada'
         and s.type in ('envio_peca', 'troca_peca', 'envio_recolhimento_peca')
         and (s.id = po.service_request_id
              or (nullif(regexp_replace(coalesce(po.client_cpf, ''), '\D', '', 'g'), '')
                    = regexp_replace(coalesce(s.client_cpf, ''), '\D', '', 'g')
                  and s.created_at between po.created_at - interval '30 days'
                                       and po.created_at + interval '30 days')))
)
select o.origem, o.id, o.ticket_number, o.tipo, o.frente, o.dia, o.causa_raiz, o.produto,
       coalesce(pc.motorista_codigo, ep.motorista_codigo, ec.motorista_codigo) as motorista_codigo,
       coalesce(pc.carga, ep.carga, ec.carga) as carga,
       coalesce(pc.dia, ep.dia, ec.dia) as dia_entrega,
       case when pc.carga is not null then 'carga'
            when ep.carga is not null then 'produto'
            when ec.carga is not null then 'cliente' end as atribuicao
from ocorrencias o
cross join lateral (
  select nullif(regexp_replace(coalesce(o.cpf_bruto, ''), '\D', '', 'g'), '') as cpf
) k
cross join lateral (
  select array_remove(array_agg(tc.protheus_code) || o.codigo, null) as codigos
  from totvs_clientes tc where tc.cpf_cnpj = k.cpf
) cc
left join lateral (
  select c.motorista_codigo, c.carga, c.dt_retorno as dia from v_cargas_producao c
   where c.carga = o.causa_carga and coalesce(c.motorista_codigo, '') <> ''
   order by c.dt_retorno desc nulls last
   limit 1
) pc on true
left join lateral (
  select v.motorista_codigo, v.carga, v.dia
  from (
    select v1.* from v_visitas_motorista v1 where v1.cpf = k.cpf
    union all
    select v2.* from v_visitas_motorista v2
     where v2.client_id = any (cc.codigos) and v2.cpf is distinct from k.cpf
  ) v
  where v.status_entrega_codigo in ('1', '2')
    and v.dia between o.dia - 180 and o.dia
    and exists (
      select 1 from totvs_delivery_carga_itens i
       where i.delivery_carga_id = v.delivery_carga_id
         and (trim(i.produto) = any (o.cods) or upper(left(trim(i.descricao), 25)) = any (o.descs)))
  order by v.dia desc
  limit 1
) ep on pc.carga is null
left join lateral (
  select v.motorista_codigo, v.carga, v.dia
  from (
    select v1.* from v_visitas_motorista v1 where v1.cpf = k.cpf
    union all
    select v2.* from v_visitas_motorista v2
     where v2.client_id = any (cc.codigos) and v2.cpf is distinct from k.cpf
  ) v
  where v.status_entrega_codigo in ('1', '2')
    and v.dia between o.dia - 180 and o.dia
  order by v.dia desc
  limit 1
) ec on pc.carga is null and ep.carga is null;

revoke all on v_assistencias_produto_entrega from anon, authenticated;
grant select on v_assistencias_produto_entrega to service_role;

------------------------------------------------------------------------------
-- RPC da tela: mesma assinatura da 0162. Sai 'devolucoes' (por motorista);
-- entram 'assistencias' por motorista e a lista 'assistencias' no topo.
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
  where e.tipo in ('insucesso', 'parcial')
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
         count(*) filter (where e.tipo = 'parcial') as parciais
  from eventos e
  group by 1
),
-- motivo de cada insucesso (código de ocorrência do Protheus); a descrição
-- é a mais comum do código (há linhas com acentuação quebrada).
-- chamados de assistência criados no período, ligados à entrega original
-- (v_assistencias_produto_entrega); veículo e vínculo são os da carga
-- dessa entrega.
assist_periodo as materialized (
  select a.*, ve.tipo_veiculo, ve.vinculo
  from v_assistencias_produto_entrega a
  left join veic ve on ve.carga = a.carga
  where a.dia between p_de and p_ate
),
assist_filtrado as materialized (
  select * from assist_periodo
  where motorista_codigo is not null
    and (p_tipo_veiculo is null or tipo_veiculo = p_tipo_veiculo)
    and (p_vinculo is null or vinculo = p_vinculo)
),
assist as (
  select motorista_codigo, count(*) as total,
         count(*) filter (where atribuicao = 'carga') as por_carga,
         count(*) filter (where atribuicao = 'produto') as por_produto,
         count(*) filter (where atribuicao = 'cliente') as por_cliente
  from assist_filtrado group by 1
),
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
         coalesce(x.parciais, 0) as parciais,
         coalesce(a.total, 0) as assist_total, coalesce(a.por_carga, 0) as assist_carga,
         coalesce(a.por_produto, 0) as assist_produto, coalesce(a.por_cliente, 0) as assist_cliente,
         (select count(*) from cargas c where c.motorista_codigo = m.codigo) as cargas
  from v_motoristas_protheus m
  left join vinc vi on vi.codigo = m.codigo
  left join visitas v on v.motorista_codigo = m.codigo
  left join voltas x on x.motorista_codigo = m.codigo
  left join assist a on a.motorista_codigo = m.codigo
  where v.visitas > 0 or x.motorista_codigo is not null or a.motorista_codigo is not null
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
      'parciais', parciais,
      'assistencias', jsonb_build_object('total', assist_total, 'porCarga', assist_carga,
                                         'porProduto', assist_produto, 'porCliente', assist_cliente),
      'indiceVolta', case when visitas = 0 then null
        else round((insucessos + parciais)::numeric / visitas, 4) end,
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
    from motivos m left join descricoes d on d.codigo = m.codigo), '[]'::jsonb),
  -- lista dos chamados ligados (para abrir ao clicar no motorista)
  'assistencias', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'origem', origem, 'ticket', ticket_number, 'tipo', tipo, 'frente', frente,
      'dia', dia, 'produto', produto, 'causaRaiz', causa_raiz,
      'motoristaCodigo', motorista_codigo, 'carga', carga, 'diaEntrega', dia_entrega,
      'atribuicao', atribuicao)
      order by dia desc, ticket_number)
    from assist_filtrado), '[]'::jsonb),
  -- chamados do período (sem filtro de veículo/vínculo): quantos acharam a entrega
  'assistenciasPeriodo', (
    select jsonb_build_object('total', count(*),
                              'vinculadas', count(*) filter (where motorista_codigo is not null))
    from assist_periodo)
);
$$;

revoke all on function kpis_entregas(date, date, text, text, text) from public, anon, authenticated;
grant execute on function kpis_entregas(date, date, text, text, text) to service_role;
