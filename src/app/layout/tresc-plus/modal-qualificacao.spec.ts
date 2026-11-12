import { TestBed } from '@angular/core/testing';

import { AvisosService } from '../../nucleo/avisos.service';
import { TrescPlusApi } from '../../nucleo/tresc-plus/tresc-plus.api';
import { trescServiceFalso } from '../../nucleo/tresc-plus/tresc-plus-de-teste';
import { TrescPlusService } from '../../nucleo/tresc-plus/tresc-plus.service';
import { ModalQualificacao } from './modal-qualificacao';

const QUALIFICACOES = [
  { id: 1, nome: 'Interessado', cor: '#00aa66', conversao: true, permiteAgendar: false },
  { id: 2, nome: 'Retornar depois', cor: '#ccaa00', conversao: false, permiteAgendar: true },
];

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
}

describe('ModalQualificacao', () => {
  let falso: ReturnType<typeof trescServiceFalso>;
  let api: { qualificacoes: ReturnType<typeof vi.fn>; qualificar: ReturnType<typeof vi.fn> };

  async function abrir() {
    const fixture = TestBed.createComponent(ModalQualificacao);
    fixture.detectChanges();
    falso.qualificacaoPendente.set({ ligacaoId: 'l1', campanhaId: 1 });
    falso.modalQualificacaoAberto.set(true);
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    falso = trescServiceFalso();
    api = {
      qualificacoes: vi.fn(() => Promise.resolve(QUALIFICACOES)),
      qualificar: vi.fn(() => Promise.resolve({})),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: TrescPlusService, useValue: falso },
        { provide: TrescPlusApi, useValue: api },
      ],
    });
  });

  it('lista as qualificações da ligação com a cor', async () => {
    const fixture = await abrir();
    expect(api.qualificacoes).toHaveBeenCalledWith('l1');
    const opcoes = fixture.nativeElement.querySelectorAll('.qual__opcao');
    expect(opcoes.length).toBe(2);
    expect(opcoes[0].textContent).toContain('Interessado');
    expect(opcoes[0].textContent).toContain('Conversão');
    expect(fixture.nativeElement.querySelector('.qual__cor').style.background).not.toBe('');
  });

  it('Qualificar fica desabilitado até escolher', async () => {
    const fixture = await abrir();
    const botao = [...fixture.nativeElement.querySelectorAll('[modal-rodape] button')].find((b) =>
      (b as HTMLElement).textContent?.includes('Qualificar'),
    ) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
  });

  it('só mostra o agendamento nas qualificações que permitem', async () => {
    const fixture = await abrir();
    const radios = fixture.nativeElement.querySelectorAll(
      'input[type=radio]',
    ) as NodeListOf<HTMLInputElement>;
    expect(fixture.nativeElement.querySelector('app-campo-data')).toBeNull();
    radios[1].click();
    radios[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-campo-data')).not.toBeNull();
    radios[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-campo-data')).toBeNull();
  });

  it('envia a qualificação com a observação e limpa a pendência', async () => {
    const fixture = await abrir();
    const radios = fixture.nativeElement.querySelectorAll(
      'input[type=radio]',
    ) as NodeListOf<HTMLInputElement>;
    radios[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const area = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    area.value = 'Quer proposta';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const aviso = vi.spyOn(TestBed.inject(AvisosService), 'sucesso');
    const botao = [...fixture.nativeElement.querySelectorAll('[modal-rodape] button')].find((b) =>
      (b as HTMLElement).textContent?.includes('Qualificar'),
    ) as HTMLButtonElement;
    botao.click();
    await microtarefas();
    expect(api.qualificar).toHaveBeenCalledWith('l1', {
      qualificacaoId: 1,
      observacao: 'Quer proposta',
    });
    expect(falso.qualificada).toHaveBeenCalled();
    expect(aviso).toHaveBeenCalledWith('Ligação qualificada.');
  });

  it('erro ao carregar mostra a mensagem e permite tentar de novo', async () => {
    api.qualificacoes.mockRejectedValueOnce(new Error('x'));
    const fixture = await abrir();
    expect(fixture.nativeElement.querySelector('.qual__erro')).not.toBeNull();
    const tentar = [...fixture.nativeElement.querySelectorAll('.qual button')].find((b) =>
      (b as HTMLElement).textContent?.includes('Tentar de novo'),
    ) as HTMLButtonElement;
    tentar.click();
    await microtarefas();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.qual__opcao').length).toBe(2);
  });

  it('Depois fecha sem qualificar', async () => {
    const fixture = await abrir();
    const depois = [...fixture.nativeElement.querySelectorAll('[modal-rodape] button')].find((b) =>
      (b as HTMLElement).textContent?.includes('Depois'),
    ) as HTMLButtonElement;
    depois.click();
    expect(falso.fecharModalQualificacao).toHaveBeenCalled();
    expect(api.qualificar).not.toHaveBeenCalled();
  });
});
