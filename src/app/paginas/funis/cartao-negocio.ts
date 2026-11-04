import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideCalendarCheck, LucideGripVertical, LucideTriangleAlert } from '@lucide/angular';

import { formatarMoeda, formatarTempoRelativo } from '../../nucleo/formatos';
import { SeloTemperatura } from '../../nucleo/sdr/selo-temperatura';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { type ItemMenuAcoes, MenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { Selo } from '../../ui/selo/selo';
import type { Atividade, Etapa, Negocio } from './funis.tipos';
import { rotuloDias } from './regras-funis';

/** O que o menu "⋯" do cartão pede ao quadro. */
export type AcaoCartao =
  | { readonly tipo: 'abrir' }
  | { readonly tipo: 'assumir' }
  | { readonly tipo: 'mover'; readonly etapaId: string };

/**
 * Cartão do negócio no kanban (TELAS-FASE1 §3.1): título (link para o detalhe), contato e
 * empresa, valor, etiquetas, a próxima atividade (com o aviso de atrasada), o responsável — ou
 * "Assumir", se ainda aberto — e o selo do tempo na etapa, coral quando passou do prazo-alvo
 * ("parado").
 *
 * Arrastar é do quadro (o `cdkDrag` fica no elemento deste componente); pelo teclado, o botão
 * "Mover" repassa as teclas ao quadro (`teclaMover`) e o menu "⋯" oferece "Mover para…".
 */
@Component({
  selector: 'app-cartao-negocio',
  imports: [
    Avatar,
    Botao,
    LucideCalendarCheck,
    LucideGripVertical,
    LucideTriangleAlert,
    MenuAcoes,
    RouterLink,
    Selo,
    SeloTemperatura,
  ],
  template: `
    <article class="cartao" [class.cartao--pego]="pego()" [class.cartao--parado]="negocio().parado">
      <div class="cartao__topo">
        <a
          class="cartao__titulo"
          [routerLink]="link()"
          [queryParams]="queryParams()"
          [attr.aria-describedby]="idResumo()"
          >{{ negocio().titulo }}</a
        >
        <div class="cartao__acoes">
          <button
            type="button"
            class="cartao__mover"
            [class.cartao__mover--ativo]="pego()"
            [attr.aria-label]="'Mover ' + negocio().titulo"
            [attr.aria-pressed]="pego()"
            aria-describedby="kanban-instrucoes"
            [attr.data-mover]="negocio().id"
            (keydown)="teclaMover.emit($event)"
            (focusout)="saiuDoMover.emit()"
          >
            <svg lucideGripVertical [size]="18" />
          </button>
          <app-menu-acoes
            class="cartao__menu"
            [rotulo]="'Ações de ' + negocio().titulo"
            [itens]="itensMenu()"
            (escolher)="escolher($event)"
          />
        </div>
      </div>

      <div class="cartao__resumo" [id]="idResumo()">
        @if (mostrarContato() || negocio().empresa) {
          <p class="cartao__quem">
            @if (mostrarContato()) {
              {{ negocio().contato.nome }}
            }
            @if (negocio().empresa; as empresa) {
              <span class="cartao__empresa"
                >{{ mostrarContato() ? ' · ' : '' }}{{ empresa.nome }}</span
              >
            }
          </p>
        }

        @if (mostrarValor()) {
          <p class="cartao__valor numeros">
            {{ valor() }}
            @if (recorrente(); as mensal) {
              <span class="cartao__recorrente">+ {{ mensal }}/mês</span>
            }
          </p>
        }

        @if (negocio().sdr; as sdr) {
          <p class="cartao__ia">
            <app-selo-temperatura tamanho="sm" [temperatura]="sdr.temperatura" [nota]="sdr.nota" />
            @if (sdr.nota !== null) {
              <span class="cartao__nota numeros" aria-hidden="true">{{ sdr.nota }}/100</span>
            }
          </p>
        }

        @if (negocio().contato.etiquetas.length) {
          <ul class="cartao__etiquetas" aria-label="Etiquetas">
            @for (etiqueta of negocio().contato.etiquetas; track etiqueta) {
              <li>
                <app-selo tamanho="sm" variante="contorno">{{ etiqueta }}</app-selo>
              </li>
            }
          </ul>
        }

        @if (proxima(); as atividade) {
          <p class="cartao__proxima" [class.cartao__proxima--atrasada]="atividade.atrasada">
            @if (atividade.atrasada) {
              <svg lucideTriangleAlert [size]="16" />
              <span class="visualmente-oculto">{{ 'Atividade atrasada: ' }}</span>
            } @else {
              <svg lucideCalendarCheck [size]="16" />
              <span class="visualmente-oculto">{{ 'Próxima atividade: ' }}</span>
            }
            <span class="cartao__proxima-texto">{{ atividade.titulo }}</span>
            @if (quandoProxima(); as quando) {
              <span class="cartao__proxima-quando">{{ ' · ' + quando }}</span>
            }
          </p>
        }
      </div>

      <div class="cartao__rodape">
        @if (negocio().responsavel; as responsavel) {
          <span class="cartao__responsavel" [title]="'Responsável: ' + responsavel.nome">
            <app-avatar
              [nome]="responsavel.nome"
              [foto]="responsavel.avatarUrl ?? null"
              tamanho="sm"
              decorativo
            />
            <span class="cartao__responsavel-nome">{{ primeiroNome(responsavel.nome) }}</span>
            <span class="visualmente-oculto">{{ ', responsável: ' + responsavel.nome }}</span>
          </span>
        } @else if (oferecerAssumir()) {
          <button
            appBotao
            type="button"
            tamanho="sm"
            variante="contorno"
            class="cartao__assumir"
            [carregando]="assumindo()"
            [attr.aria-label]="'Assumir ' + negocio().titulo"
            (click)="acao.emit({ tipo: 'assumir' })"
          >
            Assumir
          </button>
        } @else {
          <span class="cartao__sem-responsavel">Sem responsável</span>
        }

        <app-selo
          class="cartao__tempo"
          tamanho="sm"
          [variante]="negocio().parado ? 'coral' : 'neutro'"
          [attr.title]="dicaTempo()"
        >
          <span class="visualmente-oculto">{{ dicaTempo() }}</span>
          <span aria-hidden="true">{{ negocio().parado ? 'Parado · ' : '' }}{{ dias() }}</span>
        </app-selo>
      </div>
    </article>
  `,
  styleUrl: './cartao-negocio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-negocio-id]': 'negocio().id' },
})
export class CartaoNegocio {
  readonly negocio = input.required<Negocio>();
  readonly proxima = input<Atividade | null>(null);
  /** Comandos do `routerLink` do detalhe (`/funis/<area>/<id>`). */
  readonly link = input.required<readonly unknown[]>();
  readonly queryParams = input<Record<string, string> | null>(null);
  /** Etapas do funil (para "Mover para…"). */
  readonly etapas = input<readonly Etapa[]>([]);
  /** Pode sair da etapa (falso: ganho/perdido para quem não reabre, R5.5). */
  readonly podeSair = input(true, { transform: booleanAttribute });
  readonly podeAssumir = input(false, { transform: booleanAttribute });
  readonly assumindo = input(false, { transform: booleanAttribute });
  readonly mostrarValor = input(true, { transform: booleanAttribute });
  /** Pego pelo teclado (modo de mover). */
  readonly pego = input(false, { transform: booleanAttribute });

