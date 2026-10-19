-- (19/10/2026) Pedido do Victor: CPF/CNPJ do cliente embaixo do nome na
-- lista de notas da carga (mural Rotas de hoje). Só acrescenta "cpf" em
-- notasLista; resto igual à 0186.

create or replace function rotas_do_dia(p_dia date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with linhas as materialized (
  select c.*, d.pedido, d.client_name, d.client_neighborhood, d.client_cpf_cnpj
  from totvs_delivery_cargas c
  join totvs_deliveries d on d.id = c.delivery_id
  where c.carga in (select carga from totvs_delivery_cargas where dt_previsao between p_dia - 3 and p_dia)
),
cargas as materialized (
  select l.carga,
         max(l.status_carga_codigo) as status_codigo,
         mode() within group (order by l.tipo_entrega) as tipo,
         max(nullif(l.motorista_codigo, '')) as motorista_codigo,
         (array_agg(nullif(trim(l.motorista_nome), '') order by l.updated_at desc)
            filter (where coalesce(trim(l.motorista_nome), '') <> ''))[1] as motorista_nome,
         count(*) as notas,
         count(*) filter (where l.status_origem = 'ENTREGA' and l.status_entrega_codigo = '1') as entregues,
         count(*) filter (where l.status_origem = 'ENTREGA' and l.status_entrega_codigo = '2') as parciais,
         count(*) filter (where l.status_origem = 'ENTREGA' and l.status_entrega_codigo = '3') as nao_entregues,
         count(*) filter (where l.status_origem = 'ENTREGA' and l.status_entrega_codigo = '4') as canceladas,
         max(l.dt_previsao) as dia,
         max(l.dt_retorno) filter (where l.status_origem = 'ENTREGA') as ultima_baixa_dia,
         min(l.dt_retorno) filter (where l.status_origem = 'ENTREGA') as primeira_baixa_dia,
         array_remove(array_agg(distinct nullif(trim(l.regiao), '')), null) as regioes
  from linhas l
  group by l.carga
  -- (0186) as do dia + as de até 3 dias antes que continuam Em Rota (status
  -- mais avançado = 5; carga encerrada tem 6)
  having max(l.dt_previsao) = p_dia
      or (max(l.dt_previsao) between p_dia - 3 and p_dia - 1 and max(l.status_carga_codigo) = '5')
),
-- hora da primeira e da última baixa, cada uma no dia em que aconteceu
baixas as (
  select c.carga,
         (select min(l.hr_retorno) from linhas l where l.carga = c.carga and l.status_origem = 'ENTREGA' and l.dt_retorno = c.primeira_baixa_dia) as primeira_baixa,
         (select max(l.hr_retorno) from linhas l where l.carga = c.carga and l.status_origem = 'ENTREGA' and l.dt_retorno = c.ultima_baixa_dia) as ultima_baixa
  from cargas c
),
status_label as (
  select status_carga_codigo as codigo, mode() within group (order by status_carga) as label
  from linhas where status_carga not like '%Ã%' group by 1
),
insuc as (
  select l.carga, jsonb_agg(jsonb_build_object('codigo', coalesce(nullif(l.ocorrencia_codigo, ''), '—'),
                                               'descricao', nullif(l.ocorrencia_descricao, ''), 'n', l.n)
                            order by l.n desc) as motivos
  from (select carga, ocorrencia_codigo, max(ocorrencia_descricao) as ocorrencia_descricao, count(*) as n
        from linhas where status_origem = 'ENTREGA' and status_entrega_codigo = '3' group by 1, 2) l
  group by 1
),
notas as (
  select l.carga, jsonb_agg(jsonb_build_object(
           'notaFiscal', ltrim(l.nota_fiscal, '0'), 'pedido', l.pedido, 'cliente', l.client_name, 'cpf', l.client_cpf_cnpj,
           'bairro', l.client_neighborhood,
           'status', case when l.status_origem = 'ENTREGA' then l.status_entrega_codigo end,
           'hora', case when l.status_origem = 'ENTREGA' then l.hr_retorno end,
           'tentativa', l.tentativa,
           'ocorrencia', nullif(l.ocorrencia_descricao, ''))
           order by (l.status_origem = 'ENTREGA') desc, l.hr_retorno desc nulls last, l.client_name) as lista
  from linhas l group by 1
)
select jsonb_build_object(
  'dia', p_dia,
  -- (0186) último dia com carga antes deste -- o mural mostra esse dia
  -- quando o de hoje não tem nenhuma (domingo, feriado)
  'ultimoDiaComCargas', (select max(dt_previsao) from totvs_delivery_cargas
                          where dt_previsao < p_dia and dt_previsao >= p_dia - 15
                            and tipo_entrega is distinct from 'Retirada'),
  'cargas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'carga', c.carga, 'dia', c.dia, 'statusCodigo', c.status_codigo, 'status', sl.label, 'tipo', c.tipo,
      'motorista', case when c.motorista_codigo is null then null
                        else jsonb_build_object('codigo', c.motorista_codigo, 'nome', c.motorista_nome) end,
      'veiculo', vl.veiculo, 'tipoVeiculo', vl.tipo_veiculo,
      'vinculo', coalesce(mv.vinculo, cv.vinculo),
      'transportadora', case when mv.vinculo is not null then mv.transportadora else cv.transportadora end,
      'regioes', to_jsonb(c.regioes),
      'notas', c.notas, 'entregues', c.entregues, 'parciais', c.parciais,
      'naoEntregues', c.nao_entregues, 'canceladas', c.canceladas,
      'pendentes', c.notas - c.entregues - c.parciais - c.nao_entregues - c.canceladas,
      'primeiraBaixa', b.primeira_baixa, 'ultimaBaixa', b.ultima_baixa, 'ultimaBaixaDia', c.ultima_baixa_dia,
      'volumes', jsonb_build_object('P', coalesce(p.qtd_p, 0), 'M', coalesce(p.qtd_m, 0),
                                    'G', coalesce(p.qtd_g, 0), 'naoClassificado', coalesce(p.qtd_nao_classificado, 0)),
      'insucessos', coalesce(i.motivos, '[]'::jsonb),
      'notasLista', n.lista)
      order by c.dia, c.status_codigo desc, b.ultima_baixa desc nulls last, c.carga)
    from cargas c
    left join status_label sl on sl.codigo = c.status_codigo
    left join v_cargas_logistica vl on vl.carga = c.carga
    left join v_cargas_vinculo cv on cv.carga = c.carga
    left join v_motoristas_vinculo mv on mv.codigo = c.motorista_codigo
    left join v_carga_portes p on p.carga = c.carga
    left join insuc i on i.carga = c.carga
    left join notas n on n.carga = c.carga
    left join baixas b on b.carga = c.carga
    where c.tipo is distinct from 'Retirada'), '[]'::jsonb)
);
$$;

revoke all on function rotas_do_dia(date) from public, anon, authenticated;
grant execute on function rotas_do_dia(date) to service_role;
