-- Módulo de Suprimentos (loja pede -> CD/Rafael aprova, compra e despacha).
-- Diferente de Encomendas (pedidos_encomenda, 0027): aqui não tem fábrica,
-- não tem cliente final, não tem NF-e de venda -- é requisição interna de
-- consumo (produtos de limpeza, copos, itens administrativos da loja).
--
-- Reaproveita 100% a auth que já existe: gerente/caixa de loja (mesma sessão
-- PIN usada em Encomendas, cookie path "/assistencia" -- ver
-- src/lib/encomendaRequester.ts) e CD/Rafael (src/lib/cdAuth.ts). Nenhum
-- papel novo em `profiles.role` -- CD já não usa profiles pra isso.

-- 1. Catálogo de produtos ---------------------------------------------------

create table if not exists suprimento_produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  categoria text,
  unidade text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Pedidos -----------------------------------------------------------------

create sequence if not exists suprimento_pedido_seq;

create table if not exists suprimento_pedidos (
  id uuid primary key default gen_random_uuid(),
  pedido_number integer not null default nextval('suprimento_pedido_seq'),
  store_id text not null references stores (id),
  status text not null default 'solicitado'
    check (status in ('solicitado', 'aprovado', 'comprado', 'enviado', 'recebido', 'rejeitado', 'cancelado')),
  requested_by_name text not null,
  requested_by_role text not null check (requested_by_role in ('gerente', 'caixa')),
  notes text,
  rejection_reason text,
  approved_at timestamptz,
  purchased_at timestamptz,
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'suprimento_pedidos_pedido_number_key'
  ) then
    alter table suprimento_pedidos add constraint suprimento_pedidos_pedido_number_key unique (pedido_number);
  end if;
end $$;

create index if not exists suprimento_pedidos_store_status_idx on suprimento_pedidos (store_id, status);
create index if not exists suprimento_pedidos_status_created_idx on suprimento_pedidos (status, created_at);

-- Reaproveita a função set_updated_at criada em 0001_service_requests.sql.
drop trigger if exists suprimento_pedidos_set_updated_at on suprimento_pedidos;
create trigger suprimento_pedidos_set_updated_at
  before update on suprimento_pedidos
  for each row execute function set_updated_at();

-- 3. Itens do pedido ----------------------------------------------------------
-- Aceita produto do catálogo OU texto livre (pro caixa/gerente não ficar
-- travado se o item ainda não estiver cadastrado) -- exatamente um dos dois.

create table if not exists suprimento_pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references suprimento_pedidos (id) on delete cascade,
  produto_id uuid references suprimento_produtos (id),
  produto_nome_livre text,
  quantidade integer not null check (quantidade > 0),
  unidade text,
  notes text,
  check (produto_id is not null or produto_nome_livre is not null)
);

create index if not exists suprimento_pedido_itens_pedido_idx on suprimento_pedido_itens (pedido_id);

-- 4. Timeline / auditoria ------------------------------------------------------

create table if not exists suprimento_pedido_events (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references suprimento_pedidos (id) on delete cascade,
  actor_name text not null,
  actor_role text not null check (actor_role in ('loja', 'cd', 'admin')),
  event_type text not null check (event_type in ('created', 'status_changed', 'note_added')),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists suprimento_pedido_events_pedido_idx on suprimento_pedido_events (pedido_id, created_at);

-- 5. RLS -----------------------------------------------------------------------
-- Aplicação usa o client service-role (getSupabaseAdmin) pra todo acesso
-- real, com autorização checada em código. RLS aqui é só defesa extra.

alter table suprimento_produtos enable row level security;
alter table suprimento_pedidos enable row level security;
alter table suprimento_pedido_itens enable row level security;
alter table suprimento_pedido_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'suprimento_produtos' and policyname = 'suprimento_produtos_select_authenticated'
  ) then
    create policy suprimento_produtos_select_authenticated on suprimento_produtos
      for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'suprimento_pedidos' and policyname = 'suprimento_pedidos_select_authenticated'
  ) then
    create policy suprimento_pedidos_select_authenticated on suprimento_pedidos
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('assistencia', 'admin'))
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'suprimento_pedido_itens' and policyname = 'suprimento_pedido_itens_select_authenticated'
  ) then
    create policy suprimento_pedido_itens_select_authenticated on suprimento_pedido_itens
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('assistencia', 'admin'))
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'suprimento_pedido_events' and policyname = 'suprimento_pedido_events_select_authenticated'
  ) then
    create policy suprimento_pedido_events_select_authenticated on suprimento_pedido_events
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('assistencia', 'admin'))
      );
  end if;
end $$;

-- 6. Realtime --------------------------------------------------------------------
-- Mesmo mecanismo de pedidos_encomenda (0027) -- alimenta RealtimeQueueRefresher
-- na fila do Rafael e na tela da loja.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'suprimento_pedidos'
  ) then
    alter publication supabase_realtime add table suprimento_pedidos;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'suprimento_pedido_events'
  ) then
    alter publication supabase_realtime add table suprimento_pedido_events;
  end if;
end $$;
