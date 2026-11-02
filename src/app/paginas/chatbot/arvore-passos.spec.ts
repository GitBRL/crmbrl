import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { ArvorePassos } from './arvore-passos';
import type { PassoDefinicao, TipoDePasso } from './chatbot.tipos';
import { ContextoEditor } from './contexto-editor';
import { novoPasso } from './definicao';

const catalogo: TipoDePasso[] = [
  {
    tipo: 'mensagem',
    rotulo: 'Enviar mensagem',
    grupo: 'conversa',
    descricao: 'x',
    ramos: 'nenhum',
    esperaResposta: false,
    exemplo: {},
  },
  {
    tipo: 'pergunta.opcoes',
    rotulo: 'Perguntar com opções',
    grupo: 'conversa',
    descricao: 'x',
    ramos: 'opcoes',
    esperaResposta: true,
    exemplo: {},
  },
  {
    tipo: 'encerrar',
    rotulo: 'Encerrar',
    grupo: 'fim',
    descricao: 'x',
    ramos: 'nenhum',
    esperaResposta: false,
    exemplo: {},
  },
];

@Component({
  imports: [ArvorePassos],
  providers: [ContextoEditor],
  template: `<app-arvore-passos [(passos)]="passos" />`,
})
class Hospedeiro {
  readonly passos = signal<readonly PassoDefinicao[]>([]);
}

describe('ArvorePassos', () => {
  function criar(inicial: PassoDefinicao[] = []) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.componentInstance.passos.set(inicial);
    const ctx = fixture.debugElement.injector.get(ContextoEditor);
    ctx.catalogo.set(catalogo);
    fixture.detectChanges();
    return { fixture, ctx, el: fixture.nativeElement as HTMLElement };
  }

  it('adiciona um passo pelo menu agrupado e abre os campos', () => {
    const { fixture, el } = criar();
    el.querySelector<HTMLButtonElement>('.lista__adicionar')!.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Conversar com o cliente');
    el.querySelectorAll<HTMLButtonElement>('.adicionar__item')[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.passos()).toHaveLength(1);
    expect(fixture.componentInstance.passos()[0].tipo).toBe('mensagem');
    expect(el.textContent).toContain('Mensagem do robô');
    expect(el.textContent).toContain('Falta preencher');
  });

  it('mostra um caminho por opção da pergunta e permite adicionar passos dentro dele', () => {
    const pergunta = novoPasso('pergunta.opcoes');
    const { fixture, el } = criar([pergunta]);
    const titulos = Array.from(el.querySelectorAll('.ramo__titulo')).map((t) => t.textContent);
    expect(titulos).toHaveLength(2);
    expect(titulos[0]).toContain('Se o cliente escolher');
    const botoes = Array.from(el.querySelectorAll<HTMLButtonElement>('.lista__adicionar')).filter(
      (b) => b.textContent?.includes('neste caminho'),
    );
    expect(botoes).toHaveLength(2);
    botoes[0].click();
    fixture.detectChanges();
    const itens = Array.from(el.querySelectorAll<HTMLButtonElement>('.adicionar__item'));
    itens.find((i) => i.textContent?.includes('Encerrar'))!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.passos()[0].ramos![0].passos[0].tipo).toBe('encerrar');
  });

  it('sobe e desce passos pelos botões', () => {
    const a = { ...novoPasso('mensagem'), config: { texto: 'A' } };
    const b = { ...novoPasso('mensagem'), config: { texto: 'B' } };
    const { fixture, el } = criar([a, b]);
    el.querySelector<HTMLButtonElement>('[data-passo="' + b.id + '"] [data-acao="subir"]')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.passos().map((p) => p.id)).toEqual([b.id, a.id]);
  });

  it('somente leitura não oferece adicionar nem remover', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    @Component({
      imports: [ArvorePassos],
      providers: [ContextoEditor],
      template: `<app-arvore-passos [passos]="passos" [somenteLeitura]="true" />`,
    })
    class Leitura {
      passos = [novoPasso('mensagem')];
    }
    const fixture = TestBed.createComponent(Leitura);
    fixture.debugElement.injector.get(ContextoEditor).catalogo.set(catalogo);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.lista__adicionar')).toBeNull();
    expect(el.querySelector('[data-acao="subir"]')).toBeNull();
  });
});
