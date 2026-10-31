# Telas da Onda C — CRM BRL

Especificação de UX das telas de **BI e relatórios** (com a **análise por IA** do Admin), do
**Financeiro** (contratos, parcelas, régua de cobrança e indicadores) e dos pontos em que elas se
encontram com as telas antigas. Segue o padrão de `docs/TELAS-FASE1.md` (princípios, estados
completos, teclado, textos em português) e o visual de `docs/DESIGN-SYSTEM.md` (§6, Dados e
gráficos). As regras ficam em `crmbrl-api/docs/REGRAS-DE-NEGOCIO.md` (R20 a R24, seções 27 a 33);
o contrato HTTP é o OpenAPI da API.

> **Situação (31/10/2026):** as telas abaixo estão implementadas e foram conferidas de ponta a
> ponta no ambiente dos agentes (dev server → API real, Chrome headless por CDP, conferência por
> texto): painéis do BI por papel (membro, líder, C-level e Admin) com um número de cada painel
> igual ao da lista aberta pelo clique; análise por IA como Admin (API falsa da Anthropic), sem o
> botão para os demais; negócio ganho → sugestão de contrato → parcelas; importação de parcelas
> com baixa; régua com "Executar agora" (WhatsApp simulado, e-mail no GreenMail, ligação com
> promessa de pagamento) e o pagamento encerrando a régua. Os roteiros estão em
> `trabalho/dev/e2e-c4-*.mjs`; capturas do estado final de cada fluxo em
> `trabalho/telas-onda-c/integracao/`; as de cada tela, nas pastas dos agentes (`bi-front`,
> `analise-front`, `financeiro-front`).

Princípios extras desta onda:

- **O número e a lista dizem a mesma coisa**: nenhum indicador mostra o que a pessoa não veria na
  lista correspondente (R20.2), e o clique no gráfico leva à lista filtrada que o sustenta.
- **Gráfico sempre tem alternativa**: todo gráfico tem a aba "Números" (a mesma série em tabela),
  `rotulo` descritivo para leitores de tela e cores lidas dos tokens (claro e escuro). Há um só
  componente de gráfico (`ui/grafico`, ECharts em chunk sob demanda) — o BI, a tela inicial e os
  indicadores do Financeiro o usam.
- **IA só para quem decide**: a análise é do Admin; os demais papéis não veem o botão (a API também
  recusa).
- **Cobrança com freio**: a régua nasce ligada com textos padrão editáveis, pode ser pausada, e a
  tela mostra o que sai hoje antes e depois de "Executar agora".

## 1. BI e relatórios (`/bi`, `/bi/:painel`)

Acesso: todos os papéis; cada um vê as abas do seu painel (R20.1) — Admin e C-level: Marketing,
Comercial, Sucesso do cliente, Atendimento e Financeiro; líder e membro: o da área e o Atendimento
(Marketing não tem o Atendimento); Financeiro só CS. A rota `/bi` leva à primeira aba do papel.

- **Filtros no topo:** períodos rápidos (7, 30 e 90 dias) e "Outro período", "Comparar com o período
  anterior" e "Mais filtros" (área, equipe, responsável, funil, canal e fila, só os que valem para o
  painel). A linha de resumo diz o período, o período comparado e a hora da última atualização
  (o cache é de 30 s). "Atualizar" recalcula sem cache.
- **Cartões:** valor, variação com a seta e o texto ("Alta de 12%") e dica curta; os indicadores
  "de agora" ficam sob "Agora · fotografia de hoje, sem comparação".
