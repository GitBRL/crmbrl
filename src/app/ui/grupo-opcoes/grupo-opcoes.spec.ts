import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { GrupoOpcoes, type OpcaoGrupo } from './grupo-opcoes';

@Component({
  imports: [ReactiveFormsModule, GrupoOpcoes],
  template: `<app-grupo-opcoes
    rotulo="Tipo"
    [disposicao]="disposicao"
    [opcoes]="tipos"
    [formControl]="tipo"
  />`,
})
class Hospedeiro {
  disposicao: 'lista' | 'pilulas' = 'lista';
  readonly tipos: OpcaoGrupo<string>[] = [
    { valor: 'ligacao', rotulo: 'Ligação', dica: 'Conversa por telefone.' },
    { valor: 'reuniao', rotulo: 'Reunião' },
    { valor: 'tarefa', rotulo: 'Tarefa', desabilitada: true },
  ];
  readonly tipo = new FormControl<string | null>(null, Validators.required);
}

describe('GrupoOpcoes', () => {
  async function criar(disposicao: 'lista' | 'pilulas' = 'lista') {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.componentInstance.disposicao = disposicao;
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const grupo = raiz.querySelector('[role="radiogroup"]') as HTMLElement;
    const radios = [...raiz.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    return { fixture, raiz, grupo, radios, hospedeiro: fixture.componentInstance };
  }

  it('radiogroup nomeado pelo rótulo; rádios com o mesmo name, nome e descrição próprios', async () => {
    const { raiz, grupo, radios } = await criar();
    expect(
      raiz.querySelector(`#${grupo.getAttribute('aria-labelledby')}`)?.textContent?.trim(),
    ).toBe('Tipo');
    expect(grupo.getAttribute('aria-required')).toBe('true');
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
    expect(raiz.querySelector(`#${radios[0].getAttribute('aria-labelledby')}`)?.textContent).toBe(
      'Ligação',
    );
    expect(raiz.querySelector(`#${radios[0].getAttribute('aria-describedby')}`)?.textContent).toBe(
      'Conversa por telefone.',
    );
    expect(radios[2].disabled).toBe(true);
  });

  it('escolher muda o valor; tocado sem escolha, pede uma', async () => {
    const { fixture, raiz, grupo, radios, hospedeiro } = await criar();
    radios[0].dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(grupo.getAttribute('aria-invalid')).toBe('true');
    expect(raiz.textContent).toContain('Escolha uma opção.');

    radios[1].click();
    await fixture.whenStable();
    expect(hospedeiro.tipo.value).toBe('reuniao');
    expect(radios[1].checked).toBe(true);
  });

  it('pílulas: a escolhida ganha a classe marcada', async () => {
    const { fixture, raiz, hospedeiro } = await criar('pilulas');
    hospedeiro.tipo.setValue('ligacao');
    await fixture.whenStable();
    expect(raiz.querySelector('.grupo__opcoes--pilulas')).not.toBeNull();
    expect(raiz.querySelector('.opcao--marcada')?.textContent).toContain('Ligação');
  });
});
