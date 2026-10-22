import { perfilDeTeste } from '../../nucleo/sessao/sessao-de-teste';
import { colunasDeTeste, ETAPAS, etapaDeTeste, negocioDeTeste } from './funis-de-teste';
import type { ResultadoMovimentacao } from './funis.tipos';
import {
  incluirNegocio,
  mensagemDaMovimentacao,
  moverCartao,
  nomeDoDestino,
  opcoesDeVisao,
  ordenarEtapas,
  podeConfigurarFunil,
  podeReabrir,
  podeSerResponsavel,
  removerNegocio,
  rotuloDias,
  somarValores,
  substituirNegocio,
  textoPrazo,
  vizinhos,
} from './regras-funis';

const [NOVO, PROPOSTA, GANHO, PERDIDO] = ETAPAS;

function quadro() {
  return colunasDeTeste({
    novo: [
      negocioDeTeste('a', NOVO, { valor: '100.10', parado: true }),
      negocioDeTeste('b', NOVO, { valor: '200.20' }),
    ],
    proposta: [negocioDeTeste('c', PROPOSTA, { valor: '0.30' })],
  });
}

describe('regras do quadro', () => {
  it('põe ganho e perda no fim, depois das abertas em ordem', () => {
    const embaralhadas = [GANHO, PROPOSTA, PERDIDO, NOVO].map((etapa, indice) => ({
      ...etapa,
      ordem: [1, 4, 2, 3][indice],
    }));
    expect(ordenarEtapas(embaralhadas).map((etapa) => etapa.id)).toEqual([
      'novo',
      'proposta',
      'ganho',
      'perdido',
    ]);
  });

  it('soma valores decimais sem erro de ponto flutuante', () => {
    expect(somarValores(['0.10', '0.20', null, '1500.00'])).toBe('1500.30');
  });

  it('move o cartão entre colunas acertando quantidade, soma, parados e a etapa do negócio', () => {
    const colunas = moverCartao(quadro(), 'a', 'proposta', 1);
    const [novo, proposta] = colunas;
    expect(novo.negocios.map((n) => n.id)).toEqual(['b']);
    expect(novo.total).toBe(1);
    expect(novo.valorTotal).toBe('200.20');
    expect(novo.parados).toBe(0);
    expect(proposta.negocios.map((n) => n.id)).toEqual(['c', 'a']);
    expect(proposta.total).toBe(2);
    expect(proposta.valorTotal).toBe('100.40');
    const movido = proposta.negocios[1];
    expect(movido.etapa.id).toBe('proposta');
    expect(movido.parado).toBe(false);
    expect(movido.diasNaEtapa).toBe(0);
  });

  it('reordena dentro da mesma coluna sem mudar os totais', () => {
    const [novo] = moverCartao(quadro(), 'a', 'novo', 1);
    expect(novo.negocios.map((n) => n.id)).toEqual(['b', 'a']);
    expect(novo.total).toBe(2);
    expect(novo.valorTotal).toBe('300.30');
  });

  it('mover para ganho muda o status; voltar com o original restaura tudo', () => {
    const original = quadro();
    const ganho = moverCartao(original, 'b', 'ganho', 0);
    expect(ganho[2].negocios[0].status).toBe('GANHO');
    const desfeito = moverCartao(ganho, 'b', 'novo', 1, original[0].negocios[1]);
    expect(desfeito).toEqual(original);
  });

  it('dá os vizinhos do cartão para a API calcular a posição', () => {
    const colunas = moverCartao(quadro(), 'c', 'novo', 1);
    expect(vizinhos(colunas, 'c')).toEqual({ depoisDeId: 'a', antesDeId: 'b' });
    expect(vizinhos(colunas, 'a')).toEqual({ antesDeId: 'c' });
    expect(vizinhos(quadro(), 'c')).toEqual({});
  });

  it('substitui pela versão da API: no lugar, ou na etapa nova pela posição', () => {
    const atualizado = negocioDeTeste('b', NOVO, { valor: '500.00', titulo: 'Novo título' });
    const [novo] = substituirNegocio(quadro(), atualizado);
    expect(novo.negocios[1].titulo).toBe('Novo título');
    expect(novo.valorTotal).toBe('600.10');

    const emProposta = negocioDeTeste('a', PROPOSTA, { posicao: -1 });
    const colunas = substituirNegocio(quadro(), emProposta);
    expect(colunas[0].negocios.map((n) => n.id)).toEqual(['b']);
    expect(colunas[1].negocios.map((n) => n.id)).toEqual(['a', 'c']);
  });

  it('inclui um negócio novo e remove um que saiu', () => {
    const novo = negocioDeTeste('d', PROPOSTA, { posicao: 5 });
    const comNovo = incluirNegocio(quadro(), novo);
    expect(comNovo[1].negocios.map((n) => n.id)).toEqual(['c', 'd']);
    expect(comNovo[1].total).toBe(2);
    const semA = removerNegocio(comNovo, 'a');
    expect(semA[0].negocios.map((n) => n.id)).toEqual(['b']);
    expect(semA[0].parados).toBe(0);
  });
});

