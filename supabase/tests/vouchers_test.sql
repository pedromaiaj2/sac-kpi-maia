-- Testes da migração 0170_vouchers.sql. Rodar num banco DESCARTÁVEL (ver
-- vouchers_test.sh, que cria o banco, aplica a migração, testa e apaga):
-- grava e apaga dados. Qualquer falha aborta com "FALHOU: ...".
\set ON_ERROR_STOP 1

insert into profiles (id) values ('00000000-0000-0000-0000-0000000000a1');
insert into stores (id, name) values ('03', 'Loja Teste 03'), ('07', 'Loja Teste 07');

create or replace function pg_temp.esperar(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FALHOU: %', msg; end if;
end $$;

create or replace function pg_temp.novo(p_codigo text, p_cpf text, p_validade date) returns uuid language sql as $$
  insert into vouchers (codigo, cliente_nome, cliente_cpf, tipo_beneficio, valor_beneficio, motivo, data_validade, emitido_por_id, emitido_por_nome)
  values (p_codigo, 'Maria da Silva', p_cpf, 'percentual_desconto', 10, 'atraso_entrega', p_validade,
          '00000000-0000-0000-0000-0000000000a1', 'Victor')
  returning id
$$;

-- emissão
select pg_temp.novo('MAIA-AAAA-2222', '52998224725', voucher_hoje() + 30);

-- 1 ativo por CPF
do $$
begin
  perform pg_temp.novo('MAIA-AAAA-3333', '52998224725', voucher_hoje() + 30);
  raise exception 'FALHOU: aceitou 2 vouchers ativos pro mesmo CPF';
exception when unique_violation then null;
end $$;

-- código com caractere ambíguo
do $$
begin
  perform pg_temp.novo('MAIA-0OIL-2222', '11144477735', voucher_hoje() + 30);
  raise exception 'FALHOU: aceitou código com caractere ambíguo';
exception when check_violation then null;
end $$;

-- baixa válida
select pg_temp.esperar((voucher_baixar('MAIA-AAAA-2222', '529', 'CUPOM-1', 'Ana', '03')->>'resultado') = 'ok', 'baixa válida');
select pg_temp.esperar((select status = 'usado' and loja_uso = '03' and usado_por = 'Ana' and cupom_uso = 'CUPOM-1' from vouchers where codigo = 'MAIA-AAAA-2222'),
                       'baixa grava caixa, loja e cupom');

-- baixa duplicada (outro caixa, outra loja)
select pg_temp.esperar((voucher_baixar('MAIA-AAAA-2222', '529', 'CUPOM-2', 'Bia', '07')->>'resultado') = 'usado', 'baixa duplicada recusada');
select pg_temp.esperar((select loja_uso = '03' and cupom_uso = 'CUPOM-1' from vouchers where codigo = 'MAIA-AAAA-2222'), 'duplicada não muda a baixa original');

-- usado libera o CPF pra um voucher novo
select pg_temp.novo('MAIA-BBBB-2222', '52998224725', voucher_hoje() + 30);

-- CPF não confere, e bloqueio depois de 5 erros
select pg_temp.novo('MAIA-CCCC-2222', '11144477735', voucher_hoje() + 30);
select pg_temp.esperar((voucher_baixar('MAIA-CCCC-2222', '999', 'X', 'Ana', '03')->>'resultado') = 'cpf_nao_confere', 'CPF não confere');
select voucher_baixar('MAIA-CCCC-2222', '999', 'X', 'Ana', '03') from generate_series(1, 4);
select pg_temp.esperar((voucher_baixar('MAIA-CCCC-2222', '111', 'X', 'Ana', '03')->>'resultado') = 'bloqueado', 'bloqueia após 5 CPFs errados');
select pg_temp.esperar((select status = 'ativo' from vouchers where codigo = 'MAIA-CCCC-2222'), 'bloqueado continua ativo');

-- expirado: vencido ainda marcado como ativo não baixa
select pg_temp.novo('MAIA-DDDD-2222', '39053344705', voucher_hoje() - 1);
select pg_temp.esperar((voucher_baixar('MAIA-DDDD-2222', '390', 'X', 'Ana', '03')->>'resultado') = 'expirado', 'vencido não baixa');
select pg_temp.esperar(vouchers_expirar() >= 1, 'rotina marca vencidos');
select pg_temp.esperar((select status = 'expirado' from vouchers where codigo = 'MAIA-DDDD-2222'), 'status expirado gravado');
do $$
begin
  update vouchers set status = 'ativo' where codigo = 'MAIA-DDDD-2222';
  raise exception 'FALHOU: reativou expirado';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
end $$;

-- validade = hoje ainda vale
select pg_temp.novo('MAIA-EEEE-2222', '86288366757', voucher_hoje());
select pg_temp.esperar((voucher_baixar('MAIA-EEEE-2222', '862', 'X', 'Ana', '03')->>'resultado') = 'ok', 'vale até o último dia');

-- cancelado
select pg_temp.novo('MAIA-FFFF-2222', '71428793860', voucher_hoje() + 30);
update vouchers set status = 'cancelado', cancelado_em = now(), cancelado_por_nome = 'Victor', motivo_cancelamento = 'teste'
 where codigo = 'MAIA-FFFF-2222';
select pg_temp.esperar((voucher_baixar('MAIA-FFFF-2222', '714', 'X', 'Ana', '03')->>'resultado') = 'cancelado', 'cancelado não baixa');

-- cancelamento sem motivo
do $$
begin
  perform pg_temp.novo('MAIA-GGGG-2222', '15350946056', voucher_hoje() + 30);
  update vouchers set status = 'cancelado', cancelado_em = now(), cancelado_por_nome = 'Victor' where codigo = 'MAIA-GGGG-2222';
  raise exception 'FALHOU: cancelou sem motivo';
exception when check_violation then null;
end $$;

-- inexistente
select pg_temp.esperar((voucher_baixar('MAIA-ZZZZ-9999', '123', 'X', 'Ana', '03')->>'resultado') = 'inexistente', 'código inexistente');

-- usado e cancelado são definitivos; voucher não se apaga
do $$
begin
  update vouchers set status = 'ativo' where codigo = 'MAIA-AAAA-2222';
  raise exception 'FALHOU: voltou usado para ativo';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
end $$;
do $$
begin
  update vouchers set status = 'ativo' where codigo = 'MAIA-FFFF-2222';
  raise exception 'FALHOU: voltou cancelado para ativo';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
end $$;
do $$
begin
  delete from vouchers where codigo = 'MAIA-AAAA-2222';
  raise exception 'FALHOU: apagou voucher';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
end $$;

-- correção pelo banco: só com vouchers.correcao, e fica registrada
begin;
set local vouchers.correcao = 'teste de correção';
update vouchers set status = 'cancelado', cancelado_em = now(), cancelado_por_nome = 'banco', motivo_cancelamento = 'correção'
 where codigo = 'MAIA-AAAA-2222';
commit;
select pg_temp.esperar((select count(*) = 1 from voucher_eventos where acao = 'correcao_banco' and detalhe = 'teste de correção'), 'correção registrada');

-- auditoria: toda tentativa de baixa vira evento, inclusive as negadas
select pg_temp.esperar((select count(*) >= 12 from voucher_eventos where acao = 'baixa'), 'baixas auditadas');
select pg_temp.esperar((select count(*) from voucher_eventos where acao = 'baixa' and resultado <> 'ok') >= 10, 'baixas negadas auditadas');
select pg_temp.esperar((select count(*) >= 1 from voucher_eventos where acao = 'expiracao'), 'expiração auditada');

-- anon/authenticated não leem a tabela (CPF completo) nem chamam a baixa
select pg_temp.esperar(not has_table_privilege('authenticated', 'vouchers', 'select'), 'authenticated não lê vouchers');
select pg_temp.esperar(not has_table_privilege('anon', 'vouchers', 'select'), 'anon não lê vouchers');
select pg_temp.esperar(not has_function_privilege('anon', 'voucher_baixar(text,text,text,text,text)', 'execute'), 'anon não executa baixa');
select pg_temp.esperar(not has_function_privilege('authenticated', 'voucher_baixar(text,text,text,text,text)', 'execute'), 'authenticated não executa baixa');

select 'OK: testes de vouchers passaram' as resultado;
