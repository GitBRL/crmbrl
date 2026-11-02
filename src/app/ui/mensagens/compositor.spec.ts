import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  Compositor,
  type EnvioCompositor,
  INTERVALO_DIGITANDO_MS,
  type ModoCompositor,
  PAUSA_DIGITANDO_MS,
} from './compositor';
import { filtrarRespostas, type RespostaRapidaOpcao } from './respostas-rapidas';

const RESPOSTAS: readonly RespostaRapidaOpcao[] = [
  {
    id: 'r1',
    atalho: 'boasvindas',
    titulo: 'Boas-vindas',
    texto: 'Olá, {{contato.nome}}! Aqui é {{usuario.nome}}.',
  },
  { id: 'r2', atalho: 'proposta', titulo: 'Envio de proposta', texto: 'Segue a proposta.' },
  { id: 'r3', atalho: 'horario', titulo: 'Horário de atendimento', texto: 'De segunda a sexta.' },
  {
    id: 'r4',
    atalho: 'pagamento',
    titulo: 'Formas de pagamento',
    texto: 'Boleto, Pix e cartão; envio a proposta.',
  },
];

@Component({
  imports: [Compositor],
  template: `<app-compositor
    [respostasRapidas]="respostas()"
    [variaveis]="{ 'contato.nome': 'Maria', 'usuario.nome': 'Ana' }"
    [permitirNota]="permitirNota()"
    [desabilitado]="desabilitado()"
    [motivo]="motivo()"
    [maximoCaracteres]="maximo()"
    [maximoAnexos]="maximoAnexos()"
    [(modo)]="modo"
    (enviar)="envios.push($event)"
    (digitando)="digitando.push($event)"
  />`,
})
class Hospedeiro {
  readonly respostas = signal<readonly RespostaRapidaOpcao[]>(RESPOSTAS);
  readonly permitirNota = signal(false);
  readonly desabilitado = signal(false);
  readonly motivo = signal<string | null>(null);
  readonly maximo = signal<number | null>(null);
  readonly maximoAnexos = signal(10);
  readonly modo = signal<ModoCompositor>('mensagem');
  readonly envios: EnvioCompositor[] = [];
  readonly digitando: boolean[] = [];
  readonly compositor = viewChild.required(Compositor);
}

const MB = 1024 * 1024;

function arquivo(nome: string, tipo: string, tamanho = 1000): File {
  const file = new File(['x'], nome, { type: tipo });
  Object.defineProperty(file, 'size', { value: tamanho });
  return file;
}

