#!/bin/sh
# Testes de banco dos vouchers (0170_vouchers.sql), inclusive baixa
# concorrente. Cria um banco DESCARTÁVEL (voucher_teste) no mesmo servidor,
# aplica a migração com tabelas mínimas de profiles/stores, roda os testes e
# apaga o banco no fim -- não toca no banco de produção (postgres).
#
# Na VPS, da raiz do repositório:
#   PSQL="docker exec -i supabase-db psql -U postgres" sh supabase/tests/vouchers_test.sh
set -eu
PSQL=${PSQL:-psql}
DB=voucher_teste
DIR=$(dirname "$0")

limpar() { $PSQL -d postgres -q -c "drop database if exists $DB with (force)" >/dev/null; }
trap limpar EXIT
limpar
$PSQL -d postgres -q -c "create database $DB"
$PSQL -d $DB -q -v ON_ERROR_STOP=1 -c "create table profiles (id uuid primary key); create table stores (id text primary key, name text);"
$PSQL -d $DB -q -v ON_ERROR_STOP=1 < "$DIR/../migrations/0170_vouchers.sql"

echo "== testes funcionais"
$PSQL -d $DB -q -v ON_ERROR_STOP=1 -At < "$DIR/vouchers_test.sql" | tail -1

echo "== concorrência: 20 caixas dando baixa no mesmo voucher ao mesmo tempo"
$PSQL -d $DB -q -v ON_ERROR_STOP=1 -c "
  insert into vouchers (codigo, cliente_nome, cliente_cpf, tipo_beneficio, motivo, data_validade, emitido_por_id, emitido_por_nome)
  values ('MAIA-HHHH-2222', 'Maria', '12345678909', 'frete_gratis', 'outro', voucher_hoje() + 30,
          '00000000-0000-0000-0000-0000000000a1', 'Victor');"
TMP=$(mktemp -d)
i=1
while [ $i -le 20 ]; do
  $PSQL -d $DB -At -c "select voucher_baixar('MAIA-HHHH-2222', '123', 'CUPOM-$i', 'Caixa $i', '03')->>'resultado'" > "$TMP/$i" 2>&1 &
  i=$((i + 1))
done
wait
ok=$(cat "$TMP"/* | grep -c '^ok$' || true)
usado=$(cat "$TMP"/* | grep -c '^usado$' || true)
rm -rf "$TMP"
echo "ok=$ok usado=$usado"
[ "$ok" = 1 ] && [ "$usado" = 19 ] || { echo "FALHOU: esperado 1 ok e 19 usado"; exit 1; }

echo "== concorrência: 2ª baixa espera a 1ª transação e recebe 'usado'"
$PSQL -d $DB -q -v ON_ERROR_STOP=1 -c "
  insert into vouchers (codigo, cliente_nome, cliente_cpf, tipo_beneficio, motivo, data_validade, emitido_por_id, emitido_por_nome)
  values ('MAIA-JJJJ-2222', 'Maria', '98765432100', 'frete_gratis', 'outro', voucher_hoje() + 30,
          '00000000-0000-0000-0000-0000000000a1', 'Victor');"
A=$(mktemp)
$PSQL -d $DB -At -c "begin; select voucher_baixar('MAIA-JJJJ-2222', '987', 'A', 'Ana', '03')->>'resultado'; select pg_sleep(2); commit;" > "$A" &
sleep 0.5
B=$($PSQL -d $DB -At -c "select voucher_baixar('MAIA-JJJJ-2222', '987', 'B', 'Bia', '07')->>'resultado'")
wait
echo "A=$(grep -E '^(ok|usado)$' "$A") B=$B"
grep -q '^ok$' "$A" && [ "$B" = usado ] || { echo "FALHOU: esperado A=ok e B=usado"; rm -f "$A"; exit 1; }
rm -f "$A"
$PSQL -d $DB -At -c "select 'loja da baixa: ' || loja_uso || ', cupom ' || cupom_uso from vouchers where codigo = 'MAIA-JJJJ-2222'"

echo "OK: todos os testes de banco dos vouchers passaram"
