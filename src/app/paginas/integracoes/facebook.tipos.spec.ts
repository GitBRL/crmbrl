import {
  consumirContextoDoLogin,
  guardarContextoDoLogin,
  lerRetornoDoFacebook,
  motivoDoRetorno,
} from './facebook.tipos';

describe('retorno do login do Facebook', () => {
  it('lê os parâmetros do redirecionamento e ignora URLs que não vieram do Facebook', () => {
    expect(lerRetornoDoFacebook({ facebook: 'conectado', conexao: 'c1' })).toEqual({
      resultado: 'conectado',
      conexaoId: 'c1',
      motivo: null,
      mensagem: null,
    });
    expect(
      lerRetornoDoFacebook({ facebook: 'erro', motivo: 'state_usado', mensagem: 'Ops' }),
    ).toMatchObject({ resultado: 'erro', motivo: 'state_usado', mensagem: 'Ops' });
    expect(lerRetornoDoFacebook({ facebook: 'cancelado' })?.resultado).toBe('cancelado');
    expect(lerRetornoDoFacebook({ facebook: 'qualquer' })).toBeNull();
    expect(lerRetornoDoFacebook({})).toBeNull();
  });

  it('traduz os motivos da API e cai numa frase genérica para os desconhecidos', () => {
    expect(motivoDoRetorno('state_usado')).toContain('já foi usado');
    expect(motivoDoRetorno('state_vencido')).toContain('10 minutos');
    expect(motivoDoRetorno('algo_novo')).toContain('Não foi possível');
    expect(motivoDoRetorno(null)).toContain('Não foi possível');
  });

  it('guarda o contexto do assistente para depois do login e o apaga ao ler', () => {
    guardarContextoDoLogin({ integracaoId: 'we1', nome: 'Meu Facebook' });
    expect(consumirContextoDoLogin()).toEqual({ integracaoId: 'we1', nome: 'Meu Facebook' });
    expect(consumirContextoDoLogin()).toBeNull();
  });
});
