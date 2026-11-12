import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { trescServiceFalso } from '../../nucleo/tresc-plus/tresc-plus-de-teste';
import { TrescPlusService } from '../../nucleo/tresc-plus/tresc-plus.service';
import { AvisoRecebida } from './aviso-recebida';

describe('AvisoRecebida', () => {
  let falso: ReturnType<typeof trescServiceFalso>;

  function montar() {
    const fixture = TestBed.createComponent(AvisoRecebida);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    falso = trescServiceFalso();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: TrescPlusService, useValue: falso }],
    });
  });

  it('não aparece sem ligação recebida', () => {
    expect(montar().nativeElement.querySelector('section')).toBeNull();
  });

  it('contato conhecido: nome, empresa, negócios e link para a ficha', () => {
    falso.recebida.set({
      ligacaoId: 'l1',
      telefone: '5511999990001',
      contato: { id: 'c1', nome: 'Maria Silva', empresa: 'Grupo Castro' },
      negocios: [{ id: 'n1', titulo: 'Plano anual' }],
      novoContato: false,
    });
    const el = montar().nativeElement as HTMLElement;
    expect(el.querySelector('section')?.getAttribute('role')).toBe('alert');
    expect(el.textContent).toContain('Ligação recebida de Maria Silva');
    expect(el.textContent).toContain('Grupo Castro');
    expect(el.textContent).toContain('Plano anual');
    expect(el.querySelector('a.aviso__link')?.getAttribute('href')).toBe('/contatos/c1');
  });

  it('número desconhecido: "Novo contato" com o telefone no cadastro', () => {
    falso.recebida.set({
      ligacaoId: null,
      telefone: '5511955554321',
      contato: null,
      negocios: [],
      novoContato: true,
    });
    const el = montar().nativeElement as HTMLElement;
    expect(el.textContent).toContain('Novo contato');
    expect(el.textContent).toContain('(11) 95555-4321');
    const link = el.querySelector('a.aviso__link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('novo=1');
    expect(link.getAttribute('href')).toContain('telefone=5511955554321');
  });

  it('dispensar fecha o aviso', () => {
    falso.recebida.set({
      ligacaoId: null,
      telefone: '5511955554321',
      contato: null,
      negocios: [],
      novoContato: true,
    });
    const el = montar().nativeElement as HTMLElement;
    (el.querySelector('button[aria-label="Dispensar o aviso"]') as HTMLButtonElement).click();
    expect(falso.dispensarRecebida).toHaveBeenCalled();
  });
});
