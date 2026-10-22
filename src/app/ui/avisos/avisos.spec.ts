import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CamadaModal } from '../camada-modal';
import { Avisos, duracaoDoAviso, type Aviso } from './avisos';

@Component({
  imports: [Avisos],
  template: `<app-avisos
    [avisos]="lista()"
    (dispensar)="dispensar($event)"
    (agir)="acoes.push($event)"
  />`,
})
class Hospedeiro {
  readonly lista = signal<readonly Aviso[]>([]);
  readonly acoes: Aviso['id'][] = [];
  dispensar(id: Aviso['id']): void {
    this.lista.update((lista) => lista.filter((aviso) => aviso.id !== id));
  }
}

describe('Avisos', () => {
  const announce = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.useFakeTimers();
    announce.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: LiveAnnouncer, useValue: { announce } }],
    });
  });
  afterEach(() => vi.useRealTimers());

  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector('app-avisos') as HTMLElement;
    const avancar = (ms: number) => {
      vi.advanceTimersByTime(ms);
      fixture.detectChanges();
    };
    const mostrar = (...avisos: Aviso[]) => {
      fixture.componentInstance.lista.update((lista) => [...lista, ...avisos]);
      fixture.detectChanges();
    };
    return { fixture, host, avancar, mostrar, hospedeiro: fixture.componentInstance };
  }

  it('região "Avisos"; cada aviso novo é anunciado (erro de forma assertiva)', () => {
    const { host, mostrar } = criar();
    expect(host.getAttribute('role')).toBe('region');
    expect(host.getAttribute('aria-label')).toBe('Avisos (F8)');
    mostrar({ id: 1, tipo: 'sucesso', mensagem: 'Contato salvo.' });
    mostrar({ id: 2, tipo: 'erro', mensagem: 'O servidor não respondeu.', codigo: 'req-9' });
    expect(host.querySelectorAll('.aviso').length).toBe(2);
    expect(host.querySelector('.aviso--erro')?.textContent).toContain('req-9');
    expect(announce).toHaveBeenNthCalledWith(1, 'Contato salvo.', 'polite');
    expect(announce).toHaveBeenNthCalledWith(2, 'Erro: O servidor não respondeu.', 'assertive');
  });

  it('sai sozinho depois do tempo; o erro fica até fechar', () => {
    const { host, avancar, mostrar } = criar();
    mostrar(
      { id: 1, tipo: 'sucesso', mensagem: 'Contato salvo.' },
      { id: 2, tipo: 'erro', mensagem: 'Falhou.' },
    );
    avancar(4999);
    expect(host.querySelectorAll('.aviso').length).toBe(2);
    avancar(1);
    expect(host.querySelectorAll('.aviso').length).toBe(1);
    avancar(60_000);
    expect(host.querySelector('.aviso--erro')).not.toBeNull();
    (host.querySelector('[aria-label="Fechar aviso"]') as HTMLButtonElement).click();
    avancar(0);
    expect(host.querySelectorAll('.aviso').length).toBe(0);
  });

  it('o tempo para com o mouse em cima e volta ao sair', () => {
    const { host, avancar, mostrar } = criar();
    mostrar({ id: 1, tipo: 'info', mensagem: 'Lista atualizada.' });
    avancar(3000);
    host.dispatchEvent(new MouseEvent('mouseenter'));
    avancar(10_000);
    expect(host.querySelectorAll('.aviso').length).toBe(1);
    host.dispatchEvent(new MouseEvent('mouseleave'));
    avancar(1999);
    expect(host.querySelectorAll('.aviso').length).toBe(1);
    avancar(1);
    expect(host.querySelectorAll('.aviso').length).toBe(0);
  });

  it('a ação emite (agir) e fecha; com ação, o padrão é 20 s', () => {
    const { host, mostrar, hospedeiro } = criar();
    const aviso: Aviso = {
      id: 'a',
      tipo: 'sucesso',
      mensagem: 'Atividade concluída.',
      acao: 'Desfazer',
    };
    expect(duracaoDoAviso(aviso)).toBe(20_000);
    mostrar(aviso);
    expect(announce).toHaveBeenCalledWith(
      'Atividade concluída. Ação disponível nos avisos: Desfazer. F8 leva até ela.',
      'polite',
    );
    const botao = [...host.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Desfazer',
    );
    botao?.click();
    expect(hospedeiro.acoes).toEqual(['a']);
    expect(hospedeiro.lista()).toEqual([]);
  });

  function f8(alvo: EventTarget = document.body) {
    alvo.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'F8', bubbles: true, cancelable: true }),
    );
  }

  it('F8 leva o foco à ação do aviso mais novo; F8 ou Esc devolvem o foco', () => {
    const { host, mostrar } = criar();
    const origem = document.createElement('button');
    document.body.append(origem);
    origem.focus();
    mostrar(
      { id: 1, tipo: 'sucesso', mensagem: 'Etapa movida.', acao: 'Desfazer' },
      { id: 2, tipo: 'info', mensagem: 'Filtro limpo.' },
    );

    f8(origem);
    const desfazer = host.querySelector<HTMLElement>('.aviso__acao')!;
    expect(document.activeElement).toBe(desfazer);
    f8(desfazer);
    expect(document.activeElement).toBe(origem);

    f8(origem);
    expect(document.activeElement).toBe(desfazer);
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    desfazer.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(origem);
    origem.remove();
  });

  it('F8 sem avisos só avisa que não há nenhum', () => {
    criar();
    f8();
    expect(announce).toHaveBeenCalledWith('Nenhum aviso na tela.', 'polite');
  });

  it('depois da ação, o foco volta para onde estava antes do F8', async () => {
    const { host, mostrar, fixture } = criar();
    const origem = document.createElement('button');
    document.body.append(origem);
    origem.focus();
    mostrar({ id: 1, tipo: 'sucesso', mensagem: 'Concluída.', acao: 'Desfazer' });
    f8(origem);
    host.querySelector<HTMLElement>('.aviso__acao')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.querySelector('.aviso')).toBeNull();
    expect(document.activeElement).toBe(origem);
    origem.remove();
  });

  it('com um diálogo modal aberto, a pilha mora dentro dele e volta quando ele fecha', async () => {
    const { host, fixture } = criar();
    await fixture.whenStable();
    const casa = host.parentNode;
    const camada = TestBed.inject(CamadaModal);
    const dialogo = document.createElement('dialog');
    document.body.append(dialogo);
    dialogo.setAttribute('open', '');

    camada.abriu(dialogo);
    expect(host.parentNode).toBe(dialogo);

    dialogo.removeAttribute('open');
    camada.fechou(dialogo);
    expect(host.parentNode).toBe(casa);
    dialogo.remove();
  });
});
