# lomadee-api - bootstrap do projeto AceitaTempoAPI (proxy Netlify Edge)

Gerado em: 2026-08-25
Sessao/contexto: fba93337
Tipo de registro: implementacao

## Card

Arquivo do card: nao ha card formal; trabalho originado de discussao no chat sobre integracao AceitaTempo <-> Lomadee.
Resumo:
- A extensao AceitaTempo (ver [src/affiliate.js](../../../src/affiliate.js)) precisa gerar links de afiliado Lomadee para lojas como Casas Bahia e Americanas (TODO ja existente em [src/affiliate.js:41-46](../../../src/affiliate.js#L41-L46)).
- A API da Lomadee exige uma `x-api-key` secreta, que nao pode ser embutida no client da extensao.
- Decisao: criar um repositorio separado (`AceitaTempoAPI`) com Netlify Edge Functions atuando como proxy, guardando a chave no servidor.

## Pedido Do Usuario

Pedido literal:
> "entao, eu vou criar uma api-simples baseado em edge function usando o netlify. crie em uma pasta anterior o projeto AceitaTempoAPI, construa a base para o netlify e entao commit e suba para o meu github. suba privado."

Classificacao:
- Pedido explicito: criar pasta `AceitaTempoAPI` uma pasta acima do projeto atual; montar a base de um projeto Netlify Edge Functions; fazer commit; subir para o GitHub do usuario como repositorio privado.
- Restricoes explicitas: repositorio deve ser privado.

## Interpretacao E Inferencias

- Inferencia operacional: "uma pasta anterior" foi interpretado como `E:\GitHub\` (pasta-mae do repositorio `AceitaTempo`), criando `E:\GitHub\AceitaTempoAPI` como projeto irmao.
  - Motivo: e o unico nivel acima que faz sentido estrutural (sibling ao projeto atual); confirmado por `ls /e/GitHub/` mostrando `AceitaTempo` e outros projetos irmaos no mesmo nivel.
  - Risco da inferencia: baixo. Se a intencao fosse outro caminho, e trivial mover a pasta antes do primeiro push adicional.
- Inferencia operacional: o escopo funcional do proxy (`GET /api/lomadee-link?store=...`) foi baseado na conversa anterior no chat sobre o fluxo Lomadee (campaigns -> shortener/url), nao em um requisito formalizado pelo usuario nesta mensagem especifica.
  - Motivo: o usuario so pediu "a base" do projeto Netlify; sem esse contexto o scaffold ficaria vazio (so healthcheck).
  - Risco da inferencia: medio-baixo. O endpoint foi implementado com `organizationId` de exemplo vazio (`store-map.ts`), entao nao ha chamada real quebrada — apenas estrutura pronta para o usuario preencher.
- Inferencia operacional: conta do GitHub usada foi `Ddiidev` (unica conta autenticada no `gh auth status` desta maquina).
  - Motivo: unica opcao disponivel; corresponde tambem ao dominio ja usado no README do AceitaTempo (`ddiidev.github.io`).
  - Risco da inferencia: nenhum, e a unica conta logada.

## Implementacao Ou Alteracao

- O que foi feito: criado projeto novo em [E:\GitHub\AceitaTempoAPI](../../../../../AceitaTempoAPI) com:
  - `package.json` (script `dev` via `netlify-cli`)
  - `netlify.toml` (`publish = "public"`)
  - `public/index.html` (pagina de status minima)
  - `netlify/edge-functions/health.ts` (`GET /api/health`)
  - `netlify/edge-functions/lomadee-link.ts` (`GET /api/lomadee-link?store=&type=`): resolve `organizationId` via `store-map.ts`, consulta `GET /affiliate/campaigns` (Lomadee), gera link via `POST /affiliate/shortener/url`, retorna JSON com CORS aberto.
  - `netlify/edge-functions/lib/store-map.ts` (mapa `siteId -> organizationId`, hoje vazio/placeholder para `casas-bahia` e `americanas`)
  - `.env.example`, `.gitignore`, `README.md` com instrucoes de setup, deploy e limitacoes conhecidas.
- Por que foi feito: dar ao usuario uma base funcional (nao so esqueleto vazio) do proxy que guarda a chave da Lomadee fora do client da extensao, alinhado com a arquitetura discutida no chat.
- Onde foi feito: repositorio novo `AceitaTempoAPI` (fora da arvore do `AceitaTempo`).
- O que nao foi feito:
  - Nao foi preenchido nenhum `organizationId` real (nao ha credenciais Lomadee disponiveis nesta sessao).
  - Nao foi implementado cache (Netlify Blobs ou similar) para as chamadas a Lomadee — documentado como proximo passo no README.
  - Nao foi feita nenhuma alteracao no repositorio `AceitaTempo` (extensao) para consumir esse proxy — o `buildAffiliateUrl` em `src/affiliate.js` e o handler de clique em `src/content.js:2168-2175` continuam sincronos/sem integracao.

### Atualizacao — deploy e validacao no Netlify (mesma sessao)

- O que foi feito:
  - `npm install` revelou que `netlify-cli@17.x` quebra em Node 25 (`TypeError` em `SlowBuffer.prototype`, dependencia transitiva `buffer-equal-constant-time` via `jwa`). Corrigido bump para `netlify-cli@^27.0.0` em [package.json](../../../../../AceitaTempoAPI/package.json).
  - Criado site novo na Netlify via `netlify sites:create --name aceitatempoapi` (conta `AlsDevSbin`, email `andre_jp97@hotmail.com`, ja autenticada na maquina) — nome final `aceitatempoapi-310` (sufixo automatico por colisao de nome).
  - Deploy de producao via `netlify deploy --prod`: edge functions `health` e `lomadee-link` empacotadas e publicadas com sucesso.
  - Repositorio `AceitaTempoAPI` **nao** foi conectado ao GitHub App da Netlify (deploy continuo automatico) — foi um deploy manual via CLI a partir do working copy local. Import via dashboard (Git-linked) ainda e pendente caso o usuario queira deploy automatico a cada push.
- Por que foi feito: usuario pediu explicitamente "validar no netlify e fazer o teste".
- Onde foi feito: projeto Netlify `aceitatempoapi-310` (site id `561ba20b-6ee5-41ec-aacb-baeb8c6b86fc`), URL de producao `https://aceitatempoapi-310.netlify.app`.
- O que nao foi feito:
  - `LOMADEE_API_KEY` nao foi configurada (nao ha chave real disponivel) — `/api/lomadee-link` nunca chega a bater na Lomadee de fato nesta validacao.
  - `store-map.ts` continua com `organizationId` vazio — por isso o teste real do fluxo campaigns->shortener nao foi exercitado, so o roteamento e os erros esperados.
  - Site nao foi ligado via GitHub App (sem deploy automatico em push ainda).

## Commits Relacionados Ao Card

Repositorio: AceitaTempoAPI (novo, `https://github.com/Ddiidev/AceitaTempoAPI`)
- Branch: `main`
- Base/destino: `main` (root commit)
- Commits:
  - `158f83e` - `feat: bootstrap AceitaTempoAPI com proxy Lomadee em Netlify Edge Functions` - 2026-08-25 - commit unico de bootstrap do projeto, cobre toda a base pedida (netlify.toml, edge functions, README).
  - `dfd078b` - `fix: atualiza netlify-cli para 27.x (17.x quebra em Node 25 via SlowBuffer removido)` - 2026-08-25 - corrige dependencia quebrada encontrada durante a validacao no Netlify; adiciona `package-lock.json` e `deno.lock`.
- Push/PR: pushed (`gh repo create AceitaTempoAPI --private --source=. --remote=origin --push`, branch `main` -> `origin/main`; `dfd078b` enviado via `git push` direto).

Repositorio: AceitaTempo (este worktree)
Nenhum commit relacionado encontrado ate este ponto.
Motivo: nenhuma alteracao de codigo foi feita neste repositorio; apenas este documento de WIP foi criado.

## Validacao

- Validacoes feitas:
  - `git status` apos `git add -A` conferido antes do commit (9 arquivos novos, nenhum arquivo inesperado).
  - `gh auth status` conferido antes do push (conta `Ddiidev`, escopo `repo` presente).
  - Push confirmado via saida do `gh repo create` (`https://github.com/Ddiidev/AceitaTempoAPI`, branch `main` -> `origin/main`).
- Validacoes nao feitas:
  - Nao foi testado o endpoint `/api/lomadee-link` contra a API real da Lomadee (sem `LOMADEE_API_KEY` nem `organizationId` disponiveis) — so os caminhos de erro (400/404) foram exercitados.
  - Site Netlify nao foi conectado ao GitHub App (sem CI/deploy automatico por push validado).
- Motivo das validacoes nao feitas: nao ha credenciais Lomadee disponiveis nesta sessao.

### Atualizacao — resultado dos testes (mesma sessao)

- Validacoes feitas:
  - `GET https://aceitatempoapi-310.netlify.app/api/health` -> `200 {"ok":true,"service":"AceitaTempoAPI","time":"2026-08-25T14:25:33.106Z"}`.
  - `GET .../api/lomadee-link?store=casas-bahia` -> `404 {"ok":false,"error":"unknown or unconfigured store 'casas-bahia'"}` (esperado: `organizationId` ainda vazio em `store-map.ts`).
  - `GET .../api/lomadee-link` (sem `store`) -> `400 {"ok":false,"error":"missing 'store' parameter"}`.
  - Os tres resultados confirmam que o build, o roteamento das edge functions (`config.path`) e o tratamento de erro estao corretos end-to-end no Netlify real.

## Riscos E Pendencias

- Site Netlify (`aceitatempoapi-310`, https://aceitatempoapi-310.netlify.app) esta no ar mas foi deployado manualmente via CLI local — nao esta ligado ao GitHub App, entao um `git push` futuro nao dispara deploy automatico ate o usuario conectar o repo pelo dashboard Netlify (Site settings > Build & deploy > Link repository).
- `LOMADEE_API_KEY` ainda nao esta configurada nas env vars do site — `/api/lomadee-link` retornaria `500` mesmo com `organizationId` preenchido.
- `store-map.ts` precisa ser preenchido manualmente com os `organizationId` reais antes do endpoint funcionar de verdade.
- A extensao AceitaTempo ainda nao consome este proxy; falta a integracao do lado do client (`src/affiliate.js` + `src/content.js`).

### Atualizacao — chave real fornecida pelo usuario e correcao de site duplicado (mesma sessao)

- O que foi feito:
  - Usuario colou a `LOMADEE_API_KEY` real no chat (`lmd_production_...`) pedindo teste direto, com aviso de que ia revogar a chave depois. Usada apenas em comandos `curl`/`netlify env:set` locais; nunca escrita em arquivo versionado.
  - `GET /affiliate/brands` (141 marcas na conta) confirmou: **Casas Bahia e Americanas nao estao disponiveis** nesta conta Lomadee. Encontrados matches reais para 3 lojas ja cobertas pelo AceitaTempo: Shopee, Shein, TeraByte — IDs preenchidos em `store-map.ts` (commit `41a9ae6`).
  - Fluxo `campaigns -> shortener/url` validado diretamente contra a Lomadee com `organizationId` da Shopee — retornou a mesma `shortUrl` nos dois metodos (a campanha ja trazia `channels[].shortUrls` pronto; o `POST /shortener/url` e redundante quando isso acontece, mas funciona como fallback).
  - Primeiro teste no site criado via CLI (`aceitatempoapi-310`) falhou com `500 missing LOMADEE_API_KEY` — a env var do usuario estava setada em **outro site** (criado por ele via dashboard/GitHub import, nome `aceitatempoapi`, sem sufixo).
  - `netlify sites:list --json` confirmou o site correto: `aceitatempoapi` (id `3a5a7ecf-a835-42d3-95ee-6ee64e89818e`), **ja linkado ao GitHub** (`Ddiidev/AceitaTempoAPI`, branch `main`, `deploy_hook` do tipo GitHub webhook) e **ja com deploy automatico** do commit `41a9ae6` publicado (`published_deploy.commit_ref = 41a9ae6...`, state `ready`, `secretsScanMatches: []`).
  - `netlify env:list --site 3a5a7ecf-...` confirmou `LOMADEE_API_KEY` presente com escopo `Builds, Functions, Runtime` nesse site.
  - Teste final em produção: `GET https://aceitatempoapi.netlify.app/api/health` -> `200`; `GET .../api/lomadee-link?store=shopee` -> `200 {"ok":true,"url":"https://lmdee.link/S7SL5QX2uTtK",...}` — fluxo completo (extensao futura -> proxy -> Lomadee) validado ponta a ponta com dado real.
  - Pasta local `E:\GitHub\AceitaTempoAPI` desvinculada de `aceitatempoapi-310` e relinkada para `aceitatempoapi` (`netlify unlink` + `netlify link --id 3a5a7ecf-a835-42d3-95ee-6ee64e89818e`), para futuros `netlify deploy` via CLI apontarem pro site certo.
- Por que foi feito: usuario perguntou explicitamente se o site `aceitatempoapi` (sem sufixo) ja estava criado, com env setada e linkado ao GitHub.
- Onde foi feito: conta Netlify `AlsDevSbin` (`andre_jp97@hotmail.com`); site de producao real e `https://aceitatempoapi.netlify.app`.
- O que nao foi feito:
  - Site `aceitatempoapi-310` (orfao, sem Git, criado por mim via CLI antes de descobrir o site correto) **nao foi apagado** — perguntado ao usuario se quer que eu apague ou se ele remove manualmente.
  - A chave `lmd_production_...` fornecida no chat nao foi revogada nem substituida nesta sessao — usuario disse que faria isso depois; quando fizer, precisa gerar uma nova e rodar `netlify env:set LOMADEE_API_KEY <nova> --secret --context production --force --site 3a5a7ecf-a835-42d3-95ee-6ee64e89818e` (o deploy automatico via Git nao precisa de novo push, so a env var + um novo deploy).

### Atualizacao — integracao do lado da extensao AceitaTempo (mesma sessao)

- O que foi feito:
  - [manifest.json](../../../../manifest.json): `host_permissions` ganhou `https://aceitatempoapi.netlify.app/*`.
  - [background.js](../../../../background.js): nova `fetchLomadeeAffiliateUrl(store)` (fetch ao proxy) e handler de mensagem `aceitaTempo:getLomadeeLink`, no mesmo padrao de `aceitaTempo:refreshExchangeRate` ja existente.
  - [src/affiliate.js](../../../../src/affiliate.js): `AFFILIATE_STORES` ganhou `shopee`, `shein`, `terabyte` com `lomadee: true` (sem `params`) e `active: true`; removido o placeholder antigo `af_siteid` da Shopee (nunca foi real) e o TODO desatualizado sobre Casas Bahia/Americanas. Nova funcao assincrona `getAffiliateRedirectUrl(href, siteId)`: para loja `lomadee`, manda `chrome.runtime.sendMessage` pro background (timeout de 4s, fallback pro href original em qualquer falha); para loja com `params`, cai no `buildAffiliateUrl` sincrono existente (sem mudanca de comportamento). `buildAffiliateUrl` ganhou guard `!store.params` pra nao quebrar com as novas lojas sem params.
  - [src/content.js](../../../../src/content.js): handler de clique do toast de afiliado (linha ~2168) virou `async`, usa `getAffiliateRedirectUrl`, desabilita o botao com label `...` durante a espera e restaura se nao houver URL diferente (mesma semantica silenciosa do codigo original em caso de falha). `urlAlreadyHasAffiliateTag` ganhou o mesmo guard `!store.params`.
  - [tests/run-firefox-onboarding-smoke.js](../../../../tests/run-firefox-onboarding-smoke.js): lista esperada de lojas ativas atualizada para incluir `shein`, `shopee`, `terabyte`.
  - Validacao ad hoc (script descartavel, nao commitado) confirmando: `hasAffiliate('shopee') === true`; `buildAffiliateUrl` sincrono nao quebra mais para lojas sem `params`; `getAffiliateRedirectUrl` resolve a URL real quando o background responde `ok:true`; cai no href original quando o background responde `ok:false`; nao chama `chrome.runtime.sendMessage` para lojas com `params` (regressao zero).
  - Suite completa de smoke tests (`smoke:firefox-onboarding`, `smoke:social`, `smoke:sites`, `smoke:cart`, `smoke:period`) rodada e passando.
- Por que foi feito: pedido explicito do usuario ("agora pode trabalhar na extensao de fato"), fechando o item pendente ja mapeado nas atualizacoes anteriores deste documento.
- Onde foi feito: `manifest.json`, `background.js`, `src/affiliate.js`, `src/content.js`, `tests/run-firefox-onboarding-smoke.js`, todos neste worktree.
- O que nao foi feito:
  - Nenhum commit criado (usuario nao pediu commit desta etapa ainda).
  - Nao foi testado manualmente em navegador real com a extensao carregada (`chrome://extensions`) nem contra uma pagina real de Shopee/Shein/Terabyte — validacao ficou nos smoke tests automatizados (que usam fixtures/HTML local, nao a extensao empacotada) e no script ad hoc de logica pura.
  - Cache local do resultado do proxy (evitar chamar `/api/lomadee-link` de novo pro mesmo produto na mesma sessao) nao foi implementado.

### Correcao — edicoes tinham ido para o checkout errado (mesma sessao)

- O que aconteceu: as primeiras edicoes desta etapa (`manifest.json`, `background.js`, `src/affiliate.js`, `src/content.js`, `tests/run-firefox-onboarding-smoke.js`) foram escritas por engano em `E:\GitHub\AceitaTempo` (checkout principal, branch `main`) em vez do worktree desta sessao (`E:\GitHub\AceitaTempo\.claude\worktrees\signal-ultra-review-2c1d41`, branch `claude/signal-ultra-review-2c1d41`). Os smoke tests iniciais tambem rodaram contra o checkout errado (por isso "passaram" sem detectar o problema — a logica em si estava correta, so no lugar errado).
- Como foi corrigido: `git status --short` no checkout principal confirmou que as 5 modificacoes eram exatamente as minhas (nada preexistente do usuario foi tocado); copiei o conteudo editado para o worktree certo e rodei `git restore` nos 5 arquivos no checkout principal, devolvendo-o ao estado limpo original. Reexecutei a verificacao ad hoc e a suite completa de smoke tests de dentro do worktree correto — mesmo resultado (tudo passou).
- Risco residual: nenhum identificado — `git status` de ambos os checkouts confirmado limpo/esperado apos a correcao.

## Proximo Teste Esperado

- Usuario conectar o repo `Ddiidev/AceitaTempoAPI` ao site Netlify (deploy automatico por push), definir `LOMADEE_API_KEY` nas env vars do site, preencher `store-map.ts` com um `organizationId` real e testar `GET /api/lomadee-link?store=casas-bahia` end-to-end (com chamada real a Lomadee) antes de integrar com a extensao.
