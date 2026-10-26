import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BolhaMensagem, type NomesNasBolhas } from './bolha-mensagem';
import type { MensagemConversa } from './mensagens';

const MARIA = { id: 'c1', nome: 'Maria Souza' };
const ANA = { id: 'u1', nome: 'Ana Ribeiro' };
const QUANDO = new Date(2026, 9, 23, 10, 32);

@Component({
  imports: [BolhaMensagem],
  template: `<app-bolha-mensagem
    [mensagem]="mensagem()"
    [continuacao]="continuacao()"
    [seguida]="seguida()"
    [nomes]="nomes()"
    (tentarDeNovo)="tentativas.push($event.id)"
  />`,
})
class Hospedeiro {
  readonly mensagem = signal<MensagemConversa>({
    id: '1',
    direcao: 'ENTRADA',
    tipo: 'TEXTO',
    texto: 'Oi!',
    criadaEm: QUANDO,
    autor: MARIA,
  });
  readonly continuacao = signal(false);
  readonly seguida = signal(false);
  readonly nomes = signal<NomesNasBolhas>('entrada');
  readonly tentativas: string[] = [];
}

describe('BolhaMensagem', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  async function criar(
    dados: Partial<MensagemConversa> = {},
    ajustes: Partial<{ continuacao: boolean; seguida: boolean; nomes: NomesNasBolhas }> = {},
  ) {
    const fixture = TestBed.createComponent(Hospedeiro);
    const hospedeiro = fixture.componentInstance;
    hospedeiro.mensagem.update((atual) => ({ ...atual, ...dados }));
    if (ajustes.continuacao !== undefined) hospedeiro.continuacao.set(ajustes.continuacao);
    if (ajustes.seguida !== undefined) hospedeiro.seguida.set(ajustes.seguida);
    if (ajustes.nomes) hospedeiro.nomes.set(ajustes.nomes);
    await fixture.whenStable();
    const host = fixture.nativeElement.querySelector('app-bolha-mensagem') as HTMLElement;
    return { fixture, hospedeiro, host };
  }

  it('entrada: à esquerda, com nome, avatar, hora e o autor dito ao leitor de tela', async () => {
    const { host } = await criar();
    expect(host.classList).toContain('bolha-mensagem--entrada');
    expect(host.querySelector('.bolha__autor')?.textContent).toBe('Maria Souza');
    expect(host.querySelector('app-avatar')).not.toBeNull();
    expect(host.querySelector('.bolha > .visualmente-oculto')?.textContent).toBe('Maria Souza:');
    const hora = host.querySelector('.bolha__meta time');
    expect(hora?.textContent).toBe('10:32');
    expect(hora?.getAttribute('datetime')).toBe(QUANDO.toISOString());
    expect(host.querySelector('app-status-entrega')).toBeNull();
  });

  it('grupo: o nome só na primeira, o avatar só na última (as do meio ficam recuadas)', async () => {
    const meio = await criar({}, { continuacao: true, seguida: true });
    expect(meio.host.querySelector('.bolha__autor')).toBeNull();
    expect(meio.host.querySelector('app-avatar')).toBeNull();
    expect(meio.host.classList).toContain('bolha-mensagem--continuacao');
    expect(meio.host.classList).toContain('bolha-mensagem--recuo');
  });

  it('saída: status de entrega ao lado da hora; o nome aparece com nomes="saida"', async () => {
    const { host } = await criar(
      { direcao: 'SAIDA', autor: ANA, status: 'LIDA' },
      { nomes: 'saida' },
    );
    expect(host.classList).toContain('bolha-mensagem--saida');
    expect(host.querySelector('.bolha__autor')?.textContent).toBe('Ana Ribeiro');
    expect(host.querySelector('app-avatar')).toBeNull();
    const status = host.querySelector('.bolha__meta app-status-entrega');
    expect(status?.getAttribute('aria-label')).toBe('Lida');
  });

  it('falha: mostra o motivo e "Tentar de novo" emite a mensagem', async () => {
    const { fixture, hospedeiro, host } = await criar({
      direcao: 'SAIDA',
      autor: ANA,
      status: 'FALHOU',
      erro: 'O WhatsApp não aceitou a mensagem.',
    });
    expect(host.querySelector('.bolha__falha-motivo')?.textContent?.trim()).toBe(
      'O WhatsApp não aceitou a mensagem.',
    );
    const botao = host.querySelector<HTMLButtonElement>('.bolha__falha button')!;
    expect(botao.textContent?.trim()).toBe('Tentar de novo');
    botao.click();
    await fixture.whenStable();
    expect(hospedeiro.tentativas).toEqual(['1']);
  });

  it('falha sem motivo usa uma frase padrão', async () => {
    const { host } = await criar({ direcao: 'SAIDA', status: 'FALHOU', erro: null });
    expect(host.querySelector('.bolha__falha-motivo')?.textContent?.trim()).toBe(
      'Não foi possível enviar.',
    );
  });

  it('nota interna: rótulo "Nota interna · autor" e o prefixo falado próprio', async () => {
    const { host } = await criar({ direcao: 'INTERNA', autor: ANA, texto: 'Ligar amanhã' });
    expect(host.classList).toContain('bolha-mensagem--nota');
    expect(host.querySelector('.bolha__nota')?.textContent?.trim()).toBe(
      'Nota interna · Ana Ribeiro',
    );
    expect(host.querySelector('.bolha > .visualmente-oculto')?.textContent).toBe(
      'Nota interna de Ana Ribeiro:',
    );
    expect(host.querySelector('.bolha__autor')).toBeNull();
  });

  it('sistema: uma linha centralizada, sem bolha', async () => {
    const { host } = await criar({
      direcao: 'SISTEMA',
      texto: 'Conversa transferida',
      autor: null,
    });
    expect(host.querySelector('.bolha')).toBeNull();
    expect(host.querySelector('.bolha-sistema')?.textContent).toContain('Conversa transferida');
    expect(host.querySelector('.bolha-sistema time')?.textContent).toBe('10:32');
  });

  it('texto: endereços viram links seguros em outra aba; HTML continua texto', async () => {
    const { host } = await criar({ texto: 'Veja www.brl.com.br e <b>isto</b>' });
    const link = host.querySelector<HTMLAnchorElement>('a.bolha__link')!;
    expect(link.getAttribute('href')).toBe('https://www.brl.com.br');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(host.querySelector('b')).toBeNull();
    expect(host.querySelector('.bolha__texto')?.textContent).toContain('<b>isto</b>');
  });

  it('trechos: menção com link interno e link externo de esquema perigoso sem destino', async () => {
    const { host } = await criar({
      texto: '@Ana veja',
      trechos: [
        { texto: '@Ana', link: ['/contatos', '7'], tipo: 'mencao' },
        { texto: ' clique', link: 'javascript:alert(1)', externo: true },
      ],
    });
    const [mencao, perigoso] = host.querySelectorAll<HTMLAnchorElement>('a.bolha__link');
    expect(mencao.getAttribute('href')).toBe('/contatos/7');
    expect(mencao.classList).toContain('bolha__link--mencao');
    expect(perigoso.hasAttribute('href')).toBe(false);
  });

  it('anexo: prévia com rótulo do tipo e do autor; mensagem apagada esconde o conteúdo', async () => {
    const anexo = {
      nome: 'proposta.pdf',
      mime: 'application/pdf',
      url: '/api/v1/arquivos/1',
      tamanho: 2048,
    };
    const comAnexo = await criar({ tipo: 'DOCUMENTO', texto: null, anexo });
    expect(comAnexo.host.querySelector('app-previa-anexo .previa__nome')?.textContent).toBe(
      'proposta.pdf',
    );
    expect(comAnexo.host.querySelector('.bolha')?.classList).toContain('bolha--linha');

    const apagada = await criar({ tipo: 'DOCUMENTO', texto: null, anexo, excluida: true });
    expect(apagada.host.querySelector('app-previa-anexo')).toBeNull();
    expect(apagada.host.querySelector('.bolha__excluida')?.textContent).toBe('Mensagem apagada');
  });

  it('resposta citada e marca de editada', async () => {
    const { host } = await criar({
      editada: true,
      respondeA: { autor: 'Ana Ribeiro', texto: null, tipo: 'AUDIO' },
    });
    expect(host.querySelector('.bolha__citacao-autor')?.textContent).toBe('Ana Ribeiro');
    expect(host.querySelector('.bolha__citacao-texto')?.textContent).toBe('Áudio');
    expect(host.querySelector('.bolha__editada')?.textContent).toBe('editada');
  });

  it('localização e contato sem anexo mostram o tipo', async () => {
    const { host } = await criar({ tipo: 'LOCALIZACAO', texto: null });
    expect(host.querySelector('.bolha__tipo')?.textContent).toBe('Localização');
  });
});
