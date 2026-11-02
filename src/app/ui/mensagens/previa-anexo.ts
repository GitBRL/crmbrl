import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { LucideDownload, LucideDynamicIcon, LucideFileText } from '@lucide/angular';

import { Botao } from '../botao/botao';
import { BotaoIcone } from '../botao-icone/botao-icone';
import { Modal } from '../modal/modal';
import { type AnexoMensagem, extensao, tamanhoLegivel, tipoDoAnexo } from './mensagens';
import { PlayerAudio } from './player-audio';

/**
 * Prévia de um anexo (DESIGN-SYSTEM.md §4.6), pelo tipo do arquivo:
 *
 * - **imagem**: miniatura com cantos `--raio-md` (até 280px; com `largura`/`altura` o espaço
 *   fica reservado antes de carregar); clicar amplia num modal com "Baixar";
 * - **vídeo**: o `<video>` nativo com controles;
 * - **áudio**: `app-player-audio`;
 * - **documento** (e imagem ou vídeo que não abriu): cartão em pílula com o ícone, o nome, o
 *   tipo e o tamanho ("PDF · 1,2 MB") e o botão de baixar.
 *
 * ```html
 * <app-previa-anexo [anexo]="{ nome: 'proposta.pdf', mime: 'application/pdf', url, tamanho }" />
 * ```
 */
@Component({
  selector: 'app-previa-anexo',
  imports: [Botao, BotaoIcone, LucideDynamicIcon, Modal, PlayerAudio],
  templateUrl: './previa-anexo.html',
  styleUrl: './previa-anexo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'previa-anexo',
    '[class.previa-anexo--compacta]': 'compacta()',
  },
})
export class PreviaAnexo {
  readonly anexo = input.required<AnexoMensagem>();
  /** Miniatura menor (até 200px), para listas e respostas citadas. */
  readonly compacta = input(false, { transform: booleanAttribute });
  /** Para o player e o alt da imagem: "Áudio de Maria". Padrão: o nome do arquivo. */
  readonly rotulo = input<string | null>(null);

  protected readonly icones = { documento: LucideFileText, baixar: LucideDownload };
  protected readonly ampliada = signal(false);
  /** A imagem ou o vídeo não abriu: mostra o cartão de documento. */
  protected readonly falhou = linkedSignal({ source: this.anexo, computation: () => false });

  protected readonly tipo = computed(() => {
    const anexo = this.anexo();
    const tipo = tipoDoAnexo(anexo.mime, anexo.nome);
    return this.falhou() && (tipo === 'imagem' || tipo === 'video') ? 'documento' : tipo;
  });
  protected readonly detalhe = computed(() => {
    const anexo = this.anexo();
    return [extensao(anexo.nome) || 'Arquivo', tamanhoLegivel(anexo.tamanho)]
      .filter(Boolean)
      .join(' · ');
  });
  /** `aspect-ratio` da miniatura quando as dimensões são conhecidas. */
  protected readonly proporcao = computed(() => {
    const { largura, altura } = this.anexo();
    return largura && altura ? `${largura} / ${altura}` : null;
  });
  protected readonly nomeFalado = computed(() => this.rotulo() ?? this.anexo().nome);
}
