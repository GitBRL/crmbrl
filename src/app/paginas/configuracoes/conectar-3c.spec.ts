import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { TrescPlusApi } from '../../nucleo/tresc-plus/tresc-plus.api';
import { trescServiceFalso } from '../../nucleo/tresc-plus/tresc-plus-de-teste';
import { TrescPlusService } from '../../nucleo/tresc-plus/tresc-plus.service';
import { ConectarAo3c } from './conectar-3c';

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
}

function digitar(campo: HTMLInputElement, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

describe('ConectarAo3c (Meu perfil)', () => {
  let falso: ReturnType<typeof trescServiceFalso>;
  let api: { vincular: ReturnType<typeof vi.fn>; desconectar: ReturnType<typeof vi.fn> };
  let confirmar: ReturnType<typeof vi.fn>;

  function montar() {
    const fixture = TestBed.createComponent(ConectarAo3c);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    falso = trescServiceFalso();
    falso.vinculado.set(false);
    falso.vinculo.set({ vinculado: false });
    api = {
      vincular: vi.fn(() => Promise.resolve({ vinculado: true })),
      desconectar: vi.fn(() => Promise.resolve()),
    };
    confirmar = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        { provide: TrescPlusService, useValue: falso },
        { provide: TrescPlusApi, useValue: api },
        { provide: ConfirmacaoService, useValue: { confirmar } },
        { provide: ActivatedRoute, useValue: { snapshot: { fragment: null } } },
      ],
    });
  });

  it('mostra o formulário e o aviso de que a senha não é guardada', () => {
    const el = montar().nativeElement as HTMLElement;
    expect(el.textContent).toContain('Conectar ao 3C+');
    expect(el.textContent).toContain('não é guardada');
    expect(el.querySelectorAll('input').length).toBe(2);
  });

  it('não envia com campos vazios', async () => {
    const fixture = montar();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await microtarefas();
    expect(api.vincular).not.toHaveBeenCalled();
  });

  it('conecta com usuário e senha, depois recarrega o estado', async () => {
    const fixture = montar();
    const [usuario, senha] = fixture.nativeElement.querySelectorAll(
      'input',
    ) as NodeListOf<HTMLInputElement>;
    digitar(usuario, ' vendedor1@3c.sim ');
    digitar(senha, 'segredo');
    const sucesso = vi.spyOn(TestBed.inject(AvisosService), 'sucesso');
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await microtarefas();
    expect(api.vincular).toHaveBeenCalledWith('vendedor1@3c.sim', 'segredo');
    expect(falso.aposMudarVinculo).toHaveBeenCalled();
    expect(sucesso).toHaveBeenCalled();
  });

  it('mostra o erro do 3C+ e limpa a senha', async () => {
    api.vincular.mockRejectedValue(new Error('x'));
    const fixture = montar();
    const [usuario, senha] = fixture.nativeElement.querySelectorAll(
      'input',
    ) as NodeListOf<HTMLInputElement>;
    digitar(usuario, 'a@b.c');
    digitar(senha, 'errada');
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await microtarefas();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')).not.toBeNull();
    expect(senha.value).toBe('');
  });

  it('conectado: mostra ramal e token e desconecta depois de confirmar', async () => {
    falso.vinculado.set(true);
    falso.vinculo.set({
      vinculado: true,
      ramal: '1001',
      nome3c: 'Vendedor Um',
      token: '••••-101',
      vinculadoEm: '2026-11-12T13:44:00.000Z',
    });
    const fixture = montar();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Conectado');
    expect(el.textContent).toContain('1001');
    expect(el.textContent).toContain('••••-101');
    expect(el.querySelector('input')).toBeNull();
    const botao = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Desconectar do 3C+'),
    ) as HTMLButtonElement;
    botao.click();
    await microtarefas();
    expect(confirmar).toHaveBeenCalled();
    expect(api.desconectar).toHaveBeenCalled();
    expect(falso.aposMudarVinculo).toHaveBeenCalled();
  });

  it('não desconecta se a pessoa cancelar', async () => {
    confirmar.mockResolvedValue(false);
    falso.vinculado.set(true);
    falso.vinculo.set({ vinculado: true });
    const fixture = montar();
    const botao = [...fixture.nativeElement.querySelectorAll('button')].find((b) =>
      (b as HTMLElement).textContent?.includes('Desconectar'),
    ) as HTMLButtonElement;
    botao.click();
    await microtarefas();
    expect(api.desconectar).not.toHaveBeenCalled();
  });

  it('erro de carga com Tentar de novo', () => {
    falso.vinculo.set(null);
    falso.erro.set('Sem conexão.');
    const fixture = montar();
    expect(fixture.nativeElement.textContent).toContain('Não conseguimos consultar o 3C+');
    const tentar = [...fixture.nativeElement.querySelectorAll('button')].find((b) =>
      (b as HTMLElement).textContent?.includes('Tentar de novo'),
    ) as HTMLButtonElement;
    tentar.click();
    expect(falso.carregar).toHaveBeenCalled();
  });
});
