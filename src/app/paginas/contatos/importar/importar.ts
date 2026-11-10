import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  type OnInit,
  effect,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideCheck,
  LucideCircleAlert,
  LucideCircleHelp,
  LucideDownload,
  LucideFileSpreadsheet,
  LucideInfo,
  LucidePlus,
  LucideRefreshCw,
  LucideTrash2,
  LucideUpload,
} from '@lucide/angular';

import { type Pagina, totalDePaginas } from '../../../nucleo/api/api';
import { type ErroApi, erroDaApi } from '../../../nucleo/api/erro-api';
import { AjudaPainel } from '../../../nucleo/ajuda-painel';
import { baixarArquivo } from '../../../nucleo/baixar-arquivo';
import { AvisosService } from '../../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../../nucleo/confirmacao.service';
import { formatarDataHora, formatarNumero } from '../../../nucleo/formatos';
import { podeImportarContatos } from '../../../nucleo/sessao/perfil';
import { SessaoService } from '../../../nucleo/sessao/sessao.service';
import { TempoRealService } from '../../../nucleo/tempo-real/tempo-real.service';
import { ConferenciaFunis } from './conferencia-funis';
import { Abas, type ItemAba } from '../../../ui/abas/abas';
import { Alternador } from '../../../ui/alternador/alternador';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { CampoTexto } from '../../../ui/campo-texto/campo-texto';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../../ui/filtros-pilula/filtros-pilula';
import { GrupoOpcoes, type OpcaoGrupo } from '../../../ui/grupo-opcoes/grupo-opcoes';
import { Paginacao } from '../../../ui/paginacao/paginacao';
import { PainelLateral } from '../../../ui/painel-lateral/painel-lateral';
import { Selo } from '../../../ui/selo/selo';
import { Seletor, type OpcaoSeletor } from '../../../ui/seletor/seletor';
import type { Funil } from '../../funis/funis.tipos';
import { CampoEtiquetas } from '../campo-etiquetas';
import { ImportarApi, type UsuarioResponsavel } from './importar.api';
import {
  aplicarProgresso,
  type AreaRodizio,
  type CampoImportavel,
  chaveDeCampoPersonalizado,
  erroDoArquivo,
  estaEmAndamento,
  type EstrategiaResponsavel,
  etapasParaImportacao,
  exigenciasDoMapeamento,
  type FiltroDaPlanilha,
  filtroDasRegras,
  type FunisDaPlanilha,
  normalizarValor,
  type TraducaoEtapas,
  type TraducaoFunis,
  valoresIguais,
  type Importacao,
  type LeituraArquivo,
  type LinhaImportada,
  mapearColuna,
  type Mapeamento,
  MAXIMO_REGRAS_FILTRO,
  type ModeloMapeamento,
  OPCOES_DUPLICADOS,
  type OperadorFiltro,
  operadorSemValor,
  type PoliticaDuplicados,
  PREFIXO_PERSONALIZADO,
  type Previa,
  type ProgressoImportacao,
  regraCompleta,
  type RegraEmEdicao,
  resumoDoRodape,
  ROTULO_AREA_RODIZIO,
  ROTULO_OPERADOR,
  ROTULO_RESULTADO,
  ROTULO_STATUS,
  ROTULO_TIPO,
  type ResultadoLinha,
  type TipoImportacao,
  VARIANTE_RESULTADO,
  VARIANTE_STATUS,
} from './importar.tipos';

type AbaDaTela = 'nova' | 'execucoes';

const ABAS: readonly ItemAba[] = [
  { id: 'nova', rotulo: 'Nova importação' },
  { id: 'execucoes', rotulo: 'Execuções' },
];

const PERGUNTA_TUTORIAL = 'Como importo contatos de uma planilha?';

const OPCOES_TIPO: readonly OpcaoGrupo<TipoImportacao>[] = [
  { valor: 'CONTATOS', rotulo: 'Contatos' },
  { valor: 'EMPRESAS', rotulo: 'Empresas' },
];

const OPCOES_DUPLICADOS_PARCELAS: readonly OpcaoGrupo<PoliticaDuplicados>[] = [
  {
    valor: 'ATUALIZAR_VAZIOS',
    rotulo: 'Atualizar os títulos que já existem',
    dica: 'Pelo número do título: dá baixa nos pagos e reinicia a régua de quem mudou o vencimento. Colunas ausentes não apagam nada.',
  },
  {
    valor: 'IGNORAR',
    rotulo: 'Pular os títulos que já existem',
    dica: 'Só os títulos novos entram. Os que já existem não são tocados e aparecem como ignorados.',
  },
  {
    valor: 'SOBRESCREVER',
    rotulo: 'Trocar pelos dados da planilha',
    dica: 'Os dados da planilha substituem os do título. Use com cuidado.',
  },
];

const OPCOES_RESPONSAVEL: readonly OpcaoGrupo<EstrategiaResponsavel | 'NENHUM'>[] = [
  {
    valor: 'NENHUM',
    rotulo: 'Quem importou',
    dica: 'Os registros ficam com você, a não ser que a planilha traga uma coluna de responsável.',
  },
  {
    valor: 'RODIZIO',
    rotulo: 'Dividir em rodízio',
    dica: 'Cada registro vai para uma pessoa da área, na vez de cada uma.',
  },
  {
    valor: 'RESPONSAVEL_FIXO',
    rotulo: 'Uma pessoa fica com todos',
    dica: 'Todos os registros importados ficam com a pessoa escolhida.',
  },
];

const OPCOES_AREA: readonly OpcaoSeletor<AreaRodizio>[] = (
  Object.keys(ROTULO_AREA_RODIZIO) as AreaRodizio[]
).map((valor) => ({ valor, rotulo: ROTULO_AREA_RODIZIO[valor] }));

const OPCOES_SEPARADOR: readonly OpcaoSeletor<string>[] = [
  { valor: ',', rotulo: 'Vírgula ( , )' },
  { valor: ';', rotulo: 'Ponto e vírgula ( ; )' },
  { valor: '\t', rotulo: 'Tabulação' },
  { valor: '|', rotulo: 'Barra vertical ( | )' },
];

const OPCOES_CODIFICACAO: readonly OpcaoSeletor<string>[] = [
  { valor: 'utf-8', rotulo: 'Padrão (UTF-8)' },
  { valor: 'latin1', rotulo: 'Windows antigo (Latin-1)' },
];

const OPCOES_OPERADOR: readonly OpcaoSeletor<OperadorFiltro>[] = (
  Object.keys(ROTULO_OPERADOR) as OperadorFiltro[]
).map((valor) => ({ valor, rotulo: ROTULO_OPERADOR[valor] }));

const OPCOES_COMBINACAO: readonly OpcaoSeletor<FiltroDaPlanilha['combinacao']>[] = [
  { valor: 'TODAS', rotulo: 'todas' },
  { valor: 'QUALQUER', rotulo: 'qualquer uma' },
];

