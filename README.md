# BRL CRM — front

Front do CRM da BRL, que reúne **Marketing, Comercial e Customer Success** num só lugar:
o lead chega por webhook, é trabalhado por Marketing e Comercial, e o negócio ganho entra
sozinho no pipeline de CS. Feito em Angular 22 (componentes standalone, signals, sem
zone.js), SCSS com tokens próprios e ícones Lucide.

Nesta etapa estão prontos a **base** e um **dashboard de exemplo**:

- a casca (barra superior, navegação por papel, gaveta no celular);
- a visão geral em `/inicio`, com dados fictícios e o status real da API;
- uma página "em breve" para cada módulo futuro (e o estado "sem acesso");
- o catálogo vivo do design system em `/design-system`.

A API fica no repositório irmão [`crmbrl-api`](../crmbrl-api) (NestJS + PostgreSQL), que
também tem o `docker-compose.yml` para subir o sistema inteiro.

## Requisitos

- Node 24 e npm 11.
- Para rodar em container: Docker (o compose pode ser usado pela imagem `docker:cli`, veja o
  README da API).

## Rodar em desenvolvimento

```bash
npm ci
npm start        # ng serve em http://localhost:4200
```

O `ng serve` repassa `/api` para `http://localhost:3000` (`proxy.conf.json`). Suba a API
(veja o README do `crmbrl-api`); sem ela o front funciona normalmente e o status do sistema,
na visão geral, avisa que a API não respondeu.

## Build, testes e formatação

```bash
npx ng build                                  # produção, em dist/crmbrl/browser
npx ng test --watch=false                     # testes unitários (Vitest + jsdom)
npx ng test --watch=false --include src/app/layout   # só uma pasta (ou um arquivo)
npx prettier --check "src/**/*.{ts,html,scss}"
```

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
é construído a partir desta pasta. Só o front, apontando para uma API rodando na máquina:

```bash
docker build -t crmbrl-web .
docker run --rm -p 8080:8080 --add-host=host.docker.internal:host-gateway \
  -e API_UPSTREAM=host.docker.internal:3000 crmbrl-web
```

## Estrutura

```
docs/DESIGN-SYSTEM.md      especificação visual (tokens, componentes, layout)
public/                    favicon e fonte Urbanist auto-hospedada (OFL)
proxy.conf.json            proxy do ng serve: /api → localhost:3000
src/
  index.html               lang pt-BR e script que aplica o tema antes da 1ª pintura
  styles.scss, styles/     fontes, tokens, base, utilitários e mixins
  app/
    app.config.ts          locale pt-BR, roteador, HttpClient, Lucide
    app.routes.ts          rotas sob demanda; as dos módulos saem de nucleo/navegacao.ts
    nucleo/                serviços e dados globais: tema, modo demonstração, navegação,
                           saúde da API, formatos pt-BR
    ui/                    componentes do design system (botão, abas, cartão, indicador,
                           barra de funil, modal…)
    layout/                casca: barra superior, navegação lateral, gaveta do mobile,
                           menu da conta e notificações
    paginas/
      inicio/              visão geral (dashboard de exemplo)
      design-system/       catálogo vivo dos componentes
      em-breve/            página genérica dos módulos futuros
      nao-encontrada/      404
```

## Casca e navegação

- **Barra superior**, fixa no topo: logo, busca, alternador de tema, sino de notificações e
  menu da conta. Nesta etapa a busca encontra módulos ("disparos" → Disparos); pessoas,
  empresas e negócios entram na busca com a Fase 1. As notificações são de exemplo.
- **Navegação lateral** em cartão, com os grupos Funis, Relacionamento, Gestão e Sistema. O
  item da página atual tem o círculo invertido; módulos ainda não prontos têm o selo "em
  breve". Quando a lista não cabe, ela rola dentro do cartão, com as bordas esmaecidas do lado
  em que há mais módulos; o aviso do modo demonstração fica fixo no pé. A navegação pode ser
  recolhida para só os círculos (com dica ao passar o mouse, que fecha com Esc); a escolha
  fica em `localStorage['crmbrl.navegacao-recolhida']`. No tablet (900–1199px) ela fica no
  trilho de círculos e o «/» a abre por cima do conteúdo (fecha com Esc, toque fora ou troca
  de página); no celular (< 900px) abre numa gaveta, com foco preso e Esc para fechar.
- **Navegação lenta**: se a página demora mais de 150 ms para abrir, uma barra de progresso
  aparece no topo e o conteúdo fica marcado como ocupado (`aria-busy`).
- **Acessibilidade**: link "Pular para o conteúdo" (o primeiro Tab da página), foco no
  conteúdo a cada troca de página (o leitor de tela anuncia a página nova), menus operáveis
  por teclado (setas, Home, End, Esc) e alvos de toque de 44px.
- **Módulos**: `src/app/nucleo/navegacao.ts` é a fonte única do menu, das rotas e da página
  "em breve" (descrição, funcionalidades planejadas, fase do roadmap e papéis que acessam).
  Para incluir um módulo, acrescente-o em `MODULOS`: a rota e o item do menu saem sozinhos.

## Tema claro e escuro

Os dois temas usam os mesmos componentes; só os tokens mudam (`data-tema` no `<html>` ou em
qualquer contêiner). Sem escolha, o tema segue o sistema operacional; a escolha do usuário
fica em `localStorage['crmbrl.tema']`. O script do `index.html` aplica o tema antes da
primeira pintura (sem clarão) e o `TemaService` (`nucleo/tema.service.ts`) cuida do resto.

## Modo demonstração

Enquanto não há login, o menu da conta (avatar, no canto superior direito) tem o **Ver
como**: escolha uma pessoa de exemplo — uma por papel: Admin, C-level, Líder Comercial,
Comercial, Líder Marketing, Marketing, Líder CS e CS — e a navegação e as telas passam a
mostrar só o que aquele papel acessa (na visão geral, a aba Atendimento e as atividades
restritas também). O aviso no pé da navegação mostra quem está em uso e abre o mesmo "Ver
como". Abrir pelo endereço um módulo sem acesso mostra quem acessa e um atalho para ver o CRM
como esse papel. A escolha fica em `localStorage['crmbrl.perfil-demo']` (padrão: Admin).

Os números do dashboard e as notificações são fictícios e aparecem marcados como "Dados de
exemplo"; só o status do sistema é real (`GET /api/saude`).

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
- Sem bibliotecas de UI. Dependência nova só com aprovação.
- Formatação com Prettier (`.prettierrc`).
