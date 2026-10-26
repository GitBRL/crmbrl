import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import { microtarefas } from '../canais/dados-de-teste';
import { horarioComercial } from './apresentacao';
import { canalDoAtendimento } from './dados-de-teste';
import { Horarios, MENSAGEM_FORA_SUGERIDA } from './horarios';

describe('Horário e satisfação (R12)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Horarios>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;
  const painel = () => document.querySelector('app-painel-lateral') as HTMLElement;

  async function criar(
    canais = [
      canalDoAtendimento(),
      canalDoAtendimento({
        id: 'c-site',
        tipo: 'WEBCHAT',
        nome: 'Site institucional',
        horarioAtendimento: horarioComercial(),
        situacaoHorario: {
          aberto: false,
          proximaAbertura: '2026-10-27T11:00:00.000Z',
          proximoFechamento: null,
        },
        mensagemForaHorario: 'Voltamos às 8h.',
        pesquisaSatisfacao: true,
      }),
    ],
    papel: Parameters<typeof entrarComo>[0] = 'ADMIN',
    canal?: string,
  ) {
    entrarComo(papel);
    fixture = TestBed.createComponent(Horarios);
    if (canal) {
      fixture.componentRef.setInput('canal', canal);
    }
    fixture.detectChanges();
    http.expectOne('/api/v1/atendimento/canais').flush(canais);
    http
      .expectOne('/api/v1/atendimento/filas')
      .flush([{ id: 'f-com', nome: 'Comercial — WhatsApp', area: 'COMERCIAL' }]);
    await microtarefas();
    fixture.detectChanges();
  }

  it('lista cada canal com a situação, o horário e o que responde', async () => {
    await criar();
    const canais = raiz().querySelectorAll('.canal');
    expect(canais).toHaveLength(2);
    expect(canais[0].textContent).toContain('Sempre aberto');
    expect(canais[0].textContent).toContain('Não responde fora do horário');
    expect(canais[1].textContent).toContain('Seg a Sex, 08:00–18:00');
    expect(canais[1].textContent).toContain('Fechado agora');
    expect(canais[1].textContent).toContain('Pesquisa de satisfação ligada');
  });

  it('?canal= abre o painel; passar para horário definido e responder fora do horário', async () => {
    await criar(undefined, 'ADMIN', 'c-wa-1');
    expect(painel().textContent).toContain('Comercial — principal');
    const definido = Array.from(
      painel().querySelectorAll<HTMLInputElement>('input[type=radio]'),
    ).find((r) => r.closest('label')?.textContent?.includes('Horário definido'))!;
    definido.click();
    fixture.detectChanges();
    expect(painel().querySelectorAll('app-editor-horario .dia')).toHaveLength(7);
    const fora = Array.from(painel().querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Responder sozinho fora do horário'),
    )!;
    painel()
      .querySelector<HTMLInputElement>(`#${CSS.escape(fora.getAttribute('for')!)}`)!
      .click();
    fixture.detectChanges();
    expect(painel().querySelector<HTMLTextAreaElement>('textarea')!.value).toBe(
      MENSAGEM_FORA_SUGERIDA,
    );

    painel()
      .querySelector<HTMLFormElement>('#formulario-horario')!
      .dispatchEvent(new Event('submit'));
    const pedido = http.expectOne('/api/v1/atendimento/canais/c-wa-1');
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).toEqual({
      horarioAtendimento: horarioComercial(),
      mensagemForaHorario: MENSAGEM_FORA_SUGERIDA,
    });
    pedido.flush(
      canalDoAtendimento({
        horarioAtendimento: horarioComercial(),
        mensagemForaHorario: MENSAGEM_FORA_SUGERIDA,
      }),
    );
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('.canal')?.textContent).toContain('Seg a Sex, 08:00–18:00');
  });

  it('o editor da semana: abre o sábado, acusa fim antes do início e não deixa salvar', async () => {
    await criar();
    (fixture.componentInstance as unknown as { abrir(c: unknown): void }).abrir(
      canalDoAtendimento({ id: 'c-site', horarioAtendimento: horarioComercial() }),
    );
    fixture.detectChanges();
    const dias = painel().querySelectorAll<HTMLElement>('app-editor-horario .dia');
    const sabado = dias[5];
    expect(sabado.textContent).toContain('Fechado');
    sabado.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    fixture.detectChanges();
    const horas = painel()
      .querySelectorAll<HTMLElement>('app-editor-horario .dia')[5]
      .querySelectorAll<HTMLInputElement>('input[type=time]');
    expect(horas[0].value).toBe('08:00');
    horas[1].value = '07:00';
    horas[1].dispatchEvent(new Event('input'));
    horas[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(painel().textContent).toContain('precisa ser depois do início');
    painel()
      .querySelector<HTMLFormElement>('#formulario-horario')!
      .dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    http.expectNone('/api/v1/atendimento/canais/c-site');
    expect(painel().textContent).toContain('Confira os horários marcados.');
  });

  it('líder vê sem poder alterar', async () => {
    await criar([canalDoAtendimento({ podeEditar: false })], 'LIDER_COMERCIAL');
    expect(raiz().textContent).toContain('Só Admin e C-level alteram');
    const ver = Array.from(raiz().querySelectorAll<HTMLButtonElement>('.canal button')).find((b) =>
      b.textContent?.includes('Ver'),
    )!;
    ver.click();
    fixture.detectChanges();
    expect(
      Array.from(painel().querySelectorAll('button')).some((b) =>
        b.textContent?.includes('Salvar'),
      ),
    ).toBe(false);
    expect(painel().querySelector<HTMLInputElement>('input[type=radio]')!.disabled).toBe(true);
  });
});
