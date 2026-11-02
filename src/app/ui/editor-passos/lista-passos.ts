import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  signal,
} from '@angular/core';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideChevronDown,
  LucideDynamicIcon,
  LucideGripVertical,
  LucidePlus,
  LucideTrash2,
} from '@lucide/angular';

import { AreaTexto } from '../area-texto/area-texto';
import { BotaoIcone } from '../botao-icone/botao-icone';
import { Botao } from '../botao/botao';
import { CampoTexto } from '../campo-texto/campo-texto';
import { Selo, type VarianteSelo } from '../selo/selo';
import { type OpcaoSeletor, Seletor } from '../seletor/seletor';
import { gerarId } from '../tipos';
import {
  camposFaltando,
  type CampoPasso,
  type DefinicaoPasso,
  type FasePasso,
  moverItem,
  novoPasso,
  type Passo,
  resumirPasso,
  ROTULO_FASE,
  type ValorConfig,
} from './passos';

const FASES_ADICIONAR: readonly FasePasso[] = ['se', 'entao', 'aguardar'];
const VARIANTE_FASE: Readonly<Record<FasePasso, VarianteSelo>> = {
  quando: 'lima',
  se: 'ciano',
  entao: 'menta',
  aguardar: 'neutro',
};

/**
 * Uma lista de passos do editor (`app-editor-passos`): os cartões dos passos, a alça de arrastar,
 * as setas de mover, o corpo com os campos, os ramos (cada um é outra `app-lista-passos`) e o
 * menu "Adicionar passo". Uso interno do editor; `fixo` desliga arrastar, mover, remover e
 * adicionar (o cartão do gatilho).
 */