  readonly acao = output<AcaoCartao>();
  readonly teclaMover = output<KeyboardEvent>();
  /** O foco saiu do botão "Mover" (o quadro solta o cartão pego, se for este). */
  readonly saiuDoMover = output<void>();

  protected readonly idResumo = computed(() => `cartao-${this.negocio().id}-resumo`);
  /** Lead do Marketing costuma ter o nome do contato como título: não repete. */
  protected readonly mostrarContato = computed(() => {
    const { titulo, contato } = this.negocio();
    return comparavel(contato.nome) !== comparavel(titulo);
  });
  protected readonly valor = computed(() =>
    formatarMoeda(this.negocio().valor, { centavos: false }),
  );
  protected readonly recorrente = computed(() => {
    const mensal = this.negocio().valorRecorrente;
    return mensal && Number(mensal) > 0 ? formatarMoeda(mensal, { centavos: false }) : null;
  });
  /** Sem responsável e ainda aberto: quem é da área pode assumir (ganho/perdido, não). */
  protected readonly oferecerAssumir = computed(() => {
    const { responsavel, status } = this.negocio();
    return !responsavel && status === 'ABERTO' && this.podeAssumir();
  });
  protected readonly dias = computed(() =>
    rotuloDias(this.negocio().diasNaEtapa, this.negocio().etapaDesde),
  );
  protected readonly dicaTempo = computed(() => {
    const { diasNaEtapa, parado, etapa, etapaDesde } = this.negocio();
    const tempo =
      diasNaEtapa <= 0
        ? `Entrou nesta etapa ${rotuloDias(0, etapaDesde)}`
        : `Há ${diasNaEtapa} ${diasNaEtapa === 1 ? 'dia' : 'dias'} nesta etapa`;
    if (parado && etapa.prazoDias) {
      return `Parado: ${tempo.toLowerCase()}, acima do prazo-alvo de ${etapa.prazoDias} ${etapa.prazoDias === 1 ? 'dia' : 'dias'}.`;
    }
    return `${tempo}.`;
  });
  protected readonly quandoProxima = computed(() => {
    const atividade = this.proxima();
    const quando = atividade?.inicioEm ?? atividade?.venceEm;
    return quando ? formatarTempoRelativo(quando) : null;
  });
  protected readonly itensMenu = computed<ItemMenuAcoes[]>(() => {
    const negocio = this.negocio();
    const itens: ItemMenuAcoes[] = [{ id: 'abrir', rotulo: 'Abrir detalhes' }];
    if (this.oferecerAssumir()) {
      itens.push({ id: 'assumir', rotulo: 'Assumir' });
    }
    this.etapas()
      .filter((etapa) => etapa.id !== negocio.etapa.id)
      .forEach((etapa, indice) => {
        itens.push({
          id: `mover:${etapa.id}`,
          rotulo: `Mover para ${etapa.nome}`,
          separarAntes: indice === 0,
          desabilitado: !this.podeSair(),
          motivo: this.podeSair()
            ? undefined
            : 'Só a liderança da área, C-level e Admin reabrem negócios fechados.',
        });
      });
    return itens;
  });

  protected primeiroNome(nome: string): string {
    return nome.trim().split(/\s+/)[0] ?? nome;
  }

  protected escolher(item: ItemMenuAcoes): void {
    if (item.id === 'abrir' || item.id === 'assumir') {
      this.acao.emit({ tipo: item.id });
    } else if (item.id.startsWith('mover:')) {
      this.acao.emit({ tipo: 'mover', etapaId: item.id.slice('mover:'.length) });
    }
  }
}

function comparavel(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