const FILTROS_RESULTADO: readonly OpcaoFiltro[] = [
  { id: 'TODOS', rotulo: 'Todas' },
  { id: 'ERRO', rotulo: 'Com erro' },
  { id: 'CRIADO', rotulo: 'Criadas' },
  { id: 'ATUALIZADO', rotulo: 'Atualizadas' },
  { id: 'IGNORADO', rotulo: 'Ignoradas' },
];

const POR_PAGINA_LINHAS = 20;
const INTERVALO_CONSULTA_MS = 4000;
const ATRASO_FILTRO_MS = 600;
const ATRASO_CONFERENCIA_MS = 400;

interface LinhaDeColuna {
  readonly coluna: string;
  readonly amostra: string;
  readonly campo: string | null;
  readonly opcoes: readonly OpcaoSeletor<string>[];
}

const NOME_DO_MODELO: Record<TipoImportacao, string> = {
  CONTATOS: 'contatos',
  EMPRESAS: 'empresas',
  PARCELAS: 'parcelas',
};

/**
 * Importação (`/contatos/importar` e `/financeiro/parcelas/importar`, R16) numa página só:
 * cartões de arquivo e opções, filtro das linhas, mapeamento de colunas e o botão "Criar
 * importação"; a aba "Execuções" mostra o histórico, o progresso ao vivo e o relatório. O estado
 * vive na API (rascunho de importação), então `?importacao=<id>` reabre onde parou.
 */
