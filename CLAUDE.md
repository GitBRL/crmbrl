# crmbrl — guia rápido

Angular 22 standalone com signals, zoneless e OnPush; SCSS com tokens em CSS custom properties
(`data-tema` claro/escuro); fonte Urbanist local; ícones `@lucide/angular`; `@angular/cdk` (drag-drop, a11y,
menu, scrolling); Socket.IO client em chunk sob demanda; Vitest. Servido por Caddy (SPA + proxy `/api`).

## Comandos
```bash
CI=1 npx ng build --output-path <TRABALHO>/builds/<rotulo>   # build de produção (apague a pasta ao terminar)
CI=1 npx ng test --watch=false 2>&1 | tail -n 30             # suíte inteira (só na verificação final)
CI=1 npx ng test --watch=false --include 'src/app/paginas/<pasta>/**/*.spec.ts'   # só a sua pasta
npx prettier --check <arquivos>
```
Não rode outro `ng serve`: use o dev server compartilhado em http://localhost:4200 (proxy /api → API dos
agentes em 3200). Usuários e dados de demonstração em `TRABALHO/ambiente-dev.md`.

## Mapa
- `src/app/nucleo/` — sessão, papéis, API, tempo real, avisos, tema, navegação.
- `src/app/layout/` — casca (menu lateral, barra superior, indicador de conexão).
- `src/app/ui/` — componentes do design system (botão, campo, tabela, modal, painel lateral, mensagens…).
  Reaproveite antes de criar; componente novo compartilhado vai em `ui/` e no catálogo `/design-system`.
- `src/app/paginas/<area>/` — uma pasta por área (inicio, contatos, funis, atividades, atendimento, chat,
  configuracoes, administracao, integracoes…), com `*.routes.ts`, `*.api.ts`, `*.tipos.ts` e specs.

## Convenções
- Interface simples para qualquer usuário: dicas curtas nas telas, estados de carregando, vazio, erro,
  sem acesso e reconectando; funciona no celular (390 px) sem rolagem horizontal; navegação por teclado.
- Nunca `innerHTML` com conteúdo externo. Textos em português do Brasil.
- Marca: "BRL CRM" (símbolo monocromático `--cor-logo`, preto no claro e branco no escuro).

## Documentos (leia por seção)
- `docs/DESIGN-SYSTEM.md` — §1 Princípios, §2 Tokens, §3 Tema, §4 Componentes (§4.6 Conversas), §5 Layout,
  §6 Dados e gráficos, §7 Linguagem, §8 Acessibilidade, §9 Marca, §10 Catálogo.
- `docs/TELAS-FASE1.md` — padrões das telas existentes.
- Referência visual (Sugar CRM): `TRABALHO/dribbble/recortes/`.
