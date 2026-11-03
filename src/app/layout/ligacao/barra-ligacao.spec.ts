import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LigacaoService } from '../../nucleo/ligacoes/ligacao.service';
import { BarraLigacao } from './barra-ligacao';
import { cursoDeTeste, ligacaoServiceFalso } from './ligacoes-stub';

describe('BarraLigacao (ligação fixa na tela)', () => {
  let falso: ReturnType<typeof ligacaoServiceFalso>;

  beforeEach(() => {
    falso = ligacaoServiceFalso();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: LigacaoService, useValue: falso }],
    });
  });

  function criar() {
    const fixture = TestBed.createComponent(BarraLigacao);
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  it('sem ligação não há barra', () => {
    expect(criar().raiz.querySelector('.barra')).toBeNull();
  });

  it('em andamento: nome com link para o contato, tempo, mudo e encerrar', () => {
    const { fixture, raiz } = criar();
    falso.emCurso.set(cursoDeTeste());
    falso.segundos.set(65);
    fixture.detectChanges();
    expect(raiz.querySelector('.barra__nome a')?.getAttribute('href')).toBe('/contatos/ct-1');
    expect(raiz.querySelector('.barra__tempo')?.textContent).toBe('1:05');
    expect(raiz.querySelector('.barra__tempo')?.getAttribute('aria-label')).toBe(
      '1 minuto e 5 segundos',
    );
    expect(raiz.textContent).toContain('Em ligação');
    const mudo = raiz.querySelector<HTMLButtonElement>('button[aria-keyshortcuts="Alt+S"]')!;
    expect(mudo.getAttribute('aria-pressed')).toBe('false');
    mudo.click();
    expect(falso.alternarMudo).toHaveBeenCalled();
    raiz.querySelector<HTMLButtonElement>('.barra__encerrar')!.click();
    expect(falso.encerrar).toHaveBeenCalled();
  });

  it('estados da chamada feita: preparando, chamando e tocando; sem cronômetro até atender', () => {
    const { fixture, raiz } = criar();
    for (const [fase, texto] of [
      ['preparando', 'Preparando o microfone'],
      ['chamando', 'Chamando'],
      ['tocando', 'Tocando no WhatsApp do cliente'],
    ] as const) {
      falso.emCurso.set(cursoDeTeste({ direcao: 'FEITA', fase, inicioEm: null }));
      fixture.detectChanges();
      expect(raiz.textContent).toContain(texto);
      expect(raiz.querySelector('.barra__tempo')).toBeNull();
    }
    expect(raiz.querySelector('.barra__encerrar-texto')?.textContent).toBe('Encerrar');
    falso.emCurso.set(cursoDeTeste({ id: null, fase: 'preparando', inicioEm: null }));
    fixture.detectChanges();
    expect(raiz.querySelector('.barra__encerrar-texto')?.textContent).toBe('Cancelar');
  });

  it('aviso de conexão ruim aparece como alerta; o indicador "Gravando" tem o seu lugar', () => {
    const { fixture, raiz } = criar();
    falso.emCurso.set(cursoDeTeste());
    falso.alerta.set('Conexão ruim: o áudio pode falhar ou atrasar.');
    falso.gravando.set(true);
    fixture.detectChanges();
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('Conexão ruim');
    expect(raiz.querySelector('.barra__gravando')?.textContent).toContain('Gravando');
    expect(raiz.querySelector('.barra__lembrete')?.textContent).toContain('Avise o cliente');
  });

  it('ajustes: microfone, alto-falante e a anotação rápida vão para o serviço', () => {
    const { fixture, raiz } = criar();
    falso.emCurso.set(cursoDeTeste());
    fixture.detectChanges();
    expect(raiz.querySelector('#barra-ligacao-ajustes')).toBeNull();
    raiz.querySelector<HTMLButtonElement>('button[aria-label^="Ajustes"]')!.click();
    fixture.detectChanges();
    expect(raiz.querySelector('#barra-ligacao-ajustes')).not.toBeNull();
    expect(raiz.textContent).toContain('Microfone');
    expect(raiz.textContent).toContain('Alto-falante');
    const nota = raiz.querySelector<HTMLTextAreaElement>('textarea')!;
    nota.value = 'Pediu proposta até sexta';
    nota.dispatchEvent(new Event('input'));
    expect(falso.anotar).toHaveBeenCalledWith('Pediu proposta até sexta');
  });

  it('ligação sem áudio nesta aba (outra aba): só encerrar, com explicação', () => {
    const { fixture, raiz } = criar();
    falso.emCurso.set(cursoDeTeste({ semAudioNestaAba: true }));
    fixture.detectChanges();
    expect(
      raiz.querySelector<HTMLButtonElement>('button[aria-keyshortcuts="Alt+S"]')!.disabled,
    ).toBe(true);
    raiz.querySelector<HTMLButtonElement>('button[aria-label^="Ajustes"]')!.click();
    fixture.detectChanges();
    expect(raiz.textContent).toContain('outra aba');
  });

  it('atalhos Alt+E e Alt+S só valem durante uma ligação', () => {
    const { fixture } = criar();
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', altKey: true }));
    expect(falso.encerrar).not.toHaveBeenCalled();
    falso.emCurso.set(cursoDeTeste());
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', altKey: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', altKey: true }));
    expect(falso.encerrar).toHaveBeenCalledTimes(1);
    expect(falso.alternarMudo).toHaveBeenCalledTimes(1);
  });

  it('terminada: o resultado fica na barra até a pessoa fechar', () => {
    const { fixture, raiz } = criar();
    falso.fim.set({
      ligacaoId: 'lig-1',
      estado: 'RECUSADA',
      direcao: 'FEITA',
      contato: { id: 'ct-1', nome: 'Diego Mídia', telefone: null, empresa: null },
      duracaoSegundos: null,
      texto: 'O cliente recusou a ligação.',
      tom: 'info',
    });
    fixture.detectChanges();
    expect(raiz.querySelector('[aria-label="Resultado da ligação"]')?.textContent).toContain(
      'recusou',
    );
    raiz.querySelector<HTMLButtonElement>('button[aria-label^="Fechar o resultado"]')!.click();
    expect(falso.fecharFim).toHaveBeenCalled();
  });
});
