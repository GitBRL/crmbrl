import { describe, expect, it } from 'vitest';

import {
  descricaoDaLigacao,
  destacarTermos,
  FILTROS_INICIAIS,
  filtrosLigados,
  paraParametros,
  resultadoDoEstado,
  termosDaBusca,
} from './historico.logica';

describe('historico.logica', () => {
  it('traduz o estado da API no resultado da tela', () => {
    expect(resultadoDoEstado('ENCERRADA')).toBe('atendida');
    expect(resultadoDoEstado('SEM_RESPOSTA')).toBe('sem_resposta');
    expect(resultadoDoEstado('TOCANDO')).toBe('em_andamento');
  });

  it('monta os parâmetros: últimos 30 dias por padrão e só o que foi preenchido', () => {
    const agora = new Date(2026, 10, 2, 15, 0);
    const params = paraParametros(FILTROS_INICIAIS, agora);
    expect(new Date(params.de!).getTime()).toBe(new Date(2026, 9, 4, 0, 0).getTime());
    expect(Object.keys(params)).toEqual(['de']);
  });

  it('período livre usa o dia inteiro de quem olha; situações vão separadas por vírgula', () => {
    const params = paraParametros(
      {
        ...FILTROS_INICIAIS,
        periodo: 'outro',
        de: '2026-10-01',
        ate: '2026-10-31',
        direcao: 'RECEBIDA',
        situacoes: ['PERDIDA', 'RECUSADA'],
        atendenteId: 'sem',
        busca: '  contrato  ',
      },
      new Date(),
    );
    expect(new Date(params.de!).getTime()).toBe(new Date(2026, 9, 1, 0, 0).getTime());
    expect(new Date(params.ate!).getHours()).toBe(23);
    expect(params).toMatchObject({
      direcao: 'RECEBIDA',
      situacao: 'PERDIDA,RECUSADA',
      atendenteId: 'sem',
      busca: 'contrato',
    });
    expect(paraParametros({ ...FILTROS_INICIAIS, periodo: 'todos' }).de).toBeUndefined();
  });

  it('conta os filtros ligados além do período padrão', () => {
    expect(filtrosLigados(FILTROS_INICIAIS)).toBe(0);
    expect(
      filtrosLigados({
        ...FILTROS_INICIAIS,
        periodo: '7',
        direcao: 'FEITA',
        situacoes: ['PERDIDA'],
      }),
    ).toBe(3);
  });

  it('tira os operadores da busca e destaca os termos sem HTML', () => {
    expect(termosDaBusca('"preço final" desconto -cancelar or boleto')).toEqual([
      'preço final',
      'desconto',
      'boleto',
    ]);
    const pedacos = destacarTermos('O desconto e o Boleto saem hoje', ['desconto', 'boleto']);
    expect(pedacos.filter((p) => p.achado).map((p) => p.texto)).toEqual(['desconto', 'Boleto']);
    expect(pedacos.map((p) => p.texto).join('')).toBe('O desconto e o Boleto saem hoje');
  });

  it('descreve a ligação para leitor de tela', () => {
    expect(
      descricaoDaLigacao({
        direcao: 'RECEBIDA',
        estado: 'ENCERRADA',
        duracaoSegundos: 125,
        contato: { nome: 'Maria' },
      }),
    ).toBe('Recebida, atendida, 2:05 de duração, Maria');
  });
});
