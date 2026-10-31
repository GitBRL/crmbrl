import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideArrowLeft,
  LucideCheck,
  LucideCircleAlert,
  LucideDownload,
  LucideFileSpreadsheet,
  LucideRefreshCw,
  LucideUpload,
} from '@lucide/angular';

import { type Pagina, totalDePaginas } from '../../../nucleo/api/api';
import { type ErroApi, erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../../nucleo/confirmacao.service';
import { formatarDataHora, formatarNumero } from '../../../nucleo/formatos';
import { podeImportarContatos } from '../../../nucleo/sessao/perfil';
import { SessaoService } from '../../../nucleo/sessao/sessao.service';
import { TempoRealService } from '../../../nucleo/tempo-real/tempo-real.service';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { CampoTexto } from '../../../ui/campo-texto/campo-texto';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../../ui/filtros-pilula/filtros-pilula';
import { GrupoOpcoes, type OpcaoGrupo } from '../../../ui/grupo-opcoes/grupo-opcoes';
import { Paginacao } from '../../../ui/paginacao/paginacao';
import { Selo } from '../../../ui/selo/selo';
import { Seletor, type OpcaoSeletor } from '../../../ui/seletor/seletor';
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
  exigenciasDoMapeamento,
  etapaDoStatus,
  type Importacao,
  type LeituraArquivo,
  type LinhaImportada,
  mapearColuna,
  type Mapeamento,
  type ModeloMapeamento,
  OPCOES_DUPLICADOS,
  type PoliticaDuplicados,
  PREFIXO_PERSONALIZADO,
  type Previa,
  type ProgressoImportacao,
  ROTULO_AREA_RODIZIO,
  ROTULO_RESULTADO,
  ROTULO_STATUS,
  ROTULO_TIPO,
  type ResultadoLinha,
  type TipoImportacao,
  VARIANTE_RESULTADO,
  VARIANTE_STATUS,
} from './importar.tipos';

type Etapa = 1 | 2 | 3 | 4;

const PASSOS: readonly { readonly numero: Etapa; readonly rotulo: string }[] = [
  { numero: 1, rotulo: 'Arquivo' },
  { numero: 2, rotulo: 'Colunas' },
  { numero: 3, rotulo: 'Opções' },
  { numero: 4, rotulo: 'Importação' },
];

const OPCOES_TIPO: readonly OpcaoGrupo<TipoImportacao>[] = [
  { valor: 'CONTATOS', rotulo: 'Contatos' },
  { valor: 'EMPRESAS', rotulo: 'Empresas' },
];

