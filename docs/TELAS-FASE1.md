# Telas da Fase 1 — CRM BRL

Especificação de UX das telas do núcleo do CRM. As regras ficam em
`crmbrl-api/docs/REGRAS-DE-NEGOCIO.md` (códigos `R…` citados aqui); o visual segue
`docs/DESIGN-SYSTEM.md`. O contrato HTTP é o OpenAPI da API (`/api/docs-json`).

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

### 1.2 Trocar senha (`/trocar-senha`)
Senha atual (se não for primeiro acesso), nova senha e confirmação, com a regra visível
("mínimo de 8 caracteres") e validação em tempo real. Explica por que a troca é
obrigatória no primeiro acesso.

### 1.3 Esqueci / redefinir senha (`/esqueci-senha`, `/redefinir-senha?token=`)
Só aparecem se a API informar que o e-mail está configurado. A resposta do "esqueci" é
sempre a mesma, exista ou não o e-mail.

## 2. Casca (ajustes)

- O **modo demonstração sai**: o usuário vem de `auth/eu`. A navegação filtra pelo papel
  real (matriz da §12 das regras). Guardas de rota: sem sessão → `/entrar`; sem papel →
  página "sem acesso".
- Menu do avatar: nome, papel, "Meu perfil", "Trocar senha", "Sair".
- **Sino de notificações**: painel com as não lidas primeiro, ícone por tipo, tempo
  relativo, link para o item, "Marcar todas como lidas". Atualiza a cada 30 s (o tempo real
  chega na Fase 2).

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

### 3.2 Detalhe do negócio (painel lateral, rota `/funis/:area/:negocioId`)
- Título editável, etapa (seletor que move), valor, valor recorrente, previsão de
  fechamento, responsável (trocar), contato e empresa (links), etiquetas.
- Abas: **Linha do tempo** (auditoria + atividades, R3.5), **Atividades** (criar,
  concluir), **Dados**.
- Vínculos da jornada: "Veio de: Marketing — <negócio>" / "Gerou: Customer Success —
  <negócio>", com link.
- Ações secundárias: reabrir (só para quem pode, R5.5), mover para perda (com motivo).

### 3.3 Novo negócio (modal)
Contato (busca com criação inline e aviso de duplicado, R4.2), empresa opcional, título
sugerido, valor, etapa (padrão: a primeira) e responsável (padrão: quem cria).

### 3.4 Configurar etapas (modal; líder da área, C-level, Admin)
Lista reordenável (CDK) com nome, tipo, prazo-alvo e probabilidade; adicionar e remover
(remoção bloqueada com explicação se houver negócios, R5.2).

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

## 5. Atividades (`/atividades`)

- Lista agrupada: **Atrasadas** (coral), **Hoje**, **Próximos 7 dias**, **Mais tarde**,
  **Sem data**; aba **Concluídas**. Filtros: minhas · da equipe (líder) · todas (C-level e
  Admin), tipo.
- Criação rápida no topo ("Ligar para Maria amanhã às 10h": tipo, título, data/hora,
  vínculo opcional com contato/negócio).
- Concluir por checkbox grande (alvo de 44px), com desfazer no aviso.
- Atividades recebidas por desligamento mostram o selo "Encaminhada de <nome>" (R7.3).

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

## 7. Integrações (`/integracoes`, Admin)

- **Webhooks de entrada**: lista (nome, funil/etapa, último recebimento, status). Criação
  em passos: 1) nome e destino (funil, etapa, distribuição); 2) mapeamento — modelo pronto
  (Genérico, Disparos BRL) ou personalizado, com prévia aplicada a um JSON de exemplo;
  3) segurança (segredo HMAC opcional). Ao concluir, mostra a URL **uma única vez**, com
  botão copiar e um exemplo `curl` pronto. Aba **Recebimentos** com status, corpo,
  resultado e "Reprocessar".
- **Webhooks de saída**: lista (nome, URL, eventos, saúde: últimas entregas). Criação: nome,
  URL, eventos (checkboxes com descrição de cada um), cabeçalhos extras; o segredo aparece
  uma vez. "Enviar teste". Aba **Entregas** com tentativas, status HTTP, duração, trecho da
  resposta e "Reenviar". Destino desativado automaticamente aparece em destaque com o
  motivo.
- Dica explicando como validar a assinatura (`X-CRM-Assinatura`), com exemplo de código.

## 8. Administração (`/administracao`)

- **Auditoria** (Admin, C-level): filtros (período, usuário, ação, entidade, texto),
  tabela densa com tempo, ator, ação e resumo; painel lateral com o diff antes/depois.
  Paginação por cursor ("Carregar mais").
- **Logs técnicos** (Admin): filtros por nível e período, selo por nível, detalhe com
  dados e id da requisição.
- **Dúvidas à IA**: aba "em breve" (Fase 5).

## 9. Visão geral (`/inicio`)

A aba "Jornada do cliente" passa a usar as métricas reais da API (R5.10) quando houver
dados, mantendo o selo "Dados de exemplo" só nos blocos que ainda dependem de módulos
futuros (atendimento, receita recorrente).
