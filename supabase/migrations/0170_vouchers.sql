-- Vouchers de recuperação de clientes (detratores de NPS e clientes que
-- pediram estorno) -- pedido do Victor 14/10/2026. O admin emite (login
-- individual de equipe, papel admin) e manda a imagem pelo WhatsApp; o
-- caixa da loja (login de caixa por PIN) consulta e dá baixa. A imagem pode
-- ser copiada à vontade: a segurança é o código valer uma vez só, só para o
-- titular, conferido aqui no banco.
--
-- Sem policy nenhuma: o CPF fica completo na tabela, então nem o papel
-- authenticated lê. Todo acesso passa pelo servidor (service role), que
-- confere o papel/sessão antes.

create table vouchers (
  id uuid primary key default gen_random_uuid(),
  -- MAIA-XXXX-XXXX: 8 caracteres de um alfabeto de 31 (sem 0/O, 1/I/L)
  codigo text not null unique check (codigo ~ '^MAIA-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$'),
  cliente_nome text not null check (length(trim(cliente_nome)) > 0),
  cliente_cpf text not null check (cliente_cpf ~ '^[0-9]{11}$'),
  cliente_telefone text,
  tipo_beneficio text not null check (tipo_beneficio in ('percentual_desconto', 'valor_desconto', 'frete_gratis', 'brinde')),
  valor_beneficio numeric(12, 2) check (valor_beneficio is null or valor_beneficio > 0),
  descricao_beneficio text,
  valor_minimo_compra numeric(12, 2) check (valor_minimo_compra is null or valor_minimo_compra > 0),
  motivo text not null check (motivo in ('atraso_entrega', 'defeito_assistencia', 'outro')),
  observacao text,
  pedido_origem text,
  -- de onde o caso veio, quando a emissão partiu de um atalho (estorno do
  -- painel, solicitação de estorno da loja, detrator de NPS)
  origem text not null default 'manual' check (origem in ('manual', 'estorno', 'estorno_request', 'nps')),
  origem_id text,
  data_emissao timestamptz not null default now(),
  data_validade date not null,
  status text not null default 'ativo' check (status in ('ativo', 'usado', 'expirado', 'cancelado')),
  emitido_por_id uuid not null references profiles (id),
  emitido_por_nome text not null,
  usado_em timestamptz,
  usado_por text,
  loja_uso text references stores (id),
  cupom_uso text,
  cancelado_em timestamptz,
  cancelado_por_id uuid references profiles (id),
  cancelado_por_nome text,
  motivo_cancelamento text,
  check (tipo_beneficio not in ('percentual_desconto', 'valor_desconto') or valor_beneficio is not null),
  check (tipo_beneficio <> 'percentual_desconto' or valor_beneficio <= 100),
  check (tipo_beneficio <> 'brinde' or length(trim(coalesce(descricao_beneficio, ''))) > 0),
  check (status <> 'usado' or (usado_em is not null and usado_por is not null and loja_uso is not null and cupom_uso is not null)),
  check (status <> 'cancelado' or (cancelado_em is not null and cancelado_por_nome is not null
                                   and length(trim(coalesce(motivo_cancelamento, ''))) > 0))
);

-- No máximo 1 voucher ativo por CPF. Vencido ainda marcado como ativo
-- bloquearia o cliente: o servidor roda vouchers_expirar() antes de emitir.
create unique index vouchers_um_ativo_por_cpf on vouchers (cliente_cpf) where status = 'ativo';
create index vouchers_status_idx on vouchers (status, data_validade);
create index vouchers_emissao_idx on vouchers (data_emissao desc);

-- Auditoria: toda emissão, consulta, tentativa de baixa (inclusive as
-- negadas), cancelamento e expiração. Também é a base do limite de
-- consultas por caixa.
create table voucher_eventos (
  id bigint generated always as identity primary key,
  voucher_id uuid references vouchers (id),
  codigo_consultado text,
  acao text not null check (acao in ('emissao', 'consulta', 'baixa', 'cancelamento', 'expiracao', 'correcao_banco')),
  resultado text not null,
  ator_tipo text not null check (ator_tipo in ('admin', 'caixa', 'sistema', 'banco')),
  ator_nome text not null,
  ator_id text,
  loja_id text,
  detalhe text,
  criado_em timestamptz not null default now()
);

create index voucher_eventos_voucher_idx on voucher_eventos (voucher_id, criado_em);
create index voucher_eventos_ator_idx on voucher_eventos (ator_tipo, ator_nome, criado_em);

alter table vouchers enable row level security;
alter table voucher_eventos enable row level security;

grant select, insert, update, delete on vouchers to service_role;
grant select, insert, update, delete on voucher_eventos to service_role;
revoke all on vouchers from anon, authenticated;
revoke all on voucher_eventos from anon, authenticated;

-- "Hoje" das lojas (Recife); a VPS e o banco estão em UTC.
create or replace function voucher_hoje() returns date
language sql stable as $$ select (now() at time zone 'America/Recife')::date $$;

-- Usado e cancelado são definitivos: a interface nunca volta esses status.
-- Correção só pelo banco, de propósito e registrada:
--   set local vouchers.correcao = 'motivo da correção';
--   update vouchers set ... where id = ...;
create or replace function vouchers_protege_status() returns trigger
language plpgsql as $$
declare
  v_correcao text := nullif(current_setting('vouchers.correcao', true), '');
