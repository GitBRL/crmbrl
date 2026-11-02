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
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
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
import { type Empresa, type FiltrosEmpresas, type OrdenacaoEmpresas, UFS } from './contatos.tipos';

/** Coluna da tabela → ordenação da API (sem ordenação escolhida, a API ordena por nome). */
const ORDEM_DA_COLUNA: Readonly<Record<string, OrdenacaoEmpresas>> = {
  nome: 'nome',
};

/**
 * Aba "Empresas" de `/contatos?aba=empresas` (TELAS-FASE1 §4): busca por nome, CNPJ, e-mail
 * ou telefone; filtros de responsável, UF e etiqueta; tabela (cartões no celular) e paginação.
 */
@Component({
  selector: 'app-lista-empresas',
  imports: [
    Avatar,
    Botao,
    BotaoIcone,
    CampoBusca,
    CelulaTabela,
    EstadoVazio,
    Paginacao,
    Selo,
    Seletor,
    Tabela,
  ],
  templateUrl: './lista-empresas.html',
  styleUrl: './lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListaEmpresas {
  readonly consulta = input.required<ConsultaLista>();
  readonly mudar = output<Partial<ConsultaLista>>();
  /** "Nova empresa" do estado vazio. */
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
  protected readonly opcoesPorPagina = OPCOES_POR_PAGINA;

  protected readonly busca = buscaComAtraso(
    () => this.consulta().busca,
    (busca) => this.mudar.emit({ busca }),
  );

  protected readonly colunas: readonly ColunaTabela[] = [
    { id: 'nome', rotulo: 'Empresa', ordenavel: true, largura: '26%' },
    { id: 'cnpj', rotulo: 'CNPJ' },
    { id: 'local', rotulo: 'Cidade' },
    { id: 'pessoas', rotulo: 'Pessoas', alinhar: 'fim' },
    { id: 'responsavel', rotulo: 'Responsável' },
    { id: 'etiquetas', rotulo: 'Etiquetas' },
  ];

  private readonly usuarios = rxResource({ stream: () => this.api.usuariosAtivos() });
  private readonly etiquetas = rxResource({ stream: () => this.api.etiquetasDeEmpresas() });

  protected readonly opcoesResponsavel = computed(() =>
    opcoesDeResponsavel(
      this.usuarios.hasValue() ? this.usuarios.value() : [],
      this.sessao.usuario()?.id ?? null,
    ),
  );

  protected readonly opcoesUf: readonly OpcaoSeletor<string>[] = UFS.map((uf) => ({
    valor: uf,
    rotulo: uf,
  }));

  protected readonly opcoesEtiqueta = computed<readonly OpcaoSeletor<string>[]>(() => {
    const emUso = this.etiquetas.hasValue() ? this.etiquetas.value() : [];
    const opcoes = emUso.map((item) => ({
      valor: item.etiqueta,
      rotulo: `${item.etiqueta} (${item.quantidade})`,
    }));
    const atual = this.consulta().etiqueta;
    return atual && !opcoes.some((opcao) => opcao.valor.toLowerCase() === atual.toLowerCase())
      ? [{ valor: atual, rotulo: atual }, ...opcoes]
      : opcoes;
  });

  protected readonly buscando = computed(
    () => temFiltros(this.consulta()) || !!this.consulta().busca,
  );

  private readonly filtrosApi = computed<FiltrosEmpresas>(() => {
    const consulta = this.consulta();
    const ordenarPor = consulta.ordem ? (ORDEM_DA_COLUNA[consulta.ordem.coluna] ?? null) : null;
    const uf = UFS.find((item) => item === consulta.uf?.toUpperCase()) ?? null;
    return {
      busca: consulta.busca || null,
      ...filtroDeResponsavel(consulta.responsavel, this.sessao.usuario()?.id ?? null),
      etiqueta: consulta.etiqueta,
      uf,
      ordenarPor,
      ordem: ordenarPor && consulta.ordem ? consulta.ordem.direcao : null,
      pagina: consulta.pagina,
      porPagina: consulta.porPagina,
    };
  });

  protected readonly dados = rxResource({
    params: () => this.filtrosApi(),
    stream: ({ params }) => this.api.listarEmpresas(params),
  });

  protected readonly itens = computed<readonly Empresa[]>(() =>
    this.dados.hasValue() ? this.dados.value().itens : [],
  );

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
    const plural = total === 1 ? 'empresa' : 'empresas';
    return this.buscando()
      ? `${total.toLocaleString('pt-BR')} ${plural} encontrada${total === 1 ? '' : 's'}`
      : `${total.toLocaleString('pt-BR')} ${plural}`;
  });

  /** Quantos filtros estão ligados (no celular, a contagem no botão "Filtros"). */
  protected readonly quantosFiltros = computed(() => {
    const consulta = this.consulta();
    return [consulta.responsavel, consulta.etiqueta, consulta.uf].filter(Boolean).length;
  });

  protected readonly rotuloFiltros = computed(() => {
    const quantos = this.quantosFiltros();
    return quantos ? `Filtros (${quantos} ligados)` : 'Filtros';
  });

  protected readonly linkDaEmpresa = (empresa: Empresa) => ['/empresas', empresa.id];

  constructor() {
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

  protected local(empresa: Empresa): string {
    return [empresa.cidade, empresa.uf].filter(Boolean).join(' · ');
  }

  protected escolherResponsavel(valor: string | null): void {
    this.mudar.emit({ responsavel: valor });
  }

  protected escolherUf(valor: string | null): void {
    this.mudar.emit({ uf: valor });
  }

  protected escolherEtiqueta(valor: string | null): void {
    this.mudar.emit({ etiqueta: valor });
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
    this.mudar.emit({ busca: '', responsavel: null, etiqueta: null, uf: null });
  }

  protected alternarFiltros(): void {
    this.filtrosAbertos.update((aberto) => !aberto);
  }

  protected tentarDeNovo(): void {
    this.dados.reload();
  }
}
