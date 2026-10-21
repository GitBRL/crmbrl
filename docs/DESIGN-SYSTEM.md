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
`.rolagem-horizontal` (linha de pílulas que rola sem barra no mobile). O link
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
  as páginas carregadas sob demanda vêm em segundo plano depois da primeira pintura
  (`PreloadAllModules`).
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
| **Dica** `app-dica`                          | Botão "?" (`circle-question-mark`, 28px de desenho, 44px de alvo) que abre um balão com o texto (e um título opcional). Abre com clique, toque, Enter ou Espaço; fecha com Esc, clique fora, novo clique ou quando o foco vai para outro controle (Tab), para não cobrir o próximo (o balão não tem nada interativo). Usa a Popover API (camada superior: não é cortado por `overflow`), posiciona-se abaixo do botão ou acima quando falta espaço, acompanha a rolagem e cabe na largura do celular; sem a API cai para um balão absoluto com os mesmos atalhos. O botão tem `aria-describedby` apontando para o balão.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Requisito do produto: telas autoexplicativas             |
| **Modal** `app-modal`                        | `<dialog>` nativo com `showModal()` (foco preso, Esc e camada superior nativos; o foco volta para quem abriu), `--raio-2xl`, fundo `--cor-superficie`, véu `--cor-veu` com desfoque, título h2 em dois tons (§2.3), botão fechar (botão-ícone), corpo com rolagem e rodapé projetado com `modal-rodape`. Clique no véu fecha. Larguras `sm` 420 · `md` 560 · `lg` 720.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | —                                                        |
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
por arquivo, não por ícone. Como o `main` importa o pacote (`provideLucideConfig` em
`app.config.ts` e os ícones dos módulos em `nucleo/navegacao.ts`, que as rotas usam), **todo
ícone usado em qualquer tela vai para o chunk inicial** (~3 kB cada sem compressão). O limite de
aviso do inicial é 500 kB (`angular.json`); hoje ele tem ~465 kB. Por isso:

- prefira um ícone que o app já usa: um ícone novo pesa no carregamento de todo mundo, mesmo
  que só uma página o mostre. O catálogo usa só ícones que as telas já usam;
- tirar o pacote do `main` exige que a configuração do Lucide fique nos `providers` da rota da
  casca e que as rotas leiam os módulos sem os ícones. Num build de teste assim, o inicial caiu
  para ~311 kB, e os ícones foram para um chunk que a casca carrega junto com ela. Carregar as
  rotas sob demanda só para isso poria mais uma ida e volta à rede antes da primeira tela.

### 4.1 Referência rápida (seletores e entradas)

Valores padrão entre parênteses. `[(x)]` indica ligação de duas vias (`model()`).

| Componente                                  | Entradas e saídas                                                                                                                                                                                                                     | Exemplo                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `button[appBotao]`, `a[appBotao]`           | `variante` (`neutro`) · `tamanho` (`md`) · `icone` · `ativo` · `carregando` · `semCirculo`                                                                                                                                            | `<button appBotao variante="invertido" [icone]="LucideShare2">Compartilhar</button>`        |
| `button[appBotaoIcone]`, `a[appBotaoIcone]` | `icone`* · `rotulo`* · `variante` (`neutro`) · `tamanho` (`md`) · `ponto` · `contagem`                                                                                                                                                | `<button appBotaoIcone [icone]="LucideBell" rotulo="Notificações" ponto></button>`          |
| `app-abas`                                  | `abas`* (`{ id, rotulo, icone? }[]`) · `rotulo`* · `[(selecionada)]` · `variante` (`pilulas` \| `entalhe`) · `modo` (`abas` \| `opcoes`) · `tamanho` (`md` \| `sm`); conteúdo projetado no painel                                     | `<app-abas rotulo="Visões" [abas]="abas" [(selecionada)]="aba">…</app-abas>`                |
| `app-chip`                                  | `tipo` (`texto` \| `numero` \| `data`) · `icone` · `selecionado` · `arrastando` · `arrastavel` · `multilinha`                                                                                                                         | `<app-chip tipo="numero">Valor</app-chip>`                                                  |
| `app-selo`                                  | `variante` (`neutro`) · `tamanho` (`md` \| `sm`) · `icone` · `ponto`                                                                                                                                                                  | `<app-selo tamanho="sm">em breve</app-selo>`                                                |
| `app-cartao`                                | `variante` (`padrao` \| `palco` \| `destaque`) · `titulo` · `complemento` · `nivel` (2) · `dica` · `regiao`; ações com `cartao-acoes`                                                                                                 | `<app-cartao titulo="Atividades recentes" [nivel]="3">…</app-cartao>`                       |
| `app-avatar`                                | `nome`* · `foto` · `tamanho` (`md`) · `forma` (`circulo` \| `pilula`) · `cor` · `decorativo`                                                                                                                                          | `<app-avatar nome="Ana Ribeiro" tamanho="sm" />`                                            |
| `app-pilha-avatares`                        | `pessoas`* (`{ nome, foto? }[]`) · `maximo` (3) · `tamanho` (`md` \| `sm`) · `rotulo` (`Equipe`)                                                                                                                                      | `<app-pilha-avatares [pessoas]="equipe" />`                                                 |
| `app-indicador`                             | `valor`* · `legenda`* · `unidade` · `prefixo` · `variacao` · `unidadeVariacao` (`%` \| `p.p.` \| `pts`) · `variacaoAbaixo` · `quedaEhBoa` · `dica` · `disposicao` (`abaixo` \| `lado`) · `tamanho` (`md` \| `sm`) · `casas` (`1.0-1`) | `<app-indicador [valor]="17" unidade="%" legenda="Conversão total do funil" />`             |
| `app-barra-funil`                           | `etapa`* · `total`* · `series`* (`{ rotulo, valor }[]`) · `totalReferencia` · `queda` · `tempoMedioDias`                                                                                                                              | `<app-barra-funil etapa="Leads" [total]="1600" [series]="s" [tempoMedioDias]="4" />`        |
| `app-legenda`                               | `series`* (nomes)                                                                                                                                                                                                                     | `<app-legenda [series]="['Site', 'WhatsApp']" />`                                           |
| `app-zona-soltar`                           | `legenda` · `ativa` · `(soltar)` (texto arrastado)                                                                                                                                                                                    | `<app-zona-soltar (soltar)="adicionar($event)" />`                                          |
| `app-dica`                                  | `texto`* · `rotulo` (`Mais informações`) · `titulo`                                                                                                                                                                                   | `<app-dica rotulo="O que é MRR?" texto="Receita recorrente mensal." />`                     |
| `app-modal`                                 | `[(aberto)]` · `titulo`* · `complemento` · `largura` (`md`) · `(fechado)` · método `fechar()`; rodapé com `modal-rodape`                                                                                                              | `<app-modal [(aberto)]="aberto" titulo="Análise com IA" complemento="· beta">…</app-modal>` |
| `app-campo-busca`                           | `[(valor)]` · `rotulo` (`Buscar`) · `placeholder` (`Buscar…`) · `(buscar)` · método `focar()`                                                                                                                                         | `<app-campo-busca [(valor)]="termo" (buscar)="buscar($event)" />`                           |
| `app-alternador-tema`                       | `variante` (`neutro`) · `tamanho` (`md`)                                                                                                                                                                                              | `<app-alternador-tema />`                                                                   |
| `app-logo`                                  | `somenteSimbolo` · `tamanho` (40)                                                                                                                                                                                                     | `<app-logo somenteSimbolo />`                                                               |