begin
  if old.status in ('usado', 'cancelado') and (new.status is distinct from old.status
       or new.usado_em is distinct from old.usado_em or new.loja_uso is distinct from old.loja_uso
       or new.cancelado_em is distinct from old.cancelado_em) then
    if v_correcao is null then
      raise exception 'Voucher % está %: status definitivo (correção só pelo banco, com vouchers.correcao)', old.codigo, old.status;
    end if;
    insert into voucher_eventos (voucher_id, codigo_consultado, acao, resultado, ator_tipo, ator_nome, detalhe)
    values (old.id, old.codigo, 'correcao_banco', old.status || ' -> ' || new.status, 'banco', current_user, v_correcao);
  end if;
  if old.status = 'expirado' and new.status = 'ativo' and v_correcao is null then
    raise exception 'Voucher % expirou: reativar só pelo banco, com vouchers.correcao', old.codigo;
  end if;
  if new.codigo is distinct from old.codigo or new.cliente_cpf is distinct from old.cliente_cpf then
    raise exception 'Código e CPF do voucher não mudam depois da emissão';
  end if;
  return new;
end $$;

create trigger vouchers_protege_status before update on vouchers
for each row execute function vouchers_protege_status();

create or replace function vouchers_impede_delete() returns trigger
language plpgsql as $$
begin
  if nullif(current_setting('vouchers.correcao', true), '') is null then
    raise exception 'Voucher não se apaga: cancele pela tela (ou corrija pelo banco, com vouchers.correcao)';
  end if;
  return old;
end $$;

create trigger vouchers_impede_delete before delete on vouchers
for each row execute function vouchers_impede_delete();

-- Marca como expirado o que venceu (rodado pelo cron e antes de cada
-- emissão). A baixa não depende disso: ela mesma recusa vencido.
create or replace function vouchers_expirar() returns integer
language plpgsql as $$
declare
  v_n integer;
begin
  with expirados as (
    update vouchers set status = 'expirado'
     where status = 'ativo' and data_validade < voucher_hoje()
    returning id, codigo
  )
  insert into voucher_eventos (voucher_id, codigo_consultado, acao, resultado, ator_tipo, ator_nome)
  select id, codigo, 'expiracao', 'ok', 'sistema', 'rotina' from expirados;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Baixa atômica: um UPDATE condicional só pega voucher ativo, dentro da
-- validade e com os 3 primeiros dígitos do CPF certos (a máscara do
-- voucher esconde exatamente esses). Com dois caixas ao mesmo tempo, o
-- segundo UPDATE espera o lock da linha, reavalia o WHERE com o status já
-- 'usado' e não pega nada -- cai em 'usado'. O evento é gravado na mesma
-- transação, com o resultado que for.
create or replace function voucher_baixar(p_codigo text, p_cpf3 text, p_cupom text, p_caixa text, p_loja text)
returns jsonb
language plpgsql as $$
declare
  v_id uuid;
  v record;
  v_resultado text;
  v_erros_cpf integer;
begin
  if coalesce(trim(p_cupom), '') = '' then
    raise exception 'Informe o cupom fiscal ou pedido da venda';
  end if;

  select count(*) into v_erros_cpf
    from voucher_eventos e join vouchers x on x.id = e.voucher_id
   where x.codigo = p_codigo and e.acao = 'baixa' and e.resultado = 'cpf_nao_confere'
     and e.criado_em > now() - interval '24 hours';

  if v_erros_cpf < 5 then
    update vouchers
       set status = 'usado', usado_em = now(), usado_por = p_caixa, loja_uso = p_loja, cupom_uso = trim(p_cupom)
     where codigo = p_codigo and status = 'ativo' and data_validade >= voucher_hoje()
       and left(cliente_cpf, 3) = p_cpf3
    returning id into v_id;
  end if;

  if v_id is not null then
    v_resultado := 'ok';
  else
    select * into v from vouchers where codigo = p_codigo;
    v_resultado := case
      when v.id is null then 'inexistente'
      when v.status = 'usado' then 'usado'
      when v.status = 'cancelado' then 'cancelado'
      when v.status = 'expirado' or v.data_validade < voucher_hoje() then 'expirado'
      when v_erros_cpf >= 5 then 'bloqueado'
      else 'cpf_nao_confere' end;
    v_id := v.id;
  end if;

  insert into voucher_eventos (voucher_id, codigo_consultado, acao, resultado, ator_tipo, ator_nome, loja_id, detalhe)
  values (v_id, p_codigo, 'baixa', v_resultado, 'caixa', p_caixa, p_loja,
          case when v_resultado = 'ok' then 'cupom ' || trim(p_cupom) end);

  return jsonb_build_object('resultado', v_resultado, 'voucherId', v_id);
end $$;

revoke all on function voucher_baixar(text, text, text, text, text) from public, anon, authenticated;
revoke all on function vouchers_expirar() from public, anon, authenticated;
grant execute on function voucher_baixar(text, text, text, text, text) to service_role;
grant execute on function vouchers_expirar() to service_role;

notify pgrst, 'reload schema';
