import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AtualizacaoService } from '../nucleo/pwa/atualizacao.service';
import { RedeService } from '../nucleo/pwa/rede.service';
import { FaixaPwa } from './faixa-pwa';

describe('cenário 139 — FaixaPwa (sem conexão e nova versão)', () => {
  const online = signal(true);
  const disponivel = signal(false);
  const atualizar = vi.fn();

  beforeEach(() => {
    online.set(true);
    disponivel.set(false);
    atualizar.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: RedeService, useValue: { online } },
        {
          provide: AtualizacaoService,
          useValue: { disponivel, atualizando: signal(false), atualizar },
        },
      ],
    });
  });

  function criar() {
    const fixture = TestBed.createComponent(FaixaPwa);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const avisos = () => raiz.querySelectorAll<HTMLElement>('.faixa__aviso');
    return { fixture, raiz, avisos };
  }

  it('online e atualizado: nada aparece', () => {
    const { raiz, avisos } = criar();
    expect(raiz.querySelector('.faixa--visivel')).toBeNull();
    expect([...avisos()].every((a) => a.hidden)).toBe(true);
  });

  it('sem conexão: mostra o aviso e some quando a rede volta', () => {
    const { fixture, raiz, avisos } = criar();
    online.set(false);
    fixture.detectChanges();
    expect(raiz.querySelector('.faixa--visivel')).not.toBeNull();
    expect(avisos()[0].hidden).toBe(false);
    expect(avisos()[0].textContent).toContain('Sem conexão');
    online.set(true);
    fixture.detectChanges();
    expect(avisos()[0].hidden).toBe(true);
  });

  it('versão nova: mostra o botão Atualizar, que chama o serviço', () => {
    const { fixture, raiz, avisos } = criar();
    disponivel.set(true);
    fixture.detectChanges();
    expect(avisos()[1].hidden).toBe(false);
    expect(avisos()[1].textContent).toContain('Nova versão do CRM');
    raiz.querySelector<HTMLButtonElement>('.faixa__botao')!.click();
    expect(atualizar).toHaveBeenCalledOnce();
  });
});
