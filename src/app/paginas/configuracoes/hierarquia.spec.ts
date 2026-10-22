import type { PreviaDesligamento } from './configuracoes.modelos';
import { equipesDeTeste, HELENA, LUCAS, PEDRO, RODRIGO, resumo, usuario } from './dados-de-teste';
import {
  aguardaNovoLider,
  explicacaoDoLider,
  fraseDoEncaminhamento,
  itensEncaminhados,
  liderEsperado,
  montarArvore,
  primeiroNome,
  resumirArvore,
  semLiderDisponivel,
  situacaoDoUsuario,
} from './hierarquia';

const ZERO = {
  atividades: 0,
  negocios: 0,
  contatos: 0,
  empresas: 0,
  liderados: 0,
  responsavelFixo: 0,
};

function previa(ajustes: Partial<PreviaDesligamento> = {}): PreviaDesligamento {
  return {
    usuario: resumo('u-pedro', 'Pedro Santos', 'COMERCIAL'),
    destinatario: resumo('u-carla', 'Carla Nogueira', 'LIDER_COMERCIAL'),
    motivoDestinatario: 'LIDER',
    explicacao: 'O que está com Pedro Santos (Comercial) vai para o líder, Carla Nogueira.',
    exigeEscolha: false,
    candidatos: [],
    ignorados: [],
    contagens: { ...ZERO, atividades: 12, negocios: 3, contatos: 5 },
    liderados: [],
    alertaEquipeSemLider: false,
    ...ajustes,
  };
}

