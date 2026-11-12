import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { ConclusaoDeAtividade } from './atividades.api';
import { ResultadoReuniaoModal } from './resultado-reuniao';

@Component({
  imports: [ResultadoReuniaoModal],
  template: `
    <app-resultado-reuniao
      [(aberto)]="aberto"
      reuniao="Apresentação"
      (confirmado)="confirmados.push($event)"
      (cancelado)="cancelamentos = cancelamentos + 1"
    />
  `,
})
class Anfitriao {
  readonly aberto = signal(false);
  readonly confirmados: ConclusaoDeAtividade[] = [];
  cancelamentos = 0;
}

describe('ResultadoReuniaoModal (R6.6)', () => {
  async function abrir() {
    const fixture = TestBed.createComponent(Anfitriao);
    fixture.detectChanges();
    fixture.componentInstance.aberto.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  const raiz = (fixture: { nativeElement: unknown }) => fixture.nativeElement as HTMLElement;
  const confirmar = (fixture: { nativeElement: unknown }) =>
    [...raiz(fixture).querySelectorAll('button')].find((botao) =>
      botao.textContent?.includes('Concluir reunião'),
    )!;
  const escolher = (fixture: { nativeElement: unknown }, rotulo: string) => {
    const opcao = [...raiz(fixture).querySelectorAll('label.opcao')].find((item) =>
      item.textContent?.includes(rotulo),
    )!;
    opcao.querySelector<HTMLInputElement>('input')!.click();
  };

  it('sem escolha, não conclui e pede o resultado', async () => {
    const fixture = await abrir();
    confirmar(fixture).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.confirmados).toEqual([]);
    expect(raiz(fixture).textContent).toContain('Escolha como foi a reunião');
    expect(fixture.componentInstance.aberto()).toBe(true);
  });

  it('Compareceu e Não compareceu mandam só o resultado', async () => {
    const fixture = await abrir();
    escolher(fixture, 'Não compareceu');
    fixture.detectChanges();
    confirmar(fixture).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.confirmados).toEqual([{ resultadoReuniao: 'NAO_COMPARECEU' }]);
    expect(fixture.componentInstance.aberto()).toBe(false);
    expect(fixture.componentInstance.cancelamentos).toBe(0);
  });

  it('Remarcada exige uma nova data no futuro e a manda em ISO', async () => {
    const fixture = await abrir();
    escolher(fixture, 'Remarcada');
    fixture.detectChanges();
    confirmar(fixture).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.confirmados).toEqual([]);
    expect(raiz(fixture).textContent).toContain('Informe a nova data e hora');

    const campo = raiz(fixture).querySelector<HTMLInputElement>('input[type="datetime-local"]')!;
    campo.value = '2020-01-01T10:00';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    confirmar(fixture).click();
    fixture.detectChanges();
    expect(raiz(fixture).textContent).toContain('no futuro');

    const futuro = new Date(Date.now() + 3 * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    campo.value = `${futuro.getFullYear()}-${pad(futuro.getMonth() + 1)}-${pad(futuro.getDate())}T10:00`;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    confirmar(fixture).click();
    fixture.detectChanges();
    const [enviado] = fixture.componentInstance.confirmados;
    expect(enviado?.resultadoReuniao).toBe('REMARCADA');
    expect(new Date(enviado!.novaData!).getTime()).toBeGreaterThan(Date.now());
  });

  it('fechar sem confirmar avisa o cancelamento', async () => {
    const fixture = await abrir();
    const cancelar = [...raiz(fixture).querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Cancelar'),
    )!;
    cancelar.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.cancelamentos).toBe(1);
    expect(fixture.componentInstance.confirmados).toEqual([]);
  });
});
