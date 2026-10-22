# BRL CRM — front

Front do CRM da BRL, que reúne **Marketing, Comercial e Customer Success** num só lugar:
o lead chega por webhook, é trabalhado por Marketing e Comercial, e o negócio ganho entra
sozinho no pipeline de CS. Feito em Angular 22 (componentes standalone, signals, sem
zone.js), SCSS com tokens próprios, ícones Lucide e `@angular/cdk` (arrastar e soltar,
menus, acessibilidade).

Estão prontas a **base** (Fase 0) e o **núcleo** (Fase 1), com login real:

- entrar, trocar senha (obrigatória no primeiro acesso), esqueci/redefinir senha e definir
  senha pelo convite;
- a casca com navegação pelo papel e pelas permissões de quem entrou, sino de notificações e
  menu da conta;
- os funis de Marketing, Comercial e Customer Success em kanban, com o detalhe do negócio;
- contatos e empresas, com linha do tempo e LGPD;
- atividades;
- configurações (usuários, desligamento com prévia, minha equipe, distribuição de leads,
  passagens entre funis, meu perfil);
- integrações (webhooks de entrada e de saída) e administração (auditoria e logs técnicos);
- a visão geral em `/inicio`, com as métricas reais da jornada;
- uma página "em breve" para cada módulo das próximas fases e o catálogo vivo do design
  system em `/design-system`.

A API fica no repositório irmão [`crmbrl-api`](../crmbrl-api) (NestJS + PostgreSQL), que
também tem o `docker-compose.yml` para subir o sistema inteiro. O que cada tela faz está em
[`docs/TELAS-FASE1.md`](docs/TELAS-FASE1.md); as regras de negócio (códigos `R…`), em
`crmbrl-api/docs/REGRAS-DE-NEGOCIO.md`.

## Requisitos

- Node 24 e npm 11.
- A API rodando (veja o README do `crmbrl-api`). Sem ela, o front abre só a tela de entrar.
- Para rodar em container: Docker (o compose pode ser usado pela imagem `docker:cli`, veja o
  README da API).

## Rodar em desenvolvimento

```bash
npm ci
npm start        # ng serve em http://localhost:4200
```

O `ng serve` repassa `/api` para `http://localhost:3000` (`proxy.conf.json`), na mesma
origem do front: o cookie de sessão e a verificação de origem da API (R2.9) funcionam sem
CORS. Para isso a API precisa ter `http://localhost:4200` em `ORIGENS_PERMITIDAS` e, em
http, `COOKIE_SEGURO=false` (os dois já vêm assim no `.env.example` da API). Para apontar
para outra API, copie o `proxy.conf.json`, troque o `target` e rode
`npx ng serve --proxy-config <arquivo>`.

### Como entrar

1. Abra http://localhost:4200: sem sessão, qualquer página leva a `/entrar` (guardando a
   página pedida em `?voltar=`, para onde a pessoa volta depois de entrar).
2. O primeiro usuário é o Admin criado pela API a partir de `ADMIN_EMAIL` e
   `ADMIN_SENHA_INICIAL` do `.env` dela. O primeiro login exige trocar a senha
   (`/trocar-senha`): até lá, a API só responde a `auth/eu`, `auth/senha` e `auth/sair`.
3. Como Admin, em **Configurações → Usuários**, convide as pessoas (papel e líder; sem envio
   de e-mail configurado, com uma senha temporária, que elas trocam no primeiro acesso).

Para ter dados de exemplo numa base nova (um usuário por papel, contatos, negócios nos três
funis com passagens, atividades, webhooks e auditoria), use o
`crmbrl-api/scripts/semear-demonstracao.mjs` (seção "Dados de demonstração" do README da
API). Nunca rode o script em produção.

A sessão é o cookie `crmbrl_sessao` (HttpOnly, gravado pela API): o front nunca lê nem guarda
token. Quem está logado vem de `GET /api/v1/auth/eu` (papel, área e permissões).

## Build, testes e formatação

```bash
npx ng build                                  # produção, em dist/crmbrl/browser
npx ng test --watch=false                     # testes unitários (Vitest + jsdom)
npx ng test --watch=false --include src/app/layout   # só uma pasta (ou um arquivo)
npx prettier --check "src/**/*.{ts,html,scss}"
```