const OPCOES_RESPONSAVEL: readonly OpcaoGrupo<EstrategiaResponsavel | 'NENHUM'>[] = [
  {
    valor: 'NENHUM',
    rotulo: 'Sem responsável definido',
    dica: 'Os registros entram sem dono e a equipe distribui depois.',
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

const FILTROS_RESULTADO: readonly OpcaoFiltro[] = [
  { id: 'TODOS', rotulo: 'Todas' },
  { id: 'ERRO', rotulo: 'Com erro' },
  { id: 'CRIADO', rotulo: 'Criadas' },
  { id: 'ATUALIZADO', rotulo: 'Atualizadas' },
  { id: 'IGNORADO', rotulo: 'Ignoradas' },
];

const POR_PAGINA_LINHAS = 20;
const INTERVALO_CONSULTA_MS = 4000;

interface LinhaDeColuna {
  readonly coluna: string;
  readonly amostra: string;
  readonly campo: string | null;
  readonly opcoes: readonly OpcaoSeletor<string>[];
}

/**
 * Assistente de importação (`/contatos/importar`, R16): arquivo → colunas (com modelos salvos)
 * → opções → importação com progresso ao vivo e relatório. O estado vive na API (rascunho de
 * importação), então dá para sair e voltar: `?importacao=<id>` reabre onde parou.
 */
@Component({
  selector: 'app-importar-contatos',
  imports: [
    Botao,
    Cartao,
    CampoEtiquetas,
    CampoTexto,
    Esqueleto,
    EstadoVazio,
    FiltrosPilula,
    GrupoOpcoes,
    Paginacao,
    Selo,
    Seletor,
    LucideArrowLeft,
    LucideCheck,
    LucideCircleAlert,
    LucideDownload,
    LucideFileSpreadsheet,
    LucideRefreshCw,
    LucideUpload,
  ],
  templateUrl: './importar.html',
  styleUrl: './importar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Importar implements OnInit {
  private readonly api = inject(ImportarApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly sessao = inject(SessaoService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly tempoReal = inject(TempoRealService);

  protected readonly passos = PASSOS;
  protected readonly opcoesTipo = OPCOES_TIPO;
  protected readonly opcoesDuplicados = OPCOES_DUPLICADOS.map((o) => ({
    valor: o.valor,
    rotulo: o.rotulo,
    dica: o.dica,
  }));
  protected readonly opcoesResponsavel = OPCOES_RESPONSAVEL;
  protected readonly opcoesArea = OPCOES_AREA;
  protected readonly opcoesSeparador = OPCOES_SEPARADOR;
  protected readonly opcoesCodificacao = OPCOES_CODIFICACAO;
  protected readonly filtrosResultado = FILTROS_RESULTADO;
  protected readonly rotuloTipo = ROTULO_TIPO;
  protected readonly rotuloStatus = ROTULO_STATUS;
  protected readonly varianteStatus = VARIANTE_STATUS;
  protected readonly rotuloResultado = ROTULO_RESULTADO;
  protected readonly varianteResultado = VARIANTE_RESULTADO;
  protected readonly dataHora = formatarDataHora;
  protected readonly numero = (valor: number): string => formatarNumero(valor, 0);

  /** A permissão nova (`/auth/eu` → `permissoes.importarContatos`); a API continua decidindo. */
  protected readonly podeImportar = computed(() => this.sessao.permite(podeImportarContatos));

  // ----- Estado ------------------------------------------------------------------------------
  protected readonly etapa = signal<Etapa>(1);
  protected readonly importacao = signal<Importacao | null>(null);
  protected readonly previa = signal<Previa | null>(null);
  protected readonly carregando = signal(false);
  protected readonly erroCarga = signal<ErroApi | null>(null);

  // Etapa 1
  protected readonly tipo = signal<TipoImportacao>('CONTATOS');
  protected readonly arquivo = signal<File | null>(null);
  protected readonly erroArquivo = signal<string | null>(null);
  protected readonly arrastando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly historico = signal<Pagina<Importacao> | null>(null);
  protected readonly erroHistorico = signal<ErroApi | null>(null);

  // Etapa 2
  protected readonly campos = signal<readonly CampoImportavel[]>([]);
  protected readonly modelos = signal<readonly ModeloMapeamento[]>([]);
  protected readonly mapeamento = signal<Mapeamento>({});
  protected readonly modeloId = signal<string | null>(null);
  protected readonly salvandoModelo = signal(false);
  protected readonly nomeModelo = signal('');
  protected readonly nomeModeloAberto = signal(false);
  protected readonly leituraAberta = signal(false);
  protected readonly separador = signal<string | null>(null);
  protected readonly codificacao = signal<string | null>(null);
  protected readonly aba = signal<string | null>(null);
  protected readonly salvando = signal(false);

  // Etapa 3
  protected readonly duplicados = signal<PoliticaDuplicados>('ATUALIZAR_VAZIOS');
  protected readonly etiquetas = signal<readonly string[]>([]);
  protected readonly estrategia = signal<EstrategiaResponsavel | 'NENHUM'>('NENHUM');
  protected readonly areaRodizio = signal<AreaRodizio | null>(null);
  protected readonly responsavelId = signal<string | null>(null);
  protected readonly origemDetalhe = signal('');
  protected readonly responsaveis = signal<readonly UsuarioResponsavel[]>([]);
  protected readonly iniciando = signal(false);

  // Etapa 4
  protected readonly linhas = signal<Pagina<LinhaImportada> | null>(null);
  protected readonly carregandoLinhas = signal(false);
  protected readonly erroLinhas = signal<ErroApi | null>(null);
  protected readonly filtroLinhas = signal<string | null>('TODOS');
  protected readonly paginaLinhas = signal(1);
  protected readonly baixando = signal(false);
  protected readonly agindo = signal(false);

  protected readonly tituloTipo = computed(
    () => ROTULO_TIPO[this.importacao()?.tipo ?? this.tipo()],
  );
  protected readonly substantivo = computed(() =>
    (this.importacao()?.tipo ?? this.tipo()) === 'EMPRESAS' ? 'empresas' : 'contatos',
  );

  protected readonly linhasDeColuna = computed<readonly LinhaDeColuna[]>(() => {
    const imp = this.importacao();
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
        .slice(0, 2);
      const opcoes: OpcaoSeletor<string>[] = campos.map((c) => ({
        valor: c.chave,
        rotulo: c.obrigatorio ? `${c.rotulo} (obrigatório)` : c.rotulo,
        desabilitada: usados.has(c.chave) && usados.get(c.chave) !== coluna,
      }));
      const chave = chaveDeCampoPersonalizado(coluna);
      const personalizado = chave ? `${PREFIXO_PERSONALIZADO}${chave}` : null;
      const conhecido = (valor: string) => campos.some((c) => c.chave === valor);
      if (campo && !conhecido(campo)) {
        opcoes.push({
          valor: campo,
          rotulo: `Campo próprio: ${campo.replace(PREFIXO_PERSONALIZADO, '')}`,
        });
      } else if (personalizado && !conhecido(personalizado)) {
        opcoes.push({
          valor: personalizado,
          rotulo: `Criar campo próprio “${chave}”`,
          desabilitada: usados.has(personalizado),
        });
      }
      return { coluna, amostra: exemplos.join(' · '), campo, opcoes };
    });
  });

  protected readonly exigencias = computed(() =>
    exigenciasDoMapeamento(this.importacao()?.tipo ?? this.tipo(), this.mapeamento()),
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

  protected readonly totalPaginasLinhas = computed(() => {
    const p = this.linhas();
    return p ? totalDePaginas(p) : 1;
  });

  protected readonly resumoDasOpcoes = computed(() => {
    const dup = OPCOES_DUPLICADOS.find((o) => o.valor === this.duplicados());
    const partes: string[] = [`Quem já existe: ${(dup?.rotulo ?? '').toLowerCase()}`];
    if (this.etiquetas().length > 0) {
      partes.push(`etiquetas: ${this.etiquetas().join(', ')}`);
    }
    if (this.estrategia() === 'RODIZIO' && this.areaRodizio()) {
      partes.push(`rodízio em ${ROTULO_AREA_RODIZIO[this.areaRodizio()!]}`);
    }
    if (this.estrategia() === 'RESPONSAVEL_FIXO' && this.responsavelId()) {
      const nome = this.responsaveis().find((u) => u.id === this.responsavelId())?.nome;
      partes.push(`responsável: ${nome ?? 'escolhido'}`);
    }
    return partes.join(' · ');
  });

  protected readonly opcoesOk = computed(() => {
    const e = this.estrategia();
    return (
      (e !== 'RODIZIO' || this.areaRodizio() !== null) &&
      (e !== 'RESPONSAVEL_FIXO' || this.responsavelId() !== null)
    );
  });

  protected readonly emAndamento = computed(() => {
    const i = this.importacao();
    return !!i && estaEmAndamento(i.status);
  });

  private consulta: ReturnType<typeof setInterval> | null = null;
  private pedidoLinhas = 0;

  constructor() {
    const destruir = inject(DestroyRef);
    const parar = this.tempoReal.ouvir('importacao.progresso', (dados) => this.aoProgresso(dados));
    destruir.onDestroy(() => {
      parar();
      this.pararConsulta();
    });
  }

  ngOnInit(): void {
    if (!this.podeImportar()) {
      return;
    }
    void this.carregarHistorico();
    const id = this.rota.snapshot.queryParamMap.get('importacao');
    if (id) {
      void this.abrir(id);
    }
  }

  // ----- Etapa 1: arquivo --------------------------------------------------------------------

  protected escolherArquivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.receberArquivo(entrada.files?.[0] ?? null);
    entrada.value = '';
  }

  protected soltarArquivo(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastando.set(false);
    this.receberArquivo(evento.dataTransfer?.files?.[0] ?? null);
  }

  protected sobrevoar(evento: DragEvent, sobre: boolean): void {
    evento.preventDefault();
    this.arrastando.set(sobre);
  }

  private receberArquivo(arquivo: File | null): void {
    if (!arquivo) {
      return;
    }
    const erro = erroDoArquivo(arquivo);
    this.erroArquivo.set(erro);
    this.arquivo.set(erro ? null : arquivo);
  }

  protected tirarArquivo(): void {
    this.arquivo.set(null);
    this.erroArquivo.set(null);
  }

  protected async enviar(): Promise<void> {
    const arquivo = this.arquivo();
    if (!arquivo || this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.erroArquivo.set(null);
    try {
      const enviado = await this.api.enviarArquivo(arquivo);
      const criada = await this.api.criar(this.tipo(), enviado.id);
      await this.prepararRascunho(criada, criada.previa);
      this.arquivo.set(null);
      this.irParaImportacao(criada.id);
      void this.carregarHistorico();
    } catch (falha) {
      this.erroArquivo.set(erroDaApi(falha).resumo);
    } finally {
      this.enviando.set(false);
    }
  }

  protected async carregarHistorico(): Promise<void> {
    this.erroHistorico.set(null);
    try {
      this.historico.set(await this.api.listar({ porPagina: 8 }));
    } catch (falha) {
      this.erroHistorico.set(erroDaApi(falha));
    }
  }

  /** Reabre uma importação onde ela parou. */
  protected async abrir(id: string): Promise<void> {
    this.carregando.set(true);
    this.erroCarga.set(null);
    try {
      const imp = await this.api.obter(id);
      if (imp.status === 'RASCUNHO') {
        await this.prepararRascunho(imp, await this.api.previa(id));
      } else {
        this.mostrarAndamento(imp);
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

  // ----- Etapa 2: colunas --------------------------------------------------------------------

  private async prepararRascunho(imp: Importacao, previa: Previa): Promise<void> {
    this.pararConsulta();
    this.importacao.set(imp);
    this.previa.set(previa);
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
    this.aba.set(imp.leitura.aba ?? previa.abas?.[0] ?? null);
    this.etapa.set(2);
    const [campos, modelos] = await Promise.all([
      this.api.campos(imp.tipo),
      this.api.modelos(imp.tipo).catch(() => [] as readonly ModeloMapeamento[]),
    ]);
    this.campos.set(campos);
    this.modelos.set(modelos);
  }

  protected mudarCampo(coluna: string, campo: string | null): void {
    this.mapeamento.update((m) => mapearColuna(m, coluna, campo));
    this.modeloId.set(null);
  }

  protected async usarModelo(id: string | null): Promise<void> {
    const imp = this.importacao();
    if (!imp || !id) {
      this.modeloId.set(null);
      return;
    }
    try {
      const novo = await this.api.alterar(imp.id, { modeloId: id });
      this.importacao.set(novo);
      this.mapeamento.set(novo.mapeamento);
      this.duplicados.set(novo.duplicados);
      this.etiquetas.set(novo.etiquetas);
      this.modeloId.set(novo.modeloId ?? id);
      this.avisos.sucesso('Modelo aplicado às colunas do arquivo.');
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  protected async salvarModelo(): Promise<void> {
    const imp = this.importacao();
    const nome = this.nomeModelo().trim();
    if (!imp || !nome || this.salvandoModelo()) {
      return;
    }
    this.salvandoModelo.set(true);
    try {
      const modelo = await this.api.criarModelo({
        nome,
        tipo: imp.tipo,
        mapeamento: this.mapeamento(),
        opcoes: { duplicados: this.duplicados(), etiquetas: this.etiquetas() },
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

  protected async aplicarLeitura(): Promise<void> {
    const imp = this.importacao();
    if (!imp || this.salvando()) {
      return;
    }
    const leitura: LeituraArquivo = {
      ...(this.separador() ? { separador: this.separador() as LeituraArquivo['separador'] } : {}),
      ...(this.codificacao()
        ? { codificacao: this.codificacao() as LeituraArquivo['codificacao'] }
        : {}),
      ...(this.aba() ? { aba: this.aba()! } : {}),
    };
    this.salvando.set(true);
    try {
      const novo = await this.api.alterar(imp.id, { leitura });
      const previa = await this.api.previa(imp.id);
      this.importacao.set(novo);
      this.previa.set(previa);
      this.mapeamento.set(novo.mapeamento);
      this.modeloId.set(null);
      this.avisos.sucesso('Planilha lida de novo com estes ajustes.');
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.salvando.set(false);
    }
  }

  protected opcoesAbas(): readonly OpcaoSeletor<string>[] {
    return (this.previa()?.abas ?? []).map((a) => ({ valor: a, rotulo: a }));
  }

  protected async comecarDeNovo(): Promise<void> {
    const imp = this.importacao();
    if (!imp) {
      return;
    }
    const ok = await this.confirmacao.confirmar({
      titulo: 'Escolher outro arquivo?',
      mensagem: 'Esta importação em preparo será descartada. Nada foi importado ainda.',
      confirmar: 'Descartar e voltar',
      perigo: true,
      executar: () => this.api.excluir(imp.id),
    });
    if (ok) {
      this.limpar();
      void this.carregarHistorico();
    }
  }

  protected async continuarParaOpcoes(): Promise<void> {
    const imp = this.importacao();
    if (!imp || !this.mapeamentoCompleto() || this.salvando()) {
      return;
    }
    this.salvando.set(true);
    try {
      const novo = await this.api.alterar(imp.id, {
        mapeamento: this.mapeamento(),
        modeloId: this.modeloId(),
      });
      this.importacao.set(novo);
      this.etapa.set(3);
      if (this.responsaveis().length === 0) {
        this.api
          .responsaveis()
          .then((lista) => this.responsaveis.set(lista))
          .catch(() => undefined);
      }
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.salvando.set(false);
    }
  }

  // ----- Etapa 3: opções ---------------------------------------------------------------------

  protected async iniciar(): Promise<void> {
    const imp = this.importacao();
    if (!imp || this.iniciando() || !this.opcoesOk()) {
      return;
    }
    this.iniciando.set(true);
    try {
      const estrategia = this.estrategia();
      await this.api.alterar(imp.id, {
        duplicados: this.duplicados(),
        etiquetas: this.etiquetas(),
        estrategiaResponsavel: estrategia === 'NENHUM' ? null : estrategia,
        areaRodizio: estrategia === 'RODIZIO' ? this.areaRodizio() : null,
        responsavelId: estrategia === 'RESPONSAVEL_FIXO' ? this.responsavelId() : null,
        origemDetalhe: this.origemDetalhe().trim() || null,
      });
      const iniciada = await this.api.iniciar(imp.id);
      this.mostrarAndamento(iniciada);
      void this.carregarHistorico();
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.iniciando.set(false);
    }
  }

  // ----- Etapa 4: andamento e relatório ------------------------------------------------------

  private mostrarAndamento(imp: Importacao): void {
    this.importacao.set(imp);
    this.etapa.set(etapaDoStatus(imp.status) === 2 ? 2 : 4);
    this.filtroLinhas.set(imp.erros > 0 && imp.status === 'CONCLUIDA' ? 'ERRO' : 'TODOS');
    this.paginaLinhas.set(1);
    this.linhas.set(null);
    this.atualizarConsulta(imp);
    if (imp.processadas > 0 || !estaEmAndamento(imp.status)) {
      void this.carregarLinhas();
    }
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

  protected async recarregar(): Promise<void> {
    const atual = this.importacao();
    if (!atual) {
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

  protected async baixarRelatorio(): Promise<void> {
    const imp = this.importacao();
    if (!imp || this.baixando()) {
      return;
    }
    this.baixando.set(true);
    try {
      const arquivo = await this.api.relatorio(imp.id);
      const url = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-${imp.nome.replace(/\.[^.]+$/, '')}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    const imp = this.importacao();
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
    const imp = this.importacao();
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
      this.limpar();
      void this.carregarHistorico();
    }
  }

  private async agir(
    acao: (imp: Importacao) => Promise<Importacao>,
    sucesso: string,
  ): Promise<void> {
    const imp = this.importacao();
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

  /** Volta ao começo do assistente. */
  protected limpar(): void {
    this.pararConsulta();
    this.importacao.set(null);
    this.previa.set(null);
    this.linhas.set(null);
    this.arquivo.set(null);
    this.erroArquivo.set(null);
    this.erroCarga.set(null);
    this.etapa.set(1);
    this.irParaImportacao(null);
  }

  protected voltarParaColunas(): void {
    this.etapa.set(2);
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
