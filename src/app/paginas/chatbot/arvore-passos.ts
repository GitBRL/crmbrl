import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  afterNextRender,
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
  LucideCopy,
  LucideDynamicIcon,
  LucidePlus,
  LucideTrash2,
} from '@lucide/angular';

import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Botao } from '../../ui/botao/botao';
import { Selo, type VarianteSelo } from '../../ui/selo/selo';
import { CondicoesRamo } from './condicoes-ramo';
import type { GrupoPasso, PassoDefinicao, RamoDefinicao, TipoDePasso } from './chatbot.tipos';
import { ContextoEditor } from './contexto-editor';
import {
  clonarPasso,
  contarPassos,
  DESCRICAO_DO_PASSO,
  ehSenao,
  MAXIMO_DE_PASSOS,
  moverItem,
  NIVEL_MAXIMO_DE_RAMOS,
  novoId,
  novoPasso,
  problemasDoPasso,
  RAMO_SENAO,
  resumoDoPasso,
  rotuloDoTipo,
  condicaoVazia,
} from './definicao';
import { FormularioPasso } from './formulario-passo';

const GRUPOS: readonly { grupo: GrupoPasso; rotulo: string; variante: VarianteSelo }[] = [
  { grupo: 'conversa', rotulo: 'Conversa', variante: 'ciano' },
  { grupo: 'logica', rotulo: 'Lógica', variante: 'lima' },
  { grupo: 'acao', rotulo: 'Ação', variante: 'menta' },
  { grupo: 'fim', rotulo: 'Final', variante: 'neutro' },
];

const TITULO_DO_MENU: Readonly<Record<GrupoPasso, string>> = {
  conversa: 'Conversar com o cliente',
  logica: 'Decidir o caminho',
  acao: 'Fazer algo no CRM',
  fim: 'Terminar o atendimento do robô',
};

/**
 * A lista de passos de um fluxo (e, recursivamente, a de cada caminho). Cada passo é um cartão
 * que abre para mostrar os campos; as setas reordenam, o menu "Adicionar passo" agrupa os tipos
 * do catálogo da API. Perguntas com opções e condições mostram um bloco de passos por caminho.
 */
