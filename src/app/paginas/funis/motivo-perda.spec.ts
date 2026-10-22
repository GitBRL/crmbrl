import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { MotivoPerda } from './motivo-perda';

/** O quadro e o detalhe do negócio (rota filha) têm, cada um, o seu modal ao mesmo tempo. */
@Component({
  imports: [MotivoPerda],
  template: `
    <app-motivo-perda
      class="do-quadro"
      [(aberto)]="quadroAberto"
      negocio="Negócio do quadro"
      (confirmado)="confirmados.push('quadro:' + $event)"
    />
    <app-motivo-perda
      class="do-detalhe"
      [(aberto)]="detalheAberto"
      negocio="Negócio do detalhe"
      (confirmado)="confirmados.push('detalhe:' + $event)"
    />
  `,
})
class DoisModais {
  readonly quadroAberto = signal(false);
  readonly detalheAberto = signal(false);
  readonly confirmados: string[] = [];
}

describe('MotivoPerda', () => {
  it('com dois modais na tela, o botão de confirmar envia o próprio formulário', async () => {
    const fixture = TestBed.createComponent(DoisModais);
    fixture.detectChanges();
    fixture.componentInstance.detalheAberto.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const raiz = fixture.nativeElement as HTMLElement;
    const ids = [...raiz.querySelectorAll('app-motivo-perda form')].map((form) => form.id);
    expect(new Set(ids).size).toBe(2);

    const detalhe = raiz.querySelector('.do-detalhe')!;
    const campo = detalhe.querySelector('textarea')!;
    campo.value = 'Sem orçamento este ano';
    campo.dispatchEvent(new Event('input'));
    const confirmar = [...detalhe.querySelectorAll('button')].find((botao) =>
      botao.textContent?.includes('Marcar como perdido'),
    )!;
    expect(confirmar.form).toBe(detalhe.querySelector('form'));

    confirmar.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.confirmados).toEqual(['detalhe:Sem orçamento este ano']);
    expect(fixture.componentInstance.detalheAberto()).toBe(false);
  });
});
