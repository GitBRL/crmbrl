# Telas da Onda A — CRM BRL

Especificação de UX das telas de **Atendimento**, **Chat da equipe** e **Configurações → Canais e
Atendimento**. Segue o padrão de `docs/TELAS-FASE1.md` (princípios, estados completos, teclado e
textos em português) e o visual de `docs/DESIGN-SYSTEM.md` (os componentes de conversa estão na
§4.6, em `ui/mensagens/`). As regras ficam em `crmbrl-api/docs/REGRAS-DE-NEGOCIO.md` (R11 a R15);
o contrato HTTP é o OpenAPI da API.

> **Situação (30/10/2026):** as telas abaixo estão implementadas e foram conferidas de ponta a
> ponta no ambiente dos agentes (dev server → API real, com dois usuários ao mesmo tempo):
> WhatsApp simulado, chat do site pelo widget, e-mail encadeado, Instagram e Messenger com a
> janela de 24 h, transferência, resolver com pesquisa de satisfação, menção no chat interno e
> conexão de número com QR. Os testes de unidade (964 no front) e o build passam.

Princípios extras desta onda:

- **Tempo real em tudo**: conversas, mensagens, status de entrega, "digitando", não lidas e o
  sino chegam sem recarregar (Socket.IO em `/api/socket.io`, namespace `/tempo-real`). Se a
  conexão cai, a tela continua funcionando e atualiza ao voltar.
- **Visibilidade por papel (R12.5)**: Admin e C-level veem todas as conversas; o líder, as filas
  da sua área; o membro, as suas e as sem responsável da área. Marketing não acessa o
  Atendimento (a rota mostra "Sem acesso"). O chat da equipe é de todos.
- **A tela só mostra o que o papel pode fazer**; a API é a autoridade.

## 1. Atendimento (`/atendimento`, `/atendimento/:conversaId`)

Caixa de entrada omnichannel (WhatsApp, chat do site, e-mail, Instagram e Messenger). Três
colunas no desktop; no celular, uma por vez (a conversa tem o "voltar").

### 1.1 Lista de conversas

- Abas em pílula com contadores: **Minhas**, **Sem responsável** e **Todas** (as que o papel
  vê).
- Busca por nome, telefone ou e-mail (espera a pessoa parar de digitar) e filtros por canal,
  status e etiqueta.
- Cada linha: avatar com o ícone do canal, nome, hora, prévia da última mensagem (com "Você:" ou
  o nome de quem respondeu), contador de não lidas, responsável e o **tempo de espera**; o selo
  fica coral quando passa do SLA da fila.
- Conversas novas entram no topo ao vivo; a que está aberta fica destacada.
- Estados: esqueleto, vazio ("Nenhuma conversa por aqui") com a frase explicando como as
  conversas chegam, erro com "Tentar de novo".

### 1.2 Conversa

- **Cabeçalho**: contato, canal e fila, "Com você / Com <nome>", e as ações **Resolver** (ação
  principal), **Transferir**, menu "mais" (assumir, reabrir, etiquetas, criar negócio) e o botão
  do painel do contato. Quem não é responsável vê "Assumir".
- **Mensagens**: bolhas por direção, separadores por dia, nome de quem respondeu, mídia
  (imagem, áudio, arquivo), resposta citada, **status de entrega** nas enviadas (enviada,
  entregue, lida) e erro com "Reenviar". Notas internas aparecem em destaque e nunca saem para o
  cliente. Avisos do sistema ("Rafael assumiu a conversa", transferências) entram no fio.
- **Compositor** (`ui/mensagens/compositor`): abas **Mensagem** e **Nota interna**; anexos,
  gravação de áudio, respostas rápidas digitando `/` (com variáveis como o nome do contato),
  Enter envia e Shift+Enter quebra a linha.
- **Janela de 24 h (Instagram e Messenger)**: faixa coral "Janela de 24 h fechou hoje às 17:03"
  e, no lugar do compositor, a explicação de que a Meta só permite responder dentro do prazo;
  só a nota interna continua liberada.
- **Resolver**: pergunta se envia a pesquisa de satisfação (quando o canal a liga); a nota (1 a 5) e o comentário que o cliente responde aparecem na conversa e no painel. Nota baixa avisa o
  líder.
- **Transferir** (modal): para uma pessoa (e, se for de outra área, uma fila dessa área) ou só
  para uma fila, com uma nota para quem recebe. Fica no histórico e na auditoria; quem recebe é
  notificado ao vivo.

### 1.3 Painel do contato

Dados do contato, etiquetas, **negócios** e **atividades** dele, conversas anteriores e o botão
"Criar negócio" (entra na primeira etapa do funil da área da fila, com a origem do canal, e
fica ligado à conversa). No desktop fica ao lado da conversa; em larguras menores, por cima.

