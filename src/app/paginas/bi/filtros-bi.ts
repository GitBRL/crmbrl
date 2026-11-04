import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { LucideListFilter } from '@lucide/angular';

import type { Area } from '../../nucleo/sessao/perfil';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { Alternador } from '../../ui/alternador/alternador';
import { Botao } from '../../ui/botao/botao';
import { CampoData } from '../../ui/campo-data/campo-data';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import type {
  CanalDoFiltro,
  FilaDoFiltro,
  FunilDoFiltro,
  LiderDoFiltro,
  PessoaDoFiltro,
} from './bi.api';
import type { FiltrosBi, IdPainel } from './bi.tipos';

export interface OpcoesDosFiltros {
  readonly pessoas: readonly PessoaDoFiltro[];
  readonly lideres: readonly LiderDoFiltro[];
  readonly funis: readonly FunilDoFiltro[];
  readonly canais: readonly CanalDoFiltro[];
  readonly filas: readonly FilaDoFiltro[];
}

export const SEM_OPCOES: OpcoesDosFiltros = {
  pessoas: [],
  lideres: [],
  funis: [],
  canais: [],
  filas: [],
};

const AREA_DO_PAINEL: Partial<Record<IdPainel, Area>> = {
  marketing: 'MARKETING',
  comercial: 'COMERCIAL',
  cs: 'CS',
};

const OPCOES_AREA: readonly OpcaoSeletor<string>[] = [
  { valor: 'MARKETING', rotulo: 'Marketing' },
  { valor: 'COMERCIAL', rotulo: 'Comercial' },
  { valor: 'CS', rotulo: 'Sucesso do cliente' },
];

