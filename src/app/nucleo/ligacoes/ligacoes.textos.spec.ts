import {
  duracaoPorExtenso,
  explicarLimites,
  formatarDuracao,
  formatarTelefone,
  resumoDoFim,
  visaoDaPermissao,
} from './ligacoes.textos';
import type { PermissaoDeLigacao } from './ligacoes.tipos';

function permissao(extra: Partial<PermissaoDeLigacao> = {}): PermissaoDeLigacao {
  return {
    contatoId: 'ct-1',
    canalId: 'canal-1',
    situacao: 'NENHUMA',
    tipo: null,
    validaAte: null,
    podeLigar: false,
    pedido: {
      pode: true,
      motivo: null,
      liberaEm: null,
      usoNas24h: 0,
      maximo24h: 1,
      usoNos7d: 0,
      maximo7d: 2,
    },
    ultimoPedidoEm: null,
    respondidaEm: null,
    semRespostaSeguidas: 0,
    janelaAberta: true,
    temTemplateDePermissao: true,
    consultadaEm: null,
    limiteDeLigacoes: null,
    ...extra,
  };
}

describe('ligacoes.textos', () => {
  it('formatarDuracao e duracaoPorExtenso', () => {
    expect(formatarDuracao(0)).toBe('0:00');
    expect(formatarDuracao(75)).toBe('1:15');
    expect(formatarDuracao(3725)).toBe('1:02:05');
    expect(formatarDuracao(null)).toBe('0:00');
    expect(duracaoPorExtenso(125)).toBe('2 minutos e 5 segundos');
    expect(duracaoPorExtenso(60)).toBe('1 minuto');
    expect(duracaoPorExtenso(1)).toBe('1 segundo');
  });

  it('formatarTelefone: celular, fixo, com o 55 e desconhecido', () => {
    expect(formatarTelefone('5511999990001')).toBe('(11) 99999-0001');
    expect(formatarTelefone('1133334444')).toBe('(11) 3333-4444');
    expect(formatarTelefone(null)).toBe('Número desconhecido');
  });

  it('resumoDoFim: uma frase por estado', () => {
    expect(resumoDoFim({ estado: 'ENCERRADA', motivoTexto: null, duracaoSegundos: 65 })).toContain(
      '1:05',
    );
    expect(resumoDoFim({ estado: 'RECUSADA', motivoTexto: null, duracaoSegundos: null })).toContain(
      'recusou',
    );
    expect(
      resumoDoFim({ estado: 'SEM_RESPOSTA', motivoTexto: null, duracaoSegundos: null }),
    ).toContain('não atendeu');
    expect(
      resumoDoFim({
        estado: 'FALHOU',
        motivoTexto: 'A Meta não respondeu.',
        duracaoSegundos: null,
      }),
    ).toBe('A Meta não respondeu.');
  });

  describe('visaoDaPermissao', () => {
    it('concedida por prazo: pode ligar e diz até quando', () => {
      const v = visaoDaPermissao(
        permissao({
          situacao: 'CONCEDIDA',
          tipo: 'TEMPORARIA',
          podeLigar: true,
          validaAte: '2026-11-09T15:00:00.000Z',
        }),
      );
      expect(v).toMatchObject({ tom: 'ok', podeLigar: true, podePedir: false });
      expect(v.texto).toContain('até 09/11/2026');
    });

    it('concedida sem prazo (permanente)', () => {
      const v = visaoDaPermissao(
        permissao({ situacao: 'CONCEDIDA', tipo: 'PERMANENTE', podeLigar: true }),
      );
      expect(v.texto).toContain('sem prazo');
    });

    it('nenhuma: oferece pedir, com os limites explicados e quantos pedidos restam', () => {
      const v = visaoDaPermissao(permissao());
      expect(v).toMatchObject({ tom: 'neutro', podePedir: true, motivoSemPedido: null });
      expect(v.limites).toContain('1 pedido de permissão por dia');
      expect(v.limites).toContain('restam 1 pedido hoje e 2 pedidos nesta semana');
    });

    it('pedida: aguardando o cliente, e o limite de 24 h diz quando poderá pedir de novo', () => {
      const v = visaoDaPermissao(
        permissao({
          situacao: 'PEDIDA',
          ultimoPedidoEm: '2026-11-02T12:00:00.000Z',
          pedido: {
            pode: false,
            motivo: 'limite_24h',
            liberaEm: '2026-11-03T12:00:00.000Z',
            usoNas24h: 1,
            maximo24h: 1,
            usoNos7d: 1,
            maximo7d: 2,
          },
        }),
      );
      expect(v).toMatchObject({ tom: 'aviso', titulo: 'Aguardando o cliente', podePedir: false });
      expect(v.motivoSemPedido).toContain('últimas 24 horas');
      expect(v.motivoSemPedido).toContain('Novo pedido a partir de');
      expect(v.limites).toContain('restam 0 pedidos hoje');
    });

    it('limite de 7 dias', () => {
      const v = visaoDaPermissao(
        permissao({
          pedido: {
            pode: false,
            motivo: 'limite_7d',
            liberaEm: '2026-11-08T12:00:00.000Z',
            usoNas24h: 0,
            maximo24h: 1,
            usoNos7d: 2,
            maximo7d: 2,
          },
        }),
      );
      expect(v.motivoSemPedido).toContain('2 pedidos nesta semana');
    });

    it('fora da janela e sem template de permissão: explica o que fazer', () => {
      const v = visaoDaPermissao(permissao({ janelaAberta: false, temTemplateDePermissao: false }));
      expect(v.podePedir).toBe(false);
      expect(v.motivoSemPedido).toContain('template de permissão');
    });

    it('negada, revogada e expirada têm tom e texto próprios', () => {
      expect(visaoDaPermissao(permissao({ situacao: 'NEGADA' })).tom).toBe('erro');
      expect(visaoDaPermissao(permissao({ situacao: 'REVOGADA' })).texto).toContain(
        '4 ligações seguidas',
      );
      expect(visaoDaPermissao(permissao({ situacao: 'EXPIRADA' })).titulo).toBe(
        'Permissão vencida',
      );
    });

    it('explicarLimites usa os máximos que a API devolve', () => {
      expect(explicarLimites(permissao())).toContain('2 por semana');
    });
  });
});
