-- Árvore de decisão do Arsenal do SAC (16/10/2026) -- pedido do Victor:
-- "algo mais direto e dinâmico... cliente chega no sac, qual o problema
-- dele?... clico no que for o problema e vem com a tratativa". Reaproveita
-- o conteúdo que já existe em arsenal_sac_entries (schema separado, igual
-- a tabela original -- ver 0046_arsenal_sac.sql): essa tabela nova é só a
-- navegação em árvore; conteúdo (INSERT) fica em scripts/seed-arsenal-flow.ts,
-- migrations aqui são só schema.
--
-- Modelo: lista adjacente (parent_id). Raiz = parent_id null (as 9 opções
-- de "Qual é a situação do cliente?", pergunta fixa no código, não linha de
-- banco). Cada nó pode ter `question` (pergunta mostrada quando o nó tem
-- filhos, ex. "Tem montagem?"), `body` (texto da tratativa -- folha sem
-- filhos, ou nota extra acima dos filhos) e/ou filhos. `list_category`
-- é o "escape" pros ramos 8/9 (contato interno, fornecedor): em vez de
-- modelar de novo os 56 contatos/fornecedores como nós, o nó aponta pra
-- uma categoria de arsenal_sac_entries e a tela mostra a lista search­ável
-- de lá -- sem duplicar dado nem o fluxo de admin que já existe pra
-- fornecedores (ArsenalEntryForm).

create table if not exists arsenal_flow_nodes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references arsenal_flow_nodes(id) on delete cascade,
  slug text not null,
  label text not null,
  question text,
  body text,
  highlight_type text not null default 'normal' check (highlight_type in ('normal', 'regra_ouro', 'atencao')),
  list_category text check (list_category in ('contatos_internos', 'fornecedores', 'processos', 'garantias', 'cdc')),
  order_index int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'arsenal_flow_nodes_slug_key'
  ) then
    alter table arsenal_flow_nodes add constraint arsenal_flow_nodes_slug_key unique (slug);
  end if;
end $$;

create index if not exists arsenal_flow_nodes_parent_id_idx on arsenal_flow_nodes (parent_id, order_index);

drop trigger if exists arsenal_flow_nodes_set_updated_at on arsenal_flow_nodes;
create trigger arsenal_flow_nodes_set_updated_at
  before update on arsenal_flow_nodes
  for each row execute function set_updated_at();

-- RLS: mesmo padrão de arsenal_sac_entries -- leitura pra sac/admin, toda
-- escrita via getSupabaseAdmin() com autorização em código (arsenal-flow-actions.ts).
alter table arsenal_flow_nodes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'arsenal_flow_nodes' and policyname = 'arsenal_flow_nodes_select_authenticated'
  ) then
    create policy arsenal_flow_nodes_select_authenticated on arsenal_flow_nodes
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('sac', 'admin'))
      );
  end if;
end $$;