### 1.4 Teclado e dicas

Alt+↓/↑ trocam de conversa; Alt+L, B, M e C levam o foco à lista, à busca, ao campo de mensagem
e ao painel do contato. Duas dicas no cabeçalho da página: a explicação geral (SLA, filas, janela
de 24 h) e os atalhos de teclado.

## 2. Chat da equipe (`/chat`, `/chat/:canalId`)

- **Lista de canais** à esquerda: Geral, canais das áreas, grupos e conversas diretas, com não
  lidas, menções (selo) e canais silenciados; busca de mensagens; "Novo grupo" e "Conversa
  direta".
- **Canal**: mensagens com autor e hora, **menções** (`@nome`, que notificam ao vivo no sino),
  **referências clicáveis** a negócios, resposta citada, edição e exclusão das próprias
  mensagens, anexos e "digitando".
- **Detalhes do canal** (painel lateral): sobre (nome e descrição editáveis por quem administra
  o grupo), silenciar, pessoas (online e administradores), adicionar e tirar pessoas, dar ou
  tirar a administração, arquivar e sair.
- **Conversa direta**: uma por par de pessoas; só as duas leem — nem o Admin (R15).
- Geral e áreas têm participantes definidos pelo papel e não permitem sair.
- A contagem de não lidas aparece no menu ("Chat da equipe") e no título da aba.

## 3. Configurações → Canais (`/configuracoes/canais`, Admin)

Lista de todos os canais com ícone, nome, status (conectado, esperando o QR, com erro, inativo) e
fila padrão; botão "Novo canal" por tipo. Cada canal tem uma tela própria.

- **WhatsApp** (`/configuracoes/canais/whatsapp/:id`): **Conexão** com o QR ao vivo (evento
  `whatsapp.conexao`; o código muda a cada minuto, com contagem regressiva) e o passo a passo
  para quem nunca conectou; depois de conectado mostra o número e "Desconectar". À direita,
  **envios de hoje** (limite), ritmo entre envios e **aquecimento** do número em dias; abaixo,
  proteções contra banimento, limites e gráfico de envios, pausar e retomar. No modo simulado o
  QR é de mentira e a conexão acontece sozinha depois de alguns segundos.
- **Chat do site** (`/site/novo`, `/site/:id`): aparência com **prévia ao vivo do widget**
  (título, cores, tema, posição, saudação), domínios permitidos, horário de atendimento e o
  **trecho de instalação** com "Copiar".
- **E-mail** (`/email/novo`, `/email/:id`): provedor (Gmail, Outlook, outro) preenche os
  servidores; IMAP e SMTP, **teste de conexão** com resultado por etapa e dicas de erro.
- **Instagram e Messenger** (`/instagram/novo`, `/messenger/novo`, `/meta/:id`): credenciais da
  Meta com instruções passo a passo, endereço e token de verificação do webhook para copiar.

Todas têm fila padrão, horário e a chave "Pesquisa de satisfação".

## 4. Configurações → Atendimento (`/configuracoes/atendimento`)

Admin, C-level e os líderes do Comercial e do CS. Três partes, cada uma numa aba:

- **Filas e SLA** (`/filas`): lista por área; formulário com nome, área, modo de distribuição
  (**rodízio**, **menor carga** ou **manual**, em que a conversa fica sem responsável),
  participantes e prazos de primeira resposta e de resolução (SLA). Dica explicando cada modo.
- **Horário e satisfação** (`/horarios`): por canal, o horário de atendimento (editor semanal),
  a mensagem fora do horário e a pesquisa de satisfação com o texto da pergunta.
- **Respostas rápidas** (`/respostas`): atalho (`/ola`), texto com variáveis e escopo (todos, área
  ou pessoal); busca e prévia.

## 5. Notificações e sino

O sino recebe ao vivo as menções do chat, as conversas transferidas, as notas baixas e os
estouros de SLA, sem esperar o intervalo de 30 s. O menu mostra as não lidas do Atendimento e do
Chat da equipe.

## 6. Diferenças e observações da integração

- **Dev server e WebSocket**: o chat do site (widget) fala WebSocket puro; no `ng serve` o proxy
  precisa de `"ws": true` (já está em `proxy.conf.json`). Em produção o Caddy já repassa.
- **Dois ícones "?"** ficam no cabeçalho do Atendimento (explicação e atalhos); têm rótulos
  diferentes para leitor de tela, mas o desenho é igual.
- Os negócios e atividades do painel do contato dependem de `/negocios` e `/atividades` da Fase 1.
