import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LigacaoService } from '../../nucleo/ligacoes/ligacao.service';
import { AvisoToque } from './aviso-toque';
import { ligacaoServiceFalso, toqueDeTeste } from './ligacoes-stub';

describe('AvisoToque (ligação recebida em qualquer tela)', () => {
  let falso: ReturnType<typeof ligacaoServiceFalso>;
  let anuncio: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    falso = ligacaoServiceFalso();
    anuncio = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LigacaoService, useValue: falso },
        { provide: LiveAnnouncer, useValue: { announce: anuncio } },
      ],
    });
  });

  function criar() {
    const fixture = TestBed.createComponent(AvisoToque);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    return { fixture, raiz };
  }

  it('sem toque não há nada na tela', () => {
    const { raiz } = criar();
    expect(raiz.querySelector('.toque')).toBeNull();
  });

  it('mostra nome, número, empresa e canal, e anuncia ao leitor de tela', () => {
    const { fixture, raiz } = criar();
    falso.toques.set([toqueDeTeste()]);
    fixture.detectChanges();
    TestBed.tick();
    const texto = raiz.textContent ?? '';
    expect(texto).toContain('Maria Oficial');
    expect(texto).toContain('(11) 99999-0001');
    expect(texto).toContain('Maria Ltda');
    expect(texto).toContain('WhatsApp Oficial');
    expect(raiz.querySelector('section[aria-label="Ligações recebidas"]')).not.toBeNull();
    expect(anuncio).toHaveBeenCalledTimes(1);
    expect(anuncio.mock.calls[0][0]).toContain('Ligação recebida de Maria Oficial');
    expect(anuncio.mock.calls[0][1]).toBe('assertive');
  });

  it('Atender e Recusar chamam o serviço da ligação certa', () => {
    const { fixture, raiz } = criar();
    falso.toques.set([toqueDeTeste()]);
    fixture.detectChanges();
    const botoes = Array.from(raiz.querySelectorAll<HTMLButtonElement>('.toque__acoes button'));
    expect(botoes.map((b) => b.textContent?.trim().split(/\s/)[0])).toEqual(['Atender', 'Recusar']);
    botoes[0].click();
    expect(falso.atender).toHaveBeenCalledWith('lig-1');
    botoes[1].click();
    expect(falso.dispensar).toHaveBeenCalledWith('lig-1');
  });

  it('atalhos Alt+A e Alt+R valem para o primeiro toque, de qualquer lugar', () => {
    const { fixture } = criar();
    falso.toques.set([toqueDeTeste(), toqueDeTeste({ ligacaoId: 'lig-2' })]);
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', altKey: true }));
    expect(falso.atender).toHaveBeenCalledWith('lig-1');
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', altKey: true }));
    expect(falso.dispensar).toHaveBeenCalledWith('lig-1');
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    expect(falso.atender).toHaveBeenCalledTimes(1);
  });

  it('avisa quando o toque está sem som (autoplay) e não rouba o foco ao aparecer', () => {
    const { fixture, raiz } = criar();
    const antes = document.activeElement;
    falso.somDesligado.set(true);
    falso.toques.set([toqueDeTeste()]);
    fixture.detectChanges();
    expect(raiz.querySelector('.toque__nota')?.textContent).toContain('sem som');
    expect(document.activeElement).toBe(antes);
  });

  it('vindo do push (destaque), o botão Atender ganha o foco', async () => {
    vi.useFakeTimers();
    try {
      const { fixture, raiz } = criar();
      falso.toques.set([toqueDeTeste()]);
      fixture.detectChanges();
      document.body.appendChild(raiz);
      falso.destaque.set('lig-1');
      fixture.detectChanges();
      TestBed.tick();
      vi.advanceTimersByTime(100);
      expect(document.activeElement?.id).toBe('toque-atender-lig-1');
      expect(falso.limparDestaque).toHaveBeenCalled();
      raiz.remove();
    } finally {
      vi.useRealTimers();
    }
  });
});
