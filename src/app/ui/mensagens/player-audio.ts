import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { LucidePause, LucidePlay } from '@lucide/angular';

import { BotaoIcone } from '../botao-icone/botao-icone';
import { duracaoFalada, duracaoLegivel } from './mensagens';

/** Quantas barras a onda desenha. */
export const BARRAS_ONDA = 32;
const VELOCIDADES = [1, 1.5, 2] as const;

/** O áudio tocando agora: dar play em outro pausa este (um de cada vez na tela). */
let tocandoAgora: HTMLAudioElement | null = null;

/** Alturas da onda (de 0,2 a 1), sempre as mesmas para o mesmo endereço. */
export function alturasDaOnda(semente: string, barras = BARRAS_ONDA): readonly number[] {
  let estado = 2166136261;
  for (let i = 0; i < semente.length; i++) {
    estado = Math.imul(estado ^ semente.charCodeAt(i), 16777619) >>> 0;
  }
  const alturas: number[] = [];
  for (let i = 0; i < barras; i++) {
    estado = Math.imul(estado ^ (estado >>> 15), 2246822519) >>> 0;
    const aleatorio = (estado % 1000) / 1000;
    // Envelope suave: as pontas mais baixas, como uma fala.
    const envelope = 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / barras);
    alturas.push(Math.max(0.2, Math.min(1, aleatorio * envelope + 0.15)));
  }
  return alturas;
}

/**
 * Player de áudio das mensagens (DESIGN-SYSTEM.md §4.6): círculo invertido de tocar/pausar, a
 * onda em barras-pílula (as já tocadas em `--cor-info`), o tempo e a velocidade (1×, 1,5×, 2×).
 * A onda é um `<input type="range">` por cima das barras: setas, Home/End e o toque levam a
 * qualquer ponto, e o leitor de tela ouve "0:12 de 0:45". Um áudio de cada vez: tocar outro
 * pausa este. Se o arquivo não abrir, mostra o aviso e o link para baixar.
 *
 * ```html
 * <app-player-audio [src]="anexo.url" [duracao]="anexo.duracao" rotulo="Áudio de Maria" />
 * ```
 */
@Component({
  selector: 'app-player-audio',
  imports: [BotaoIcone],
  template: `
    <audio
      #audio
      preload="metadata"
      [src]="src()"
      (loadedmetadata)="aoCarregar()"
      (durationchange)="aoMudarDuracao()"
      (timeupdate)="aoAvancar()"
      (play)="aoTocar()"
      (pause)="tocando.set(false)"
      (ended)="aoTerminar()"
      (error)="erro.set(true)"
    ></audio>
    @if (erro()) {
      <p class="player__erro">
        Não foi possível tocar este áudio.
        <a [href]="src()" target="_blank" rel="noopener" download>Baixar</a>
      </p>
    } @else {
      <button
        appBotaoIcone
        type="button"
        variante="invertido"
        tamanho="sm"
        [icone]="tocando() ? icones.pausar : icones.tocar"
        [rotulo]="(tocando() ? 'Pausar ' : 'Tocar ') + rotuloNaFrase()"
        (click)="alternar()"
      ></button>
      <div class="player__onda">
        <span class="player__barras" aria-hidden="true">
          @for (altura of alturas(); track $index) {
            <i [style.height.%]="altura * 100" [class.tocada]="$index < barrasTocadas()"></i>
          }
        </span>
        <input
          type="range"
          class="player__posicao"
          min="0"
          step="0.1"
          [max]="duracaoTotal() || 0"
          [value]="posicao()"
          [disabled]="!duracaoTotal()"
          [attr.aria-label]="'Posição do ' + rotuloNaFrase()"
          [attr.aria-valuetext]="textoPosicao()"
          (input)="buscar($event)"
        />
      </div>
      <span class="player__tempo" aria-hidden="true">{{ tempoVisivel() }}</span>
      <button
        type="button"
        class="player__velocidade"
        [attr.aria-label]="rotuloVelocidade()"
        (click)="trocarVelocidade()"
      >
        {{ textoVelocidade() }}
      </button>
    }
  `,
  styleUrl: './player-audio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'player-audio' },
})
export class PlayerAudio {
  readonly src = input.required<string>();
  /** Duração conhecida (segundos), mostrada antes de o arquivo carregar. */
  readonly duracao = input<number | null>(null);
  /** Do que é o áudio, para os botões: "Áudio", "Áudio de Maria". */
  readonly rotulo = input('Áudio');

