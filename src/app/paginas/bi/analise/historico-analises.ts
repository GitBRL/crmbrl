import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideSave } from '@lucide/angular';

import { POR_PAGINA_PADRAO, type Pagina } from '../../../nucleo/api/api';
import { erroDaApi, type ErroApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { formatarDataHora, formatarTempoRelativo } from '../../../nucleo/formatos';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { CampoTexto } from '../../../ui/campo-texto/campo-texto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { Paginacao } from '../../../ui/paginacao/paginacao';
import { Selo, type VarianteSelo } from '../../../ui/selo/selo';
import { Seletor, type OpcaoSeletor } from '../../../ui/seletor/seletor';
import { CelulaTabela } from '../../../ui/tabela/celula-tabela';
import { Tabela, type ColunaTabela } from '../../../ui/tabela/tabela';
import { BiApi } from '../bi.api';
import { PAINEIS, ROTULO_PAINEL, type IdPainel } from '../bi.tipos';
import { AnaliseApi } from './analise.api';
import {
  ROTULO_STATUS,
  type EstadoAnalise,
  type ItemHistorico,
  type StatusAnalise,
} from './analise.tipos';
import { AnaliseIa } from './analise-modal';
import { textoDoPeriodo } from './periodo';

const SELO_STATUS: Readonly<Record<StatusAnalise, VarianteSelo>> = {
  CONCLUIDA: 'menta',
  FALHOU: 'coral',
  EM_ANDAMENTO: 'neutro',
};

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'quando', rotulo: 'Quando', largura: '9rem' },
  { id: 'usuario', rotulo: 'Quem pediu', largura: '9rem' },
  { id: 'painel', rotulo: 'Painel', largura: '8rem' },
  { id: 'periodo', rotulo: 'Período', largura: '11rem' },
  { id: 'status', rotulo: 'Situação', largura: '8rem' },
  { id: 'perguntas', rotulo: 'Perguntas', alinhar: 'fim', largura: '6rem' },
  { id: 'resumo', rotulo: 'Resumo' },
];

/**
 * Histórico das análises com IA (`/bi/analises`, só o Admin): quem pediu, de qual painel e período,
 * como terminou. Filtra por painel e por pessoa; abrir uma linha reabre a análise no mesmo modal,
 * com os números enviados, os gastos e as perguntas, e deixa continuar perguntando. Também
 * ajusta o limite de análises por dia (auditado pela API).
 */
@Component({
  selector: 'app-bi-historico-analises',
  imports: [
    AnaliseIa,
    Botao,
    CampoTexto,
    Cartao,
    CelulaTabela,
    EstadoVazio,
    Paginacao,
    RouterLink,
    Seletor,
    Selo,
    Tabela,
  ],
  templateUrl: './historico-analises.html',
  styleUrl: './historico-analises.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoricoAnalises {
  private readonly api = inject(AnaliseApi);
  private readonly biApi = inject(BiApi);
  private readonly avisos = inject(AvisosService);

  protected readonly icones = { voltar: LucideArrowLeft, salvar: LucideSave };
  protected readonly colunas = COLUNAS;
  protected readonly rotuloStatus = ROTULO_STATUS;
  protected readonly rotuloPainel = ROTULO_PAINEL;
  protected readonly porPagina = POR_PAGINA_PADRAO;

  protected readonly opcoesPainel: readonly OpcaoSeletor<IdPainel>[] = PAINEIS.map((id) => ({
    valor: id,
    rotulo: ROTULO_PAINEL[id],
  }));
  protected readonly opcoesPessoa = signal<readonly OpcaoSeletor<string>[]>([]);

  protected readonly painel = signal<IdPainel | null>(null);
  protected readonly usuarioId = signal<string | null>(null);
  protected readonly pagina = signal(1);

  protected readonly lista = signal<Pagina<ItemHistorico> | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  private consulta = 0;

  protected readonly itens = computed(() => this.lista()?.itens ?? []);
  protected readonly filtrado = computed(() => this.painel() !== null || this.usuarioId() !== null);

  protected readonly aberta = signal(false);
  protected readonly abertaId = signal<string | null>(null);

  // Limite diário
  protected readonly estado = signal<EstadoAnalise | null>(null);
  protected readonly limite = signal<string | number>('');
  protected readonly salvando = signal(false);
  protected readonly erroLimite = signal<string | null>(null);

  constructor() {
    void this.carregarApoio();
    effect(() => {
      const filtros = {
        pagina: this.pagina(),
        porPagina: this.porPagina,
        usuarioId: this.usuarioId(),
        painel: this.painel(),
      };
      untracked(() => void this.carregar(filtros));
    });
  }

  private async carregarApoio(): Promise<void> {
    const [pessoas, estado] = await Promise.all([
      this.biApi.pessoas(),
      this.api.estado().catch(() => null),
    ]);
    this.opcoesPessoa.set(pessoas.map((p) => ({ valor: p.id, rotulo: p.nome })));
    if (estado) {
      this.estado.set(estado);
      this.limite.set(estado.limiteDiario);
    }
  }

  protected async carregar(
    filtros = {
      pagina: this.pagina(),
      porPagina: this.porPagina,
      usuarioId: this.usuarioId(),
      painel: this.painel(),
    },
  ): Promise<void> {
    const consulta = ++this.consulta;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const lista = await this.api.historico(filtros);
      if (consulta === this.consulta) {
        this.lista.set(lista);
      }
    } catch (falha) {
      if (consulta === this.consulta) {
        this.erro.set(erroDaApi(falha));
        this.lista.set(null);
      }
    } finally {
      if (consulta === this.consulta) {
        this.carregando.set(false);
      }
    }
  }

  protected mudarFiltro(): void {
    this.pagina.set(1);
  }

  protected limpar(): void {
    this.painel.set(null);
    this.usuarioId.set(null);
    this.pagina.set(1);
  }

  protected abrir(item: ItemHistorico): void {
    this.abertaId.set(item.id);
    this.aberta.set(true);
  }

  protected aoFechar(aberto: boolean): void {
    this.aberta.set(aberto);
    if (!aberto) {
      // Pode ter ganho perguntas: atualiza a contagem da lista.
      void this.carregar();
    }
  }

  protected quando(item: ItemHistorico): string {
    return formatarTempoRelativo(item.criadoEm);
  }
  protected dataHora(valor: string): string {
    return formatarDataHora(valor);
  }
  protected periodo(item: ItemHistorico): string {
    return item.periodo ? textoDoPeriodo(item.periodo) : '—';
  }
  protected seloStatus(status: StatusAnalise): VarianteSelo {
    return SELO_STATUS[status];
  }

  protected async salvarLimite(): Promise<void> {
    const valor = Number(this.limite());
    if (this.limite() === '' || !Number.isInteger(valor) || valor < 0 || valor > 1000) {
      this.erroLimite.set('Informe um número inteiro de 0 a 1000.');
      return;
    }
    this.erroLimite.set(null);
    this.salvando.set(true);
    try {
      const estado = await this.api.configurar(valor);
      this.estado.set(estado);
      this.limite.set(estado.limiteDiario);
      this.avisos.sucesso(
        estado.limiteDiario === 0
          ? 'Limite salvo: as análises ficam desligadas.'
          : `Limite salvo: ${estado.limiteDiario} análises por dia.`,
      );
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.salvando.set(false);
    }
  }
}
