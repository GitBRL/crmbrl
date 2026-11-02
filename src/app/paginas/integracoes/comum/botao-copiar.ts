import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideCheck, LucideCopy } from '@lucide/angular';

import { AvisosService } from '../../../nucleo/avisos.service';
import { Botao } from '../../../ui/botao/botao';
import { copiarTexto } from './copiar';

/** Quanto tempo o botão fica em "Copiado". */
const TEMPO_COPIADO_MS = 2_000;

/**
 * Botão "Copiar" (pílula `sm`): copia o `texto`, vira "Copiado" com um visto por 2 s e avisa
 * pelo toast (anunciado ao leitor de tela). Se o navegador não deixar copiar, o aviso pede
 * para selecionar e copiar à mão.
 *
 * `<app-botao-copiar [texto]="url" oQue="Endereço" />`
 */
@Component({
  selector: 'app-botao-copiar',
  imports: [Botao],
  template: `
    <button
      appBotao
      type="button"
      tamanho="sm"
      [variante]="variante()"
      [icone]="copiado() ? iconeCopiado : iconeCopiar"
      [attr.aria-label]="rotuloAcessivel()"
      (click)="copiar()"
    >
      {{ copiado() ? 'Copiado' : 'Copiar' }}
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BotaoCopiar {
  private readonly avisos = inject(AvisosService);

  readonly texto = input.required<string>();
  /** O que é copiado, para o aviso e o leitor de tela: "Endereço", "Segredo". */
  readonly oQue = input('Texto');
  readonly variante = input<'contorno' | 'neutro' | 'invertido'>('contorno');
  /** Copia sem mostrar o toast (o próprio botão já diz "Copiado"). */
  readonly silencioso = input(false, { transform: booleanAttribute });
  /** O navegador não deixou copiar (quem mostra o valor pode selecioná-lo para a pessoa). */
  readonly falhou = output<void>();

  protected readonly iconeCopiar = LucideCopy;
  protected readonly iconeCopiado = LucideCheck;
  protected readonly copiado = signal(false);
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.limparTemporizador());
  }

  protected rotuloAcessivel(): string {
    return this.copiado() ? `${this.oQue()} copiado` : `Copiar ${this.oQue().toLowerCase()}`;
  }

  protected async copiar(): Promise<void> {
    const copiou = await copiarTexto(this.texto());
    if (!copiou) {
      this.avisos.atencao(
        'O navegador não deixou copiar. Selecione o texto e copie com Ctrl+C (ou ⌘+C).',
        { chave: 'copiar' },
      );
      this.falhou.emit();
      return;
    }
    if (!this.silencioso()) {
      this.avisos.sucesso(`${this.oQue()} copiado.`, { chave: 'copiar' });
    }
    this.copiado.set(true);
    this.limparTemporizador();
    this.temporizador = setTimeout(() => this.copiado.set(false), TEMPO_COPIADO_MS);
  }

  private limparTemporizador(): void {
    if (this.temporizador) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }
}
