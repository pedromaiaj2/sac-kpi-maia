-- (21/10/2026) NPS de atendimento em loja passa a sair pelo número da Lojas
-- Maia (subconta GHL "Lojas MAIA"), não mais pelo do SAC -- pedido do Victor:
-- estava congestionando o SAC. Cada envio guarda a subconta, pra resposta ser
-- lida no mesmo lugar. Nulo = enviado pelo SAC (tudo antes desta data).
alter table venda_nps add column if not exists ghl_location_id text;
