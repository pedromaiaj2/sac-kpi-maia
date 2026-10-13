-- (13/10/2026) Motorista 000058 (em treinamento) volta para os KPIs; TPA9E78 confirmada como Strada.
-- Original em lojas-maia-integracao/apis/logistica-v1/sql/0166_motorista_treinamento.sql.

-- (13/10/2026) O motorista 000058 (LOJAS MAIA TREINAMENTO) volta para os
-- KPIs. Aplicada no Supabase self-hosted em 13/10/2026. Vai para o
-- sac-kpi-maia como supabase/migrations/0166_motorista_treinamento.sql.
--
-- A 0157 tirava o 000058 de tudo como "conta de teste" (decisão de 07/10).
-- O Victor confirmou em 13/10 que no Protheus é o código do motorista em
-- treinamento: as entregas são reais (177 das 2.551 visitas de 30 dias, quase
-- todas entregues, em cargas da frota própria) e somem dos números se ficarem
-- fora. A base v_cargas_producao passa a trazer todas as cargas; todas as
-- views, a RPC da tela (kpis_entregas) e a da API (kpis_logistica) herdam.

create or replace view v_cargas_producao with (security_invoker = true) as
select * from totvs_delivery_cargas;

-- A placa TPA9E78 já era Carro (Strada) pelo perfil das cargas (0158); o
-- Victor confirmou em 13/10 que é Strada. Só a observação muda.
update veiculos_logistica
   set observacao = 'Sem motorista fixo; Strada confirmada pelo Victor em 13/10/2026', atualizado_em = now()
 where placa = 'TPA9E78';
