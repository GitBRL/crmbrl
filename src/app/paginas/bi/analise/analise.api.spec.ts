import { describe, expect, it } from 'vitest';

import { FILTROS_PADRAO } from '../bi.tipos';
import {
  corpoDaAnalise,
  erroDaResposta,
  interpretarEvento,
  normalizarConteudo,
} from './analise.api';

describe('API da análise com IA', () => {
  it('normalizarConteudo aceita resumo, resposta e texto solto', () => {
    expect(normalizarConteudo({ resumo: 'R', destaques: [{ titulo: 'a' }, 3] }).texto).toBe('R');
    expect(normalizarConteudo({ resumo: 'R', destaques: [{ titulo: 'a' }, 3] }).destaques).toEqual([
      { titulo: 'a' },
    ]);
    expect(normalizarConteudo({ resposta: 'Porque sim' }).texto).toBe('Porque sim');
    expect(normalizarConteudo('só texto').texto).toBe('só texto');
    expect(normalizarConteudo(null)).toEqual({});
  });

  it('interpretarEvento tipa cada evento e descarta os desconhecidos', () => {
    expect(
      interpretarEvento({
        evento: 'concluido',
        dados: { tipo: 'analise', analiseId: 'a1', resultado: { resumo: 'ok' }, restantesHoje: 3 },
      }),
    ).toMatchObject({
      evento: 'concluido',
      analiseId: 'a1',
      restantesHoje: 3,
      conteudo: { texto: 'ok' },
    });
    expect(
      interpretarEvento({
        evento: 'concluido',
        dados: { tipo: 'pergunta', analiseId: 'a1', perguntaId: 'p1', resposta: { resposta: 'x' } },
      }),
    ).toMatchObject({ tipo: 'pergunta', perguntaId: 'p1', conteudo: { texto: 'x' } });
    expect(
      interpretarEvento({
        evento: 'erro',
        dados: { codigo: 'tempo_esgotado', mensagem: 'Demorou.' },
      }),
    ).toMatchObject({ evento: 'erro', codigo: 'tempo_esgotado', mensagem: 'Demorou.' });
    expect(
      interpretarEvento({ evento: 'nova_tentativa', dados: { tentativa: 2, motivo: 'x' } }),
    ).toMatchObject({ evento: 'nova_tentativa', tentativa: 2 });
    expect(interpretarEvento({ evento: 'parcial', dados: { resumo: 'par' } })).toEqual({
      evento: 'parcial',
      conteudo: { texto: 'par', destaques: undefined, riscos: undefined, acoes: undefined },
    });
    expect(interpretarEvento({ evento: 'outro', dados: {} })).toBeNull();
    expect(interpretarEvento({ evento: 'fase', dados: 'x' })).toBeNull();
  });

  it('corpoDaAnalise manda só os filtros do painel, sem os vazios', () => {
    const corpo = corpoDaAnalise('comercial', {
      ...FILTROS_PADRAO,
      de: '2026-10-01',
      ate: '2026-10-30',
      funilId: 'f1',
      canalId: 'c1', // o Comercial não tem canal
    });
    expect(corpo['painel']).toBe('comercial');
    expect(corpo['funilId']).toBe('f1');
    expect(corpo['canalId']).toBeUndefined();
    expect(corpo['pessoaId']).toBeUndefined();
    expect(corpo['comparar']).toBe(true);
    expect(typeof corpo['de']).toBe('string');
  });

  it('erroDaResposta vira o ErroApi padrão, com Retry-After e detalhes', async () => {
    const resposta = new Response(
      JSON.stringify({
        statusCode: 429,
        erro: 'muitas_tentativas',
        mensagem: 'Limite diário atingido.',
        detalhes: { regra: 'R21', limiteDiario: 20, usadasHoje: 20 },
        requisicaoId: 'r1',
      }),
      { status: 429, headers: { 'Retry-After': '3600', 'Content-Type': 'application/json' } },
    );
    const erro = await erroDaResposta(resposta);
    expect(erro.status).toBe(429);
    expect(erro.regra).toBe('R21');
    expect(erro.tentarDeNovoEmSegundos).toBe(3600);
    expect(erro.mensagemDaApi).toBe('Limite diário atingido.');
  });
});
