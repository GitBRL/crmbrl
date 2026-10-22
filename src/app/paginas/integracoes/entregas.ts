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
import { LucideChevronDown, LucideRefreshCw, LucideSend } from '@lucide/angular';

import type { Pagina } from '../../nucleo/api/api';
import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarDataHora, formatarHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { Selo } from '../../ui/selo/selo';
import { BlocoCodigo } from './comum/bloco-codigo';
import { formatarJson } from './comum/copiar';
import { IntegracoesApi } from './integracoes.api';
import {
  type Entrega,
  type EntregaDetalhe,
  rotuloDoEvento,
  ROTULO_STATUS_ENTREGA,
  SELO_STATUS_ENTREGA,
  type StatusEntrega,
  type TentativaDeEntrega,
  type WebhookSaida,
} from './tipos';

const POR_PAGINA = 10;
const ESPERA_PARA_CONFERIR_MS = 4_000;

const FILTROS: readonly OpcaoFiltro[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'FALHOU', rotulo: 'Falharam' },
  { id: 'PENDENTE', rotulo: 'Pendentes' },
  { id: 'ENTREGUE', rotulo: 'Entregues' },
];

const VAZIO_DO_FILTRO: Readonly<Record<string, string>> = {
  FALHOU: 'Nenhuma entrega falhou',
  PENDENTE: 'Nenhuma entrega pendente',
  ENTREGUE: 'Nenhuma entrega concluída',
};

/** "HTTP 500 · 12 ms" / "Sem resposta: tempo esgotado" / "Ainda não enviada". */
export function resultadoDaEntrega(
  entrega: Pick<Entrega, 'statusHttp' | 'duracaoMs' | 'erro' | 'tentativas'>,
): string {
  if (entrega.statusHttp !== null) {
    return entrega.duracaoMs !== null
      ? `HTTP ${entrega.statusHttp} · ${entrega.duracaoMs} ms`
      : `HTTP ${entrega.statusHttp}`;
  }
  if (entrega.erro) {
    return entrega.erro;
  }
  return entrega.tentativas ? 'Sem resposta' : 'Ainda não enviada';
}

/**
 * Entregas de um webhook de saída (TELAS-FASE1 §7, R9.4, R9.5): filtro por status; cada
 * entrega abre no lugar com as tentativas (status HTTP, duração, trecho da resposta), o
 * envelope enviado e o botão "Reenviar".
 */
