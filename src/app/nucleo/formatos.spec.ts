import {
  abreviarNumero,
  deCampoData,
  deCampoDataHora,
  formatarData,
  formatarDataHora,
  formatarEspera,
  formatarHora,
  formatarMoeda,
  formatarMoedaAbreviada,
  formatarNumero,
  formatarTempoRelativo,
  paraCampoData,
  paraCampoDataHora,
  paraDecimal,
  paraNumero,
  rotuloDias,
  semCodigoDeRegra,
  tempoNaEtapa,
} from './formatos';

/** O Intl usa espaço inseparável entre "R$" e o número. */
const semNbsp = (texto: string) => texto.replace(/ /g, ' ');

describe('formatos', () => {
  it('abrevia números e moeda em pt-BR', () => {
    expect(abreviarNumero(48200, 'pt-BR')).toEqual({ numero: '48,2', sufixo: 'mil' });
    expect(abreviarNumero(950, 'pt-BR')).toEqual({ numero: '950', sufixo: '' });
    expect(formatarMoedaAbreviada(186000, 'pt-BR')).toBe('R$ 186 mil');
    expect(formatarMoedaAbreviada(1250000, 'pt-BR')).toBe('R$ 1,3 mi');
    expect(formatarMoedaAbreviada(980, 'pt-BR')).toBe('R$ 980');
  });

  it('valores decimais da API viram R$ (e voltam para a API)', () => {
    expect(paraNumero('1500.00')).toBe(1500);
    expect(paraNumero(' ')).toBeNull();
    expect(paraNumero('abc')).toBeNull();
    expect(semNbsp(formatarMoeda('1500.00'))).toBe('R$ 1.500,00');
    expect(semNbsp(formatarMoeda(1500.5, { centavos: false }))).toBe('R$ 1.501');
    expect(formatarMoeda(null)).toBe('—');
    expect(formatarMoeda(undefined, { vazio: 'Sem valor' })).toBe('Sem valor');
    expect(paraDecimal(1500)).toBe('1500.00');
    expect(paraDecimal('')).toBeNull();
    expect(formatarNumero(1600)).toBe('1.600');
  });

  it('datas no fuso do navegador; data sem hora vale o dia local', () => {
    const local = new Date(2026, 9, 21, 18, 5);
    expect(formatarData(local)).toBe('21/10/2026');
    expect(formatarData(local, 'longa')).toBe('21 de outubro de 2026');
    expect(formatarHora(local)).toBe('18:05');
    expect(formatarDataHora(local.toISOString())).toBe('21/10/2026 às 18:05');
    // "2026-10-21" não pode virar 20/10 em fusos a oeste de Greenwich.
    expect(formatarData('2026-10-21')).toBe('21/10/2026');
    expect(formatarData(null)).toBe('—');
    expect(formatarData('não é data')).toBe('—');
  });

  it('converte para os campos de data nativos e de volta', () => {
    const local = new Date(2026, 9, 21, 9, 7);
    expect(paraCampoData(local.toISOString())).toBe('2026-10-21');
    expect(paraCampoDataHora(local.toISOString())).toBe('2026-10-21T09:07');
    expect(deCampoDataHora('2026-10-21T09:07')).toBe(local.toISOString());
    expect(deCampoDataHora('')).toBeNull();
    expect(deCampoData('2026-10-21')).toBe('2026-10-21');
    expect(deCampoData('21/10/2026')).toBeNull();
    expect(paraCampoData(null)).toBe('');
  });

  it('escreve tempos relativos curtos, no passado e no futuro', () => {
    const agora = new Date(2026, 9, 20, 15, 0, 0);
    const antes = (segundos: number) => new Date(agora.getTime() - segundos * 1000);
    expect(formatarTempoRelativo(antes(10), agora)).toBe('agora');
    expect(formatarTempoRelativo(antes(5 * 60), agora)).toBe('há 5 min');
    expect(formatarTempoRelativo(antes(2 * 3600), agora)).toBe('há 2 h');
    expect(formatarTempoRelativo(antes(26 * 3600), agora)).toBe('ontem');
    expect(formatarTempoRelativo(antes(3 * 86400), agora)).toBe('há 3 dias');
    expect(formatarTempoRelativo(new Date(2026, 8, 2), agora)).toBe('02/09/2026');
    expect(formatarTempoRelativo(antes(-10 * 60), agora)).toBe('em 10 min');
    expect(formatarTempoRelativo(antes(-25 * 3600), agora)).toBe('amanhã');
    expect(formatarTempoRelativo(antes(-3 * 86400).toISOString(), agora)).toBe('em 3 dias');
    expect(formatarTempoRelativo(null, agora)).toBe('—');
  });

  it('escreve esperas legíveis', () => {
    expect(formatarEspera(1)).toBe('1 segundo');
    expect(formatarEspera(30)).toBe('30 segundos');
    expect(formatarEspera(60)).toBe('1 minuto');
    expect(formatarEspera(900)).toBe('15 minutos');
    expect(formatarEspera(7200)).toBe('2 horas');
  });

  it('tempo na etapa: dias inteiros, "ontem" ou "hoje"', () => {
    const agora = new Date(2026, 9, 22, 10, 0);
    expect(rotuloDias(12)).toBe('12 d');
    expect(rotuloDias(0, new Date(2026, 9, 21, 18, 0).toISOString(), agora)).toBe('ontem');
    expect(tempoNaEtapa(12)).toBe('Na etapa há 12 d');
    expect(tempoNaEtapa(0, new Date(2026, 9, 21, 18, 0).toISOString(), agora)).toBe(
      'Na etapa desde ontem',
    );
    expect(tempoNaEtapa(0, new Date(2026, 9, 22, 8, 0).toISOString(), agora)).toBe(
      'Na etapa desde hoje',
    );
  });

  it('tira os códigos internos das regras dos textos da API', () => {
    expect(semCodigoDeRegra('Usuário desligado, com quem recebeu os itens (R7.4).')).toBe(
      'Usuário desligado, com quem recebeu os itens.',
    );
    expect(semCodigoDeRegra('Sem ninguém na fila, vai para um C-level (regra R5.8).')).toBe(
      'Sem ninguém na fila, vai para um C-level.',
    );
    expect(semCodigoDeRegra('Encaminhado (R7.3, R7.4) ao líder.')).toBe('Encaminhado ao líder.');
    expect(semCodigoDeRegra('Rodízio da área (Marketing).')).toBe('Rodízio da área (Marketing).');
  });
});
