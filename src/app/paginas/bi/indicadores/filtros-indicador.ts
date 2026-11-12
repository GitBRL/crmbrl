import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { LucideListFilter } from '@lucide/angular';

import { paraCampoData } from '../../../nucleo/formatos';
import { SetoresService } from '../../../nucleo/setores/setores.service';
import { Alternador } from '../../../ui/alternador/alternador';
import { Botao } from '../../../ui/botao/botao';
import { CampoData } from '../../../ui/campo-data/campo-data';
import { CampoTexto } from '../../../ui/campo-texto/campo-texto';
import { Seletor, type OpcaoSeletor } from '../../../ui/seletor/seletor';
import { inicioDoDia } from '../bi.api';
import { ROTULO_ORIGEM } from '../bi.formatos';
import { filtrosAtivos } from './indicadores.formatos';
import { ROTULO_PERIODO, type FiltrosDoIndicador, type TipoDePeriodo } from './indicadores.tipos';

export interface OpcoesDosFiltrosIndicador {
  readonly pessoas: readonly { readonly id: string; readonly nome: string }[];
  readonly lideres: readonly { readonly id: string; readonly nome: string }[];
  readonly funis: readonly {
    readonly id: string;
    readonly nome: string;
    readonly etapas: readonly { readonly id: string; readonly nome: string }[];
  }[];
}

export const SEM_OPCOES_INDICADOR: OpcoesDosFiltrosIndicador = {
  pessoas: [],
  lideres: [],
  funis: [],
};

const ORIGENS: readonly OpcaoSeletor<string>[] = [
  'SITE',
  'WHATSAPP',
  'INSTAGRAM',
  'MESSENGER',
  'EMAIL',
  'WEBHOOK',
  'INDICACAO',
  'IMPORTACAO',
  'PASSAGEM',
  'MANUAL',
  'OUTRO',
].map((valor) => ({ valor, rotulo: ROTULO_ORIGEM[valor] ?? valor }));

const PERIODOS: readonly OpcaoSeletor<TipoDePeriodo>[] = (
  Object.keys(ROTULO_PERIODO) as TipoDePeriodo[]
).map((valor) => ({ valor, rotulo: ROTULO_PERIODO[valor] }));

const lista = (texto: string | number | null): readonly string[] | undefined => {
  const itens = String(texto ?? '')
    .split(',')
    .map((i) => i.trim())
    .filter(Boolean);
  return itens.length > 0 ? itens : undefined;
};

/** Tira as chaves vazias para o filtro guardado ficar enxuto. */
export function limparFiltros(filtros: FiltrosDoIndicador): FiltrosDoIndicador {
  return Object.fromEntries(
    Object.entries(filtros).filter(([, valor]) => {
      if (valor === undefined || valor === null || valor === '') {
        return false;
      }
      return !(Array.isArray(valor) && valor.length === 0);
    }),
  ) as FiltrosDoIndicador;
}

/**
 * Filtros de um painel ou de um indicador (R33.3): período, comparação, funil, etapa, setor, equipe,
 * pessoa, origem, UTM e etiquetas do contato. Só mostra o que a pessoa pode usar (a API recusa o
 * resto, R20.3). O que muda volta em `filtros`.
 */
