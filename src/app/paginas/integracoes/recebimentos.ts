import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideChevronDown, LucideEye, LucidePencil, LucideRefreshCw } from '@lucide/angular';

import type { Pagina } from '../../nucleo/api/api';
import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarDataHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { Selo } from '../../ui/selo/selo';
import { BlocoCodigo } from './comum/bloco-codigo';
import { formatarIp, formatarJson } from './comum/copiar';
import { type FiltroRecebimentos, IntegracoesApi } from './integracoes.api';
import { PreviaMapeamento } from './previa-mapeamento';
import {
  type Recebimento,
  type RecebimentoDetalhe,
  type ResultadoDaPrevia,
  ROTULO_STATUS_RECEBIMENTO,
  SELO_STATUS_RECEBIMENTO,
} from './tipos';

const POR_PAGINA = 10;
/** Depois de reprocessar, confere de novo quando a fila já deve ter processado. */
const ESPERA_PARA_CONFERIR_MS = 4_000;

/** Por que um recebimento não pode ser reprocessado (R8.6). */
export function motivoSemReprocessar(recebimento: Recebimento): string | null {
  if (recebimento.podeReprocessar) {
    return null;
  }
  if (recebimento.recusadoNaRecepcao) {
    return 'Recusado na chegada (assinatura, tamanho ou formato): não pode ser reprocessado.';
  }
  if (recebimento.status === 'PROCESSADO') {
    return 'Já foi processado: reprocessar criaria o lead de novo.';
  }
  return 'O corpo deste envio não foi guardado.';
}

/**
 * Recebimentos das integrações (R8.6, Onda H): a lista de uma consulta (filtros vindos de quem
 * usa: data, status, aplicativo e integração), em que cada recebimento abre no lugar com o
 * resultado, os avisos, o que foi criado, o corpo e os cabeçalhos guardados, e as ações
 * "Reprocessar" (com a configuração atual), "Simular" (a prévia sobre o corpo guardado) e
 * "Editar integração".
 */
