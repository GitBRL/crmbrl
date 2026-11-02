import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
} from '@angular/core';

import { CORES_DADO, type CorDado } from '../tipos';

export type TamanhoAvatar = 'sm' | 'md' | 'lg';
export type FormaAvatar = 'circulo' | 'pilula';

/** "Maria da Silva" → "MS"; "Ana" → "A". */
export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) {
    return '?';
  }
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return `${partes[0][0]}${ultima}`.toLocaleUpperCase('pt-BR');
}

/** Cor estável a partir do nome (a mesma pessoa tem sempre a mesma cor). */
export function corDoNome(nome: string): CorDado {
  let hash = 0;
  for (const caractere of nome) {
    hash = (hash * 31 + caractere.charCodeAt(0)) | 0;
  }
  return CORES_DADO[Math.abs(hash) % CORES_DADO.length];
}

/**
 * Avatar (DESIGN-SYSTEM.md §4): foto ou iniciais sobre uma cor de dado tirada do nome.
 * Tamanhos 32/44/56. `forma="pilula"` é a usada na pilha de avatares (como na referência).
 * Por padrão é uma imagem acessível com o nome; use `decorativo` quando o nome já estiver
 * escrito ao lado.
 */
@Component({
  selector: 'app-avatar',
  template: `
    @if (foto() && !falhou()) {
      <img class="avatar__foto" alt="" [src]="foto()" (error)="falhou.set(true)" />
    } @else {
      <span class="avatar__iniciais" aria-hidden="true">{{ iniciais() }}</span>
    }
  `,
  styleUrl: './avatar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'avatar',
    '[class]': "'avatar--' + tamanho() + ' avatar--' + forma() + ' avatar--' + corFinal()",
    '[attr.role]': "decorativo() ? null : 'img'",
    '[attr.aria-label]': 'decorativo() ? null : nome()',
    '[attr.aria-hidden]': "decorativo() ? 'true' : null",
  },
})
export class Avatar {
  readonly nome = input.required<string>();
  readonly foto = input<string | null>(null);
  readonly tamanho = input<TamanhoAvatar>('md');
  readonly forma = input<FormaAvatar>('circulo');
  /** Força uma cor; sem ela, a cor sai do nome. */
  readonly cor = input<CorDado | null>(null);
  readonly decorativo = input(false, { transform: booleanAttribute });

  /** Foto que falhou ao carregar cai para as iniciais (volta a tentar se a foto mudar). */
  protected readonly falhou = linkedSignal({ source: this.foto, computation: () => false });
  protected readonly iniciais = computed(() => iniciaisDe(this.nome()));
  protected readonly corFinal = computed(() => this.cor() ?? corDoNome(this.nome()));
}
