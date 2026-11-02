import { describe, expect, it } from 'vitest';

import { blocosDoMarkdown, trechosDoTexto } from './markdown';

describe('Markdown simples do assistente', () => {
  it('separa parágrafos, títulos e listas', () => {
    const blocos = blocosDoMarkdown(
      '## Como fazer\nAbra **Funis**.\n\n1. Clique em Novo\n2. Preencha\n\n- um\n- dois',
    );
    expect(blocos.map((b) => b.tipo)).toEqual(['titulo', 'paragrafo', 'lista', 'lista']);
    const [, , numerada, marcada] = blocos;
    expect(numerada).toMatchObject({ ordenada: true });
    expect(marcada).toMatchObject({ ordenada: false });
    expect((numerada as unknown as { itens: unknown[] }).itens).toHaveLength(2);
  });

  it('reconhece negrito, itálico, código e links', () => {
    const trechos = trechosDoTexto('use **Novo**, *devagar* e `Esc` em [ajuda](/contatos)');
    expect(trechos.map((t) => t.tipo)).toEqual([
      'texto',
      'negrito',
      'texto',
      'italico',
      'texto',
      'codigo',
      'texto',
      'link',
    ]);
    expect(trechos.at(-1)).toMatchObject({ href: '/contatos', interno: true });
  });

  it('só aceita links http(s) e caminhos do CRM: o resto vira texto', () => {
    const [js] = trechosDoTexto('[clique](javascript:alert(1))');
    expect(js).toEqual({ tipo: 'texto', texto: 'clique' });
    const [fora] = trechosDoTexto('[site](https://exemplo.com)');
    expect(fora).toMatchObject({ tipo: 'link', interno: false });
    const [protocolo] = trechosDoTexto('[x](//mal.com)');
    expect(protocolo.tipo).toBe('texto');
  });

  it('mantém HTML como texto puro (nunca vira elemento)', () => {
    const [bloco] = blocosDoMarkdown('<img src=x onerror=alert(1)> oi');
    expect(bloco).toMatchObject({ tipo: 'paragrafo' });
    expect(JSON.stringify(bloco)).toContain('<img src=x');
  });

  it('blocos de código preservam as linhas', () => {
    expect(blocosDoMarkdown('```\na\n b\n```')).toEqual([{ tipo: 'codigo', texto: 'a\n b' }]);
  });
});