Testes de tela entram como um usuário de mentira com `entrarComo(papel)` e
`perfilDeTeste()` (`nucleo/sessao/sessao-de-teste.ts`) e respondem à API com o
`HttpTestingController`.

## Docker

O `Dockerfile` compila o Angular com Node 24 e serve o resultado com **Caddy 2.10**
(`Caddyfile`), sem root (usuário `1000:1000`):

- escuta na porta `PORT` (padrão `8080`);
- repassa `/api` e `/api/*` para `API_UPSTREAM` (padrão `api:3000`, o serviço do compose),
  mantendo o prefixo `/api`;
- SPA: rota de navegação que não é arquivo cai no `index.html` e o roteador do Angular
  resolve. Arquivo do build que não existe (`.js`, `.css`, fontes, imagens…) dá `404` — depois
  de um deploy, uma aba antiga recebe erro, e não HTML no lugar de um chunk;
- cache: `index.html` e rotas sempre revalidados (`no-cache`), arquivos com hash no nome
  por um ano (`immutable`), fontes por uma semana;
- compressão zstd/gzip e cabeçalhos de segurança (`Content-Security-Policy`,
  `Permissions-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`,
  `X-Robots-Tag: noindex`, sem `Server` nem `Via`), também nas respostas da API e nas de erro
  do próprio Caddy (ex.: `502` quando a API está fora do ar).

A **Content-Security-Policy** é gerada no build da imagem: um passo do `Dockerfile` calcula o
hash (sha256) de cada `<script>` inline do `index.html` compilado (o do tema, o do CSS crítico)
e grava `/etc/caddy/csp.caddy`, que o `Caddyfile` importa. Mudou um desses scripts, a política
acompanha no próximo build.

Para conferir o `Caddyfile` sem construir a imagem (sem o arquivo da CSP, a política fica de
fora):

```bash
docker run --rm -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2.10-alpine \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Na imagem construída, com a CSP: `docker run --rm crmbrl-web caddy validate --config
/etc/caddy/Caddyfile --adapter caddyfile`.

Para subir tudo junto (banco, API e front), use o compose do `crmbrl-api`: o serviço `web`
é construído a partir desta pasta. Só o front, depois de mudar o código, sem mexer na API nem
no banco: `docker compose up -d --build --no-deps web` (na pasta do `crmbrl-api`). Só o
front, apontando para uma API rodando na máquina:

```bash
docker build -t crmbrl-web .
docker run --rm -p 8080:8080 --add-host=host.docker.internal:host-gateway \
  -e API_UPSTREAM=host.docker.internal:3000 crmbrl-web
```

## Estrutura

```
docs/DESIGN-SYSTEM.md      especificação visual (tokens, componentes, layout)
docs/TELAS-FASE1.md        o que cada tela da Fase 1 faz (e o que ficou diferente do plano)
public/                    favicon e fonte Urbanist auto-hospedada (OFL)
proxy.conf.json            proxy do ng serve: /api → localhost:3000
src/
  index.html               lang pt-BR e script que aplica o tema antes da 1ª pintura
  styles.scss, styles/     fontes, tokens, base, utilitários e mixins
  app/
    app.config.ts          locale pt-BR, roteador, HttpClient com o interceptor de erros
    app.routes.ts          rotas sob demanda de todas as telas; as "em breve" saem de
                           nucleo/modulos.ts
    nucleo/                serviços e dados globais:
      sessao/              SessaoService (perfil de auth/eu, entrar, sair, trocar senha,
                           permissões), guardas de rota e a sessão de teste das specs
      api/                 helpers de API (paginação, parâmetros), ErroApi e o interceptor
                           que trata 401, troca de senha pendente, 429 e 5xx
      avisos.service.ts    avisos curtos (toasts), com "Desfazer" e o código do suporte
      confirmacao.service.ts  confirmação de ação destrutiva (modal)
      notificacoes.service.ts sino (a cada 30 s e ao voltar à aba)
      modulos.ts, navegacao.ts  módulos, papéis que acessam e ícones do menu
      formatos.ts, copiar.ts, tema.service.ts, papeis.ts…
    ui/                    componentes do design system (botão, abas, campos de
                           formulário, tabela, paginação, painel lateral, menu de ações…)
    layout/                casca (barra superior, navegação lateral, gaveta do mobile,
                           menu da conta, notificações, confirmação, sem acesso) e a casca
                           das telas de acesso
    paginas/
      acesso/              entrar, trocar senha, esqueci, redefinir e definir senha
      inicio/              visão geral (jornada do cliente com métricas reais)
      funis/               kanban, detalhe do negócio, novo negócio, configurar etapas
      contatos/            pessoas e empresas, detalhes, linha do tempo, LGPD
      atividades/          lista por prazo, criação rápida, detalhe
      configuracoes/       usuários, minha equipe, distribuição, passagens, meu perfil
      integracoes/         webhooks de entrada e de saída
      administracao/       auditoria, logs técnicos, dúvidas à IA (em breve)
      design-system/       catálogo vivo dos componentes
      em-breve/            página genérica dos módulos futuros
      nao-encontrada/      404
