import { FormControl, FormGroup } from '@angular/forms';

import { EstadoAcesso } from './estado-acesso';
import {
  confirmaNovaSenha,
  diferenteDaAtual,
  regrasDaSenha,
  VALIDADORES_NOVA_SENHA,
} from './senha';

describe('regras da senha nova', () => {
  it('lista os requisitos e marca os atendidos', () => {
    expect(regrasDaSenha('', '')).toEqual([
      { id: 'tamanho', texto: 'Pelo menos 8 caracteres', atendida: false },
      { id: 'iguais', texto: 'As duas senhas são iguais', atendida: false },
    ]);
    const prontas = regrasDaSenha('Sol de outubro', 'Sol de outubro');
    expect(prontas.every((regra) => regra.atendida)).toBe(true);
    // 129 caracteres passam do limite da API (R2.1).
    expect(regrasDaSenha('x'.repeat(129), 'x'.repeat(129))[0].atendida).toBe(false);
  });

  it('na troca, inclui "Diferente da senha atual" (pendente sem a atual)', () => {
    expect(regrasDaSenha('nova senha 1', '', null).map((regra) => regra.id)).toEqual([
      'tamanho',
      'diferente',
      'iguais',
    ]);
    expect(regrasDaSenha('nova senha 1', '', null)[1].atendida).toBe(false);
    expect(regrasDaSenha('nova senha 1', '', 'Trocar@2026')[1].atendida).toBe(true);
    expect(regrasDaSenha('Trocar@2026', '', 'Trocar@2026')[1].atendida).toBe(false);
  });

  it('validadores: tamanho, confirmação igual e diferente da atual', () => {
    let atual: string | null = 'Trocar@2026';
    const grupo = new FormGroup({
      nova: new FormControl('', [...VALIDADORES_NOVA_SENHA, diferenteDaAtual(() => atual)]),
      confirmacao: new FormControl('', confirmaNovaSenha),
    });
    const { nova, confirmacao } = grupo.controls;

    nova.setValue('curta');
    expect(nova.errors).toEqual({ minlength: { requiredLength: 8, actualLength: 5 } });
    nova.setValue('Trocar@2026');
    expect(nova.errors).toEqual({ igualAtual: true });
    atual = null;
    nova.updateValueAndValidity();
    expect(nova.valid).toBe(true);

    expect(confirmacao.errors).toEqual({ required: true });
    confirmacao.setValue('outra coisa');
    expect(confirmacao.errors).toEqual({ diferentes: true });
    confirmacao.setValue('Trocar@2026');
    expect(confirmacao.valid).toBe(true);
  });
});

describe('EstadoAcesso', () => {
  it('a senha temporária é lida uma vez só e só para o mesmo e-mail', () => {
    const estado = new EstadoAcesso();
    estado.guardarSenhaTemporaria(' Patricia@Demo.Local ', 'Trocar@2026');
    expect(estado.tomarSenhaTemporaria('outra@demo.local')).toBeNull();
    // A leitura errada também a esquece: não fica na memória à toa.
    expect(estado.tomarSenhaTemporaria('patricia@demo.local')).toBeNull();

    estado.guardarSenhaTemporaria('patricia@demo.local', 'Trocar@2026');
    expect(estado.tomarSenhaTemporaria('PATRICIA@demo.local')).toBe('Trocar@2026');
    expect(estado.tomarSenhaTemporaria('patricia@demo.local')).toBeNull();
  });
});
