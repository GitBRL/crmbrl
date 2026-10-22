import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  LucideCheck,
  LucideDynamicIcon,
  LucidePlus,
  LucideRefreshCw,
  LucideX,
} from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarDataHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { CaixaSelecao } from '../../ui/caixa-selecao/caixa-selecao';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { Selo } from '../../ui/selo/selo';
import { ContatosApi, type DonoDoHistorico } from './contatos.api';
import { type AtividadeRelacionada, ROTULO_TIPO_ATIVIDADE } from './contatos.tipos';
import { ICONE_TIPO_ATIVIDADE } from './icones-atividade';
import { NovaAtividade } from './nova-atividade';

const OPCOES: readonly OpcaoFiltro[] = [
  { id: 'pendentes', rotulo: 'Pendentes' },
  { id: 'concluidas', rotulo: 'Concluídas' },
];

const POR_PAGINA = 50;

/** "Vence em 2 h", "Venceu ontem", "Vence em 25/10/2026". */
export function descreverPrazo(atividade: AtividadeRelacionada, agora: Date = new Date()): string {
  if (atividade.status === 'CONCLUIDA') {
    return atividade.concluidaEm
      ? `Concluída ${comPreposicao(formatarTempoRelativo(atividade.concluidaEm, agora))}`
      : 'Concluída';
  }
  if (atividade.status === 'CANCELADA') {
    return 'Cancelada';
  }
  if (atividade.tipo === 'REUNIAO' && atividade.inicioEm) {
    return `Reunião ${formatarDataHora(atividade.inicioEm)}`;
  }
  if (!atividade.venceEm) {
    return 'Sem data';
  }
  const relativo = formatarTempoRelativo(atividade.venceEm, agora);
  return atividade.atrasada
    ? `Venceu ${comPreposicao(relativo)}`
    : `Vence ${comPreposicao(relativo)}`;
}

/** "25/10/2026" → "em 25/10/2026"; "há 2 dias", "ontem", "em 3 h" ficam como estão. */
function comPreposicao(relativo: string): string {
  return /^\d/.test(relativo) ? `em ${relativo}` : relativo;
}

/**
 * Aba "Atividades" do detalhe (TELAS-FASE1 §4): as pendentes (concluir pela caixa grande,
 * com "Desfazer" no aviso) e as concluídas, de quem a pessoa vê (R6.4), mais a criação de
 * uma atividade ligada ao contato ou à empresa.
 */
@Component({
  selector: 'app-atividades-relacionadas',
  imports: [
    Botao,
    CaixaSelecao,
    Esqueleto,
    EstadoVazio,
    FiltrosPilula,
    LucideDynamicIcon,
    NovaAtividade,
    RouterLink,
    Selo,
  ],
  templateUrl: './atividades-relacionadas.html',
  styleUrl: './atividades-relacionadas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtividadesRelacionadas {
  readonly dono = input.required<DonoDoHistorico>();
  readonly id = input.required<string>();
  /** Nome do contato ou da empresa (para o título sugerido). */
  readonly nome = input.required<string>();
  /** Algo mudou (atividade criada, concluída ou reaberta): a linha do tempo recarrega. */
  readonly mudou = output<void>();

  private readonly api = inject(ContatosApi);
  private readonly avisos = inject(AvisosService);

  protected readonly opcoes = OPCOES;
  protected readonly icones = {
    nova: LucidePlus,
    tentar: LucideRefreshCw,
    concluida: LucideCheck,
    cancelada: LucideX,
  };
  protected readonly rotuloTipo = ROTULO_TIPO_ATIVIDADE;
  protected readonly iconeTipo = ICONE_TIPO_ATIVIDADE;
  protected readonly descreverPrazo = descreverPrazo;

  protected readonly visao = signal<'pendentes' | 'concluidas'>('pendentes');
  protected readonly criando = signal(false);
  /** Ids sendo concluídos agora (some da lista na hora; volta se a API recusar). */
  protected readonly concluindo = signal<ReadonlySet<string>>(new Set());

  protected readonly dados = rxResource({
    params: () => ({ dono: this.dono(), id: this.id(), visao: this.visao() }),
    stream: ({ params }) =>
      this.api.atividades(params.dono, params.id, params.visao === 'concluidas', 1, POR_PAGINA),
  });

  protected readonly itens = computed(() => {
    const ocultos = this.concluindo();
    const itens = this.dados.hasValue() ? this.dados.value().itens : [];
    return itens.filter((atividade) => !ocultos.has(atividade.id));
  });

  protected readonly total = linkedSignal<number | undefined, number>({
    source: () => (this.dados.hasValue() ? this.dados.value().total : undefined),
    computation: (novo, anterior) => novo ?? anterior?.value ?? 0,
  });

  protected readonly erro = computed(() => {
    const falha = this.dados.error();
    return falha ? erroDaApi(falha) : null;
  });

  protected escolher(visao: string | null): void {
    this.visao.set(visao === 'concluidas' ? 'concluidas' : 'pendentes');
  }

  protected linkDoNegocio(atividade: AtividadeRelacionada) {
    return atividade.negocio ? ['/funis', atividade.negocio.funilId] : null;
  }

  protected async concluir(atividade: AtividadeRelacionada): Promise<void> {
    this.concluindo.update((ids) => new Set([...ids, atividade.id]));
    try {
      await this.api.concluirAtividade(atividade.id);
      this.avisos.sucesso(`Atividade “${atividade.titulo}” concluída.`, {
        acao: { rotulo: 'Desfazer', executar: () => void this.reabrir(atividade) },
      });
      this.dados.reload();
      this.mudou.emit();
    } catch (falha) {
      // Volta para a lista (a concluída continua oculta: a lista recarregada já não a tem).
      this.concluindo.update((ids) => {
        const restantes = new Set(ids);
        restantes.delete(atividade.id);
        return restantes;
      });
      this.avisos.erro(erroDaApi(falha));
      this.dados.reload();
    }
  }

  protected aoCriar(): void {
    this.visao.set('pendentes');
    this.dados.reload();
    this.mudou.emit();
  }

  private async reabrir(atividade: AtividadeRelacionada): Promise<void> {
    try {
      await this.api.reabrirAtividade(atividade.id);
      this.concluindo.update((ids) => {
        const restantes = new Set(ids);
        restantes.delete(atividade.id);
        return restantes;
      });
      this.avisos.info(`Atividade “${atividade.titulo}” voltou para as pendentes.`);
      this.dados.reload();
      this.mudou.emit();
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    }
  }
}