@Component({
  selector: 'app-importar-contatos',
  imports: [
    Abas,
    Alternador,
    Botao,
    Cartao,
    CampoEtiquetas,
    ConferenciaFunis,
    CampoTexto,
    Esqueleto,
    EstadoVazio,
    FiltrosPilula,
    GrupoOpcoes,
    Paginacao,
    PainelLateral,
    Selo,
    Seletor,
    LucideCheck,
    LucideCircleAlert,
    LucideCircleHelp,
    LucideDownload,
    LucideFileSpreadsheet,
    LucideInfo,
    LucidePlus,
    LucideRefreshCw,
    LucideTrash2,
    LucideUpload,
  ],
  templateUrl: './importar.html',
  styleUrl: './importar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Importar implements OnInit {
  private readonly api = inject(ImportarApi);
  private readonly avisos = inject(AvisosService);
  private readonly ajuda = inject(AjudaPainel);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly sessao = inject(SessaoService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly tempoReal = inject(TempoRealService);

  protected readonly abasDaTela = ABAS;
  protected readonly opcoesTipo = OPCOES_TIPO;
  protected readonly opcoesDuplicados = OPCOES_DUPLICADOS.map((o) => ({
    valor: o.valor,
    rotulo: o.rotulo,
    dica: o.dica,
  }));
  protected readonly opcoesDuplicadosParcelas = OPCOES_DUPLICADOS_PARCELAS;
  /** Rota própria de um tipo (`data.tipo`): `/financeiro/parcelas/importar` só importa parcelas. */
  protected readonly tipoFixo =
    (this.rota.snapshot.data['tipo'] as TipoImportacao | undefined) ?? null;
  protected readonly opcoesResponsavel = OPCOES_RESPONSAVEL;
  protected readonly opcoesArea = OPCOES_AREA;
  protected readonly opcoesSeparador = OPCOES_SEPARADOR;
  protected readonly opcoesCodificacao = OPCOES_CODIFICACAO;
  protected readonly opcoesOperador = OPCOES_OPERADOR;
  protected readonly opcoesCombinacao = OPCOES_COMBINACAO;
  protected readonly maximoRegras = MAXIMO_REGRAS_FILTRO;
  protected readonly filtrosResultado = FILTROS_RESULTADO;
  protected readonly rotuloTipo = ROTULO_TIPO;
  protected readonly rotuloStatus = ROTULO_STATUS;
  protected readonly varianteStatus = VARIANTE_STATUS;
  protected readonly rotuloResultado = ROTULO_RESULTADO;
  protected readonly varianteResultado = VARIANTE_RESULTADO;
  protected readonly dataHora = formatarDataHora;
  protected readonly semValor = operadorSemValor;
  protected readonly numero = (valor: number): string => formatarNumero(valor, 0);

  /** A permissão nova (`/auth/eu` → `permissoes.importarContatos`); a API continua decidindo. */
  protected readonly podeImportar = computed(() =>
    this.tipoFixo === 'PARCELAS'
      ? this.sessao.temPapel('ADMIN', 'C_LEVEL', 'LIDER_CS')
      : this.sessao.permite(podeImportarContatos),
  );

  // ----- Estado geral ------------------------------------------------------------------------
  protected readonly aba = signal<AbaDaTela>('nova');
  protected readonly tutorialAberto = signal(false);
  /** Importação aberta: rascunho (aba "Nova importação") ou já iniciada (aba "Execuções"). */
  protected readonly importacao = signal<Importacao | null>(null);
  protected readonly previa = signal<Previa | null>(null);
  protected readonly carregando = signal(false);
  protected readonly erroCarga = signal<ErroApi | null>(null);

  // Cartão "Arquivo"
  protected readonly tipo = signal<TipoImportacao>(this.tipoFixo ?? 'CONTATOS');
  protected readonly erroArquivo = signal<string | null>(null);
  protected readonly arrastando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly baixandoModelo = signal(false);

  // Cartão "Opções do arquivo"
  protected readonly temCabecalho = signal(true);
  protected readonly separador = signal<string | null>(null);
  protected readonly codificacao = signal<string | null>(null);
  protected readonly abaDaPlanilha = signal<string | null>(null);
  protected readonly duplicados = signal<PoliticaDuplicados>('ATUALIZAR_VAZIOS');
  protected readonly ddiPadrao = signal('55');
  protected readonly lendo = signal(false);

  // Cartões "Etiquetas" e "Responsável"
  protected readonly etiquetas = signal<readonly string[]>([]);
  protected readonly origemDetalhe = signal('');
  protected readonly estrategia = signal<EstrategiaResponsavel | 'NENHUM'>('NENHUM');
  /** Explicação curta da opção escolhida, logo abaixo dos seletores de duplicados e responsável. */
  protected readonly dicaDuplicados = computed(
    () =>
      (this.ehParcelas() ? OPCOES_DUPLICADOS_PARCELAS : OPCOES_DUPLICADOS).find(
        (o) => o.valor === this.duplicados(),
      )?.dica ?? null,
  );
  protected readonly dicaResponsavel = computed(
    () => OPCOES_RESPONSAVEL.find((o) => o.valor === this.estrategia())?.dica ?? null,
  );
  protected readonly iconeCriar = LucideUpload;
  protected readonly areaRodizio = signal<AreaRodizio | null>(null);
  protected readonly responsavelId = signal<string | null>(null);
  protected readonly responsaveis = signal<readonly UsuarioResponsavel[]>([]);

  // Cartão "Negócio para todos"
  protected readonly funis = signal<readonly Funil[]>([]);
  protected readonly carregandoFunis = signal(false);
  protected readonly funilId = signal<string | null>(null);
  protected readonly etapaId = signal<string | null>(null);
  protected readonly tituloNegocio = signal('');
  protected readonly valorNegocio = signal('');

  // Filtro das linhas
  protected readonly combinacao = signal<FiltroDaPlanilha['combinacao']>('TODAS');
  protected readonly regras = signal<readonly RegraEmEdicao[]>([]);
  protected readonly salvandoFiltro = signal(false);
  protected readonly erroFiltro = signal<string | null>(null);

  // Mapeamento
  protected readonly campos = signal<readonly CampoImportavel[]>([]);
  protected readonly modelos = signal<readonly ModeloMapeamento[]>([]);
  protected readonly mapeamento = signal<Mapeamento>({});
  protected readonly modeloId = signal<string | null>(null);
  protected readonly salvandoModelo = signal(false);
  protected readonly nomeModelo = signal('');
  protected readonly nomeModeloAberto = signal(false);
  protected readonly criando = signal(false);

  // Execuções
  protected readonly historico = signal<Pagina<Importacao> | null>(null);
  protected readonly erroHistorico = signal<ErroApi | null>(null);
  protected readonly linhas = signal<Pagina<LinhaImportada> | null>(null);
  protected readonly carregandoLinhas = signal(false);
  protected readonly erroLinhas = signal<ErroApi | null>(null);
  protected readonly filtroLinhas = signal<string | null>('TODOS');
  protected readonly paginaLinhas = signal(1);
  protected readonly baixando = signal(false);
  protected readonly agindo = signal(false);

  protected readonly tipoAtual = computed(() => this.importacao()?.tipo ?? this.tipo());
  protected readonly ehParcelas = computed(() => this.tipoAtual() === 'PARCELAS');
  protected readonly ehContatos = computed(() => this.tipoAtual() === 'CONTATOS');
  protected readonly substantivo = computed(() =>
    this.tipoAtual() === 'EMPRESAS' ? 'empresas' : 'contatos',
  );
  /** Rascunho aberto na aba "Nova importação". */
  protected readonly rascunho = computed(() => {
    const imp = this.importacao();
    return imp?.status === 'RASCUNHO' ? imp : null;
  });
  /** Importação já iniciada, aberta na aba "Execuções". */
  protected readonly execucao = computed(() => {
    const imp = this.importacao();
    return imp && imp.status !== 'RASCUNHO' ? imp : null;
  });

  protected readonly linhasDeColuna = computed<readonly LinhaDeColuna[]>(() => {
    const imp = this.rascunho();
    if (!imp) {
      return [];
    }
    const previa = this.previa();
    const mapa = this.mapeamento();
    const campos = this.campos();
    const usados = new Map(Object.entries(mapa).map(([coluna, campo]) => [campo, coluna]));
    return imp.colunas.map((coluna, indice) => {
      const campo = mapa[coluna] ?? null;
      const exemplos = (previa?.linhas ?? [])
        .map((l) => l.valores[indice])
        .filter((v): v is string => !!v && v.trim() !== '')
        .slice(0, 3);
      const opcoes: OpcaoSeletor<string>[] = campos.map((c) => ({
        valor: c.chave,
        rotulo: c.obrigatorio ? `${c.rotulo} (obrigatório)` : c.rotulo,
        desabilitada: usados.has(c.chave) && usados.get(c.chave) !== coluna,
        ...(c.grupo ? { grupo: c.grupo } : {}),
      }));
      const chave = chaveDeCampoPersonalizado(coluna);
      const personalizado = chave ? `${PREFIXO_PERSONALIZADO}${chave}` : null;
      const conhecido = (valor: string) => campos.some((c) => c.chave === valor);
      if (campo && !conhecido(campo)) {
        opcoes.push({
          valor: campo,
          rotulo: `Campo próprio: ${campo.replace(PREFIXO_PERSONALIZADO, '')}`,
          grupo: 'Campos personalizados',
        });
      } else if (personalizado && !conhecido(personalizado)) {
        opcoes.push({
          valor: personalizado,
          rotulo: `Criar campo próprio “${chave}”`,
          desabilitada: usados.has(personalizado),
          grupo: 'Campos personalizados',
        });
      }
      return { coluna, amostra: exemplos.join(' · '), campo, opcoes };
    });
  });

  protected readonly exigencias = computed(() =>
    exigenciasDoMapeamento(this.tipoAtual(), this.mapeamento()),
  );
  protected readonly mapeamentoCompleto = computed(() =>
    this.exigencias().every((e) => e.atendida),
  );
  protected readonly totalMapeadas = computed(() => Object.keys(this.mapeamento()).length);

  protected readonly opcoesModelo = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.modelos().map((m) => ({ valor: m.id, rotulo: m.nome })),
  );
  protected readonly opcoesResponsaveis = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.responsaveis().map((u) => ({ valor: u.id, rotulo: u.nome })),
  );
  protected readonly opcoesColunas = computed<readonly OpcaoSeletor<string>[]>(() =>
    (this.rascunho()?.colunas ?? []).map((c) => ({ valor: c, rotulo: c })),
  );

  // Negócio para todos
  protected readonly opcoesFunil = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.funis()
      .filter((f) => f.ativo)
      .map((f) => ({ valor: f.id, rotulo: f.nome })),
  );
  protected readonly opcoesEtapa = computed<readonly OpcaoSeletor<string>[]>(() => {
    const funil = this.funis().find((f) => f.id === this.funilId());
    return etapasParaImportacao(funil?.etapas ?? []).map((e) => ({ valor: e.id, rotulo: e.nome }));
  });
  protected readonly negocioOk = computed(() => !this.funilId() || !!this.etapaId());
  private readonly negocioEscolhido = computed(() => {
    const funil = this.funis().find((f) => f.id === this.funilId());
    const etapa = funil?.etapas.find((e) => e.id === this.etapaId());
    return funil && etapa ? { funil: funil.nome, etapa: etapa.nome } : null;
  });

  // Conferência de funis e etapas
  protected readonly traducaoFunis = signal<TraducaoFunis>({});
  protected readonly traducaoEtapas = signal<TraducaoEtapas>({});
  protected readonly funisPlanilha = signal<FunisDaPlanilha | null>(null);
  protected readonly carregandoConferencia = signal(false);
  protected readonly erroConferencia = signal<string | null>(null);
  private readonly versaoConferencia = signal(0);
  protected readonly formatoOrigem = computed(
    () => this.previa()?.formatoOrigem ?? this.rascunho()?.formatoOrigem ?? null,
  );
  /** Aparece quando a planilha tem coluna de funil ou de etapa. */
  protected readonly mostraConferencia = computed(() => {
    if (!this.rascunho() || !this.ehContatos()) {
      return false;
    }
    const campos = Object.values(this.mapeamento());
    return campos.includes('negocio.funil') || campos.includes('negocio.etapa');
  });
  /** Muda quando algo que altera a conferência muda (mapeamento, filtro, cartão, traduções). */
  private readonly chaveConferencia = computed<string | null>(() =>
    this.mostraConferencia()
      ? JSON.stringify([
          this.rascunho()?.id,
          this.mapeamento(),
          this.rascunho()?.filtro ?? null,
          this.funilId(),
          this.etapaId(),
          this.traducaoFunis(),
          this.traducaoEtapas(),
          this.versaoConferencia(),
        ])
      : null,
  );

  // Filtro
  protected readonly filtroIncompleto = computed(() =>
    this.regras().some((r) => !regraCompleta(r)),
  );
  private readonly filtroAtual = computed(() => filtroDasRegras(this.combinacao(), this.regras()));
  /** Quantas linhas passam no filtro (só com filtro aplicado; `null` sem filtro). */
  protected readonly linhasNoFiltro = computed(() => {
    const imp = this.rascunho();
    const total = this.previa()?.linhasNoFiltro;
    return imp && imp.filtro && typeof total === 'number' ? total : null;
  });

  // Rodapé
  protected readonly ddiOk = computed(() => /^\d{1,3}$/.test(String(this.ddiPadrao()).trim()));
  protected readonly opcoesOk = computed(() => {
    const e = this.estrategia();
    return (
      (e !== 'RODIZIO' || this.areaRodizio() !== null) &&
      (e !== 'RESPONSAVEL_FIXO' || this.responsavelId() !== null)
    );
  });
  protected readonly resumoRodape = computed(() => {
    const imp = this.rascunho();
    return imp
      ? resumoDoRodape({
          totalLinhas: imp.totalLinhas,
          linhasNoFiltro: this.linhasNoFiltro(),
          negocio: this.ehContatos() ? this.negocioEscolhido() : null,
        })
      : '';
  });
  /** O que falta para o botão "Criar importação" ficar disponível, em texto. */
  protected readonly pendencias = computed<readonly string[]>(() => {
    if (!this.rascunho()) {
      return [`Escolha a planilha para começar.`];
    }
    const lista: string[] = [];
    for (const e of this.exigencias()) {
      if (!e.atendida) {
        lista.push(`Escolha a coluna de ${e.texto}.`);
      }
    }
    if (this.filtroIncompleto()) {
      lista.push('Termine as regras do filtro ou remova as incompletas.');
    }
    if (this.ehContatos() && !this.negocioOk()) {
      lista.push('Escolha a etapa do negócio.');
    }
    if (this.ehContatos() && !this.ddiOk()) {
      lista.push('O DDI padrão tem de 1 a 3 números.');
    }
    if (!this.opcoesOk()) {
      lista.push('Complete o responsável para todos.');
    }
    if (this.linhasNoFiltro() === 0) {
      lista.push('Nenhuma linha passa no filtro.');
    }
    return lista;
  });
  protected readonly podeCriar = computed(
    () =>
      this.pendencias().length === 0 &&
      !this.criando() &&
      !this.salvandoFiltro() &&
      !this.lendo() &&
      !this.enviando(),
  );

  protected readonly totalPaginasLinhas = computed(() => {
    const p = this.linhas();
    return p ? totalDePaginas(p) : 1;
  });
  protected readonly emAndamento = computed(() => {
    const i = this.importacao();
    return !!i && estaEmAndamento(i.status);
  });
  protected readonly listaTemAtiva = computed(
    () => this.historico()?.itens.some((i) => estaEmAndamento(i.status)) ?? false,
  );

  private consulta: ReturnType<typeof setInterval> | null = null;
  private consultaLista: ReturnType<typeof setTimeout> | null = null;
  private atrasoFiltro: ReturnType<typeof setTimeout> | null = null;
  private pedidoLinhas = 0;
  private pedidoFiltro = 0;
  private chaveRegra = 0;
  private atrasoConferencia: ReturnType<typeof setTimeout> | null = null;
  private pedidoConferencia = 0;

  constructor() {
    const destruir = inject(DestroyRef);
    const parar = this.tempoReal.ouvir('importacao.progresso', (dados) => this.aoProgresso(dados));
    destruir.onDestroy(() => {
      parar();
      this.pararConsulta();
      this.pararConsultaLista();
      if (this.atrasoFiltro !== null) {
        clearTimeout(this.atrasoFiltro);
      }
      if (this.atrasoConferencia !== null) {
        clearTimeout(this.atrasoConferencia);
      }
    });
    effect(() => {
      const chave = this.chaveConferencia();
      untracked(() => this.agendarConferencia(chave));
    });
  }

  ngOnInit(): void {
    if (!this.podeImportar()) {
      return;
    }
    void this.carregarHistorico();
    void this.carregarFunis();
    const id = this.rota.snapshot.queryParamMap.get('importacao');
    if (id) {
      void this.abrir(id);
    }
  }

  protected mudarAba(id: string | null): void {
    this.aba.set(id === 'execucoes' ? 'execucoes' : 'nova');
    if (this.aba() === 'execucoes') {
      void this.carregarHistorico();
    }
  }

  /** "Ver tutorial": passo a passo fixo num painel lateral (não gasta pergunta da Ajuda). */
  protected verTutorial(): void {
    this.tutorialAberto.set(true);
  }

  /** Do painel do tutorial: abre o assistente de Ajuda já com a pergunta. */
  protected perguntarNaAjuda(): void {
    this.tutorialAberto.set(false);
    this.ajuda.perguntar(PERGUNTA_TUTORIAL);
  }

  // ----- Arquivo -----------------------------------------------------------------------------

  protected escolherArquivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    void this.receberArquivo(entrada.files?.[0] ?? null);
    entrada.value = '';
  }

  protected soltarArquivo(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastando.set(false);
    void this.receberArquivo(evento.dataTransfer?.files?.[0] ?? null);
  }

  protected sobrevoar(evento: DragEvent, sobre: boolean): void {
    evento.preventDefault();
    this.arrastando.set(sobre);
  }

  /** Valida, descarta o rascunho anterior (se houver) e envia a planilha nova. */
  private async receberArquivo(arquivo: File | null): Promise<void> {
    if (!arquivo || this.enviando()) {
      return;
    }
    const erro = erroDoArquivo(arquivo);
    this.erroArquivo.set(erro);
    if (erro) {
      return;
    }
    this.enviando.set(true);
    try {
      const anterior = this.rascunho();
      if (anterior) {
        await this.api.excluir(anterior.id).catch(() => undefined);
        this.zerarRascunho();
      }
      const enviado = await this.api.enviarArquivo(arquivo);
      const criada = await this.api.criar(this.tipo(), enviado.id, this.leituraLocal());
      this.importacao.set(criada);
      this.previa.set(criada.previa);
      this.mapeamento.set(criada.mapeamento);
      this.modeloId.set(criada.modeloId);
      this.abaDaPlanilha.set(criada.leitura.aba ?? criada.previa.abas?.[0] ?? null);
      this.regras.set([]);
      this.irParaImportacao(criada.id);
      await this.carregarApoioDoRascunho(criada.tipo);
    } catch (falha) {
      this.erroArquivo.set(erroDaApi(falha).resumo);
    } finally {
      this.enviando.set(false);
    }
  }

  private leituraLocal(): LeituraArquivo {
    const separador = this.separador();
    const codificacao = this.codificacao();
    const aba = this.abaDaPlanilha();
    return {
      ...(separador ? { separador: separador as LeituraArquivo['separador'] } : {}),
      ...(codificacao ? { codificacao: codificacao as LeituraArquivo['codificacao'] } : {}),
      ...(aba ? { aba } : {}),
      ...(this.temCabecalho() ? {} : { semCabecalho: true }),
    };
  }

  private async carregarApoioDoRascunho(tipo: TipoImportacao): Promise<void> {
    const [campos, modelos] = await Promise.all([
      this.api.campos(tipo),
      this.api.modelos(tipo).catch(() => [] as readonly ModeloMapeamento[]),
    ]);
    this.campos.set(campos);
    this.modelos.set(modelos);
  }

  protected async carregarFunis(): Promise<void> {
    if (this.tipoFixo || this.carregandoFunis() || this.funis().length > 0) {
      return;
    }
    this.carregandoFunis.set(true);
    try {
      this.funis.set(await this.api.funis());
    } catch {
      // Sem a lista, o cartão "Negócio para todos" fica vazio; o resto da tela segue.
    } finally {
      this.carregandoFunis.set(false);
    }
  }

  protected async carregarResponsaveis(): Promise<void> {
    if (this.responsaveis().length > 0) {
      return;
    }
    try {
      this.responsaveis.set(await this.api.responsaveis());
    } catch {
      // A API valida o responsável de novo ao criar.
    }
  }

  protected async carregarHistorico(): Promise<void> {
    this.erroHistorico.set(null);
    try {
      this.historico.set(await this.api.listar({ porPagina: 20 }));
    } catch (falha) {
      this.erroHistorico.set(erroDaApi(falha));
    }
    this.agendarConsultaLista();
  }

  /** Reabre uma importação onde ela parou: rascunho na aba "Nova", o resto em "Execuções". */
  protected async abrir(id: string): Promise<void> {
    this.carregando.set(true);
    this.erroCarga.set(null);
    try {
      const imp = await this.api.obter(id);
      if (imp.status === 'RASCUNHO') {
        const previa = await this.api.previa(id);
        this.tipo.set(imp.tipo);
        this.importacao.set(imp);
        this.previa.set(previa);
        this.sincronizarOpcoes(imp, previa);
        this.aba.set('nova');
        await this.carregarApoioDoRascunho(imp.tipo);
      } else {
        this.zerarRascunho();
        this.mostrarAndamento(imp);
        this.aba.set('execucoes');
      }
      this.irParaImportacao(id);
    } catch (falha) {
      this.erroCarga.set(erroDaApi(falha));
      this.irParaImportacao(null);
    } finally {
      this.carregando.set(false);
    }
  }

  private irParaImportacao(id: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: { importacao: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Traz para os cartões o que a importação (ou o modelo aplicado) guardou. */
  private sincronizarOpcoes(imp: Importacao, previa: Previa | null): void {
    this.mapeamento.set(imp.mapeamento);
    this.modeloId.set(imp.modeloId);
    this.duplicados.set(imp.duplicados);
    this.etiquetas.set(imp.etiquetas);
    this.estrategia.set(imp.estrategiaResponsavel ?? 'NENHUM');
    this.areaRodizio.set(imp.areaRodizio);
    this.responsavelId.set(imp.responsavelId);
    this.origemDetalhe.set(imp.origemDetalhe ?? '');
    this.separador.set(imp.leitura.separador ?? null);
    this.codificacao.set(imp.leitura.codificacao ?? null);
    this.abaDaPlanilha.set(imp.leitura.aba ?? previa?.abas?.[0] ?? null);
    this.temCabecalho.set(!imp.leitura.semCabecalho);
    this.ddiPadrao.set(imp.ddiPadrao ?? '55');
    this.traducaoFunis.set(imp.traducaoFunis ?? {});
    this.traducaoEtapas.set(imp.traducaoEtapas ?? {});
    this.combinacao.set(imp.filtro?.combinacao ?? 'TODAS');
    this.regras.set(
      (imp.filtro?.regras ?? []).map((r) => ({
        chave: ++this.chaveRegra,
        coluna: r.coluna,
        operador: r.operador,
        valor: r.valor ?? '',
      })),
    );
    this.funilId.set(imp.negocio?.funilId ?? null);
    this.etapaId.set(imp.negocio?.etapaId ?? null);
    this.tituloNegocio.set(imp.negocio?.titulo ?? '');
    this.valorNegocio.set(imp.negocio?.valor ?? '');
    if (imp.estrategiaResponsavel === 'RESPONSAVEL_FIXO') {
      void this.carregarResponsaveis();
    }
  }

  private zerarRascunho(): void {
    if (this.atrasoFiltro !== null) {
      clearTimeout(this.atrasoFiltro);
      this.atrasoFiltro = null;
    }
    this.importacao.set(null);
    this.previa.set(null);
    this.mapeamento.set({});
    this.modeloId.set(null);
    this.regras.set([]);
    this.erroFiltro.set(null);
    this.nomeModeloAberto.set(false);
    this.traducaoFunis.set({});
    this.traducaoEtapas.set({});
    this.funisPlanilha.set(null);
    this.erroConferencia.set(null);
  }

  // ----- Opções de leitura -------------------------------------------------------------------

  protected mudarCabecalho(tem: boolean): void {
    this.temCabecalho.set(tem);
    void this.reler();
  }

  protected mudarSeparador(valor: string | null): void {
    this.separador.set(valor);
    void this.reler();
  }

  protected mudarCodificacao(valor: string | null): void {
    this.codificacao.set(valor);
    void this.reler();
  }

  protected mudarAbaDaPlanilha(valor: string | null): void {
    this.abaDaPlanilha.set(valor);
    void this.reler();
  }

  protected opcoesAbas(): readonly OpcaoSeletor<string>[] {
    return (this.previa()?.abas ?? []).map((a) => ({ valor: a, rotulo: a }));
  }

  /** Refaz as colunas da planilha com a leitura escolhida (só com rascunho aberto). */
  private async reler(): Promise<void> {
    const imp = this.rascunho();
    if (!imp) {
      return;
    }
    this.lendo.set(true);
    try {
      const novo = await this.api.alterar(imp.id, { leitura: this.leituraLocal() });
      const previa = await this.api.previa(imp.id);
      this.importacao.set(novo);
      this.previa.set(previa);
      this.mapeamento.set(novo.mapeamento);
      this.modeloId.set(null);
      // Regras de colunas que deixaram de existir saem; o filtro é salvo de novo.
      const existentes = new Set(novo.colunas);
      const restantes = this.regras().filter((r) => r.coluna !== null && existentes.has(r.coluna));
      if (restantes.length !== this.regras().length) {
        this.regras.set(restantes);
        this.agendarFiltro();
      }
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.lendo.set(false);
    }
  }

  // ----- Modelos de mapeamento ---------------------------------------------------------------

  protected mudarCampo(coluna: string, campo: string | null): void {
    this.mapeamento.update((m) => mapearColuna(m, coluna, campo));
    this.modeloId.set(null);
  }

  protected async usarModelo(id: string | null): Promise<void> {
    const imp = this.rascunho();
    if (!imp || !id) {
      this.modeloId.set(null);
      return;
    }
    try {
      const novo = await this.api.alterar(imp.id, { modeloId: id });
      this.importacao.set(novo);
      this.sincronizarOpcoes(novo, this.previa());
      this.modeloId.set(novo.modeloId ?? id);
      this.previa.set(await this.api.previa(imp.id));
      this.avisos.sucesso('Modelo aplicado às colunas do arquivo.');
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  protected async salvarModelo(): Promise<void> {
    const imp = this.rascunho();
    const nome = this.nomeModelo().trim();
    if (!imp || !nome || this.salvandoModelo()) {
      return;
    }
    this.salvandoModelo.set(true);
    try {
      const contatos = imp.tipo === 'CONTATOS';
      const modelo = await this.api.criarModelo({
        nome,
        tipo: imp.tipo,
        mapeamento: this.mapeamento(),
        opcoes: {
          duplicados: this.duplicados(),
          etiquetas: this.etiquetas(),
          filtro: this.filtroAtual(),
          ...(contatos
            ? {
                negocio: this.negocioParaEnviar(),
                ddiPadrao: String(this.ddiPadrao()).trim(),
                traducaoFunis: this.traducaoFunis(),
                traducaoEtapas: this.traducaoEtapas(),
              }
            : {}),
        },
      });
      this.modelos.update((lista) => [...lista, modelo]);
      this.modeloId.set(modelo.id);
      this.nomeModelo.set('');
      this.nomeModeloAberto.set(false);
      this.avisos.sucesso(`Modelo “${modelo.nome}” salvo. Use-o nas próximas planilhas parecidas.`);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.salvandoModelo.set(false);
    }
  }

  protected async excluirModelo(): Promise<void> {
    const id = this.modeloId();
    const modelo = this.modelos().find((m) => m.id === id);
    if (!id || !modelo) {
      return;
    }
    const ok = await this.confirmacao.confirmar({
      titulo: `Excluir o modelo “${modelo.nome}”?`,
      mensagem: 'As importações já feitas não mudam. Só deixa de aparecer na lista de modelos.',
      confirmar: 'Excluir modelo',
      perigo: true,
      executar: () => this.api.excluirModelo(id),
    });
    if (ok) {
      this.modelos.update((lista) => lista.filter((m) => m.id !== id));
      this.modeloId.set(null);
      this.avisos.sucesso('Modelo excluído.');
    }
  }

  protected async descartarRascunho(): Promise<void> {
    const imp = this.rascunho();
    if (!imp) {
      return;
    }
    const ok = await this.confirmacao.confirmar({
      titulo: 'Descartar esta planilha?',
      mensagem: 'Esta importação em preparo será descartada. Nada foi importado ainda.',
      confirmar: 'Descartar',
      perigo: true,
      executar: () => this.api.excluir(imp.id),
    });
    if (ok) {
      this.zerarRascunho();
      this.irParaImportacao(null);
    }
  }

  // ----- Responsável e negócio ---------------------------------------------------------------

  protected mudarEstrategia(valor: EstrategiaResponsavel | 'NENHUM' | null): void {
    this.estrategia.set(valor ?? 'NENHUM');
    if (valor === 'RESPONSAVEL_FIXO') {
      void this.carregarResponsaveis();
    }
  }

  protected mudarFunil(id: string | null): void {
    this.funilId.set(id);
    this.etapaId.set(null);
    if (!id) {
      this.tituloNegocio.set('');
      this.valorNegocio.set('');
    }
  }

  private negocioParaEnviar(): {
    funilId: string;
    etapaId: string;
    titulo: string | null;
    valor: string | null;
  } | null {
    const funilId = this.funilId();
    const etapaId = this.etapaId();
    if (!funilId || !etapaId) {
      return null;
    }
    return {
      funilId,
      etapaId,
      titulo: this.tituloNegocio().trim() || null,
      valor: this.valorNegocio().trim() || null,
    };
  }

  // ----- Filtro das linhas -------------------------------------------------------------------

  protected adicionarRegra(): void {
    const colunas = this.rascunho()?.colunas ?? [];
    if (this.regras().length >= MAXIMO_REGRAS_FILTRO || colunas.length === 0) {
      return;
    }
    this.regras.update((l) => [
      ...l,
      { chave: ++this.chaveRegra, coluna: colunas[0], operador: 'IGUAL', valor: '' },
    ]);
  }

  protected removerRegra(chave: number): void {
    this.regras.update((l) => l.filter((r) => r.chave !== chave));
    this.agendarFiltro();
  }

  protected mudarRegra(chave: number, mudanca: Partial<Omit<RegraEmEdicao, 'chave'>>): void {
    this.regras.update((l) => l.map((r) => (r.chave === chave ? { ...r, ...mudanca } : r)));
    this.agendarFiltro();
  }

  protected mudarCombinacao(valor: FiltroDaPlanilha['combinacao'] | null): void {
    this.combinacao.set(valor ?? 'TODAS');
    this.agendarFiltro();
  }

  /** Salva o filtro (e recarrega a contagem) pouco depois da última mudança. */
  private agendarFiltro(): void {
    if (this.atrasoFiltro !== null) {
      clearTimeout(this.atrasoFiltro);
    }
    this.atrasoFiltro = setTimeout(() => {
      this.atrasoFiltro = null;
      void this.salvarFiltro();
    }, ATRASO_FILTRO_MS);
  }

  /** Guarda o filtro na importação e atualiza prévia e contagem ("X de Y linhas passam"). */
  protected async salvarFiltro(): Promise<void> {
    const imp = this.rascunho();
    if (!imp) {
      return;
    }
    const filtro = this.filtroAtual();
    // Só chama a API se mudou em relação ao que ela já tem.
    if (JSON.stringify(filtro) === JSON.stringify(imp.filtro ?? null) && !this.erroFiltro()) {
      return;
    }
    const pedido = ++this.pedidoFiltro;
    this.salvandoFiltro.set(true);
    this.erroFiltro.set(null);
    try {
      const novo = await this.api.alterar(imp.id, { filtro });
      const previa = await this.api.previa(imp.id);
      if (pedido === this.pedidoFiltro && this.importacao()?.id === imp.id) {
        this.importacao.set(novo);
        this.previa.set(previa);
      }
    } catch (falha) {
      if (pedido === this.pedidoFiltro) {
        this.erroFiltro.set(erroDaApi(falha).resumo);
      }
    } finally {
      if (pedido === this.pedidoFiltro) {
        this.salvandoFiltro.set(false);
      }
    }
  }

  // ----- Conferência de funis e etapas -------------------------------------------------------

  private agendarConferencia(chave: string | null): void {
    if (this.atrasoConferencia !== null) {
      clearTimeout(this.atrasoConferencia);
      this.atrasoConferencia = null;
    }
    if (chave === null) {
      this.pedidoConferencia++;
      this.funisPlanilha.set(null);
      this.erroConferencia.set(null);
      this.carregandoConferencia.set(false);
      return;
    }
    this.carregandoConferencia.set(true);
    this.atrasoConferencia = setTimeout(() => {
      this.atrasoConferencia = null;
      void this.conferir();
    }, ATRASO_CONFERENCIA_MS);
  }

  protected reconferir(): void {
    this.versaoConferencia.update((v) => v + 1);
  }

  /** Salva o que a conferência usa (colunas, cartão e traduções) e pede o destino de cada funil e etapa. */
  private async conferir(): Promise<void> {
    const imp = this.rascunho();
    if (!imp || !this.mostraConferencia()) {
      return;
    }
    const pedido = ++this.pedidoConferencia;
    this.carregandoConferencia.set(true);
    this.erroConferencia.set(null);
    try {
      const alteracao: {
        mapeamento?: Mapeamento;
        negocio?: {
          funilId: string;
          etapaId: string;
          titulo: string | null;
          valor: string | null;
        } | null;
        traducaoFunis?: TraducaoFunis;
        traducaoEtapas?: TraducaoEtapas;
      } = {};
      if (!valoresIguais(this.mapeamento(), imp.mapeamento)) {
        alteracao.mapeamento = this.mapeamento();
      }
      const negocio = this.negocioParaEnviar();
      const cartaoCompleto = negocio !== null || !this.funilId();
      const mudouNegocio =
        (negocio?.funilId ?? null) !== (imp.negocio?.funilId ?? null) ||
        (negocio?.etapaId ?? null) !== (imp.negocio?.etapaId ?? null);
      if (cartaoCompleto && mudouNegocio) {
        alteracao.negocio = negocio;
      }
      if (!valoresIguais(this.traducaoFunis(), imp.traducaoFunis ?? {})) {
        alteracao.traducaoFunis = this.traducaoFunis();
      }
      if (!valoresIguais(this.traducaoEtapas(), imp.traducaoEtapas ?? {})) {
        alteracao.traducaoEtapas = this.traducaoEtapas();
      }
      if (Object.keys(alteracao).length > 0) {
        const novo = await this.api.alterar(imp.id, alteracao);
        if (this.importacao()?.id === imp.id) {
          this.importacao.set(novo);
        }
      }
      const dados = await this.api.funisDaPlanilha(imp.id);
      if (pedido === this.pedidoConferencia) {
        this.funisPlanilha.set(dados);
      }
    } catch (falha) {
      if (pedido === this.pedidoConferencia) {
        const erro = erroDaApi(falha);
        this.erroConferencia.set(erro.resumo);
        // Escolha recusada pela API: volta ao que ficou salvo.
        const salvo = this.importacao();
        if (salvo?.id === imp.id) {
          this.traducaoFunis.set(salvo.traducaoFunis ?? {});
          this.traducaoEtapas.set(salvo.traducaoEtapas ?? {});
        }
      }
    } finally {
      if (pedido === this.pedidoConferencia) {
        this.carregandoConferencia.set(false);
      }
    }
  }

  protected aoUsarFunil(escolha: { valor: string; funilId: string | null }): void {
    const chave = normalizarValor(escolha.valor);
    this.traducaoFunis.update((atual) => {
      const { [chave]: _antigo, ...resto } = atual;
      return escolha.funilId ? { ...resto, [chave]: escolha.funilId } : resto;
    });
  }

  protected aoUsarEtapa(escolha: { funilId: string; valor: string; etapaId: string | null }): void {
    const chave = normalizarValor(escolha.valor);
    this.traducaoEtapas.update((atual) => {
      const { [escolha.funilId]: doFunil = {}, ...outros } = atual;
      const { [chave]: _antiga, ...resto } = doFunil;
      const novo = escolha.etapaId ? { ...resto, [chave]: escolha.etapaId } : resto;
      return Object.keys(novo).length > 0 ? { ...outros, [escolha.funilId]: novo } : outros;
    });
  }

  /** Funil novo (ou etapa nova num funil que já existia): atualiza a lista e confere de novo. */
  protected aoFunilCriado(evento: { valor: string | null; funil: Funil }): void {
    this.funis.update((lista) =>
      lista.some((f) => f.id === evento.funil.id)
        ? lista.map((f) => (f.id === evento.funil.id ? evento.funil : f))
        : [...lista, evento.funil],
    );
    if (evento.valor !== null) {
      this.aoUsarFunil({ valor: evento.valor, funilId: evento.funil.id });
    } else {
      this.reconferir();
    }
  }

  // ----- Criar importação --------------------------------------------------------------------

  protected async criar(): Promise<void> {
    const imp = this.rascunho();
    if (!imp || !this.podeCriar()) {
      return;
    }
    if (this.atrasoFiltro !== null) {
      clearTimeout(this.atrasoFiltro);
      this.atrasoFiltro = null;
    }
    this.pedidoFiltro++;
    this.criando.set(true);
    try {
      const estrategia = this.estrategia();
      const base = {
        mapeamento: this.mapeamento(),
        modeloId: this.modeloId(),
        duplicados: this.duplicados(),
        filtro: this.filtroAtual(),
      };
      const alteracao =
        imp.tipo === 'PARCELAS'
          ? base
          : {
              ...base,
              etiquetas: this.etiquetas(),
              estrategiaResponsavel: estrategia === 'NENHUM' ? null : estrategia,
              areaRodizio: estrategia === 'RODIZIO' ? this.areaRodizio() : null,
              responsavelId: estrategia === 'RESPONSAVEL_FIXO' ? this.responsavelId() : null,
              origemDetalhe: this.origemDetalhe().trim() || null,
              ...(imp.tipo === 'CONTATOS'
                ? {
                    negocio: this.negocioParaEnviar(),
                    ddiPadrao: String(this.ddiPadrao()).trim(),
                    traducaoFunis: this.traducaoFunis(),
                    traducaoEtapas: this.traducaoEtapas(),
                  }
                : {}),
            };
      await this.api.alterar(imp.id, alteracao);
      const iniciada = await this.api.iniciar(imp.id);
      this.zerarRascunho();
      this.mostrarAndamento(iniciada);
      this.aba.set('execucoes');
      this.irParaImportacao(iniciada.id);
      void this.carregarHistorico();
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.criando.set(false);
    }
  }

  // ----- Execuções: andamento e relatório ----------------------------------------------------

  private mostrarAndamento(imp: Importacao): void {
    this.importacao.set(imp);
    this.filtroLinhas.set(imp.erros > 0 && imp.status === 'CONCLUIDA' ? 'ERRO' : 'TODOS');
    this.paginaLinhas.set(1);
    this.linhas.set(null);
    this.atualizarConsulta(imp);
    if (imp.processadas > 0 || !estaEmAndamento(imp.status)) {
      void this.carregarLinhas();
    }
  }

  /** Volta da execução aberta para a lista de execuções. */
  protected voltarParaLista(): void {
    this.pararConsulta();
    this.importacao.set(null);
    this.linhas.set(null);
    this.irParaImportacao(null);
    void this.carregarHistorico();
  }

  protected novaImportacao(): void {
    this.voltarParaLista();
    this.aba.set('nova');
  }

  private aoProgresso(evento: ProgressoImportacao): void {
    const atual = this.importacao();
    if (!atual || atual.id !== evento.importacaoId || atual.status === 'RASCUNHO') {
      return;
    }
    const novo = aplicarProgresso(atual, evento);
    if (novo === atual) {
      return;
    }
    this.importacao.set(novo);
    this.atualizarConsulta(novo);
    if (!estaEmAndamento(novo.status) && estaEmAndamento(atual.status)) {
      // Terminou: busca os números finais e as linhas.
      void this.recarregar();
    }
  }

  /** Enquanto estiver na fila ou rodando, confere de tempos em tempos (garante o fim mesmo sem tempo real). */
  private atualizarConsulta(imp: Importacao): void {
    if (estaEmAndamento(imp.status)) {
      this.consulta ??= setInterval(() => void this.recarregar(), INTERVALO_CONSULTA_MS);
    } else {
      this.pararConsulta();
    }
  }

  private pararConsulta(): void {
    if (this.consulta !== null) {
      clearInterval(this.consulta);
      this.consulta = null;
    }
  }

  /** Na lista de execuções, atualiza de tempos em tempos enquanto houver importação rodando. */
  private agendarConsultaLista(): void {
    this.pararConsultaLista();
    if (this.aba() === 'execucoes' && !this.execucao() && this.listaTemAtiva()) {
      this.consultaLista = setTimeout(() => void this.carregarHistorico(), INTERVALO_CONSULTA_MS);
    }
  }

  private pararConsultaLista(): void {
    if (this.consultaLista !== null) {
      clearTimeout(this.consultaLista);
      this.consultaLista = null;
    }
  }

  protected async recarregar(): Promise<void> {
    const atual = this.importacao();
    if (!atual || atual.status === 'RASCUNHO') {
      return;
    }
    try {
      const novo = await this.api.obter(atual.id);
      if (this.importacao()?.id !== novo.id) {
        return;
      }
      const eraAtiva = estaEmAndamento(atual.status);
      this.importacao.set(novo);
      this.atualizarConsulta(novo);
      if (!estaEmAndamento(novo.status) && (eraAtiva || this.linhas() === null)) {
        this.filtroLinhas.set(novo.erros > 0 && novo.status === 'CONCLUIDA' ? 'ERRO' : 'TODOS');
        void this.carregarLinhas();
        void this.carregarHistorico();
      }
    } catch {
      // Falha passageira: a próxima consulta tenta de novo.
    }
  }

  protected async carregarLinhas(): Promise<void> {
    const imp = this.importacao();
    if (!imp) {
      return;
    }
    const pedido = ++this.pedidoLinhas;
    this.carregandoLinhas.set(true);
    this.erroLinhas.set(null);
    const filtro = this.filtroLinhas();
    try {
      const pagina = await this.api.linhas(imp.id, {
        resultado: filtro && filtro !== 'TODOS' ? (filtro as ResultadoLinha) : null,
        pagina: this.paginaLinhas(),
        porPagina: POR_PAGINA_LINHAS,
      });
      if (pedido === this.pedidoLinhas) {
        this.linhas.set(pagina);
      }
    } catch (falha) {
      if (pedido === this.pedidoLinhas) {
        this.erroLinhas.set(erroDaApi(falha));
      }
    } finally {
      if (pedido === this.pedidoLinhas) {
        this.carregandoLinhas.set(false);
      }
    }
  }

  protected mudarFiltroLinhas(id: string | null): void {
    this.filtroLinhas.set(id ?? 'TODOS');
    this.paginaLinhas.set(1);
    void this.carregarLinhas();
  }

  protected mudarPaginaLinhas(pagina: number): void {
    this.paginaLinhas.set(pagina);
    void this.carregarLinhas();
  }

  /** Planilha modelo do tipo escolhido (ou parcelas, na tela do Financeiro). */
  protected async baixarModelo(): Promise<void> {
    if (this.baixandoModelo()) {
      return;
    }
    this.baixandoModelo.set(true);
    try {
      const tipo = this.tipoFixo ?? this.tipo();
      const arquivo = await this.api.planilhaModelo(tipo);
      baixarArquivo(arquivo, `modelo-${NOME_DO_MODELO[tipo]}.xlsx`);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.baixandoModelo.set(false);
    }
  }

  protected async baixarRelatorio(): Promise<void> {
    const imp = this.execucao();
    if (!imp || this.baixando()) {
      return;
    }
    this.baixando.set(true);
    try {
      const arquivo = await this.api.relatorio(imp.id);
      baixarArquivo(arquivo, `relatorio-${imp.nome.replace(/\.[^.]+$/, '')}.xlsx`);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.baixando.set(false);
    }
  }

  protected async retomar(): Promise<void> {
    await this.agir(async (imp) => this.api.retomar(imp.id), 'Importação retomada de onde parou.');
  }

  protected async cancelar(): Promise<void> {
    const imp = this.execucao();
    if (!imp) {
      return;
    }
    const ok = await this.confirmacao.confirmar({
      titulo: 'Cancelar esta importação?',
      mensagem: 'O que já foi importado continua no CRM. As linhas restantes não serão importadas.',
      confirmar: 'Cancelar importação',
      cancelar: 'Continuar importando',
      perigo: true,
      executar: async () => this.importacao.set(await this.api.cancelar(imp.id)),
    });
    if (ok) {
      const novo = this.importacao();
      if (novo) {
        this.atualizarConsulta(novo);
        void this.carregarLinhas();
        void this.carregarHistorico();
      }
    }
  }

  protected async excluir(): Promise<void> {
    const imp = this.execucao();
    if (!imp) {
      return;
    }
    const ok = await this.confirmacao.confirmar({
      titulo: 'Excluir esta importação?',
      mensagem: 'Some da lista de importações. Os registros já importados continuam no CRM.',
      confirmar: 'Excluir',
      perigo: true,
      executar: () => this.api.excluir(imp.id),
    });
    if (ok) {
      this.voltarParaLista();
    }
  }

  private async agir(
    acao: (imp: Importacao) => Promise<Importacao>,
    sucesso: string,
  ): Promise<void> {
    const imp = this.execucao();
    if (!imp || this.agindo()) {
      return;
    }
    this.agindo.set(true);
    try {
      const novo = await acao(imp);
      this.importacao.set(novo);
      this.atualizarConsulta(novo);
      this.avisos.sucesso(sucesso);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.agindo.set(false);
    }
  }

  /** Recomeça a aba "Nova importação" (depois de um erro ao abrir). */
  protected limpar(): void {
    this.pararConsulta();
    this.zerarRascunho();
    this.linhas.set(null);
    this.erroArquivo.set(null);
    this.erroCarga.set(null);
    this.irParaImportacao(null);
  }

  /** Valores originais de uma linha com erro, em texto curto. */
  protected resumoDados(linha: LinhaImportada): string {
    const dados = linha.dados;
    if (!dados) {
      return '';
    }
    return Object.values(dados)
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
      .map((v) => String(v))
      .join(' · ');
  }

  protected rotuloDoCampo(chave: string): string {
    return this.campos().find((c) => c.chave === chave)?.rotulo ?? chave;
  }
}