describe('permissões do funil (matriz §12)', () => {
  it('configurar etapas: Admin, C-level e o líder da própria área', () => {
    expect(podeConfigurarFunil(perfilDeTeste('ADMIN'), 'CS')).toBe(true);
    expect(podeConfigurarFunil(perfilDeTeste('C_LEVEL'), 'MARKETING')).toBe(true);
    expect(podeConfigurarFunil(perfilDeTeste('LIDER_COMERCIAL'), 'COMERCIAL')).toBe(true);
    expect(podeConfigurarFunil(perfilDeTeste('LIDER_COMERCIAL'), 'CS')).toBe(false);
    expect(podeConfigurarFunil(perfilDeTeste('COMERCIAL'), 'COMERCIAL')).toBe(false);
    expect(podeConfigurarFunil(null, 'COMERCIAL')).toBe(false);
  });

  it('reabrir (R5.5): líder da área, C-level e Admin', () => {
    expect(podeReabrir(perfilDeTeste('LIDER_CS'), 'CS')).toBe(true);
    expect(podeReabrir(perfilDeTeste('CS'), 'CS')).toBe(false);
    expect(podeReabrir(perfilDeTeste('C_LEVEL'), 'CS')).toBe(true);
  });

  it('responsável: alguém da área, C-level ou Admin (R5.9)', () => {
    expect(podeSerResponsavel({ area: 'COMERCIAL', nivel: 'MEMBRO' }, 'COMERCIAL')).toBe(true);
    expect(podeSerResponsavel({ area: 'MARKETING', nivel: 'LIDER' }, 'COMERCIAL')).toBe(false);
    expect(podeSerResponsavel({ area: null, nivel: 'DIRETORIA' }, 'CS')).toBe(true);
  });

  it('"Da equipe" só para quem tem equipe, com o motivo para os outros', () => {
    const membro = opcoesDeVisao(perfilDeTeste('COMERCIAL'));
    expect(membro.find((o) => o.id === 'EQUIPE')).toMatchObject({
      desabilitada: true,
      motivo: 'Só líderes e C-level têm equipe.',
    });
    expect(membro.find((o) => o.id === 'TODOS')?.rotulo).toBe('Todos que vejo');
    const lider = opcoesDeVisao(perfilDeTeste('LIDER_COMERCIAL'));
    expect(lider.find((o) => o.id === 'EQUIPE')?.desabilitada).toBe(false);
    expect(opcoesDeVisao(perfilDeTeste('ADMIN')).find((o) => o.id === 'EQUIPE')?.desabilitada).toBe(
      true,
    );
  });
});

describe('textos', () => {
  it('tempo na etapa e prazo-alvo', () => {
    expect(rotuloDias(0)).toBe('hoje');
    expect(rotuloDias(9)).toBe('9 d');
    // Menos de 24 h na etapa: "ontem" se entrou num dia anterior do calendário (fuso local).
    const agora = new Date(2026, 9, 22, 13, 0);
    expect(rotuloDias(0, new Date(2026, 9, 21, 18, 0).toISOString(), agora)).toBe('ontem');
    expect(rotuloDias(0, new Date(2026, 9, 22, 8, 0).toISOString(), agora)).toBe('hoje');
    expect(textoPrazo({ nome: 'Novo', prazoDias: 1 })).toContain('1 dia em “Novo”');
    expect(textoPrazo({ nome: 'Ganho', prazoDias: null })).toBeNull();
  });

  it('nome do destino da passagem: o funil visível ou o que vem depois da seta', () => {
    const passagem = { nome: 'Comercial → Customer Success', funilDestinoId: 'cs' };
    expect(nomeDoDestino(passagem, new Map([['cs', 'CS Premium']]))).toBe('CS Premium');
    expect(nomeDoDestino(passagem, new Map())).toBe('Customer Success');
  });

  function resultado(
    etapa = GANHO,
    area: 'COMERCIAL' | 'MARKETING' = 'COMERCIAL',
    passagens = true,
  ): ResultadoMovimentacao {
    return {
      negocio: negocioDeTeste('a', etapa, {
        funil: { id: 'f', nome: area === 'MARKETING' ? 'Marketing' : 'Comercial', area },
      }),
      passagens: passagens
        ? [
            {
              passagemId: 'p',
              nome: area === 'MARKETING' ? 'Marketing → Comercial' : 'Comercial → Customer Success',
              negocioOrigemId: 'a',
              negocioDestinoId: 'z',
              funilDestinoId: 'destino',
              criado: true,
              reconversao: false,
              responsavel: { id: 'u', nome: 'Fernanda Ribeiro' },
            },
          ]
        : [],
    };
  }

  it('ganho com passagem: "Negócio ganho! Enviado ao Customer Success"', () => {
    const aviso = mensagemDaMovimentacao(resultado(), true);
    expect(aviso.mensagem).toBe(
      'Negócio ganho! Enviado ao Customer Success, aos cuidados de Fernanda Ribeiro.',
    );
    expect(aviso.destino).toEqual({ funilId: 'destino', negocioId: 'z' });
  });

  it('MQL no Marketing: "Lead qualificado enviado ao Comercial"', () => {
    const mql = etapaDeTeste('mql', 'Qualificado (MQL)', 4, 'GANHO');
    expect(mensagemDaMovimentacao(resultado(mql, 'MARKETING'), true).mensagem).toBe(
      'Lead qualificado enviado ao Comercial, aos cuidados de Fernanda Ribeiro.',
    );
  });

  it('perda, movimento comum e reposição', () => {
    expect(mensagemDaMovimentacao(resultado(PERDIDO, 'COMERCIAL', false), true).mensagem).toBe(
      'Negócio “Negócio a” marcado como perdido.',
    );
    expect(mensagemDaMovimentacao(resultado(PROPOSTA, 'COMERCIAL', false), true).mensagem).toBe(
      '“Negócio a” movido para Proposta.',
    );
    expect(mensagemDaMovimentacao(resultado(PROPOSTA, 'COMERCIAL', false), false).tipo).toBe(
      'info',
    );
  });
});
