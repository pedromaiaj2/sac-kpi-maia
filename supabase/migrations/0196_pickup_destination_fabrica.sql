-- Destino "Fábrica" -- pedido do Victor 22/10/2026: identificar quando um
-- produto recolhido (troca_produto/recolhimento_produto) é encaminhado
-- direto pra fábrica (ex.: reparo), em vez de ficar só em texto livre no
-- "Motivo". Mesmo enum de 0142 (estoque_cd/avaria_cd/loja), só acrescenta
-- essa 4ª opção -- ver PICKUP_DESTINATION_OPTIONS em assistenciaLabels.ts.
ALTER TABLE service_requests DROP CONSTRAINT service_requests_pickup_destination_check;
ALTER TABLE service_requests ADD CONSTRAINT service_requests_pickup_destination_check
  CHECK (pickup_destination IS NULL OR pickup_destination IN ('estoque_cd', 'avaria_cd', 'loja', 'fabrica'));
