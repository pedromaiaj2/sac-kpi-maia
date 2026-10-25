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
| Upload da foto do comprovante | `src/app/assistencia/motorista/odoo/foto/route.ts` (chamado pela fila da PWA na hora de enviar a baixa) |
| Baixa por POST (fila offline / service worker) | `src/app/assistencia/motorista/odoo/baixa/route.ts` → `src/lib/odoo/baixaParada.ts` |
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

1. `npm ci && npx tsc --noEmit && npx eslint src/lib/odoo src/lib/pwa src/components/pwa src/components/logisticaOdoo src/app/assistencia/logistica src/app/assistencia/motorista/odoo public/assistencia/sw.js && npx vitest run src/lib/odoo src/lib/pwa` (cliente da ponte, funções puras, baixa/idempotência e regras da fila offline; fetch simulado).
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
| 8 | **Idempotência da baixa por `evento_uid`** — o app já manda `evento_uid` (UUID v4 gerado no toque) em `POST /logistica/parada/{id}`, mas a ponte **ignora** o campo (lê só `resultado, motivo, geo_lat, geo_lng, origem, motorista_id, obs`). Falta: gravar o uid no evento da parada e, se chegar de novo, devolver o mesmo resultado sem registrar outra vez | hoje a dedup é só deste lado (ver seção PWA): Web Lock no celular + memória do processo + recusa "parada já registrada". Reenvio em outra instância/processo cai na recusa, não no Odoo |
| 9 | Hora real da baixa (`registrado_em`) como campo | baixa feita offline chega depois; a hora do toque vai no começo da observação (`[baixa offline 25/10 14:32]`) |

## PWA "Maia Entregas" (app instalável + fila offline)

Pedido do Pedro (25/10/2026): o sistema "tem que virar PWA", com foco no app do motorista e nas telas do CD. Sem dependência nova (service worker escrito à mão).

| Peça | Arquivo |
|---|---|
| Manifest (nome, `start_url` = app do motorista, escopo `/assistencia/`, ícones 192/512 + maskable) | `public/assistencia/manifest.webmanifest` |
| Ícones (gerados do `public/logo.png`, fundo branco) | `public/assistencia/pwa/*.png` |
| Link do manifest, `apple-touch-icon`, `apple-mobile-web-app-capable`, `theme-color` | `src/app/assistencia/layout.tsx` (só a área `/assistencia`; o painel de KPIs não vira app) |
| Service worker | `public/assistencia/sw.js` |
| Registro do SW, aviso "Nova versão disponível", indicador "N baixas aguardando envio" | `src/components/pwa/PwaShell.tsx` |
| Fila offline (IndexedDB) e envio | `src/lib/pwa/filaBaixas.ts` + regras puras `filaBaixasRegras.ts` (+ `.test.ts`) |
| Rota da baixa por POST (usada pela fila e pelo SW) | `src/app/assistencia/motorista/odoo/baixa/route.ts` → `src/lib/odoo/baixaParada.ts` |
| Página sem conexão | `src/app/assistencia/offline/page.tsx` |

**Por que em `public/assistencia/` e não na raiz:** o escopo máximo de um service worker é a pasta onde ele está; em `/assistencia/sw.js` o escopo `/assistencia/` sai natural (sem header `Service-Worker-Allowed`) e o `proxy.ts` já deixa `/assistencia` passar — nada mudou no proxy nem no `next.config.ts`. Manifest com URLs **relativas** (`./motorista`, `./`, `pwa/…`) resolve contra o endereço do próprio manifest, então funciona com e sem `NEXT_BASE_PATH` (`/apps`, `/apps/sac`). O `app/manifest.ts` do Next foi evitado de propósito: ele é ligado em **todas** as páginas (inclusive o painel de KPIs).

### O que o service worker cacheia (e o que nunca)

| Requisição | Estratégia |
|---|---|
| `/_next/static/*`, ícones, logo, manifest | stale-while-revalidate (cache `maia-pwa-static-<versão>`, máx. 180 itens) |
| Navegação (páginas) | network-first; **sem rede → `/assistencia/offline`**. A resposta da rede **nunca** vai para o cache (página do motorista/CD tem nome, endereço e telefone de cliente) |
| `/api/*` (inclui `/api/photos`), qualquer POST (Server Actions, upload de foto, baixa), RSC (`?_rsc`, header `RSC`/`Next-Action`), PDFs | não intercepta — vai direto para a rede |

Só registra em **produção e contexto seguro** (HTTPS ou `localhost`) e fora de iframe. Nas instâncias por IP (http) e na instância `ESTORNO_EMBED` não há SW e tudo segue como antes.

**Versão / atualização:** mudou o `sw.js` → subir `SW_VERSAO`. O navegador baixa o SW novo, ele fica em espera e o app mostra **"Nova versão disponível — Atualizar"** (o botão manda `SKIP_WAITING` e a página recarrega). Na ativação, caches `maia-pwa-*` de outras versões são apagados. Deploy que não muda o `sw.js` não precisa de nada: páginas vêm sempre da rede e os chunks novos têm hash novo.

### Fila offline das baixas do motorista

