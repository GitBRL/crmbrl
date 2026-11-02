# Telas da Onda D — CRM BRL

Especificação de UX das telas do **assistente de ajuda por IA** (com os chamados no TicketHub e o
histórico do Admin), do **CRM instalável no celular (PWA)** com notificações push e da **Saúde do
sistema**, mais os pontos em que elas se encontram com as telas antigas. Segue o padrão de
`docs/TELAS-FASE1.md` (princípios, estados completos, teclado, textos em português) e o visual de
`docs/DESIGN-SYSTEM.md`. As regras ficam em `crmbrl-api/docs/REGRAS-DE-NEGOCIO.md` (R25 a R27,
seções 34 a 38); o contrato HTTP é o OpenAPI da API; o passo a passo para o usuário final está em
`docs/GUIA-DO-USUARIO.md` (e, por tarefa, na base de conhecimento do assistente,
`crmbrl-api/docs/ajuda/`).

> **Situação (02/11/2026):** as telas abaixo estão implementadas e foram conferidas de ponta a
> ponta no ambiente dos agentes (dev server → API real, Anthropic e TicketHub falsos do serviço de
> apoio, Chrome headless por CDP, conferência por texto): dúvida de uso por papel
> (Comercial, CS e Admin: o papel e a tela chegam ao modelo), recusas (fora do assunto e injeção de prompt),
> pedido sem a funcionalidade → "Abrir chamado" só com confirmação → chamado no TicketHub falso com o número
> abreviado na tela, histórico e aba Chamados do Admin (o membro leva 403); build de produção servido
> localmente com service worker, ícones e manifesto, app shell em cache (e `/api` nunca), offline, aviso de nova
> versão e "Atualizar", cartão de push, clique na notificação, navegação inferior e ações rápidas em 390 px; um
> push chegando ao receptor falso depois de uma conversa atribuída (e nada chegando com o tipo desligado);
> Saúde do sistema com o backup provocado como falho e o e-mail de alerta no GreenMail (o SMTP do ambiente dos
> agentes), uma vez só. Os roteiros estão em
> `trabalho/dev/e2e-d4-*.mjs` (e `e2e-d-*.mjs`, dos agentes); capturas do estado final de cada fluxo
> em `trabalho/telas-onda-d/integracao/`; as de cada tela, nas pastas dos agentes
> (`assistente-front`, `pwa-front`, `saude-guia`).

Princípios extras desta onda:

- **A IA ajuda, a pessoa decide**: o assistente explica o caminho e não executa nada; abrir um chamado
  é sempre uma confirmação explícita, com o que será enviado à vista.
- **Registro às claras**: o painel avisa, antes da primeira pergunta, que perguntas e respostas ficam
  registradas e que o Admin pode lê-las; pede para não escrever dados de clientes.
- **Dados nunca ficam velhos**: o app instalado guarda só a casca (telas e estilos); tudo o que vem da
  API passa sempre pela rede. Sem conexão, a faixa de topo diz isso e as ações que precisam da rede
  avisam.
- **Alerta com próximo passo**: todo alerta da Saúde do sistema traz a dica do que fazer e, quando
  vai por e-mail, avisa uma vez só (com lembrete a cada 6 horas enquanto durar).

## 1. Ajuda em todas as telas (painel do assistente)

Acesso: todos os papéis. O botão **Ajuda** fica na barra superior (no celular, só o ícone); abre um
painel lateral de conversa e **devolve o foco** ao botão ao fechar. A conversa fica ligada à tela de
onde foi aberta e ao papel da pessoa.

