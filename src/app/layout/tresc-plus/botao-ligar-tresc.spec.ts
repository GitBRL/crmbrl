import { TestBed } from '@angular/core/testing';

import { trescServiceFalso } from '../../nucleo/tresc-plus/tresc-plus-de-teste';
import { TrescPlusService } from '../../nucleo/tresc-plus/tresc-plus.service';
import { BotaoLigarTresc } from './botao-ligar-tresc';

describe('BotaoLigarTresc', () => {
  let falso: ReturnType<typeof trescServiceFalso>;

  function montar(entradas: Record<string, unknown> = { contatoId: 'c1', nome: 'Maria' }) {
    const fixture = TestBed.createComponent(BotaoLigarTresc);
    for (const [chave, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(chave, valor);
    }
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    falso = trescServiceFalso();
    TestBed.configureTestingModule({
      providers: [{ provide: TrescPlusService, useValue: falso }],
    });
  });

  it('some quando o 3C+ não está disponível', () => {
    falso.disponivel.set(false);
    const fixture = montar();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('liga pelo contato e pelo negócio', () => {
    const fixture = montar({ contatoId: 'c1', negocioId: 'n1', nome: 'Maria' });
    const botao = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(botao.getAttribute('aria-label')).toBe('Ligar pelo 3C+: Maria');
    botao.click();
    expect(falso.ligar).toHaveBeenCalledWith({ contatoId: 'c1', negocioId: 'n1' }, 'Maria');
  });

  it('sem vínculo, o rótulo avisa que leva a conectar e o clique segue para o serviço', () => {
    falso.vinculado.set(false);
    const fixture = montar();
    const botao = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(botao.getAttribute('aria-label')).toContain('conectar ao 3C+');
    expect(botao.disabled).toBe(false);
    botao.click();
    expect(falso.ligar).toHaveBeenCalled();
  });

  it('fica desabilitado durante uma ligação', () => {
    falso.ocupado.set(true);
    const fixture = montar();
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('só ícone: o rótulo vira o nome acessível', () => {
    const fixture = montar({ contatoId: 'c1', somenteIcone: true, rotulo: 'Ligar pelo 3C+' });
    const botao = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(botao.getAttribute('aria-label')).toBe('Ligar pelo 3C+');
    expect(botao.textContent?.trim()).toBe('');
  });
});