1. Toque em **Entreguei / Entrega parcial / Não consegui**: a baixa vai **primeiro** para o IndexedDB do celular (banco `maia-pwa`, store `baixas`) com `evento_uid` (UUID v4), hora do toque, geo, observação e as **fotos como Blob** (reduzidas para lado ≤ 1600 px, JPEG).
2. Em seguida tenta enviar: cada foto sem URL sobe por `POST /assistencia/motorista/odoo/foto` (uma por requisição — limite de 10 MB do proxy) e a URL fica gravada no registro (não sobe 2×); depois `POST /assistencia/motorista/odoo/baixa` (JSON com `eventoUid`).
3. Sem rede: o formulário vira **"Baixa guardada no celular"** e a barra **"N baixas aguardando envio"** aparece no rodapé de qualquer tela de `/assistencia`. O reenvio acontece por **Background Sync** (Chrome/Android, mesmo com o app fechado) e, onde não há, **ao abrir o app, ao voltar ao primeiro plano e quando a rede volta**. Botão "Enviar agora" na barra.
4. Desfecho pelo status da rota: `200` sai da fila · `409` parada já registrada (sai e avisa) · `401` sessão expirada (fica; "Entrar de novo") · `422` recusa do Odoo (fica marcada com erro: **Tentar de novo** ou **Descartar**) · rede/5xx/404 fica e tenta depois. Recusa na hora, com o motorista olhando, mostra o erro e não fica na fila (comportamento antigo).

**Idempotência:** o mesmo `evento_uid` pode chegar 2× (resposta perdida, SW e página juntos). Defesas: Web Lock `maia-fila-baixas` (página e SW nunca enviam ao mesmo tempo) → memória do processo Next (uid já concluído devolve a mesma resposta; em andamento devolve 503) → recusa "parada já registrada". **Pendência na ponte/Odoo (#8 acima): aceitar `evento_uid` e deduplicar por ele** — é a única defesa que vale entre processos/instâncias.

### Como instalar

- **Android (Chrome):** abrir `https://<domínio>/assistencia/motorista` → menu ⋮ → **Instalar app** (ou o aviso "Adicionar à tela inicial"). Abre em tela cheia, ícone "Maia Entregas".
- **iPhone (Safari — tem que ser o Safari):** abrir o mesmo endereço → botão **Compartilhar** → **Adicionar à Tela de Início** → Adicionar. Pelo navegador do WhatsApp/Instagram não instala: abrir no Safari antes.
- CD: mesmo app (atalho "Expedição do CD" no ícone, Android) ou instalar a partir de `/assistencia/logistica`.

### Como testar offline (sem tocar em produção)

1. `npm run build && npm run start` (produção em `localhost` = contexto seguro; em `npm run dev` o SW **não** registra de propósito).
2. Chrome DevTools → **Application**: Manifest sem erros e "Installable"; Service Workers com `sw.js` ativo no escopo `/assistencia/`; Cache Storage só com `maia-pwa-shell-*` e `maia-pwa-static-*` (nenhuma página de cliente).
3. **Network → Offline**: navegar para qualquer tela → aparece "Sem conexão". Numa parada em rota, tirar foto e tocar "Entreguei" → "Baixa guardada no celular" + barra "1 baixa aguardando envio"; Application → IndexedDB → `maia-pwa/baixas` mostra o registro com a foto.
4. Voltar para **Online** → a barra some sozinha (evento `online`/Background Sync); na carga aberta do CD, o evento da parada tem a observação com `[baixa offline …]` e o link da foto.
5. Background Sync manual: Application → Service Workers → *Sync* com a tag `maia-fila-baixas`.
6. Atualização: mudar `SW_VERSAO`, rebuild → aparece "Nova versão disponível".
7. Com basePath: `NEXT_BASE_PATH=/apps npm run build && NEXT_BASE_PATH=/apps npm run start` → `localhost:3000/apps/assistencia/motorista`.

### Validação local (25/10/2026, clone sem `.env`, nada de produção)

- `npx tsc --noEmit` ok · `eslint` (lib/odoo, lib/pwa, components/pwa, components/logisticaOdoo, app/assistencia, sw.js) ok · `npx vitest run` 29 arquivos / 294 testes ok · `next build` ok (`/assistencia/offline` estática, `/assistencia/motorista/odoo/baixa` dinâmica).
- `next start` em `localhost`: `manifest.webmanifest` 200 `application/manifest+json`, `sw.js` 200, ícones 200, `<head>` de `/assistencia/*` com `rel=manifest`, `theme-color`, `apple-touch-icon` e `apple-mobile-web-app-capable`; `POST …/odoo/baixa` sem sessão → 401 `{"tipo":"sessao"}` (a baixa fica na fila).
- **Não testado ainda:** instalação real num Android/iPhone e o ciclo offline → online com o Odoo piloto (precisa de HTTPS + `.env` de dev). Fazer no roteiro "Como testar offline" antes de liberar para os motoristas.

### Limites do iOS (Safari)

- **Sem Background Sync:** a fila só envia com o app aberto (ao abrir, voltar ao primeiro plano ou a rede voltar). Orientar o motorista a abrir o app quando pegar sinal.
- Instalação só pelo Safari, manual (sem aviso automático de instalação).
- O iOS pode apagar o armazenamento (IndexedDB/cache) de site **não instalado** depois de ~7 dias sem uso; instalado na tela de início isso não vale — instalar é o caminho.
- Cookies/armazenamento do app instalado são separados do Safari: o motorista faz login (PIN) uma vez **dentro** do app instalado.
- Câmera pelo `<input capture>` funciona; geolocalização pede permissão de novo no app instalado.

## Fora do escopo desta branch
Deploy, `.env` de qualquer instância, banco Supabase do Victor, migrações. Nada foi aplicado em servidor.
