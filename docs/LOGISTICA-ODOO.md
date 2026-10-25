# Logística do Odoo dentro deste sistema (branch `feat/logistica-odoo`)

Decisão do Pedro (25/10/2026): a **interface** de logística (roteirizador/expedição, montagem e gestão de carga, app do motorista) mora aqui, ao lado da troca/recolhimento e da PWA do motorista. O **motor** continua no Odoo (`maia_entrega` + `maia_caixa`: carga, paradas, NF-e 5117, estoque), exposto pela ponte HTTP da Lojas Maia (`/api/odoo`). Este sistema **não grava nada de logística no Supabase**: só desenha a tela e repassa os verbos do operador.

## Arquitetura

```
navegador (CD / motorista)
   │  Server Actions + 3 route handlers (PDF, foto)   ← nenhuma chave no client
   ▼
Next.js deste repo  ── src/lib/odoo/logistica.ts ── HTTPS + headers X-Maia-Perfil / X-Maia-Key ──►  ponte /api/odoo (Flask, VPS Lojas Maia)
   │                                                                                                      │ XML-RPC
   └─ foto do comprovante → PHOTO_STORAGE_DIR (mesmo disco das fotos dos chamados)                         ▼
                                                                                                 Odoo maia16: maia.cargas.api
```

| Peça | Arquivo |
|---|---|
| Cliente HTTP tipado (timeout, erro explícito, chave só no servidor) | `src/lib/odoo/logistica.ts` |
| Tipos, rótulos, funções puras (filtros, volumes, observação) | `src/lib/odoo/logisticaTipos.ts` (+ `.test.ts`) |
| Quem pode operar (PIN do CD / equipe; PIN do motorista) | `src/lib/odoo/logisticaAuth.ts` |
| De-para motorista daqui × `hr.employee` do Odoo | `src/lib/odoo/motoristaMap.ts` |
| Rota do motorista e trava "a carga é sua" | `src/lib/odoo/rotaMotorista.ts` |
| Actions do CD | `src/app/assistencia/logistica/logistica-actions.ts` |
| Telas do CD | `src/app/assistencia/logistica/(cd)/{expedicao,cargas,cargas/[id]}` |
| PDFs (romaneio, DANFE) | `src/app/assistencia/logistica/pdf/{romaneio/[id],danfe/[pedidoId]}/route.ts` |
| Actions do motorista | `src/app/assistencia/motorista/odoo/odoo-actions.ts` |
| Telas do motorista | `src/app/assistencia/motorista/odoo/{page.tsx,[cargaId]/[paradaId]}` + aba em `motorista/page.tsx` |
| Upload da foto do comprovante | `src/app/assistencia/motorista/odoo/foto/route.ts` |
| Componentes | `src/components/logisticaOdoo/*` |

**Por que sob `/assistencia` e não `/logistica`:** o `proxy.ts` deixa passar tudo que começa com `/assistencia` (cada tela confere a própria sessão) e manda o resto para o login do painel de KPIs (ou redireciona, no projeto `ASSISTENCIA_ONLY_PROJECT`). Assim não foi preciso abrir exceção nova no proxy. Pelo mesmo motivo os route handlers de PDF e foto moram sob `/assistencia/...` e não `/api/...`.

**Por que as actions devolvem `{ok, erro}` em vez de lançar:** em produção o Next troca a mensagem de erro lançado numa Server Action por texto genérico; o operador precisa ler o motivo real do Odoo ("liberar exige motorista + veículo", "carga já saiu"...).

## Verbos cobertos (objeto → verbo → botão → chamada)

| Objeto | Verbo do operador | Onde | Chamada na ponte |
|---|---|---|---|
| Entrega (saída) | enviar p/ pendência · voltar à fila · transferir filial · data programada · anotação · histórico | Expedição → "Ações…" | `POST /logistica/entrega/{id}/{pendencia\|fila\|transferir_filial\|programar\|anotar\|historico}` |
| Entrega na carga | remover da carga · estornar (concluída sem nota) · histórico · anotação · pendência | Carga aberta → "⋯" do pedido | `.../remover_da_carga`, `.../estornar` |
| Carga | montar (tipo, região, motorista, veículo, descrição, transportadora, data) | Expedição → seleção → "Montar carga" | `POST /logistica/carga` |
| Carga | separação → conferida → liberar → **sair (fatura as 5117)** → fim de rota | Carga aberta → botão principal | `POST /logistica/carga/{id}/{separacao\|conferir\|liberar\|sair\|finalizar}` |
| Carga | reordenar paradas | ▲▼ + "Salvar ordem" | `POST .../reordenar {parada_ids}` |
| Carga | saída prevista · descrição · transportadora · excluir · baixar entrega (manual) | Carga aberta | `POST .../extra/{programar\|descricao\|transportadora\|excluir\|baixar_entrega}` |
| Carga | romaneio PDF · DANFEs | Carga aberta | `POST .../extra/romaneio` (PDF), `.../extra/danfes` + `GET /pedido/{id}/danfe.pdf?doc=5117` |
| Motorista | rota do dia · saí para a rota · ligar/WhatsApp/mapa · entreguei · entrega parcial · não consegui (motivo + obs) · geo · foto · encerrar rota | `/assistencia/motorista/odoo` | `GET /logistica/cargas?estados=liberada,em_rota` + `carga/{id}`, `POST carga/{id}/sair`, `POST /logistica/parada/{id}`, `POST carga/{id}/finalizar` |