describe('Compositor', () => {
  async function criar(ajustes: (hospedeiro: Hospedeiro) => void = () => undefined) {
    const fixture = TestBed.createComponent(Hospedeiro);
    const hospedeiro = fixture.componentInstance;
    ajustes(hospedeiro);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const campo = () => raiz.querySelector<HTMLTextAreaElement>('textarea')!;
    const digitar = async (texto: string, cursor = texto.length) => {
      const area = campo();
      area.value = texto;
      area.setSelectionRange(cursor, cursor);
      area.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const teclar = async (key: string, extras: KeyboardEventInit = {}) => {
      const evento = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...extras,
      });
      campo().dispatchEvent(evento);
      await fixture.whenStable();
      return evento;
    };
    const anexar = async (...arquivos: File[]) => {
      const entrada = raiz.querySelector<HTMLInputElement>('input[type=file]')!;
      Object.defineProperty(entrada, 'files', { value: arquivos, configurable: true });
      entrada.dispatchEvent(new Event('change'));
      await fixture.whenStable();
    };
    const botao = (rotulo: string) =>
      [...raiz.querySelectorAll<HTMLButtonElement>('button')].find(
        (b) => b.getAttribute('aria-label') === rotulo || b.textContent?.trim() === rotulo,
      );
    return { fixture, hospedeiro, raiz, campo, digitar, teclar, anexar, botao };
  }

  it('Enter envia o texto aparado e limpa; Shift+Enter não envia; Ctrl+Enter envia', async () => {
    const { hospedeiro, campo, digitar, teclar } = await criar();
    await digitar('  Olá, Maria!  ');
    const enter = await teclar('Enter');
    expect(enter.defaultPrevented).toBe(true);
    expect(hospedeiro.envios).toEqual([
      { texto: 'Olá, Maria!', anexos: [], nota: false, audio: false },
    ]);
    expect(campo().value).toBe('');

    await digitar('linha 1');
    const quebra = await teclar('Enter', { shiftKey: true });
    expect(quebra.defaultPrevented).toBe(false);
    expect(hospedeiro.envios).toHaveLength(1);

    await teclar('Enter', { ctrlKey: true, shiftKey: true });
    expect(hospedeiro.envios.at(-1)?.texto).toBe('linha 1');
  });

  it('não envia vazio nem durante a composição de um acento (IME)', async () => {
    const { hospedeiro, digitar, teclar, botao } = await criar();
    await digitar('   ');
    await teclar('Enter');
    await digitar('ação');
    await teclar('Enter', { isComposing: true });
    expect(hospedeiro.envios).toEqual([]);
    // No jsdom não há gravação de áudio: o botão de enviar fica sempre, desabilitado se vazio.
    await digitar('');
    expect(botao('Enviar')?.disabled).toBe(true);
    expect(botao('Gravar um áudio')).toBeUndefined();
  });

  it('"/" abre as respostas rápidas filtradas; setas mudam a ativa e Enter escolhe com as variáveis', async () => {
    const { raiz, campo, digitar, teclar, hospedeiro } = await criar();
    await digitar('Oi! /');
    const opcoes = () => [...raiz.querySelectorAll('[role=option]')];
    expect(opcoes()).toHaveLength(4);
    expect(campo().getAttribute('aria-controls')).toBe(raiz.querySelector('[role=listbox]')?.id);
    expect(campo().getAttribute('aria-activedescendant')).toBe(opcoes()[0].id);

    await digitar('Oi! /pro');
    // "proposta" começa com o termo; "pagamento" só contém ("proposta" no texto).
    expect(opcoes().map((o) => o.querySelector('.respostas__atalho')?.textContent)).toEqual([
      '/proposta',
      '/pagamento',
    ]);
    await teclar('ArrowDown');
    expect(opcoes()[1].getAttribute('aria-selected')).toBe('true');
    await teclar('ArrowDown'); // dá a volta
    expect(opcoes()[0].getAttribute('aria-selected')).toBe('true');

    await digitar('Oi! /boas');
    const escolha = await teclar('Enter');
    expect(escolha.defaultPrevented).toBe(true);
    expect(campo().value).toBe('Oi! Olá, Maria! Aqui é Ana.');
    expect(raiz.querySelector('[role=listbox]')).toBeNull();
    expect(hospedeiro.envios).toEqual([]); // escolher não envia
  });

  it('a "/" só conta no começo de uma palavra; Esc fecha; sem respostas não abre', async () => {
    const { raiz, digitar, teclar, fixture, hospedeiro } = await criar();
    await digitar('e/ou');
    expect(raiz.querySelector('app-respostas-rapidas')).toBeNull();
    await digitar('/xyz');
    expect(raiz.querySelector('.respostas__vazio')?.textContent).toContain('“xyz”');
    const esc = await teclar('Escape');
    expect(esc.defaultPrevented).toBe(true);
    expect(raiz.querySelector('app-respostas-rapidas')).toBeNull();

    hospedeiro.respostas.set([]);
    await fixture.whenStable();
    await digitar('/');
    expect(raiz.querySelector('app-respostas-rapidas')).toBeNull();
  });

  it('anexos: pílula com nome e tamanho, recusa SVG e o que passa do limite, remove e envia', async () => {
    const { fixture, raiz, hospedeiro, anexar, botao, digitar } = await criar();
    await anexar(
      arquivo('proposta.pdf', 'application/pdf', 1_284_000),
      arquivo('logo.svg', 'image/svg+xml'),
      arquivo('video.mp4', 'video/mp4', 30 * MB),
    );
    const nomes = () =>
      [...raiz.querySelectorAll('.compositor__anexo-nome')].map((n) => n.textContent?.trim());
    expect(nomes()).toEqual(['proposta.pdf']);
    expect(raiz.querySelector('.compositor__anexo-detalhe')?.textContent).toBe('PDF · 1,2 MB');
    const erro = raiz.querySelector('.compositor__erro')?.textContent ?? '';
    expect(erro).toContain('“logo.svg” não pode ser enviado');
    expect(erro).toContain('“video.mp4” passa de 25 MB');

    // Só anexo já pode enviar.
    expect(botao('Enviar')?.disabled).toBe(false);
    await anexar(arquivo('foto.png', 'image/png'));
    botao('Remover foto.png')!.click();
    await digitar('Segue');
    botao('Enviar')!.click();
    await fixture.whenStable();
    expect(hospedeiro.envios).toHaveLength(1);
    expect(hospedeiro.envios[0].texto).toBe('Segue');
    expect(hospedeiro.envios[0].anexos.map((a) => a.name)).toEqual(['proposta.pdf']);
    expect(nomes()).toEqual([]);
  });

  it('limite de arquivos por envio', async () => {
    const { raiz, anexar } = await criar((h) => h.maximoAnexos.set(2));
    await anexar(
      arquivo('a.pdf', 'application/pdf'),
      arquivo('b.pdf', 'application/pdf'),
      arquivo('c.pdf', 'application/pdf'),
    );
    expect(raiz.querySelectorAll('.compositor__anexo')).toHaveLength(2);
    expect(raiz.querySelector('.compositor__erro')?.textContent).toContain('até 2 arquivos');
  });

  it('nota interna: alterna o modo, muda a pílula e envia com nota=true', async () => {
    const { fixture, raiz, hospedeiro, botao, digitar, teclar } = await criar((h) =>
      h.permitirNota.set(true),
    );
    const nota = botao('Nota interna')!;
    expect(nota.getAttribute('aria-pressed')).toBe('false');
    nota.click();
    await fixture.whenStable();
    expect(hospedeiro.modo()).toBe('nota');
    expect(nota.getAttribute('aria-pressed')).toBe('true');
    expect(raiz.querySelector('app-compositor')?.classList).toContain('compositor--nota');
    expect(raiz.querySelector('textarea')?.getAttribute('placeholder')).toBe(
      'Escreva uma nota interna…',
    );
    expect(raiz.querySelector('.compositor__dica')?.textContent).toContain(
      'Só a equipe vê as notas internas.',
    );
    await digitar('Cliente quer desconto');
    await teclar('Enter');
    expect(hospedeiro.envios).toEqual([
      { texto: 'Cliente quer desconto', anexos: [], nota: true, audio: false },
    ]);
  });

  it('tela estreita: a dica de Shift+Enter some e fica só a das respostas rápidas', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes('max-width'),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    try {
      const { raiz } = await criar();
      const dica = raiz.querySelector('.compositor__dica')?.textContent ?? '';
      expect(dica).not.toContain('Shift+Enter');
      expect(dica).toContain('respostas rápidas');
    } finally {
      window.matchMedia = original;
    }
  });

  it('bloqueado: o motivo no lugar do campo, sem dica de teclado', async () => {
    const { raiz } = await criar((h) => {
      h.desabilitado.set(true);
      h.motivo.set('Fora da janela de 24 h.');
    });
    expect(raiz.querySelector('textarea')).toBeNull();
    expect(raiz.querySelector('.compositor__bloqueio')?.textContent?.trim()).toBe(
      'Fora da janela de 24 h.',
    );
    expect(raiz.querySelector('.compositor__dica')).toBeNull();
    expect(raiz.querySelector('.compositor__modos')).toBeNull();
  });

  it('limite de caracteres: contador a partir de 80% e envio bloqueado acima do limite', async () => {
    const { raiz, digitar, teclar, hospedeiro, campo } = await criar((h) => h.maximo.set(10));
    await digitar('1234567');
    expect(raiz.querySelector('.compositor__contador')).toBeNull();
    await digitar('12345678');
    expect(raiz.querySelector('.compositor__contador')?.textContent?.trim()).toBe('8 de 10');
    await digitar('12345678901');
    expect(raiz.querySelector('.compositor__contador')?.classList).toContain(
      'compositor__contador--excedeu',
    );
    expect(campo().getAttribute('aria-invalid')).toBe('true');
    await teclar('Enter');
    expect(hospedeiro.envios).toEqual([]);
  });

  it('"digitando": avisa no máximo a cada 3 s, para depois de 4 s sem tecla e ao sair do campo', async () => {
    const { hospedeiro, campo } = await criar();
    // Os avisos saem direto dos eventos do campo (sem esperar a detecção de mudanças).
    const escrever = (texto: string) => {
      campo().value = texto;
      campo().dispatchEvent(new Event('input'));
    };
    vi.useFakeTimers();
    try {
      escrever('O');
      escrever('Ol');
      expect(hospedeiro.digitando).toEqual([true]);
      vi.advanceTimersByTime(INTERVALO_DIGITANDO_MS);
      escrever('Olá');
      expect(hospedeiro.digitando).toEqual([true, true]);
      vi.advanceTimersByTime(PAUSA_DIGITANDO_MS);
      expect(hospedeiro.digitando).toEqual([true, true, false]);

      escrever('Olá!');
      campo().dispatchEvent(new Event('blur'));
      expect(hospedeiro.digitando).toEqual([true, true, false, true, false]);
      // Apagar tudo também para.
      escrever('x');
      escrever('');
      expect(hospedeiro.digitando.slice(-2)).toEqual([true, false]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('restaurar devolve um envio que falhou; inserirTexto escreve onde está o cursor', async () => {
    const { hospedeiro, campo, digitar, teclar, raiz, fixture } = await criar();
    await digitar('Mensagem importante');
    await teclar('Enter');
    const envio = hospedeiro.envios[0];
    hospedeiro.compositor().restaurar({ ...envio, anexos: [arquivo('a.pdf', 'application/pdf')] });
    await fixture.whenStable();
    expect(campo().value).toBe('Mensagem importante');
    expect(raiz.querySelectorAll('.compositor__anexo')).toHaveLength(1);

    await digitar('Olá !', 4);
    hospedeiro.compositor().inserirTexto('Maria');
    await fixture.whenStable();
    expect(campo().value).toBe('Olá Maria!');
  });
});

describe('filtrarRespostas', () => {
  it('primeiro as de atalho que começa com o termo, depois as que contêm (sem acento)', () => {
    expect(filtrarRespostas(RESPOSTAS, 'horário').map((r) => r.id)).toEqual(['r3']);
    expect(filtrarRespostas(RESPOSTAS, 'PRO').map((r) => r.id)).toEqual(['r2', 'r4']);
    expect(filtrarRespostas(RESPOSTAS, '').map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(filtrarRespostas(RESPOSTAS, '', 2)).toHaveLength(2);
    expect(filtrarRespostas(RESPOSTAS, 'zzz')).toEqual([]);
  });
});
