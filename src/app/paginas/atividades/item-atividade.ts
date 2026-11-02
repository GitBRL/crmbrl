import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideBan,
  LucideClock,
  LucideDynamicIcon,
  LucideFlag,
  LucideForward,
  LucidePencil,
  LucideRotateCcw,
} from '@lucide/angular';

import { Avatar } from '../../ui/avatar/avatar';
import { CaixaSelecao } from '../../ui/caixa-selecao/caixa-selecao';
import { MenuAcoes, type ItemMenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { Selo } from '../../ui/selo/selo';
import { linkDoNegocio, quandoDaAtividade, TIPOS } from './apresentacao';
import { vinculoDaAtividade, type Atividade } from './atividades.api';
import { ICONE_DO_VINCULO, ROTULO_DO_VINCULO } from './seletor-vinculo';

export type AcaoItem = 'editar' | 'cancelar' | 'reabrir';

/**
 * Uma atividade na lista: a caixa grande para concluir (círculo de 28px num alvo de 44px), o
 * ícone do tipo, o título (link que abre o painel), o "quando" (coral se atrasada), o tipo, o
 * vínculo, o responsável (nas visões da equipe) e os selos — "Encaminhada de …" (R7.3) e
 * prioridade alta. O menu "⋯" tem editar, cancelar e reabrir, conforme o status.
 */
@Component({
  selector: 'app-item-atividade',
  imports: [Avatar, CaixaSelecao, LucideClock, LucideDynamicIcon, MenuAcoes, RouterLink, Selo],
  template: `
    <app-caixa-selecao
      class="item__caixa"
      tamanho="lg"
      forma="circulo"
      rotuloOculto
      [rotulo]="rotuloCaixa()"
      [valor]="feita()"
      [desabilitado]="ocupada() || atividade().status === 'CANCELADA'"
      (valorChange)="alternar.emit($event)"
    />
    <span class="item__tipo" aria-hidden="true">
      <svg [lucideIcon]="tipo().icone" [size]="18" />
    </span>
    <div class="item__corpo">
      <a
        class="item__titulo"
        [routerLink]="[]"
        [queryParams]="{ atividade: atividade().id }"
        queryParamsHandling="merge"
        >{{ atividade().titulo }}</a
      >
      <p class="item__meta">
        <span class="item__quando" [class.item__quando--atrasada]="atrasada()">
          <svg lucideClock [size]="14" />
          {{ quando() }}
        </span>
        <span class="item__ponto" aria-hidden="true">·</span>
        <span>{{ tipo().rotulo }}</span>
        @if (vinculo(); as ligado) {
          <span class="item__ponto item__ponto--vinculo" aria-hidden="true">·</span>
          <a
            class="item__vinculo"
            [routerLink]="ligado.rota"
            [queryParams]="ligado.query"
            [attr.aria-label]="ligado.rotulo + ': ' + ligado.nome"
          >
            <svg [lucideIcon]="ligado.icone" [size]="14" />
            {{ ligado.nome }}
          </a>
        }
      </p>
      @if (atividade().encaminhadaDe || atividade().prioridade === 'ALTA') {
        <p class="item__selos">
          @if (atividade().encaminhadaDe; as origem) {
            <app-selo variante="ciano" [icone]="iconeEncaminhada">
              Encaminhada de {{ origem.nome }}
            </app-selo>
          }
          @if (atividade().prioridade === 'ALTA') {
            <app-selo variante="contorno" [icone]="iconePrioridade"> Prioridade alta </app-selo>
          }
        </p>
      }
    </div>
    @if (mostrarResponsavel()) {
      <span class="item__responsavel">
        <app-avatar
          tamanho="sm"
          decorativo
          [nome]="atividade().responsavel.nome"
          [foto]="atividade().responsavel.avatarUrl ?? null"
        />
        <span class="item__responsavel-nome">
          <span class="visualmente-oculto">Responsável: </span>{{ atividade().responsavel.nome }}
        </span>
      </span>
    }
    <app-menu-acoes
      class="item__acoes"
      [rotulo]="'Ações de ' + atividade().titulo"
      [itens]="acoes()"
      (escolher)="agir.emit($any($event.id))"
    />
  `,
  styleUrl: './item-atividade.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'item',
    '[class.item--atrasada]': 'atrasada()',
    '[class.item--feita]': 'feita()',
    '[class.item--cancelada]': "atividade().status === 'CANCELADA'",
    '[class.item--destacada]': 'destacada()',
    '[class.item--com-responsavel]': 'mostrarResponsavel()',
    '[attr.data-atividade]': 'atividade().id',
  },
})
export class ItemAtividade {
  readonly atividade = input.required<Atividade>();
  /** Referência dos rótulos relativos ("hoje", "amanhã"): o relógio da página. */
  readonly agora = input<Date>(new Date());
  /** Mostra quem é o responsável (visões da equipe, ou quando não é a própria pessoa). */
  readonly mostrarResponsavel = input(false, { transform: booleanAttribute });
  /** Pedido em andamento: a caixa fica desabilitada. */
  readonly ocupada = input(false, { transform: booleanAttribute });
  /** Marcação otimista enquanto a API responde (`null` = a do status). */
  readonly marcada = input<boolean | null>(null);
  /** Acabou de ser criada ou alterada: um destaque breve. */
  readonly destacada = input(false, { transform: booleanAttribute });

