import { mensagemDoErro } from './mensagens-erro';

describe('mensagemDoErro', () => {
  it('usa a mensagem padrão em português, com os detalhes do erro', () => {
    expect(mensagemDoErro({ required: true })).toBe('Preencha este campo.');
    expect(mensagemDoErro({ minlength: { requiredLength: 8, actualLength: 3 } })).toBe(
      'Use pelo menos 8 caracteres.',
    );
    expect(mensagemDoErro({ max: { max: 1000, actual: 1500 } })).toBe(
      'O maior valor aceito é 1.000.',
    );
  });

  it('a mensagem da tela vence; um erro em texto vira a própria mensagem', () => {
    expect(mensagemDoErro({ required: true }, { required: 'Diga o nome.' })).toBe('Diga o nome.');
    expect(mensagemDoErro({ api: 'Este e-mail já está em uso.' })).toBe(
      'Este e-mail já está em uso.',
    );
  });

  it('sem erro, nada; erro desconhecido, uma frase genérica', () => {
    expect(mensagemDoErro(null)).toBeNull();
    expect(mensagemDoErro({})).toBeNull();
    expect(mensagemDoErro({ cpfInvalido: true })).toBe('Confira este campo.');
  });
});
