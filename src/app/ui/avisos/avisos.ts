import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  untracked,
} from '@angular/core';
import {
  LucideCheck,
  LucideDynamicIcon,
  LucideInfo,
  LucideX,
  type LucideIconInput,
} from '@lucide/angular';

import { Botao } from '../botao/botao';
import { BotaoIcone } from '../botao-icone/botao-icone';
import { CamadaModal } from '../camada-modal';

export type TipoAviso = 'sucesso' | 'erro' | 'info' | 'atencao';

/** Um aviso (toast). Quem cria é o `AvisosService` do núcleo; este componente só mostra. */
export interface Aviso {
  readonly id: number | string;
  readonly tipo: TipoAviso;
  /** Frase curta, em português, dizendo o que aconteceu ("Contato salvo."). */
  readonly mensagem: string;
  readonly titulo?: string;
  /** Rótulo do botão de ação ("Desfazer", "Tentar de novo"): o clique emite `(agir)`. */
  readonly acao?: string;
  /** `requisicaoId` de um erro do servidor, para o suporte. */
  readonly codigo?: string;
  /**
   * Quanto tempo fica (ms); 0 = até a pessoa fechar. Padrão: 5 s; 20 s com ação; erro fica.
   * O tempo para enquanto o mouse ou o foco estão nos avisos.
   */
  readonly duracao?: number;
}

const ICONES: Readonly<Record<TipoAviso, LucideIconInput>> = {
  sucesso: LucideCheck,
  erro: LucideX,
  info: LucideInfo,
  atencao: LucideInfo,
};

const PREFIXO: Readonly<Record<TipoAviso, string>> = {
  sucesso: '',
  erro: 'Erro: ',
  info: '',
  atencao: 'Atenção: ',
};

/** Tecla que leva o foco aos avisos (e de volta), como o F8 das regiões de toasts. */
export const ATALHO_AVISOS = 'F8';

/**
 * Aviso com ação ("Desfazer") fica mais: dá tempo de ouvir o anúncio e chegar até ele pelo
 * teclado (F8), e o tempo ainda para com o foco ou o mouse na pilha (WCAG 2.2.1).
 */
export const DURACAO_COM_ACAO_MS = 20_000;
export const DURACAO_PADRAO_MS = 5_000;

/** Duração padrão de um aviso, em ms (0 = fica até fechar). */
export function duracaoDoAviso(aviso: Aviso): number {
  if (aviso.duracao !== undefined) {
    return aviso.duracao;
  }
  if (aviso.tipo === 'erro') {
    return 0;
  }
  return aviso.acao ? DURACAO_COM_ACAO_MS : DURACAO_PADRAO_MS;
}

interface Cronometro {
  restante: number;
  inicio: number;
  espera: ReturnType<typeof setTimeout> | undefined;
}

/**
 * Host dos avisos (DESIGN-SYSTEM.md §4.4): a pilha de toasts no canto inferior (direito no
 * desktop; largura toda no celular). Fica uma vez na casca, ligado ao serviço:
 *
 * `<app-avisos [avisos]="avisos.lista()" (dispensar)="avisos.dispensar($event)" (agir)="avisos.agir($event)" />`
 *
 * - Conta o tempo de cada aviso e emite `(dispensar)` com o id; o tempo **para** enquanto o
 *   mouse ou o foco estão na pilha (WCAG 2.2.1). Fechar (×) também emite `(dispensar)`.
 * - A ação emite `(agir)` e depois `(dispensar)`.
 * - Anuncia cada aviso novo pelo `LiveAnnouncer` do CDK: erro de forma assertiva, os outros de
 *   forma educada (os toasts em si não são regiões vivas, para não repetir).
 * - **F8** leva o foco ao aviso mais novo (o que tem ação, se houver); F8 ou Esc lá dentro
 *   devolvem o foco para onde estava. Quando o aviso com o foco sai, o foco vai para o
 *   próximo aviso ou volta para onde estava.
 * - Usa a Popover API (camada superior): fica visível até por cima de um modal aberto. Com um
 *   `<dialog>` modal aberto, o host mora dentro dele (`CamadaModal`): fora, ficaria inerte.
 */
