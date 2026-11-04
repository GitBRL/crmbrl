import { EVENTOS_HOTMART } from './dados-de-teste';
import {
  aplicarModelo,
  listaDoTexto,
  modeloDaTabela,
  perdidosSemMotivo,
  regraParaApi,
  tabelaInicial,
  tabelaParaApi,
} from './eventos.tipos';

describe('tabela de eventos (tipos e regras)', () => {
  it('começa pelo modelo Vendas e respeita o que a integração já guardou', () => {
    const inicial = tabelaInicial(EVENTOS_HOTMART, null);
    expect(inicial['PURCHASE_APPROVED'].acao).toBe('GANHO');
    expect(inicial['PURCHASE_BILLET_PRINTED'].acao).toBe('ABRIR');

    const salva = tabelaInicial(EVENTOS_HOTMART, {
      PURCHASE_BILLET_PRINTED: { acao: 'IGNORAR' },
      OUTRO_EVENTO: { acao: 'ETIQUETAR', etiquetas: ['x'] },
    });
    expect(salva['PURCHASE_BILLET_PRINTED'].acao).toBe('IGNORAR');
    expect(salva['OUTRO_EVENTO'].acao).toBe('ETIQUETAR');
    expect(salva['PURCHASE_APPROVED'].acao).toBe('GANHO');
  });

  it('só manda à API o que cada ação aceita', () => {
    expect(
      regraParaApi({ acao: 'IGNORAR', etapaId: 'e1', motivoPerda: 'x', etiquetas: ['a'] }),
    ).toEqual({ acao: 'IGNORAR', etapaId: null, motivoPerda: null, etiquetas: [] });
    expect(
      regraParaApi({ acao: 'ABRIR', etapaId: 'e1', motivoPerda: 'x', etiquetas: ['a'] }),
    ).toEqual({ acao: 'ABRIR', etapaId: 'e1', motivoPerda: null, etiquetas: ['a'] });
    expect(regraParaApi({ acao: 'PERDIDO', motivoPerda: '  Reembolso ' })).toEqual({
      acao: 'PERDIDO',
      etapaId: null,
      motivoPerda: 'Reembolso',
      etiquetas: [],
    });
    expect(tabelaParaApi({ A: { acao: 'GANHO' } })['A']).toEqual({
      acao: 'GANHO',
      etapaId: null,
      motivoPerda: null,
      etiquetas: [],
    });
  });

  it('reconhece o modelo da tabela (sem olhar a etapa) e vira personalizada ao mudar', () => {
    const vendas = tabelaInicial(EVENTOS_HOTMART, null);
    expect(modeloDaTabela(EVENTOS_HOTMART, vendas)).toBe('VENDAS');
    const comEtapa = {
      ...vendas,
      PURCHASE_BILLET_PRINTED: { acao: 'ABRIR', etapaId: 'c-novo' },
    } as const;
    expect(modeloDaTabela(EVENTOS_HOTMART, comEtapa)).toBe('VENDAS');
    const mudada = { ...vendas, PURCHASE_APPROVED: { acao: 'IGNORAR' } } as const;
    expect(modeloDaTabela(EVENTOS_HOTMART, mudada)).toBeNull();
    expect(modeloDaTabela(EVENTOS_HOTMART, { ...vendas, X: { acao: 'IGNORAR' } })).toBeNull();
  });

  it('aplicar um modelo troca a tabela e mantém os códigos acrescentados', () => {
    const atual = {
      ...tabelaInicial(EVENTOS_HOTMART, null),
      EXTRA: { acao: 'ETIQUETAR' },
    } as const;
    const modelo = EVENTOS_HOTMART.modelos.find((m) => m.codigo === 'SO_COMPRAS')!;
    const nova = aplicarModelo(EVENTOS_HOTMART, modelo, atual);
    expect(nova['PURCHASE_APPROVED'].acao).toBe('GANHO');
    expect(nova['PURCHASE_BILLET_PRINTED'].acao).toBe('IGNORAR');
    expect(nova['EXTRA'].acao).toBe('ETIQUETAR');
  });

  it('acha os eventos de perda sem motivo próprio', () => {
    expect(
      perdidosSemMotivo({
        A: { acao: 'PERDIDO', motivoPerda: ' ' },
        B: { acao: 'PERDIDO', motivoPerda: 'Reembolso' },
        C: { acao: 'GANHO' },
      }),
    ).toEqual(['A']);
  });

  it('separa listas por vírgula sem repetir nem deixar vazios', () => {
    expect(listaDoTexto(' Curso A, curso a ,, Curso B ')).toEqual(['Curso A', 'Curso B']);
    expect(listaDoTexto('')).toEqual([]);
  });
});
