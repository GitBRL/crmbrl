import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideChevronDown, LucideEye, LucideRefreshCw } from '@lucide/angular';

import type { Pagina } from '../../nucleo/api/api';
import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarDataHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { SLUG_AREA } from '../../nucleo/sessao/perfil';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { Selo } from '../../ui/selo/selo';
import { BlocoCodigo } from './comum/bloco-codigo';
import { formatarIp, formatarJson } from './comum/copiar';
import { IntegracoesApi } from './integracoes.api';
import { PreviaMapeamento } from './previa-mapeamento';
import {
  type Recebimento,
  type RecebimentoDetalhe,
  type ResultadoDaPrevia,
  ROTULO_STATUS_RECEBIMENTO,
  SELO_STATUS_RECEBIMENTO,
  type StatusRecebimento,
  type WebhookEntrada,
} from './tipos';

const POR_PAGINA = 10;
/** Depois de reprocessar, confere de novo quando a fila já deve ter processado. */
const ESPERA_PARA_CONFERIR_MS = 4_000;

const FILTROS: readonly OpcaoFiltro[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'ERRO', rotulo: 'Com erro' },
  { id: 'IGNORADO', rotulo: 'Ignorados' },
  { id: 'PROCESSADO', rotulo: 'Processados' },
  { id: 'RECEBIDO', rotulo: 'Na fila' },
];

const VAZIO_DO_FILTRO: Readonly<Record<string, string>> = {
  ERRO: 'Nenhum recebimento com erro',
  IGNORADO: 'Nenhum recebimento ignorado',
  PROCESSADO: 'Nenhum recebimento processado',
  RECEBIDO: 'Nada na fila agora',
};

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
 * Recebimentos de um webhook de entrada (TELAS-FASE1 §7, R8.6): filtro por status, cada
 * recebimento abre no lugar com o resultado, o corpo e os cabeçalhos guardados, e as ações
 * "Reprocessar" (com a configuração atual) e "Simular" (a prévia sobre o corpo guardado).
 */
@Component({
  selector: 'app-recebimentos',
  imports: [
    RouterLink,
    Botao,
    BotaoIcone,
    EstadoVazio,
    Esqueleto,
    FiltrosPilula,
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

  readonly webhook = input.required<WebhookEntrada>();

  protected readonly filtros = FILTROS;
  protected readonly porPagina = POR_PAGINA;
  protected readonly icones = { atualizar: LucideRefreshCw, simular: LucideEye };
  protected readonly rotuloStatus = ROTULO_STATUS_RECEBIMENTO;
  protected readonly seloStatus = SELO_STATUS_RECEBIMENTO;

  protected readonly filtro = signal<string | null>('todos');
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
  protected readonly filtrado = computed(() => (this.filtro() ?? 'todos') !== 'todos');
  protected readonly tituloVazio = computed(
    () => VAZIO_DO_FILTRO[this.filtro() ?? ''] ?? 'Nenhum recebimento ainda',
  );
  protected readonly slugArea = computed(() => SLUG_AREA[this.webhook().funil.area]);
  /** Só o id: o webhook atualizado (mesmo id) não recarrega a lista. */
  private readonly idDoWebhook = computed(() => this.webhook().id);

  private versao = 0;
  private conferencia: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      // Recarrega quando muda o webhook, o filtro ou a página.
      void [this.idDoWebhook(), this.filtro(), this.pagina()];
      untracked(() => void this.carregar());
    });
    inject(DestroyRef).onDestroy(() => this.pararConferencia());
  }

  protected escolherFiltro(id: string | null): void {
    this.filtro.set(id ?? 'todos');
    this.pagina.set(1);
  }

  async carregar(): Promise<void> {
    const versao = ++this.versao;
    const status = this.filtro();
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const resposta = await this.api.listarRecebimentos(this.webhook().id, {
        pagina: this.pagina(),
        porPagina: POR_PAGINA,
        status: status && status !== 'todos' ? [status as StatusRecebimento] : undefined,
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
      const detalhe = await this.api.obterRecebimento(this.webhook().id, id);
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
      await this.api.reprocessar(this.webhook().id, recebimento.id);
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
      const resultado = await this.api.previaDoRecebimento(this.webhook().id, recebimento.id);
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
