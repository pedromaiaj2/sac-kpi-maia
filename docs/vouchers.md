# Vouchers de recuperação de clientes

Presente mandado pelo WhatsApp (imagem) para detratores de NPS e clientes que pediram estorno. O cliente apresenta o voucher na loja. A imagem pode ser copiada à vontade: o código vale **uma vez só**, só para o **titular**, e quem decide é o banco.

## Quem faz o quê

| Perfil | Login | Pode |
|---|---|---|
| **Admin** | Login de equipe (assistencia.lojasmaia.com.br), papel `admin` | Emitir, listar, buscar, ver histórico, cancelar, baixar a imagem |
| **Caixa** | Login de caixa (nome + PIN) que já existe nas encomendas | Consultar um código e dar baixa. Não emite, não cancela, não lista e não vê CPF completo nem telefone |
| Quem tem a senha do painel | Aba **Clientes → Vouchers** (sac.lojasmaia.com.br) | Só o painel de números, sem dado de cliente |

Toda permissão é conferida no servidor, a cada ação (`src/app/assistencia/vouchers-actions.ts`).

## Admin

1. Abra **Vouchers** no topo da área de equipe (`/assistencia/vouchers`), ou use um atalho **🎟 Emitir voucher**:
   - na linha de um estorno (Clientes → Estornos);
   - na linha de um detrator (Avaliações).

   O atalho já preenche o cliente e o motivo. A URL leva só o id do caso, nunca CPF ou telefone.
2. Preencha o CPF. O nome e o telefone vêm do cadastro do Protheus quando existem.
3. Escolha:
   - o benefício (desconto em %, desconto em R$, frete grátis ou brinde);
   - a compra mínima, que é opcional;
   - a validade (padrão de 30 dias);
   - o motivo.
4. **Emitir voucher**. Na tela do voucher:
   - **Baixar imagem** gera o PNG de 1080×1350;
   - **Copiar mensagem do WhatsApp** copia o texto pronto;
   - **Abrir conversa** abre o WhatsApp do cliente. Lá, cole a mensagem e anexe a imagem.
5. Cada CPF pode ter **no máximo 1 voucher ativo**. Para mandar outro, cancele o atual (o motivo é obrigatório).

**Usado e cancelado são definitivos.** Corrigir só pelo banco, de propósito, e a correção fica registrada:

```sql
begin;
set local vouchers.correcao = 'motivo da correção';
update vouchers set ... where codigo = 'MAIA-XXXX-XXXX';
commit;
```

## Caixa

1. Entre com o seu login de caixa e toque em **Validar voucher**.
2. Digite o código (com ou sem `MAIA-` e hífens) ou toque em **Ler o QR pela câmera**. A câmera funciona no celular e na webcam, só em `https://`.
3. **Verde = VÁLIDO.** Peça o documento com foto e digite:
   - os **3 primeiros dígitos do CPF** do documento (são os que o voucher esconde);
   - o nº do **cupom fiscal ou do pedido**.

   Depois toque em **Dar baixa**.
4. **Vermelho = não pode ser usado.** A mensagem diz o motivo: código inexistente, já utilizado (com data, hora e loja), vencido ou cancelado.

## Segurança

- **Código** no formato `MAIA-XXXX-XXXX`:
  - 8 caracteres de um alfabeto de 31, sem `0 O 1 I L`;
  - gerados com `crypto.randomInt`;
  - únicos no banco.
- **Baixa atômica** (`voucher_baixar`):
  - um único `UPDATE … WHERE status = 'ativo' AND data_validade >= hoje AND CPF confere`;
  - com dois caixas ao mesmo tempo, só um consegue;
  - vencido não baixa, mesmo antes da rotina marcar como expirado.
- **Expiração automática:** o cron do sync (a cada 30 min) chama `vouchers_expirar()`.
- **Limite de tentativas:**
  - por caixa: 10 códigos inexistentes ou 60 consultas em 15 min bloqueiam;
  - por voucher: 5 CPFs errados em 24 h bloqueiam a baixa.
- **LGPD:**
  - o CPF aparece mascarado (`***.456.789-**`) na imagem e na tela do caixa;
  - o QR leva só o código;
  - a tabela não tem leitura para `anon`/`authenticated`.
- **Auditoria:** a tabela `voucher_eventos` registra toda emissão, consulta, tentativa de baixa (inclusive as negadas), cancelamento, expiração e correção no banco, com quem, loja, data e hora e resultado. O histórico aparece na tela do voucher.

## Trocar logo e cores da imagem

Tudo em `src/lib/voucherVisual.ts`:
- **`logoArquivo`:** caminho da logo (PNG ou JPG, a partir da raiz do projeto; hoje é `public/logo.png`).
- **`cores`:**
  - fundo (verde);
  - destaque do benefício (laranja);
  - cartão;
  - textos.
- **Fontes:** `assets/voucher/` (Geist, licença OFL).

Os textos (saudação, regras e mensagem do WhatsApp) ficam em `src/lib/vouchersCore.ts` (`REGRAS_VOUCHER`, `mensagemWhatsapp`).

## Testes

- **`npm test`:**
  - regras puras: código, máscara, validação e mensagens (`src/lib/vouchersCore.test.ts`);
  - permissões: o caixa e a equipe sem papel admin são barrados nas ações de admin, e quem não tem sessão de caixa é barrado nas do caixa (`src/app/assistencia/vouchers-actions.test.ts`).
- **No banco**, num banco descartável que o script cria e apaga:

  ```sh
  PSQL="docker exec -i supabase-db psql -U postgres" sh supabase/tests/vouchers_test.sh
  ```

  Cobre:
  - emissão e 1 ativo por CPF;
  - baixa válida e duplicada;
  - **20 baixas simultâneas** (só 1 passa);
  - expirado, cancelado, CPF que não confere e bloqueio;
  - irreversibilidade, auditoria e permissões das tabelas.
