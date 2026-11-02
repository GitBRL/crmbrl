import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { LucidePlus, LucideRefreshCw, LucideSlidersHorizontal } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { formatarData, formatarTempoRelativo } from '../../nucleo/formatos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { Selo } from '../../ui/selo/selo';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, type Ordenacao, Tabela } from '../../ui/tabela/tabela';
import { gerarId } from '../../ui/tipos';
import { buscaComAtraso } from './busca-com-atraso';
import {
  type ConsultaLista,
  filtroDeResponsavel,
  OPCOES_POR_PAGINA,
  opcoesDeResponsavel,
  temFiltros,
} from './consulta';
import { ContatosApi } from './contatos.api';
import {
  type Contato,
  descreverUtm,
  type FiltrosContatos,
  formatarTelefone,
  ORIGENS,
  type OrdenacaoContatos,
  type OrigemContato,
  ROTULO_ORIGEM,
} from './contatos.tipos';

/** Coluna da tabela → ordenação da API. */
const ORDEM_DA_COLUNA: Readonly<Record<string, OrdenacaoContatos>> = {
  nome: 'nome',
  origem: 'ultimaOrigemEm',
};

const OPCOES_MARKETING: readonly OpcaoFiltro[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'recebe', rotulo: 'Recebem marketing' },
  { id: 'optout', rotulo: 'Opt-out' },
];

/**
 * Aba "Pessoas" de `/contatos` (TELAS-FASE1 §4): busca por nome, e-mail ou telefone; filtros
 * de responsável, origem, etiqueta e opt-out; tabela (cartões no celular) e paginação. O
 * estado fica na URL (a página `Contatos` lê e grava): aqui só se pede a mudança (`mudar`).
 */