Filtros do Rafael na Expedição: **região** (zonas do Odoo + "sem região"), **modo** (entrega / retira depois = ABA/CD), **pendências** (visão própria), **retornos** (visão pronta; enche quando o Odoo mandar o campo, ver abaixo), busca por cliente/pedido/bairro/CEP/NF. **Volumes por categoria** (colchão/base/estofado/móvel/acessório) nos KPIs da fila, na seleção, no cartão e no cabeçalho da carga.

## Variáveis (só servidor) — ver `.env.example`

| Variável | Para quê |
|---|---|
| `ODOO_BRIDGE_URL` | `https://atendimento.lojasmaia.com.br/api/odoo` |
| `ODOO_KEY_LOGISTICA` / `ODOO_KEY_MOTORISTA` | chave da ponte por perfil (HMAC do `JWT_SECRET` da ponte, 16 hex). **Pedir ao Pedro**; nunca no client nem no git. Vai em header `X-Maia-Key`, não na URL. |
| `ODOO_BRIDGE_TIMEOUT_MS` | opcional (20 s; "sair" usa 120 s porque transmite NF-e) |
| `ODOO_COMPANY_ID_PADRAO` | empresa que a tela do CD abre (13 hoje no piloto; conferir) |
| `ODOO_COMPANY_IDS_MOTORISTA` | empresas onde procurar a carga do motorista |
| `ODOO_MOTORISTA_MAP` | de-para JSON enquanto a tabela não existe |
| `APP_PUBLIC_URL` | base absoluta do link da foto que vai para o Odoo |

Sem `ODOO_BRIDGE_URL`/chave, as telas mostram o erro ("chave do perfil … não configurada") — falha fechada, nada calado.

## De-para motorista

`drivers` (chave = nome, login PIN) × `hr.employee` do Odoo (id em `carga.motorista_id`). Resolução em `motoristaMap.ts`:
1. `ODOO_MOTORISTA_MAP` (env JSON) — explícito;
2. nome igual (sem acento/maiúscula) na lista `/logistica/catalogos` — **homônimo não casa** (melhor não mostrar rota do que mostrar a de outro).

Proposta de tabela (com CPF para desempate) em `docs/sql/proposta-odoo-motorista-map.sql` — **não aplicada** e fora de `supabase/migrations` de propósito. Quando existir, entra como passo 0.

Toda ação do motorista confere no servidor que `carga.motorista_id` é o dele (`exigirCargaDoMotorista`). Supervisores de expedição (`DISPATCH_SUPERVISOR_DRIVERS`) veem todas as cargas, sem botões.

## Como testar (sem tocar em produção)

1. `npm ci && npx tsc --noEmit && npx eslint src/lib/odoo src/components/logisticaOdoo src/app/assistencia/logistica src/app/assistencia/motorista/odoo && npx vitest run src/lib/odoo` (15 testes do cliente e das funções puras, fetch simulado).
2. Ponta a ponta: `.env.local` **de dev** com as 3 variáveis da ponte apontando para o **piloto** do Odoo (a ponte é do piloto, não do Protheus) + Supabase de dev/staging (nunca o de produção). `npm run dev`, entrar com PIN do CD, abrir `/assistencia/logistica`. Roteiro: fila → selecionar 2 saídas da mesma região → montar → separação → conferida → liberar sem motorista (**deve recusar**) → escolher motorista/veículo → liberar → (motorista) Saí para a rota (emite 5117) → parada 1 Entreguei com foto → parada 2 Não consegui sem motivo (**recusa**) → com motivo → Encerrar rota → (CD) histórico com geo/origem `app`.
3. Conferir na carga aberta: eventos com origem `app`, lat/lng e motivo; na observação da parada, o link `…/api/photos/odoo-entregas/carga-N/parada-M/….jpg` abre a foto.

## O que falta no Odoo/ponte (pendências)

| # | Falta | Efeito aqui |
|---|---|---|
| 1 | **Receber arquivo** (foto/assinatura do comprovante) em `POST /logistica/parada/{id}` — o evento tem os campos, a API não | hoje a foto fica no disco deste sistema e o **link vai na observação** (Odoo corta em 500 caracteres; priorizamos os links) |
| 2 | Campo `retorno` (saída que voltou de insucesso) e `tipo de saída` (baú/express/ABA) na expedição | visão "Retornos" vazia até vir; filtro ABA usa o `modo` |
| 3 | `pedido_id` dentro de `paradas[].pickings` | motorista não abre a DANFE (rota da DANFE fica só para o CD) |
| 4 | Filtro por motorista em `/logistica/cargas` (hoje filtra aqui, lendo todas da empresa) | ok com poucas cargas; ineficiente com 400/mês |
| 5 | `company_id` no detalhe da carga | de-para tenta cada empresa de `ODOO_COMPANY_IDS_MOTORISTA` |
| 6 | Motoristas como `hr.employee` com cargo "Motorista" (hoje 1; sem cargo o catálogo devolve os 50 primeiros funcionários) | casamento por nome pode falhar → usar `ODOO_MOTORISTA_MAP` |
| 7 | Insucesso → retorno ao estoque/reagendamento automático; baixa por item/volume; CPF/nome do recebedor; evento SEFAZ de entrega/insucesso | não há botão para o que o motor não faz |
| 8 | Idempotência da baixa (UUID do evento) | duplo toque em rede ruim pode tentar 2×; a 2ª é recusada ("parada já registrada"), mas sem UUID |

## Fora do escopo desta branch
Deploy, `.env` de qualquer instância, banco Supabase do Victor, migrações. Nada foi aplicado em servidor.
