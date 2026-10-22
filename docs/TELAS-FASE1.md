# Telas da Fase 1 — CRM BRL

Especificação de UX das telas do núcleo do CRM. As regras ficam em
`crmbrl-api/docs/REGRAS-DE-NEGOCIO.md` (códigos `R…` citados aqui); o visual segue
`docs/DESIGN-SYSTEM.md`. O contrato HTTP é o OpenAPI da API (`/api/docs-json`).

> **Situação (22/10/2026):** todas as telas abaixo estão implementadas e foram conferidas
> contra a API real, com login real de cada papel. Onde a implementação ficou diferente do
> planejado há uma nota **Diferente do planejado**, com o motivo; o que foi feito a mais está
> em **Além do planejado**; o que mudou depois das revisões de produto e técnica está em
> **Ajuste da revisão**.

Princípios que valem para todas as telas:

- **Uma ação principal por tela**, em botão pílula invertido, sempre no mesmo lugar (canto
  superior direito do cabeçalho da página; no mobile, botão flutuante circular).
- **Frase de propósito** abaixo do título ("Acompanhe cada oportunidade até o
  fechamento.") e `app-dica` em tudo que não se explica sozinho — principalmente nas regras
  automáticas (passagens, rodízio, encaminhamento).
- **Estados completos**: carregando (esqueleto com a forma do conteúdo, nunca spinner solto),
  vazio (ilustração simples + frase + ação), erro (mensagem humana + "Tentar de novo") e
  sem acesso.
- **Feedback de toda ação** com aviso curto (toast) no canto inferior; ações destrutivas
  pedem confirmação em modal dizendo exatamente o que vai acontecer.
- **Teclado e leitor de tela** em tudo, inclusive no kanban (CDK drag-drop com teclado e
  anúncio pelo `LiveAnnouncer`).
- Textos em português, sem siglas sem explicação.

## 1. Acesso

### 1.1 Entrar (`/entrar`, pública)

Duas colunas no desktop (uma no mobile):

- **Esquerda — palco da marca**: logo, título display em dois tons "Seu cliente, do
  primeiro contato" + "ao sucesso.", e uma ilustração com barras de funil no gradiente de
  dados.
- **Direita — cartão do formulário**: e-mail, senha (com "mostrar senha"), botão
  "Entrar" (pílula invertida, largura total), link "Esqueci minha senha".
- Erros: credenciais (mensagem genérica, R2.3), conta desativada, bloqueio por tentativas
  (R2.5, dizendo em quantos minutos tentar de novo). Nunca limpar o e-mail digitado.
- Depois do login: se `deveTrocarSenha`, vai para `/trocar-senha`; senão, para a rota que
  o usuário tentou abrir, ou `/inicio`.

> **Além do planejado:** o bloqueio mostra também a hora em que libera, com contagem
> regressiva e o botão desabilitado até lá; o bloqueio por IP (muitas falhas da mesma rede)
> tem mensagem própria. Com a sessão aberta, `/entrar` segue para o início.

### 1.2 Trocar senha (`/trocar-senha`)

Senha atual (se não for primeiro acesso), nova senha e confirmação, com a regra visível
("mínimo de 8 caracteres") e validação em tempo real. Explica por que a troca é
obrigatória no primeiro acesso.

> **Além do planejado:** na troca obrigatória a tela não pede de novo a senha temporária
> digitada segundos antes no Entrar (pede só se a página foi recarregada) e oferece "Sair";
> na voluntária (menu da conta), "Cancelar" volta para a página anterior e um aviso diz que as
> outras sessões serão encerradas. As regras ("8 caracteres", "diferente da atual", "as duas
> iguais") são conferidas enquanto se digita.

### 1.3 Esqueci / redefinir senha (`/esqueci-senha`, `/redefinir-senha?token=`)

Só aparecem se a API informar que o e-mail está configurado. A resposta do "esqueci" é
sempre a mesma, exista ou não o e-mail.

> **Diferente do planejado:** a API não tem uma rota pública que diga se o envio de e-mail
> está configurado, então o link "Esqueci minha senha" aparece sempre. Na primeira resposta
> 422 (R2.8, envio não configurado), a tela explica que é preciso pedir ao Admin uma senha
> temporária e, daí em diante, o Entrar troca o link por essa orientação. Para esconder o link
> desde o início, a API precisaria expor essa informação.
>
> **Além do planejado:** `/definir-senha?token=` (convite por e-mail) usa a mesma tela do
> redefinir: confere o link mostrando um esqueleto, diz "Olá, <nome>" e até quando o link
> vale, explica link vencido, usado ou incompleto com o próximo passo e, com a senha definida,
> já entra no CRM. Depois de pedir o link, "Enviar de novo" só libera depois de 2 minutos (o
> intervalo da API).

## 2. Casca (ajustes)

- O **modo demonstração sai**: o usuário vem de `auth/eu`. A navegação filtra pelo papel
  real (matriz da §12 das regras). Guardas de rota: sem sessão → `/entrar`; sem papel →
  página "sem acesso".
- Menu do avatar: nome, papel, "Meu perfil", "Trocar senha", "Sair".
- **Sino de notificações**: painel com as não lidas primeiro, ícone por tipo, tempo
  relativo, link para o item, "Marcar todas como lidas". Atualiza a cada 30 s (o tempo real
  chega na Fase 2).

> **Além do planejado:** sem sessão, a rota pedida fica em `/entrar?voltar=` e a pessoa volta
> para ela depois de entrar (também quando a sessão termina no meio do uso, com o aviso "Sua
> sessão terminou"). A página "sem acesso" (`/sem-acesso?pagina=`) diz o que foi negado e
> quem acessa. O menu do avatar mostra também o e-mail. O sino também atualiza ao voltar para
> a aba (e para com a aba escondida) e marca uma notificação ou todas com "Desfazer". A busca
> da barra superior procura em Contatos e empresas quando o termo não é nome de módulo.
>
> **Ajuste da revisão:** os avisos com ação ("Desfazer") ficam 20 s e **F8** leva o foco até
> eles (F8 ou Esc voltam); com um modal ou painel aberto, os avisos e os anúncios ao leitor de
> tela continuam funcionando (moram dentro do diálogo). Um 403 no meio do uso relê o perfil (o
> menu e as guardas se atualizam) e a tela mostra "sem acesso", sem "Tentar de novo". O item
> "Design system" só aparece no menu do Admin (a rota continua abrindo pelo link). O app só
> pré-carrega as páginas dos módulos que o papel acessa, depois de entrar.

## 3. Funis — Marketing, Comercial e Customer Success (`/funis/:area`)

### 3.1 Quadro (kanban)

- Cabeçalho: título "Comercial" + frase de propósito; filtros em pílulas
  (**Meus** · **Da equipe** · **Todos**, conforme o papel), busca, filtro por etiqueta;
  ação principal "Novo negócio".
- **Colunas = etapas**, em cartões altos com rolagem própria. Cabeçalho da coluna: nome,
  quantidade, soma dos valores (no Comercial e no CS) e a dica do prazo-alvo. As colunas de
  ganho e de perda ficam no fim, mais estreitas e recolhíveis.
- **Cartão do negócio**: título, contato/empresa, valor, avatar do responsável, selo do
  tempo na etapa (neutro; **coral** quando passou do prazo-alvo — "parado"), etiquetas e a
  próxima atividade (com ícone de atrasada se for o caso). Cartão sem responsável mostra
  "Assumir".
- **Arrastar e soltar** (CDK) entre colunas e dentro da coluna, com toque e teclado.
  Soltar em:
  - etapa de **perda** → modal pedindo o motivo (R5.5); cancelar desfaz o movimento;
  - etapa de **ganho** → aviso "Negócio ganho! Enviado ao Customer Success" quando houver
    passagem (R5.7);
  - etapa de **MQL** no Marketing → aviso "Lead qualificado enviado ao Comercial".
    Atualização otimista com desfazer automático e mensagem se a API recusar.
- Dicas fixas no cabeçalho explicando as passagens e o rodízio daquele funil.

> **Diferente do planejado:** "Assumir" só aparece em negócio **aberto** (ganho ou perdido sem
> responsável não oferece). O membro vê "Meus" e "Todos que vejo" (os seus e os sem
> responsável, R5.9), com "Da equipe" desabilitado e a dica do motivo. Negócio ganho ou
> perdido só sai da etapa (arrastando) para quem pode reabrir (R5.5).
>
> **Além do planejado:** o título traz o total em aberto e o cabeçalho mostra o valor em
> aberto (Comercial e CS); quando a área tem mais de um funil, há a escolha do funil; o
> cartão tem o menu "⋯" com "Mover para…"; os avisos de ganho e de MQL dizem quem recebeu o
> negócio ("…, aos cuidados de Fulano.") e, para quem enxerga mais de uma área, trazem "Ver
> negócio"; o estado recolhido das colunas de ganho e perda fica salvo no navegador. O selo
> coral "Parado · N d" funciona, mas logo depois de semear a demonstração nenhum negócio está
> parado (a API não aceita datas retroativas; os do Comercial em "Novo" ficam parados no dia
> seguinte).
>
> **Ajuste da revisão:** as dicas "Passagens" e "Rodízio" são montadas da configuração real
> para quem a lê (Admin e C-level leem as passagens: o que chega, o que sai, quem recebe e se está
> desligada; Admin, C-level e liderança leem o rodízio: quantos na fila e se a liderança entra);
> os outros papéis veem a configuração padrão em frases condicionais, com onde conferir. A pílula
> inteira abre a dica. Pelo teclado, o cartão "pego" volta ao lugar se o foco sair dele (clique
> fora, outro cartão); fechar o detalhe devolve o foco ao cartão. No celular, a busca e a
> etiqueta ficam atrás do botão "Filtros", na linha do valor em aberto.

### 3.2 Detalhe do negócio (painel lateral, rota `/funis/:area/:negocioId`)

- Título editável, etapa (seletor que move), valor, valor recorrente, previsão de
  fechamento, responsável (trocar), contato e empresa (links), etiquetas.
- Abas: **Linha do tempo** (auditoria + atividades, R3.5), **Atividades** (criar,
  concluir), **Dados**.
- Vínculos da jornada: "Veio de: Marketing — <negócio>" / "Gerou: Customer Success —
  <negócio>", com link.
- Ações secundárias: reabrir (só para quem pode, R5.5), mover para perda (com motivo).

> **Diferente do planejado:** o título, os valores, a previsão e o motivo se editam na aba
> **Dados** (o cabeçalho mostra o título). Quem não enxerga o funil do outro lado da jornada
> (ex.: o Líder CS diante de um negócio que veio do Comercial) vê "Veio de: outro funil · por
> uma passagem; você não tem acesso a esse funil", sem link (R5.9). "Reabrir" fica
> desabilitado, com o motivo, para quem não pode.
>
> **Além do planejado:** "Assumir" no painel; tempo na etapa; a aba Atividades conclui com
> "Desfazer", reabre e cria reunião com início e fim e nota; a aba Dados mostra origem, UTM e
> campos personalizados; a linha do tempo tem "Carregar mais".
>
> **Ajuste da revisão:** a linha do tempo tem os filtros Tudo · Alterações · Atividades (como a
> do contato) e a atividade aparece uma vez só (os eventos "criada" e "concluída" dela saem da
> lista). "Marcar como perdido" pelo detalhe funciona com o quadro por baixo (cada modal tem o
> próprio formulário).

### 3.3 Novo negócio (modal)

Contato (busca com criação inline e aviso de duplicado, R4.2), empresa opcional, título
sugerido, valor, etapa (padrão: a primeira) e responsável (padrão: quem cria).

> **Além do planejado:** o aviso de duplicado aparece ao sair do e-mail ou do telefone, com
> "Usar <contato>"; se a API reconverter o contato, a tela avisa; a empresa pode ser
> existente ou nova. Os erros da API aparecem no campo certo.

### 3.4 Configurar etapas (modal; líder da área, C-level, Admin)

Lista reordenável (CDK) com nome, tipo, prazo-alvo e probabilidade; adicionar e remover
(remoção bloqueada com explicação se houver negócios, R5.2).

> **Diferente do planejado:** o tipo não se edita: as etapas de ganho e de perda ficam sempre
> no fim (com o selo "ganho"/"perda") e a etapa nova é aberta e entra antes do ganho, o que
> garante a regra de uma etapa de ganho e uma de perda por funil (R5.2). Cada linha salva e
> descarta as próprias alterações.
>
> **Além do planejado:** além de arrastar, cada etapa sobe e desce por botões de seta (o foco
> fica na etapa movida, com anúncio ao leitor de tela); prazo e probabilidade são validados
> com os limites da API.

## 4. Contatos e empresas (`/contatos`)

- Abas **Pessoas** e **Empresas**. Tabela com busca, filtros (responsável, origem,
  etiqueta, opt-out) e paginação; colunas principais visíveis no mobile como lista de
  cartões.
- Ação principal "Novo contato" / "Nova empresa", com detecção de duplicado em tempo real
  (mostra o existente e oferece abrir).
- **Detalhe** (`/contatos/:id`, `/empresas/:id`): cabeçalho com avatar, nome, empresa,
  telefone e e-mail com ações (copiar; WhatsApp chega na Fase 2), origem e última origem
  com UTM; abas **Linha do tempo**, **Negócios** (de todos os funis, com a jornada),
  **Atividades** e **Dados**. Bloco LGPD: opt-out de marketing e consentimento (R4.6);
  anonimizar só para Admin, com confirmação forte.

> **Diferente do planejado:** o filtro de origem é pela **primeira** origem do contato. O botão
> de WhatsApp aparece e avisa que a conversa integrada chega na Fase 2.
>
> **Além do planejado:** a busca, os filtros, a página e as abas ficam na URL (`/empresas`
> leva a `/contatos?aba=empresas`); a detecção de duplicado também olha nome parecido (pessoa)
> e CNPJ repetido (empresa) e, se a checagem falhar, salvar continua possível; empresas têm
> filtro por UF; o detalhe da empresa tem a aba **Pessoas**; editar segue a permissão do
> papel (todos, da equipe ou só os próprios), com a ação desabilitada dizendo por quê.
>
> **Ajuste da revisão:** o filtro de origem diz que é a primeira ("Primeira origem: Site"). Na
> aba **Negócios**, as áreas que o papel não vê aparecem como "sem acesso" (e não "nenhum"), e o
> membro lê, fora do balão, que vê só os seus negócios e os sem responsável; valor e tempo na
> etapa seguem o formato do quadro ("R$ 1.200", "Na etapa desde ontem").

## 5. Atividades (`/atividades`)

- Lista agrupada: **Atrasadas** (coral), **Hoje**, **Próximos 7 dias**, **Mais tarde**,
  **Sem data**; aba **Concluídas**. Filtros: minhas · da equipe (líder) · todas (C-level e
  Admin), tipo.
- Criação rápida no topo ("Ligar para Maria amanhã às 10h": tipo, título, data/hora,
  vínculo opcional com contato/negócio).
- Concluir por checkbox grande (alvo de 44px), com desfazer no aviso.
- Atividades recebidas por desligamento mostram o selo "Encaminhada de <nome>" (R7.3).

> **Além do planejado:** a criação rápida mostra o que entendeu antes de salvar ("Entendido:
> Ligação, amanhã às 10:00 · título …") e entende o dia da semana ("sexta às 9h"); o vínculo
> busca também empresas. Um resumo lateral conta cada grupo e as encaminhadas; o painel de
> detalhe (`?atividade=`) edita, conclui e cancela (com confirmação). Os filtros que o papel
> não tem ficam visíveis e desabilitados, com o motivo.

## 6. Configurações (`/configuracoes`)

- **Usuários** (Admin): tabela com nome, e-mail, papel (selo), líder, status e último
  acesso. "Convidar usuário": nome, e-mail, papel e líder — o seletor de líder só oferece
  quem a regra permite (R1.2) e explica o porquê.
  - **Desligar**: modal com a prévia (R7.1): "As 12 atividades pendentes, 3 negócios
    abertos e 5 contatos de Pedro vão para Carla (Líder Comercial)". Para C-level, escolhe o
    C-level destinatário. Confirmação digitando o primeiro nome.
  - Reativar (exige líder), senha temporária.
- **Minha equipe** (líderes e C-level): leitura da hierarquia em árvore.
- **Distribuição de leads** (Admin, C-level, líder da área): por área, quem participa do
  rodízio e se o líder entra (R5.8), com a dica explicando a regra.
- **Passagens entre funis** (Admin, C-level): lista com gatilho e destino, ativar/desativar.
- **Meu perfil**: nome, troca de senha.

> **Diferente do planejado:** em **Meu perfil**, só o Admin edita o próprio nome (alterar
> usuários é do Admin na API); os demais veem os seus dados (área, líder, telefone, desde
> quando a sessão está aberta) e trocam a senha. **Minha equipe** não aparece para o Admin,
> que não faz parte da hierarquia.
>
> **Além do planejado:** o convite escolhe entre e-mail e senha temporária (com "Gerar senha
> forte"); a edição envia só o que mudou; uma faixa avisa quando há pessoas "sem o líder
> certo" (líder provisório depois de um desligamento, R7.3), com atalho para escolher o novo;
> a prévia do desligamento mostra liderados, responsável fixo e o alerta "equipe sem líder", é
> refeita num 409 e o aviso final resume o que foi para quem; a confirmação pelo primeiro nome
> não diferencia maiúsculas nem acentos; ativar e desativar participantes do rodízio e
> passagens têm "Desfazer"; Minha equipe tem quatro indicadores de resumo.
>
> **Ajuste da revisão:** a tabela de Usuários cabe num notebook de 1280 px (nome, e-mail e líder
> quebram linha; o e-mail só depois da arroba) e a coluna "⋯" fica presa à direita quando a
> tabela rola. As dicas dos alternadores começam pela situação atual ("Ligada: … Se desligar, …").
> Na Distribuição, quem nunca entrou no CRM (convite pendente) aparece assim no rodízio e no
> "Próximo da vez". Os textos não citam mais os códigos das regras (R…).

## 7. Integrações (`/integracoes`, Admin)

- **Webhooks de entrada**: lista (nome, funil/etapa, último recebimento, status). Criação
  em passos: 1) nome e destino (funil, etapa, distribuição); 2) mapeamento — modelo pronto
  (Genérico, Disparos BRL) ou personalizado, com prévia aplicada a um JSON de exemplo; 3)
  segurança (segredo HMAC opcional). Ao concluir, mostra a URL **uma única vez**, com
  botão copiar e um exemplo `curl` pronto. Aba **Recebimentos** com status, corpo,
  resultado e "Reprocessar".
- **Webhooks de saída**: lista (nome, URL, eventos, saúde: últimas entregas). Criação: nome,
  URL, eventos (checkboxes com descrição de cada um), cabeçalhos extras; o segredo aparece
  uma vez. "Enviar teste". Aba **Entregas** com tentativas, status HTTP, duração, trecho da
  resposta e "Reenviar". Destino desativado automaticamente aparece em destaque com o
  motivo.
- Dica explicando como validar a assinatura (`X-CRM-Assinatura`), com exemplo de código.

> **Diferente do planejado:** a "saúde" do webhook de saída é calculada do que a lista da API
> traz (entregas pendentes, falhas e falhas seguidas: "Entregando", "N falhas seguidas"…), e
> não uma linha do tempo das últimas entregas; o histórico completo fica na aba **Entregas**.
>
> **Além do planejado:** a lista de entrada mostra quem fica com o lead e o volume das últimas
> 24 h com erros; o painel do webhook de entrada tem detalhe do recebimento (corpo, cabeçalhos,
> IP, tentativas), simulação, "novo endereço" (o antigo para na hora), exigir ou remover
> assinatura, desativar e excluir com confirmação forte. A dica da assinatura tem os passos e
> exemplos em Node.js e Python; o webhook de **entrada** usa `X-Assinatura` (R8.3) e o de
> **saída** assina com `X-CRM-Assinatura` (R9).
>
> **Ajuste da revisão:** a lista de entrada mostra o fim do endereço ("…/entrada/yxBjWicA…"),
> que é o que diferencia um webhook do outro, com o endereço mascarado inteiro no `title`. O
> "Copiar" dos valores mostrados uma única vez funciona dentro do modal mesmo sem a Clipboard API
> (CRM aberto por http fora do `localhost`); se não der, o valor fica selecionado.

## 8. Administração (`/administracao`)

- **Auditoria** (Admin, C-level): filtros (período, usuário, ação, entidade, texto),
  tabela densa com tempo, ator, ação e resumo; painel lateral com o diff antes/depois.
  Paginação por cursor ("Carregar mais").
- **Logs técnicos** (Admin): filtros por nível e período, selo por nível, detalhe com
  dados e id da requisição.
- **Dúvidas à IA**: aba "em breve" (Fase 5).

> **Diferente do planejado:** em "Ligado a", funis, etapas e pessoas aparecem pelo nome, mas
> negócio e contato aparecem pelo id (com o link para abrir), porque o detalhe do evento só
> traz `{ entidade, id }` dos relacionados.
>
> **Além do planejado:** filtro por tipo de ator ("Quem fez": pessoa, sistema, webhook,
> automação, IA) e por id da requisição; o diff mostra nomes no lugar de ids e códigos
> traduzidos; atalhos "Abrir o negócio", "Ver eventos desta requisição" e "Ver nos logs
> técnicos" (só Admin). Os logs técnicos filtram também por origem e texto e levam de volta à
> auditoria da mesma requisição. No celular, os filtros ficam atrás do botão "Filtros".
>
> **Ajuste da revisão:** todas as ações que a API registra têm rótulo revisado (uma spec compara
> com a lista da API). No detalhe, "Dados registrados" vira uma lista legível ("Quem recebeu:
> Rafael Mendes (Líder Comercial)", "Em números: 1 atividade · 1 negócio · saiu de 3 rodízios") e
> o JSON fica em "Ver dados técnicos"; a ação mostra o rótulo ao lado do código.

## 9. Visão geral (`/inicio`)

A aba "Jornada do cliente" passa a usar as métricas reais da API (R5.10) quando houver
dados, mantendo o selo "Dados de exemplo" só nos blocos que ainda dependem de módulos
futuros (atendimento, receita recorrente).

> **Além do planejado:** "Próximas atividades" e "Status do sistema" são reais; a jornada
> mostra só as áreas que o papel vê, com troca de período (7 dias, 30 dias, Trimestre). Com
> "Dados de exemplo" ficam as abas Atendimento e Equipe, os indicadores de receita recorrente
> e health score e a "Análise com IA" (beta, com a nota "Exemplo ilustrativo").
