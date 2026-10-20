---
description: Atualiza a documentação de código e arquitetura do crmbrl, registrando o que foi feito
argument-hint: "[resumo do que foi feito]"
allowed-tools: Bash(npm run docs:*), Bash(node tools/doc-updater/index.mjs:*), Bash(git:*), Read, Edit, Glob, Grep
---

# Atualizar documentação — crmbrl

Argumentos recebidos: `$ARGUMENTS`

Você vai atualizar a documentação deste projeto (front-end Angular do CRM BRL),
combinando duas coisas: o inventário técnico, que a ferramenta gera sozinha, e a
parte narrativa, que é você quem escreve.

## 1. Rodar a ferramenta

```
npm run docs -- --nota "<resumo>"
```

Este projeto usa **npm**, então as flags vêm depois de `--`. Sem nota, é só
`npm run docs`. Equivale a `node tools/doc-updater/index.mjs`.

Tudo que veio em `$ARGUMENTS` vira a nota — é o campo **"o que foi feito"** do
histórico. Se nada foi passado, rode sem `--nota` e deixe o diff dos commits contar
a história; não invente um resumo.

A ferramenta grava `docs/ARQUITETURA.md` (miolo entre os marcadores
`doc-updater:inicio`/`:fim`), `docs/HISTORICO.md` (entrada nova no topo) e
`docs/.estado-docs.json`.

## 2. Conferir o que mudou de verdade

Leia a entrada nova do `docs/HISTORICO.md`. Se o inventário acusar mudanças
estruturais que a nota não explica — componente novo, rota removida, dependência
trocada, variável de ambiente nova —, abra o código correspondente antes de escrever
qualquer coisa.

## 3. Escrever a parte que a ferramenta não escreve

Só as seções **fora** dos marcadores são suas; nunca edite o miolo gerado, ele é
sobrescrito na próxima execução. Atualize, quando houver o que dizer:

- **Contexto**: o fluxo real da aplicação — bootstrap, providers, casca, navegação,
  como os dados chegam da API. Não repita a estrutura de pastas, a tabela já mostra.
- **Decisões de arquitetura**: padrão adotado, alternativa descartada e o porquê.
  Uma decisão por item, com a data. Mantenha a lista de pendências em dia: o que foi
  resolvido sai de "pendente" e vira decisão registrada.

Pontos que valem registro neste projeto quando aparecerem: onde mora a URL base da
API, estratégia de autenticação e guardas de rota, organização por feature,
tratamento de erro de HTTP, e qualquer contrato novo com a `crmbrl-api`.

Escreva em português do Brasil, no mesmo tom direto do resto da documentação. Só
afirme o que você consegue sustentar lendo o código ou o histórico.

## 4. Fechar

Responda com um resumo curto: arquivos de documentação tocados, mudanças estruturais
detectadas e o que ficou pendente de descrição humana. Não faça commit — a menos que
o usuário tenha pedido.
