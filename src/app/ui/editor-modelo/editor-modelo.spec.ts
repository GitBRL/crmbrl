import { TestBed } from '@angular/core/testing';

import { EditorModelo } from './editor-modelo';
import {
  contarCombinacoes,
  inserirNoTexto,
  renderizarModelo,
  textoRenderizado,
  validarModelo,
} from './modelo-mensagem';

const MARIA = { 'contato.nome': 'Maria Souza', 'contato.primeiro_nome': 'Maria' };

describe('modelo de mensagem (funções)', () => {
  it('troca variáveis, usa o valor padrão e marca a que falta', () => {
    const partes = renderizarModelo(
      'Oi, {{contato.primeiro_nome}}! {{empresa.nome|sua escola}} {{responsavel.nome}}',
      MARIA,
      's',
    );
    expect(partes.map((p) => p.tipo)).toEqual([
      'texto',
      'variavel',
      'texto',
      'variavel',
      'texto',
      'faltando',
    ]);
    expect(textoRenderizado(partes)).toBe('Oi, Maria! sua escola ');
  });

  it('sorteia a variação de forma reprodutível pela semente e varia entre sementes', () => {
    const modelo = '{olá|oi|e aí}, {{contato.primeiro_nome}}';
    const a = textoRenderizado(renderizarModelo(modelo, MARIA, 'contato-1'));
    expect(textoRenderizado(renderizarModelo(modelo, MARIA, 'contato-1'))).toBe(a);
    const vistas = new Set(
      Array.from({ length: 40 }, (_, i) =>
        textoRenderizado(renderizarModelo(modelo, MARIA, `c${i}`)),
      ),
    );
    expect(vistas.size).toBe(3);
  });

  it('conta combinações', () => {
    expect(contarCombinacoes('{a|b} e {c|d|e} {{x}}')).toBe(6);
    expect(contarCombinacoes('sem variação')).toBe(1);
  });

  it('valida variável desconhecida, variação vazia e chave sem par', () => {
    expect(validarModelo('{{contato.nome}} {{contato.campos.vencimento}} {a|b}')).toEqual([]);
    expect(validarModelo('{{contato.cpf}}')[0].mensagem).toContain('contato.cpf');
    expect(validarModelo('{a||b}')[0].mensagem).toContain('variações está vazia');
    expect(validarModelo('olá {{contato.nome')[0].mensagem).toContain('chave sem par');
  });

  it('insere no lugar da seleção e devolve a nova seleção', () => {
    expect(inserirNoTexto('Oi !', 3, 3, '{{contato.nome}}')).toEqual({
      texto: 'Oi {{contato.nome}}!',
      de: 19,
      ate: 19,
    });
    expect(inserirNoTexto('abc', 1, 2, '{x|y}', { de: 1, ate: 4 })).toEqual({
      texto: 'a{x|y}c',
      de: 2,
      ate: 5,
    });
  });
});

describe('EditorModelo', () => {
  function criar(texto = '') {
    const fixture = TestBed.createComponent(EditorModelo);
    fixture.componentInstance.valor.set(texto);
    return { fixture, raiz: fixture.nativeElement as HTMLElement, c: fixture.componentInstance };
  }

  it('mostra a prévia do contato escolhido e destaca o que veio de variável', async () => {
    const { fixture, raiz } = criar('Oi, {{contato.primeiro_nome}}!');
    await fixture.whenStable();
    const previa = raiz.querySelector('[data-teste="previa"]') as HTMLElement;
    expect(previa.textContent?.replace(/\s+/g, ' ').trim()).toBe('Oi, Maria!');
    expect(previa.querySelector('mark')?.textContent).toBe('Maria');
  });

  it('botão de variável insere o marcador e "Outra variação" só aparece com variações', async () => {
    const { fixture, raiz, c } = criar('Oi, ');
    await fixture.whenStable();
    expect(
      [...raiz.querySelectorAll('button')].some((b) => b.textContent?.includes('Outra variação')),
    ).toBe(false);
    const botao = [...raiz.querySelectorAll<HTMLButtonElement>('.modelo__variavel')].find((b) =>
      b.textContent?.includes('Primeiro nome'),
    )!;
    botao.click();
    await fixture.whenStable();
    expect(c.valor()).toBe('Oi, {{contato.primeiro_nome}}');

    const variacao = [...raiz.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Adicionar variação'),
    )!;
    variacao.click();
    await fixture.whenStable();
    expect(c.valor()).toContain('{opção 1|opção 2}');
    expect(raiz.textContent).toContain('2 combinações');
    expect(
      [...raiz.querySelectorAll('button')].some((b) => b.textContent?.includes('Outra variação')),
    ).toBe(true);
  });

  it('avisa de variável desconhecida em role=alert e mostra a prévia vazia sem texto', async () => {
    const { fixture, raiz, c } = criar('');
    await fixture.whenStable();
    expect(raiz.querySelector('.modelo__vazio')).not.toBeNull();
    expect(raiz.querySelector('[role="alert"]')).toBeNull();
    c.valor.set('Olá {{contato.cpf}}');
    await fixture.whenStable();
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('contato.cpf');
  });
});