/** AAAA-MM-DD do dia local, `atras` dias antes de hoje. */
export function diaLocal(atras = 0, referencia = new Date()): string {
  const dia = new Date(
    referencia.getFullYear(),
    referencia.getMonth(),
    referencia.getDate() - atras,
  );
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dia.getFullYear()}-${p(dia.getMonth() + 1)}-${p(dia.getDate())}`;
}

/** Os últimos `dias` dias, contando hoje. */
export function ultimosDias(dias: number): Pick<FiltrosBi, 'de' | 'ate'> {
  return { de: diaLocal(dias - 1), ate: diaLocal(0) };
}

const PERIODOS: readonly ItemAba[] = [
  { id: '7', rotulo: '7 dias' },
  { id: '30', rotulo: '30 dias' },
  { id: '90', rotulo: '90 dias' },
  { id: 'outro', rotulo: 'Outro período' },
];

/**
 * Filtros do topo do BI: período (7, 30, 90 dias ou datas livres, até 1 ano), comparação com
 * o período anterior e, conforme o painel e o papel, área, equipe, responsável, funil, canal e
 * fila. Só aparece o filtro que a pessoa pode usar; o que muda a lista volta em `filtros`.
 */
@Component({
  selector: 'app-bi-filtros',
  imports: [Abas, Alternador, Botao, CampoData, Seletor],
  template: `
    <div class="filtros__linha">
      <app-abas
        rotulo="Período"
        modo="opcoes"
        tamanho="sm"
        [abas]="periodos"
        [selecionada]="preset()"
        (selecionadaChange)="escolherPeriodo($event)"
      />
      <app-alternador
        rotulo="Comparar com o período anterior"
        [valor]="filtros().comparar"
        (valorChange)="alterar({ comparar: $event })"
      />
      @if (temMais()) {
        <button
          appBotao
          type="button"
          tamanho="sm"
          [icone]="iconeFiltro"
          [attr.aria-expanded]="maisAberto()"
          [attr.aria-controls]="'filtros-mais'"
          (click)="maisAberto.set(!maisAberto())"
        >
          Mais filtros{{ ativos() ? ' (' + ativos() + ')' : '' }}
        </button>
      }
      @if (ativos() > 0) {
        <button appBotao type="button" tamanho="sm" semCirculo (click)="limpar()">Limpar</button>
      }
    </div>

    @if (preset() === 'outro') {
      <div class="filtros__datas">
        <app-campo-data
          rotulo="De"
          [maximo]="hoje"
          [valor]="filtros().de"
          (valorChange)="alterarDatas($event, filtros().ate)"
        />
        <app-campo-data
          rotulo="Até"
          [maximo]="hoje"
          [minimo]="filtros().de"
          [valor]="filtros().ate"
          (valorChange)="alterarDatas(filtros().de, $event)"
        />
        @if (erroPeriodo(); as erro) {
          <p class="filtros__erro" role="alert">{{ erro }}</p>
        }
      </div>
    }

    @if (temMais() && maisAberto()) {
      <div class="filtros__mais" id="filtros-mais">
        @if (mostrarArea()) {
          <app-seletor
            rotulo="Área"
            placeholder="Todas"
            permitirVazio
            [opcoes]="opcoesArea"
            [valor]="filtros().area"
            (valorChange)="alterar({ area: $event })"
          />
        }
        @if (opcoesEquipe().length > 0) {
          <app-seletor
            rotulo="Equipe"
            placeholder="Todas"
            permitirVazio
            [opcoes]="opcoesEquipe()"
            [valor]="filtros().equipeId"
            (valorChange)="alterar({ equipeId: $event })"
          />
        }
        @if (opcoesPessoa().length > 0) {
          <app-seletor
            rotulo="Responsável"
            placeholder="Todos"
            permitirVazio
            [opcoes]="opcoesPessoa()"
            [valor]="filtros().pessoaId"
            (valorChange)="alterar({ pessoaId: $event })"
          />
        }
        @if (opcoesFunil().length > 0) {
          <app-seletor
            rotulo="Funil"
            placeholder="Todos"
            permitirVazio
            [opcoes]="opcoesFunil()"
            [valor]="filtros().funilId"
            (valorChange)="alterar({ funilId: $event })"
          />
        }
        @if (opcoesCanal().length > 0) {
          <app-seletor
            rotulo="Canal"
            placeholder="Todos"
            permitirVazio
            [opcoes]="opcoesCanal()"
            [valor]="filtros().canalId"
            (valorChange)="alterar({ canalId: $event })"
          />
        }
        @if (opcoesFila().length > 0) {
          <app-seletor
            rotulo="Fila"
            placeholder="Todas"
            permitirVazio
            [opcoes]="opcoesFila()"
            [valor]="filtros().filaId"
            (valorChange)="alterar({ filaId: $event })"
          />
        }
      </div>
    }
  `,
  styleUrl: './filtros-bi.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiltrosBiComponente {
  readonly painel = input.required<IdPainel>();
  readonly filtros = model.required<FiltrosBi>();
  readonly opcoes = input<OpcoesDosFiltros>(SEM_OPCOES);
  /** Admin e C-level: escolhem a área e a equipe. */
  readonly diretoria = input(false);
  /** Avisa a escolha de um período pronto ("outro" não consulta até as datas estarem certas). */
  readonly periodoMudou = output<void>();

  protected readonly iconeFiltro = LucideListFilter;
  protected readonly periodos = PERIODOS;
  protected readonly opcoesArea = OPCOES_AREA;
  protected readonly hoje = diaLocal(0);
  protected readonly preset = signal<string | null>('30');
  protected readonly maisAberto = signal(false);

  protected readonly mostrarArea = computed(
    () => this.diretoria() && ['marketing', 'atendimento', 'sdr'].includes(this.painel()),
  );
  protected readonly opcoesEquipe = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.diretoria() ? this.opcoes().lideres.map((l) => ({ valor: l.id, rotulo: l.nome })) : [],
  );
  protected readonly opcoesPessoa = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.opcoes().pessoas.length > 1
      ? this.opcoes().pessoas.map((p) => ({ valor: p.id, rotulo: p.nome }))
      : [],
  );
  protected readonly opcoesFunil = computed<readonly OpcaoSeletor<string>[]>(() => {
    const area = AREA_DO_PAINEL[this.painel()];
    if (!area) {
      return [];
    }
    const funis = this.opcoes().funis.filter((f) => f.area === area);
    return funis.length > 1 ? funis.map((f) => ({ valor: f.id, rotulo: f.nome })) : [];
  });
  protected readonly opcoesCanal = computed<readonly OpcaoSeletor<string>[]>(() =>
    ['marketing', 'atendimento', 'sdr'].includes(this.painel())
      ? this.opcoes().canais.map((c) => ({ valor: c.id, rotulo: c.nome }))
      : [],
  );
  protected readonly opcoesFila = computed<readonly OpcaoSeletor<string>[]>(() =>
    ['atendimento', 'sdr'].includes(this.painel())
      ? this.opcoes().filas.map((f) => ({ valor: f.id, rotulo: f.nome }))
      : [],
  );

  protected readonly temMais = computed(
    () =>
      this.mostrarArea() ||
      this.opcoesEquipe().length > 0 ||
      this.opcoesPessoa().length > 0 ||
      this.opcoesFunil().length > 0 ||
      this.opcoesCanal().length > 0 ||
      this.opcoesFila().length > 0,
  );

  /** Quantos filtros além do período estão ligados (os que este painel usa). */
  protected readonly ativos = computed(() => {
    const f = this.filtros();
    return [
      this.mostrarArea() ? f.area : null,
      this.opcoesEquipe().length ? f.equipeId : null,
      this.opcoesPessoa().length ? f.pessoaId : null,
      this.opcoesFunil().length ? f.funilId : null,
      this.opcoesCanal().length ? f.canalId : null,
      this.opcoesFila().length ? f.filaId : null,
    ].filter((valor) => valor !== null).length;
  });

  protected readonly erroPeriodo = computed(() => {
    const { de, ate } = this.filtros();
    if (!de || !ate) {
      return 'Escolha a data inicial e a final.';
    }
    if (de > ate) {
      return 'A data inicial precisa ser antes da final.';
    }
    const dias = (Date.parse(ate) - Date.parse(de)) / 86_400_000 + 1;
    return dias > 366 ? 'O período pode ter no máximo 1 ano.' : null;
  });

  constructor() {
    // Filtro que já veio ligado (link do clique, por exemplo) abre a área.
    queueMicrotask(() => this.maisAberto.set(this.ativos() > 0));
  }

  /** Para a tela dizer qual aba de período vale quando os filtros são trocados de fora. */
  definirPreset(preset: string | null): void {
    this.preset.set(preset);
  }

  protected escolherPeriodo(id: string | null): void {
    this.preset.set(id);
    if (id && id !== 'outro') {
      this.filtros.update((f) => ({ ...f, ...ultimosDias(Number(id)) }));
      this.periodoMudou.emit();
    } else if (id === 'outro' && !this.filtros().de) {
      this.filtros.update((f) => ({ ...f, ...ultimosDias(30) }));
    }
  }

  protected alterarDatas(de: string | null, ate: string | null): void {
    this.filtros.update((f) => ({ ...f, de, ate }));
  }

  protected alterar(parcial: Partial<FiltrosBi>): void {
    this.filtros.update((f) => ({ ...f, ...parcial }));
  }

  protected limpar(): void {
    this.filtros.update((f) => ({
      ...f,
      area: null,
      equipeId: null,
      pessoaId: null,
      funilId: null,
      canalId: null,
      filaId: null,
    }));
  }
}