  protected readonly icones = { tocar: LucidePlay, pausar: LucidePause };
  protected readonly tocando = signal(false);
  protected readonly posicao = signal(0);
  protected readonly erro = signal(false);
  private readonly duracaoLida = signal<number | null>(null);
  private readonly velocidade = signal<(typeof VELOCIDADES)[number]>(1);
  private readonly audio = viewChild<ElementRef<HTMLAudioElement>>('audio');
  /** Arquivos gravados no navegador (webm) chegam sem duração: lê indo até o fim. */
  private medindoDuracao = false;

  protected readonly alturas = computed(() => alturasDaOnda(this.src()));
  /** O rótulo no meio da frase: "Tocar áudio de Maria" (só a primeira letra muda). */
  protected readonly rotuloNaFrase = computed(() => {
    const rotulo = this.rotulo();
    return rotulo.charAt(0).toLocaleLowerCase('pt-BR') + rotulo.slice(1);
  });
  protected readonly duracaoTotal = computed(() => this.duracaoLida() ?? this.duracao() ?? 0);
  protected readonly barrasTocadas = computed(() => {
    const total = this.duracaoTotal();
    return total ? Math.round((this.posicao() / total) * BARRAS_ONDA) : 0;
  });
  /** Parado no começo: a duração; tocando (ou no meio): onde está. */
  protected readonly tempoVisivel = computed(() =>
    duracaoLegivel(this.tocando() || this.posicao() > 0 ? this.posicao() : this.duracaoTotal()),
  );
  protected readonly textoPosicao = computed(
    () => `${duracaoFalada(this.posicao())} de ${duracaoFalada(this.duracaoTotal())}`,
  );
  protected readonly textoVelocidade = computed(
    () => `${String(this.velocidade()).replace('.', ',')}×`,
  );
  protected readonly rotuloVelocidade = computed(() => {
    const atual = this.velocidade();
    const proxima = VELOCIDADES[(VELOCIDADES.indexOf(atual) + 1) % VELOCIDADES.length];
    const falar = (v: number) => `${String(v).replace('.', ',')} vez${v === 1 ? '' : 'es'}`;
    return `Velocidade: ${falar(atual)}. Mudar para ${falar(proxima)}`;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      const audio = this.audio()?.nativeElement;
      audio?.pause();
      if (tocandoAgora === audio) {
        tocandoAgora = null;
      }
    });
  }

  protected alternar(): void {
    const audio = this.audio()?.nativeElement;
    if (!audio) {
      return;
    }
    if (audio.paused) {
      audio.playbackRate = this.velocidade();
      audio.play().catch(() => this.tocando.set(false));
    } else {
      audio.pause();
    }
  }

  protected buscar(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    const audio = this.audio()?.nativeElement;
    if (audio && Number.isFinite(valor)) {
      audio.currentTime = valor;
      this.posicao.set(valor);
    }
  }

  protected trocarVelocidade(): void {
    const proxima = VELOCIDADES[(VELOCIDADES.indexOf(this.velocidade()) + 1) % VELOCIDADES.length];
    this.velocidade.set(proxima);
    const audio = this.audio()?.nativeElement;
    if (audio) {
      audio.playbackRate = proxima;
    }
  }

  protected aoCarregar(): void {
    const audio = this.audio()?.nativeElement;
    if (!audio) {
      return;
    }
    if (audio.duration === Infinity) {
      this.medindoDuracao = true;
      audio.currentTime = 1e7;
      return;
    }
    this.aoMudarDuracao();
  }

  protected aoMudarDuracao(): void {
    const duracao = this.audio()?.nativeElement.duration;
    if (duracao !== undefined && Number.isFinite(duracao) && duracao > 0) {
      this.duracaoLida.set(duracao);
    }
  }

  protected aoAvancar(): void {
    const audio = this.audio()?.nativeElement;
    if (!audio) {
      return;
    }
    if (this.medindoDuracao) {
      this.medindoDuracao = false;
      this.aoMudarDuracao();
      audio.currentTime = 0;
      return;
    }
    this.posicao.set(audio.currentTime);
  }

  protected aoTocar(): void {
    const audio = this.audio()?.nativeElement ?? null;
    if (tocandoAgora && tocandoAgora !== audio) {
      tocandoAgora.pause();
    }
    tocandoAgora = audio;
    this.tocando.set(true);
  }

  protected aoTerminar(): void {
    this.tocando.set(false);
    this.posicao.set(0);
    const audio = this.audio()?.nativeElement;
    if (audio) {
      audio.currentTime = 0;
    }
  }
}
