import {
  descricaoDaTemperatura,
  eventosDoSdr,
  iaAtendendo,
  percentual,
  repetidaPelaDecisao,
  rotuloDaOrigem,
  textoDoEvento,
  textoDoSeloIa,
} from './sdr.apresentacao';
import { decisaoDeTeste } from './sdr-de-teste';

describe('apresentação do SDR com IA', () => {
  it('o selo diz "IA atendendo" no automático e "IA sugerindo" na sugestão', () => {
    expect(textoDoSeloIa({ modo: 'AUTOMATICO' })).toBe('IA atendendo');
    expect(textoDoSeloIa({ modo: 'SUGESTAO' })).toBe('IA sugerindo');
  });

  it('só a situação ATIVA conta como "IA atendendo"', () => {
    const base = { modo: 'AUTOMATICO', nota: null, temperatura: null } as const;
    expect(iaAtendendo({ ...base, situacao: 'ATIVA' })).toBe(true);
    expect(iaAtendendo({ ...base, situacao: 'HUMANO' })).toBe(false);
    expect(iaAtendendo(null)).toBe(false);
  });

  it('a temperatura vira texto para o leitor de tela, com a nota quando existe', () => {
    expect(descricaoDaTemperatura('QUENTE', 100)).toBe('Lead quente, nota 100 de 100');
    expect(descricaoDaTemperatura('FRIO', null)).toBe('Lead frio');
  });

  it('confiança e origem', () => {
    expect(percentual(0.9)).toBe('90%');
    expect(percentual(null)).toBeNull();
    expect(rotuloDaOrigem('IA')).toBe('IA');
    expect(rotuloDaOrigem('PESSOA')).toBe('Pessoa');
    expect(rotuloDaOrigem(null)).toBeNull();
  });

  describe('decisões como eventos', () => {
    it('critério descoberto vira aviso com a nota; turno sem critério não aparece', () => {
      const com = decisaoDeTeste({
        tipo: 'TURNO',
        acao: 'CONTINUAR',
        titulo: 'Respondeu · descobriu: Curso de interesse, Cidade · nota 40',
        nota: 40,
      });
      const sem = decisaoDeTeste({
        tipo: 'TURNO',
        acao: 'CONTINUAR',
        titulo: 'Respondeu · nota 0',
      });
      expect(textoDoEvento(com)).toBe('A IA descobriu: Curso de interesse, Cidade (nota 40).');
      expect(textoDoEvento(sem)).toBeNull();
    });

    it('o turno que qualifica ou passa para a equipe fica com a decisão seguinte', () => {
      expect(
        textoDoEvento(
          decisaoDeTeste({ tipo: 'TURNO', acao: 'QUALIFICADO', titulo: 'descobriu: Curso' }),
        ),
      ).toBeNull();
    });

    it('passou para humano traz o motivo e o resumo (encurtado)', () => {
      const texto = textoDoEvento(
        decisaoDeTeste({
          tipo: 'PASSOU_HUMANO',
          titulo: 'Passou para a equipe: o lead pediu uma pessoa',
          resumo: 'x'.repeat(400),
        }),
      );
      expect(texto).toContain('Passou para a equipe: o lead pediu uma pessoa.');
      expect(texto).toContain('Resumo: xxx');
      expect(texto!.length).toBeLessThan(330);
      expect(texto).toMatch(/…$/);
    });

    it('qualificado e desqualificado', () => {
      expect(
        textoDoEvento(
          decisaoDeTeste({
            tipo: 'QUALIFICADO',
            titulo: 'Qualificou o lead (nota 100) e passou para Juliana Alves no Comercial',
          }),
        ),
      ).toBe('IA: Qualificou o lead (nota 100) e passou para Juliana Alves no Comercial.');
      expect(
        textoDoEvento(
          decisaoDeTeste({
            tipo: 'DESQUALIFICADO',
            titulo: 'Desqualificou o lead',
            motivo: 'Quer Medicina',
          }),
        ),
      ).toBe('IA: Desqualificou o lead. Motivo: Quer Medicina');
    });

    it('"assumiu a conversa" de uma pessoa não repete o aviso do sistema', () => {
      expect(textoDoEvento(decisaoDeTeste({ tipo: 'HUMANO_ASSUMIU' }))).toBeNull();
    });

    it('eventosDoSdr devolve avisos SISTEMA com id próprio e a hora da decisão', () => {
      const eventos = eventosDoSdr([
        decisaoDeTeste({ id: 'a', tipo: 'ASSUMIU' }),
        decisaoDeTeste({ id: 'b', tipo: 'HUMANO_ASSUMIU' }),
        decisaoDeTeste({ id: 'c', tipo: 'DEVOLVIDA', titulo: 'Ana devolveu a conversa para a IA' }),
      ]);
      expect(eventos.map((e) => e.id)).toEqual(['sdr-a', 'sdr-c']);
      expect(eventos.every((e) => e.direcao === 'SISTEMA')).toBe(true);
    });
  });

  it('só os avisos de sistema escritos pela IA são repetidos pelas decisões', () => {
    expect(repetidaPelaDecisao({ direcao: 'SISTEMA', autorTipo: 'IA' })).toBe(true);
    expect(repetidaPelaDecisao({ direcao: 'SISTEMA', autorTipo: 'USUARIO' })).toBe(false);
    expect(repetidaPelaDecisao({ direcao: 'SAIDA', autorTipo: 'IA' })).toBe(false);
  });
});
