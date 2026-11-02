import { LiveAnnouncer } from '@angular/cdk/a11y';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { AcoesMensagem, type AcaoMensagem } from './acoes-mensagem';
import type { ChatCanal, ChatMembro, ChatMensagem, ChatPessoa } from './chat.tipos';
import { ANA, assentar, BRUNO, canal, entrarNoChat, membro, mensagem } from './dados-de-teste';
import { DetalhesCanal } from './detalhes-canal';

@Component({
  imports: [DetalhesCanal],
  template: `<app-chat-detalhes-canal
    [(aberto)]="aberto"
    [canal]="canal()"
    [membros]="membros()"
    [eu]="eu"
    (alterado)="alterados.push($event)"
    (membrosAlterados)="recargas = recargas + 1"
    (saiu)="saidas = saidas + 1"
  />`,
})
class Hospedeiro {
  readonly aberto = signal(true);
  readonly canal = signal<ChatCanal>(canal());
  readonly membros = signal<readonly ChatMembro[] | null>(null);
  eu = '';
  readonly alterados: ChatCanal[] = [];
  recargas = 0;
  saidas = 0;
}

describe('DetalhesCanal (chat)', () => {
  let http: HttpTestingController;
  let eu: ChatPessoa;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LiveAnnouncer, useValue: { announce: () => Promise.resolve() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    eu = entrarNoChat('COMERCIAL');
  });
  afterEach(() => http.verify());

  async function criar(ajustes: (h: Hospedeiro) => void) {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.componentInstance.eu = eu.id;
    fixture.componentInstance.membros.set([
      membro(eu, { administrador: true }),
      membro(ANA),
      membro(BRUNO),
    ]);
    ajustes(fixture.componentInstance);
    await fixture.whenStable();
    return {
      fixture,
      hospedeiro: fixture.componentInstance,
      raiz: fixture.nativeElement as HTMLElement,
    };
  }

  const botao = (raiz: HTMLElement, texto: string) =>
    [...raiz.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.replace(/\s+/g, ' ').includes(texto),
    )!;

  it('grupo que você administra: pessoas (você primeiro), editar, adicionar, arquivar e sair', async () => {
    const { raiz } = await criar((h) =>
      h.canal.set(canal({ podeGerenciar: true, administrador: true, descricao: 'Combinados' })),
    );
    expect([...raiz.querySelectorAll('.membro__nome')].map((n) => n.textContent?.trim())).toEqual([
      'João Batista (você)',
      'Ana Lima',
      'Bruno Tavares',
    ]);
    expect(raiz.querySelector('.detalhes__contagem')?.textContent).toContain('3, 1 online');
    expect(raiz.querySelectorAll('.membro app-menu-acoes')).toHaveLength(2);
    expect(raiz.querySelector<HTMLInputElement>('app-campo-texto input')?.value).toBe('Lançamento');
    expect(botao(raiz, 'Adicionar pessoas')).toBeTruthy();
    expect(botao(raiz, 'Arquivar')).toBeTruthy();
    expect(botao(raiz, 'Sair do grupo')).toBeTruthy();
  });

  it('Geral e áreas: só leitura, com o aviso de que quem participa é definido pelo papel', async () => {
    const { raiz } = await criar((h) =>
      h.canal.set(canal({ tipo: 'GERAL', nome: 'Geral', podeSair: false, automatico: true })),
    );
    expect(raiz.textContent).toContain('Quem participa é definido pelo papel');
    expect(raiz.querySelector('app-campo-texto')).toBeNull();
    expect(raiz.querySelector('.membro app-menu-acoes')).toBeNull();
    expect(botao(raiz, 'Sair do grupo')).toBeUndefined();
  });

  it('conversa direta: a outra pessoa e o aviso de privacidade', async () => {
    const { raiz } = await criar((h) =>
      h.canal.set(canal({ tipo: 'DIRETO', nome: 'Ana Lima', outraPessoa: ANA, podeSair: false })),
    );
    expect(raiz.querySelector('.detalhes__pessoa-nome')?.textContent).toBe('Ana Lima');
    expect(raiz.querySelector('.detalhes__pessoa-papel')?.textContent).toContain('online agora');
    expect(raiz.textContent).toContain('só vocês dois leem as mensagens');
    expect(raiz.querySelector('.membro')).toBeNull();
  });

  it('silenciar manda a preferência e devolve o canal novo', async () => {
    const { fixture, hospedeiro, raiz } = await criar(() => undefined);
    raiz.querySelector<HTMLInputElement>('app-alternador input')!.click();
    await fixture.whenStable();
    const pedido = http.expectOne('/api/v1/chat/canais/c1/preferencias');
    expect(pedido.request.method).toBe('PUT');
    expect(pedido.request.body).toEqual({ silenciado: true });
    pedido.flush(canal({ silenciado: true }));
    await assentar();
    expect(hospedeiro.alterados.at(-1)?.silenciado).toBe(true);
  });

  it('sair do grupo pede confirmação e avisa a página', async () => {
    vi.spyOn(TestBed.inject(ConfirmacaoService), 'confirmar').mockImplementation(async (pedido) => {
      await pedido.executar?.();
      return true;
    });
    const { fixture, hospedeiro, raiz } = await criar(() => undefined);
    botao(raiz, 'Sair do grupo').click();
    await assentar();
    http
      .expectOne('/api/v1/chat/canais/c1/sair')
      .flush(null, { status: 204, statusText: 'No Content' });
    await assentar();
    await fixture.whenStable();
    expect(hospedeiro.saidas).toBe(1);
    expect(hospedeiro.aberto()).toBe(false);
  });

  it('renomear o grupo envia nome e descrição aparados', async () => {
    const { fixture, hospedeiro, raiz } = await criar((h) =>
      h.canal.set(canal({ podeGerenciar: true, administrador: true })),
    );
    const nome = raiz.querySelector<HTMLInputElement>('app-campo-texto input')!;
    nome.value = '  Lançamento 2  ';
    nome.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    botao(raiz, 'Salvar').click();
    await fixture.whenStable();
    const pedido = http.expectOne('/api/v1/chat/canais/c1');
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).toEqual({ nome: 'Lançamento 2', descricao: null });
    pedido.flush(canal({ nome: 'Lançamento 2' }));
    await assentar();
    expect(hospedeiro.alterados.at(-1)?.nome).toBe('Lançamento 2');
  });
});