- **Gráficos e tabelas:** cada bloco tem as abas "Gráfico" e "Números", o botão de baixar CSV e a
  dica do que mede. Barras ou linhas clicáveis mostram a ajuda "Clique numa barra ou numa linha
  para ver…" e levam à lista filtrada (R20.8): etapa → `/funis/<área>?etapaId=` (o quadro mostra só
  aquela etapa, com o aviso "Mostrando só esta etapa" e o botão "Mostrar todas as etapas"); canal e
  fila → `/atendimento?canalId=`/`?filaId=` (a caixa de entrada abre o painel de filtros com a "Conta
  do canal" ou a fila escolhida e o botão "Limpar filtros"); pessoa → vira o filtro "Responsável"
  do painel; negócio, contato e campanha abrem o detalhe.
- **Exportação:** "Planilha (XLSX)" (uma aba por tabela) e "Indicadores (CSV)"; cada tabela também
  baixa em CSV. Os números são os do painel, de quem exporta.
- **Estados:** carregando (esqueletos), vazio ("Sem dados no período"), erro com "Tentar de novo",
  sem acesso (403) e reconectando. No celular (390 px) os cartões empilham e os gráficos mantêm a
  altura, sem rolagem horizontal.
- **Tela inicial** (`/inicio`): usa os mesmos endpoints (abas Atendimento e Equipe, indicadores de
  MRR e saúde dos clientes), com o mesmo componente de gráfico.

## 2. Análise por IA (modal do BI e `/bi/analises`)

- **Botão "Analisar com IA"** no topo do BI, só para o Admin. O modal mostra o painel lido e o
  período, explica que a IA lê só números agregados (sem dado pessoal) e quantas análises restam no
  dia; "Gerar análise" abre o streaming (fases e texto aparecendo) e termina com "Análise pronta: N
  destaques, N riscos e N ações".
- **Resultado:** _Resumo_, _Destaques_ (positivo ou negativo), _Riscos_ (gravidade) e _Ações
  recomendadas_ numeradas, com prioridade e um link para a lista que sustenta cada uma (por exemplo
  "Ver negócios em Novo" abre o quadro só naquela etapa).
- **Perguntar sobre esta análise:** campo de até 1.000 caracteres, até 5 perguntas, resposta em
  streaming abaixo do resultado.
- **Histórico** (`/bi/analises`, também no modal): quem pediu, painel, filtros, status, tokens e o
  resultado de cada análise; é do Admin.
- **Sem chave configurada:** o modal explica como definir `ANTHROPIC_API_KEY` no `.env` da API (sem
  mostrar valor). Limite diário estourado: aviso com o horário em que volta. Falha da API: mensagem
  clara e "Tentar de novo"; a análise falha não conta no limite.

## 3. Financeiro (`/financeiro`)

Quatro abas — **Contratos**, **Parcelas a receber**, **Régua de cobrança** e **Indicadores** — sob
um cabeçalho comum. Acesso (R22.1): Admin, C-level e líder de CS gerenciam tudo; membro de CS vê e
atua na própria carteira; Comercial vê, só leitura, os contratos que ganhou; Marketing recebe
"Sem acesso".

### 3.1 Contratos (`/financeiro/contratos`, `/novo`, `/:id`)

- **Lista:** busca, filtro por situação (Ativo, Suspenso, Cancelado, Encerrado), contador
  ("71 contratos"), colunas de contrato, cliente, valor, receita mensal, situação, renovação e
  responsável de CS. Vazio: ilustração e "Novo contrato".
- **Novo contrato:** cliente (contato ou empresa), produto, valor, periodicidade, início, fim,
  renovação, dia de vencimento, responsável de CS, "Renova sozinho" e "Criar as parcelas agora" com a
  quantidade. Vindo de um negócio ganho (`?negocio=`), os campos chegam preenchidos.
- **Detalhe:** resumo (valor, receita mensal, situação, datas), ações (suspender, reativar, cancelar,
  com confirmação que explica o efeito nas parcelas), parcelas do contrato e linha do tempo.
- **No negócio ganho** (detalhe do negócio do Comercial): cartão "Criar o contrato deste negócio?"
  com produto, valor e periodicidade e o botão "Criar contrato"; some quando o contrato existe. No
  negócio de CS e no contato aparece o **risco de churn** (nível e motivos).

### 3.2 Parcelas a receber (`/financeiro/parcelas`, `/importar`)

- **Lista:** filtros por situação, período de vencimento e busca; totais no topo (a receber, em
  atraso, recebido); clicar numa linha abre o painel lateral da parcela (`?parcela=<id>`) com
  situação, links (boleto, pagamento e Pix), **Dar baixa** (data, valor e forma), editar, renegociar,
  cancelar e a linha do tempo da régua daquele título. Mudar o vencimento reinicia a régua; dar baixa
  a encerra (os dois avisos estão no painel).
- **Importar** (`/financeiro/parcelas/importar`): o mesmo assistente da importação de contatos
  (arquivo, colunas, opções, importação) com o tipo fixo em Parcelas; as opções são "Atualizar" e
  "Ignorar" duplicados. O resultado mostra criados, atualizados, ignorados e com erro, linha a linha,
  e o relatório em Excel.

### 3.3 Régua de cobrança (`/financeiro/regua/:aba`)

Cabeçalho com o estado ("Régua ligada · Roda todo dia às 09:00 · Última execução…"), **Pausar
régua** e **Executar agora** (com confirmação). Quatro abas:

- **Hoje:** o que sai hoje por canal (WhatsApp, e-mail, ligação), o próximo envio e a tabela "Envios
  da régua" (parcela, etapa, canal, situação, quando e detalhe — inclui os pulados e o motivo:
  "Além da tolerância" ou "Superada pela etapa mais recente"); "Reenviar falhas".
