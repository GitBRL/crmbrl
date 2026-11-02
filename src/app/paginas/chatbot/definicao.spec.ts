import type { PassoDefinicao } from './chatbot.tipos';
import {
  alternarRamoExtra,
  cabecalhosParaTexto,
  clonarPasso,
  contarPassos,
  ehSenao,
  moverItem,
  novoPasso,
  opcoesDaPergunta,
  problemasDaArvore,
  problemasDoPasso,
  sincronizarRamosDaPergunta,
  textoParaCabecalhos,
  textoParaCorpo,
  textoParaLista,
  variaveisDoFluxo,
} from './definicao';

describe('definicao do fluxo', () => {
  it('pergunta com opções nasce com um ramo por opção, com o id da opção', () => {
    const passo = novoPasso('pergunta.opcoes');
    const opcoes = opcoesDaPergunta(passo);
    expect(opcoes).toHaveLength(2);
    expect(passo.ramos?.map((r) => r.id)).toEqual(opcoes.map((o) => o.id));
  });

  it('sincroniza os ramos com as opções, mantendo passos e extras e descartando o que sobrou', () => {
    let passo = novoPasso('pergunta.opcoes');
    const [a, b] = opcoesDaPergunta(passo);
    passo = {
      ...passo,
      ramos: passo.ramos!.map((r) =>
        r.id === a.id ? { ...r, passos: [novoPasso('encerrar')] } : r,
      ),
    };
    passo = alternarRamoExtra(passo, 'invalida', true);
    passo = alternarRamoExtra(passo, 'sem_resposta', true);
    expect(passo.ramos?.map((r) => r.id)).toEqual([a.id, b.id, 'sem_resposta', 'invalida']);

    const semB = sincronizarRamosDaPergunta({
      ...passo,
      config: { ...passo.config, opcoes: [{ ...a, rotulo: 'Vendas' }] },
    });
    expect(semB.ramos?.map((r) => r.id)).toEqual([a.id, 'sem_resposta', 'invalida']);
    expect(semB.ramos?.[0].rotulo).toBe('Vendas');
    expect(semB.ramos?.[0].passos).toHaveLength(1);
    expect(alternarRamoExtra(semB, 'invalida', false).ramos?.map((r) => r.id)).not.toContain(
      'invalida',
    );
  });

  it('condição nasce com um caminho com condição e o senão', () => {
    const passo = novoPasso('condicao');
    expect(passo.ramos).toHaveLength(2);
    expect(ehSenao(passo.ramos![0])).toBe(false);
    expect(ehSenao(passo.ramos![1])).toBe(true);
  });

  it('aponta o que falta preencher, em português, por passo', () => {
    expect(problemasDoPasso(novoPasso('mensagem'))).toEqual(['Escreva a mensagem.']);
    const aberta = novoPasso('pergunta.aberta');
    expect(problemasDoPasso(aberta)).toHaveLength(2);
    expect(problemasDoPasso({ ...novoPasso('mensagem'), config: { texto: 'Oi' } })).toEqual([]);
    expect(problemasDoPasso(novoPasso('pergunta.opcoes'))[0]).toContain('pergunta');
    expect(
      problemasDoPasso({ ...novoPasso('acao.webhook'), config: { url: 'ftp://x' } }),
    ).toHaveLength(1);
    expect(problemasDoPasso(novoPasso('condicao'))[0]).toContain('Informe a variável');
  });

  it('mapa de problemas inclui os passos dentro dos ramos', () => {
    const condicao = novoPasso('condicao');
    const aninhado: PassoDefinicao = {
      ...condicao,
      ramos: condicao.ramos!.map((r, i) =>
        i === 1 ? { ...r, passos: [novoPasso('mensagem')] } : r,
      ),
    };
    const mapa = problemasDaArvore([aninhado]);
    expect(mapa.has(aninhado.id)).toBe(true);
    expect(mapa.has(aninhado.ramos![1].passos[0].id)).toBe(true);
    expect(contarPassos([aninhado])).toBe(2);
  });

  it('lista as variáveis gravadas pelas perguntas', () => {
    const p1 = {
      ...novoPasso('pergunta.opcoes'),
      config: { ...novoPasso('pergunta.opcoes').config, variavel: 'assunto' },
    };
    const p2 = { ...novoPasso('pergunta.aberta'), config: { variavel: 'email' } };
    expect(variaveisDoFluxo([p1, p2])).toEqual(['assunto', 'assunto_id', 'email']);
  });

  it('clona com ids novos, mantendo ramo.id = opcao.id', () => {
    const original = novoPasso('pergunta.opcoes');
    const copia = clonarPasso(original);
    expect(copia.id).not.toBe(original.id);
    const opcoes = opcoesDaPergunta(copia);
    expect(opcoes.map((o) => o.id)).not.toEqual(opcoesDaPergunta(original).map((o) => o.id));
    expect(copia.ramos?.map((r) => r.id)).toEqual(opcoes.map((o) => o.id));
  });

  it('converte textos de campos', () => {
    expect(textoParaLista('a, b;\nb , c')).toEqual(['a', 'b', 'c']);
    expect(textoParaCabecalhos('Authorization: Bearer x:y\nsem dois pontos')).toEqual({
      Authorization: 'Bearer x:y',
    });
    expect(cabecalhosParaTexto({ A: '1' })).toBe('A: 1');
    expect(textoParaCorpo('')).toBeUndefined();
    expect(textoParaCorpo('{"a":1}')).toEqual({ a: 1 });
    expect(textoParaCorpo('[1]')).toBeNull();
    expect(textoParaCorpo('{quebrado')).toBeNull();
  });

  it('move itens sem alterar a lista original', () => {
    const lista = ['a', 'b', 'c'];
    expect(moverItem(lista, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moverItem(lista, 0, -1)).toEqual(['a', 'b', 'c']);
    expect(lista).toEqual(['a', 'b', 'c']);
  });
});
