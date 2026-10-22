import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  LucideArrowRight,
  LucideCalendarCheck,
  LucideCheck,
  LucideDynamicIcon,
  type LucideIconInput,
  LucideInfo,
  LucidePlus,
  LucideRefreshCw,
  LucideUserRound,
  LucideWorkflow,
  LucideX,
} from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { formatarDataHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { FunisApi } from './funis.api';
import type { RegistroLinhaDoTempo, TipoAtividade } from './funis.tipos';

const POR_PAGINA = 20;

type Conteudo = 'tudo' | 'eventos' | 'atividades';

/** Os mesmos filtros da linha do tempo do contato. */
const OPCOES: readonly OpcaoFiltro[] = [
  { id: 'tudo', rotulo: 'Tudo' },
  { id: 'eventos', rotulo: 'Alterações' },
  { id: 'atividades', rotulo: 'Atividades' },
];

/** Eventos da auditoria que a própria atividade, já na lista, conta (criada, concluída…). */
const EVENTOS_DA_ATIVIDADE = new Set([
  'atividade.criada',
  'atividade.concluida',
  'atividade.cancelada',
  'atividade.reaberta',
]);

/**
 * Tira os eventos de uma atividade que já aparece na lista (a mesma reunião vinha até três
 * vezes: "criada", a atividade e "concluída"). Só nos registros carregados até agora.
 */
export function semEventosRepetidos(
  registros: readonly RegistroLinhaDoTempo[],
): RegistroLinhaDoTempo[] {
  const atividades = new Set(
    registros.flatMap((registro) => (registro.atividade ? [registro.atividade.id] : [])),
  );
  return registros.filter(
    (registro) =>
      !registro.evento ||
      registro.evento.entidade !== 'atividade' ||
      !EVENTOS_DA_ATIVIDADE.has(registro.evento.acao) ||
      !registro.evento.entidadeId ||
      !atividades.has(registro.evento.entidadeId),
  );
}

export const ROTULO_TIPO_ATIVIDADE: Readonly<Record<TipoAtividade, string>> = {
  TAREFA: 'Tarefa',
  LIGACAO: 'Ligação',
  REUNIAO: 'Reunião',
  EMAIL: 'E-mail',
  WHATSAPP: 'WhatsApp',
  NOTA: 'Nota',
};

/** Ícone de cada ação da auditoria (o resto cai no "i"). */
function iconeDaAcao(acao: string): LucideIconInput {
  if (acao === 'passagem.executada') {
    return LucideWorkflow;
  }
  const verbo = acao.split('.')[1] ?? '';
  switch (verbo) {
    case 'criado':
    case 'criada':
      return LucidePlus;
    case 'movido':
      return LucideArrowRight;
    case 'ganho':
      return LucideCheck;
    case 'perdido':
    case 'excluido':
      return LucideX;
    case 'reaberto':
    case 'reconvertido':
      return LucideRefreshCw;
    case 'assumido':
    case 'encaminhado':
      return LucideUserRound;
    default:
      return LucideInfo;
  }
}

interface ItemLinha {
  readonly id: string;
  readonly icone: LucideIconInput;
  readonly titulo: string;
  readonly detalhe: string | null;
  readonly quando: string;
  readonly quandoCompleto: string;
  readonly iso: string;
  readonly tom: 'neutro' | 'sucesso' | 'perda' | 'atividade' | 'atrasada';
}

function paraItem(registro: RegistroLinhaDoTempo): ItemLinha {
  const quando = formatarTempoRelativo(registro.ocorridoEm);
  const quandoCompleto = formatarDataHora(registro.ocorridoEm);
  if (registro.evento) {
    const evento = registro.evento;
    const verbo = evento.acao.split('.')[1];
    const motivo =
      evento.acao === 'negocio.perdido' && typeof evento.dados?.['motivoPerda'] === 'string'
        ? `Motivo: ${evento.dados['motivoPerda']}`
        : null;
    return {
      id: `evento-${evento.id}`,
      icone: iconeDaAcao(evento.acao),
      titulo: evento.resumo,
      // "por Fulano" — a não ser que o resumo já diga quem fez (as passagens dizem).
      detalhe:
        [
          evento.atorDescricao && !evento.resumo.includes(evento.atorDescricao)
            ? `por ${evento.atorDescricao}`
            : null,
          motivo,
        ]
          .filter(Boolean)
          .join(' · ') || null,
      quando,
      quandoCompleto,
      iso: registro.ocorridoEm,
      tom: verbo === 'ganho' ? 'sucesso' : verbo === 'perdido' ? 'perda' : 'neutro',
    };
  }
  const atividade = registro.atividade!;
  const situacao =
    atividade.status === 'CONCLUIDA'
      ? 'concluída'
      : atividade.status === 'CANCELADA'
        ? 'cancelada'
        : atividade.atrasada
          ? 'atrasada'
          : 'pendente';
  return {
    id: `atividade-${atividade.id}`,
    icone: LucideCalendarCheck,
    titulo: `${ROTULO_TIPO_ATIVIDADE[atividade.tipo]}: ${atividade.titulo}`,
    detalhe: `${situacao} · ${atividade.responsavel.nome}`,
    quando,
    quandoCompleto,
    iso: registro.ocorridoEm,
    tom: atividade.atrasada && atividade.status === 'PENDENTE' ? 'atrasada' : 'atividade',
  };
}

/**
 * Linha do tempo do negócio (R3.5): os eventos da auditoria ligados a ele e as atividades,
 * do mais recente ao mais antigo, com "Carregar mais". `versao` muda quando o negócio muda
 * (movido, editado), e a linha recarrega.
 */
@Component({
  selector: 'app-linha-do-tempo-negocio',
  imports: [Botao, Esqueleto, EstadoVazio, FiltrosPilula, LucideDynamicIcon],
  template: `
    <app-filtros-pilula
      rotulo="Mostrar na linha do tempo"
      [opcoes]="opcoes"
      [selecionado]="filtro()"
      (selecionadoChange)="escolher($event)"
    />
    @if (carregando() && !itens().length) {
      <div class="carregando" aria-busy="true">
        <p class="visualmente-oculto" role="status">Carregando a linha do tempo…</p>
        @for (linha of [1, 2, 3]; track linha) {
          <div class="carregando__linha" aria-hidden="true">
            <app-esqueleto forma="circulo" largura="32px" altura="32px" />
            <app-esqueleto [linhas]="2" />
          </div>
        }
      </div>
    } @else if (erro(); as falha) {
      <app-estado-vazio
        compacto
        variante="erro"
        [falha]="falha"
        titulo="Não conseguimos carregar a linha do tempo"
        [texto]="falha.resumo"
        [codigo]="falha.requisicaoId"
      >
        <button appBotao type="button" variante="contorno" (click)="carregar(1)">
          Tentar de novo
        </button>
      </app-estado-vazio>
    } @else if (!itens().length) {
      <app-estado-vazio compacto titulo="Nada por aqui ainda" [texto]="textoVazio()" />
    } @else {
      <ol class="linha" aria-label="Linha do tempo do negócio">
        @for (item of itens(); track item.id) {
          <li [class]="'item item--' + item.tom">
            <span class="item__icone" aria-hidden="true"
              ><svg [lucideIcon]="item.icone" [size]="16"
            /></span>
            <div class="item__texto">
              <p class="item__titulo">{{ item.titulo }}</p>
              <p class="item__detalhe">
                @if (item.detalhe) {
                  {{ item.detalhe }} ·
                }
                <time [attr.datetime]="item.iso" [title]="item.quandoCompleto">{{
                  item.quando
                }}</time>
              </p>
            </div>
          </li>
        }
      </ol>
      @if (temMais()) {
        <button
          appBotao
          type="button"
          tamanho="sm"
          variante="contorno"
          class="mais"
          [carregando]="carregando()"
          (click)="carregar(pagina() + 1)"
        >
          Carregar mais
        </button>
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-4);
    }

    .carregando {
      display: grid;
      gap: var(--esp-4);
    }

    .carregando__linha {
      display: grid;
      grid-template-columns: 32px 1fr;
      gap: var(--esp-3);
    }

    .linha {
      position: relative;
      display: grid;
      gap: var(--esp-4);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    // O fio que liga os ícones.
    .linha::before {
      content: '';
      position: absolute;
      top: 16px;
      bottom: 16px;
      left: 15px;
      width: 2px;
      border-radius: var(--raio-pilula);
      background: var(--cor-borda);
    }

    .item {
      position: relative;
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr);
      gap: var(--esp-3);
      align-items: start;
    }

    .item__icone {
      display: inline-grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--cor-superficie-3);
      box-shadow: 0 0 0 4px var(--cor-superficie);
      color: var(--cor-texto);
    }

    .item--sucesso .item__icone {
      background: var(--dado-2);
      color: var(--cor-sobre-marca);
      box-shadow:
        0 0 0 4px var(--cor-superficie),
        inset 0 0 0 1px var(--cor-contorno-dado);
    }

    .item--perda .item__icone,
    .item--atrasada .item__icone {
      background: var(--cor-destaque);
      color: var(--cor-sobre-destaque);
    }

    .item__texto {
      display: grid;
      gap: 2px;
      padding-top: 5px;
    }

    .item__titulo {
      color: var(--cor-texto);
      font: var(--fonte-corpo-sm);
      overflow-wrap: anywhere;
    }

    .item__detalhe {
      color: var(--cor-texto-fraco);
      font: var(--fonte-legenda);
    }

    .item--atrasada .item__detalhe {
      color: var(--cor-destaque-texto);
    }

    .mais {
      justify-self: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinhaDoTempoNegocio {
  readonly negocioId = input.required<string>();
  /** Muda quando o negócio muda: a linha recarrega do começo. */
  readonly versao = input(0);

  private readonly api = inject(FunisApi);

  protected readonly registros = signal<readonly RegistroLinhaDoTempo[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(1);
  protected readonly carregando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly opcoes = OPCOES;
  protected readonly filtro = signal<Conteudo>('tudo');
  protected readonly itens = computed(() => semEventosRepetidos(this.registros()).map(paraItem));
  protected readonly textoVazio = computed(() =>
    this.filtro() === 'eventos'
      ? 'As mudanças deste negócio aparecem aqui.'
      : this.filtro() === 'atividades'
        ? 'As atividades deste negócio aparecem aqui.'
        : 'As mudanças e as atividades deste negócio aparecem aqui.',
  );
  protected readonly temMais = computed(() => this.registros().length < this.total());
  private pedido = 0;

  constructor() {
    effect(() => {
      this.negocioId();
      this.versao();
      this.filtro();
      untracked(() => void this.carregar(1));
    });
  }

  protected escolher(filtro: string | null): void {
    if (filtro === 'tudo' || filtro === 'eventos' || filtro === 'atividades') {
      this.filtro.set(filtro);
    }
  }

  async carregar(pagina: number): Promise<void> {
    const pedido = ++this.pedido;
    const id = this.negocioId();
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const resposta = await this.api.linhaDoTempo(id, pagina, POR_PAGINA, this.filtro());
      if (pedido !== this.pedido) {
        return;
      }
      this.registros.set(pagina === 1 ? resposta.itens : [...this.registros(), ...resposta.itens]);
      this.total.set(resposta.total);
      this.pagina.set(pagina);
    } catch (falha) {
      if (pedido === this.pedido) {
        this.erro.set(erroDaApi(falha));
      }
    } finally {
      if (pedido === this.pedido) {
        this.carregando.set(false);
      }
    }
  }
}