@Component({
  selector: 'app-lista-passos',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    LucideDynamicIcon,
    LucideGripVertical,
    Botao,
    BotaoIcone,
    Selo,
    Seletor,
    CampoTexto,
    AreaTexto,
  ],
  templateUrl: './lista-passos.html',
  styleUrl: './lista-passos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListaPassos {
  private readonly anunciador = inject(LiveAnnouncer);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  readonly passos = model<readonly Passo[]>([]);
  readonly definicoes = input.required<readonly DefinicaoPasso[]>();
  /** Nome da lista para leitores de tela ("Passos", "Se sim"). */
  readonly nome = input('Passos');
  /** Cartão do gatilho: sem arrastar, mover, remover nem adicionar. */
  readonly fixo = input(false, { transform: booleanAttribute });
  readonly somenteLeitura = input(false, { transform: booleanAttribute });
  /** Quantos níveis de ramo ainda cabem aqui dentro (0 = sem passos com ramos). */
  readonly niveisRestantes = input(2);
  /** Texto do botão de adicionar. */
  readonly rotuloAdicionar = input('Adicionar passo');

  protected readonly icones = {
    subir: LucideArrowUp,
    descer: LucideArrowDown,
    remover: LucideTrash2,
    mais: LucidePlus,
    abrir: LucideChevronDown,
  };
  protected readonly idLista = gerarId('passos');
  protected readonly adicionando = signal(false);
  private readonly abertos = signal<ReadonlySet<string>>(new Set());

  private readonly porTipo = computed(
    () => new Map(this.definicoes().map((definicao) => [definicao.tipo, definicao])),
  );

  /** Cada passo com a definição e o que o cartão mostra. */
  protected readonly linhas = computed(() =>
    this.passos().map((passo) => {
      const definicao = this.porTipo().get(passo.tipo);
      const faltando = camposFaltando(definicao, passo);
      return {
        passo,
        definicao,
        fase: definicao?.fase ?? 'entao',
        rotuloFase: ROTULO_FASE[definicao?.fase ?? 'entao'],
        variante: VARIANTE_FASE[definicao?.fase ?? 'entao'],
        resumo: resumirPasso(definicao, passo),
        faltando,
        trocas: this.trocasDe(definicao),
        aberto: this.abertos().has(passo.id),
      };
    }),
  );

  /** Grupos do menu de adicionar: só as fases com definições que cabem neste nível. */
  protected readonly grupos = computed(() =>
    FASES_ADICIONAR.map((fase) => ({
      fase,
      rotulo: ROTULO_FASE[fase],
      itens: this.definicoes().filter(
        (definicao) =>
          definicao.fase === fase && (!definicao.ramos?.length || this.niveisRestantes() > 0),
      ),
    })).filter((grupo) => grupo.itens.length > 0),
  );

  protected alternar(id: string): void {
    this.abertos.update((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(id)) {
        novo.add(id);
      }
      return novo;
    });
  }

  protected adicionar(definicao: DefinicaoPasso): void {
    const passo = novoPasso(definicao, gerarId('passo'));
    this.passos.set([...this.passos(), passo]);
    this.abertos.update((atual) => new Set(atual).add(passo.id));
    this.adicionando.set(false);
    this.anunciar(`Passo “${definicao.rotulo}” adicionado na posição ${this.passos().length}.`);
    this.focarPasso(passo.id);
  }

  protected remover(passo: Passo, definicao: DefinicaoPasso | undefined): void {
    const posicao = this.passos().findIndex((p) => p.id === passo.id);
    this.passos.set(this.passos().filter((p) => p.id !== passo.id));
    this.anunciar(`Passo “${definicao?.rotulo ?? passo.tipo}” removido.`);
    // O foco vai para o vizinho (ou para o menu de adicionar), nunca se perde.
    const vizinho = this.passos()[Math.min(posicao, this.passos().length - 1)];
    if (vizinho) {
      this.focarPasso(vizinho.id);
    } else {
      this.focarAdicionar();
    }
  }

  protected mover(indice: number, deslocamento: -1 | 1): void {
    const destino = indice + deslocamento;
    if (destino < 0 || destino >= this.passos().length) {
      return;
    }
    const passo = this.passos()[indice];
    this.passos.set(moverItem(this.passos(), indice, destino));
    this.anunciar(`Passo movido para a posição ${destino + 1} de ${this.passos().length}.`);
    this.focarPasso(passo.id, deslocamento === -1 ? 'subir' : 'descer');
  }

  protected aoSoltar(evento: CdkDragDrop<readonly Passo[]>): void {
    if (evento.previousIndex !== evento.currentIndex) {
      this.passos.set(moverItem(this.passos(), evento.previousIndex, evento.currentIndex));
      this.anunciar(
        `Passo movido para a posição ${evento.currentIndex + 1} de ${this.passos().length}.`,
      );
    }
  }

  protected mudarCampo(passo: Passo, campo: CampoPasso, bruto: string | number | null): void {
    let valor: ValorConfig = bruto;
    if (campo.tipo === 'numero') {
      valor = bruto === null || bruto === '' || Number.isNaN(Number(bruto)) ? null : Number(bruto);
    }
    this.substituir({ ...passo, config: { ...passo.config, [campo.id]: valor } });
  }

  protected trocarTipo(passo: Passo, tipo: string | null): void {
    const definicao = this.porTipo().get(tipo ?? '');
    if (definicao && definicao.tipo !== passo.tipo) {
      // Os campos mudam com o tipo: os valores antigos não valem mais.
      this.substituir(novoPasso(definicao, passo.id));
    }
  }

  protected mudarRamo(passo: Passo, indice: number, passos: readonly Passo[]): void {
    this.substituir({
      ...passo,
      ramos: (passo.ramos ?? []).map((ramo, i) => (i === indice ? { ...ramo, passos } : ramo)),
    });
  }

  protected textoDe(passo: Passo, campo: CampoPasso): string | null {
    const valor = passo.config[campo.id];
    return valor === null || valor === undefined ? null : String(valor);
  }

  protected idCorpo(passo: Passo): string {
    return `${this.idLista}-${passo.id}`;
  }

  private substituir(novo: Passo): void {
    this.passos.set(this.passos().map((passo) => (passo.id === novo.id ? novo : passo)));
  }

  /** Tipos de passo da mesma fase, para trocar o tipo sem apagar e criar de novo. */
  private trocasDe(definicao: DefinicaoPasso | undefined): readonly OpcaoSeletor<string>[] {
    if (!definicao) {
      return [];
    }
    return this.definicoes()
      .filter(
        (outra) =>
          outra.fase === definicao.fase &&
          (outra.tipo === definicao.tipo || !outra.ramos?.length || this.niveisRestantes() > 0),
      )
      .map((outra) => ({ valor: outra.tipo, rotulo: outra.rotulo }));
  }

  private anunciar(mensagem: string): void {
    void this.anunciador.announce(mensagem, 'polite');
  }

  private focarPasso(id: string, botao?: 'subir' | 'descer'): void {
    afterNextRender(
      () => {
        const cartao = this.host.querySelector<HTMLElement>(`[data-passo="${id}"]`);
        const alvo =
          (botao ? cartao?.querySelector<HTMLElement>(`[data-acao="${botao}"]`) : null) ??
          cartao?.querySelector<HTMLElement>('.passo__resumo');
        alvo?.focus();
      },
      { injector: this.injector },
    );
  }

  private focarAdicionar(): void {
    afterNextRender(() => this.host.querySelector<HTMLElement>('.lista__adicionar')?.focus(), {
      injector: this.injector,
    });
  }
}