@Component({
  selector: 'app-filtros-indicador',
  imports: [Alternador, Botao, CampoData, CampoTexto, Seletor],
  template: `
    <div class="filtros__linha">
      <app-seletor
        rotulo="Período"
        [opcoes]="periodos"
        [valor]="periodo().tipo"
        (valorChange)="escolherPeriodo($event)"
      />
      <app-alternador
        rotulo="Comparar com o período anterior"
        [valor]="filtros().comparar ?? true"
        (valorChange)="alterar({ comparar: $event })"
      />
      <button
        appBotao
        type="button"
        tamanho="sm"
        [icone]="iconeFiltro"
        [attr.aria-expanded]="maisAberto()"
        [attr.aria-controls]="idMais"
        (click)="maisAberto.set(!maisAberto())"
      >
        Mais filtros{{ ativos() ? ' (' + ativos() + ')' : '' }}
      </button>
      @if (ativos() > 0) {
        <button appBotao type="button" tamanho="sm" semCirculo (click)="limpar()">Limpar</button>
      }
    </div>

    @if (periodo().tipo === 'PERSONALIZADO') {
      <div class="filtros__datas">
        <app-campo-data rotulo="De" [valor]="de()" (valorChange)="alterarDatas($event, ate())" />
        <app-campo-data
          rotulo="Até"
          [minimo]="de()"
          [valor]="ate()"
          (valorChange)="alterarDatas(de(), $event)"
        />
        @if (erroPeriodo(); as erro) {
          <p class="filtros__erro" role="alert">{{ erro }}</p>
        }
      </div>
    }

    @if (maisAberto()) {
      <div class="filtros__mais" [id]="idMais">
        @if (funis().length > 0) {
          <app-seletor
            rotulo="Funil"
            placeholder="Todos"
            permitirVazio
            [opcoes]="funis()"
            [valor]="funilId()"
            (valorChange)="escolherFunil($event)"
          />
        }
        @if (etapas().length > 0) {
          <app-seletor
            rotulo="Etapa"
            placeholder="Todas"
            permitirVazio
            [opcoes]="etapas()"
            [valor]="filtros().etapaIds?.[0] ?? null"
            (valorChange)="alterar({ etapaIds: $event ? [$event] : undefined })"
          />
        }
        @if (diretoria()) {
          <app-seletor
            rotulo="Setor"
            placeholder="Todos"
            permitirVazio
            [opcoes]="setores.opcoes()"
            [valor]="filtros().setor ?? null"
            (valorChange)="alterar({ setor: $event ?? undefined })"
          />
        }
        @if (lideres().length > 0) {
          <app-seletor
            rotulo="Equipe"
            placeholder="Todas"
            permitirVazio
            [opcoes]="lideres()"
            [valor]="filtros().equipeId ?? null"
            (valorChange)="alterar({ equipeId: $event ?? undefined })"
          />
        }
        @if (pessoas().length > 1) {
          <app-seletor
            rotulo="Pessoa"
            placeholder="Todas"
            permitirVazio
            [opcoes]="pessoas()"
            [valor]="filtros().pessoaIds?.[0] ?? null"
            (valorChange)="alterar({ pessoaIds: $event ? [$event] : undefined })"
          />
        }
        <app-seletor
          rotulo="Origem"
          placeholder="Todas"
          permitirVazio
          [opcoes]="origens"
          [valor]="filtros().origens?.[0] ?? null"
          (valorChange)="alterar({ origens: $event ? [$event] : undefined })"
        />
        <app-campo-texto
          rotulo="UTM source"
          placeholder="google, facebook"
          dica="Separe por vírgula."
          [valor]="(filtros().utmSource ?? []).join(', ')"
          (valorChange)="alterar({ utmSource: lista($event) })"
        />
        <app-campo-texto
          rotulo="UTM campaign"
          placeholder="black-friday"
          dica="Separe por vírgula."
          [valor]="(filtros().utmCampaign ?? []).join(', ')"
          (valorChange)="alterar({ utmCampaign: lista($event) })"
        />
        <app-campo-texto
          rotulo="Etiquetas do contato"
          placeholder="vip, indicação"
          dica="Separe por vírgula."
          [valor]="(filtros().etiquetas ?? []).join(', ')"
          (valorChange)="alterar({ etiquetas: lista($event) })"
        />
      </div>
    }
  `,
  styleUrl: './filtros-indicador.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiltrosIndicador {
  readonly filtros = model.required<FiltrosDoIndicador>();
  readonly opcoes = input<OpcoesDosFiltrosIndicador>(SEM_OPCOES_INDICADOR);
  /** Admin e C-level escolhem o setor e a equipe. */
  readonly diretoria = input(false);
  readonly idMais = `filtros-indicador-${Math.random().toString(36).slice(2, 8)}`;

  protected readonly iconeFiltro = LucideListFilter;
  protected readonly periodos = PERIODOS;
  protected readonly origens = ORIGENS;
  protected readonly setores = inject(SetoresService);
  protected readonly maisAberto = signal(false);
  protected readonly lista = lista;

  protected readonly periodo = computed(
    () => this.filtros().periodo ?? { tipo: 'ULTIMOS_30_DIAS' as const },
  );
  protected readonly de = computed(() => {
    const iso = this.periodo().de;
    return iso ? paraCampoData(iso) : null;
  });
  protected readonly ate = computed(() => {
    const iso = this.periodo().ate;
    return iso ? paraCampoData(new Date(Date.parse(iso) - 1)) : null;
  });
  protected readonly funis = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.opcoes().funis.map((f) => ({ valor: f.id, rotulo: f.nome })),
  );
  protected readonly funilId = computed(() => this.filtros().funilIds?.[0] ?? null);
  protected readonly etapas = computed<readonly OpcaoSeletor<string>[]>(
    () =>
      this.opcoes()
        .funis.find((f) => f.id === this.funilId())
        ?.etapas.map((e) => ({ valor: e.id, rotulo: e.nome })) ?? [],
  );
  protected readonly lideres = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.diretoria() ? this.opcoes().lideres.map((l) => ({ valor: l.id, rotulo: l.nome })) : [],
  );
  protected readonly pessoas = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.opcoes().pessoas.map((p) => ({ valor: p.id, rotulo: p.nome })),
  );
  protected readonly ativos = computed(() => filtrosAtivos(this.filtros()));
  protected readonly erroPeriodo = computed(() => {
    const { tipo, de, ate } = this.periodo();
    if (tipo !== 'PERSONALIZADO') {
      return null;
    }
    if (!de || !ate) {
      return 'Escolha a data inicial e a final.';
    }
    if (Date.parse(de) >= Date.parse(ate)) {
      return 'A data inicial precisa ser antes da final.';
    }
    return (Date.parse(ate) - Date.parse(de)) / 86_400_000 > 366
      ? 'O período pode ter no máximo 1 ano.'
      : null;
  });

  constructor() {
    void this.setores.carregar();
  }

  protected escolherPeriodo(tipo: TipoDePeriodo | null): void {
    if (!tipo) {
      return;
    }
    this.alterar({
      periodo:
        tipo === 'PERSONALIZADO'
          ? {
              tipo,
              de: this.periodo().de ?? inicioDoDia(hojeMenos(29)),
              ate: this.periodo().ate ?? inicioDoDia(hojeMenos(0), 1),
            }
          : { tipo },
    });
  }

  protected alterarDatas(de: string | null, ate: string | null): void {
    this.alterar({
      periodo: {
        tipo: 'PERSONALIZADO',
        de: de ? inicioDoDia(de) : undefined,
        ate: ate ? inicioDoDia(ate, 1) : undefined,
      },
    });
  }

  protected escolherFunil(id: string | null): void {
    this.alterar({ funilIds: id ? [id] : undefined, etapaIds: undefined });
  }

  protected alterar(
    parcial: Partial<{ -readonly [K in keyof FiltrosDoIndicador]: FiltrosDoIndicador[K] }>,
  ): void {
    this.filtros.update((f) => limparFiltros({ ...f, ...parcial }));
  }

  protected limpar(): void {
    this.filtros.update((f) => limparFiltros({ periodo: f.periodo, comparar: f.comparar }));
  }
}

function hojeMenos(dias: number): string {
  return paraCampoData(new Date(Date.now() - dias * 86_400_000));
}
