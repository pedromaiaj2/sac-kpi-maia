-- Sugestão de melhoria em texto livre -- pedido do Victor 23/10/2026:
-- "possibilidade do cliente dar a opinião dele, alguma sugestão de
-- melhoria, em algum momento da jornada". Anexada à pesquisa "compra" (20
-- dias pós-recebimento, nps2Meses.ts) -- é a pergunta seguinte à nota, na
-- mesma conversa de WhatsApp, sem precisar de tag/Workflow novo (não é um
-- disparo, é a segunda pergunta de um fluxo que já existe). `origem`/
-- `origem_id` deixados abertos (mesmo padrão de google_review_requests, só
-- uma origem usada por enquanto) pra caber outro momento da jornada no
-- futuro sem precisar de migração nova.
create table if not exists nps_sugestoes (
  id uuid primary key default gen_random_uuid(),
  origem text not null,
  origem_id text not null,
  client_id text,
  client_name text,
  store_id text references stores(id),
  mensagem text not null,
  capturada_em timestamptz not null default now(),
  lida boolean not null default false,
  unique (origem, origem_id)
);

create index if not exists nps_sugestoes_nao_lidas_idx
  on nps_sugestoes (capturada_em)
  where not lida;

-- Controle de "já conferi se esse cliente respondeu a pergunta de
-- sugestão" (nps2Meses.ts, detectPendingCompraSugestoes) -- a sugestão é a
-- PRÓXIMA mensagem depois da nota, que pode chegar minutos ou horas depois
-- (o cliente responde a nota, o Workflow manda a pergunta de sugestão, o
-- cliente responde quando quiser) -- não dá pra conferir só no mesmo
-- instante em que o score é detectado. Default false pros pedidos NOVOS
-- (ficam pendentes de conferência até responder ou passar 3 dias, ver
-- detectPendingCompraSugestoes); backfill abaixo marca o histórico já
-- respondido como "verificado" pra não sair varrendo conversa antiga atrás
-- de mensagem que não tem relação nenhuma com essa pergunta (ela nem
-- existia antes de hoje).
alter table compra_nps add column if not exists sugestao_verificada boolean not null default false;
update compra_nps set sugestao_verificada = true where respondido_em is not null;

create index if not exists compra_nps_sugestao_pendente_idx
  on compra_nps (respondido_em)
  where not sugestao_verificada;
