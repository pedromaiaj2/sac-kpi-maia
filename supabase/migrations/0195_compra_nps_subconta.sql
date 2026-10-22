-- (22/10/2026) Mesmo pedido de 0194 (venda_nps), agora pra compra_nps: NPS
-- "pós-compra" (nota do produto) passa a poder sair pelo número da Lojas
-- Maia em vez do SAC, pra não continuar congestionando a subconta do SAC.
-- Nulo = enviado pelo SAC (tudo antes desta mudança).
alter table compra_nps add column if not exists ghl_location_id text;