@Component({
  selector: 'app-avisos',
  imports: [Botao, BotaoIcone, LucideDynamicIcon],
  template: `
    <ol class="avisos__lista" role="list">
      @for (aviso of avisos(); track aviso.id) {
        <li class="aviso" [class]="'aviso--' + aviso.tipo">
          <span class="aviso__icone" aria-hidden="true">
            <svg [lucideIcon]="icones[aviso.tipo]" [size]="16" [strokeWidth]="2.5" />
          </span>
          <div class="aviso__textos">
            @if (aviso.titulo) {
              <p class="aviso__titulo">{{ aviso.titulo }}</p>
            }
            <p class="aviso__mensagem">{{ aviso.mensagem }}</p>
            @if (aviso.codigo) {
              <p class="aviso__codigo">Código para o suporte: {{ aviso.codigo }}</p>
            }
          </div>
          @if (aviso.acao) {
            <button
              appBotao
              type="button"
              class="aviso__acao"
              tamanho="sm"
              variante="contorno"
              (click)="agirEm(aviso)"
            >
              {{ aviso.acao }}
            </button>
          }
          <button
            appBotaoIcone
            type="button"
            class="aviso__fechar"
            tamanho="sm"
            variante="contorno"
            rotulo="Fechar aviso"
            [icone]="iconeFechar"
            (click)="fechar(aviso.id)"
          ></button>
        </li>
      }
    </ol>
  `,
  styleUrl: './avisos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'avisos',
    role: 'region',
    'aria-label': 'Avisos (F8)',
    '[class.avisos--vazio]': '!avisos().length',
    '(mouseenter)': 'pausar()',
    '(mouseleave)': 'retomar()',
    '(focusin)': 'aoEntrarNoFoco($event)',
    '(focusout)': 'aoSairDoFoco($event)',
    '(keydown.escape)': 'voltarComEsc($event)',
    '(document:keydown)': 'aoTeclarNoDocumento($event)',
  },
})
export class Avisos {
  readonly avisos = input<readonly Aviso[]>([]);
  /** O aviso deve sair da lista (tempo esgotado, fechar ou depois da ação). */
  readonly dispensar = output<Aviso['id']>();
  /** A pessoa clicou na ação do aviso. */
  readonly agir = output<Aviso['id']>();

  protected readonly icones = ICONES;
  protected readonly iconeFechar = LucideX;
  protected readonly suportaPopover =
    typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

  private readonly anunciador = inject(LiveAnnouncer);
  private readonly documento = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly cronometros = new Map<Aviso['id'], Cronometro>();
  private readonly anunciados = new Set<Aviso['id']>();
  private pausado = false;
  /** Onde o foco estava antes de entrar na pilha (F8 ou Tab): para onde ele volta. */
  private retorno: HTMLElement | null = null;

  constructor() {
    // Atributo fixo (antes do primeiro showPopover, que exige um `popover` válido).
    if (this.suportaPopover) {
      this.host.setAttribute('popover', 'manual');
    }
    effect(() => {
      const avisos = this.avisos();
      untracked(() => this.acompanhar(avisos));
    });
    // Com um modal aberto, a pilha passa a morar dentro dele (e volta quando ele fecha). Mudar
    // de lugar fecha o popover: reabre.
    const camada = inject(CamadaModal);
    let pararDeAcompanhar: (() => void) | null = null;
    afterNextRender(() => {
      pararDeAcompanhar = camada.acompanhar(this.host, () =>
        this.atualizarCamada(this.avisos().length > 0, true),
      );
    });
    inject(DestroyRef).onDestroy(() => {
      pararDeAcompanhar?.();
      for (const cronometro of this.cronometros.values()) {
        clearTimeout(cronometro.espera);
      }
    });
  }

  protected fechar(id: Aviso['id'], depois: 'proximo' | 'voltar' = 'proximo'): void {
    const tinhaFoco = this.host.contains(this.documento.activeElement);
    this.pararCronometro(id);
    this.dispensar.emit(id);
    if (tinhaFoco) {
      afterNextRender(() => this.recolocarFoco(depois), { injector: this.injector });
    }
  }

  protected agirEm(aviso: Aviso): void {
    this.agir.emit(aviso.id);
    this.fechar(aviso.id, 'voltar');
  }

  /** F8: vai ao aviso mais novo (de preferência um com ação); F8 de novo volta. */
  protected aoTeclarNoDocumento(evento: KeyboardEvent): void {
    if (
      evento.key !== ATALHO_AVISOS ||
      evento.altKey ||
      evento.ctrlKey ||
      evento.metaKey ||
      evento.shiftKey ||
      evento.defaultPrevented
    ) {
      return;
    }
    evento.preventDefault();
    if (this.host.contains(this.documento.activeElement)) {
      this.voltarAoRetorno();
      return;
    }
    const alvo = this.alvoDoFoco();
    if (!alvo) {
      void this.anunciador.announce('Nenhum aviso na tela.', 'polite');
      return;
    }
    this.retorno = this.documento.activeElement as HTMLElement | null;
    alvo.focus();
  }

  /** Esc dentro da pilha devolve o foco (e não fecha o modal em volta). */
  protected voltarComEsc(evento: Event): void {
    if (!this.retorno?.isConnected) {
      return;
    }
    evento.preventDefault();
    evento.stopPropagation();
    this.voltarAoRetorno();
  }

  protected aoEntrarNoFoco(evento: FocusEvent): void {
    const origem = evento.relatedTarget as HTMLElement | null;
    if (origem && !this.host.contains(origem)) {
      this.retorno = origem;
    }
    this.pausar();
  }

  protected pausar(): void {
    if (this.pausado) {
      return;
    }
    this.pausado = true;
    const agora = Date.now();
    for (const cronometro of this.cronometros.values()) {
      if (cronometro.espera !== undefined) {
        clearTimeout(cronometro.espera);
        cronometro.espera = undefined;
        cronometro.restante -= agora - cronometro.inicio;
      }
    }
  }

