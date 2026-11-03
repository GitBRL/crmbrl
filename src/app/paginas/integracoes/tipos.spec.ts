import { descricaoDoEvento, rotuloDoEvento } from './tipos';

describe('eventos de webhook de saída', () => {
  it('ligacao.encerrada tem rótulo e uma descrição que diz o que vai (e o que nunca vai)', () => {
    expect(rotuloDoEvento('ligacao.encerrada')).toBe('Ligação encerrada');
    const descricao = descricaoDoEvento('ligacao.encerrada', 'Ligação encerrada.');
    expect(descricao).toContain('duração');
    expect(descricao).toContain('Nunca leva áudio nem transcrição');
  });
});
