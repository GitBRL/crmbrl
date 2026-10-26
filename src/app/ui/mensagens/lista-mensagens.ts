import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
  VIRTUAL_SCROLL_STRATEGY,
} from '@angular/cdk/scrolling';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { LucideArrowDown } from '@lucide/angular';

import { Botao } from '../botao/botao';
import { BotaoIcone } from '../botao-icone/botao-icone';
import { Esqueleto } from '../esqueleto/esqueleto';
import { BolhaMensagem, type NomesNasBolhas } from './bolha-mensagem';
import { Digitando } from './digitando';
import { EstrategiaAlturaVariavel } from './estrategia-altura-variavel';
import { type ItemLista, itensDaLista, type MensagemConversa, ROTULO_TIPO } from './mensagens';
import { SeparadorData } from './separador-data';

/** Quantos caracteres da mensagem nova o leitor de tela ouve. */
const TAMANHO_ANUNCIO = 140;

/**
 * Lista de mensagens de uma conversa (DESIGN-SYSTEM.md §4.6), com **rolagem virtual** do
 * `@angular/cdk/scrolling` (só as mensagens perto da área visível ficam no DOM; alturas
 * variáveis medidas de verdade — `EstrategiaAlturaVariavel`):
 *
 * - começa na mensagem mais recente e acompanha o fim enquanto a pessoa estiver nele; rolando
 *   para cima, aparece o círculo "↓" com a contagem das que chegaram nesse meio-tempo;
 * - perto do topo pede as anteriores (`(carregarAnteriores)`, também pelo botão no começo da
 *   lista) e, quando elas entram, a mensagem que estava na tela não sai do lugar;
 * - separador a cada dia, mensagens seguidas do mesmo autor agrupadas, "digitando…" embaixo;
 * - carregando: bolhas-esqueleto; vazia: a frase de `textoVazio`.
 *
 * A área rola pelo teclado (é focável, com nome) e as mensagens novas que chegam de outra
 * pessoa são anunciadas ao leitor de tela ("Nova mensagem de Maria: …").
 *
 * A altura vem do contêiner: ponha a lista num pai com altura definida (flex/grid).
 *
 * ```html
 * <app-lista-mensagens
 *   [mensagens]="mensagens()"
 *   [temAnteriores]="temMais()"
 *   [carregandoAnteriores]="carregandoMais()"
 *   [digitando]="['Maria']"
 *   nomes="saida"
 *   (carregarAnteriores)="carregarMais()"
 *   (tentarDeNovo)="reenviar($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-lista-mensagens',
  imports: [
    CdkVirtualScrollViewport,
    CdkVirtualForOf,
    BolhaMensagem,
    Botao,
    BotaoIcone,
    Digitando,
    Esqueleto,
    SeparadorData,
  ],
  templateUrl: './lista-mensagens.html',
  styleUrl: './lista-mensagens.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: VIRTUAL_SCROLL_STRATEGY, useFactory: () => new EstrategiaAlturaVariavel() },
  ],
  host: { class: 'lista-mensagens' },
})
export class ListaMensagens {
  /** Da mais antiga para a mais nova. */
  readonly mensagens = input<readonly MensagemConversa[]>([]);
  /** Primeira carga (sem mensagens ainda): mostra as bolhas-esqueleto. */
  readonly carregando = input(false, { transform: booleanAttribute });
  /** Há mensagens mais antigas para buscar. */
  readonly temAnteriores = input(false, { transform: booleanAttribute });
  readonly carregandoAnteriores = input(false, { transform: booleanAttribute });
  /** Quem está digitando agora (nomes). */
  readonly digitando = input<readonly string[]>([]);
  /** Quais direções mostram o nome do autor (ver `app-bolha-mensagem`). */
  readonly nomes = input<NomesNasBolhas>('entrada');
  readonly avatares = input(true, { transform: booleanAttribute });
  /** Nome da área que rola, para o leitor de tela. */
  readonly rotulo = input('Mensagens');
  readonly textoVazio = input('Nenhuma mensagem ainda.');
  /** Anunciar ao leitor de tela as mensagens que chegam de outra pessoa. */
  readonly anunciar = input(true, { transform: booleanAttribute });

  readonly carregarAnteriores = output<void>();
  readonly tentarDeNovo = output<MensagemConversa>();

  protected readonly icones = { fim: LucideArrowDown };
  protected readonly itens = computed(() => itensDaLista(this.mensagens()));
  /** Está no fim da conversa. */
  protected readonly noFim = signal(true);
  /** Mensagens que chegaram enquanto a pessoa lia mais acima. */
  protected readonly novas = signal(0);
  protected readonly rotuloIrAoFim = computed(() => {
    const novas = this.novas();
    if (novas <= 0) {
      return 'Ir para a mensagem mais recente';
    }
    return novas === 1 ? 'Ir para a mensagem nova' : `Ir para as ${novas} mensagens novas`;
  });

  private readonly estrategia = inject(VIRTUAL_SCROLL_STRATEGY) as EstrategiaAlturaVariavel;
  private readonly anunciador = inject(LiveAnnouncer);

  constructor() {
    this.estrategia.chaves = () => untracked(this.itens).map((item) => item.id);
    this.estrategia.podeAncorar = (chave) => chave.startsWith('m:');
    this.estrategia.aoMudarFim = (noFim) => {
      this.noFim.set(noFim);
      if (noFim) {
        this.novas.set(0);
      }
    };
    this.estrategia.aoChegarNoTopo = () => {
      if (untracked(this.temAnteriores) && !untracked(this.carregandoAnteriores)) {
        this.carregarAnteriores.emit();
      }
    };

    // Mensagens novas no fim: anuncia as de outra pessoa e conta as que chegaram fora do fim.
    // Troca de conversa (nada em comum com a lista anterior): volta para o fim.
    let anteriores: readonly MensagemConversa[] = [];
    effect(() => {
      const atuais = this.mensagens();
      untracked(() => {
        const ultimaAntes = anteriores[anteriores.length - 1];
        const indice = ultimaAntes ? atuais.findIndex((m) => m.id === ultimaAntes.id) : -1;
        if (ultimaAntes && indice === -1) {
          this.novas.set(0);
          this.estrategia.rolarParaOFim();
        } else if (ultimaAntes) {
          const chegaram = atuais.slice(indice + 1);
          if (chegaram.length && !this.estrategia.noFim) {
            this.novas.update((total) => total + chegaram.length);
          }
          const deOutros = chegaram.filter((m) => m.direcao === 'ENTRADA');
          if (this.anunciar() && deOutros.length) {
            void this.anunciador.announce(this.anuncio(deOutros), 'polite');
          }
        }
        anteriores = atuais;
      });
    });
  }

  /** Vai para a mensagem mais recente (e volta a acompanhar o fim). */
  rolarParaOFim(comportamento: ScrollBehavior = 'auto'): void {
    this.novas.set(0);
    this.estrategia.rolarParaOFim(comportamento);
  }

  /** Leva a mensagem `id` para a área visível (se ela estiver carregada). */
  rolarAte(id: string, comportamento: ScrollBehavior = 'auto'): boolean {
    const indice = this.itens().findIndex((item) => item.id === `m:${id}`);
    if (indice < 0) {
      return false;
    }
    this.estrategia.scrollToIndex(indice, comportamento);
    return true;
  }

  protected rastrear(_indice: number, item: ItemLista): string {
    return item.id;
  }

  protected pedirAnteriores(): void {
    if (this.temAnteriores() && !this.carregandoAnteriores()) {
      this.carregarAnteriores.emit();
    }
  }

  private anuncio(mensagens: readonly MensagemConversa[]): string {
    const ultima = mensagens[mensagens.length - 1];
    const autor = ultima.autor?.nome ? ` de ${ultima.autor.nome}` : '';
    const texto = (ultima.texto ?? '').trim() || ROTULO_TIPO[ultima.tipo];
    const corte = texto.length > TAMANHO_ANUNCIO ? `${texto.slice(0, TAMANHO_ANUNCIO)}…` : texto;
    return mensagens.length === 1
      ? `Nova mensagem${autor}: ${corte}`
      : `${mensagens.length} mensagens novas. A última${autor}: ${corte}`;
  }
}
