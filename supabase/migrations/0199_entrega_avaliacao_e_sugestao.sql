-- Pedido do Victor 24/10/2026: concentrar o pedido de avaliação Google e a
-- pergunta de sugestão de melhoria na pesquisa "Pós-entrega" (1-2 dias
-- depois da entrega, mais perto do "calor do momento" que gera avaliação de
-- verdade), em vez de espalhar entre as 5 pesquisas de NPS -- evita pedir a
-- mesma coisa mais de uma vez pro mesmo cliente que é promotor em
-- venda/entrega/montagem/compra ao mesmo tempo. `nps_sugestoes` e
-- `google_review_requests` (0197/0198) continuam como estão, só o ponto de
-- captura no código muda de "compra" pra "entrega".

-- `sugestao_verificada` tinha ido em compra_nps (0198) -- não é mais usado
-- de lá (ver entregaNps.ts). Dropar a coluna já derruba o índice parcial
-- que dependia dela.
alter table compra_nps drop column if exists sugestao_verificada;

-- Mesmo papel em entrega_nps agora: default false pros pedidos NOVOS (fica
-- pendente de conferência até responder ou passar 3 dias, ver
-- detectPendingEntregaSugestoes em entregaNps.ts); backfill marca o
-- histórico já respondido como "verificado" pra não sair varrendo conversa
-- antiga atrás de mensagem que não tem relação nenhuma com essa pergunta
-- (ela nem existia antes de hoje).
alter table entrega_nps add column if not exists sugestao_verificada boolean not null default false;
update entrega_nps set sugestao_verificada = true where respondido_em is not null;

create index if not exists entrega_nps_sugestao_pendente_idx
  on entrega_nps (respondido_em)
  where not sugestao_verificada;

-- Trava de 90 dias por cliente (googleReviewRequest.ts) -- "Pós-entrega" não
-- tem o limite de 1 pesquisa a cada X dias que "compra" tem (cliente com 2
-- entregas na semana recebe as duas de propósito), então sem essa consulta
-- um cliente frequente receberia o pedido de avaliação de novo a cada
-- entrega nova.
create index if not exists google_review_requests_client_idx
  on google_review_requests (client_id, enviado_em);