@Component({
  imports: [AcoesMensagem],
  template: `<div style="position: relative; height: 400px">
    <div class="lista__item" data-chave="m:m1"><div class="bolha">Da Ana</div></div>
    <div class="lista__item" data-chave="m:m2"><div class="bolha">Minha</div></div>
    <div class="lista__item" data-chave="m:s1"><div class="bolha">Aviso</div></div>
    <app-chat-acoes-mensagem [mensagens]="mensagens" eu="u-eu" (acao)="acoes.push($event)" />
  </div>`,
})
class HospedeiroAcoes {
  readonly mensagens: readonly ChatMensagem[] = [
    mensagem({ id: 'm1', texto: 'Da Ana' }),
    mensagem({ id: 'm2', texto: 'Minha', autor: { ...ANA, id: 'u-eu' } }),
    mensagem({ id: 's1', autor: null, sistema: true }),
  ];
  readonly acoes: AcaoMensagem[] = [];
}

describe('AcoesMensagem (chat)', () => {
  async function passarPor(
    fixture: { nativeElement: HTMLElement; whenStable(): Promise<unknown> },
    chave: string,
  ) {
    const bolha = fixture.nativeElement.querySelector(`[data-chave="${chave}"] .bolha`)!;
    bolha.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }));
    await new Promise((resolver) => requestAnimationFrame(() => resolver(undefined)));
    await fixture.whenStable();
    return [...fixture.nativeElement.querySelectorAll('.acoes button')].map((b) =>
      b.getAttribute('aria-label'),
    );
  }

  it('na de outra pessoa: responder e copiar; na própria: também editar e excluir; no aviso: nada', async () => {
    const fixture = TestBed.createComponent(HospedeiroAcoes);
    await fixture.whenStable();
    await assentar();
    expect(await passarPor(fixture, 'm:m1')).toEqual(['Responder', 'Copiar o texto']);
    expect(await passarPor(fixture, 'm:m2')).toEqual([
      'Responder',
      'Editar',
      'Copiar o texto',
      'Excluir',
    ]);
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.acoes button[aria-label="Editar"]')!
      .click();
    expect(fixture.componentInstance.acoes).toEqual([
      { tipo: 'editar', mensagem: fixture.componentInstance.mensagens[1] },
    ]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.acoes')).toBeNull();
  });
});