describe('hierarquia (R1.2, R7)', () => {
  it('líder esperado: membro → líder da área; líder → C-level; Admin e C-level → nenhum', () => {
    expect(liderEsperado('COMERCIAL')).toBe('LIDER_COMERCIAL');
    expect(liderEsperado('CS')).toBe('LIDER_CS');
    expect(liderEsperado('LIDER_MARKETING')).toBe('C_LEVEL');
    expect(liderEsperado('ADMIN')).toBeNull();
    expect(liderEsperado('C_LEVEL')).toBeNull();
  });

  it('explica por que o seletor de líder só oferece certas pessoas', () => {
    expect(explicacaoDoLider('COMERCIAL')).toBe(
      'Quem é Comercial responde a um Líder Comercial ativo, da mesma área. Por isso só aparecem Líderes Comerciais.',
    );
    expect(explicacaoDoLider('LIDER_CS')).toContain('responde a um C-level ativo');
    expect(explicacaoDoLider('ADMIN')).toBe('Quem é Admin não tem líder.');
    expect(explicacaoDoLider(null)).toContain('Escolha o papel primeiro');
    expect(semLiderDisponivel('MARKETING')).toBe(
      'Não há nenhum Líder Marketing ativo para liderar quem é Marketing. Convide ou reative um Líder Marketing antes.',
    );
  });

  it('marca quem responde provisoriamente a quem não é o líder do papel (R7.3)', () => {
    expect(aguardaNovoLider(LUCAS)).toBe(false);
    // Depois do desligamento do líder, Lucas passou a responder à C-level.
    expect(aguardaNovoLider({ ...LUCAS, lider: resumo('u-helena', 'Helena', 'C_LEVEL') })).toBe(
      true,
    );
    expect(aguardaNovoLider({ ...LUCAS, lider: null })).toBe(true);
    expect(aguardaNovoLider(HELENA)).toBe(false);
    // Desligado não conta.
    expect(aguardaNovoLider({ ...PEDRO, lider: null })).toBe(false);
  });

  it('frase da prévia do desligamento, como na TELAS §6', () => {
    expect(fraseDoEncaminhamento(previa())).toBe(
      'As 12 atividades pendentes, 3 negócios abertos e 5 contatos de Pedro vão para Carla Nogueira (Líder Comercial).',
    );
    expect(fraseDoEncaminhamento(previa({ contagens: { ...ZERO, contatos: 1 } }))).toBe(
      '1 contato de Pedro vai para Carla Nogueira (Líder Comercial).',
    );
    expect(
      fraseDoEncaminhamento(previa({ contagens: { ...ZERO, negocios: 2, empresas: 1 } })),
    ).toBe('Os 2 negócios abertos e 1 empresa de Pedro vão para Carla Nogueira (Líder Comercial).');
    // O primeiro item é um só: sem o artigo plural ("As 1 atividade" não concorda).
    expect(
      fraseDoEncaminhamento(
        previa({ contagens: { ...ZERO, atividades: 1, negocios: 1, contatos: 1 } }),
      ),
    ).toBe(
      '1 atividade pendente, 1 negócio aberto e 1 contato de Pedro vão para Carla Nogueira (Líder Comercial).',
    );
    expect(fraseDoEncaminhamento(previa({ contagens: ZERO }))).toBe(
      'Pedro não tem atividades pendentes, negócios abertos, contatos nem empresas para encaminhar.',
    );
    expect(fraseDoEncaminhamento(previa({ destinatario: null, exigeEscolha: true }))).toContain(
      'vão para o C-level que você escolher.',
    );
  });

  it('itens encaminhados sem as contagens zeradas, no singular e no plural', () => {
    const itens = itensEncaminhados({ ...ZERO, atividades: 1, liderados: 2 });
    expect(itens.map((item) => `${item.quantidade} ${item.rotulo}`)).toEqual([
      '1 atividade pendente',
      '2 liderados',
    ]);
  });

  it('situação: desligado, convite pendente, troca pendente e ativo (texto, não só cor)', () => {
    expect(situacaoDoUsuario(PEDRO).rotulo).toBe('Desligado');
    expect(situacaoDoUsuario(RODRIGO).rotulo).toBe('Convite pendente');
    expect(situacaoDoUsuario({ ...LUCAS, deveTrocarSenha: true }).rotulo).toBe(
      'Troca de senha pendente',
    );
    expect(situacaoDoUsuario(LUCAS)).toEqual(
      expect.objectContaining({ rotulo: 'Ativo', variante: 'neutro' }),
    );
  });

  it('primeiro nome para a confirmação forte', () => {
    expect(primeiroNome('  Pedro   Santos ')).toBe('Pedro');
    expect(primeiroNome('Ana')).toBe('Ana');
  });

  it('monta a árvore: C-level → líderes → membros, cada equipe uma vez', () => {
    const arvore = montarArvore(equipesDeTeste());
    expect(arvore).toHaveLength(1);
    const [helena] = arvore;
    expect(helena.pessoa.nome).toBe('Helena Duarte');
    expect(helena.filhos.map((filho) => filho.pessoa.nome)).toEqual([
      'Rafael Mendes',
      'Camila Rocha',
    ]);
    expect(helena.filhos[0].filhos.map((filho) => filho.pessoa.nome)).toEqual([
      'Lucas Pereira',
      'Juliana Alves',
    ]);
    expect(helena.filhos[0].area).toBe('COMERCIAL');
    expect(helena.filhos[1].filhos[0].aguardandoNovoLider).toBe(true);
  });

  it('a equipe de um líder sozinha vira a raiz', () => {
    const [, comercial] = equipesDeTeste();
    const arvore = montarArvore([comercial]);
    expect(arvore.map((no) => no.pessoa.nome)).toEqual(['Rafael Mendes']);
    expect(arvore[0].filhos).toHaveLength(2);
  });

  it('resume a árvore somando cada pessoa uma vez', () => {
    const resumoDaEquipe = resumirArvore(montarArvore(equipesDeTeste()));
    expect(resumoDaEquipe).toEqual({
      pessoas: 6,
      atividadesPendentes: 1 + 7 + 1 + 3 + 2 + 2,
      atividadesAtrasadas: 3,
      negociosAbertos: 11,
      valorEmAberto: 117700 + 43200 + 36600,
      aguardandoNovoLider: 1,
    });
  });

  it('usuário de teste tem o nível certo', () => {
    expect(usuario('x', 'X', 'LIDER_CS').nivel).toBe('LIDER');
  });
});
