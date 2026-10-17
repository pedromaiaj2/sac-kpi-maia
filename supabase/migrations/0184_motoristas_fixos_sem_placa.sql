-- (17/10/2026) Cargas próprias sem placa no Protheus (veículo "AIAM",
-- "FRETIST", "FORD") caíam em "Não identificado" na grade de veículos da
-- logística (265 notas em 30 dias). O Victor informou o veículo de cada
-- motorista: todos dirigem caminhão, menos o Douglas (Strada); o Ronaldo é
-- terceirizado e também de caminhão.
--
-- v_cargas_logistica já usa veiculos_logistica.motorista_codigo quando a carga
-- não tem placa (motorista fixo de um veículo, 0169). Como placa é a chave da
-- tabela, quem não tem placa cadastrada entra com "SEM PLACA <código>" -- valor
-- que nunca bate com o campo veículo do Protheus, então só vale pelo motorista.

insert into veiculos_logistica (placa, tipo_veiculo, motorista_codigo, observacao) values
  ('SEM PLACA 000058', 'Caminhão', '000058', 'LOJAS MAIA TREINAMENTO: caminhão, informado pelo Victor em 17/10/2026'),
  ('SEM PLACA 000016', 'Caminhão', '000016', 'MILTON (AIAM EXPRESSO): caminhão, informado pelo Victor em 17/10/2026'),
  ('SEM PLACA 000057', 'Caminhão', '000057', 'ISAAC DOS SANTOS: caminhão, informado pelo Victor em 17/10/2026'),
  ('SEM PLACA 000013', 'Caminhão', '000013', 'FLAVIO: caminhão, informado pelo Victor em 17/10/2026'),
  ('SEM PLACA 000040', 'Caminhão', '000040', 'EDILSON JUNIOR: caminhão, informado pelo Victor em 17/10/2026'),
  ('SEM PLACA 000050', 'Caminhão', '000050', 'EVANDRO FERREIRA SOARES JUNIOR: caminhão, informado pelo Victor em 17/10/2026'),
  ('SEM PLACA 000003', 'Caminhão', '000003', 'RONALDO ALVES PEREIRA (terceirizado): caminhão, informado pelo Victor em 17/10/2026'),
  ('SEM PLACA 000060', 'Carro', '000060', 'DOUGLAS: Strada, informado pelo Victor em 17/10/2026')
on conflict (placa) do update
  set tipo_veiculo = excluded.tipo_veiculo, motorista_codigo = excluded.motorista_codigo,
      observacao = excluded.observacao, atualizado_em = now();