- **Ligações:** cartões das ligações a fazer (parcela, valor, telefone com link `tel:`, roteiro da
  etapa e prazo) e **Registrar resultado**: "Prometeu pagar" (com a data), "Sem acordo", "Não atendeu"
  e "Já pagou", mais a observação. A promessa suspende a régua daquele título e confirma ao cliente.
- **Etapas:** as dez etapas padrão (D-7 a D+60) com canais, textos, variáveis do título e roteiro,
  todas editáveis; marco repetido ou variável inválida são recusados com a explicação.
- **Configuração:** horário, tolerância (dias), número do WhatsApp do financeiro, intervalo entre
  mensagens, horário limite das ligações e liga/desliga.
- Quem só vê (membro de CS) tem a leitura das abas e o registro do resultado das próprias ligações.

### 3.4 Indicadores (`/financeiro/indicadores`)

Cartões (receita mensal, contratos na receita, em atraso, taxa de inadimplência, recebido do
previsto), **Receita mensal** (gráfico por mês e a tabela com novo, expansão, contração e churn),
**Atraso por faixa** (gráfico de barras e a lista com parcelas e clientes por faixa), **Clientes com
risco de churn** (nível, pontuação e motivos, com link para o contato) e **Previsto × recebido** por
mês. Os gráficos são o componente `ui/grafico` (o mesmo do BI); cada um tem a tabela ao lado.

## 4. Marca "não contatar por WhatsApp" (detalhe do contato)

No bloco **Privacidade (LGPD)** do contato, o controle "Não contatar por WhatsApp" liga e desliga a
marca que a régua respeita (R24.7): ligar acrescenta a etiqueta `nao-contatar-whatsapp`; desligar a
retira e limpa o campo personalizado `nao_contatar_whatsapp`, se estava ligado. A dica explica o
efeito ("a régua usa só e-mail e ligação"); quem não edita o contato vê o controle desabilitado com o
motivo. O opt-out de marketing é outro controle e não bloqueia a cobrança.

## 5. Navegação e links entre módulos

- `/funis/:area?etapaId=<id>`: o quadro mostra só a coluna da etapa (e `?funil=` escolhe o funil);
  "Mostrar todas as etapas" remove o filtro.
- `/atendimento?canalId=<id>` e `?filaId=<id>`: a caixa de entrada abre filtrada, com o painel de
  filtros aberto; o endereço é limpo depois de aplicar (o filtro fica no estado da tela).
- `/financeiro/parcelas?parcela=<id>`: abre o painel da parcela (usado pelas ligações e pelo BI).
- `/financeiro/contratos/novo?negocio=<id>`: contrato pré-preenchido do negócio ganho.
- `/contatos?responsavel=<id>`: lista de contatos do responsável (link das ações da análise).

## 6. Diferenças e observações da integração

- **Cartão "Contratos na receita":** o número (ativos e suspensos, os que compõem o MRR) não bate com
  o chip "Ativo" da lista de contratos, por isso o rótulo deixou de ser "Contratos ativos".
- **Menu e papéis:** o BI virou acessível a todos os papéis (cada um vê as abas do seu painel); no
  menu, o grupo "Gestão" de quem não é líder nem direção mostra só "BI e relatórios" (o resto —
  Chatbot, Automações — segue de líderes e direção); o teste do menu confere isso.
- **Filtro de conta do canal:** o filtro por tipo de canal (pílulas) continua; o clique do BI usa a
  conta específica (`canalId`), com o seletor "Conta do canal" ao lado de "Fila".
- **Gráficos do Financeiro** trocaram as barras em CSS pelo `ui/grafico`; a tabela de números segue
  ao lado de cada gráfico como alternativa.
