import { intervaloDaPagina, parametros, totalDePaginas, urlApi } from './api';

describe('api (apoio)', () => {
  it('monta a URL da API codificando cada parte', () => {
    expect(urlApi('auth', 'eu')).toBe('/api/v1/auth/eu');
    expect(urlApi('negocios', 'a b/c', 'mover')).toBe('/api/v1/negocios/a%20b%2Fc/mover');
  });

  it('filtros viram query string sem os vazios; listas repetem o parâmetro', () => {
    const params = parametros({
      busca: '  maria ',
      vazio: '   ',
      nulo: null,
      indefinido: undefined,
      pagina: 2,
      ativo: false,
      tipo: ['LIGACAO', 'REUNIAO'],
      nenhum: [],
      de: new Date('2026-10-21T12:00:00.000Z'),
    });
    expect(params.toString()).toBe(
      'busca=maria&pagina=2&ativo=false&tipo=LIGACAO&tipo=REUNIAO&de=2026-10-21T12:00:00.000Z',
    );
  });

  it('calcula as páginas e o intervalo mostrado', () => {
    expect(totalDePaginas({ total: 0, porPagina: 20 })).toBe(1);
    expect(totalDePaginas({ total: 41, porPagina: 20 })).toBe(3);
    const pagina = { itens: Array(20).fill(0), total: 135, pagina: 2, porPagina: 20 };
    expect(intervaloDaPagina(pagina)).toBe('21–40 de 135');
    expect(intervaloDaPagina({ itens: [], total: 0, pagina: 1, porPagina: 20 })).toBe('0 de 0');
  });
});
