-- Conversão 1ª -> 2ª Compra (aba /clientes): corrige o critério de "2ª
-- compra" -- achado do Victor 16/10/2026 revisando a aba: a taxa de 33,5%
-- mostrada antes vinha majoritariamente de ACESSÓRIO (protetor,
-- travesseiro) comprado em nota separada poucos dias depois do colchão,
-- não do cliente voltando de verdade mais tarde.
--
-- Regra nova (migration 0161 original fica como está, não editada --
-- esta aqui substitui a view por completo):
-- - Compras de um mesmo cliente feitas em até 7 dias depois do INÍCIO de
--   um grupo contam como UM evento de compra só -- janela FIXA a partir
--   da 1ª nota do grupo (a "âncora"), NÃO encadeada (uma compra no dia 8
--   depois da âncora abre evento novo, mesmo que esteja a só 1 dia da
--   compra anterior).
-- - "2ª compra de verdade" = o PRÓXIMO EVENTO, não a próxima nota.
--
-- Não dá pra expressar esse agrupamento com window function pura (LAG
-- olha só pra linha anterior; aqui o corte depende da ÂNCORA do evento
-- corrente, que só fecha quando o evento muda) -- por isso a CTE
-- recursiva abaixo: anda nota a nota por cliente (já ranqueadas por
-- data), carregando a âncora do evento atual, e só abre evento novo
-- quando a distância da âncora passa de 7 dias.
--
-- Exclusão de cliente interno/sintético (mesmo critério de
-- isClienteInterno, src/lib/clientes.ts) ENTRA NA QUERY DESSA VEZ, ao
-- contrário da view original -- não por correção (listConversaoRecompra
-- já descartava essas linhas no app, via nivelPorCliente.get), mas por
-- PERFORMANCE: "CONSUMIDOR FINAL" (client_id 010206) tem 6.057 notas e
-- cada filial da LOJAS AIAM (raiz de CNPJ 39537682) tem até 4.941 --
-- sem excluir, a CTE recursiva percorreria milhares de iterações pra
-- esses client_ids (nenhum cliente de verdade passa de ~50 notas hoje).
-- Testado antes desta migration (consulta avulsa, somente leitura, mesma
-- lógica): ~6s pra recalcular a base inteira.
--
-- Validado contra os números da regra nova antes de aplicar esta
-- migration (ver conversa/commit): base geral, coorte 6-12 meses, mediana
-- e distribuição por nº de eventos bateram com tolerância pequena
-- (dados novos chegam via sync a cada 30min).
drop materialized view if exists v_clientes_primeira_segunda_compra;

create materialized view v_clientes_primeira_segunda_compra as
with recursive vendas_rankeadas as (
  select
    client_id,
    issue_date,
    branch,
    payment_method,
    row_number() over (partition by client_id order by issue_date, invoice, serie) as rn
  from totvs_orders
  where type = 'Venda'
    and client_id is not null
    and not (client_cpf_cnpj like '39537682%')
    and not (client_name ilike 'CONSUMIDOR FINAL')
    and regexp_replace(coalesce(client_cpf_cnpj, ''), '\D', '', 'g') not in ('29112864000187', '11672695430')
),
eventos as (
  -- Base: a 1ª nota de cada cliente sempre abre o evento 1, com ela
  -- mesma como âncora.
  select
    client_id, issue_date, branch, payment_method, rn,
    issue_date as ancora,
    1 as evento_num
  from vendas_rankeadas
  where rn = 1
  union all
  -- Passo recursivo: pega a próxima nota (rn da linha anterior + 1) do
  -- MESMO cliente. Dentro de 7 dias da âncora atual -> continua no
  -- mesmo evento, com a MESMA âncora (janela fixa, não encadeada).
  -- Fora -> abre evento novo, com ela mesma como nova âncora.
  select
    r.client_id, r.issue_date, r.branch, r.payment_method, r.rn,
    case when r.issue_date - e.ancora <= 7 then e.ancora else r.issue_date end as ancora,
    case when r.issue_date - e.ancora <= 7 then e.evento_num else e.evento_num + 1 end as evento_num
  from vendas_rankeadas r
  join eventos e on e.client_id = r.client_id and e.rn = r.rn - 1
)
select
  client_id,
  min(issue_date) filter (where evento_num = 1) as primeira_compra,
  max(branch) filter (where rn = 1) as loja_primeira_compra,
  -- Todas as formas de pagamento usadas no evento 1 (pode ter mais de uma
  -- nota, cada uma com sua própria forma -- ex.: colchão parcelado + um
  -- acessório à vista dias depois, mesmo evento) -- pedido do Victor
  -- 16/10/2026: "hoje cada compra conta com uma forma só, e por isso o
  -- crediário aparece com só 63 clientes, apesar de ter ~300 vendas por
  -- mês. Considere todas as formas de pagamento da compra." Array bruto
  -- (texto cru do TOTVS, pode ter "|" dentro de cada item pra pagamento
  -- combinado numa nota só) -- o parse pra código (CRD/PIX/CC...) fica no
  -- app (extrairCodigosFormaPagamento, recompra.ts), não aqui.
  array_agg(distinct payment_method) filter (where evento_num = 1 and payment_method is not null) as formas_pagamento_primeira_compra,
  min(issue_date) filter (where evento_num = 2) as segunda_compra,
  -- Total de eventos de compra do cliente (1, 2, 3...) -- não usado pelo
  -- app hoje, só pra validação/distribuição (ver conversa) e uso futuro,
  -- de graça nesta mesma agregação.
  max(evento_num) as total_eventos
from eventos
group by client_id
with data;

create unique index v_clientes_primeira_segunda_compra_idx
  on v_clientes_primeira_segunda_compra (client_id);

-- Mesma função de sempre (migration 0129/0161), corpo inalterado -- só
-- documentando que ela já cobre a view recriada acima (mesmo nome).
comment on materialized view v_clientes_primeira_segunda_compra is
  'Refeita pela migration 0175: 2ª compra agora é o próximo EVENTO de compra (janela fixa de 7 dias a partir da âncora do evento, não a próxima nota) -- ver comentário no topo da migration.';