@Component({
  selector: 'app-arvore-passos',
  imports: [Botao, BotaoIcone, CondicoesRamo, FormularioPasso, LucideDynamicIcon, Selo],
  templateUrl: './arvore-passos.html',
  styleUrl: './arvore-passos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArvorePassos {
  private readonly anunciador = inject(LiveAnnouncer);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  protected readonly contexto = inject(ContextoEditor);

  readonly passos = model<readonly PassoDefinicao[]>([]);
  readonly nome = input('Passos');
  readonly nivel = input(1);
  readonly somenteLeitura = input(false);
  /** Problemas apontados pela API (por id de passo), além do que falta preencher. */
  readonly problemasDaApi = input<ReadonlyMap<string, readonly string[]>>(new Map());
  readonly rotuloAdicionar = input('Adicionar passo');

  protected readonly icones = {
    subir: LucideArrowUp,
    descer: LucideArrowDown,
    remover: LucideTrash2,
    mais: LucidePlus,
    copiar: LucideCopy,
    abrir: LucideChevronDown,
  };
  protected readonly menuAberto = signal(false);

  protected readonly limiteAtingido = computed(
    () => this.contexto.totalDePassos() >= MAXIMO_DE_PASSOS,
  );

  protected readonly grupos = computed(() =>
    GRUPOS.map((g) => ({
      ...g,
      titulo: TITULO_DO_MENU[g.grupo],
      itens: this.contexto
        .catalogo()
        .filter(
          (tipo) =>
            tipo.grupo === g.grupo &&
            (!['opcoes', 'condicoes'].includes(tipo.ramos) || this.nivel() < NIVEL_MAXIMO_DE_RAMOS),
        ),
    })).filter((g) => g.itens.length > 0),
  );

  protected readonly linhas = computed(() => {
    const catalogo = this.contexto.catalogo();
    return this.passos().map((passo) => {
      const tipo = catalogo.find((t) => t.tipo === passo.tipo);
      const grupo = GRUPOS.find((g) => g.grupo === tipo?.grupo) ?? GRUPOS[2];
      const locais = problemasDoPasso(passo);
      const api = this.problemasDaApi().get(passo.id) ?? [];
      return {
        passo,
        tipo,
        descricao: DESCRICAO_DO_PASSO[passo.tipo] ?? tipo?.descricao ?? '',
        rotulo: rotuloDoTipo(catalogo, passo.tipo),
        grupo,
        resumo: [passo.rotulo, resumoDoPasso(passo)].filter(Boolean).join(' · '),
        problemas: [...new Set([...locais, ...api])],
        temRamos: (passo.ramos?.length ?? 0) > 0 || tipo?.ramos === 'condicoes',
        aberto: this.contexto.abertos().has(passo.id),
      };
    });
  });

  protected alternar(id: string): void {
    this.contexto.abertos.update((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(id)) {
        novo.add(id);
      }
      return novo;
    });
  }

  protected abrir(id: string): void {
    this.contexto.abertos.update((atual) => new Set(atual).add(id));
  }

  /** O editor chama para mostrar um passo (por exemplo, a partir de um problema da publicação). */
  revelar(id: string): boolean {
    const cartao = this.host.querySelector<HTMLElement>(`[data-passo="${id}"]`);
    if (!cartao) {
      return false;
    }
    this.abrir(id);
    cartao.scrollIntoView({ block: 'center', behavior: 'smooth' });
    afterNextRender(
      () => cartao.querySelector<HTMLElement>('.passo__resumo')?.focus({ preventScroll: true }),
      { injector: this.injector },
    );
    return true;
  }

  protected descricaoDe(tipo: TipoDePasso): string {
    return DESCRICAO_DO_PASSO[tipo.tipo] ?? tipo.descricao;
  }

  protected adicionar(tipo: TipoDePasso): void {
    if (this.limiteAtingido()) {
      return;
    }
    const passo = novoPasso(tipo.tipo);
    this.passos.set([...this.passos(), passo]);
    this.abrir(passo.id);
    this.menuAberto.set(false);
    this.anunciar(`Passo “${tipo.rotulo}” adicionado na posição ${this.passos().length}.`);
    this.focarPasso(passo.id);
  }

  protected async remover(passo: PassoDefinicao, rotulo: string): Promise<void> {
    const total = contarPassos([passo]);
    if (total > 1) {
      const ok = await this.confirmacao.confirmar({
        titulo: `Remover “${rotulo}”?`,
        mensagem: `Os ${total - 1} passos dentro dos caminhos deste passo também serão removidos.`,
        confirmar: 'Remover passo',
        perigo: true,
      });
      if (!ok) {
        return;
      }
    }
    const posicao = this.passos().findIndex((p) => p.id === passo.id);
    this.passos.set(this.passos().filter((p) => p.id !== passo.id));
    this.anunciar(`Passo “${rotulo}” removido.`);
    const vizinho = this.passos()[Math.min(posicao, this.passos().length - 1)];
    if (vizinho) {
      this.focarPasso(vizinho.id);
    } else {
      afterNextRender(() => this.host.querySelector<HTMLElement>('.lista__adicionar')?.focus(), {
        injector: this.injector,
      });
    }
  }

  protected duplicar(passo: PassoDefinicao): void {
    if (this.contexto.totalDePassos() + contarPassos([passo]) > MAXIMO_DE_PASSOS) {
      this.anunciar('O fluxo chegou ao limite de passos.');
      return;
    }
    const copia = clonarPasso(passo);
    const posicao = this.passos().findIndex((p) => p.id === passo.id);
    const lista = [...this.passos()];
    lista.splice(posicao + 1, 0, copia);
    this.passos.set(lista);
    this.abrir(copia.id);
    this.anunciar('Passo duplicado logo abaixo.');
    this.focarPasso(copia.id);
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

  protected substituir(novo: PassoDefinicao): void {
    this.passos.set(this.passos().map((passo) => (passo.id === novo.id ? novo : passo)));
  }

  protected mudarRamo(
    passo: PassoDefinicao,
    indice: number,
    passos: readonly PassoDefinicao[],
  ): void {
    this.substituir({
      ...passo,
      ramos: (passo.ramos ?? []).map((ramo, i) =>
        i === indice ? { ...ramo, passos: [...passos] } : ramo,
      ),
    });
  }

  protected mudarCondicaoDoRamo(passo: PassoDefinicao, indice: number, novo: RamoDefinicao): void {
    this.substituir({
      ...passo,
      ramos: (passo.ramos ?? []).map((ramo, i) =>
        i === indice ? { ...novo, passos: ramo.passos } : ramo,
      ),
    });
  }

  protected adicionarCaminho(passo: PassoDefinicao): void {
    const ramos = [...(passo.ramos ?? [])];
    const novo: RamoDefinicao = {
      id: novoId('ramo'),
      rotulo: `Caminho ${ramos.filter((r) => !ehSenao(r)).length + 1}`,
      config: { condicoes: [condicaoVazia()] },
      passos: [],
    };
    const posicaoSenao = ramos.findIndex(ehSenao);
    ramos.splice(posicaoSenao === -1 ? ramos.length : posicaoSenao, 0, novo);
    this.substituir({ ...passo, ramos });
    this.anunciar('Caminho adicionado.');
  }

  protected temSenao(passo: PassoDefinicao): boolean {
    return (passo.ramos ?? []).some(ehSenao);
  }

  protected adicionarSenao(passo: PassoDefinicao): void {
    this.substituir({
      ...passo,
      ramos: [...(passo.ramos ?? []), { id: RAMO_SENAO, rotulo: 'Senão', passos: [] }],
    });
  }

  protected async removerRamo(passo: PassoDefinicao, indice: number): Promise<void> {
    const ramo = (passo.ramos ?? [])[indice];
    const total = contarPassos(ramo.passos);
    if (total > 0) {
      const ok = await this.confirmacao.confirmar({
        titulo: 'Remover este caminho?',
        mensagem: `Os ${total} passos dentro dele também serão removidos.`,
        confirmar: 'Remover caminho',
        perigo: true,
      });
      if (!ok) {
        return;
      }
    }
    this.substituir({ ...passo, ramos: (passo.ramos ?? []).filter((_, i) => i !== indice) });
  }

  protected ehCondicao(passo: PassoDefinicao): boolean {
    return passo.tipo === 'condicao';
  }

  protected ehSenao = ehSenao;

  protected tituloDoRamo(ramo: RamoDefinicao, passo: PassoDefinicao): string {
    if (passo.tipo === 'pergunta.opcoes' && !['sem_resposta', 'invalida'].includes(ramo.id)) {
      return `Se o cliente escolher: ${ramo.rotulo || 'opção sem texto'}`;
    }
    return ramo.rotulo || 'Caminho';
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
}
