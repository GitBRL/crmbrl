import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  LucideChevronDown,
  LucideDynamicIcon,
  LucideEllipsis,
  type LucideIconInput,
} from '@lucide/angular';

import { Botao, type VarianteBotao } from '../botao/botao';
import { BotaoIcone, type VarianteBotaoIcone } from '../botao-icone/botao-icone';
import { gerarId, type TamanhoControle } from '../tipos';

/** Uma ação do menu. */
export interface ItemMenuAcoes {
  readonly id: string;
  readonly rotulo: string;
  readonly icone?: LucideIconInput;
  /** Ação destrutiva ("Desligar", "Anonimizar"): texto em tom de erro. Confirme antes de agir. */
  readonly perigo?: boolean;
  readonly desabilitado?: boolean;
  /** Por que está desabilitada: aparece embaixo do rótulo e é lida pelo leitor de tela. */
  readonly motivo?: string;
  /** Linha divisória antes deste item (separa grupos, ex.: as destrutivas no fim). */
  readonly separarAntes?: boolean;
}

// Abaixo e alinhado à direita do botão; sem espaço, acima.
const POSICOES: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
];

/**
 * Menu de ações (DESIGN-SYSTEM.md §4.4) com o `@angular/cdk/menu`: o botão "⋯" (ou uma
 * pílula com `texto`) abre uma lista flutuante de ações. Padrão de menu do WAI-ARIA vindo do
 * CDK: `aria-haspopup`/`aria-expanded` no botão, `role="menu"`/`menuitem`, setas, Home/End,
 * busca pela primeira letra, Esc fecha e devolve o foco, clique fora fecha.
 *
 * Ação desabilitada continua focável (`aria-disabled`) e mostra o **motivo** embaixo do
 * rótulo, ligado por `aria-describedby` — a pessoa entende por que não pode.
 *
 * A escolha sai em `(escolher)` com o item. Ações destrutivas (`perigo`) pedem confirmação na
 * tela (ConfirmacaoService) antes de agir.
 *
 * `<app-menu-acoes rotulo="Ações de Maria Souza" [itens]="acoes" (escolher)="agir($event.id)" />`
 */
@Component({
  selector: 'app-menu-acoes',
  imports: [
    Botao,
    BotaoIcone,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    LucideChevronDown,
    LucideDynamicIcon,
  ],
  template: `
    @if (texto(); as textoBotao) {
      <button
        appBotao
        type="button"
        class="menu-acoes__gatilho"
        [variante]="varianteTexto()"
        [tamanho]="tamanho()"
        [icone]="icone()"
        [attr.aria-label]="rotulo() === textoBotao ? null : rotulo()"
        [cdkMenuTriggerFor]="lista"
        [cdkMenuPosition]="posicoes"
      >
        {{ textoBotao }}
        <svg lucideChevronDown class="menu-acoes__seta" [size]="16" />
      </button>
    } @else {
      <button
        appBotaoIcone
        type="button"
        class="menu-acoes__gatilho"
        [variante]="variante()"
        [tamanho]="tamanho()"
        [icone]="icone() ?? iconePadrao"
        [rotulo]="rotulo()"
        [cdkMenuTriggerFor]="lista"
        [cdkMenuPosition]="posicoes"
      ></button>
    }

    <ng-template #lista>
      <div class="menu-acoes__painel" cdkMenu [attr.aria-label]="rotulo()">
        @for (item of itens(); track item.id) {
          @if (item.separarAntes && !$first) {
            <div class="menu-acoes__separador" role="separator"></div>
          }
          <button
            cdkMenuItem
            type="button"
            class="menu-acoes__item"
            [class.menu-acoes__item--perigo]="!!item.perigo"
            [cdkMenuItemDisabled]="!!item.desabilitado"
            [attr.aria-describedby]="item.desabilitado && item.motivo ? idMotivo(item.id) : null"
            (cdkMenuItemTriggered)="escolher.emit(item)"
          >
            <span class="menu-acoes__icone" aria-hidden="true">
              @if (item.icone) {
                <svg [lucideIcon]="item.icone" [size]="18" />
              }
            </span>
            <span class="menu-acoes__textos">
              <span class="menu-acoes__rotulo">{{ item.rotulo }}</span>
              @if (item.desabilitado && item.motivo) {
                <span class="menu-acoes__motivo" [id]="idMotivo(item.id)">{{ item.motivo }}</span>
              }
            </span>
          </button>
        }
      </div>
    </ng-template>
  `,
  styleUrl: './menu-acoes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'menu-acoes' },
})
export class MenuAcoes {
  readonly itens = input.required<readonly ItemMenuAcoes[]>();
  /** Nome do botão e do menu: diga de quê ("Ações de Maria Souza", "Mais ações do negócio"). */
  readonly rotulo = input.required<string>();
  /** Com texto, o gatilho vira pílula ("Ações ▾"); sem, botão-ícone "⋯". */
  readonly texto = input<string | null>(null);
  readonly icone = input<LucideIconInput | null>(null);
  readonly variante = input<VarianteBotaoIcone>('contorno');
  readonly varianteTexto = input<VarianteBotao>('contorno');
  readonly tamanho = input<TamanhoControle>('sm');
  readonly escolher = output<ItemMenuAcoes>();

  protected readonly iconePadrao = LucideEllipsis;
  protected readonly posicoes = POSICOES;
  private readonly prefixo = gerarId('menu-acoes');

  protected idMotivo(id: string): string {
    return `${this.prefixo}-${id}-motivo`;
  }
}
