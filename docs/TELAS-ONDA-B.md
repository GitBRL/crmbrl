# Telas da Onda B — CRM BRL

Especificação de UX das telas de **Importar contatos**, **Disparos**, **Chatbot** e **Automações**.
Segue o padrão de `docs/TELAS-FASE1.md` (princípios, estados completos, teclado, textos em
português) e o visual de `docs/DESIGN-SYSTEM.md` (os componentes compartilhados da onda estão
na seção de componentes daquele guia e no catálogo em `/design-system`). As regras ficam em
`crmbrl-api/docs/REGRAS-DE-NEGOCIO.md` (R16 a R19, seções 21 a 26); o contrato HTTP é o OpenAPI da API.

> **Situação (30/10/2026):** as telas abaixo estão implementadas e foram conferidas de ponta a
> ponta no ambiente dos agentes (dev server → API real, Chrome headless por CDP, conferência por
> texto): importação de uma planilha com duplicados e erros → relatório; campanha pelo WhatsApp
> simulado até as respostas caírem no Atendimento e um "SAIR" aplicar o opt-out; fluxo do chatbot
> no chat do site com pergunta (botões), condição e transferência com nota interna; automação
> disparada por negócio movido de etapa, com espera, atividade e mensagem; modo teste sem efeitos
> externos. Os testes de unidade (1.098 no front) e o build passam. Capturas do estado final de cada
> fluxo: `trabalho/telas-onda-b/integracao/`; as de cada tela (claro e escuro, desktop e celular),
> nas pastas dos agentes de tela (`importacao-front`, `disparos-front`, `chatbot-front`,
> `automacoes-front`).

Princípios extras desta onda:

- **Quem configura, vê só o seu**: Importar, Chatbot e Automações são de Admin, C-level e líderes
  (a rota mostra "Sem acesso" para os outros); Disparos é de todas as áreas, e o membro vê só as
  próprias campanhas (R17.1). A tela esconde o que o papel não faz; a API é a autoridade.
- **Nada liga sem conferir**: automação nasce pausada, fluxo precisa ser publicado, campanha tem
  revisão com estimativa antes de iniciar, importação tem prévia e opções antes de gravar.
- **Andamento ao vivo**: importação e campanha mostram o progresso pelo tempo real
  (`importacao.progresso`, `campanha.progresso`, tipados em `nucleo/tempo-real/eventos.ts`); se a
  conexão cai, a tela busca de novo ao voltar.
- **Tudo reaproveita os componentes compartilhados**: construtor de segmento, editor de modelo
  de mensagem, editor de passos, seletor de janela de envio e seletor de agenda.

## 1. Importar contatos (`/contatos/importar`)

Acesso: Admin, C-level e líderes (`permissoes.importarContatos`, guarda de rota
`exigirPermissao(podeImportarContatos)`); o botão "Importar" da lista de contatos só aparece para eles.

Assistente de quatro etapas, com o rascunho guardado na API: dá para sair e voltar com
`?importacao=<id>`.

1. **Arquivo** — zona de soltar a planilha CSV ou Excel (até 50 mil linhas) e o histórico das
   importações anteriores (cada pessoa vê as suas).
2. **Colunas** — diz o que é cada coluna (nome, e-mail, telefone, empresa, cargo, etiquetas,
   campos personalizados…), com o mapeamento já sugerido, prévia das primeiras linhas, escolha de
   separador e codificação, e **modelos de mapeamento** salvos para a próxima planilha. "Continuar"
   só habilita com nome e e-mail ou telefone mapeados.
3. **Opções** — o que fazer com quem já existe (completar o que está vazio, pular, sobrescrever),
   etiquetas, responsável (quem importa, uma pessoa ou rodízio da área) e origem.