  /** `true` = concluir; `false` = reabrir. */
  readonly alternar = output<boolean>();
  readonly agir = output<AcaoItem>();

  protected readonly iconeEncaminhada = LucideForward;
  protected readonly iconePrioridade = LucideFlag;

  protected readonly tipo = computed(() => TIPOS[this.atividade().tipo]);
  protected readonly feita = computed(
    () => this.marcada() ?? this.atividade().status === 'CONCLUIDA',
  );
  protected readonly atrasada = computed(() => this.atividade().atrasada && !this.feita());
  protected readonly quando = computed(() => quandoDaAtividade(this.atividade(), this.agora()));
  protected readonly rotuloCaixa = computed(() =>
    this.feita() ? `Reabrir “${this.atividade().titulo}”` : `Concluir “${this.atividade().titulo}”`,
  );

  protected readonly vinculo = computed(() => {
    const atividade = this.atividade();
    const vinculo = vinculoDaAtividade(atividade);
    if (!vinculo) {
      return null;
    }
    const base = {
      nome: vinculo.nome,
      rotulo: ROTULO_DO_VINCULO[vinculo.tipo],
      icone: ICONE_DO_VINCULO[vinculo.tipo],
    };
    if (vinculo.tipo === 'negocio' && atividade.negocio) {
      const link = linkDoNegocio(atividade.negocio);
      return { ...base, rota: link.rota, query: link.query };
    }
    const rota = vinculo.tipo === 'contato' ? ['/contatos', vinculo.id] : ['/empresas', vinculo.id];
    return { ...base, rota, query: null };
  });

  protected readonly acoes = computed<readonly ItemMenuAcoes[]>(() => {
    switch (this.atividade().status) {
      case 'PENDENTE':
        return [
          { id: 'editar', rotulo: 'Editar', icone: LucidePencil },
          {
            id: 'cancelar',
            rotulo: 'Cancelar atividade',
            icone: LucideBan,
            perigo: true,
            separarAntes: true,
          },
        ];
      case 'CONCLUIDA':
        return [
          { id: 'reabrir', rotulo: 'Reabrir', icone: LucideRotateCcw },
          { id: 'editar', rotulo: 'Editar', icone: LucidePencil },
        ];
      default:
        return [{ id: 'reabrir', rotulo: 'Reabrir', icone: LucideRotateCcw }];
    }
  });
}
