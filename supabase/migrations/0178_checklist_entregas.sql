-- (17/10/2026) Pedido do Victor: checklist antes do atendente finalizar uma
-- notificacao de assistencia de envio de peca, troca de produto (com
-- recolhimento) ou entrega de produto. 4 perguntas: produto consta em
-- estoque, produto separado, produto sinalizado com placa, e onde o
-- produto esta (Assistencia/Estoque/Area de reserva).
--
-- "Pode salvar como rascunho, mas so entra de verdade na rota depois que
-- preencher o checklist": checklist_completo fica false enquanto as 3
-- confirmacoes + a localizacao nao estiverem todas preenchidas (ver
-- readChecklistFields, actions.ts) -- so entao o chamado aparece de
-- verdade na fila do motorista (listRequestsForDriver/getDriverRequestDetail,
-- serviceRequests.ts, ganham filtro checklist_completo=true) e sai do balde
-- "Rascunho" nas telas de notificacoes (groupByRota, entregaQueueGrouping.ts).
-- Default true pra todo chamado que ja existe e pra todo tipo que nao usa
-- esse checklist (so envio_peca/troca_produto/entrega_produto, ver
-- CHECKLIST_REQUIRED_TYPES em assistenciaLabels.ts) -- nao e retroativo.

alter table service_requests
  add column if not exists checklist_estoque boolean not null default false,
  add column if not exists checklist_separado boolean not null default false,
  add column if not exists checklist_placa boolean not null default false,
  add column if not exists checklist_localizacao text,
  add column if not exists checklist_completo boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'service_requests_checklist_localizacao_check'
  ) then
    alter table service_requests add constraint service_requests_checklist_localizacao_check
      check (checklist_localizacao is null or checklist_localizacao in ('assistencia', 'estoque', 'area_reserva'));
  end if;
end $$;

-- Pra achar rapido os rascunhos pendentes (fila/notificacoes filtram por
-- checklist_completo o tempo todo).
create index if not exists service_requests_checklist_completo_idx on service_requests (checklist_completo) where not checklist_completo;