4. **Importação** — barra de andamento ao vivo, contadores (criados, atualizados, ignorados, com
   erro), "Resultado linha a linha" com filtro por resultado e o motivo de cada erro ("Nome é
   obrigatório."), cancelar, retomar e **Baixar relatório (Excel)**.

Verificado: planilha com 6 linhas (um duplicado, uma sem nome, e-mail e telefone inválidos) →
4 criados, 1 atualizado, 1 com erro, relatório disponível.

## 2. Disparos (`/disparos`)

### 2.1 Lista

Campanhas com busca, filtros por situação e canal, andamento ao vivo e ações rápidas por linha
(iniciar, pausar, retomar, cancelar, duplicar, excluir, aprovar). Ação principal: "Nova campanha".
Vazio: ilustração e a ação de criar a primeira.

### 2.2 Assistente (`/disparos/novo`, `/disparos/:id/editar`)

Cinco passos, com o rascunho salvo a cada passo:

1. **Público** — construtor de segmento em linguagem simples com contagem ao vivo, ou uma lista
   importada; mostra quantos entram, quantos ficam de fora por opt-out e por falta de telefone.
2. **Mensagem** — editor de modelo (variáveis, variações, mídia), prévia por contato, envio de teste
   para o próprio número e **modelos salvos** (modal "Modelos de mensagem").
3. **Números e ritmo** — número(s) do WhatsApp (rodízio), intervalo mínimo e máximo, lote e pausa,
   janela de envio (seletor de janela), com o aviso do que o número impõe (R13).
4. **Quando** — agora ou agendada.
5. **Revisão** — resumo, **estimativa de duração**, pendências que impedem iniciar; "Iniciar".

Campanha já agendada, em andamento ou pausada só deixa ajustar nome, números, ritmo e horário.

### 2.3 Detalhe (`/disparos/:id`)

Abas **Resumo** (andamento ao vivo, contadores "Na campanha / Na fila / Enviadas / Entregues /
Lidas / Respostas / Falhas / Sem WhatsApp / Pediram para sair", mensagem, público, números, ritmo),
**Quem recebeu** (um destinatário por linha, com filtros por situação e busca) e **Resultados**
(taxas, funil, envios ao longo do tempo, por número, motivos de falha, exportação XLSX e CSV).
Ações do ciclo de vida no cabeçalho conforme `acoes` que a API devolve. Pausa automática e
aprovação aparecem no sino (`campanha.*`, link `/disparos/:id`).

Verificado: campanha para uma lista importada (4 contatos: 3 enviados, 1 sem telefone válido); a
resposta "Quero sim, pode mandar!" apareceu no Atendimento como conversa aberta e marcou "Respostas 1";
"SAIR" aplicou o opt-out do contato ("Pediram para sair 1").

## 3. Chatbot (`/chatbot`)

### 3.1 Lista e novo fluxo

Fluxos com busca, filtros e ações rápidas (ligar, desligar, duplicar, excluir); cada linha mostra
gatilho, canais, versão publicada e quantas conversas atendeu. `/chatbot/novo` pede os dados do
fluxo (nome, canais, gatilho — nova conversa, palavra-chave, fora do horário, sempre —, prioridade,
área) e abre o editor.

### 3.2 Editor (`/chatbot/:id`)

Abas **Passos**, **Configuração**, **Versões** e **Histórico**, com o **simulador** num painel lateral.

- **Passos** — árvore em lista ("Quando… / Se… / Então…"): mensagem, pergunta com opções (um ramo
  por opção, mais "sem resposta" e "inválida"), pergunta aberta (validação de e-mail, telefone,
  número, data), condição (ramos e "senão"), ações, aguardar, transferir e encerrar. O rascunho é
  salvo sozinho; os problemas aparecem no passo e a publicação os lista.
- **Versões** — cada publicação é guardada; dá para ver os passos e trazer uma de volta ao rascunho.
- **Histórico** — as conversas reais que o fluxo atendeu (simulações ficam de fora).
- **Simulador** — conversa de teste que roda o rascunho (ou a versão publicada) sem tocar em
  contatos, conversas nem negócios; as esperas viram o botão "Deixar o tempo passar"; mostra o resumo
  que iria para a transferência.

Publicar cria uma versão nova e só ela atende clientes; a conversa em andamento termina na versão em
que começou.

### 3.3 No chat do site

As opções de uma pergunta aparecem no widget como **botões** (só na última mensagem); o clique
responde com o texto da opção. Nos outros canais seguem como lista numerada.

Verificado no widget: "quero a triagem b6" → menu com os botões "Quero uma proposta" / "Só estou
olhando" → clique → "Quantas pessoas tem na sua equipe?" → "25" → condição "equipe maior que 9" →
etiqueta e transferência para Vendas; no Atendimento, a conversa chegou à fila certa com a **nota
interna** "Atendimento automático … encerrado e passado para a equipe. Respostas do contato: …".

## 4. Automações (`/automacoes`)

### 4.1 Lista, modelos prontos e histórico

Três visões na mesma página:

- **Automações** — nome, gatilho, situação (ativa/pausada), execuções e "Última vez" (de toda
  execução real); ativar, pausar, duplicar, excluir. Ação principal: "Nova automação".
- **Modelos prontos** — boas-vindas ao lead, follow-up de proposta, lembrete de renovação e
  reativação; "Usar" cria uma cópia **pausada**, pede só o que falta configurar e abre o editor.
- **Histórico** — tudo o que as automações já fizeram, com filtro por situação, testes à parte e o
  passo a passo de cada execução num painel (com "Tentar de novo" nos passos que falharam e cancelar
  nas que esperam).

### 4.2 Editor (`/automacoes/nova`, `/automacoes/:id`)

Nome e área; **gatilho** (evento de domínio com filtros — por exemplo a etapa — ou agenda: data
relativa, recorrência); **condições** (segmento e horário permitido); **passos** (ações, esperas e
"se… senão") no editor de passos; **quando parar** (respondeu, ganhou, perdeu, saiu do segmento) e
**limite por entidade**. Salvar nunca liga a automação; ligar só funciona com tudo preenchido (a API
devolve as pendências).

**Modo teste:** escolhe um registro e roda a automação inteira sem efeitos externos — mensagens,
atividades e webhooks aparecem como "simulado", as esperas são puladas e a execução fica à parte
no histórico.

Verificado: automação "negócio movido para a etapa Proposta → aguardar 1 minuto → criar atividade
→ WhatsApp por modelo": o teste simulou os três passos sem criar nada; mover o negócio de verdade
iniciou a execução (aguardando), e depois da espera criou a atividade e a mensagem (autor
Automação); a lista passou a mostrar "Última vez".

## 5. Notificações

O sino reconhece os tipos novos pelo prefixo: `campanha.pausada`, `campanha.concluida`,
`campanha.aprovacao_pedida`, `campanha.aprovada` e `campanha.reprovada` (ícone de megafone; texto e
link `/disparos/:id` vêm da API).

## 6. Diferenças e observações da integração

- **Configuração dos Disparos:** seção Configurações > Disparos (Admin e C-level) edita a
  aprovação do líder, as palavras de saída e a confirmação (`PUT /disparos/configuracao`).
- **Editor de passos do chatbot é próprio** (`paginas/chatbot/arvore-passos`) e não o
  `app-editor-passos` compartilhado, porque o ramo com opções dinâmicas e configuração aninhada não
  cabia no componente base; as automações usam o compartilhado.
- **Bot e distribuição:** a conversa nova é distribuída pela fila antes de o bot entrar (R18, nota
  final); o atendente pode ser notificado enquanto o bot ainda conversa, e o bot sai quando ele
  responde.
- **Eventos de tempo real tipados:** `importacao.progresso` e `campanha.progresso` passaram para o
  catálogo do núcleo; os `as` que as telas usavam foram removidos.
- **Permissão `importarContatos`:** entrou em `Permissoes` (opcional, com fallback pelo papel em
  `podeImportarContatos`) e protege a rota.