  protected retomar(): void {
    if (!this.pausado || this.host.contains(this.host.ownerDocument.activeElement)) {
      return;
    }
    this.pausado = false;
    for (const [id, cronometro] of this.cronometros) {
      this.iniciar(id, cronometro);
    }
  }

  protected aoSairDoFoco(evento: FocusEvent): void {
    const destino = evento.relatedTarget as Node | null;
    if (!destino || !this.host.contains(destino)) {
      // O foco saiu da pilha: o tempo volta a correr (se o mouse também não estiver nela).
      queueMicrotask(() => {
        if (!this.host.matches(':hover')) {
          this.retomar();
        }
      });
    }
  }

  /** O botão que recebe o foco pelo F8: a ação do aviso mais novo que tem uma, ou o "×". */
  private alvoDoFoco(): HTMLElement | null {
    // Do mais novo ao mais antigo.
    const avisos = [...this.host.querySelectorAll<HTMLElement>('.aviso')].reverse();
    const comAcao = avisos.find((aviso) => aviso.querySelector('.aviso__acao'));
    return (
      comAcao?.querySelector<HTMLElement>('.aviso__acao') ??
      avisos[0]?.querySelector<HTMLElement>('.aviso__fechar') ??
      null
    );
  }

  /** O aviso com o foco saiu: vai para o próximo aviso ou volta para onde estava. */
  private recolocarFoco(depois: 'proximo' | 'voltar'): void {
    const ativo = this.documento.activeElement;
    if (ativo && ativo !== this.documento.body && ativo.isConnected) {
      return; // a própria ação já levou o foco para algum lugar
    }
    const proximo = depois === 'proximo' ? this.alvoDoFoco() : null;
    if (proximo) {
      proximo.focus();
    } else {
      this.voltarAoRetorno();
    }
  }

  private voltarAoRetorno(): void {
    const retorno = this.retorno;
    this.retorno = null;
    if (retorno?.isConnected) {
      retorno.focus();
    }
  }

  /** Começa os cronômetros dos avisos novos, anuncia e mostra/esconde a camada. */
  private acompanhar(avisos: readonly Aviso[]): void {
    const ids = new Set(avisos.map((aviso) => aviso.id));
    for (const id of [...this.cronometros.keys()]) {
      if (!ids.has(id)) {
        this.pararCronometro(id);
      }
    }
    for (const id of [...this.anunciados]) {
      if (!ids.has(id)) {
        this.anunciados.delete(id);
      }
    }
    let houveNovo = false;
    for (const aviso of avisos) {
      if (this.anunciados.has(aviso.id)) {
        continue;
      }
      houveNovo = true;
      this.anunciados.add(aviso.id);
      this.anunciar(aviso);
      const duracao = duracaoDoAviso(aviso);
      if (duracao > 0) {
        const cronometro: Cronometro = { restante: duracao, inicio: 0, espera: undefined };
        this.cronometros.set(aviso.id, cronometro);
        if (!this.pausado) {
          this.iniciar(aviso.id, cronometro);
        }
      }
    }
    this.atualizarCamada(avisos.length > 0, houveNovo);
  }

  private iniciar(id: Aviso['id'], cronometro: Cronometro): void {
    cronometro.inicio = Date.now();
    cronometro.espera = setTimeout(() => this.fechar(id), Math.max(0, cronometro.restante));
  }

  private pararCronometro(id: Aviso['id']): void {
    const cronometro = this.cronometros.get(id);
    if (cronometro) {
      clearTimeout(cronometro.espera);
      this.cronometros.delete(id);
    }
  }

  private anunciar(aviso: Aviso): void {
    const partes = [
      PREFIXO[aviso.tipo] + (aviso.titulo ? `${aviso.titulo}. ` : '') + aviso.mensagem,
    ];
    if (aviso.acao) {
      partes.push(`Ação disponível nos avisos: ${aviso.acao}. ${ATALHO_AVISOS} leva até ela.`);
    }
    void this.anunciador.announce(partes.join(' '), aviso.tipo === 'erro' ? 'assertive' : 'polite');
  }

  /**
   * Na camada superior, por cima até de um modal: a cada aviso novo a camada é reaberta para
   * ficar acima do que abriu depois dela. Sem a Popover API, `position: fixed` com z-index.
   */
  private atualizarCamada(temAvisos: boolean, houveNovo: boolean): void {
    if (!this.suportaPopover) {
      return;
    }
    const aberto = this.host.matches(':popover-open');
    if (!temAvisos) {
      if (aberto) {
        this.host.hidePopover();
      }
      return;
    }
    try {
      if (aberto && houveNovo) {
        this.host.hidePopover();
      }
      if (!aberto || houveNovo) {
        this.host.showPopover();
      }
    } catch {
      // Fora do documento (destruído no meio do caminho): nada a mostrar.
    }
  }
}