\* obrigatório. Propriedades CSS que os componentes leem do contexto: `--abas-entalhe-fundo`,
`--botao-icone-anel`, `--pilha-anel`, `--funil-coluna-total` (largura da coluna do total na
barra de funil), `--selo-ponto` (cor do ponto do selo) e `--recorte-cor`/`--recorte-largura`
(utilitário `.recorte`).

---

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
  nas bordas que escondem itens, e o aviso de demonstração é compacto e fica fixo no pé, fora
  da parte que rola.
- A navegação pode ser recolhida para só os círculos (com tooltip) — a escolha fica salva.
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
  uma gaveta lateral com a mesma navegação.
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
- O modo demonstração fala em **papel** e **"Ver como"**, nunca em "persona".
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
`data-tema` ele acompanha o tema). A seção 12 do catálogo mostra o logo completo, só o símbolo e
o favicon nos dois temas, lado a lado, com o valor de `--cor-logo` lido do CSS de cada painel.

---

## 10. Catálogo vivo (`/design-system`)

A página `src/app/paginas/design-system/` mostra os tokens e cada componente de `ui/` em
todas as variantes e estados, com uma linha de "quando usar", sempre com os componentes
reais. Ela segue o tema da página e termina com uma composição nos dois temas lado a lado
(`data-tema` num contêiner). Organização:

- `design-system.ts|html|scss` — topo, índice com âncoras (`/design-system#botoes`) e as
  seções de componentes (05–13);
- `fundamentos.ts|html|scss` — seções 01–04 (cores, tipografia, espaço e forma, ícones);
- `secao.ts` (`app-ds-secao`: número, título em dois tons, frase) e `exemplo.ts`
  (`app-ds-exemplo`: cartão com nome, seletor e "quando usar");
- `dados.ts` — nome, papel e uso de cada token (cores, os 13 tokens de fonte do §2.3, espaço,
  raios, alturas, movimento, camadas e pontos de quebra); os **valores** das cores não ficam ali:
  depois de renderizar, `fundamentos.ts` lê cada token no CSS (`getComputedStyle`, função
  `lerCorDoToken`) dentro de duas sondas escondidas, uma com `data-tema="escuro"` e outra com
  `data-tema="claro"`, e mostra o hex (ou "branco 7%", "transparente"). A seção 12 usa a mesma
  função nos painéis do logo. Ao criar um token de cor ou de fonte, inclua-o em `dados.ts`.

Grades do catálogo: cartões lado a lado têm alturas parecidas (`.ds-grade--2`); um cartão bem
mais alto ocupa a largura toda ou, com `.ds-grade--densa`, duas linhas (`.ds-alto`) ao lado de
dois cartões empilhados, sem esticar nenhum. Nada de cartão com metade vazia ao lado de um alto.

Ao criar ou mudar um componente de `ui/`, inclua-o no catálogo e nesta especificação.
