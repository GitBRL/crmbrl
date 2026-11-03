import type { TrechoDaTranscricao } from '../../../nucleo/ligacoes/gravacao.tipos';
import {
  destacarBusca,
  emProcessamento,
  marcaFalada,
  trechoAtual,
  trechosEncontrados,
} from './painel-ligacao.logica';

const trechos: TrechoDaTranscricao[] = [
  { falante: 'atendente', inicio: 0, fim: 4, texto: 'Bom dia, tudo bem?' },
  {
    falante: 'cliente',
    inicio: 4.5,
    fim: 9,
    texto: 'Tudo ótimo, quero a proposta.',
  },
  { falante: 'atendente', inicio: 65, fim: 70, texto: 'Envio hoje por e-mail.' },
];

describe('painel da ligação: lógica', () => {
  it('destacarBusca marca as ocorrências sem diferenciar maiúsculas e acentos', () => {
    expect(destacarBusca('Tudo ÓTIMO, quero', 'otimo')).toEqual([
      { texto: 'Tudo ', achado: false },
      { texto: 'ÓTIMO', achado: true },
      { texto: ', quero', achado: false },
    ]);
    expect(destacarBusca('abc', '')).toEqual([{ texto: 'abc', achado: false }]);
    expect(destacarBusca('a b a', 'a').filter((p) => p.achado)).toHaveLength(2);
    expect(destacarBusca('abc', 'x')).toEqual([{ texto: 'abc', achado: false }]);
  });

  it('trechosEncontrados filtra pelos índices que contêm a busca', () => {
    expect(trechosEncontrados(trechos, '')).toEqual([0, 1, 2]);
    expect(trechosEncontrados(trechos, 'PROPOSTA')).toEqual([1]);
    expect(trechosEncontrados(trechos, 'nada')).toEqual([]);
  });

  it('trechoAtual devolve o último trecho que já começou', () => {
    expect(trechoAtual(trechos, 0)).toBe(0);
    expect(trechoAtual(trechos, 5)).toBe(1);
    expect(trechoAtual(trechos, 100)).toBe(2);
    expect(trechoAtual([], 3)).toBe(-1);
  });

  it('marcaFalada e emProcessamento', () => {
    expect(marcaFalada(65.4)).toBe('1 min 5 s');
    expect(marcaFalada(7)).toBe('7 s');
    expect(emProcessamento('processando')).toBe(true);
    expect(emProcessamento('pronta')).toBe(false);
    expect(emProcessamento(undefined)).toBe(false);
  });
});
