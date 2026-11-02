import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { LucideRefreshCw } from '@lucide/angular';

import { type Pagina } from '../../nucleo/api/api';
import { AvisosService } from '../../nucleo/avisos.service';
import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { formatarDataHora } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Modal } from '../../ui/modal/modal';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { Selo, type VarianteSelo } from '../../ui/selo/selo';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { ChatbotApi } from './chatbot.api';
import {
  type ExecucaoDetalhe,
  type ExecucaoResumo,
  ROTULO_MOTIVO_FIM,
  ROTULO_STATUS_EXECUCAO,
  type StatusExecucao,
} from './chatbot.tipos';

const STATUS: readonly OpcaoSeletor<string>[] = (
  Object.keys(ROTULO_STATUS_EXECUCAO) as StatusExecucao[]
).map((valor) => ({ valor, rotulo: ROTULO_STATUS_EXECUCAO[valor] }));

const VARIANTE: Readonly<Record<StatusExecucao, VarianteSelo>> = {
  EM_ANDAMENTO: 'ciano',
  AGUARDANDO: 'lima',
  CONCLUIDA: 'menta',
  FALHOU: 'coral',
  CANCELADA: 'neutro',
};

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'contato', rotulo: 'Contato', noCartao: 'titulo' },
  { id: 'status', rotulo: 'Situação' },
  { id: 'motivo', rotulo: 'Como terminou' },
  { id: 'versao', rotulo: 'Versão' },
  { id: 'passos', rotulo: 'Passos' },
  { id: 'inicio', rotulo: 'Começou' },
];

/** Aba “Histórico”: as conversas reais que o fluxo atendeu (simulações ficam de fora). */
@Component({
  selector: 'app-historico-fluxo',
  imports: [Botao, CelulaTabela, EstadoVazio, Modal, Paginacao, Selo, Seletor, Tabela],
  templateUrl: './historico-fluxo.html',
  styleUrl: './historico-fluxo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoricoFluxo {
  private readonly api = inject(ChatbotApi);
  private readonly avisos = inject(AvisosService);

  readonly fluxoId = input.required<string>();

  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly colunas = COLUNAS;
  protected readonly opcoesStatus = STATUS;
  protected readonly status = signal<string | null>(null);
  protected readonly pagina = signal(1);
  protected readonly porPagina = signal(20);
  protected readonly dados = signal<Pagina<ExecucaoResumo> | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly linhas = computed(() => this.dados()?.itens ?? []);
  protected readonly detalheAberto = signal(false);
  protected readonly detalhe = signal<ExecucaoDetalhe | null>(null);
  protected readonly variaveis = computed(() =>
    Object.entries(this.detalhe()?.variaveis ?? {}).map(([chave, valor]) => ({
      chave,
      valor: typeof valor === 'string' ? valor : JSON.stringify(valor),
    })),
  );
  private pedido = 0;

  constructor() {
    queueMicrotask(() => void this.carregar());
  }

  protected async carregar(): Promise<void> {
    const atual = ++this.pedido;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const resposta = await this.api.execucoes(this.fluxoId(), {
        status: this.status(),
        pagina: this.pagina(),
      });
      if (atual === this.pedido) {
        this.dados.set(resposta);
      }
    } catch (falha) {
      if (atual === this.pedido) {
        this.erro.set(erroDaApi(falha));
      }
    } finally {
      if (atual === this.pedido) {
        this.carregando.set(false);
      }
    }
  }

  protected filtrou(): void {
    this.pagina.set(1);
    void this.carregar();
  }

  protected rotuloStatus(s: StatusExecucao): string {
    return ROTULO_STATUS_EXECUCAO[s];
  }

  protected variante(s: StatusExecucao): VarianteSelo {
    return VARIANTE[s];
  }

  protected motivo(m: string | null): string {
    return m ? (ROTULO_MOTIVO_FIM[m] ?? m) : '—';
  }

  protected data(valor: string | null): string {
    return valor ? formatarDataHora(valor) : '—';
  }

  protected async abrir(execucao: ExecucaoResumo): Promise<void> {
    try {
      this.detalhe.set(await this.api.execucao(this.fluxoId(), execucao.id));
      this.detalheAberto.set(true);
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    }
  }
}
