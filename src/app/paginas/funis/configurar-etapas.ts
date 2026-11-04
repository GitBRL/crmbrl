import { CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideGripVertical,
  LucidePlus,
  LucideX,
} from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { paraNumero } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { CampoTexto, type ValorCampoTexto } from '../../ui/campo-texto/campo-texto';
import { Modal } from '../../ui/modal/modal';
import { Selo } from '../../ui/selo/selo';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { IntegracoesDoFunil } from '../integracoes/integracoes-do-funil';
import { FunisApi } from './funis.api';
import type { AlteracaoEtapa, Etapa, Funil } from './funis.tipos';
import { ordenarEtapas } from './regras-funis';

/** O que está sendo digitado numa linha (ainda não salvo). */
interface Rascunho {
  readonly nome: ValorCampoTexto;
  readonly prazo: ValorCampoTexto;
  readonly probabilidade: ValorCampoTexto;
}

const NOME_MAXIMO = 100;
/** Limites da API (crmbrl-api, dto/funis.dto.ts): prazo de 1 a 3.650 dias. */
const PRAZO_MAXIMO = 3650;

/** Erros de uma linha (ou da etapa nova), por campo. */
interface ErrosLinha {
  readonly nome?: string | null;
  readonly prazo?: string | null;
  readonly probabilidade?: string | null;
  readonly geral?: string | null;
}

/** Valida nome, prazo (dias inteiros, de 1 a 3.650) e probabilidade (0 a 100) — os limites da API. */
export function validarRascunho(rascunho: Rascunho): ErrosLinha {
  const nome = String(rascunho.nome ?? '').trim();
  const prazo = paraNumero(rascunho.prazo);
  const probabilidade = paraNumero(rascunho.probabilidade);
  return {
    nome: !nome
      ? 'Dê um nome à etapa.'
      : nome.length > NOME_MAXIMO
        ? `Use no máximo ${NOME_MAXIMO} caracteres.`
        : null,
    prazo:
      prazo !== null && (!Number.isInteger(prazo) || prazo < 1 || prazo > PRAZO_MAXIMO)
        ? 'Use um número inteiro de dias, de 1 a 3.650 (vazio: sem prazo).'
        : null,
    probabilidade:
      probabilidade !== null &&
      (!Number.isInteger(probabilidade) || probabilidade < 0 || probabilidade > 100)
        ? 'Use um número inteiro de 0 a 100.'
        : null,
  };
}

function temErro(erros: ErrosLinha): boolean {
  return !!(erros.nome || erros.prazo || erros.probabilidade);
}

function rascunhoDe(etapa: Etapa): Rascunho {
  return {
    nome: etapa.nome,
    prazo: etapa.prazoDias ?? null,
    probabilidade: etapa.probabilidade ?? null,
  };
}

const VAZIO: Rascunho = { nome: '', prazo: null, probabilidade: null };

/** Por que a etapa não sai: "Tem 1 negócio: mova-o…", "Tem 3 negócios: mova-os…" (R5.2). */
export function textoEtapaComNegocios(quantos: number): string {
  return quantos === 1
    ? 'Tem 1 negócio: mova-o para outra etapa antes de remover.'
    : `Tem ${quantos} negócios: mova-os para outra etapa antes de remover.`;
}

/**
 * "Configurar etapas" (TELAS-FASE1 §3.4; líder da área, C-level e Admin, R5.1): lista
 * reordenável (CDK, com botões para cima/para baixo no teclado) com nome, tipo, prazo-alvo e
 * probabilidade; adicionar e remover — a remoção é bloqueada, com a explicação, se a etapa
 * tiver negócios (R5.2). Ganho e perda ficam sempre no fim e não saem do funil.
 *
 * Cada mudança vai na hora para a API; `alterado` leva o funil novo ao quadro.
 */
