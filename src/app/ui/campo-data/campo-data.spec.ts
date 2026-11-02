import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { CampoData, isoParaLocal, localParaIso } from './campo-data';

@Component({
  imports: [ReactiveFormsModule, CampoData],
  template: `<app-campo-data rotulo="Quando" tipo="data-hora" [formControl]="quando" />`,
})
class Hospedeiro {
  readonly quando = new FormControl<string | null>('2026-10-21T10:00');
}

describe('CampoData', () => {
  it('usa o input nativo de data e hora e devolve o texto local', async () => {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    const campo = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    expect(campo.type).toBe('datetime-local');
    expect(campo.value).toBe('2026-10-21T10:00');

    campo.value = '2026-10-22T09:30';
    campo.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.quando.value).toBe('2026-10-22T09:30');

    campo.value = '';
    campo.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.quando.value).toBeNull();
  });

  it('converte entre o valor local e o ISO em UTC da API', () => {
    const iso = localParaIso('2026-10-21T10:00', 'data-hora');
    expect(iso).toBe(new Date(2026, 9, 21, 10, 0).toISOString());
    expect(isoParaLocal(iso, 'data-hora')).toBe('2026-10-21T10:00');
    expect(isoParaLocal(localParaIso('2026-10-21'), 'data')).toBe('2026-10-21');
    expect(localParaIso(null)).toBeNull();
    expect(isoParaLocal('não é data')).toBeNull();
  });
});
