import { TestBed } from '@angular/core/testing';

import { TrescPlusApi } from '../../nucleo/tresc-plus/tresc-plus.api';
import { ModalDiscador } from './modal-discador';

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 15; i++) {
    await Promise.resolve();
  }
}

function escolher(el: HTMLElement, indice: number, opcao: number): void {
  const select = el.querySelectorAll('select')[indice] as HTMLSelectElement;
  select.selectedIndex = opcao;
  select.dispatchEvent(new Event('change'));
}

describe('ModalDiscador', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  async function abrir(negocios = ['n1', 'n2']) {
    const fixture = TestBed.createComponent(ModalDiscador);
    fixture.componentRef.setInput('negocioIds', negocios);
    fixture.componentRef.setInput('aberto', true);
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
    return fixture;
  }

  const enviar = (el: HTMLElement) =>
    [...el.querySelectorAll('[modal-rodape] button')].find((b) =>
      b.textContent?.includes('Enviar'),
    ) as HTMLButtonElement;

  beforeEach(() => {
    api = {
      campanhas: vi.fn(() =>
        Promise.resolve([
          { id: 1, nome: 'Prospecção Demo' },
          { id: 2, nome: 'Retomada Demo' },
        ]),
      ),
      listas: vi.fn(() => Promise.resolve([{ id: 10, nome: 'Lista A' }])),
      enviarAoDiscador: vi.fn(() =>
        Promise.resolve({
          envioId: 'e1',
          campanhaId: 1,
          listaId: 10,
          listaNome: 'Lista A',
          enviados: 2,
          importados: 1,
          filtrados: 1,
          detalhes: [
            { identifier: 'n2', telefone: '5511900000000', motivo: 'Número na lista de bloqueio.' },
          ],
        }),
      ),
    };
    TestBed.configureTestingModule({ providers: [{ provide: TrescPlusApi, useValue: api }] });
  });

  it('carrega as campanhas e o botão começa desabilitado', async () => {
    const fixture = await abrir();
    const el = fixture.nativeElement as HTMLElement;
    expect(api['campanhas']).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain('Envia 2 negócios');
    expect(enviar(el).disabled).toBe(true);
  });

  it('escolhendo campanha e lista, envia e mostra o relatório com o motivo', async () => {
    const fixture = await abrir();
    const el = fixture.nativeElement as HTMLElement;
    escolher(el, 0, 1);
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
    expect(api['listas']).toHaveBeenCalledWith(1);
    escolher(el, 1, 1);
    fixture.detectChanges();
    expect(enviar(el).disabled).toBe(false);
    enviar(el).click();
    await microtarefas();
    fixture.detectChanges();
    expect(api['enviarAoDiscador']).toHaveBeenCalledWith({
      campanhaId: 1,
      listaId: 10,
      negocioIds: ['n1', 'n2'],
    });
    expect(el.textContent).toContain('1 importado');
    expect(el.textContent).toContain('1 filtrado');
    expect(el.textContent).toContain('Número na lista de bloqueio.');
  });

  it('lista nova exige o nome e envia nomeLista', async () => {
    const fixture = await abrir();
    const el = fixture.nativeElement as HTMLElement;
    escolher(el, 0, 1);
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
    (el.querySelectorAll('input[type=radio]')[1] as HTMLInputElement).dispatchEvent(
      new Event('change'),
    );
    fixture.detectChanges();
    expect(enviar(el).disabled).toBe(true);
    const nome = el.querySelector('app-campo-texto input') as HTMLInputElement;
    nome.value = 'Lista nova';
    nome.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    enviar(el).click();
    await microtarefas();
    expect(api['enviarAoDiscador']).toHaveBeenCalledWith({
      campanhaId: 1,
      nomeLista: 'Lista nova',
      negocioIds: ['n1', 'n2'],
    });
  });

  it('erro ao carregar as campanhas mostra a mensagem', async () => {
    api['campanhas'].mockRejectedValue(new Error('x'));
    const fixture = await abrir();
    expect(fixture.nativeElement.querySelector('[role=alert]')).not.toBeNull();
  });

  it('erro ao enviar mostra a mensagem e mantém o formulário', async () => {
    api['enviarAoDiscador'].mockRejectedValue(new Error('x'));
    const fixture = await abrir();
    const el = fixture.nativeElement as HTMLElement;
    escolher(el, 0, 1);
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
    escolher(el, 1, 1);
    fixture.detectChanges();
    enviar(el).click();
    await microtarefas();
    fixture.detectChanges();
    expect(el.querySelector('.disc__erro')).not.toBeNull();
    expect(enviar(el)).toBeTruthy();
  });
});