@Component({
  selector: 'app-lista-pessoas',
  imports: [
    Avatar,
    Botao,
    BotaoIcone,
    CampoBusca,
    CelulaTabela,
    EstadoVazio,
    FiltrosPilula,
    Paginacao,
    Selo,
    Seletor,
    Tabela,
  ],
  templateUrl: './lista-pessoas.html',
  styleUrl: './lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListaPessoas {
  readonly consulta = input.required<ConsultaLista>();
  /** Pede uma mudança na consulta (a página grava na URL). */
  readonly mudar = output<Partial<ConsultaLista>>();
  /** "Novo contato" do estado vazio. */
  readonly novo = output<void>();

  private readonly api = inject(ContatosApi);
  private readonly sessao = inject(SessaoService);

  protected readonly icones = {
    novo: LucidePlus,
    tentar: LucideRefreshCw,
    filtros: LucideSlidersHorizontal,
  };
  protected readonly idFiltros = gerarId('filtros-lista');
  /** No celular os filtros ficam recolhidos atrás do botão "Filtros". */
  protected readonly filtrosAbertos = signal(false);
  protected readonly opcoesMarketing = OPCOES_MARKETING;
  protected readonly opcoesPorPagina = OPCOES_POR_PAGINA;
  protected readonly rotuloOrigem = ROTULO_ORIGEM;
  protected readonly formatarTelefone = formatarTelefone;
  protected readonly formatarTempoRelativo = formatarTempoRelativo;
  protected readonly formatarData = formatarData;
  protected readonly descreverUtm = descreverUtm;

  protected readonly busca = buscaComAtraso(
    () => this.consulta().busca,
    (busca) => this.mudar.emit({ busca }),
  );

  protected readonly colunas: readonly ColunaTabela[] = [
    { id: 'nome', rotulo: 'Nome', ordenavel: true, largura: '24%' },
    { id: 'empresa', rotulo: 'Empresa' },
    { id: 'contato', rotulo: 'E-mail e telefone' },
    { id: 'origem', rotulo: 'Última origem', ordenavel: true },
    { id: 'responsavel', rotulo: 'Responsável' },
    { id: 'etiquetas', rotulo: 'Etiquetas' },
  ];

  private readonly usuarios = rxResource({ stream: () => this.api.usuariosAtivos() });
  private readonly etiquetas = rxResource({ stream: () => this.api.etiquetasDeContatos() });

  protected readonly opcoesResponsavel = computed(() =>
    opcoesDeResponsavel(
      this.usuarios.hasValue() ? this.usuarios.value() : [],
      this.sessao.usuario()?.id ?? null,
    ),
  );

  /**
   * O filtro é pela **primeira** origem (a coluna mostra a última): o texto da opção diz qual,
   * porque o rótulo do seletor fica oculto ("Primeira origem: Site").
   */
  protected readonly opcoesOrigem: readonly OpcaoSeletor<string>[] = ORIGENS.map((origem) => ({
    valor: origem,
    rotulo: `Primeira origem: ${ROTULO_ORIGEM[origem]}`,
  }));

  protected readonly opcoesEtiqueta = computed<readonly OpcaoSeletor<string>[]>(() => {
    const emUso = this.etiquetas.hasValue() ? this.etiquetas.value() : [];
    const opcoes = emUso.map((item) => ({
      valor: item.etiqueta,
      rotulo: `${item.etiqueta} (${item.quantidade})`,
    }));
    // A etiqueta da URL continua escolhível mesmo antes da lista chegar.
    const atual = this.consulta().etiqueta;
    return atual && !opcoes.some((opcao) => opcao.valor.toLowerCase() === atual.toLowerCase())
      ? [{ valor: atual, rotulo: atual }, ...opcoes]
      : opcoes;
  });

  protected readonly marketing = computed(() => this.consulta().marketing ?? 'todos');
  protected readonly filtrando = computed(() => temFiltros(this.consulta()));
  protected readonly buscando = computed(() => this.filtrando() || !!this.consulta().busca);

  private readonly filtrosApi = computed<FiltrosContatos>(() => {
    const consulta = this.consulta();
    const ordenarPor = consulta.ordem ? (ORDEM_DA_COLUNA[consulta.ordem.coluna] ?? null) : null;
    const origem = ORIGENS.includes(consulta.origem as OrigemContato)
      ? (consulta.origem as OrigemContato)
      : null;
    return {
      busca: consulta.busca || null,
      ...filtroDeResponsavel(consulta.responsavel, this.sessao.usuario()?.id ?? null),
      origem,
      etiqueta: consulta.etiqueta,
      optOut:
        consulta.marketing === 'optout' ? true : consulta.marketing === 'recebe' ? false : null,
      ordenarPor,
      ordem: ordenarPor && consulta.ordem ? consulta.ordem.direcao : null,
      pagina: consulta.pagina,
      porPagina: consulta.porPagina,
    };
  });

  protected readonly dados = rxResource({
    params: () => this.filtrosApi(),
    stream: ({ params }) => this.api.listarContatos(params),
  });

  protected readonly itens = computed<readonly Contato[]>(() =>
    this.dados.hasValue() ? this.dados.value().itens : [],
  );

  /** O último total conhecido (a paginação não some enquanto a próxima página carrega). */
  protected readonly total = linkedSignal<number | undefined, number>({
    source: () => (this.dados.hasValue() ? this.dados.value().total : undefined),
    computation: (novo, anterior) => novo ?? anterior?.value ?? 0,
  });

  protected readonly erro = computed(() => {
    const falha = this.dados.error();
    return falha ? erroDaApi(falha) : null;
  });

  protected readonly resultado = computed(() => {
    if (!this.dados.hasValue()) {
      return '';
    }
    const total = this.dados.value().total;
    const plural = total === 1 ? 'pessoa' : 'pessoas';
    return this.buscando()
      ? `${total.toLocaleString('pt-BR')} ${plural} encontrada${total === 1 ? '' : 's'}`
      : `${total.toLocaleString('pt-BR')} ${plural}`;
  });

  /** Quantos filtros estão ligados (no celular, a contagem no botão "Filtros"). */
  protected readonly quantosFiltros = computed(() => {
    const consulta = this.consulta();
    return [
      consulta.responsavel,
      consulta.origem,
      consulta.etiqueta,
      consulta.marketing,
      consulta.uf,
    ].filter(Boolean).length;
  });

  protected readonly rotuloFiltros = computed(() => {
    const quantos = this.quantosFiltros();
    return quantos ? `Filtros (${quantos} ligados)` : 'Filtros';
  });

  protected readonly linkDoContato = (contato: Contato) => ['/contatos', contato.id];

  constructor() {
    // Página além do fim (a lista encolheu): volta para a última que existe.
    effect(() => {
      if (!this.dados.hasValue()) {
        return;
      }
      const { itens, total, pagina, porPagina } = this.dados.value();
      if (itens.length === 0 && total > 0 && pagina > 1) {
        this.mudar.emit({ pagina: Math.max(1, Math.ceil(total / porPagina)) });
      }
    });
  }

  protected escolherResponsavel(valor: string | null): void {
    this.mudar.emit({ responsavel: valor });
  }

  protected escolherOrigem(valor: string | null): void {
    this.mudar.emit({ origem: valor });
  }

  protected escolherEtiqueta(valor: string | null): void {
    this.mudar.emit({ etiqueta: valor });
  }

  protected escolherMarketing(valor: string | null): void {
    this.mudar.emit({ marketing: valor === 'optout' || valor === 'recebe' ? valor : null });
  }

  protected ordenar(ordem: Ordenacao | null): void {
    this.mudar.emit({ ordem });
  }

  protected irParaPagina(pagina: number): void {
    this.mudar.emit({ pagina });
  }

  protected mudarPorPagina(porPagina: number): void {
    this.mudar.emit({ porPagina });
  }

  protected limparFiltros(): void {
    this.busca.esvaziar();
    this.mudar.emit({
      busca: '',
      responsavel: null,
      origem: null,
      etiqueta: null,
      marketing: null,
      uf: null,
    });
  }

  protected alternarFiltros(): void {
    this.filtrosAbertos.update((aberto) => !aberto);
  }

  protected tentarDeNovo(): void {
    this.dados.reload();
  }
}
