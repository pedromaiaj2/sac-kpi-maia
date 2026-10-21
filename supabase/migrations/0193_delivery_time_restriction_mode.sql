-- Restrição de horário de ENTREGA, estruturada -- pedido do Victor
-- 21/10/2026: antes era um texto livre opcional (client_time_restriction,
-- 0093), agora precisa ser obrigatório com 3 opções mutuamente exclusivas:
-- sem restrição, restrição de TURNO (reaproveita a coluna `shift` já
-- existente -- a aba Entregas parou de mostrar o seletor de Turno genérico
-- do Agendamento, então essa coluna fica livre pra esse uso ali) ou
-- restrição de HORA específica (novo intervalo `time_restriction_from`/`to`).
--
-- `client_time_restriction` (0093) continua existindo e sendo preenchido
-- automaticamente (texto derivado das 2 colunas novas) -- várias telas já
-- leem esse texto pra exibir (DespachoCard, DriverRouteGroup, notificações
-- de motorista/técnico etc.) e não precisam saber da estrutura nova.

alter table service_requests
  add column if not exists time_restriction_mode text
    check (time_restriction_mode is null or time_restriction_mode in ('sem_restricao', 'turno', 'hora')),
  add column if not exists time_restriction_from time,
  add column if not exists time_restriction_to time;