@Component({
  selector: 'app-configurar-etapas',
  imports: [
    Botao,
    BotaoIcone,
    CampoTexto,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    IntegracoesDoFunil,
    LucideGripVertical,
    Modal,
    Selo,
  ],
  templateUrl: './configurar-etapas.html',
  styleUrl: './configurar-etapas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigurarEtapas {
  readonly aberto = model(false);
  readonly funil = input.required<Funil>();
  readonly alterado = output<Funil>();

  private readonly api = inject(FunisApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly anunciador = inject(LiveAnnouncer);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly sessao = inject(SessaoService);

  protected readonly icones = {
    subir: LucideArrowUp,
    descer: LucideArrowDown,
    remover: LucideX,
    adicionar: LucidePlus,
  };

  /** O funil como está na API (atualizado a cada resposta). */
  protected readonly atual = signal<Funil | null>(null);
  protected readonly rascunhos = signal<Readonly<Record<string, Rascunho>>>({});
  protected readonly erros = signal<Readonly<Record<string, ErrosLinha>>>({});
  protected readonly salvando = signal<ReadonlySet<string>>(new Set());
  /** Negócios por etapa (sem filtros), para bloquear a remoção (R5.2). */
  protected readonly contagens = signal<ReadonlyMap<string, number> | null>(null);
  protected readonly nova = signal<Rascunho>(VAZIO);
  protected readonly errosNova = signal<ErrosLinha>({});
  protected readonly adicionando = signal(false);
  protected readonly reordenando = signal(false);

  protected readonly abertas = computed(() =>
    ordenarEtapas(this.atual()?.etapas ?? []).filter((etapa) => etapa.tipo === 'ABERTA'),
  );
  protected readonly fechadas = computed(() =>
    ordenarEtapas(this.atual()?.etapas ?? []).filter((etapa) => etapa.tipo !== 'ABERTA'),
  );

  constructor() {
    effect(() => {
      if (this.aberto()) {
        const funil = this.funil();
        untracked(() => this.reiniciar(funil));
      }
    });
  }

  // Linhas ------------------------------------------------------------------------------------

  protected rascunho(etapa: Etapa): Rascunho {
    return this.rascunhos()[etapa.id] ?? rascunhoDe(etapa);
  }

  protected editar(etapa: Etapa, campo: keyof Rascunho, valor: ValorCampoTexto): void {
    this.rascunhos.update((atual) => ({
      ...atual,
      [etapa.id]: { ...(atual[etapa.id] ?? rascunhoDe(etapa)), [campo]: valor },
    }));
    if (this.erros()[etapa.id]) {
      this.erros.update((atual) => ({ ...atual, [etapa.id]: {} }));
    }
  }

  protected alterada(etapa: Etapa): boolean {
    const rascunho = this.rascunhos()[etapa.id];
    if (!rascunho) {
      return false;
    }
    return (
      String(rascunho.nome ?? '').trim() !== etapa.nome ||
      paraNumero(rascunho.prazo) !== (etapa.prazoDias ?? null) ||
      paraNumero(rascunho.probabilidade) !== (etapa.probabilidade ?? null)
    );
  }

  protected errosDe(etapa: Etapa): ErrosLinha {
    return this.erros()[etapa.id] ?? {};
  }

  protected contagem(etapa: Etapa): number | null {
    return this.contagens()?.get(etapa.id) ?? null;
  }

  protected motivoParaNaoRemover(etapa: Etapa): string | null {
    if (etapa.tipo !== 'ABERTA') {
      return etapa.tipo === 'GANHO'
        ? 'Todo funil tem exatamente uma etapa de ganho.'
        : 'Todo funil tem exatamente uma etapa de perda.';
    }
    if (this.abertas().length <= 1) {
      return 'Todo funil precisa de ao menos uma etapa aberta.';
    }
    const quantos = this.contagem(etapa);
    if (quantos) {
      return textoEtapaComNegocios(quantos);
    }
    return null;
  }

  protected async salvarLinha(etapa: Etapa): Promise<void> {
    const rascunho = this.rascunho(etapa);
    const erros = validarRascunho(rascunho);
    if (temErro(erros)) {
      this.erros.update((atual) => ({ ...atual, [etapa.id]: erros }));
      return;
    }
    const alteracao: AlteracaoEtapa = {
      nome: String(rascunho.nome).trim(),
      ...(etapa.tipo === 'ABERTA'
        ? {
            prazoDias: paraNumero(rascunho.prazo),
            probabilidade: paraNumero(rascunho.probabilidade),
          }
        : {}),
    };
    const funil = this.atual()!;
    this.marcarSalvando(etapa.id, true);
    try {
      const salva = await this.api.alterarEtapa(funil.id, etapa.id, alteracao);
      const novo: Funil = {
        ...funil,
        etapas: funil.etapas.map((item) => (item.id === salva.id ? salva : item)),
      };
      this.atual.set(novo);
      this.rascunhos.update((atual) => {
        const resto = { ...atual };
        delete resto[etapa.id];
        return resto;
      });
      this.alterado.emit(novo);
      this.avisos.sucesso(`Etapa “${salva.nome}” salva.`);
    } catch (falha) {
      const erro = erroDaApi(falha);
      this.erros.update((atual) => ({
        ...atual,
        [etapa.id]: {
          nome: erro.mensagemDoCampo('nome'),
          prazo: erro.mensagemDoCampo('prazoDias'),
          probabilidade: erro.mensagemDoCampo('probabilidade'),
          geral: erro.campos.length ? null : erro.mensagem,
        },
      }));
    } finally {
      this.marcarSalvando(etapa.id, false);
    }
  }

  protected descartar(etapa: Etapa): void {
    this.rascunhos.update((atual) => {
      const resto = { ...atual };
      delete resto[etapa.id];
      return resto;
    });
    this.erros.update((atual) => ({ ...atual, [etapa.id]: {} }));
  }

  protected async remover(etapa: Etapa): Promise<void> {
    const motivo = this.motivoParaNaoRemover(etapa);
    if (motivo) {
      this.avisos.info(motivo);
      return;
    }
    const funil = this.atual()!;
    const removida = await this.confirmacao.confirmar({
      titulo: `Remover a etapa “${etapa.nome}”?`,
      mensagem: `A etapa sai do funil ${funil.nome} e deixa de aparecer no quadro.`,
      confirmar: 'Remover etapa',
      perigo: true,
      executar: () => this.api.removerEtapa(funil.id, etapa.id),
    });
    if (!removida) {
      return;
    }
    const novo: Funil = { ...funil, etapas: funil.etapas.filter((item) => item.id !== etapa.id) };
    this.atual.set(novo);
    this.alterado.emit(novo);
    this.avisos.sucesso(`Etapa “${etapa.nome}” removida.`);
  }

  // Ordem -------------------------------------------------------------------------------------

  protected aoSoltar(evento: CdkDragDrop<Etapa[]>): void {
    if (evento.previousIndex !== evento.currentIndex) {
      void this.reordenar(evento.previousIndex, evento.currentIndex);
    }
  }

  protected mover(indice: number, passo: -1 | 1): void {
    // As setas não ficam desabilitadas enquanto a ordem é salva (o foco precisa continuar nelas):
    // o clique durante o salvamento é só ignorado.
    if (this.reordenando()) {
      return;
    }
    const destino = indice + passo;
    if (destino >= 0 && destino < this.abertas().length) {
      void this.reordenar(indice, destino, true);
    }
  }

  private async reordenar(de: number, para: number, peloTeclado = false): Promise<void> {
    const funil = this.atual()!;
    const abertas = [...this.abertas()];
    const [etapa] = abertas.splice(de, 1);
    abertas.splice(para, 0, etapa);
    const ordem = [...abertas, ...this.fechadas()];
    const otimista: Funil = {
      ...funil,
      etapas: ordem.map((item, indice) => ({ ...item, ordem: indice + 1 })),
    };
    this.atual.set(otimista);
    this.reordenando.set(true);
    if (peloTeclado) {
      void this.anunciador.announce(
        `${etapa.nome} agora é a etapa ${para + 1} de ${abertas.length}.`,
        'assertive',
      );
      // A linha mudou de lugar (o Angular move o elemento): o foco volta ao mesmo botão.
      const ultima = abertas.length - 1;
      const botao =
        para === 0 ? 'descer' : para === ultima ? 'subir' : para > de ? 'descer' : 'subir';
      afterNextRender(
        () =>
          this.elemento.nativeElement
            .querySelector<HTMLElement>(`[data-etapa="${etapa.id}"] [data-mover="${botao}"]`)
            ?.focus(),
        { injector: this.injector },
      );
    }
    try {
      const salvo = await this.api.reordenarEtapas(
        funil.id,
        ordem.map((item) => item.id),
      );
      this.atual.set(salvo);
      this.alterado.emit(salvo);
      this.avisos.sucesso('Ordem das etapas salva.', { chave: 'ordem-etapas' });
    } catch (falha) {
      this.atual.set(funil);
      this.avisos.erro(falha, { titulo: 'A ordem não foi salva' });
    } finally {
      this.reordenando.set(false);
    }
  }

  // Etapa nova --------------------------------------------------------------------------------

  protected editarNova(campo: keyof Rascunho, valor: ValorCampoTexto): void {
    this.nova.update((atual) => ({ ...atual, [campo]: valor }));
    if (temErro(this.errosNova()) || this.errosNova().geral) {
      this.errosNova.set({});
    }
  }

  protected async adicionar(): Promise<void> {
    const rascunho = this.nova();
    const erros = validarRascunho(rascunho);
    if (temErro(erros)) {
      this.errosNova.set(erros);
      return;
    }
    const funil = this.atual()!;
    this.adicionando.set(true);
    try {
      const salvo = await this.api.criarEtapa(funil.id, {
        nome: String(rascunho.nome).trim(),
        prazoDias: paraNumero(rascunho.prazo),
        probabilidade: paraNumero(rascunho.probabilidade),
      });
      this.atual.set(salvo);
      this.nova.set(VAZIO);
      this.errosNova.set({});
      this.alterado.emit(salvo);
      this.avisos.sucesso(`Etapa “${String(rascunho.nome).trim()}” adicionada antes do ganho.`);
    } catch (falha) {
      const erro = erroDaApi(falha);
      this.errosNova.set({
        nome: erro.mensagemDoCampo('nome'),
        prazo: erro.mensagemDoCampo('prazoDias'),
        probabilidade: erro.mensagemDoCampo('probabilidade'),
        geral: erro.campos.length ? null : erro.mensagem,
      });
    } finally {
      this.adicionando.set(false);
    }
  }

  // Apoio -------------------------------------------------------------------------------------

  private reiniciar(funil: Funil): void {
    this.atual.set(funil);
    this.rascunhos.set({});
    this.erros.set({});
    this.nova.set(VAZIO);
    this.errosNova.set({});
    this.contagens.set(null);
    void this.carregarContagens(funil);
  }

  private async carregarContagens(funil: Funil): Promise<void> {
    try {
      const quadro = await this.api.quadro(
        funil.id,
        { visao: 'TODOS', busca: '', etiqueta: null },
        1,
      );
      this.contagens.set(new Map(quadro.colunas.map((coluna) => [coluna.etapa.id, coluna.total])));
    } catch {
      // Sem as contagens, a API ainda recusa remover etapa com negócios (R5.2) e explica.
    }
  }

  private marcarSalvando(id: string, ligado: boolean): void {
    this.salvando.update((atual) => {
      const novo = new Set(atual);
      if (ligado) {
        novo.add(id);
      } else {
        novo.delete(id);
      }
      return novo;
    });
  }
}
