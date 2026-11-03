import { describe, expect, it } from 'vitest';

import {
  atalhoAria,
  atalhoFalado,
  ehAtalho,
  rotuloDoAtalho,
  sistemaDeAtalhos,
  temModificadorDeAtalho,
} from './atalhos';

function evento(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('atalhos', () => {
  it('no Windows e no Linux o atalho é Alt+tecla pelo code, em qualquer layout', () => {
    // Em um layout AZERTY a tecla física "A" produz "q", mas o code continua KeyA.
    expect(ehAtalho(evento({ code: 'KeyA', key: 'q', altKey: true }), 'A', 'outro')).toBe(true);
    expect(ehAtalho(evento({ code: 'KeyB', key: 'a', altKey: true }), 'A', 'outro')).toBe(false);
    expect(ehAtalho(evento({ code: 'KeyA', key: 'a' }), 'A', 'outro')).toBe(false);
    expect(ehAtalho(evento({ code: 'ArrowDown', altKey: true }), 'ArrowDown', 'outro')).toBe(true);
  });

  it('o AltGr (Ctrl+Alt) e outros modificadores não acionam o atalho', () => {
    expect(ehAtalho(evento({ code: 'KeyA', altKey: true, ctrlKey: true }), 'A', 'outro')).toBe(
      false,
    );
    expect(ehAtalho(evento({ code: 'KeyA', altKey: true, shiftKey: true }), 'A', 'outro')).toBe(
      false,
    );
    expect(ehAtalho(evento({ code: 'KeyA', altKey: true, metaKey: true }), 'A', 'outro')).toBe(
      false,
    );
  });

  it('no Mac o atalho é Control+Shift+tecla e Option sozinho não vale', () => {
    expect(ehAtalho(evento({ code: 'KeyA', ctrlKey: true, shiftKey: true }), 'A', 'apple')).toBe(
      true,
    );
    expect(ehAtalho(evento({ code: 'KeyA', altKey: true, key: 'å' }), 'A', 'apple')).toBe(false);
    expect(
      ehAtalho(evento({ code: 'KeyA', ctrlKey: true, shiftKey: true, altKey: true }), 'A', 'apple'),
    ).toBe(false);
    expect(temModificadorDeAtalho(evento({ ctrlKey: true, shiftKey: true }), 'apple')).toBe(true);
    expect(temModificadorDeAtalho(evento({ altKey: true }), 'apple')).toBe(false);
  });

  it('mostra o atalho certo por sistema', () => {
    expect(rotuloDoAtalho('a', 'outro')).toBe('Alt+A');
    expect(rotuloDoAtalho('a', 'apple')).toBe('⌃⇧A');
    expect(rotuloDoAtalho('ArrowDown', 'apple')).toBe('⌃⇧↓');
    expect(atalhoFalado('r', 'outro')).toBe('Alt R');
    expect(atalhoFalado('r', 'apple')).toBe('Control Shift R');
    expect(atalhoAria('e', 'apple')).toBe('Control+Shift+E');
    expect(atalhoAria('ArrowUp', 'outro')).toBe('Alt+ArrowUp');
  });

  it('detecta o sistema sem falhar', () => {
    expect(['apple', 'outro']).toContain(sistemaDeAtalhos());
  });
});