```

Cada tela tem o próprio serviço de dados na sua pasta (`funis.api.ts`, `contatos.api.ts`…),
usando os helpers do `nucleo`.

## Telas e quem acessa

| Rota                                                                  | Tela                                       | Quem acessa                                                 |
| --------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| `/entrar`, `/esqueci-senha`, `/redefinir-senha`, `/definir-senha`     | acesso                                     | sem sessão                                                  |
| `/trocar-senha`                                                       | troca de senha (obrigatória ou voluntária) | quem entrou                                                 |
| `/inicio`                                                             | visão geral                                | todos                                                       |
| `/funis/marketing`, `/funis/comercial`, `/funis/cs` (+ `/:negocioId`) | kanban e detalhe                           | Admin e C-level veem os três; líder e membro, o da sua área |
| `/contatos`, `/contatos/:id`, `/empresas/:id`                         | contatos e empresas                        | todos                                                       |
| `/atividades`                                                         | atividades                                 | todos (cada um vê as suas; o líder, as da equipe)           |
| `/configuracoes/usuarios`                                             | usuários                                   | Admin                                                       |
| `/configuracoes/equipe`                                               | minha equipe                               | C-level e líderes                                           |
| `/configuracoes/distribuicao`                                         | distribuição de leads                      | Admin, C-level e líderes                                    |
| `/configuracoes/passagens`                                            | passagens entre funis                      | Admin e C-level                                             |
| `/configuracoes/perfil`                                               | meu perfil                                 | todos                                                       |
| `/integracoes/entrada`, `/integracoes/saida`                          | webhooks                                   | Admin                                                       |
| `/administracao/auditoria`                                            | auditoria                                  | Admin e C-level                                             |
| `/administracao/logs`                                                 | logs técnicos                              | Admin                                                       |
| `/sem-acesso`                                                         | o que foi negado e quem acessa             | —                                                           |
| `/design-system`                                                      | catálogo do design system                  | no menu, só o Admin (a rota abre pelo link para todos)      |

A matriz completa está na §12 das regras de negócio. A tela esconde ou desabilita (com a dica
do motivo) o que o papel não pode fazer; a API continua sendo a autoridade.

## Casca e navegação

- **Barra superior**, fixa no topo: logo, busca, alternador de tema, sino de notificações e
  menu da conta. A busca leva ao módulo procurado ("disparos" → Disparos); quando o termo não
  é nome de módulo, procura em Contatos e empresas. O **sino** mostra as não lidas primeiro,
  com ícone por tipo, tempo relativo, link para o item e "Marcar todas como lidas"; atualiza a
  cada 30 s e ao voltar para a aba. O **menu da conta** tem nome, papel e e-mail, "Meu
  perfil", "Trocar senha" e "Sair".
- **Navegação lateral** em cartão, com os grupos Funis, Relacionamento, Gestão e Sistema,
  filtrada pelo papel e pelas permissões de quem entrou. O item da página atual tem o círculo
  invertido; módulos das próximas fases têm o selo "em breve". Quando a lista não cabe, ela
  rola dentro do cartão, com as bordas esmaecidas do lado em que há mais módulos. A navegação
  pode ser recolhida para só os círculos (com dica ao passar o mouse, que fecha com Esc); a
  escolha fica em `localStorage['crmbrl.navegacao-recolhida']`. No tablet (900–1199px) ela
  fica no trilho de círculos e o «/» a abre por cima do conteúdo (fecha com Esc, toque fora ou
  troca de página); no celular (< 900px) abre numa gaveta, com foco preso e Esc para fechar.
- **Avisos** no canto inferior: **F8** leva o foco ao aviso mais novo (o "Desfazer", se
  houver) e F8 ou Esc devolvem; com um modal ou painel aberto, os avisos e os anúncios ao leitor
  de tela moram dentro dele (`ui/camada-modal.ts`), para continuarem clicáveis e audíveis.
- **Guardas de rota** (`nucleo/sessao/guardas.ts`): sem sessão → `/entrar?voltar=<rota>`;
  troca de senha pendente → `/trocar-senha`; módulo ou seção sem acesso →
  `/sem-acesso?pagina=<rota>`, que diz o que foi negado e quem acessa.
- **Erros da API** (`nucleo/api/interceptor-erros.ts`): toda falha vira uma mensagem humana;
  401 no meio do uso avisa "Sua sessão terminou" e leva a `/entrar`, voltando depois para onde
  a pessoa estava; 429 diz quando tentar de novo; 5xx mostra o código da requisição para a TI.
  Cada tela mostra a mensagem no lugar certo (campo, ação ou estado de erro com "Tentar de
  novo").
- **Avisos e confirmações**: toda ação dá um aviso curto (`AvisosService`, com "Desfazer"
  quando dá para desfazer), anunciado ao leitor de tela; ação destrutiva passa pelo
  `ConfirmacaoService`, que diz exatamente o que vai acontecer.
- **Navegação lenta**: se a página demora mais de 150 ms para abrir, uma barra de progresso
  aparece no topo e o conteúdo fica marcado como ocupado (`aria-busy`).
- **Acessibilidade**: link "Pular para o conteúdo" (o primeiro Tab da página), foco no
  conteúdo a cada troca de página (o leitor de tela anuncia a página nova), menus operáveis
  por teclado (setas, Home, End, Esc), kanban com teclado e anúncios, e alvos de toque de 44px.
- **Módulos**: `src/app/nucleo/modulos.ts` é a fonte única dos módulos (rota, papéis que
  acessam, permissão, fase do roadmap); `nucleo/navegacao.ts` acrescenta os ícones do menu.
  Os ícones ficam fora do carregamento inicial: a configuração do Lucide está nos `providers`
  das cascas (`layout/icones.ts`).

## Tema claro e escuro

Os dois temas usam os mesmos componentes; só os tokens mudam (`data-tema` no `<html>` ou em
qualquer contêiner). Sem escolha, o tema segue o sistema operacional; a escolha do usuário
fica em `localStorage['crmbrl.tema']`. O script do `index.html` aplica o tema antes da
primeira pintura (sem clarão) e o `TemaService` (`nucleo/tema.service.ts`) cuida do resto.

## Dados de exemplo

Não há mais modo demonstração: tudo vem da API, com o usuário real. Só a visão geral ainda tem
blocos que dependem de módulos das próximas fases — as abas **Atendimento** e **Equipe**, os
indicadores de receita recorrente e health score e a **Análise com IA** —, e eles aparecem
marcados como "Dados de exemplo".

## Design system

A especificação está em [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md): a linguagem visual
do Sugar CRM (RonDesignLab) traduzida em tokens e componentes, com a marca do BRL CRM. O
catálogo vivo, com cada componente em todas as variantes e nos dois temas, fica em
`/design-system`.

## Convenções

- Português do Brasil em código, comentários, documentação e textos de tela.
- Componentes standalone com `OnPush`, `input()`/`output()`/`model()`, `computed()`,
  `inject()` e os blocos `@if`/`@for`.
- Estilos só com tokens (`var(--…)`), nada de cor solta; pontos de quebra pelos mixins de
  `src/styles/_mixins.scss`.
- Sem bibliotecas de UI além do `@angular/cdk`. Dependência nova só com aprovação.
- Formatação com Prettier (`.prettierrc`).
