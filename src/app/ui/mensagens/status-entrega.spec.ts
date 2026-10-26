import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { StatusMensagem } from './mensagens';
import { StatusEntrega } from './status-entrega';

@Component({
  imports: [StatusEntrega],
  template: `<app-status-entrega [status]="status()" />`,
})
class Hospedeiro {
  readonly status = signal<StatusMensagem>('PENDENTE');
}

describe('StatusEntrega', () => {
  it('imagem com nome e forma diferente a cada passo; lida e falha com cor própria', async () => {
    const fixture = TestBed.createComponent(Hospedeiro);
    const host = () => fixture.nativeElement.querySelector('app-status-entrega') as HTMLElement;
    const formas = new Set<string>();
    const esperado: Record<StatusMensagem, string> = {
      PENDENTE: 'Enviando',
      ENVIADA: 'Enviada',
      ENTREGUE: 'Entregue',
      LIDA: 'Lida',
      FALHOU: 'Não enviada',
    };
    for (const status of Object.keys(esperado) as StatusMensagem[]) {
      fixture.componentInstance.status.set(status);
      await fixture.whenStable();
      expect(host().getAttribute('role')).toBe('img');
      expect(host().getAttribute('aria-label')).toBe(esperado[status]);
      expect(host().getAttribute('title')).toBe(esperado[status]);
      formas.add(host().querySelector('svg')?.innerHTML ?? '');
      expect(host().classList.contains('status-entrega--lida')).toBe(status === 'LIDA');
      expect(host().classList.contains('status-entrega--falhou')).toBe(status === 'FALHOU');
    }
    // Entregue e lida têm a mesma forma (dois vistos); a cor é que muda.
    expect(formas.size).toBe(4);
  });
});
