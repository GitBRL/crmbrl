# Design system — BRL CRM

Linguagem visual do front `crmbrl`. É a tradução, em tokens e componentes, da
referência escolhida para o produto: o **Sugar CRM**, da RonDesignLab
([shot no Dribbble](https://dribbble.com/shots/26629031-Sugar-CRM-SaaS-Dashboard-UX-UI-Design) ·
[case completo](https://rondesignlab.com/cases/sugar-crm-saas-ux-ui-design)).

A referência é só escura. O tema claro foi derivado aqui, com os mesmos componentes e
apenas os tokens trocados. Todo valor de cor, raio, espaço ou tipografia usado em tela
**vem de um token** — nada de hex solto em componente.

> A marca é a da BRL (o produto se chama BRL CRM), não a do Sugar. Usamos a linguagem visual
> da referência, nunca o logo nem o nome dela.

---

## 1. Princípios

1. **Simples primeiro.** Cada tela tem uma ação principal evidente. O que não é óbvio
   ganha uma dica (`app-dica`) ao lado — o CRM precisa servir a quem nunca usou um CRM.
2. **Escuro é a identidade; claro é completo.** Os dois temas têm a mesma hierarquia e o
   mesmo contraste mínimo. O tema inicial segue o sistema operacional; a escolha do
   usuário fica salva.
3. **Formas redondas.** Controles são pílulas ou círculos; cartões têm raio grande.
   Quase não há linhas retas nem cantos vivos.
4. **Cor com propósito.** Neutros estruturam a tela. Ciano, menta e lima são **cores de
   dado**. Coral marca **o que está ativo, selecionado ou sendo arrastado**. Lima também é
   a assinatura da marca (uso pontual: destaque de IA, foco no tema escuro).
5. **Números grandes e leves.** Métricas em peso 300, com a unidade menor e uma legenda
   curta e suave embaixo.
6. **Acessível por padrão.** Contraste AA, foco sempre visível, alvos de toque ≥ 44px,
   tudo operável por teclado, animações reduzidas quando o sistema pede.

---

## 2. Tokens

Os tokens vivem em `src/styles/_tokens.scss` como propriedades CSS em `:root`, trocadas
por `[data-tema='escuro']` e `[data-tema='claro']`. O atributo fica no `<html>`, mas vale
em **qualquer contêiner**: tudo dentro de um `<div data-tema="claro">` usa o tema claro (o
catálogo usa isso para mostrar os dois temas lado a lado). Sem `data-tema` (JavaScript
desligado), vale `prefers-color-scheme`.

Os estilos globais ficam em `src/styles.scss`, que só importa as parciais de `src/styles/`:
`_fontes` (`@font-face`), `_tokens`, `_base` (reset, tipografia padrão, foco, movimento
reduzido, link "Pular para o conteúdo") e `_utilitarios`. A parcial `_mixins` não gera CSS;
os componentes a usam com `@use 'mixins' as m;` (o caminho `src/styles` está em
`stylePreprocessorOptions.includePaths` do `angular.json`).

### 2.1 Paleta base (oficial do Sugar)

| Token         | Hex       | Papel                                   |
| ------------- | --------- | --------------------------------------- |
| `--pb-preto`  | `#000000` | Fundo do tema escuro                    |
| `--pb-branco` | `#FFFFFF` | Texto no escuro; superfície no claro    |
| `--pb-ciano`  | `#00BDF9` | Dado 1 · informação                     |
| `--pb-menta`  | `#00F99B` | Dado 2 · sucesso                        |
| `--pb-lima`   | `#E5F900` | Dado 3 · marca · foco (escuro)          |
| `--pb-coral`  | `#F46F51` | Ativo/selecionado · arrastar · destaque |

Sobre ciano, menta, lima e coral o texto é **sempre preto** (contraste ≥ 7:1). Texto
branco sobre essas cores é proibido.

### 2.2 Tokens semânticos

| Token                                             | Escuro                                                                           | Claro                | Uso                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------- |
| `--cor-fundo`                                     | `#000000`                                                                        | `#EFEFEC`            | Fundo da página                                                     |
| `--cor-superficie`                                | `#161616`                                                                        | `#FFFFFF`            | Cartões e painéis                                                   |
| `--cor-superficie-2`                              | `#1E1E1E`                                                                        | `#F4F4F1`            | Pílulas, chips, campos dentro de cartões                            |
| `--cor-superficie-3`                              | `#2A2A2A`                                                                        | `#E8E8E4`            | Botão-ícone, hover, selo de tipo do chip                            |
| `--cor-flutuante`                                 | `#232323`                                                                        | `#FFFFFF`            | Balões (dica) e menus                                               |
| `--cor-vidro`                                     | `rgba(255,255,255,.07)`                                                          | `rgba(0,0,0,.04)`    | Controles translúcidos sobre o palco                                |
| `--cor-vidro-forte`                               | `rgba(255,255,255,.12)`                                                          | `rgba(0,0,0,.08)`    | Selo neutro, botão da dica, hover sobre o palco                     |
| `--cor-veu`                                       | `rgba(0,0,0,.72)`                                                                | `rgba(10,10,10,.42)` | Véu atrás do modal                                                  |
| `--cor-borda`                                     | `rgba(255,255,255,.08)`                                                          | `rgba(0,0,0,.08)`    | Divisórias e contornos sutis                                        |
| `--cor-borda-forte`                               | `rgba(255,255,255,.16)`                                                          | `rgba(0,0,0,.16)`    | Pílula contorno, zona de soltar                                     |
| `--cor-texto`                                     | `#FFFFFF`                                                                        | `#0A0A0A`            | Texto principal                                                     |
| `--cor-texto-suave`                               | `#B3B3B3`                                                                        | `#4D4D4D`            | Texto secundário, abas inativas                                     |
| `--cor-texto-fraco`                               | `#969696`                                                                        | `#666666`            | Legendas, a parte apagada dos títulos                               |
| `--cor-inverso`                                   | `#FFFFFF`                                                                        | `#0A0A0A`            | Fundo da ação principal (pílula/círculo invertido)                  |
| `--cor-sobre-inverso`                             | `#000000`                                                                        | `#FFFFFF`            | Conteúdo sobre `--cor-inverso`                                      |
| `--cor-destaque`                                  | `#F46F51`                                                                        | `#F46F51`            | Coral: ativo, selecionado, arrastando                               |
| `--cor-sobre-destaque`                            | `#000000`                                                                        | `#000000`            | Conteúdo sobre coral                                                |
| `--cor-destaque-texto`                            | `#F46F51`                                                                        | `#B93A1F`            | Coral usado como **texto**                                          |
| `--cor-marca`                                     | `#E5F900`                                                                        | `#E5F900`            | Lima: assinatura (IA, selos de marca)                               |
| `--cor-sobre-marca`                               | `#000000`                                                                        | `#000000`            | Conteúdo sobre lima                                                 |
| `--cor-foco`                                      | `#E5F900`                                                                        | `#0A0A0A`            | Anel de foco                                                        |
| `--cor-sucesso`                                   | `#00F99B`                                                                        | `#00804F`            | Texto/ícone de sucesso                                              |
| `--cor-info`                                      | `#00BDF9`                                                                        | `#0072A3`            | Texto/ícone informativo                                             |
| `--cor-aviso`                                     | `#E5F900`                                                                        | `#7A6A00`            | Texto/ícone de atenção                                              |
| `--cor-erro`                                      | `#FF5A5F`                                                                        | `#C8102E`            | Erro e ponto de notificação                                         |
| `--cor-sobre-erro`                                | `#000000`                                                                        | `#FFFFFF`            | Conteúdo sobre `--cor-erro` (contagem do botão-ícone)               |
| `--cor-contorno-dado`                             | `transparent`                                                                    | `rgba(0,0,0,.45)`    | Contorno interno de 1px nos preenchimentos de dado (só no claro)    |
| `--cor-contorno-controle`                         | `transparent`                                                                    | `--cor-borda-forte`  | Contorno do botão-ícone neutro e da aba inativa (só no claro)       |
| `--cor-logo`                                      | `#FFFFFF`                                                                        | `#000000`            | Logo BRL CRM, sempre monocromático (§9)                             |
| `--dado-1` · `--dado-2` · `--dado-3` · `--dado-4` | ciano · menta · lima · coral                                                     | iguais               | Séries de gráficos, nesta ordem                                     |
| `--dado-2-gradiente`                              | `linear-gradient(90deg, #00E8B8 15%, #00F99B 55%, #46F86C 90%)`                  | igual                | Preenchimento da série 2 nas barras de funil (medido na referência) |
| `--gradiente-dados`                               | `linear-gradient(90deg, #00BDF9, #00F99B 50%, #E5F900)`                          | igual                | Destaques de dado                                                   |
| `--listras-destaque`                              | `repeating-linear-gradient(135deg, rgba(0,0,0,.07) 0 2px, transparent 2px 10px)` | igual                | Listras do cartão destaque (sobre o coral)                          |
| `--gradiente-palco`                               | ver §2.7                                                                         | ver §2.7             | Fundo do cartão principal (palco)                                   |

Os valores `-texto` de sucesso, info e aviso no tema claro existem porque menta, ciano e
lima não têm contraste como texto sobre branco. Como **preenchimento**, as cores base valem
nos dois temas — mas, no claro, um preenchimento de dado sozinho também não tem contraste
**gráfico** (WCAG 1.4.11, 3:1) com o branco: lima dá 1,17:1, menta 1,40:1 e ciano 2,18:1. Por
isso, no claro, todo preenchimento de dado leva um contorno interno de 1px em
`--cor-contorno-dado` (preto 45%; o contorno do lima fica em ~`#7E8900`, 3,8:1 sobre branco e
3,3:1 sobre `#EFEFEC`): bolinhas da legenda, pílula da barra de funil, avatares e pilha, selos
de dado (ciano, menta, lima e coral), o botão-ícone `marca` (lima) e o círculo lima do botão
pílula `marca`. No escuro o token é transparente. O texto sobre as cores continua preto. Todo
preenchimento novo de ciano, menta ou lima em `ui/` segue a mesma regra.

Da mesma forma, `--cor-contorno-controle` (a borda forte no claro, transparente no escuro)
contorna os controles neutros que quase somem no fundo claro: o botão-ícone neutro
(`#E8E8E4` sobre `#EFEFEC` dá 1,07:1) e a aba inativa (1,05:1). Sem mudar o tamanho de nada.

`--cor-texto-fraco` vale só sobre superfícies **opacas** (fundo, superfícies 1–3 e flutuante);
sobre vidro (`--cor-vidro`, `--cor-vidro-forte`, como dentro do palco) use `--cor-texto-suave`.

`--cor-texto-fraco` foi escurecido/clareado em relação à proposta inicial (`#8C8C8C` /
`#6E6E6E`) para passar AA (≥ 4,5:1) em **todas** as superfícies: no escuro, `#969696` dá
4,85:1 sobre `--cor-superficie-3` (a proposta dava 4,27); no claro, `#666666` dá 4,98:1
sobre `--cor-fundo` (a proposta dava 4,43).

### 2.3 Tipografia

Família: **Urbanist** (variável, pesos 100–900), auto-hospedada em `public/fonts/urbanist/`
sob a licença OFL. Pilha: `'Urbanist', 'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif`.
O case do Sugar cita a Urbanist, que é a alternativa livre da Gilroy usada nas telas.

Os tokens de fonte estão no formato do atalho `font` (peso, tamanho/altura e família):
use `font: var(--fonte-h2)`. A família está em `--familia` (e a monoespaçada, para código e
seletores, em `--familia-mono`: `ui-monospace, 'SF Mono', Menlo, Consolas, monospace`); o
tracking em `--tracking-display` (−0.02em) e `--tracking-titulo` (−0.01em). As mesmas escalas
existem como classes globais (`.texto-display`, `.texto-h1` … `.texto-micro`).

| Token                    | Tamanho / altura              | Peso | Uso                                                                       |
| ------------------------ | ----------------------------- | ---- | ------------------------------------------------------------------------- |
| `--fonte-display`        | 56px / 1.05, tracking −0.02em | 300  | Título da página ("Visão geral")                                          |
| `--fonte-numero`         | 56px / 1                      | 300  | Métricas grandes (KPI); a unidade fica em 0,7em (0,6em no indicador `sm`) |
| `--fonte-h1`             | 40px / 1.1                    | 300  | Títulos de seção grandes                                                  |
| `--fonte-h2`             | 28px / 1.2                    | 400  | Título de modais                                                          |
| `--fonte-h3`             | 20px / 1.3                    | 500  | Título de cartão ("Campos", "Etapas")                                     |
| `--fonte-lead`           | 17px / 1.5                    | 400  | A frase de topo das páginas ("Da captação do lead…")                      |
| `--fonte-corpo`          | 15px / 1.5                    | 400  | Texto corrido                                                             |
| `--fonte-corpo-sm`       | 14px / 1.5                    | 400  | Texto de balões (dica), "quando usar" do catálogo                         |
| `--fonte-rotulo`         | 14px / 1.2                    | 500  | Botões, pílulas, abas, chips                                              |
| `--fonte-legenda-lg`     | 13px / 1.35                   | 400  | Notas e metadados um pouco maiores que a legenda (nota do palco, status)  |
| `--fonte-legenda`        | 12px / 1.35                   | 400  | Legendas de KPI, metadados                                                |
| `--fonte-micro`          | 11px / 1.2                    | 500  | Rótulos dentro de barras de dado, selo `sm`                               |
| `--fonte-numero-pequeno` | 20px / 1.2                    | 300  | Total da etapa na barra de funil                                          |

O painel do palco é nomeado pela aba que o abre; o h2 dele fica só para leitores de tela
(`.visualmente-oculto`), para a estrutura de títulos da página continuar completa.

Abaixo de 900px (mobile, §5) o display cai para 36px. Abaixo de 600px: número 44px, h1
30px, h2 24px. Os próprios tokens mudam nas quebras; os componentes não precisam de media
query para isso.

**Título em dois tons:** a parte principal em `--cor-texto` e um complemento curto (até três
palavras, sem listas) em `--cor-texto-fraco`, no mesmo tamanho e peso ("Opportunity **ID**" na
referência; "Visão geral **· outubro de 2026**" aqui). Quando o título quebra (celular), o "·"
fica no **fim** da primeira linha e o complemento desce inteiro — nunca "· outubro" abrindo a
segunda linha, nem o complemento partido ao meio. A marcação:

```html
Visão geral&nbsp;<span class="tom-fraco">·</span>
<span class="tom-fraco sem-quebra">outubro de 2026</span>
```

O espaço inseparável prende o "·" ao título; o espaço comum depois dele é onde a linha pode
quebrar; `.sem-quebra` mantém o complemento inteiro. Num template Angular o espaço comum entre
dois elementos some (espaço em branco solto é removido): ponha-o dentro do primeiro span
(`<span class="tom-fraco">· </span><span class="tom-fraco sem-quebra">…</span>`), escrevendo os
elementos colados. `app-cartao`, `app-modal` e a seção do catálogo já fazem isso sozinhos a
partir do `complemento` que começa com "· " (a função `partirTitulo` de `ui/tipos.ts`).

Números usam `font-variant-numeric: tabular-nums` e formato pt-BR (`1.600`, `17 %`,
`R$ 48,2 mil`).

### 2.4 Espaçamento

Base de 4px: `--esp-1` 4 · `--esp-2` 8 · `--esp-3` 12 · `--esp-4` 16 · `--esp-5` 20 ·
`--esp-6` 24 · `--esp-8` 32 · `--esp-10` 40 · `--esp-12` 48 · `--esp-16` 64.

Padding de cartão: 24px (20px abaixo de 600px). Espaço entre cartões: 16px (12px no mobile).
Esses dois valores já mudam sozinhos nos tokens `--esp-cartao` e `--esp-entre-cartoes`.

Página: `--largura-pagina` (1600px) é a largura máxima do conteúdo das páginas;
`--casca-altura-topo` é a altura da barra superior fixa (76px; 68px abaixo de 900px). O
`<html>` tem `scroll-padding-top: calc(var(--casca-altura-topo) + var(--esp-4))`: ao rolar até
um elemento focado (Tab, Shift+Tab) ou até uma âncora, o navegador desconta a barra e o
degradê de 16px, e o foco nunca fica escondido sob ela (WCAG 2.4.11).

### 2.5 Raios

| Token           | Valor | Uso                                   |
| --------------- | ----- | ------------------------------------- |
| `--raio-sm`     | 12px  | Tooltips, itens pequenos              |
| `--raio-md`     | 16px  | Campos multilinha, miniaturas         |
| `--raio-lg`     | 24px  | Painéis internos, cartões no mobile   |
| `--raio-xl`     | 28px  | Cartões                               |
| `--raio-2xl`    | 36px  | Palco e modais                        |
| `--raio-pilula` | 999px | Pílulas, chips, selos, barras de dado |

Círculos usam `50%`. Os tokens `--raio-cartao` (28px; 24px abaixo de 900px) e
`--raio-palco` (36px; 28px abaixo de 900px) já trazem a troca do mobile.

### 2.6 Alturas de controle

`--altura-sm` 36px · `--altura-md` 44px (padrão) · `--altura-lg` 52px. O círculo de ícone
dentro de uma pílula mede a altura dela menos 8px — 4px de folga de cada lado, 36px na
pílula de 44px —, a proporção medida nas pílulas "Layout"/"Customizing" da referência
(a proposta inicial, −12px, deixava o círculo pequeno demais).

### 2.7 Elevação e o palco

- Tema escuro: quase sem sombra. A hierarquia vem do contraste entre `--cor-fundo` (preto)
  e as superfícies. Sombra só no que flutua (menus, modal, item arrastado):
  `--sombra-flutuante: 0 16px 40px rgba(0,0,0,.55)`.
- Tema claro: `--sombra-cartao: 0 1px 2px rgba(16,16,16,.04), 0 8px 24px rgba(16,16,16,.06)`
  e `--sombra-flutuante: 0 16px 40px rgba(16,16,16,.14)`.
- **Palco** (o cartão principal de cada tela, como o "Opportunity ID"): fundo com dois
  brilhos radiais suaves sobre a superfície.
  - Escuro (ajustado olhando a referência: verde-água no alto à esquerda, magenta-escuro
    embaixo à direita, sobre a mesma superfície dos cartões):
    `radial-gradient(90% 70% at 0% 0%, rgba(0,200,170,.14), transparent 60%),
radial-gradient(80% 70% at 100% 100%, rgba(190,70,160,.14), transparent 65%), #161616`
  - Claro: `radial-gradient(90% 70% at 0% 0%, rgba(0,189,249,.10), transparent 60%),
radial-gradient(80% 70% at 100% 100%, rgba(229,249,0,.20), transparent 65%), #FFFFFF`
- No tema escuro `--sombra-cartao` é `none`.

### 2.8 Movimento

`--duracao-rapida` 120ms · `--duracao` 200ms · `--duracao-lenta` 320ms ·
`--curva: cubic-bezier(.2, 0, 0, 1)`. Com `prefers-reduced-motion: reduce`, os três tokens
de duração viram 0ms e as animações param (regra global em `_base.scss`); só
`--duracao-opacidade` (120ms, fades curtos de balão e modal) continua.

Camadas: `--z-cabecalho` 20 · `--z-gaveta` 40 · `--z-flutuante` 60.

### 2.9 Pontos de quebra

`sm` 600px · `md` 900px · `lg` 1200px · `xl` 1440px. Desktop a partir de 1200px; tablet
entre 900 e 1199px; mobile abaixo de 900px.

Em SCSS, use os mixins de `_mixins.scss` (não escreva media query à mão):
`@include m.abaixo(m.$md) { … }` (< 900px), `@include m.acima(m.$lg) { … }` (≥ 1200px),
`@include m.toque { … }` (`pointer: coarse`) e `@include m.area-toque(4px, 4px)`, que amplia
a área clicável de um controle menor que 44px com um `::after` (o elemento precisa de
`position: relative`).

### 2.10 Utilitários globais

`src/styles/_utilitarios.scss`: `.visualmente-oculto` (só para leitores de tela),
`.texto-display` … `.texto-micro`, `.texto-suave`, `.texto-fraco`, `.tom-fraco` (segundo
tom dos títulos), `.sem-quebra` (`white-space: nowrap`: o complemento do título em dois tons,
um valor com a unidade), `.numeros` (algarismos tabulares), `.recorte` (anel da cor do fundo
em volta de um círculo, ajustável por `--recorte-largura` e `--recorte-cor`) e
`.rolagem-horizontal` (linha de pílulas que rola sem barra no mobile) e `.contador-filtros`
(o número de filtros ligados no botão "Filtros" do celular: quadro, auditoria, logs). O mesmo
arquivo inclui
o `.cdk-visually-hidden` do CDK (`@include cdk.a11y-visually-hidden()`): é a classe da região
viva do `LiveAnnouncer` (avisos, sino, kanban), que o CDK 22 não injeta sozinho — sem ela, o
texto anunciado aparece no pé da página. O link
`.link-pular` ("Pular para o conteúdo") está em `_base.scss`: fica fora da tela, sem
sombra e transparente até receber foco. Também em `_base.scss`: `.partida`, o "Carregando o
CRM…" que o `index.html` mostra dentro do `<app-root>` até o app montar (§3).

---

## 3. Tema claro/escuro

- `<html data-tema="escuro|claro">` e `color-scheme` coerente.
- Um script inline em `index.html` aplica o tema **antes da primeira pintura**: usa a
  escolha salva em `localStorage['crmbrl.tema']` ou, sem escolha, `prefers-color-scheme`.
  Não pode haver clarão do tema errado.
- Por causa do tema, o CSS global (`styles.css`, ~10 kB; ~2,5 kB com gzip) carrega
  **bloqueando a renderização**: no build de produção o CSS crítico inline está desligado
  (`optimization.styles.inlineCritical: false` no `angular.json`). Com ele ligado, o Beasties
  punha inline só o `:root` do tema escuro e carregava o resto sem bloquear — quem usa o claro
  via o fundo preto até o CSS chegar. O primeiro conteúdo pintado não muda (a SPA só pinta
  depois do JS) e sai o script inline que uma CSP estrita bloquearia.
- Partida: o `<app-root>` já vem com "Carregando o CRM…" (`.partida`, `role="status"`), no
  tema certo, até o Angular montar a casca. Se em 15 s o app não montar, o mesmo script do tema
  troca o texto por "Não conseguimos abrir o CRM. Verifique a internet e recarregue a página."
  (um só script inline, um só hash numa CSP). Depois de um deploy, a navegação para uma página
  cujo arquivo não existe mais recarrega a página de destino uma vez (`nucleo/recarga.ts`), e
  as páginas dos módulos que o papel acessa vêm em segundo plano depois de entrar
  (`nucleo/preload.ts`, `PreloadDoQueAcessa`: a tela de entrar não baixa o app inteiro, um
  membro não baixa Administração nem Integrações, e rotas com `data: { preload: false }`, como o
  catálogo `/design-system`, só abrem sob demanda).
- `TemaService` (`nucleo/tema.service.ts`) expõe os signals `tema()` (`'escuro' | 'claro'`),
  `ehEscuro()` e `segueSistema()`, e os métodos `alternar()`, `definir(tema)` e
  `seguirSistema()` (esquece a escolha). Enquanto o usuário não escolher, o tema acompanha
  as mudanças do sistema; depois da escolha, fica fixo. Outra aba que troque o tema é
  acompanhada (evento `storage`). Leituras de `localStorage` nunca quebram a tela
  (`nucleo/armazenamento.ts`).
- A `meta[name=theme-color]` acompanha `--cor-fundo` (`#000000` / `#EFEFEC`).
- O alternador fica na barra superior (`sun`/`moon`), com `aria-label` dizendo a ação
  ("Ativar tema claro").

---

## 4. Componentes

Todos ficam em `src/app/ui/`, são standalone, `OnPush` e usam apenas tokens. Componentes
que **são** botões ou links usam seletor de atributo sobre o elemento nativo
(`button[appBotao]`, `a[appBotao]`), para herdar semântica, foco e teclado. Inputs
booleanos aceitam a forma curta (`<button appBotao ativo>`). Ícones são passados como o
componente do Lucide (`[icone]="LucideShare2"`); tamanho e traço o componente resolve.

A tabela abaixo traz os componentes de base (os do painel da referência). Os de formulário
estão em §4.2, os de dados e listas em §4.3 e os de retorno e painéis em §4.4; todos têm a
linha de entradas e saídas em §4.1. Os de conversa (Atendimento e Chat da equipe, com o tempo
real nas telas) estão em §4.6, com a própria referência de entradas. Campos de formulário
funcionam com os formulários reativos do Angular (o próprio componente é o
`ControlValueAccessor`: `formControlName`, `[formControl]`, `ngModel`) ou soltos, com
`[(valor)]`. A única dependência além do Angular é o `@angular/cdk` (menu de ações,
`LiveAnnouncer` e a rolagem virtual da lista de mensagens); diálogos usam o `<dialog>` nativo.

| Componente                                   | Anatomia e variantes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Referência                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| **Botão pílula** `appBotao`                  | Pílula com ícone opcional dentro de um círculo à esquerda (altura − 8px) e rótulo 14/500. Variantes: `neutro` (superfície-2 + borda), `contorno` (transparente + borda forte), `invertido` (ação principal), `destaque` (coral), `marca` (pílula neutra com borda forte e o círculo lima com ícone preto, para IA, como a varinha da referência; no claro, o círculo leva o contorno `--cor-contorno-dado`; use sempre com ícone). Tamanhos `sm`/`md`/`lg`. `ativo` inverte o círculo (item selecionado, como "Layout"); `semCirculo` deixa o ícone solto (como "Share"). Estados: hover (clareia a superfície), ativo (leve escala), desabilitado (opacidade .4), carregando (ícone giratório, `aria-busy`, clique cancelado).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | "Layout", "Customizing", "Report Details", "Share"       |
| **Botão-ícone** `appBotaoIcone`              | Círculo 44px (36/52). Variantes `neutro` (superfície-3; no claro, contorno `--cor-contorno-controle`), `contorno`, `invertido` (branco com ícone preto no escuro), `destaque` (coral: selecionado/ativo) e `marca` (lima, ações de IA; no claro, contorno `--cor-contorno-dado`). Ponto de notificação opcional (8px, `--cor-erro`, anel `--botao-icone-anel`, padrão a cor do fundo) ou contagem ("2", "9+"). `rotulo` obrigatório: vira `aria-label` e `title`. Com `aria-pressed="true"` fica invertido (alternância, como o seletor de visualização da referência).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ←, desfazer/refazer, sino, "»", varinha                  |
| **Abas** `app-abas`                          | Linha de pílulas. Inativa: superfície-2 e texto suave. Ativa: **invertida** (pílula branca no escuro), para destacar sem depender de cor. Variante `entalhe`: a aba ativa tem a cor do painel e cantos invertidos na base (o "entalhe" da referência), cor em `--abas-entalhe-fundo` (sólida). Abaixo de 600px o entalhe vira pílulas (a ativa invertida) sobre o mesmo painel, com os quatro cantos arredondados. Modo `opcoes`: controle segmentado (`radiogroup`) num trilho em pílula, para filtros como período; não rola, e no toque cada opção de 28px ganha 44px de alvo. A aba inativa tem, no claro, o contorno `--cor-contorno-controle`. Quando a linha não cabe, ela rola na horizontal: a borda com abas escondidas esmaece (24px) e a aba selecionada é trazida para dentro da área visível (só a lista rola, nunca a página). O anel de foco fica por dentro na aba do entalhe e a 1px no trilho das opções. `role="tablist"`/`tab`/`tabpanel`, setas, Home e End, ativação automática.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | "Funnel Conversion ×", "Web Traffic", "CQ Pipeline"      |
| **Chip** `app-chip`                          | Pílula 36px (44px em tela de toque) com selo circular de tipo (altura − 8px: `A` texto, `#` número, ícone `calendar-days` para data, ou um ícone qualquer) e rótulo. Estados: normal (superfície-2 + borda), hover (arrastável), selecionado (coral sólido, texto preto), arrastando (vidro tingido de coral, borda coral, sombra flutuante, −4°; o texto segue a cor do tema). `arrastavel` liga o `draggable` nativo; `multilinha` deixa o rótulo longo quebrar a linha em vez de cortar com reticências. É visual: para um chip clicável, ponha-o dentro de um `<button>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Lista "Fields", "Forecast Category" sendo arrastado      |
| **Selo** `app-selo`                          | Pílula 24px, 12/500, algarismos tabulares (`tamanho="sm"`: 20px, 11/500, padding 6px, para listas densas como o "em breve" da navegação). `neutro` (vidro forte + texto suave, como "4d"; funciona sobre o palco), `ciano`, `menta`, `lima`, `coral` (preenchidos, texto preto; no claro, contorno `--cor-contorno-dado`), `contorno`. Opcionais: ícone e um ponto (`ponto`, ex.: "ao vivo") na cor de `--selo-ponto` (padrão: a cor do texto; o Status do sistema usa `--cor-sucesso` com a API no ar), que pulsa três vezes (~5 s) e para.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | "4d", "8d", "22d"                                        |
| **Cartão** `app-cartao`                      | Superfície, `--raio-cartao`, padding `--esp-cartao`, cabeçalho opcional (título h3 visual + complemento em segundo tom + dica + ações projetadas com `cartao-acoes`). Variantes: `padrao`, `palco` (gradiente do palco, `--raio-palco`, padding 32px; dentro dele superfícies 2/3 viram vidro) e `destaque` (coral com `--listras-destaque`; dentro dele texto, bordas e superfícies viram tons de preto — texto e texto fraco em preto 78%, superfície-3 em preto 8%, para a legenda de 12px e o selo do chip passarem de 4,5:1 até sobre a listra —, e os componentes se adaptam sozinhos). O complemento que começa com "· " segue a regra do título em dois tons (§2.3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | "Visualization", palco "Opportunity ID", cartão "Stages" |
| **Avatar** `app-avatar`                      | Círculo com foto ou iniciais (foto que falha cai para as iniciais). A cor de fundo sai do nome (ciano/menta/lima/coral, estável), ou de `cor`; no claro, contorno interno `--cor-contorno-dado`. Tamanhos 32/44/56. Forma `pilula` (1,45× mais larga), a da pilha. Imagem acessível com o nome, ou `decorativo`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Avatares da equipe                                       |
| **Pilha de avatares** `app-pilha-avatares`   | Avatares-pílula sobrepostos (−30% do lado), nas cores ciano → menta → lima → coral, com anel `--pilha-anel` (padrão a cor do fundo), e um círculo translúcido "+k" com o restante. Mostra até `maximo` (3). Para leitores de tela é uma imagem só ("Equipe: Ana, Bruno, Carla e mais 2 pessoas"); a mesma frase aparece no `title`, ao passar o mouse.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Pilha ao lado de "Share"                                 |
| **Indicador** `app-indicador`                | Número 56/300 (ou 40/300 no tamanho `sm`) + unidade em 0,7em com vão de 0,3em (medido na referência: 0,66–0,88 da altura do algarismo; no `sm`, 0,6em e 0,14em) + legenda 12px em até duas linhas, em texto fraco, abaixo ou ao lado (`disposicao="lado"`, como no palco: legenda de até 9em à direita; sem espaço, ela desce inteira e o número nunca quebra). `lado` serve para um ou dois indicadores curtos; com três ou mais, `abaixo`. Prefixo opcional ("R$"). Prefixo, número e unidade formam um par que **nunca quebra** (`.sem-quebra`: "mil" nunca desce sozinho). Em `abaixo` o indicador ocupa a largura que a célula der e a linha do número é um contêiner (container queries): o número encolhe **de forma contínua** só quando a célula fica mais estreita que ele — `min(1em, 100cqi / largura do par em em)` —, sem mudar o peso 300. O componente mede o próprio par depois de renderizar (e quando o texto, o tamanho ou a fonte mudam) e grava a largura em `--_numero-em`; até lá vale 3,9em (3,4em no `sm`), a de "R$ 42,4 mil". O contêiner é a linha do número, não o indicador, para ele continuar podendo ser item de subgrid (legendas alinhadas entre células). Numa linha flex, o indicador tem largura mínima de 14rem (8,5rem no `sm`), para não encolher até a largura da legenda. Variação opcional num selo com seta (menta para alta, coral para queda; `quedaEhBoa` inverte), na unidade de `unidadeVariacao` (`%` relativa, `p.p.` quando o indicador é uma taxa, `pts` para notas; o leitor de tela ouve "Alta de 2,1 pontos percentuais") e, com `variacaoAbaixo`, numa linha própria (cartões estreitos, a linha de quatro KPIs). Dica opcional. Valor numérico formatado em pt-BR. | "17 %", "12 d"                                           |
| **Barra de funil** `app-barra-funil`         | Ver §6.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Barras ciano → menta → lima                              |
| **Legenda** `app-legenda`                    | Bolinhas de 10px nas cores de dado (no claro, com o contorno `--cor-contorno-dado`), na ordem das séries, com o nome de cada uma. Acompanha todo gráfico com mais de uma série.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Legenda das séries                                       |
| **Zona de soltar** `app-zona-soltar`         | Área com borda tracejada, círculo "+" contornado (36px) e legenda fraca ("Solte um campo aqui"). Enquanto um item passa por cima (arrastar nativo do HTML): borda coral, fundo levemente coral e círculo coral. Ao soltar emite o texto arrastado. Arrastar não funciona por teclado: ofereça sempre um botão para a mesma ação.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | "Drop Field Here"                                        |
| **Dica** `app-dica`                          | Botão "?" (`circle-question-mark`, 28px de desenho, 44px de alvo) que abre um balão com o texto (e um título opcional). Abre com clique, toque, Enter ou Espaço; fecha com Esc, clique fora, novo clique ou quando o foco vai para outro controle (Tab), para não cobrir o próximo (o balão não tem nada interativo). Usa a Popover API (camada superior: não é cortado por `overflow`), posiciona-se abaixo do botão ou acima quando falta espaço, acompanha a rolagem e cabe na largura do celular; sem a API cai para um balão absoluto com os mesmos atalhos. O botão tem `aria-describedby` apontando para o balão. `abrir()` abre o balão (e põe o foco no "?") para um gatilho maior, como as pílulas "Passagens" e "Rodízio" do quadro, que abrem a dica com um clique em qualquer lugar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Requisito do produto: telas autoexplicativas             |
| **Modal** `app-modal`                        | `<dialog>` nativo com `showModal()` (foco preso, Esc e camada superior nativos; o foco volta para quem abriu), `--raio-2xl`, fundo `--cor-superficie`, véu `--cor-veu` com desfoque, título h2 em dois tons (§2.3), botão fechar (botão-ícone), corpo com rolagem e rodapé projetado com `modal-rodape`. Clique no véu fecha. Larguras `sm` 420 · `md` 560 · `lg` 720 · `xl` 1120 (altura de até 860px; **tela cheia no celular**, para assistentes em passos).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | —                                                        |
| **Campo de busca** `app-campo-busca`         | Pílula 44px com ícone `search`, superfície-2, placeholder em texto fraco, dentro de um `<form role="search">` nomeado pelo `rotulo` (que também é o rótulo do campo para leitores de tela: "Buscar no CRM"). Botão de limpar (32px de desenho, 44px de alvo) quando há texto; Esc limpa; Enter busca. O anel de foco fica na pílula inteira.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | —                                                        |
| **Alternador de tema** `app-alternador-tema` | Botão-ícone ligado ao `TemaService`. O ícone e o `aria-label` mostram a **ação** (sol + "Ativar tema claro" no escuro; lua + "Ativar tema escuro" no claro).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | —                                                        |
| **Logo** `app-logo`                          | Ver §9.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | —                                                        |

Ícones: **Lucide** (`@lucide/angular`), traço 1.75 (padrão global em `provideLucideConfig`;
use `[strokeWidth]="1.5"` acima de 24px), tamanho 20px em controles md (16 em sm, 22 em
lg), cor `currentColor`. O `@lucide/angular` já põe `aria-hidden="true"` em todo ícone sem
`title`; ícone sozinho num botão exige `aria-label` no botão. Cada ícone é um componente
standalone aplicado num `<svg>`: `<svg lucideHouse [size]="20" />` com
`imports: [LucideHouse]`, ou dinâmico com `<svg [lucideIcon]="icone" />` e
`imports: [LucideDynamicIcon]`.

**Ícones e o bundle inicial.** Cada ícone já é importado só no componente que o usa, mas o
`@lucide/angular` é um arquivo único (`fesm2022/lucide-angular.mjs`) e o esbuild divide os chunks
por arquivo, não por ícone: se o `main` importar o pacote, **todo ícone usado em qualquer tela
vai para o chunk inicial** (~3 kB cada sem compressão). Foi o que aconteceu no meio da Fase 1
(21/10/2026): o inicial passou de ~465 kB para ~523 kB, acima do limite de aviso de 500 kB
(`angular.json`). Por isso o pacote fica **fora do `main`**:

- a configuração do Lucide (`provideIcones()` em `layout/icones.ts`, traço 1.75 e 20px) vai nos
  `providers` das duas cascas (`Casca` e `CascaAcesso`), não no `app.config.ts`;
- a guarda, a sessão e as rotas leem os módulos em `nucleo/modulos.ts`, **sem** ícones;
  `nucleo/navegacao.ts` acrescenta os ícones para o menu e a página "em breve", e só a casca o
  importa.

Assim os ícones chegam num chunk junto com a casca, e o inicial ficou em ~354 kB (102 kB com
compressão) no fim da Fase 1, sem crescer quando uma tela ganha um ícone novo. Mesmo assim,
prefira um ícone que o app já usa; o catálogo usa só ícones que as telas já usam. Não importe
`@lucide/angular` nem `nucleo/navegacao.ts` em nada que o `main` carregue (`app.config.ts`,
`app.routes.ts`, guardas, serviços do núcleo).

### 4.1 Referência rápida (seletores e entradas)

Valores padrão entre parênteses. `[(x)]` indica ligação de duas vias (`model()`).

| Componente                                  | Entradas e saídas                                                                                                                                                                                                                                                                                                                                                                                        | Exemplo                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `button[appBotao]`, `a[appBotao]`           | `variante` (`neutro`) · `tamanho` (`md`) · `icone` · `ativo` · `carregando` · `semCirculo`                                                                                                                                                                                                                                                                                                               | `<button appBotao variante="invertido" [icone]="LucideShare2">Compartilhar</button>`                                  |
| `button[appBotaoIcone]`, `a[appBotaoIcone]` | `icone`* · `rotulo`* · `variante` (`neutro`) · `tamanho` (`md`) · `ponto` · `contagem`                                                                                                                                                                                                                                                                                                                   | `<button appBotaoIcone [icone]="LucideBell" rotulo="Notificações" ponto></button>`                                    |
| `app-abas`                                  | `abas`* (`{ id, rotulo, icone? }[]`) · `rotulo`* · `[(selecionada)]` · `variante` (`pilulas` \| `entalhe`) · `modo` (`abas` \| `opcoes`) · `tamanho` (`md` \| `sm`); conteúdo projetado no painel                                                                                                                                                                                                        | `<app-abas rotulo="Visões" [abas]="abas" [(selecionada)]="aba">…</app-abas>`                                          |
| `app-chip`                                  | `tipo` (`texto` \| `numero` \| `data`) · `icone` · `selecionado` · `arrastando` · `arrastavel` · `multilinha`                                                                                                                                                                                                                                                                                            | `<app-chip tipo="numero">Valor</app-chip>`                                                                            |
| `app-selo`                                  | `variante` (`neutro`) · `tamanho` (`md` \| `sm`) · `icone` · `ponto`                                                                                                                                                                                                                                                                                                                                     | `<app-selo tamanho="sm">em breve</app-selo>`                                                                          |
| `app-cartao`                                | `variante` (`padrao` \| `palco` \| `destaque`) · `titulo` · `complemento` · `nivel` (2) · `dica` · `regiao`; ações com `cartao-acoes`                                                                                                                                                                                                                                                                    | `<app-cartao titulo="Atividades recentes" [nivel]="3">…</app-cartao>`                                                 |
| `app-avatar`                                | `nome`* · `foto` · `tamanho` (`md`) · `forma` (`circulo` \| `pilula`) · `cor` · `decorativo`                                                                                                                                                                                                                                                                                                             | `<app-avatar nome="Ana Ribeiro" tamanho="sm" />`                                                                      |
| `app-pilha-avatares`                        | `pessoas`* (`{ nome, foto? }[]`) · `maximo` (3) · `tamanho` (`md` \| `sm`) · `rotulo` (`Equipe`)                                                                                                                                                                                                                                                                                                         | `<app-pilha-avatares [pessoas]="equipe" />`                                                                           |
| `app-indicador`                             | `valor`* · `legenda`* · `unidade` · `prefixo` · `variacao` · `unidadeVariacao` (`%` \| `p.p.` \| `pts`) · `variacaoAbaixo` · `quedaEhBoa` · `dica` · `disposicao` (`abaixo` \| `lado`) · `tamanho` (`md` \| `sm`) · `casas` (`1.0-1`)                                                                                                                                                                    | `<app-indicador [valor]="17" unidade="%" legenda="Conversão total do funil" />`                                       |
| `app-barra-funil`                           | `etapa`* · `total`* · `series`* (`{ rotulo, valor }[]`) · `totalReferencia` · `queda` · `tempoMedioDias`                                                                                                                                                                                                                                                                                                 | `<app-barra-funil etapa="Leads" [total]="1600" [series]="s" [tempoMedioDias]="4" />`                                  |
| `app-legenda`                               | `series`* (nomes)                                                                                                                                                                                                                                                                                                                                                                                        | `<app-legenda [series]="['Site', 'WhatsApp']" />`                                                                     |
| `app-zona-soltar`                           | `legenda` · `ativa` · `(soltar)` (texto arrastado)                                                                                                                                                                                                                                                                                                                                                       | `<app-zona-soltar (soltar)="adicionar($event)" />`                                                                    |
| `app-dica`                                  | `texto`* · `rotulo` (`Mais informações`) · `titulo`                                                                                                                                                                                                                                                                                                                                                      | `<app-dica rotulo="O que é MRR?" texto="Receita recorrente mensal." />`                                               |
| `app-modal`                                 | `[(aberto)]` · `titulo`* · `complemento` · `largura` (`md`) · `(fechado)` · método `fechar()`; rodapé com `modal-rodape`                                                                                                                                                                                                                                                                                 | `<app-modal [(aberto)]="aberto" titulo="Análise com IA" complemento="· beta">…</app-modal>`                           |
| `app-campo-busca`                           | `[(valor)]` · `rotulo` (`Buscar`) · `placeholder` (`Buscar…`) · `(buscar)` · método `focar()`                                                                                                                                                                                                                                                                                                            | `<app-campo-busca [(valor)]="termo" (buscar)="buscar($event)" />`                                                     |
| `app-alternador-tema`                       | `variante` (`neutro`) · `tamanho` (`md`)                                                                                                                                                                                                                                                                                                                                                                 | `<app-alternador-tema />`                                                                                             |
| `app-logo`                                  | `somenteSimbolo` · `tamanho` (40)                                                                                                                                                                                                                                                                                                                                                                        | `<app-logo somenteSimbolo />`                                                                                         |
| `app-campo-texto`                           | campo† · `[(valor)]` (texto; número ou `null` com `tipo="number"`) · `tipo` (`text` \| `email` \| `tel` \| `url` \| `number`) · `placeholder` · `autocomplete` · `teclado` · `prefixo` · `sufixo` · `maximoCaracteres` · `minimo` · `maximo` · `passo` · `somenteLeitura` · `nome`                                                                                                                       | `<app-campo-texto rotulo="E-mail" tipo="email" autocomplete="email" formControlName="email" />`                       |
| `app-campo-senha`                           | campo† · `[(valor)]` · `autocomplete` (`current-password` \| `new-password` \| `off`) · `placeholder` · `nome`                                                                                                                                                                                                                                                                                           | `<app-campo-senha rotulo="Nova senha" autocomplete="new-password" formControlName="senha" />`                         |
| `app-area-texto`                            | campo† · `[(valor)]` · `linhas` (4) · `maximoLinhas` (12) · `maximoCaracteres` · `monoespacado` · `somenteLeitura` · `placeholder` · `nome`                                                                                                                                                                                                                                                              | `<app-area-texto rotulo="Motivo da perda" [maximoCaracteres]="500" formControlName="motivo" />`                       |
| `app-seletor`                               | campo† · `[(valor)]` (`null` sem escolha) · `opcoes`* (`{ valor, rotulo, desabilitada? }[]`) · `placeholder` (`Escolha uma opção`) · `permitirVazio` · `comparar` (`Object.is`) · `nome`                                                                                                                                                                                                                 | `<app-seletor rotulo="Papel" [opcoes]="papeis" formControlName="papel" />`                                            |
| `app-campo-data`                            | campo† · `[(valor)]` (texto local ou `null`) · `tipo` (`data` \| `data-hora` \| `hora`) · `minimo` · `maximo` · `passo` · `nome`; funções `localParaIso` e `isoParaLocal`                                                                                                                                                                                                                                | `<app-campo-data rotulo="Vence em" tipo="data-hora" formControlName="venceEm" />`                                     |
| `app-caixa-selecao`                         | campo† · `[(valor)]` (booleano) · `[(indeterminado)]` · `tamanho` (`md` \| `lg`) · `forma` (`quadrado` \| `circulo`) · `nome`                                                                                                                                                                                                                                                                            | `<app-caixa-selecao rotulo="Aceito receber novidades" formControlName="optIn" />`                                     |
| `app-alternador`                            | campo† · `[(valor)]` (booleano) · `nome`                                                                                                                                                                                                                                                                                                                                                                 | `<app-alternador rotulo="Participa do rodízio" [(valor)]="noRodizio" />`                                              |
| `app-grupo-opcoes`                          | campo† · `[(valor)]` · `opcoes`* (`{ valor, rotulo, dica?, icone?, desabilitada? }[]`) · `disposicao` (`lista` \| `pilulas`) · `comparar` (`Object.is`)                                                                                                                                                                                                                                                  | `<app-grupo-opcoes rotulo="Tipo" disposicao="pilulas" [opcoes]="tipos" formControlName="tipo" />`                     |
| `app-moldura-campo`                         | `rotulo`* · `paraId`* (id do controle) · `idDica` · `idErro` · `dica` · `erro` (mensagem pronta) · `ajuda` · `opcional` · `rotuloOculto`; o controle é projetado                                                                                                                                                                                                                                         | `<app-moldura-campo rotulo="Contato" [paraId]="id">…</app-moldura-campo>`                                             |
| `app-filtros-pilula`                        | `opcoes`* (`{ id, rotulo, icone?, contagem?, desabilitada?, motivo? }[]`) · `rotulo`* · `multipla` · `[(selecionado)]` (id) · `[(selecionados)]` (ids, com `multipla`)                                                                                                                                                                                                                                   | `<app-filtros-pilula rotulo="Mostrar" [opcoes]="escopos" [(selecionado)]="escopo" />`                                 |
| `app-tabela`                                | `rotulo`* · `colunas`* (`{ id, rotulo, ordenavel?, alinhar?, largura?, noCartao?, rotuloOculto? }[]`) · `linhas` · `chave` (`linha.id`) · `[(ordenacao)]` (`{ coluna, direcao }`) · `carregando` · `linhasEsqueleto` (5) · `densa` · `link` (linha → `routerLink`) · `clicavel` + `(abrir)` (a linha) · `colunaPrincipal` (a primeira); células com `ng-template[appCelula]`; vazio com `[tabela-vazio]` | `<app-tabela rotulo="Contatos" [colunas]="colunas" [linhas]="itens()" [link]="linkDoContato" />`                      |
| `app-paginacao`                             | `total`* · `[(pagina)]` (1) · `[(porPagina)]` (20) · `opcoesPorPagina` · `rotulo` (`Paginação`)                                                                                                                                                                                                                                                                                                          | `<app-paginacao rotulo="Paginação dos contatos" [total]="total()" [(pagina)]="pagina" />`                             |
| `app-esqueleto`                             | `forma` (`texto` \| `bloco` \| `pilula` \| `circulo`) · `largura` · `altura` · `linhas` (1)                                                                                                                                                                                                                                                                                                              | `<app-esqueleto forma="texto" [linhas]="2" largura="60%" />`                                                          |
| `app-estado-vazio`                          | `titulo`* · `texto` · `variante` (`vazio` \| `busca` \| `erro` \| `sem-acesso`) · `icone` · `codigo` (`requisicaoId`) · `compacto`; a ação é projetada                                                                                                                                                                                                                                                   | `<app-estado-vazio titulo="Nenhum contato ainda" texto="…"><button appBotao>Novo contato</button></app-estado-vazio>` |
| `app-avisos`                                | `avisos` (`{ id, tipo, mensagem, titulo?, acao?, codigo?, duracao? }[]`) · `(dispensar)` (id) · `(agir)` (id)                                                                                                                                                                                                                                                                                            | `<app-avisos [avisos]="avisos.lista()" (dispensar)="avisos.dispensar($event)" (agir)="avisos.agir($event)" />`        |
| `app-painel-lateral`                        | `[(aberto)]` · `titulo`* · `complemento` · `descricao` · `largura` (`md` \| `lg` \| `xl`) · `(fechado)` · método `fechar()`; ações com `painel-acoes`, rodapé com `painel-rodape`                                                                                                                                                                                                                        | `<app-painel-lateral [(aberto)]="aberto" titulo="Escola Horizonte" complemento="· Proposta">…</app-painel-lateral>`   |
| `app-menu-acoes`                            | `itens`* (`{ id, rotulo, icone?, perigo?, desabilitado?, motivo?, separarAntes? }[]`) · `rotulo`* · `texto` · `icone` · `variante` (`contorno`) · `varianteTexto` (`contorno`) · `tamanho` (`sm`) · `(escolher)` (o item)                                                                                                                                                                                | `<app-menu-acoes rotulo="Ações de Maria Souza" [itens]="acoes" (escolher)="agir($event)" />`                          |

\* obrigatório. † entradas comuns a todos os campos (`CampoBase`): `rotulo`* · `dica` (texto
abaixo) · `ajuda` (balão `app-dica` ao lado do rótulo) · `erro` (texto da tela; vence o do
controle) · `mensagens` (por chave de erro) · `opcional` · `obrigatorio` · `desabilitado` ·
`rotuloOculto`; método `focar()`. Propriedades CSS que os componentes leem do contexto:
`--abas-entalhe-fundo`, `--botao-icone-anel`, `--pilha-anel`, `--funil-coluna-total` (largura da
coluna do total na barra de funil), `--selo-ponto` (cor do ponto do selo), `--estado-anel` (anel
do círculo da ilustração do estado vazio; padrão `--cor-superficie`) e
`--recorte-cor`/`--recorte-largura` (utilitário `.recorte`).

### 4.2 Formulários

Os campos de `ui/` seguem a mesma anatomia, desenhada pela `app-moldura-campo`: **rótulo**
(14/500, `for` ligado ao controle; "(opcional)" em texto suave, nunca asterisco), **ajuda**
opcional num `app-dica` ao lado do rótulo, o **controle**, o **erro** (`--fonte-legenda-lg`,
peso 500, em `--cor-erro`) e a **dica** (`--fonte-legenda-lg`, texto suave) embaixo. Rótulo,
erro e dica começam no recuo do texto da pílula (16px), alinhados com o que se digita. O
controle recebe `aria-describedby` com o erro primeiro e a dica depois, `aria-invalid` quando há
erro e `aria-required` quando o controle tem `Validators.required`/`requiredTrue` (ou
`obrigatorio`).

**O controle** é uma pílula de 44px (`--raio-pilula`), fundo `--cor-superficie-2`, borda
`--cor-borda-forte`, texto `--fonte-corpo` e placeholder em `--cor-texto-fraco`; no hover a
borda escurece/clareia, com erro fica `--cor-erro`, desabilitado fica com opacidade .5. O anel
de foco (`--cor-foco`) envolve a pílula inteira (`:focus-within`), como no campo de busca. O
mixin está em `ui/campo/_campo.scss` (`@use '../campo/campo' as c;`).

**Quando o erro aparece.** O erro do controle só aparece depois que a pessoa sai do campo
(tocado) ou envia o formulário — nunca enquanto ainda digita pela primeira vez. A mensagem vem,
nesta ordem: do `erro` passado pela tela (é assim que a mensagem da API de um 422
`regra_violada` vai para o campo certo), de `mensagens[chave]`, do próprio valor do erro quando
é texto (`controle.setErrors({ api: 'Este e-mail já está em uso.' })`) ou das mensagens padrão
em `ui/campo/mensagens-erro.ts`, sem jargão: "Preencha este campo.", "Digite um e-mail válido,
como nome@empresa.com.br.", "Use pelo menos 8 caracteres.", "O menor valor aceito é 0." (o
seletor diz "Escolha uma opção."; a caixa obrigatória, "Marque esta opção para continuar.").
Depois de enviar com erro, a tela põe o foco no primeiro campo inválido (`focar()`).

| Componente                               | Anatomia e variantes                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Campo de texto** `app-campo-texto`     | A pílula com um `<input>`. Tipos `text`, `email`, `tel`, `url` e `number` (o valor vira número, vazio é `null`; teclado decimal no celular). `prefixo`/`sufixo` ("R$", "%", "dias") ficam dentro da pílula, em texto suave e algarismos tabulares, e entram no `aria-describedby`. O valor só é escrito no elemento quando não veio dele (um número pela metade não é apagado a cada tecla).                                                                                      |
| **Campo de senha** `app-campo-senha`     | A mesma pílula com um botão olho à direita (mostrar/ocultar, `aria-pressed`, 44px de alvo) e o aviso "Caps Lock ligado: as letras saem maiúsculas." numa região viva enquanto o campo está focado. `autocomplete` `current-password` para entrar e `new-password` para criar/trocar.                                                                                                                                                                                              |
| **Área de texto** `app-area-texto`       | Várias linhas com `--raio-md` (não pílula). Cresce com o texto até `maximoLinhas` (`field-sizing: content` onde houver); com `maximoCaracteres` mostra "120 de 500" à direita, embaixo. `monoespacado` para JSON e cabeçalhos (webhooks).                                                                                                                                                                                                                                         |
| **Seletor** `app-seletor`                | `<select>` nativo na pílula, com seta `chevron-down` à direita: lista do sistema no celular, teclado e leitor de tela completos. A primeira linha é o `placeholder` e não pode ser escolhida de volta, salvo com `permitirVazio` (então é "nenhum": "Sem líder"). Valor de qualquer tipo (id, objeto com `comparar`). Para listas longas com busca, a tela usa a moldura em volta de um controle próprio.                                                                         |
| **Data e hora** `app-campo-data`         | `<input type="date\|datetime-local\|time">` nativo na pílula, com o ícone de calendário/relógio do sistema num círculo de 36px que acende no hover (a cor segue o `color-scheme` do tema); vazio, o formato (`dd/mm/aaaa`) fica em texto fraco. O valor é o texto local (`2026-10-21`, `2026-10-21T10:00`, `10:00`); para a API, `localParaIso(valor, tipo)` e, na volta, `isoParaLocal(iso, tipo)` (fuso do navegador). `minimo`/`maximo`/`passo` (em segundos para hora).       |
| **Caixa de seleção** `app-caixa-selecao` | `<input type="checkbox">` nativo desenhado como quadrado de 22px com raio grande (ou círculo, `forma="circulo"`; `tamanho="lg"` 28px para concluir atividade). Borda `--cor-texto-fraco` (≥ 3:1); marcada fica **invertida** (`--cor-inverso`) com o visto; `indeterminado` mostra um traço. Rótulo à direita, `dica` como descrição embaixo, linha de 44px de alvo. `rotuloOculto` para a caixa sozinha numa linha de lista.                                                     |
| **Alternador** `app-alternador`          | `<input type="checkbox" role="switch">` (o leitor diz "ligado/desligado"): trilho de 48 × 28px à direita, rótulo e descrição à esquerda, linha de 44px. Desligado: superfície-3 com borda em texto fraco e a bolinha à esquerda; ligado: trilho **invertido**, bolinha à direita com um visto (não depende de cor). Só para efeito imediato, sem botão Salvar.                                                                                                                    |
| **Grupo de opções** `app-grupo-opcoes`   | Rádios nativos com o mesmo `name` num `role="radiogroup"` nomeado pelo rótulo (setas mudam a escolha, Tab entra e sai). `disposicao="lista"`: uma opção por linha com círculo de 22px e descrição (`dica`), hover em vidro (`--raio-lg`); marcada, o círculo vira um anel **invertido** grosso; `disposicao="pilulas"`: pílulas lado a lado com ícone opcional num círculo, a escolhida **invertida** (como "Layout" na referência). Até ~6 opções; mais que isso, `app-seletor`. |
| **Moldura** `app-moldura-campo`          | Rótulo, ajuda, erro e dica em volta de um controle projetado: para um controle próprio de uma tela (ex.: busca de contato com sugestões) ter a mesma anatomia e os mesmos ids.                                                                                                                                                                                                                                                                                                    |

Regras de formulário: um rótulo por campo, sempre visível (o `rotuloOculto` é só para filtros
numa barra e controles dentro de tabela); o botão principal é `invertido` e fica à esquerda,
depois os secundários em `contorno`; valores monetários usam `tipo="number"` com `prefixo="R$"`
e `[passo]="0.01"` (a API recebe a string decimal); datas e horas sempre com os controles
nativos (sem biblioteca de máscara ou calendário).

### 4.3 Dados e listas

Uma tela de lista é: frase de topo, **filtros em pílula**, a **tabela** (cartões no celular) e
a **paginação**. Enquanto carrega, **esqueletos** com a forma do conteúdo; sem nada, o **estado
vazio** com a frase e a ação que resolve; em erro, o mesmo estado com "Tentar de novo".

| Componente                                 | Anatomia e variantes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Filtros em pílula** `app-filtros-pilula` | Linha de botões em pílula (`aria-pressed`) num `role="group"` nomeado; o ligado fica **invertido**. Escolha única (`[(selecionado)]`) ou múltipla (`multipla`, `[(selecionados)]`). Ícone opcional num círculo e `contagem` num selo. Filtro indisponível para o papel continua visível, `aria-disabled`, com o `motivo` lido pelo leitor de tela e no `title` ("Só C-level e Admin veem todos."). No celular a linha rola na horizontal até a borda (`.rolagem-horizontal`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Tabela** `app-tabela`                    | Cabeçalho em `--fonte-legenda` e texto suave, linhas de 56px (44px com `densa`, para auditoria e logs) separadas por `--cor-borda`; hover da linha em vidro com cantos `--raio-md`. Ordenação nas colunas `ordenavel`: botão no cabeçalho com setas (`aria-sort`), anunciada ("Ordenado por Nome, crescente"); a tela ordena (API ou memória) a partir de `[(ordenacao)]`. **Linha que abre**: com `link` (rota) ou `clicavel` + `(abrir)` (painel lateral), o conteúdo da coluna principal vira link/botão esticado sobre a linha inteira; Tab chega nele e Enter abre; outros botões da linha (menu "⋯") continuam clicáveis por cima. **Células** por `<ng-template appCelula="id" let-linha>`; sem modelo, mostra `linha[id]`. **Carregando**: linhas-esqueleto com larguras variadas, `aria-busy` e "Carregando…" num `role="status"`. **Vazia**: mostra o conteúdo projetado com `tabela-vazio`. **Contêiner estreito** (< 40rem, por container query, não pela janela): vira **lista de cartões** (`--raio-lg`, superfície-2): a coluna principal é o título, as outras viram "rótulo: valor" (`noCartao: 'ocultar'` esconde; `'titulo'` promove), e a ordenação passa a um seletor "Ordenar por" acima dos cartões. **Coluna fixa** (`fixa: true`, a de ações "⋯"): fica presa à borda direita quando a tabela rola na horizontal, com o fundo `--tabela-fundo` (padrão `--cor-fundo`; dentro de um cartão, defina a superfície dele). A rolagem é `position: relative`: nada posicionado na tabela (o texto oculto do cabeçalho, o link esticado) faz a página rolar. |
| **Paginação** `app-paginacao`              | Para as listas `?pagina=&porPagina=`. "21–40 de 134" à esquerda, anterior/próxima em botões-ícone e as páginas em pílulas de 36px com reticências (1 … 4 5 6 … 12) no centro; a atual fica **invertida**, com `aria-current="page"`. Anterior/próxima nas pontas ficam `aria-disabled` (não perdem o foco). Com `opcoesPorPagina`, um seletor "Por página" à direita (muda `[(porPagina)]` e volta à página 1). Abaixo de 600px: só "Página 2 de 7" entre as setas. Listas por cursor (auditoria, logs) usam um botão "Carregar mais", não esta paginação.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Esqueleto** `app-esqueleto`              | Forma do conteúdo em `--cor-superficie-3` com um brilho que atravessa três vezes e para (nenhuma animação passa de 5 s; com movimento reduzido, não começa). Formas `texto` (`linhas`, a última mais curta), `bloco` (raio `--raio-lg`, `altura`), `pilula` (44px) e `circulo` (avatar). Decorativo (`aria-hidden`): quem carrega marca o contêiner com `aria-busy="true"` e diz "Carregando…" num `role="status"`. Nunca um indicador girando sozinho no lugar do conteúdo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Estado vazio** `app-estado-vazio`        | Ilustração simples (três pílulas de dado em ciano → menta → lima, como um funil, e um círculo com ícone sobreposto, recortado por um anel da cor do fundo, `--estado-anel`), título em `--fonte-h3`, frase em texto suave e a ação projetada (`<button appBotao>`). Variantes: `vazio` ("Nenhum contato ainda" + "Novo contato"), `busca` (lupa; "Limpar filtros"), `erro` (pílulas em tons de coral; `role="alert"`, mostra o `codigo` para o suporte; "Tentar de novo") e `sem-acesso` (cadeado; pílulas neutras). `compacto` para dentro de cartões, colunas do kanban e tabelas. **`falha`** (o `ErroApi` que fez a tela cair no erro): num 403 o estado vira `sem-acesso` ("Você não tem acesso a isto", sem as ações projetadas — "Tentar de novo" daria o mesmo 403; `manterAcoes` as mantém quando são "Voltar" ou "Fechar"), e o código para o suporte só aparece em falha do servidor (5xx ou sem resposta). Todas as telas passam a `falha` nos estados de erro.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### 4.4 Retorno e painéis

| Componente                              | Anatomia e variantes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Avisos** `app-avisos`                 | A pilha de toasts no canto inferior direito (24px das bordas, até 420px de largura; no celular, a largura toda com 12px de folga), na camada superior (Popover API: fica visível até por cima de um modal). Cada aviso é um cartão `--cor-flutuante`, `--raio-lg`, sombra flutuante: círculo de 28px com o ícone do tipo (sucesso menta com visto, erro `--cor-erro` com ×, info ciano, atenção lima; ícone preto, no erro `--cor-sobre-erro`; no claro, contorno `--cor-contorno-dado`), título opcional, a mensagem, o `codigo` ("Código para o suporte: req-…"), a ação em pílula ("Desfazer") e o botão fechar. Duração: 5 s; 20 s com ação; erro fica até fechar. O tempo **para** com o mouse ou o foco na pilha (WCAG 2.2.1). **F8** leva o foco à ação do aviso mais novo (ou ao "×"); F8 ou Esc lá dentro devolvem o foco para onde estava, e quando o aviso com o foco sai o foco vai para o próximo aviso ou volta (a região se chama "Avisos (F8)" e o anúncio da ação diz "F8 leva até ela"). Cada aviso novo é anunciado pelo `LiveAnnouncer` do CDK (erro de forma assertiva, com o prefixo "Erro:"; os outros, educada). Fica **uma vez** na casca, ligado ao `AvisosService` do núcleo (`avisos.sucesso('Contato salvo.')`); no máximo três na tela. Com um diálogo modal aberto, mora dentro dele (`CamadaModal`, abaixo). |
| **Painel lateral** `app-painel-lateral` | O detalhe por cima da lista, sem tirar a pessoa dela (negócio no kanban, diff da auditoria, entrega de webhook). `<dialog>` nativo com `showModal()`: **foco preso**, **Esc** fecha, o resto da página fica inerte e o foco volta para quem abriu. Ao abrir, o foco vai para o **título** (h2 em dois tons, `aria-labelledby`; a `descricao` em `aria-describedby`). Cartão flutuante encostado à direita com 12px de folga, `--raio-2xl`, `--cor-superficie`, véu `--cor-veu` com desfoque; larguras `md` 520 · `lg` 680 · `xl` 880; abaixo de 600px ocupa a tela (8px de folga, `--raio-lg`). Cabeçalho com título, ações (`painel-acoes`, ex. `app-menu-acoes`) e fechar; corpo com rolagem própria; rodapé com `painel-rodape` (ações à direita). Clique no véu fecha. Com rota (`/funis/:area/:negocioId`), a tela abre quando a rota ativa e navega de volta em `(fechado)`. Os menus do CDK projetados nele abrem **dentro** do diálogo (`provideOverlayNoDialogo`, também no `app-modal`).                                                                                                                                                                                                                                                                                                                                           |
| **Menu de ações** `app-menu-acoes`      | `@angular/cdk/menu`. Gatilho "⋯" (`ellipsis`, botão-ícone `contorno` de 36px) ou pílula com `texto` e seta ("Ações ▾"). A lista é um cartão `--cor-flutuante`, `--raio-lg`, sombra flutuante, 220–320px, abaixo do gatilho alinhada pela borda final (ou acima, sem espaço). Itens de 44px em pílula com ícone de 18px e rótulo; hover/foco em vidro forte. `perigo` deixa o item em `--cor-erro` e vai no fim, depois de um separador (`separarAntes`); a tela pede confirmação (`ConfirmacaoService`) antes de agir. Item `desabilitado` continua focável (`aria-disabled`) e mostra o **motivo** embaixo do rótulo, ligado por `aria-describedby`. Teclado do padrão WAI-ARIA: Enter/Espaço/seta abrem, setas e Home/End navegam, primeira letra busca, Esc fecha e devolve o foco, clique fora fecha. O `rotulo` diz de quê ("Ações de Maria Souza").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Confirmação de ação destrutiva: `ConfirmacaoService.confirmar({ titulo, mensagem, confirmar,
perigo })` do núcleo abre um modal (desenhado por `layout/confirmacao.ts`) dizendo exatamente o
que vai acontecer ("Desligar Pedro Alves?" · "As 12 atividades pendentes vão para Carla."), com
o botão nomeado pela ação ("Desligar"), nunca "OK".

A pilha dos avisos rola quando não cabe na altura, e um contêiner com rolagem corta o que passa
da borda: por isso o host tem uma **folga** transparente em volta dos avisos (`--_folga`, 40px,
o tamanho da sombra flutuante), compensada no `inset` para os avisos ficarem a 24px (12px no
celular) das bordas. A folga não pega cliques (`pointer-events: none` no host; só os avisos
pegam), então não bloqueia o que está por baixo, e a pausa com o mouse continua funcionando.

**Camada modal** (`ui/camada-modal.ts`, `CamadaModal`): com um `<dialog>` aberto por
`showModal()`, tudo fora dele fica inerte — não recebe clique nem foco e some da árvore de
acessibilidade. O serviço guarda a pilha dos diálogos modais abertos (o `app-modal`, o
`app-painel-lateral` e a gaveta da casca avisam `abriu`/`fechou`, também ao serem destruídos
abertos) e mantém **dentro do diálogo do topo** o host dos avisos (o "Desfazer" e o "×"
funcionam sem fechar o diálogo) e a região viva do `LiveAnnouncer` (os anúncios dados de dentro
de um modal chegam ao leitor de tela); com o diálogo fechado, os dois voltam para o lugar. Um
`<dialog>` modal novo precisa avisar a `CamadaModal` do mesmo jeito. A cópia para a área de
transferência sem a Clipboard API (`nucleo/copiar.ts`) também cria o campo temporário dentro do
diálogo aberto e só diz que copiou se o campo ficou com o foco e o texto selecionado.

### 4.5 Padrões das telas (fora de `ui/`)

Componentes que nasceram numa tela da Fase 1 e já seguem o design system (moldura dos campos,
tokens, teclado). Ficam na pasta da tela até uma segunda tela precisar deles; aí sobem para
`ui/` (incluindo-os no catálogo e nesta especificação). A cópia para a área de transferência
já é do núcleo: `copiarTexto(texto)` em `nucleo/copiar.ts` (Clipboard API e, sem ela — página
em http fora do `localhost` —, o modo antigo com um campo temporário).

| Padrão                                       | Onde está                                                 | O que faz                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Busca com sugestões** `app-busca-entidade` | `paginas/funis/busca-entidade.ts`                         | Combobox do WAI-ARIA (`aria-activedescendant`) para escolher contato ou empresa e, com `textoCriar`, criar ali mesmo ("Criar contato “Maria”"); escolhido, vira uma pílula com "Trocar". Setas, Enter e Esc.                                                                                                                                 |
| **Vínculo** `app-seletor-vinculo`            | `paginas/atividades/seletor-vinculo.ts`                   | A mesma ideia para ligar uma atividade a contato, empresa ou negócio, com a lista em grupos. A busca começa com duas letras e espera a pausa da digitação.                                                                                                                                                                                   |
| **Empresa** e **etiquetas**                  | `paginas/contatos/campo-empresa.ts`, `campo-etiquetas.ts` | Empresa: sugestões num `<datalist>` nativo buscadas na API, ou um nome novo, com a dica do que vai acontecer ao salvar. Etiquetas: pílulas com remover; Enter ou vírgula acrescenta, Backspace no campo vazio tira a última; as em uso viram sugestões (`<datalist>`); sem repetir (sem diferenciar maiúsculas) e aparadas como a API grava. |
| **Copiar** `app-botao-copiar`                | `paginas/integracoes/comum/botao-copiar.ts`               | Pílula `sm` "Copiar" que vira "Copiado" com um visto por 2 s e avisa pelo toast; sem permissão do navegador, pede para copiar à mão.                                                                                                                                                                                                         |
| **Bloco de código** `app-bloco-codigo`       | `paginas/integracoes/comum/bloco-codigo.ts`               | Legenda, "Copiar" e o texto monoespaçado que rola na horizontal dentro do bloco (nunca a página); a área que rola é focável e nomeada.                                                                                                                                                                                                       |
| **Valor único** `app-valor-unico`            | `paginas/integracoes/comum/valor-unico.ts`                | Um valor que a API mostra uma única vez (endereço de webhook, segredo): pílula monoespaçada selecionável, "Copiar" e o aviso de que depois só aparece mascarado. Se o navegador não deixar copiar, o valor fica selecionado, pronto para o Ctrl+C.                                                                                           |
| **Sem acesso** `app-sem-acesso`              | `layout/sem-acesso.ts` (rota `/sem-acesso?pagina=`)       | Num cartão palco: o que foi negado e quem acessa (pelos papéis do módulo), com "Ir para a visão geral".                                                                                                                                                                                                                                      |

Padrões da Onda A (telas em `docs/TELAS-ONDA-A.md`), também na pasta da tela:

- **QR do WhatsApp** (`paginas/configuracoes/canais/whatsapp/conexao-whatsapp`): o QR numa
  moldura branca arredondada sobre o palco, com uma barra de contagem ("O código muda em 59 s"),
  o passo a passo logo abaixo e, depois de conectar, o visto verde com o número.
- **Prévia do widget** (`canais/site/previa-widget`): o chat do site desenhado com as cores,
  o tema e a posição escolhidos, atualizado ao digitar.
- **Selo de SLA** (lista do Atendimento): neutro dentro do prazo e coral ("3 h") quando passa;
  nunca só a cor, sempre o tempo escrito.
- **Faixa da janela de 24 h** (conversa do Instagram e do Messenger): pílula coral com a hora em
  que a janela fechou e uma dica; o compositor some e a nota interna continua.

### 4.6 Conversas (`ui/mensagens/`)

Os componentes de conversa do Atendimento e do Chat da equipe (Onda A). Trabalham sobre um
modelo próprio, `MensagemConversa` (`ui/mensagens/mensagens.ts`), com os nomes de enum da API:
a tela converte o DTO dela e passa a lista pronta. No Chat da equipe, as mensagens do próprio
usuário são `SAIDA` e as dos outros, `ENTRADA`.

```ts
interface MensagemConversa {
  id: string;
  direcao: 'ENTRADA' | 'SAIDA' | 'INTERNA' | 'SISTEMA'; // contato · equipe · nota · aviso
  tipo:
    | 'TEXTO'
    | 'IMAGEM'
    | 'AUDIO'
    | 'VIDEO'
    | 'DOCUMENTO'
    | 'LOCALIZACAO'
    | 'CONTATO'
    | 'FIGURINHA'
    | 'REACAO';
  texto?: string | null;
  trechos?: {
    texto: string;
    link?: string | unknown[];
    externo?: boolean;
    tipo?: 'mencao' | 'referencia' | 'link';
  }[];
  anexo?: {
    nome: string;
    mime: string;
    url: string;
    tamanho?: number;
    duracao?: number;
    largura?: number;
    altura?: number;
  };
  status?: 'PENDENTE' | 'ENVIADA' | 'ENTREGUE' | 'LIDA' | 'FALHOU'; // só SAIDA
  erro?: string | null; // motivo da falha, em português
  criadaEm: string | Date;
  autor?: { id?: string; nome: string; foto?: string | null };
  respondeA?: { autor?: string; texto?: string; tipo?: TipoMensagem };
  editada?: boolean;
  excluida?: boolean;
}
```

| Componente                                 | Anatomia e variantes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Bolha** `app-bolha-mensagem`             | Raio 20px, com o canto do lado de quem fala em 6px no começo de cada grupo; até 78% da largura (86% abaixo de 600px). **Entrada**: à esquerda, `--cor-superficie-2` com borda, avatar de 32px na última do grupo. **Saída**: à direita, a superfície tingida de menta (`--dado-2` a 14%), com a hora e o status de entrega no canto. **Nota interna**: à direita, no coral listrado do cartão destaque (mesmos tons de preto por dentro), com o cadeado e "Nota interna · Ana". **Sistema**: uma pílula de vidro centralizada com a hora. Mensagens seguidas do mesmo autor e direção, no mesmo dia e com até 5 min entre elas, formam um grupo: o nome só na primeira, o avatar só na última. A falha mostra o motivo em `--cor-erro` e "Tentar de novo". Imagem/vídeo sem texto: a hora vai por cima da mídia. Também: resposta citada (barra `--cor-info`), "editada", "Mensagem apagada", figurinha sem fundo. |
| **Status de entrega** `app-status-entrega` | Relógio (enviando), um visto (enviada), dois vistos (entregue), dois vistos em `--cor-info` (lida), alerta em `--cor-erro` (não enviada): a forma muda a cada passo, não só a cor. `role="img"` com o nome ("Lida"), que também aparece ao passar o mouse.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Separador de data** `app-separador-data` | Fio de cada lado e, no meio, uma pílula neutra com "Hoje", "Ontem", o dia da semana nos últimos 7 dias ou a data ("20 de outubro", com o ano se for de outro ano).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Digitando** `app-digitando`              | Três pontos numa pílula com a cor da bolha de entrada e a frase ("Maria está digitando…", "Maria e Ana estão digitando…", "3 pessoas estão digitando…"). Os pontos ondulam quatro vezes (< 5 s) e param; cada mudança recomeça. A região viva fica sempre no lugar (vazia quando ninguém digita).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Lista** `app-lista-mensagens`            | Rolagem **virtual** do `@angular/cdk/scrolling` com a estratégia própria `EstrategiaAlturaVariavel` (alturas reais medidas por `ResizeObserver`, guardadas pela chave de cada item). Começa na mais recente e acompanha o fim enquanto a pessoa estiver nele; rolando para cima, o círculo invertido "↓" aparece com a contagem das que chegaram. Perto do topo (ou pelo botão "Carregar mensagens anteriores") pede as anteriores, e a mensagem que estava na tela **não sai do lugar** quando elas entram. "Início da conversa" quando não há mais. Carregando: bolhas-esqueleto; vazia: `textoVazio`. "Digitando" embaixo. A altura vem do pai (flex/grid com altura definida).                                                                                                                                                                                                                                 |
| **Compositor** `app-compositor`            | A pílula de escrever (raio 28px, `--cor-superficie-2`, borda forte): clipe, campo que cresce até 6 linhas e, à direita, enviar (círculo invertido) ou gravar áudio (quando o campo está vazio). Anexos em pílulas acima (miniatura ou ícone, nome, "PDF · 1,2 MB", remover), também colando ou soltando arquivos. "/" no começo de uma palavra abre as respostas rápidas (cartão flutuante acima, até 8, filtradas por atalho, título e texto sem diferenciar acentos). Gravando: lixeira, ponto vermelho, tempo, nível do microfone em barras `--cor-info`, ■ (para e deixa ouvir) e ➤. "Mensagem \| Nota interna" em pílulas (`permitirNota`); na nota, a pílula fica coral listrada. Bloqueado: o motivo, numa pílula tracejada com cadeado, no lugar do campo. Linha de ajuda embaixo (atalhos de teclado; no toque, só o "/"), erro em `--cor-erro` e o contador perto do limite.                             |
| **Player de áudio** `app-player-audio`     | Círculo invertido de tocar/pausar, a onda em 32 barras-pílula (as já tocadas em `--cor-info`; desenho estável por endereço), o tempo (a duração parado; a posição tocando) e a velocidade 1× · 1,5× · 2×. A onda é um `<input type="range">` por cima das barras. Um áudio de cada vez na tela. Arquivo que não abre: aviso e "Baixar".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Prévia de anexo** `app-previa-anexo`     | Imagem: miniatura com `--raio-md`, largura fixa de 280px (200px `compacta`; `--previa-maximo`) limitada ao espaço, espaço reservado com `largura`/`altura`, clique amplia num modal com "Baixar". Vídeo: o `<video>` nativo. Áudio: o player. Documento (e imagem/vídeo que não abriu): pílula de vidro com o círculo do ícone, nome, tipo e tamanho e o botão de baixar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

| Componente            | Entradas e saídas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Exemplo                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app-lista-mensagens` | `mensagens` (da mais antiga para a mais nova) · `carregando` · `temAnteriores` · `carregandoAnteriores` · `digitando` (nomes) · `nomes` (`entrada` \| `saida` \| `todas` \| `nenhuma`) · `avatares` (true) · `rotulo` (`Mensagens`) · `textoVazio` · `anunciar` (true); `(carregarAnteriores)` · `(tentarDeNovo)`; métodos `rolarParaOFim(comportamento?)`, `rolarAte(id)`                                                                                                                                                                       | `<app-lista-mensagens [mensagens]="m()" [temAnteriores]="mais()" [digitando]="nomes()" nomes="saida" (carregarAnteriores)="carregar()" />`                       |
| `app-bolha-mensagem`  | `mensagem`* · `continuacao` · `seguida` · `nomes` (`entrada`) · `avatares` (true); `(tentarDeNovo)`                                                                                                                                                                                                                                                                                                                                                                                                                                              | `<app-bolha-mensagem [mensagem]="m" nomes="saida" (tentarDeNovo)="reenviar($event)" />`                                                                          |
| `app-compositor`      | `[(texto)]` (rascunho) · `[(modo)]` (`mensagem` \| `nota`) · `rotulo` (`Mensagem`) · `placeholder` · `respostasRapidas` (`{ id, atalho, titulo, texto }[]`) · `variaveis` (`{ 'contato.nome': … }`) · `permitirAnexos` (true) · `permitirAudio` (true) · `permitirNota` · `desabilitado` · `motivo` · `enviando` · `limites` (25/100 MB) · `maximoAnexos` (10) · `maximoCaracteres`; `(enviar)` → `{ texto, anexos: File[], nota, audio }` · `(digitando)` → `boolean`; métodos `focar()`, `limpar()`, `restaurar(envio)`, `inserirTexto(texto)` | `<app-compositor permitirNota [respostasRapidas]="r()" [variaveis]="v()" (enviar)="enviar($event)" (digitando)="tempoReal.digitando({ conversaId }, $event)" />` |
| `app-player-audio`    | `src`* · `duracao` (segundos) · `rotulo` (`Áudio`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `<app-player-audio [src]="a.url" [duracao]="a.duracao" rotulo="Áudio de Maria" />`                                                                               |
| `app-previa-anexo`    | `anexo`* · `compacta` · `rotulo` (nome falado; padrão o nome do arquivo)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `<app-previa-anexo [anexo]="m.anexo" />`                                                                                                                         |
| `app-digitando`       | `nomes` (`[]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `<app-digitando [nomes]="['Maria']" />`                                                                                                                          |
| `app-separador-data`  | `data` · `rotulo` (vence a data)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `<app-separador-data [data]="m.criadaEm" />`                                                                                                                     |
| `app-status-entrega`  | `status`* · `tamanho` (16)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `<app-status-entrega status="LIDA" />`                                                                                                                           |

Regras dos componentes de conversa:

- **Texto é só texto.** Nada de HTML vindo da API (o e-mail chega como texto, §2.5 do contrato
  da Onda A). Endereços `http(s)://` e `www.` viram links que abrem em outra aba
  (`rel="noopener noreferrer"`); um link externo só tem destino com `http(s)`, `mailto` ou
  `tel`. Menções e referências a negócio/contato vêm em `trechos`, com rota interna
  (`routerLink`).
- **Anexos (R11):** o seletor oferece imagens, áudio, vídeo, PDF, Office, texto e zip; SVG e
  HTML são recusados, e o limite é 25 MB (documentos 100 MB) — `motivoDeRecusa()` dá a frase.
  A API confere de novo. A `url` do anexo é sempre a da API (`/api/v1/arquivos/<id>`).
- **Áudio gravado** sai em webm/opus quando o navegador permite (`GravadorAudio`, uso interno do
  compositor); o gateway converte para ogg/opus. Sem microfone ou sem permissão, o erro diz o
  que fazer ("Libere o acesso nas configurações do site…"). Gravações param sozinhas em 10 min.
- **Envio:** ao enviar, o compositor emite `(enviar)` e se limpa; se a API falhar, a tela chama
  `restaurar(envio)`. A bolha nova entra como `PENDENTE` e avança pelo evento
  `mensagem.status`; `FALHOU` mostra o motivo e "Tentar de novo".
- **Teclado:** Enter envia, Shift+Enter quebra a linha (no toque, Enter quebra e o botão envia),
  Ctrl/Cmd+Enter sempre envia. Nas respostas rápidas, setas, Enter/Tab escolhem e Esc fecha (o
  foco fica no campo: listbox com `aria-activedescendant`). A lista rola pelo teclado (é
  focável, com nome) e a onda do player aceita setas, Home e End.
- **Leitor de tela:** cada bolha começa com quem falou ("Maria Souza:", "Nota interna de Ana:")
  e termina com a hora e o status; as mensagens que chegam de outra pessoa são anunciadas
  ("Nova mensagem de Maria: …"); anexar, remover, gravar e descartar também.
- **Rolagem virtual:** cada item tem `data-chave` (a mensagem é `m:<id>`); as chaves que não
  são mensagem (topo, separadores) nunca servem de âncora. O espaço entre as bolhas é padding
  do próprio item (a estratégia mede a altura do item inteiro). Não ponha margem externa nas
  bolhas.

**Tempo real nas telas** (`nucleo/tempo-real/`). Um socket só (`TempoRealService`, namespace
`/tempo-real` em `/api/socket.io`, autenticado pelo cookie da sessão), conectado enquanto há
sessão. Nos componentes, use os atalhos de `auxiliares.ts` no construtor (param sozinhos quando
o componente é destruído):

```ts
acompanharSala(() => (this.conversaId() ? { tipo: 'conversa', id: this.conversaId()! } : null));
aoReceber('mensagem.nova', ({ conversaId, mensagem }) => this.acrescentar(conversaId, mensagem));
aoReceber('mensagem.status', (evento) => this.atualizarStatus(evento));
aoReconectar(() => this.recarregar()); // o que chegou enquanto a conexão esteve fora
protected readonly digitando = digitandoEm(() => ({ conversaId: this.conversaId() }), {
  nomeDoContato: () => this.conversa()?.contato.nome,
});
// <app-lista-mensagens [digitando]="digitando().map((p) => p.nome)" />
// <app-compositor (digitando)="tempoReal.digitando({ conversaId: id }, $event)" />
```

Os eventos e os formatos estão em `nucleo/tempo-real/eventos.ts` (os mesmos do catálogo da API,
`crmbrl-api/src/tempo-real/catalogo.ts`). A casca já cuida do resto: o indicador
"Reconectando…" (`app-indicador-conexao`, na barra superior; no celular, flutuando logo abaixo
dela) só aparece quando a conexão está fora há mais de 2,5 s, e o menu mostra as não lidas do
Atendimento e do Chat da equipe (evento `nao-lidas`). As notificações do sino chegam ao vivo
(`notificacao.nova`), com uma busca de reserva a cada 60 s. Nos testes, todo socket é falso e
inerte (`src/provedores-teste.ts`); para simular eventos, `provideSocketFalso()` de
`nucleo/tempo-real/tempo-real-de-teste.ts`.

---

### 4.7 Campanhas e automações (`ui/construtor-segmento`, `editor-modelo`, `editor-passos`, `seletor-janela-envio`, `seletor-agenda`)

Os blocos que Disparos, Chatbot e Automações (Onda B) compartilham. Nenhum fala com a API: a tela
entrega os dados (campos, definições de passo, contagem) e lê o valor para montar o JSON. Todos
usam `[(valor)]` (o editor de passos, `[(gatilho)]` e `[(passos)]`), sem formulário reativo.

- **Construtor de segmento** (`app-construtor-segmento`): linhas "campo · operador · valor" em
  linguagem simples ("Etiqueta é Lead quente", "Última interação há mais de 30 dias"); com duas ou
  mais, "todas" ou "qualquer uma". Os operadores e a entrada do valor (texto, número, data,
  opções) vêm do tipo do campo (`CampoSegmento`). A **contagem ao vivo** usa a função injetável
  `contagem` (ou o token `CONTAGEM_SEGMENTO`): `(segmento) => Promise<number>`, chamada depois de
  `atrasoMs` (400 ms) só com as condições completas; respostas atrasadas são ignoradas; mostra
  "Contando…", o total ou o erro com "Tentar de novo". Sem a função, não mostra contagem.
- **Editor de modelo** (`app-editor-modelo`): a área de texto da mensagem com botões que inserem
  `{{contato.primeiro_nome}}` e variações `{olá|oi}` no cursor, aviso (`role="alert"`) de variável
  desconhecida, variação vazia ou chave sem par, e a prévia numa bolha por contato (`contatos`),
  com "Outra variação". A sintaxe é a do renderizador da API; `{{contato.campos.x}}` é sempre aceito.
- **Editor de passos** (`app-editor-passos`): "Quando… / Se… / Então… / Aguardar…". O gatilho é
  fixo no topo; cada passo é um cartão (selo da fase, título, resumo de uma linha, "Falta preencher")
  que abre para os campos; "Se" tem um bloco de passos por ramo, até `nivelMaximo` (2) níveis.
  Reordenar: arrastar pela alça (CDK, só dentro da mesma lista) **e** as setas Subir/Descer, que
  anunciam a nova posição e mantêm o foco. "Adicionar passo" abre um menu agrupado por fase com a
  descrição de cada um. O editor não conhece passos: a tela passa `DefinicaoPasso[]` (tipo, fase,
  campos, ramos); `validarPassos` devolve o que falta preencher. `DEFINICAO_AGUARDAR` é a espera pronta.
- **Janela de envio** (`app-seletor-janela-envio`): sete pílulas de dia (`aria-pressed`, nome
  completo como nome acessível), hora inicial e final, atalhos "Horário comercial" e "Todos os
  dias" e a frase da regra ("Envia de segunda a sexta, das 8h às 18h (horário de Brasília)."), que
  vira erro quando não serve. Fuso fixo `America/Sao_Paulo`.
- **Agenda** (`app-seletor-agenda`): escolha do modo em pílulas — `agora`, `data`, `recorrente`
  (diária, semanal, mensal) e `relativa` ("N dias antes/depois de" um campo de data) — e só os
  campos do modo; `modos` limita o que aparece (campanha: agora e data; automação: repetir e perto
  de uma data). Uma frase resume e vira erro quando incompleta.

Estados e regras comuns: tudo funciona por teclado e em 390 px (linhas do segmento e dos ramos
empilham); mudanças de ordem e erros vão para `aria-live`/`role="alert"`; nada usa `innerHTML`.

## 5. Layout

### Desktop (≥ 1200px)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [⋰ BRL CRM]                     (🔍 Buscar…)   (☾) (🔔•) (avatar ▾)         │ barra superior (fundo)
├──────────────┬─────────────────────────────────────────────────────────────┤
│ ┌──────────┐ │  Visão geral · outubro de 2026      [Compartilhar] [✦ IA] ◯◯◯+│
│ │(●) Início│ │  [Jornada do cliente][Atendimento][Equipe]                  │
│ │( ) Atend.│ │  ┌──────────── palco ───────────────┐ ┌── cartão ───────┐   │
│ │ Funis    │ │  │ 17 %   12 d  …                   │ │ Atividades       │   │
│ │( ) Mkt   │ │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  Leads [4d]│ │ recentes         │   │
│ │( ) Com.  │ │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓      MQL   [8d]│ └──────────────────┘   │
│ │( ) CS    │ │  └──────────────────────────────────┘ ┌── cartão ───────┐   │
│ │ …        │ │  [KPI] [KPI] [KPI] [KPI]               │ Status do sistema│   │
│ └──────────┘ │                                         └──────────────────┘   │
└──────────────┴─────────────────────────────────────────────────────────────┘
```

- A barra superior fica sobre `--cor-fundo` (sem cartão). A navegação é um cartão vertical
  com itens em pílula (círculo de ícone + rótulo); o item ativo usa o círculo `invertido`.
  Grupos com rótulo em legenda ("Funis", "Relacionamento", "Gestão", "Sistema"), compactos.
  Os itens têm 40px no mouse e 44px no toque; a lista rola dentro do cartão, com esmaecimento
  nas bordas que escondem itens. O menu mostra só os módulos que o papel e as permissões de
  quem entrou acessam (os das próximas fases com o selo "em breve").
- A navegação pode ser recolhida para só os círculos (com tooltip) — a escolha fica salva.
- Atendimento e Chat da equipe mostram as não lidas (evento `nao-lidas` do tempo real) num
  contador em `--cor-erro` (o mesmo da contagem do sino) ao lado do nome ("99+" acima de 99),
  ou no canto do círculo com a navegação recolhida; o nome acessível do item diz quantas
  ("Atendimento, 3 não lidas").
- Na barra superior, antes do alternador de tema, o indicador discreto do tempo real
  ("Conectando…" / "Reconectando…" com um ponto lima que pulsa três vezes; "Conectado de novo"
  em menta por 2,5 s) só aparece quando a conexão ao vivo está fora há mais de 2,5 s. Não pega
  cliques e não ocupa espaço quando oculto.
- O conteúdo tem no máximo `--largura-pagina` (1600px). As duas colunas (palco 2/3, lateral
  1/3) aparecem quando o conteúdo tem ≥ 60rem; abaixo disso, o palco ocupa a largura toda e a
  coluna lateral desce para baixo dele. Os quatro KPIs ficam numa linha só, abaixo do palco.
- As ações do cabeçalho (período, equipe, Compartilhar, IA) ficam à direita: ao lado do título
  quando cabem; senão, numa linha própria alinhada à direita.

### Tablet (900–1199px)

Navegação recolhida em trilho (só círculos), com o botão «/» que abre a navegação inteira por
cima do conteúdo e a fecha ao navegar, com Esc ou com clique fora. Palco em largura total; a
coluna lateral desce para baixo dele em duas colunas.

### Mobile (< 900px)

- Barra superior: logo (só o símbolo), título da seção, busca, sino e avatar. O menu abre
  uma gaveta lateral com a mesma navegação. O indicador do tempo real flutua no meio, logo
  abaixo da barra (com a sombra flutuante).
- Título em display de 36px, com o complemento em dois tons descendo inteiro (§2.3). Abas e
  filtros em pílulas com rolagem horizontal até a borda da tela: a borda que esconde abas
  esmaece e a aba selecionada fica sempre à vista. Abaixo de 600px as abas entalhadas do palco
  também viram pílulas (a ativa invertida) e o painel tem os quatro cantos arredondados.
- Cartões empilhados em uma coluna (a coluna lateral também); raio `--raio-lg`. Abaixo de
  600px, Compartilhar e Analisar com IA viram botões-ícone.

---

## 6. Dados e gráficos

### Barra de funil (`app-barra-funil`)

Inspirada no widget "Funnel Conversion" da referência:

- Acima da barra: o total da etapa à esquerda (`--fonte-numero-pequeno`, 20px/300, numa
  coluna de largura `--funil-coluna-total`, padrão 5,5rem, para as quedas alinharem), a
  queda em relação à etapa anterior (`↓ 12%`, texto suave, ícone `arrow-down`, "%" menor) e,
  à direita, o **grupo** nome da etapa + selo neutro do tempo médio (`4d`). O selo tem 14px e
  a cor do texto (`--cor-texto`), a altura do nome da etapa, como o "4d" quase branco da
  referência. Sem espaço, o nome quebra em duas linhas; se nem assim couber, nome e selo
  descem juntos para a linha de baixo — o selo nunca desce sozinho. Na primeira etapa
  (`queda` nula) a queda não aparece.
- A barra é uma pílula de 48px (40px abaixo de 900px) com **largura proporcional ao total
  da etapa** em relação a `totalReferencia` (o total da primeira etapa) e mínimo de duas
  alturas. Ela cresce do zero ao aparecer (`@starting-style`; sem animação com movimento
  reduzido).
- Dentro dela, um segmento por série, na ordem ciano → menta → lima → coral (séries com
  valor 0 são omitidas). Medido em `funil-widget-plano.png`, com a paridade **contada a
  partir da última série**: a última fica sempre por baixo, encostada na ponta direita; a
  penúltima (e a 4ª de trás para a frente) é uma cápsula com as duas pontas arredondadas, por
  cima dos vizinhos, que começa **meia altura antes** do próprio início (24px na barra de
  48px) e termina exatamente no próprio limite; as demais ficam por baixo, a primeira
  encostada na ponta esquerda. Com três séries, a do meio é a cápsula; com duas, a primeira é
  a cápsula e a curva continua avançando para a direita. O resultado é o efeito de cápsulas
  empilhadas da referência, com as fronteiras nos valores reais. A série 2 usa
  `--dado-2-gradiente` (`#00E8B8 → #00F99B → #46F86C`), que funde com o ciano.
- Limites das pontas, para não sobrar "lasca" de cor nem lua crescente fina: a cápsula nunca
  começa antes de meia altura da ponta esquerda nem termina a menos de meia altura da direita,
  e os segmentos de base das pontas (o primeiro e o último) têm no mínimo uma altura de
  largura.
- Quando todos cabem (próximo item), o valor de cada segmento aparece dentro dele em
  `--fonte-micro`, texto preto, com 14px de respiro (12px no mobile): o primeiro alinhado à
  esquerda, os demais à direita do próprio segmento (recuando meia altura quando a ponta fica
  sob a cápsula seguinte).
- **Todos dentro ou todos fora.** O componente mede a própria largura (ResizeObserver) e, com
  a largura **final** da pílula (não a animada), confere cada segmento visível: cabe se a
  largura nominal do segmento for ≥ 7px por caractere do número + 2 × o respiro (+ meia altura
  quando a ponta fica sob a cápsula). Se **todos** cabem, todos os números ficam dentro. Se
  **algum** não cabe, **todos** saem da barra — nenhum fica dentro, para a mesma barra nunca
  misturar "98" dentro com "● 96 ● 78" ao lado — e aparecem numa lista logo depois da pílula,
  na mesma linha (ou embaixo, quando a pílula ocupa a linha toda), na ordem das séries (ciano →
  menta → lima → coral): cada valor com uma bolinha de 8px na cor da série, em
  `--fonte-legenda`, algarismos tabulares e texto suave. A lista é decorativa para leitores de
  tela (o `aria-label` da barra tem tudo) e cada número continua no `title` do segmento. Sem
  ResizeObserver (testes), tudo fica dentro. A decisão é por barra: num mesmo funil, a etapa
  larga pode ter os números dentro e a estreita, fora.
- No tema claro, a pílula inteira e as bolinhas levam o contorno interno de 1px
  `--cor-contorno-dado` (§2.2). Com cores forçadas (Alto Contraste), segmentos e bolinhas
  mantêm as cores de dado e ganham contorno `CanvasText`.
- Uma legenda (bolinhas coloridas + nome da série) acompanha o conjunto de barras.
- Acessibilidade: cada barra é `role="img"` com `aria-label` completo ("Leads qualificados:
  1.410; Site e webhooks 600, WhatsApp 500, Indicação e outros 310; queda de 11,9% em
  relação à etapa anterior; tempo médio de 8 dias").

### Outras regras

- Ordem fixa das séries: `--dado-1`, `--dado-2`, `--dado-3`, `--dado-4`.
- Valores sempre formatados em pt-BR; moeda em `R$` com abreviação (`R$ 48,2 mil`). O app
  registra o locale `pt-BR` (`LOCALE_ID`, `DEFAULT_CURRENCY_CODE = 'BRL'`), então os pipes do
  Angular já formatam certo; para abreviações e tempos relativos use `nucleo/formatos.ts`
  (`abreviarNumero`, `formatarMoedaAbreviada`, `formatarTempoRelativo`).
- Todo gráfico tem uma alternativa textual (tabela ou `aria-label`).

---

## 7. Conteúdo e linguagem

- Português do Brasil, tom direto e amigável, frases curtas. Verbos de ação nos botões
  ("Compartilhar", "Analisar com IA", "Adicionar etapa").
- Títulos sem ponto final; o segundo tom é um complemento curto (até três palavras), sem
  listas ("· outubro de 2026", "· três variantes").
- Toda tela tem, no topo, uma frase dizendo para que ela serve, e uma `app-dica` nos
  elementos que não se explicam sozinhos (métricas, siglas como MQL, SLA, MRR) — também nas
  páginas "em breve".
- Fala-se em **papel** (Admin, C-level, Líder Comercial, Comercial…), nunca em "persona"; um
  item indisponível diz por quê ("Só C-level e Admin veem todos.").
- Mensagens de erro sem jargão: "O servidor do CRM não respondeu", não "a rota /api/saude não
  existe"; o detalhe técnico vai para o console.
- Dados fictícios são sempre sinalizados ("Dados de exemplo").
- Datas `dd/mm/aaaa`, horas `HH:mm`, tempos relativos ("há 5 min").

---

## 8. Acessibilidade (checklist)

- [ ] Contraste AA: texto normal ≥ 4,5:1 e texto grande ≥ 3:1, nos dois temas.
- [ ] Foco visível em tudo que é interativo: `outline: 2px solid var(--cor-foco); outline-offset: 2px`.
- [ ] O foco nunca fica sob a barra fixa nem sob um balão aberto (`scroll-padding-top` no
      `<html>`; a dica fecha quando o foco sai dela).
- [ ] Contraste gráfico ≥ 3:1 nos preenchimentos de dado e nos controles, nos dois temas
      (no claro, `--cor-contorno-dado` e `--cor-contorno-controle`).
- [ ] Alvos de toque ≥ 44 × 44px.
- [ ] Botões só com ícone têm `aria-label`; ícones decorativos têm `aria-hidden`.
- [ ] Abas com `role="tablist"`/`tab`/`tabpanel` e navegação por setas.
- [ ] Link "Pular para o conteúdo" como primeiro elemento focável.
- [ ] `lang="pt-BR"` no documento.
- [ ] `prefers-reduced-motion` respeitado, e nenhuma animação automática passa de 5 s (o
      ponto "ao vivo" pulsa três vezes e para).
- [ ] Cores forçadas (Alto Contraste): aba e opção selecionadas, segmentos do funil e bolinhas
      da legenda continuam visíveis (`@media (forced-colors: active)`).
- [ ] Nada depende só de cor (selos e status têm texto ou ícone).
- [ ] Todo campo tem rótulo ligado (`for`/`id`); ajuda e erro ligados por `aria-describedby`,
      `aria-invalid` no erro, e o erro só aparece depois de sair do campo ou enviar (§4.2).
- [ ] Diálogos (modal, painel lateral, confirmação) com foco preso, Esc, título que os nomeia e
      o foco de volta em quem abriu; menus do CDK dentro deles abrem dentro do diálogo.
- [ ] O resultado de toda ação é anunciado (avisos pelo `LiveAnnouncer`; carregando e
      ordenação da tabela num `role="status"`), também de dentro de um modal (`CamadaModal`).
- [ ] O que tem tempo (aviso com "Desfazer") se alcança pelo teclado (F8) e o tempo para com o
      foco ou o mouse.
- [ ] Abrir e fechar um painel de rota filha (`data: { painel: true }`) não manda o foco para o
      topo da página: ele volta para o cartão que abriu.
- [ ] Ação, filtro ou item de menu indisponível continua visível e diz por quê (`motivo`).

---

## 9. Marca — BRL CRM

O produto se chama **BRL CRM** e usa o **símbolo da BRL**: o leque de quatro barras de mesma
espessura — horizontal, ~31°, ~60,5° e vertical — que converge na base da barra vertical.

- **Sempre monocromático na interface**: o símbolo e o nome numa cor só, o token
  `--cor-logo` — **preto puro (`#000000`) no tema claro e branco puro (`#FFFFFF`) no escuro**.
  As quatro barras viram uma forma única, como nas versões oficiais em preto e em branco da
  marca. A versão colorida não é usada no app.
- **Nome**: "BRL" em Urbanist 800 e "CRM" em Urbanist 300, em maiúsculas.
- **Proporções** (da assinatura oficial, em função da altura do símbolo _H_): maiúsculas com
  0,79 _H_, centralizadas no símbolo; do símbolo ao texto, a espessura de uma barra (≈0,21 _H_
  entre as tintas); de "BRL" a "CRM", ≈0,19 _H_ entre as tintas.
- **Origem do desenho**: geometria medida na assinatura oficial colorida (`brl-labs-logo.png`,
  1920 px, projeto `brllabs`) e redesenhada em vetor — o vetor coincide com a silhueta
  original em 99,6% dos pixels.

Implementação: `app-logo` (`src/app/ui/logo/`) desenha o símbolo num `<path>` único
(`viewBox="0 0 386 393"`, `fill: currentColor`, constante `CAMINHO_SIMBOLO_BRL`) e o nome
em texto vivo; `tamanho` é a altura do símbolo (padrão 28px) e tudo escala com a variável
`--logo-altura`; `somenteSimbolo` mostra só o leque (mobile, navegação recolhida). O nome
visível e o símbolo são decorativos; um texto "BRL CRM" fica só para leitores de tela.
`public/favicon.svg` repete o símbolo e troca preto/branco com `prefers-color-scheme` dentro
do próprio SVG (numa `<img>`, a consulta segue o `color-scheme` do contêiner: dentro de um
`data-tema` ele acompanha o tema). A seção 17 do catálogo mostra o logo completo, só o símbolo e
o favicon nos dois temas, lado a lado, com o valor de `--cor-logo` lido do CSS de cada painel.

---

## 10. Catálogo vivo (`/design-system`)

A página `src/app/paginas/design-system/` mostra os tokens e cada componente de `ui/` em
todas as variantes e estados, com uma linha de "quando usar", sempre com os componentes
reais. Ela segue o tema da página e termina com uma composição nos dois temas lado a lado
(`data-tema` num contêiner). Organização:

- `design-system.ts|html|scss` — topo, índice com âncoras (`/design-system#botoes`) e as
  seções de componentes 05–11, 17 (tema e marca) e 18 (dois temas);
- `formularios.ts|html|scss` (12, campos ligados a um formulário reativo de verdade, com o erro
  da API simulado), `listas.ts|html|scss` (13, filtros + tabela + paginação com os estados
  dados/carregando/vazio/erro e a linha que abre o painel lateral) e `retorno.ts|html|scss` (14,
  avisos com host próprio, menu de ações e painel lateral);
- `conversas.ts|html|scss` (15, os componentes de `ui/mensagens/` com uma conversa que funciona:
  180 mensagens virtuais com "carregar anteriores", envio que passa por enviando → enviada →
  entregue → lida, anexos, nota interna, respostas rápidas por "/", áudio gravado de verdade e
  um áudio e uma imagem gerados no navegador, sem arquivos de exemplo);
- `automacao.ts|html|scss` (16, os componentes do §4.7: segmento com contagem simulada, modelo de
  mensagem com prévia, editor de passos com um fluxo de exemplo, janela de envio e as duas agendas);
- `fundamentos.ts|html|scss` — seções 01–04 (cores, tipografia, espaço e forma, ícones);
- `secao.ts` (`app-ds-secao`: número, título em dois tons, frase) e `exemplo.ts`
  (`app-ds-exemplo`: cartão com nome, seletor e "quando usar");
- `dados.ts` — nome, papel e uso de cada token (cores, os 13 tokens de fonte do §2.3, espaço,
  raios, alturas, movimento, camadas e pontos de quebra); os **valores** das cores não ficam ali:
  depois de renderizar, `fundamentos.ts` lê cada token no CSS (`getComputedStyle`, função
  `lerCorDoToken`) dentro de duas sondas escondidas, uma com `data-tema="escuro"` e outra com
  `data-tema="claro"`, e mostra o hex (ou "branco 7%", "transparente"). A seção 17 usa a mesma
  função nos painéis do logo. Ao criar um token de cor ou de fonte, inclua-o em `dados.ts`.

Grades do catálogo: cartões lado a lado têm alturas parecidas (`.ds-grade--2`); um cartão bem
mais alto ocupa a largura toda ou, com `.ds-grade--densa`, duas linhas (`.ds-alto`) ao lado de
dois cartões empilhados, sem esticar nenhum. Nada de cartão com metade vazia ao lado de um alto.

Ao criar ou mudar um componente de `ui/`, inclua-o no catálogo e nesta especificação.
