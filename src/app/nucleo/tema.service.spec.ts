import { TestBed } from '@angular/core/testing';

import { CHAVE_TEMA, TemaService } from './tema.service';

describe('TemaService', () => {
  let meta: HTMLMetaElement;

  beforeEach(() => {
    localStorage.clear();
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  });

  afterEach(() => {
    meta.remove();
    localStorage.clear();
  });

  it('sem escolha salva segue o sistema (escuro sem matchMedia) e aplica no <html>', () => {
    const tema = TestBed.inject(TemaService);
    expect(tema.tema()).toBe('escuro');
    expect(tema.segueSistema()).toBe(true);
    expect(document.documentElement.getAttribute('data-tema')).toBe('escuro');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(meta.getAttribute('content')).toBe('#000000');
  });

  it('usa a escolha salva', () => {
    localStorage.setItem(CHAVE_TEMA, 'claro');
    const tema = TestBed.inject(TemaService);
    expect(tema.tema()).toBe('claro');
    expect(tema.segueSistema()).toBe(false);
    expect(meta.getAttribute('content')).toBe('#efefec');
  });

  it('alternar() grava a escolha; seguirSistema() a esquece', () => {
    const tema = TestBed.inject(TemaService);
    tema.alternar();
    expect(tema.tema()).toBe('claro');
    expect(tema.ehEscuro()).toBe(false);
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('claro');
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
    expect(document.documentElement.style.colorScheme).toBe('light');
    tema.seguirSistema();
    expect(localStorage.getItem(CHAVE_TEMA)).toBeNull();
    expect(tema.tema()).toBe('escuro');
  });

  it('ignora valor inválido salvo', () => {
    localStorage.setItem(CHAVE_TEMA, 'roxo');
    expect(TestBed.inject(TemaService).segueSistema()).toBe(true);
  });

  describe('com a preferência do sistema (matchMedia falso)', () => {
    /** `prefers-color-scheme: light` controlável, com o evento `change`. */
    function instalarMidia(claro: boolean) {
      const ouvintes = new Set<(evento: MediaQueryListEvent) => void>();
      const midia = {
        matches: claro,
        media: '(prefers-color-scheme: light)',
        addEventListener: (_tipo: string, ouvinte: (evento: MediaQueryListEvent) => void) =>
          ouvintes.add(ouvinte),
        removeEventListener: (_tipo: string, ouvinte: (evento: MediaQueryListEvent) => void) =>
          ouvintes.delete(ouvinte),
      };
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: () => midia,
      });
      return (novoClaro: boolean) => {
        midia.matches = novoClaro;
        ouvintes.forEach((ouvinte) => ouvinte({ matches: novoClaro } as MediaQueryListEvent));
      };
    }

    afterEach(() => {
      delete (window as { matchMedia?: unknown }).matchMedia;
    });

    it('segue o sistema até definir() e para de seguir depois', () => {
      const mudarSistema = instalarMidia(true);
      const tema = TestBed.inject(TemaService);
      expect(tema.tema()).toBe('claro');

      mudarSistema(false);
      expect(tema.tema()).toBe('escuro');
      expect(document.documentElement.getAttribute('data-tema')).toBe('escuro');
      expect(meta.getAttribute('content')).toBe('#000000');

      tema.definir('claro');
      mudarSistema(false);
      expect(tema.tema()).toBe('claro');
      expect(tema.segueSistema()).toBe(false);
      expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
    });

    it('acompanha a troca de tema feita em outra aba (evento storage)', () => {
      instalarMidia(false);
      const tema = TestBed.inject(TemaService);
      expect(tema.tema()).toBe('escuro');

      window.dispatchEvent(new StorageEvent('storage', { key: CHAVE_TEMA, newValue: 'claro' }));
      expect(tema.tema()).toBe('claro');
      expect(tema.segueSistema()).toBe(false);
      expect(document.documentElement.getAttribute('data-tema')).toBe('claro');

      // A outra aba voltou a seguir o sistema (escuro).
      window.dispatchEvent(new StorageEvent('storage', { key: CHAVE_TEMA, newValue: null }));
      expect(tema.segueSistema()).toBe(true);
      expect(tema.tema()).toBe('escuro');

      // Outras chaves não mexem no tema.
      window.dispatchEvent(new StorageEvent('storage', { key: 'outra', newValue: 'claro' }));
      expect(tema.tema()).toBe('escuro');
    });
  });
});
