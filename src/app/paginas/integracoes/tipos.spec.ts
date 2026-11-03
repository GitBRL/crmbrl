import { descricaoDoEvento, rotuloDoEvento } from './tipos';

describe('eventos de webhook de saída', () => {
  it('ligacao.encerrada tem rótulo e uma descrição que diz o que vai (e o que nunca vai)', () => {
    expect(rotuloDoEvento('ligacao.encerrada')).toBe('Ligação encerrada');
    const descricao = descricaoDoEvento('ligacao.encerrada', 'Ligação encerrada.');
    expect(descricao).toContain('duração');
    expect(descricao).toContain('Nunca leva áudio nem transcrição');
  });

  it('eventos do SDR com IA têm rótulo e descrição do que chega', () => {
    expect(rotuloDoEvento('sdr.lead_qualificado')).toBe('Lead qualificado pela IA');
    expect(rotuloDoEvento('sdr.lead_desqualificado')).toBe('Lead desqualificado pela IA');
    expect(descricaoDoEvento('sdr.lead_qualificado', 'Lead qualificado pela IA.')).toContain(
      'temperatura',
    );
    expect(descricaoDoEvento('sdr.lead_desqualificado', 'Lead desqualificado pela IA')).toContain(
      'motivo',
    );
  });
});