@Component({
  selector: 'app-recebimentos',
  imports: [
    RouterLink,
    Botao,
    EstadoVazio,
    Esqueleto,
    Paginacao,
    Selo,
    BlocoCodigo,
    PreviaMapeamento,
    LucideChevronDown,
  ],
  templateUrl: './recebimentos.html',
  styleUrl: './recebimentos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Recebimentos {
  private readonly api = inject(IntegracoesApi);
  private readonly avisos = inject(AvisosService);

  /** Filtros da consulta (sem paginação, que a lista faz sozinha). */
  readonly consulta = input<Omit<FiltroRecebimentos, 'pagina' | 'porPagina'>>({});
  /** Mostra o nome da integração e do aplicativo em cada linha (no histórico global). */
  readonly mostrarOrigem = input(true);
  /** Funil de cada integração (id da integração → id do funil), para o link do negócio. */
  readonly funilDaIntegracao = input<ReadonlyMap<string, string>>(new Map());
  readonly editarIntegracao = output<string>();

  protected readonly porPagina = POR_PAGINA;
  protected readonly icones = {
    atualizar: LucideRefreshCw,
    simular: LucideEye,
    editar: LucidePencil,
  };
  protected readonly rotuloStatus = ROTULO_STATUS_RECEBIMENTO;
  protected readonly seloStatus = SELO_STATUS_RECEBIMENTO;

  protected readonly pagina = signal(1);
  protected readonly resposta = signal<Pagina<Recebimento> | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly aberto = signal<string | null>(null);
  protected readonly detalhes = signal<ReadonlyMap<string, RecebimentoDetalhe>>(new Map());
  protected readonly carregandoDetalhe = signal<string | null>(null);
  protected readonly erroDetalhe = signal<ErroApi | null>(null);
  protected readonly simulacoes = signal<ReadonlyMap<string, ResultadoDaPrevia>>(new Map());
  protected readonly simulando = signal<string | null>(null);
  protected readonly reprocessando = signal<string | null>(null);

  protected readonly itens = computed(() => this.resposta()?.itens ?? []);
  protected readonly total = computed(() => this.resposta()?.total ?? 0);
  protected readonly filtrado = computed(() => {
    const c = this.consulta();
    return !!(c.status?.length || c.aplicativo?.length || c.integracaoId || c.de || c.ate);
  });
  /** Só a chave da consulta: o mesmo filtro (outro objeto) não recarrega a lista. */
  private readonly chaveDaConsulta = computed(() => JSON.stringify(this.consulta()));

  private versao = 0;
  private conferencia: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Consulta nova (outro filtro): volta à primeira página.
    effect(() => {
      void this.chaveDaConsulta();
      untracked(() => this.pagina.set(1));
    });
    effect(() => {
      // Recarrega quando muda a consulta ou a página.
      void [this.chaveDaConsulta(), this.pagina()];
      untracked(() => void this.carregar());
    });
    inject(DestroyRef).onDestroy(() => this.pararConferencia());
  }

  async carregar(): Promise<void> {
    const versao = ++this.versao;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const resposta = await this.api.listarRecebimentos({
        ...this.consulta(),
        pagina: this.pagina(),
        porPagina: POR_PAGINA,
      });
      if (versao === this.versao) {
        this.resposta.set(resposta);
      }
    } catch (falha) {
      if (versao === this.versao) {
        this.erro.set(erroDaApi(falha));
      }
    } finally {
      if (versao === this.versao) {
        this.carregando.set(false);
      }
    }
  }

  protected async alternar(recebimento: Recebimento): Promise<void> {
    if (this.aberto() === recebimento.id) {
      this.aberto.set(null);
      return;
    }
    this.aberto.set(recebimento.id);
    await this.carregarDetalhe(recebimento.id);
  }

  protected async carregarDetalhe(id: string): Promise<void> {
    this.erroDetalhe.set(null);
    this.carregandoDetalhe.set(id);
    try {
      const detalhe = await this.api.obterRecebimento(id);
      this.detalhes.update((mapa) => new Map(mapa).set(id, detalhe));
    } catch (falha) {
      this.erroDetalhe.set(erroDaApi(falha));
    } finally {
      this.carregandoDetalhe.set(null);
    }
  }

  protected async reprocessar(recebimento: Recebimento): Promise<void> {
    this.reprocessando.set(recebimento.id);
    try {
      await this.api.reprocessar(recebimento.id);
      this.avisos.sucesso('Recebimento enviado de novo para a fila. O resultado aparece aqui.');
      this.simulacoes.update((mapa) => {
        const novo = new Map(mapa);
        novo.delete(recebimento.id);
        return novo;
      });
      await this.atualizarDepoisDeReprocessar(recebimento.id);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.reprocessando.set(null);
    }
  }

  /** Prévia com a configuração salva sobre o corpo guardado (não grava nada). */
  protected async simular(recebimento: Recebimento): Promise<void> {
    this.simulando.set(recebimento.id);
    try {
      const resultado = await this.api.previaDoRecebimento(recebimento.webhookId, recebimento.id);
      this.simulacoes.update((mapa) => new Map(mapa).set(recebimento.id, resultado));
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.simulando.set(null);
    }
  }

  protected motivo(recebimento: Recebimento): string | null {
    return motivoSemReprocessar(recebimento);
  }

  protected json(valor: unknown): string {
    return formatarJson(valor);
  }

  protected ip(ip: string | null): string {
    return formatarIp(ip);
  }

  protected funilDe(recebimento: Recebimento): string | null {
    return this.funilDaIntegracao().get(recebimento.webhookId) ?? null;
  }

  protected quando(iso: string | null): string {
    return iso ? formatarTempoRelativo(iso) : '—';
  }

  protected dataHora(iso: string | null): string {
    return iso ? formatarDataHora(iso) : '—';
  }

  private async atualizarDepoisDeReprocessar(id: string): Promise<void> {
    await Promise.all([this.carregar(), this.carregarDetalhe(id)]);
    this.pararConferencia();
    this.conferencia = setTimeout(() => {
      this.conferencia = null;
      void this.carregar();
      if (this.aberto() === id) {
        void this.carregarDetalhe(id);
      }
    }, ESPERA_PARA_CONFERIR_MS);
  }

  private pararConferencia(): void {
    if (this.conferencia) {
      clearTimeout(this.conferencia);
      this.conferencia = null;
    }
  }
}
