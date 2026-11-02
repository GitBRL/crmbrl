import {
  camposFaltando,
  contarPassos,
  DEFINICAO_AGUARDAR,
  type DefinicaoPasso,
  moverItem,
  novoPasso,
  resumirPasso,
  validarPassos,
} from './passos';

const ENVIAR: DefinicaoPasso = {
  tipo: 'enviar',
  fase: 'entao',
  rotulo: 'Enviar WhatsApp',
  descricao: 'Manda uma mensagem.',
  campos: [{ id: 'texto', rotulo: 'Mensagem', tipo: 'texto-longo', obrigatorio: true }],
};
const CONDICAO: DefinicaoPasso = {
  tipo: 'condicao',
  fase: 'se',
  rotulo: 'Tem etiqueta',
  descricao: 'Confere a etiqueta.',
  ramos: ['Se sim', 'Se não'],
  campos: [{ id: 'etiqueta', rotulo: 'Etiqueta', tipo: 'texto', obrigatorio: true }],
};
const DEFS = [ENVIAR, CONDICAO, DEFINICAO_AGUARDAR];

describe('passos (funções)', () => {
  it('passo novo traz os valores iniciais e os ramos vazios', () => {
    expect(novoPasso(DEFINICAO_AGUARDAR, 'p1').config).toEqual({ quantidade: 1, unidade: 'horas' });
    const condicao = novoPasso(CONDICAO, 'p2');
    expect(condicao.ramos?.map((r) => r.rotulo)).toEqual(['Se sim', 'Se não']);
    expect(novoPasso(ENVIAR, 'p3').ramos).toBeUndefined();
  });

  it('resume o passo pelo resumo próprio ou pelo primeiro campo preenchido', () => {
    expect(resumirPasso(DEFINICAO_AGUARDAR, novoPasso(DEFINICAO_AGUARDAR, 'a'))).toBe('1 hora');
    const enviar = { ...novoPasso(ENVIAR, 'b'), config: { texto: 'Olá!' } };
    expect(resumirPasso(ENVIAR, enviar)).toBe('Olá!');
    expect(resumirPasso(ENVIAR, novoPasso(ENVIAR, 'c'))).toBe('');
  });

  it('aponta campos obrigatórios vazios, inclusive dentro dos ramos', () => {
    const dentro = novoPasso(ENVIAR, 'dentro');
    const condicao = {
      ...novoPasso(CONDICAO, 'cond'),
      config: { etiqueta: 'vip' },
      ramos: [
        { rotulo: 'Se sim', passos: [dentro] },
        { rotulo: 'Se não', passos: [] },
      ],
    };
    expect(camposFaltando(ENVIAR, dentro)).toEqual(['Mensagem']);
    expect(validarPassos([condicao], DEFS)).toEqual([
      { passoId: 'dentro', mensagem: 'Enviar WhatsApp: preencha “Mensagem”.' },
    ]);
    expect(validarPassos([{ id: 'x', tipo: 'nada', config: {} }], DEFS)[0].mensagem).toContain(
      'desconhecido',
    );
  });

  it('conta os passos dos ramos e move sem alterar a lista original', () => {
    const a = novoPasso(ENVIAR, 'a');
    const cond = { ...novoPasso(CONDICAO, 'c'), ramos: [{ rotulo: 'Se sim', passos: [a, a] }] };
    expect(contarPassos([cond, a])).toBe(4);
    const lista = ['a', 'b', 'c'];
    expect(moverItem(lista, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(lista).toEqual(['a', 'b', 'c']);
    expect(moverItem(lista, 0, 5)).toBe(lista);
  });
});
