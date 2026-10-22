import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import { ErroApi, erroDaApi, MENSAGENS_ERRO } from './erro-api';

function resposta(status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  return new HttpErrorResponse({
    status,
    error: corpo,
    headers: new HttpHeaders(cabecalhos),
    url: '/api/v1/x',
  });
}

const corpo = (
  statusCode: number,
  erro: string,
  mensagem: string,
  detalhes?: Record<string, unknown>,
) => ({ statusCode, erro, mensagem, detalhes, requisicaoId: 'req-123' });

describe('ErroApi', () => {
  it('usa a mensagem da API (como frase) e lê regra e campos dos detalhes', () => {
    const erro = erroDaApi(
      resposta(
        400,
        corpo(400, 'dados_invalidos', 'Dados inválidos.', {
          regra: 'R4.1',
          campos: [{ campo: 'email', mensagens: ['deve ser um e-mail válido'] }],
        }),
      ),
    );
    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro.mensagem).toBe('Dados inválidos.');
    expect(erro.ehDadosInvalidos).toBe(true);
    expect(erro.regra).toBe('R4.1');
    expect(erro.mensagemDoCampo('email')).toBe('Deve ser um e-mail válido.');
    expect(erro.mensagemDoCampo('nome')).toBeNull();
    expect(erro.requisicaoId).toBe('req-123');
  });

  it('422 regra violada mantém a mensagem e a regra', () => {
    const erro = erroDaApi(
      resposta(422, corpo(422, 'regra_violada', 'Informe o motivo da perda', { regra: 'R5.5' })),
    );
    expect(erro.ehRegraViolada).toBe(true);
    expect(erro.regra).toBe('R5.5');
    expect(erro.mensagem).toBe('Informe o motivo da perda.');
  });

  it('5xx: frase humana com o código para a TI; o resumo vem sem o código', () => {
    const erro = erroDaApi(resposta(500, corpo(500, 'erro_interno', 'Internal')));
    expect(erro.mensagem).toBe(
      `${MENSAGENS_ERRO.interno} Se continuar, informe à TI o código req-123.`,
    );
    expect(erro.resumo).toBe(MENSAGENS_ERRO.interno);
    expect(erro.ehFalhaDoServidor).toBe(true);

    const indisponivel = erroDaApi(
      resposta(503, corpo(503, 'indisponivel', 'O envio de e-mail está indisponível')),
    );
    expect(indisponivel.resumo).toBe('O envio de e-mail está indisponível.');
  });

  it('sem resposta (rede ou proxy) e 502 sem corpo viram mensagens próprias', () => {
    expect(erroDaApi(resposta(0, null)).mensagem).toBe(MENSAGENS_ERRO.semConexao);
    expect(erroDaApi(resposta(0, null)).codigo).toBe('sem_conexao');
    expect(erroDaApi(resposta(502, '<html>Bad gateway</html>')).mensagem).toBe(
      MENSAGENS_ERRO.foraDoAr,
    );
  });

  it('429 diz quando tentar de novo (Retry-After), sem repetir o que a API já disse', () => {
    const generico = erroDaApi(
      resposta(429, corpo(429, 'muitas_tentativas', 'Muitas tentativas'), { 'Retry-After': '90' }),
    );
    expect(generico.tentarDeNovoEmSegundos).toBe(90);
    expect(generico.mensagem).toBe('Muitas tentativas. Tente de novo em 2 minutos.');

    const login = erroDaApi(
      resposta(
        429,
        corpo(429, 'muitas_tentativas', 'Muitas tentativas de login. Tente de novo em 15 minutos.'),
        { 'Retry-After': '900' },
      ),
    );
    expect(login.mensagem).toBe('Muitas tentativas de login. Tente de novo em 15 minutos.');
  });

  it('403 da troca de senha pendente é diferente do "sem permissão"', () => {
    const pendente = erroDaApi(
      resposta(
        403,
        corpo(403, 'sem_permissao', 'Troque a senha', {
          regra: 'R2.7',
          motivo: 'troca_de_senha_pendente',
        }),
      ),
    );
    expect(pendente.ehTrocaDeSenhaPendente).toBe(true);
    expect(pendente.ehSemPermissao).toBe(false);
    const negado = erroDaApi(resposta(403, null));
    expect(negado.ehSemPermissao).toBe(true);
    expect(negado.mensagem).toBe(MENSAGENS_ERRO.semPermissao);
  });

  it('falha que não é HTTP vira "desconhecido"; ErroApi passa direto', () => {
    const erro = erroDaApi(new Error('boom'));
    expect(erro.codigo).toBe('desconhecido');
    expect(erro.mensagem).toBe(MENSAGENS_ERRO.desconhecido);
    expect(erroDaApi(erro)).toBe(erro);
  });
});
