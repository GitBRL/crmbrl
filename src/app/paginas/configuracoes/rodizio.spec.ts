import type { RegraDistribuicao } from './configuracoes.modelos';
import { resumo } from './dados-de-teste';
import { destinoSemFila, operacaoDeParticipacao, pessoasDoRodizio } from './rodizio';

function regra(ajustes: Partial<RegraDistribuicao> = {}): RegraDistribuicao {
  return {
    id: 'r1',
    area: 'MARKETING',
    incluirLideres: false,
    ultimoUsuario: { id: 'u-mariana', nome: 'Mariana Costa' },
    proximo: { id: 'u-thiago', nome: 'Thiago Lima' },
    participantes: [
      { id: 'u-mariana', nome: 'Mariana Costa', papel: 'MARKETING', motivo: 'MEMBRO_DA_AREA' },
      { id: 'u-thiago', nome: 'Thiago Lima', papel: 'MARKETING', motivo: 'MEMBRO_DA_AREA' },
    ],
    ajustes: [],
    atualizadoEm: '2026-10-21T12:00:00.000Z',
    ...ajustes,
  };
}

const PESSOAS = [
  resumo('u-camila', 'Camila Rocha', 'LIDER_MARKETING'),
  resumo('u-mariana', 'Mariana Costa', 'MARKETING'),
  resumo('u-thiago', 'Thiago Lima', 'MARKETING'),
  resumo('u-bia', 'Beatriz Souza', 'MARKETING'),
  resumo('u-lucas', 'Lucas Pereira', 'COMERCIAL'),
];

describe('rodízio (R5.8)', () => {
  it('fila na ordem em que recebe, o próximo marcado, e depois quem está fora', () => {
    const pessoas = pessoasDoRodizio(
      regra({
        ajustes: [
          { id: 'u-bia', nome: 'Beatriz Souza', papel: 'MARKETING', ativo: true, participa: false },
          // Desligado de outra área: não aparece.
          {
            id: 'u-pedro',
            nome: 'Pedro Santos',
            papel: 'COMERCIAL',
            ativo: false,
            participa: false,
          },
        ],
      }),
      PESSOAS,
    );
    expect(pessoas.map((p) => [p.nome, p.posicao, p.participa])).toEqual([
      ['Mariana Costa', 1, true],
      ['Thiago Lima', 2, true],
      ['Beatriz Souza', null, false],
      ['Camila Rocha', null, false],
    ]);
    expect(pessoas[1].proximo).toBe(true);
    expect(pessoas[1].motivo).toBe('Recebe o próximo lead · Marketing · membro da área');
    expect(pessoas[2]).toEqual(
      expect.objectContaining({
        ajuste: 'tirado',
        padrao: true,
        motivo: 'Marketing · tirado(a) do rodízio à mão',
      }),
    );
    expect(pessoas[3]).toEqual(
      expect.objectContaining({
        ehLider: true,
        padrao: false,
        motivo: 'Líder Marketing · fica fora pela regra (o líder não entra)',
      }),
    );
  });

  it('líder incluído pela regra ou à mão', () => {
    const pela = pessoasDoRodizio(
      regra({
        incluirLideres: true,
        participantes: [
          {
            id: 'u-camila',
            nome: 'Camila Rocha',
            papel: 'LIDER_MARKETING',
            motivo: 'LIDER_INCLUIDO_PELA_REGRA',
          },
        ],
        proximo: { id: 'u-camila', nome: 'Camila Rocha' },
      }),
      [PESSOAS[0]],
    );
    expect(pela[0].motivo).toBe(
      'Recebe o próximo lead · Líder Marketing · entra pela regra da área',
    );

    const amao = pessoasDoRodizio(
      regra({
        participantes: [
          {
            id: 'u-camila',
            nome: 'Camila Rocha',
            papel: 'LIDER_MARKETING',
            motivo: 'INCLUIDO_MANUALMENTE',
          },
        ],
        ajustes: [
          {
            id: 'u-camila',
            nome: 'Camila Rocha',
            papel: 'LIDER_MARKETING',
            ativo: true,
            participa: true,
          },
        ],
        proximo: null,
      }),
      [PESSOAS[0]],
    );
    expect(amao[0]).toEqual(
      expect.objectContaining({
        participa: true,
        ajuste: 'incluido',
        motivo: 'Líder Marketing · incluído(a) à mão',
      }),
    );
  });

  it('voltar ao padrão apaga o ajuste; sair do padrão cria um', () => {
    expect(operacaoDeParticipacao({ padrao: true, ajuste: 'tirado' }, true)).toBe('remover-ajuste');
    expect(operacaoDeParticipacao({ padrao: true, ajuste: null }, false)).toBe('definir');
    expect(operacaoDeParticipacao({ padrao: false, ajuste: null }, true)).toBe('definir');
    expect(operacaoDeParticipacao({ padrao: false, ajuste: 'incluido' }, false)).toBe(
      'remover-ajuste',
    );
  });

  it('fila vazia: diz para quem os leads vão', () => {
    expect(
      destinoSemFila(
        regra({ participantes: [], proximo: { id: 'u-camila', nome: 'Camila Rocha' } }),
      ),
    ).toBe('Ninguém na fila: os leads vão para Camila Rocha até alguém entrar.');
  });

  it('quem nunca entrou no CRM (convite pendente) aparece assim na dica', () => {
    const pessoas = pessoasDoRodizio(regra(), [
      {
        ...resumo('u-mariana', 'Mariana Costa', 'MARKETING'),
        ultimoAcessoEm: '2026-10-21T12:00:00Z',
      },
      {
        ...resumo('u-thiago', 'Thiago Lima', 'MARKETING'),
        senhaDefinida: false,
        ultimoAcessoEm: null,
      },
    ]);
    expect(pessoas[0].acessoPendente).toBeNull();
    expect(pessoas[1].acessoPendente).toBe('convite');
    expect(pessoas[1].motivo).toBe(
      'Recebe o próximo lead · Convite pendente: ainda não entrou no CRM · Marketing · membro da área',
    );
  });
});