- **Início:** título "Como posso ajudar?", o aviso de registro das perguntas e três exemplos
  clicáveis ("Como crio um negócio no funil?", "Como importo contatos de uma planilha?", "Quem pode
  ver a auditoria?"). O campo aceita até 2.000 caracteres; **Enter** envia, **Shift+Enter** quebra a
  linha.
- **Resposta:** aparece em streaming ("Pensando…", "Escrevendo…"), em texto simples com negrito,
  listas e links seguros, com a etiqueta do tipo (Dúvida de uso, Pedido de funcionalidade, Fora do
  escopo, Erro do sistema). Os botões **Resposta útil** / **Resposta não útil** gravam a avaliação
  (e a região viva anuncia). Falha da IA: a resposta é refeita sozinha uma vez; persistindo, mensagem
  clara e **Tentar de novo** (a pergunta que falhou não conta no limite).
- **O papel conta:** o assistente responde só o que o papel da pessoa pode fazer e, quando algo é de
  outro papel, diz quem pode.
- **Conversas anteriores** (ícone de histórico): lista as conversas da própria pessoa; **Nova
  conversa** recomeça. Uma conversa guarda até 30 perguntas.
- **Estados:** carregando, assistente desligado ("O assistente está desligado pelo administrador"),
  sem configuração, sem base de ajuda, limite diário ("Você chegou ao limite de perguntas de hoje.
  Volte amanhã."), orçamento mensal esgotado, sem conexão e conversa que mudou de contexto.
- **Celular (390 px):** o painel ocupa a largura, sem rolagem horizontal.

### 1.1 Abrir chamado

Quando a resposta é de **funcionalidade que não existe** ou de **erro do sistema**, abaixo dela
aparece "Isso parece algo que o CRM ainda não faz ou um problema. Posso abrir um chamado para a equipe responsável." com **Abrir chamado**. Nada é enviado ao clicar: abre-se um
modal "Abrir chamado" com título e descrição já preenchidos e editáveis, o aviso de que vão **toda a
conversa com o assistente**, o seu usuário e a tela, e os botões **Cancelar** e **Confirmar e abrir
chamado**.

- Depois de confirmar: "Enviando o chamado…" e, em poucos segundos, **"Chamado nº <número> aberto."**
  com o link "Abrir no sistema de chamados" (quando o destino tem endereço público). O identificador
  do TicketHub é um UUID: aparece **abreviado (8 caracteres)**, com o completo no `title` (ao passar o
  mouse) e no botão **Copiar número**.
- Falhas do destino: "Não deu para enviar agora; tentando de novo às HH:MM." (até 6 tentativas) e,
  esgotadas, "Não foi possível abrir o chamado. O administrador foi avisado e pode reenviar."
- Um chamado por resposta: depois de aberto, o botão some. A pessoa também recebe uma notificação
  quando o chamado é aberto.

## 2. Dúvidas à IA (`/administracao/duvidas`, só Admin)

Aba da Administração, só para o Admin (os demais não veem o item nem entram pela URL). Cabeçalho com a
dica "Tudo o que as pessoas perguntaram…" e o aviso de **Privacidade**. Três abas:

- **Histórico:** tabela com quando, a pessoa, a pergunta, o tipo, se foi resolvida, a avaliação e o
  chamado (selo com "Nº <abreviado>", "Falhou" ou "Pendente"); filtros por busca no texto, **período**,
  **tipo**, **área**, **pessoa**, módulo, resolvida, avaliação e "Com chamado"; paginação; **CSV** e
  **XLSX** (auditados). Clicar numa linha abre o painel da **conversa inteira** (perguntas, respostas,
  avaliação e o chamado).
- **Temas sem resposta:** o que mais se pede sem que a ajuda resolva, agrupado por tema, com o módulo,
  o tipo, quantos **pedidos**, quantas **pessoas** e o **último** — a lista para decidir o que
  escrever na base de conhecimento ou o que evoluir no produto.
- **Chamados:** todos os chamados (aberto em, pessoa, título, destino, situação — Pendente, Enviado
  ou Falhou — e detalhe: "Nº <abreviado>" com o link "abrir", tentativas ou o último erro);
  **Reenviar** nos que falharam.
- **Estados:** carregando, vazio ("Ninguém perguntou ainda"), erro com "Tentar de novo".

## 3. Configurações → Assistente de ajuda (`/configuracoes/assistente`, só Admin)

- **Limites:** perguntas por pessoa por dia (0 desliga o assistente para todos) e orçamento mensal de
  tokens (em branco, sem limite), com o uso do mês ("N tokens no mês") ao lado.
- **Destino dos chamados:** "Enviar chamados para" **TicketHub**, **Webhook** ou **Nenhum**.
  TicketHub: endereço, endereço público (para o link), e-mail e senha da conta de serviço (a senha
  nunca volta para a tela: o campo mostra que está guardada), prioridade e número do sistema no
  TicketHub. Webhook: endereço, segredo da assinatura (HMAC), cabeçalhos e modelo do corpo (JSON com
  variáveis). Botão **Testar conexão**.
- **Base de conhecimento:** quantos artigos foram lidos e a lista (só leitura; os artigos vivem no
  repositório da API).
- Salvar audita; segredos nunca aparecem em tela, log ou auditoria.

### 3.1 Barra de seções de Configurações

A barra de pílulas passou a mostrar também **Canais** (`/configuracoes/canais`, só Admin, ou quem a
API liberar) e **Atendimento** (`/configuracoes/atendimento`: filas, horários e respostas rápidas —
Admin, C-level e os líderes de Comercial e CS), logo depois de "Passagens entre funis". A mesma regra
libera a aba e a rota. Ordem para o Admin: Usuários, Distribuição de leads, Passagens entre funis,
Canais, Atendimento, Disparos, Assistente de ajuda, Meu perfil.

## 4. O CRM no celular: PWA e notificações

### 4.1 Instalação, sem conexão e nova versão

- **Instalável:** manifesto "BRL CRM" (ícones do símbolo, cores do tema). Em **Meu perfil → No
  celular** há a dica de instalação: no Android o botão **Instalar o app** (quando o navegador oferece) ou o
  menu do navegador; no iPhone/iPad, **Compartilhar → Adicionar à Tela de Início**. Nada é pedido ao
  abrir o CRM.
- **Sem conexão:** faixa no topo ("Sem conexão. O CRM abre, mas os dados só carregam quando a internet voltar.") que some sozinha quando a rede volta. A casca do app abre mesmo offline;
  listas e detalhes não são guardados.
- **Nova versão:** quando uma versão nova do CRM está pronta, uma faixa avisa "Nova versão do CRM. Atualize para usar as novidades." com
  o botão **Atualizar** (recarrega na hora que a pessoa escolher). Em desenvolvimento (sem service worker) nenhuma dessas faixas aparece.

### 4.2 Navegação inferior e ações rápidas (telas pequenas)

Em telas estreitas aparece a barra inferior **Início, Atendimento, Atividades, Funis e Notificações**
(com a contagem de não lidas) e um botão de **Ações rápidas** com **Responder conversa**, **Registrar
atividade** e **Mover negócio**. Os alvos de toque têm pelo menos 44 px e a barra respeita a área
segura do aparelho; o conteúdo ganha folga para não ficar atrás dela.

### 4.3 Avisos no aparelho (Meu perfil → Avisos no aparelho (push))

- **Ativar avisos neste aparelho:** só então o navegador pede a permissão. Estados: desativado,
  ativado ("Os avisos estão ativos"), **bloqueado** (a permissão foi negada: explica como liberar nas
  configurações do navegador), não oferecido pelo aparelho e **não configurado** (a API sem chaves).
- **Tipos de aviso:** interruptores para conversa atribuída, menção, atividade vencendo, SLA estourado,
  negócio atribuído e parcela atrasada da carteira; cada alteração salva na hora.
- **Enviar um aviso de teste** e **Desativar neste aparelho**.
- **Ao receber:** o título e o corpo vêm da notificação do CRM; o clique abre a tela certa (conversa,
  negócio, atividade…) e nunca leva para fora do CRM.

## 5. Saúde do sistema (`/administracao/saude`, só Admin)

Atualiza sozinha a cada 30 segundos (e em "Atualizar agora"). Seções:

- **Situação geral** (Tudo funcionando / Pede atenção / Precisa de ação agora) e a hora da última leitura.
- **O que precisa de atenção:** cada alerta com gravidade (Aviso ou Crítico), título, detalhe e **o que fazer**; os que
  também vão por e-mail trazem o aviso (e, sem SMTP configurado, a tela diz que os alertas ficam só
  aqui). Sem alertas: "Nenhum alerta".
- **WhatsApp:** o gateway (no ar ou fora) e cada número (conectado, desconectado com o motivo, com o
  caminho para reconectar).
- **Backup e disco:** o último backup (data, arquivo, tamanho, se terminou bem), "nenhum backup
  registrado" quando não há, o espaço livre do volume e o tamanho do banco.
- **Filas de trabalho:** pendentes, ativas e falhas recentes por fila; uma fila **travada** (trabalho
  esperando há mais de 10 minutos, ou rodando há mais de 1 hora) fica em destaque.
- **Canais:** e-mail, Instagram, Messenger e chat do site com o último erro.
- **Erros recentes:** os últimos erros técnicos, com o caminho para os logs.
- **Estados:** carregando, erro na primeira consulta ("Não conseguimos carregar a saúde do sistema" +
  "Tentar de novo"); se uma atualização falha, o painel anterior permanece com o aviso "Não foi
  possível atualizar agora… Mostrando a última consulta."

## 6. Guia do usuário

`docs/GUIA-DO-USUARIO.md` explica o CRM por área e tarefa (Primeiros passos, Atendimento, Contatos,
Funis, Atividades, Chat, Disparos e Chatbot, BI, Automações, Financeiro, Configurações,
Administração e Saúde, No celular e "O que o CRM não faz"), com poucas capturas em `docs/guia/`. É
coerente com a base de conhecimento do assistente (`crmbrl-api/docs/ajuda/`): os nomes dos botões são
os da tela, e mudou um nome na tela, mudam os dois.

## 7. Diferenças e observações da integração

- **Abas de Configurações:** Canais e Atendimento já existiam como telas, mas só se chegava a elas por
  links; agora fazem parte da barra de seções, com a mesma permissão da rota.
- **Número do chamado:** o TicketHub devolve um UUID; o CRM o mostra abreviado e guarda o completo.
- **Recusa por papel:** a regra "não ensinar o que o papel não pode fazer" está no prompt do assistente
  (teste de unidade do prompt); a Anthropic falsa do ambiente dos agentes não a exerce, então a
  conferência de ponta a ponta mostra que o papel chega ao modelo, não a recusa em si (ver pendências
  do relatório da integração).