@Component({
  selector: 'app-entregas',
  imports: [
    Botao,
    BotaoIcone,
    EstadoVazio,
    Esqueleto,
    FiltrosPilula,
    Paginacao,
    Selo,
    BlocoCodigo,
    LucideChevronDown,
  ],
  templateUrl: './entregas.html',
  styleUrl: './entregas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Entregas {
  private readonly api = inject(IntegracoesApi);
  private readonly avisos = inject(AvisosService);

  readonly destino = input.required<WebhookSaida>();
  /** Muda quando a tela quer recarregar (depois de "Enviar teste"). */
  readonly versao = input(0);

  protected readonly filtros = FILTROS;
  protected readonly porPagina = POR_PAGINA;
  protected readonly icones = { atualizar: LucideRefreshCw, reenviar: LucideSend };
  protected readonly rotuloStatus = ROTULO_STATUS_ENTREGA;
  protected readonly seloStatus = SELO_STATUS_ENTREGA;

  protected readonly filtro = signal<string | null>('todas');
  protected readonly pagina = signal(1);
  protected readonly resposta = signal<Pagina<Entrega> | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly aberta = signal<string | null>(null);
  protected readonly detalhes = signal<ReadonlyMap<string, EntregaDetalhe>>(new Map());
  protected readonly carregandoDetalhe = signal<string | null>(null);
  protected readonly erroDetalhe = signal<ErroApi | null>(null);
  protected readonly reenviando = signal<string | null>(null);

  protected readonly itens = computed(() => this.resposta()?.itens ?? []);
  protected readonly total = computed(() => this.resposta()?.total ?? 0);
  protected readonly filtrado = computed(() => (this.filtro() ?? 'todas') !== 'todas');
  protected readonly tituloVazio = computed(
    () => VAZIO_DO_FILTRO[this.filtro() ?? ''] ?? 'Nenhuma entrega ainda',
  );
  /** Destino desativado não reenvia (R9.4). */
  protected readonly motivoSemReenvio = computed(() =>
    this.destino().ativo ? null : 'Reative o destino para reenviar.',
  );

  /** Só o id: o destino atualizado (mesmo id) não recarrega a lista. */
  private readonly idDoDestino = computed(() => this.destino().id);

  private contador = 0;
  private conferencia: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      void [this.idDoDestino(), this.filtro(), this.pagina(), this.versao()];
      untracked(() => void this.carregar());
    });
    inject(DestroyRef).onDestroy(() => this.pararConferencia());
  }

  protected escolherFiltro(id: string | null): void {
    this.filtro.set(id ?? 'todas');
    this.pagina.set(1);
  }

  async carregar(): Promise<void> {
    const versao = ++this.contador;
    const status = this.filtro();
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const resposta = await this.api.listarEntregas(this.destino().id, {
        pagina: this.pagina(),
        porPagina: POR_PAGINA,
        status: status && status !== 'todas' ? [status as StatusEntrega] : undefined,
      });
      if (versao === this.contador) {
        this.resposta.set(resposta);
      }
    } catch (falha) {
      if (versao === this.contador) {
        this.erro.set(erroDaApi(falha));
      }
    } finally {
      if (versao === this.contador) {
        this.carregando.set(false);
      }
    }
  }

  protected async alternar(entrega: Entrega): Promise<void> {
    if (this.aberta() === entrega.id) {
      this.aberta.set(null);
      return;
    }
    this.aberta.set(entrega.id);
    await this.carregarDetalhe(entrega.id);
  }

  protected async carregarDetalhe(id: string): Promise<void> {
    this.erroDetalhe.set(null);
    this.carregandoDetalhe.set(id);
    try {
      const detalhe = await this.api.obterEntrega(this.destino().id, id);
      this.detalhes.update((mapa) => new Map(mapa).set(id, detalhe));
    } catch (falha) {
      this.erroDetalhe.set(erroDaApi(falha));
    } finally {
      this.carregandoDetalhe.set(null);
    }
  }

  protected async reenviar(entrega: Entrega): Promise<void> {
    this.reenviando.set(entrega.id);
    try {
      const detalhe = await this.api.reenviar(this.destino().id, entrega.id);
      this.detalhes.update((mapa) => new Map(mapa).set(entrega.id, detalhe));
      this.avisos.sucesso('Entrega reenviada: ela sai pela fila em instantes.');
      await this.carregar();
      this.pararConferencia();
      this.conferencia = setTimeout(() => {
        this.conferencia = null;
        void this.carregar();
        if (this.aberta() === entrega.id) {
          void this.carregarDetalhe(entrega.id);
        }
      }, ESPERA_PARA_CONFERIR_MS);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.reenviando.set(null);
    }
  }

  protected evento(evento: string): string {
    return rotuloDoEvento(evento);
  }

  protected resultado(entrega: Entrega): string {
    return resultadoDaEntrega(entrega);
  }

  protected resultadoTentativa(tentativa: TentativaDeEntrega): string {
    return resultadoDaEntrega({ ...tentativa, tentativas: 1 });
  }

  protected json(valor: unknown): string {
    return formatarJson(valor);
  }

  protected quando(iso: string | null): string {
    return iso ? formatarTempoRelativo(iso) : '—';
  }

  protected dataHora(iso: string | null): string {
    return iso ? formatarDataHora(iso) : '—';
  }

  protected hora(iso: string): string {
    return formatarHora(iso);
  }

  private pararConferencia(): void {
    if (this.conferencia) {
      clearTimeout(this.conferencia);
      this.conferencia = null;
    }
  }
}
