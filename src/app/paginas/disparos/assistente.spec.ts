import { describe, expect, it } from 'vitest';

import { agendaPadrao } from '../../ui/seletor-agenda/agenda';
import { JANELA_COMERCIAL } from '../../ui/seletor-janela-envio/janela-envio';
import {
  agendaParaIso,
  erroDoPasso,
  type EstadoAssistente,
  isoParaAgenda,
  montarDados,
  presetDoRitmo,
} from './assistente';

function estado(ajustes: Partial<EstadoAssistente> = {}): EstadoAssistente {
  return {
    nome: 'Campanha de teste',
    canal: 'WHATSAPP',
    area: null,
    tipoPublico: 'SEGMENTO',
    segmento: { combinacao: 'todos', condicoes: [] },
    importacaoId: null,
    elegiveis: 10,
    assunto: '',
    texto: 'Oi, {{contato.primeiro_nome}}!',
    modeloId: null,
    arquivoId: null,
    canalIds: ['canal-1'],
    intervaloMinimo: 20,
    intervaloMaximo: 60,
    usarLote: false,
    loteTamanho: 50,
    lotePausa: 300,
    simularDigitando: true,
    pausarAposFalhas: 5,
    janelaAtiva: true,
    janela: JANELA_COMERCIAL,
    agenda: agendaPadrao('agora'),
    ...ajustes,
  };
}

describe('erroDoPasso', () => {
  it('passo 1 pede nome, importação e público não vazio', () => {
    expect(erroDoPasso(1, estado())).toBeNull();
    expect(erroDoPasso(1, estado({ nome: '  ' }))).toMatch(/nome/i);
    expect(erroDoPasso(1, estado({ tipoPublico: 'IMPORTACAO' }))).toMatch(/importação/i);
    expect(erroDoPasso(1, estado({ elegiveis: 0 }))).toMatch(/Nenhum contato/);
    expect(erroDoPasso(1, estado({ elegiveis: null }))).toBeNull();
  });

  it('passo 2 pede texto, assunto no e-mail e variáveis conhecidas', () => {
    expect(erroDoPasso(2, estado())).toBeNull();
    expect(erroDoPasso(2, estado({ texto: '' }))).toMatch(/mensagem/i);
    expect(erroDoPasso(2, estado({ canal: 'EMAIL' }))).toMatch(/assunto/i);
    expect(erroDoPasso(2, estado({ canal: 'EMAIL', assunto: 'Oi' }))).toBeNull();
    expect(erroDoPasso(2, estado({ texto: 'Oi {{xyz}}' }))).toMatch(/não existe/);
  });

  it('passo 3 confere números, tempos, lote e falhas', () => {
    expect(erroDoPasso(3, estado())).toBeNull();
    expect(erroDoPasso(3, estado({ canalIds: [] }))).toMatch(/número/);
    expect(erroDoPasso(3, estado({ canal: 'EMAIL', canalIds: [] }))).toMatch(/e-mail/);
    expect(erroDoPasso(3, estado({ intervaloMinimo: 0 }))).toMatch(/mínimo/);
    expect(erroDoPasso(3, estado({ intervaloMinimo: 30, intervaloMaximo: 10 }))).toMatch(/máximo/);
    expect(erroDoPasso(3, estado({ usarLote: true, loteTamanho: 0 }))).toMatch(/lote/);
    expect(erroDoPasso(3, estado({ pausarAposFalhas: 0 }))).toMatch(/falhas/);
  });

  it('passo 4 confere janela e agenda', () => {
    expect(erroDoPasso(4, estado())).toBeNull();
    expect(erroDoPasso(4, estado({ janela: { ...JANELA_COMERCIAL, dias: [] } }))).toMatch(/dia/);
    expect(
      erroDoPasso(4, estado({ janelaAtiva: false, janela: { ...JANELA_COMERCIAL, dias: [] } })),
    ).toBeNull();
    expect(erroDoPasso(4, estado({ agenda: { ...agendaPadrao('data'), dataHora: null } }))).toMatch(
      /dia e a hora/,
    );
  });
});

describe('montarDados', () => {
  it('cria com tudo: público, mensagem, ritmo e janela', () => {
    const dados = montarDados(estado({ area: 'COMERCIAL' }), false);
    expect(dados).toMatchObject({
      nome: 'Campanha de teste',
      canal: 'WHATSAPP',
      area: 'COMERCIAL',
      tipoPublico: 'SEGMENTO',
      segmento: { combinacao: 'todas', condicoes: [] },
      importacaoId: null,
      assunto: null,
      texto: 'Oi, {{contato.primeiro_nome}}!',
      canalIds: ['canal-1'],
      intervaloMinimoSegundos: 20,
      intervaloMaximoSegundos: 60,
      loteTamanho: null,
      lotePausaSegundos: null,
      simularDigitando: true,
      pausarAposFalhas: 5,
    });
    expect(dados.janelaEnvio?.dias['1']).toEqual([{ inicio: '08:00', fim: '18:00' }]);
  });

  it('rascunho já criado não manda canal nem área; sem números não manda a lista', () => {
    const dados = montarDados(estado({ canalIds: [], area: 'CS' }), false, true);
    expect('canal' in dados).toBe(false);
    expect('area' in dados).toBe(false);
    expect('canalIds' in dados).toBe(false);
  });

  it('no e-mail leva o assunto e nunca o "digitando"', () => {
    const dados = montarDados(estado({ canal: 'EMAIL', assunto: ' Olá ' }), false);
    expect(dados.assunto).toBe('Olá');
    expect(dados.simularDigitando).toBe(false);
  });

  it('campanha em andamento só manda o que a API aceita', () => {
    const dados = montarDados(estado({ janelaAtiva: false, usarLote: true }), true);
    expect(Object.keys(dados).sort()).toEqual(
      [
        'canalIds',
        'intervaloMaximoSegundos',
        'intervaloMinimoSegundos',
        'janelaEnvio',
        'loteTamanho',
        'lotePausaSegundos',
        'nome',
        'pausarAposFalhas',
        'simularDigitando',
      ].sort(),
    );
    expect(dados.janelaEnvio).toBeNull();
    expect(dados.loteTamanho).toBe(50);
  });
});

describe('ritmo e agenda', () => {
  it('reconhece os ritmos prontos', () => {
    expect(presetDoRitmo(20, 60)).toBe('padrao');
    expect(presetDoRitmo(40, 120)).toBe('seguro');
    expect(presetDoRitmo(8, 20)).toBe('rapido');
    expect(presetDoRitmo(1, 2)).toBe('personalizado');
  });

  it('converte data e hora de Brasília para ISO e de volta', () => {
    expect(agendaParaIso('2026-11-05T10:30')).toBe('2026-11-05T10:30:00-03:00');
    expect(isoParaAgenda('2026-11-05T13:30:00.000Z')).toBe('2026-11-05T10:30');
    expect(agendaParaIso(null)).toBeNull();
    expect(isoParaAgenda(null)).toBeNull();
  });
});
