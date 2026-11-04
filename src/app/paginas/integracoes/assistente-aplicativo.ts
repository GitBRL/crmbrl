import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { LucideCheck, LucideEye, LucidePlus, LucideRefreshCw, LucideX } from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { CampoTexto, type ValorCampoTexto } from '../../ui/campo-texto/campo-texto';
import { Dica } from '../../ui/dica/dica';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { Modal } from '../../ui/modal/modal';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { BlocoCodigo } from './comum/bloco-codigo';
import { LogotipoAplicativo } from './comum/logotipo-aplicativo';
import {
  DESTINO_DO_CONTATO,
  DESTINO_DO_NEGOCIO,
  LinhaDoMapaCampo,
  type LinhaDoMapa,
} from './linha-do-mapa';
import { ValorUnico } from './comum/valor-unico';
import {
  listaDoTexto,
  perdidosSemMotivo,
  ROTULO_ACAO_DO_EVENTO,
  type TabelaDeEventos,
  tabelaInicial,
  tabelaParaApi,
} from './eventos.tipos';
import { exemploCurlEntrada } from './exemplos';
import { FacebookApi } from './facebook.api';
import {
  type ConexaoFacebook,
  type ContextoDoLogin,
  type FormularioFacebook,
  type RetornoDoFacebook,
} from './facebook.tipos';
import { IntegracoesApi } from './integracoes.api';
import { PassoConexaoFacebook } from './passo-conexao-facebook';
import { PassoFormularioFacebook } from './passo-formulario-facebook';
import { TabelaDeEventosPasso } from './tabela-de-eventos';
import { PreviaMapeamento } from './previa-mapeamento';
import {
  type AlvoIntegracao,
  type AplicativoDoCatalogo,
  type CampoDeIntegracao,
  type CondicaoParaIgnorar,
  type DadosWebhookEntrada,
  DICA_ESTRATEGIA,
  DICA_MODO,
  type DestinoDeMapeamento,
  type EstrategiaDistribuicao,
  type FormularioDoTypeform,
  type FunilDoDestino,
  type Mapeamento,
  type ModeloMapeamento,
  type ModeloPronto,
  type ModoIntegracao,
  PREFIXO_CAMPO_DO_NEGOCIO,
  PREFIXO_CAMPO_PERSONALIZADO,
  type ResultadoDaCredencial,
  type ResultadoDaPrevia,
  ROTULO_ESTRATEGIA,
  ROTULO_STATUS_INICIAL,
  rotuloDaAcao,
  rotuloDoDestino,
  type StatusInicial,
  type UsuarioDoDestino,
  type WebhookEntrada,
  type WebhookEntradaCriado,
} from './tipos';

export { DESTINO_DO_CONTATO, DESTINO_DO_NEGOCIO };

export type IdDoPasso =
  | 'comecar'
  | 'conexao'
  | 'acao'
  | 'endereco'
  | 'eventos'
  | 'mapeamento'
  | 'configuracoes'
  | 'salvar';

const TAMANHO_MINIMO_SEGREDO = 16;
const TAMANHO_MAXIMO_SEGREDO = 200;

interface CondicaoEditavel {
  readonly id: number;
  readonly caminho: string;
  readonly valor: string;
}

type Seguranca = 'NENHUMA' | 'GERAR' | 'INFORMAR';

const OPCOES_SEGURANCA: readonly OpcaoGrupo<Seguranca>[] = [
  {
    valor: 'NENHUMA',
    rotulo: 'Sem assinatura',
    dica: 'Basta o endereço, que é longo e aleatório. Serve para ferramentas que não sabem assinar.',
  },
  {
    valor: 'GERAR',
    rotulo: 'Gerar um segredo',
    dica: 'O CRM cria o segredo e o mostra uma única vez, no passo do endereço.',
  },
  {
    valor: 'INFORMAR',
    rotulo: 'Usar um segredo já combinado',
    dica: 'Cole o segredo que a ferramenta já usa (16 a 200 caracteres).',
  },
];

/** "a, b , A" → ["a", "b"] (sem repetir, sem diferenciar maiúsculas). */
export function separarEtiquetas(texto: string): string[] {
  const etiquetas: string[] = [];
  const vistas = new Set<string>();
  for (const parte of texto.split(',')) {
    const etiqueta = parte.trim();
    const chave = etiqueta.toLocaleLowerCase('pt-BR');
    if (etiqueta && !vistas.has(chave)) {
      vistas.add(chave);
      etiquetas.push(etiqueta);
    }
  }
  return etiquetas;
}

/** Texto do exemplo → objeto JSON (ou a mensagem do erro). */
export function lerExemplo(texto: string): { valor: unknown } | { erro: string } {
  if (!texto.trim()) {
    return { erro: 'Cole um corpo de exemplo em JSON.' };
  }
  try {
    const valor: unknown = JSON.parse(texto);
    if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
      return { erro: 'O exemplo precisa ser um objeto JSON, entre chaves: { "name": "…" }.' };
    }
    return { valor };
  } catch {
    return { erro: 'O exemplo não é um JSON válido. Confira aspas, vírgulas e chaves.' };
  }
}

/** "true"/"false" viram booleanos; o resto vai como texto. */
function valorDaCondicao(texto: string): string | boolean {
  const limpo = texto.trim();
  if (limpo.toLowerCase() === 'true') {
    return true;
  }
  if (limpo.toLowerCase() === 'false') {
    return false;
  }
  return limpo;
}

/** Destino da API → seletor + chave ("camposPersonalizados.cidade" → contato + "cidade"). */
export function separarDestino(destino: string): { destino: string; chave: string } {
  if (destino.startsWith(PREFIXO_CAMPO_DO_NEGOCIO)) {
    return { destino: DESTINO_DO_NEGOCIO, chave: destino.slice(PREFIXO_CAMPO_DO_NEGOCIO.length) };
  }
  if (destino.startsWith(PREFIXO_CAMPO_PERSONALIZADO)) {
    return {
      destino: DESTINO_DO_CONTATO,
      chave: destino.slice(PREFIXO_CAMPO_PERSONALIZADO.length),
    };
  }
  return { destino, chave: '' };
}

/** Seletor + chave → destino da API. */
export function juntarDestino(linha: Pick<LinhaDoMapa, 'destino' | 'chave'>): string {
  if (linha.destino === DESTINO_DO_NEGOCIO) {
    return `${PREFIXO_CAMPO_DO_NEGOCIO}${linha.chave.trim()}`;
  }
  if (linha.destino === DESTINO_DO_CONTATO) {
    return `${PREFIXO_CAMPO_PERSONALIZADO}${linha.chave.trim()}`;
  }
  return linha.destino ?? '';
}

/**
 * Assistente de uma integração por aplicativo (Onda H, §2.3): Começar (o que faz e o passo a
 * passo na ferramenta) → Ação e nome (e credencial, com "Testar") → Endereço → Mapeamento (à
 * esquerda os campos recebidos, buscados ou adicionados; à direita o campo do CRM) →
 * Configurações adicionais → Salvar. Editar reabre os mesmos passos.
 *
 * O endereço só existe depois de gravar a integração: ao sair do passo "Ação e nome" ela é
 * criada **inativa** e só vira ativa no "Salvar". Quem fecha no meio a encontra na lista, como
 * inativa, e continua de onde parou. Typeform troca o endereço pela escolha do formulário (o
 * CRM registra o webhook lá).
 *
 * Facebook Lead Ads (R32.14) começa pela **Conexão** (login do Facebook ou token de página) e
 * escolhe página e formulário no lugar do endereço; a integração só é criada (inativa) ao sair
 * desse passo, porque a API exige a escolha completa. Hotmart, Kiwify e Eduzz (R32.15) ganham o
 * passo **Eventos**, com a tabela de ações por evento e o filtro de produto.
 */
@Component({
  selector: 'app-assistente-aplicativo',
  imports: [
    Modal,
    Botao,
    BotaoIcone,
    CampoTexto,
    CampoSenha,
    AreaTexto,
    Seletor,
    GrupoOpcoes,
    Dica,
    Esqueleto,
    EstadoVazio,
    PreviaMapeamento,
    ValorUnico,
    BlocoCodigo,
    LogotipoAplicativo,
    LucideCheck,
    LinhaDoMapaCampo,
    PassoConexaoFacebook,
    PassoFormularioFacebook,
    TabelaDeEventosPasso,
  ],
  templateUrl: './assistente-aplicativo.html',
  styleUrl: './assistente-aplicativo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistenteAplicativo {
  private readonly api = inject(IntegracoesApi);
  private readonly apiFacebook = inject(FacebookApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly aberto = model(false);
  readonly aplicativo = input<AplicativoDoCatalogo | null>(null);
  /** Integração a editar; sem ela, cria uma nova. */
  readonly integracao = input<WebhookEntrada | null>(null);
  /** Destinos do mapeamento (do catálogo). */
  readonly destinos = input<readonly DestinoDeMapeamento[]>([]);
  /** Funil já escolhido (vindo das configurações do funil). */
  readonly funilInicial = input<string | null>(null);
  /** O que o login do Facebook devolveu a `/integracoes`: o assistente reabre no passo da conexão. */
  readonly retornoFacebook = input<RetornoDoFacebook | null>(null);
  /** O que o assistente guardou antes de sair para o Facebook (o nome já digitado). */
  readonly contextoDoLogin = input<ContextoDoLogin | null>(null);
  readonly criado = output<WebhookEntradaCriado>();
  readonly salvo = output<WebhookEntrada>();

  protected readonly icones = {
    adicionar: LucidePlus,
    remover: LucideX,
    previa: LucideEye,
    atualizar: LucideRefreshCw,
  };
  protected readonly opcoesSeguranca = OPCOES_SEGURANCA;
  protected readonly destinoContato = DESTINO_DO_CONTATO;
  protected readonly destinoNegocio = DESTINO_DO_NEGOCIO;
  protected readonly rotuloStatus = ROTULO_STATUS_INICIAL;

  // --- Estado ----------------------------------------------------------------------------------
  protected readonly passoAtual = signal<IdDoPasso>('comecar');
  protected readonly carregandoApoio = signal(false);
  protected readonly erroApoio = signal<ErroApi | null>(null);
  private readonly funis = signal<readonly FunilDoDestino[]>([]);
  private readonly usuarios = signal<readonly UsuarioDoDestino[]>([]);
  private readonly modelosDoWebhook = signal<readonly ModeloPronto[]>([]);
  protected readonly enviando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  protected readonly erroNome = signal<string | null>(null);
  protected readonly tocou = signal(false);

  /** A integração em andamento: a que está sendo editada ou a criada neste assistente. */
  protected readonly atual = signal<WebhookEntrada | null>(null);
  protected readonly urlCompleta = signal<string | null>(null);
  protected readonly segredoGerado = signal<string | null>(null);
  protected readonly erroEndereco = signal<ErroApi | null>(null);
  protected readonly carregandoEndereco = signal(false);
  private criadaAgora = false;
  private houveMudanca = false;
  private finalizada = false;

  // Ação e nome
  protected readonly nome = signal('');
  protected readonly alvo = signal<AlvoIntegracao>('NEGOCIO');
  protected readonly modo = signal<ModoIntegracao>('CRIAR_OU_ATUALIZAR');
  protected readonly credencial = signal<Readonly<Record<string, string>>>({});
  protected readonly testando = signal(false);
  protected readonly testeDaCredencial = signal<ResultadoDaCredencial | null>(null);
  protected readonly seguranca = signal<Seguranca>('NENHUMA');
  protected readonly segredoInformado = signal('');
  protected readonly cabecalhoDeAutenticacao = signal('');

  // Formulário (Typeform)
  protected readonly formularios = signal<readonly FormularioDoTypeform[]>([]);
  protected readonly carregandoFormularios = signal(false);
  protected readonly erroFormularios = signal<ErroApi | null>(null);
  protected readonly formularioId = signal<string | null>(null);

  // Facebook Lead Ads
  protected readonly conexaoFacebook = signal<ConexaoFacebook | null>(null);
  protected readonly paginaFacebook = signal<string | null>(null);
  protected readonly formularioFacebook = signal<string | null>(null);
  protected readonly formularioFacebookEscolhido = signal<FormularioFacebook | null>(null);
  private chaveDasPerguntas = '';

  // Plataformas de curso
  protected readonly tabelaDeEventos = signal<TabelaDeEventos>({});
  protected readonly produtos = signal('');
  protected readonly segredoNovo = signal('');
  protected readonly salvandoSegredo = signal(false);
  protected readonly erroDoSegredo = signal<string | null>(null);

  // Mapeamento
  protected readonly linhas = signal<readonly LinhaDoMapa[]>([]);
  protected readonly condicoes = signal<readonly CondicaoEditavel[]>([]);
  protected readonly modeloEscolhido = signal<ModeloMapeamento>('DO_APLICATIVO');
  protected readonly modificado = signal(false);
  protected readonly atualizandoRecebidos = signal(false);
  protected readonly buscandoCampos = signal(false);
  protected readonly avisoDosCampos = signal<string | null>(null);
  protected readonly exemplo = signal('');
  protected readonly previa = signal<ResultadoDaPrevia | null>(null);
  protected readonly carregandoPrevia = signal(false);
  protected readonly erroExemplo = signal<string | null>(null);
  private proximaLinha = 1;
  private exemploEhDeModelo = true;

  // Configurações adicionais
  protected readonly funilId = signal<string | null>(null);
  protected readonly etapaId = signal<string | null>(null);
  protected readonly statusInicial = signal<StatusInicial>('ABERTO');
  protected readonly motivoPerda = signal('');
  protected readonly etiquetas = signal('');
  protected readonly estrategia = signal<EstrategiaDistribuicao>('RODIZIO');
  protected readonly responsavelId = signal<string | null>(null);

  // --- Derivados -------------------------------------------------------------------------------
  protected readonly app = computed(() => this.aplicativo());
  protected readonly editando = computed(() => this.integracao() !== null);
  protected readonly ehWebhook = computed(() => this.app()?.aplicativo === 'WEBHOOK');
  protected readonly escolheFormulario = computed(() => !!this.app()?.escolheFormulario);
  protected readonly buscaCampos = computed(() => !!this.app()?.buscaCampos);
  protected readonly credenciais = computed(() => this.app()?.credencial ?? []);
  protected readonly segredoOpcional = computed(
    () => this.app()?.autenticidade.segredo === 'OPCIONAL',
  );
  protected readonly ehContato = computed(() => this.alvo() === 'CONTATO');
  protected readonly ehPerdido = computed(() => this.statusInicial() === 'PERDIDO');
  protected readonly ehFixo = computed(() => this.estrategia() === 'RESPONSAVEL_FIXO');
  protected readonly ehRd = computed(() => this.app()?.aplicativo === 'RD_STATION');
  protected readonly ehFacebook = computed(() => this.app()?.aplicativo === 'FACEBOOK_LEAD_ADS');
  protected readonly eventosDoApp = computed(() => this.app()?.eventos ?? null);
  /** Hotmart, Kiwify e Eduzz: a ação vem da tabela de eventos, não do modo escolhido. */
  protected readonly ehCurso = computed(() => !!this.eventosDoApp());
  protected readonly rotuloDoSegredo = computed(
    () => this.app()?.autenticidade.rotuloDoSegredo ?? 'Segredo',
  );
  protected readonly nomeDaBusca = computed(() =>
    this.ehFacebook() ? 'perguntas do formulário' : 'campos da integração',
  );
  protected readonly motivoPadraoObrigatorio = computed(() => {
    const tabela = this.tabelaDeEventos();
    return this.ehPerdido() || perdidosSemMotivo(tabela).length > 0;
  });

  protected readonly passos = computed<readonly { id: IdDoPasso; nome: string }[]>(() => [
    { id: 'comecar', nome: 'Começar' },
    ...(this.ehFacebook() ? [{ id: 'conexao' as const, nome: 'Conexão' }] : []),
    { id: 'acao', nome: 'Ação e nome' },
    {
      id: 'endereco',
      nome: this.ehFacebook()
        ? 'Página e formulário'
        : this.escolheFormulario()
          ? 'Formulário'
          : 'Endereço',
    },
    ...(this.ehCurso() ? [{ id: 'eventos' as const, nome: 'Eventos' }] : []),
    { id: 'mapeamento', nome: 'Mapeamento' },
    { id: 'configuracoes', nome: 'Configurações' },
    { id: 'salvar', nome: 'Salvar' },
  ]);
  protected readonly contextoParaOLogin = computed<ContextoDoLogin>(() => ({
    integracaoId: this.atual()?.id ?? this.integracao()?.id ?? null,
    nome: this.nome(),
  }));
  protected readonly opcoesEtapaAberta = computed<readonly OpcaoSeletor<string>[]>(() =>
    (this.funilEscolhido()?.etapas ?? [])
      .filter((etapa) => etapa.tipo === 'ABERTA')
      .map((etapa) => ({ valor: etapa.id, rotulo: etapa.nome })),
  );
  /** A conexão que já vale (a da integração ou a que voltou do login), para o passo marcá-la. */
  protected readonly conexaoInicial = computed(() => {
    const retorno = this.retornoFacebook();
    return (
      this.conexaoFacebook()?.id ??
      (retorno?.resultado === 'conectado' ? retorno.conexaoId : null) ??
      this.integracao()?.configuracao.conexaoId ??
      null
    );
  });
  protected readonly nomeDoFunil = computed(() => this.funilEscolhido()?.nome ?? null);
  protected readonly indice = computed(() =>
    this.passos().findIndex((p) => p.id === this.passoAtual()),
  );
  protected readonly ultimo = computed(() => this.indice() === this.passos().length - 1);

  protected readonly titulo = computed(() => {
    const nome = this.app()?.nome ?? 'Integração';
    return this.editando() ? `Editar integração · ${nome}` : `Nova integração · ${nome}`;
  });
  protected readonly complemento = computed(
    () => `· passo ${this.indice() + 1} de ${this.passos().length}`,
  );

  protected readonly opcoesAlvo = computed<readonly OpcaoGrupo<AlvoIntegracao>[]>(() => [
    {
      valor: 'NEGOCIO',
      rotulo: 'Negócio',
      dica: 'Cria ou atualiza o contato e o negócio dele no funil.',
    },
    {
      valor: 'CONTATO',
      rotulo: 'Contato',
      dica: 'Cria ou atualiza só o contato, sem abrir negócio.',
    },
  ]);
  protected readonly opcoesModo = computed<readonly OpcaoGrupo<ModoIntegracao>[]>(() =>
    (['CRIAR_OU_ATUALIZAR', 'CRIAR', 'ATUALIZAR'] as const).map((valor) => ({
      valor,
      rotulo: { CRIAR: 'Criar', ATUALIZAR: 'Atualizar', CRIAR_OU_ATUALIZAR: 'Criar ou atualizar' }[
        valor
      ],
      dica: DICA_MODO[valor],
    })),
  );
  protected readonly erroDoNome = computed(
    () =>
      this.erroNome() ?? (this.tocou() && !this.nome().trim() ? 'Dê um nome à integração.' : null),
  );
  protected readonly acaoEscolhida = computed(() => rotuloDaAcao(this.alvo(), this.modo()));

  protected readonly opcoesStatus = computed<readonly OpcaoGrupo<StatusInicial>[]>(() => [
    { valor: 'ABERTO', rotulo: 'Aberto', dica: 'O negócio entra no funil para ser trabalhado.' },
    {
      valor: 'GANHO',
      rotulo: 'Ganho',
      dica: 'Já nasce fechado como ganho (ex.: compra aprovada).',
    },
    { valor: 'PERDIDO', rotulo: 'Perdido', dica: 'Já nasce perdido, com o motivo padrão abaixo.' },
  ]);

  protected readonly opcoesFunil = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.funis()
      .filter((funil) => funil.ativo)
      .map((funil) => ({ valor: funil.id, rotulo: funil.nome })),
  );
  private readonly funilEscolhido = computed(
    () => this.funis().find((funil) => funil.id === this.funilId()) ?? null,
  );
  protected readonly opcoesEtapa = computed<readonly OpcaoSeletor<string>[]>(() =>
    (this.funilEscolhido()?.etapas ?? [])
      .filter((etapa) => etapa.tipo !== 'PERDIDO')
      .map((etapa) => ({
        valor: etapa.id,
        rotulo: etapa.tipo === 'GANHO' ? `${etapa.nome} (etapa de ganho)` : etapa.nome,
      })),
  );
  protected readonly opcoesEstrategia = computed<readonly OpcaoGrupo<EstrategiaDistribuicao>[]>(
    () => {
      const area = this.funilEscolhido()?.nome ?? 'do funil';
      return (['RODIZIO', 'RESPONSAVEL_FIXO', 'LIDER_DA_AREA'] as const).map((valor) => ({
        valor,
        rotulo: valor === 'RODIZIO' ? `Rodízio da área (${area})` : ROTULO_ESTRATEGIA[valor],
        dica: DICA_ESTRATEGIA[valor],
      }));
    },
  );
  protected readonly opcoesResponsavel = computed<readonly OpcaoSeletor<string>[]>(() => {
    const area = this.funilEscolhido()?.area;
    return this.usuarios()
      .filter((u) => u.ativo && (u.papel === 'ADMIN' || u.papel === 'C_LEVEL' || u.area === area))
      .map((u) => ({ valor: u.id, rotulo: `${u.nome} — ${u.rotuloPapel}` }));
  });
  protected readonly opcoesFormulario = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.formularios().map((f) => ({ valor: f.id, rotulo: f.titulo })),
  );

  protected readonly opcoesDestino = computed<readonly OpcaoSeletor<string>[]>(() => [
    ...this.destinos()
      .filter((d) => !d.destino.includes('<chave>'))
      .map((d) => ({ valor: d.destino, rotulo: rotuloDoDestino(d.destino) })),
    { valor: DESTINO_DO_CONTATO, rotulo: 'Campo personalizado do contato…' },
    { valor: DESTINO_DO_NEGOCIO, rotulo: 'Campo personalizado do negócio…' },
  ]);

  protected readonly opcoesModeloWebhook = computed<readonly OpcaoGrupo<ModeloMapeamento>[]>(() =>
    this.modelosDoWebhook().map((m) => ({ valor: m.modelo, rotulo: m.nome, dica: m.descricao })),
  );

  /** O que chegou ou foi buscado/adicionado vem primeiro; os caminhos do modelo sem uso, depois. */
  protected readonly linhasPrincipais = computed(() =>
    this.linhas().filter((l) => l.origem !== 'modelo' || l.exemplo !== null || l.rotulo !== null),
  );
  protected readonly linhasDoModelo = computed(() =>
    this.linhas().filter((l) => l.origem === 'modelo' && l.exemplo === null && l.rotulo === null),
  );
  protected readonly totalMapeados = computed(
    () => this.linhas().filter((l) => !!l.destino).length,
  );

  protected readonly resumo = computed(() => {
    const funil = this.funilEscolhido();
    const etapa = funil?.etapas.find((e) => e.id === this.etapaId());
    const responsavel = this.usuarios().find((u) => u.id === this.responsavelId());
    const estrategia = this.estrategia();
    const mapeados = this.linhas().filter((l) => !!l.destino);
    return {
      nome: this.nome().trim() || '—',
      acao: this.acaoEscolhida(),
      destino: funil && etapa ? `${funil.nome} · ${etapa.nome}` : '—',
      status: ROTULO_STATUS_INICIAL[this.statusInicial()],
      distribuicao:
        estrategia === 'RESPONSAVEL_FIXO' && responsavel
          ? `Responsável fixo: ${responsavel.nome}`
          : ROTULO_ESTRATEGIA[estrategia],
      mapeamento: this.modificado() ? 'Personalizado' : `${mapeados.length} campos do modelo`,
      etiquetas: separarEtiquetas(this.etiquetas()).join(', ') || 'nenhuma',
      conexao: this.conexaoFacebook()?.nome ?? '—',
      pagina:
        this.conexaoFacebook()?.paginas.find((p) => p.id === this.paginaFacebook())?.nome ?? '—',
      formulario:
        this.formularioFacebookEscolhido()?.nome ??
        this.integracao()?.configuracao.formularioNome ??
        '—',
      eventos: this.resumoDosEventos(),
      produtos: listaDoTexto(this.produtos()).join(', ') || 'todos os produtos',
    };
  });

  /** O `curl` de teste do passo do endereço. */
  protected readonly curl = computed(() => {
    const url = this.urlCompleta();
    const app = this.app();
    if (!url || !app) {
      return '';
    }
    const exemplo = lerExemplo(this.exemplo());
    return exemploCurlEntrada(url, 'valor' in exemplo ? exemplo.valor : undefined, {
      exige: !!this.atual()?.exigeAssinatura,
      segredo:
        this.segredoGerado() ?? (this.seguranca() === 'INFORMAR' ? this.segredoInformado() : null),
    });
  });

  constructor() {
    effect(() => {
      if (this.aberto()) {
        untracked(() => this.iniciar());
      } else {
        untracked(() => this.aoFechar());
      }
    });

    // Trocar de funil leva a etapa para a primeira aberta dele (se a atual for de outro funil).
    effect(() => {
      const funil = this.funilEscolhido();
      if (!funil) {
        return;
      }
      untracked(() => {
        const etapa = this.etapaId();
        if (!funil.etapas.some((e) => e.id === etapa && e.tipo !== 'PERDIDO')) {
          this.etapaId.set(funil.etapas.find((e) => e.tipo === 'ABERTA')?.id ?? null);
        }
        this.limparEtapasDaTabela(funil);
      });
    });
  }

  // --- Navegação -------------------------------------------------------------------------------

  protected irPara(id: IdDoPasso): void {
    if (this.enviando()) {
      return;
    }
    this.erroGeral.set(null);
    this.passoAtual.set(id);
    this.aoEntrarNoPasso(id);
    this.focarTitulo();
  }

  protected voltar(): void {
    const i = this.indice();
    if (i > 0) {
      this.irPara(this.passos()[i - 1].id);
    }
  }

  protected async avancar(): Promise<void> {
    this.erroGeral.set(null);
    const passo = this.passoAtual();
    if (passo === 'comecar') {
      this.irPara(this.passos()[this.indice() + 1].id);
      return;
    }
    if (passo === 'conexao') {
      if (!this.conexaoFacebook()) {
        this.erroGeral.set('Escolha uma conexão com o Facebook, ou crie uma nova.');
        return;
      }
      this.irPara('acao');
      return;
    }
    if (passo === 'acao') {
      if (!this.validarAcao()) {
        return;
      }
      // O Facebook só cria a integração depois de escolher página e formulário.
      if (this.ehFacebook() && !this.atual()) {
        this.irPara('endereco');
        return;
      }
      if (await this.gravarAcao()) {
        this.irPara('endereco');
      }
      return;
    }
    if (passo === 'endereco') {
      if (this.ehFacebook()) {
        if (!(await this.gravarFacebook())) {
          return;
        }
      } else if (this.escolheFormulario() && !(await this.gravarFormulario())) {
        return;
      }
      this.irPara(this.passos()[this.indice() + 1].id);
      return;
    }
    if (passo === 'eventos') {
      this.irPara('mapeamento');
      return;
    }
    if (passo === 'mapeamento') {
      const problema = this.problemaDoMapeamento();
      if (problema) {
        this.erroGeral.set(problema);
        return;
      }
      this.irPara('configuracoes');
      return;
    }
    if (passo === 'configuracoes') {
      const problema = this.problemaDasConfiguracoes();
      if (problema) {
        this.erroGeral.set(problema);
        return;
      }
      this.irPara('salvar');
      return;
    }
    await this.salvar();
  }

  protected fechar(): void {
    this.aberto.set(false);
  }

  protected async recarregarApoio(): Promise<void> {
    await this.carregarApoio(true);
  }

  protected rotuloAvancar(): string {
    switch (this.passoAtual()) {
      case 'comecar':
        return this.editando() ? 'Continuar' : 'Começar';
      case 'acao':
        return this.atual() || this.ehFacebook() ? 'Continuar' : 'Criar e continuar';
      case 'endereco':
        return this.ehFacebook() && !this.atual() ? 'Criar e continuar' : 'Continuar';
      case 'salvar':
        return this.editando() ? 'Salvar alterações' : 'Salvar e ativar';
      default:
        return 'Continuar';
    }
  }

  // --- Ação e nome -----------------------------------------------------------------------------

  protected definirCredencial(chave: string, valor: ValorCampoTexto): void {
    this.credencial.update((atual) => ({ ...atual, [chave]: String(valor ?? '') }));
    this.testeDaCredencial.set(null);
  }

  protected valorDaCredencial(chave: string): string {
    return this.credencial()[chave] ?? '';
  }

  /** Placeholder do campo secreto já salvo: "••••1234 (deixe em branco para manter)". */
  protected dicaDaCredencial(chave: string, descricao: string): string {
    const salvo = this.integracao()?.credencial.campos.find((c) => c.chave === chave);
    return salvo?.secreto && salvo.valor
      ? `${descricao} Salva: ${salvo.valor}. Deixe em branco para manter.`
      : descricao;
  }

  protected async testarCredencial(): Promise<void> {
    const app = this.app();
    if (!app?.credencial) {
      return;
    }
    const digitada = this.credencialDigitada();
    const completa = app.credencial.every((c) => !!digitada[c.chave]);
    if (!completa && !this.atual()) {
      this.erroGeral.set('Preencha a credencial para testar.');
      return;
    }
    this.testando.set(true);
    this.testeDaCredencial.set(null);
    try {
      const resultado = completa
        ? await this.api.testarCredencialNova(app.aplicativo, digitada)
        : await this.api.testarCredencial((this.atual() as WebhookEntrada).id);
      this.testeDaCredencial.set(resultado);
      if (!completa) {
        void this.atualizarSituacao();
      }
    } catch (falha) {
      this.testeDaCredencial.set({ valida: false, mensagem: erroDaApi(falha).resumo });
    } finally {
      this.testando.set(false);
    }
  }

  private credencialDigitada(): Record<string, string> {
    const digitada: Record<string, string> = {};
    for (const [chave, valor] of Object.entries(this.credencial())) {
      if (valor.trim()) {
        digitada[chave] = valor.trim();
      }
    }
    return digitada;
  }

  private async atualizarSituacao(): Promise<void> {
    const atual = this.atual();
    if (!atual) {
      return;
    }
    try {
      this.atual.set(await this.api.obterEntrada(atual.id));
      this.houveMudanca = true;
    } catch {
      // A situação é só informativa aqui.
    }
  }

  private validarAcao(): boolean {
    this.tocou.set(true);
    const nome = this.nome().trim();
    if (!nome || nome.length > 100) {
      this.focarPrimeiroInvalido();
      return false;
    }
    const digitada = this.credencialDigitada();
    const faltando = this.credenciais().filter(
      (c) => c.obrigatorio && !digitada[c.chave] && !this.credencialSalva(c.chave),
    );
    if (faltando.length) {
      this.erroGeral.set(`Preencha: ${faltando.map((c) => c.rotulo).join(', ')}.`);
      this.focarPrimeiroInvalido();
      return false;
    }
    if (
      !this.atual() &&
      this.seguranca() === 'INFORMAR' &&
      (this.segredoInformado().length < TAMANHO_MINIMO_SEGREDO ||
        this.segredoInformado().length > TAMANHO_MAXIMO_SEGREDO)
    ) {
      this.erroGeral.set('O segredo precisa ter de 16 a 200 caracteres.');
      return false;
    }
    return true;
  }

  protected valorSalvo(chave: string): string {
    return (
      this.integracao()?.credencial.campos.find((c) => c.chave === chave && !c.secreto)?.valor ?? ''
    );
  }

  protected credencialSalva(chave: string): boolean {
    return !!this.integracao()?.credencial.campos.find((c) => c.chave === chave && c.valor);
  }

  /** Cria a integração (inativa) ou grava o que mudou neste passo. */
  private async gravarAcao(): Promise<boolean> {
    const app = this.app();
    if (!app) {
      return false;
    }
    const digitada = this.credencialDigitada();
    this.enviando.set(true);
    try {
      const atual = this.atual();
      if (!atual) {
        await this.criarInativa({
          ...(Object.keys(digitada).length ? { credencial: digitada } : {}),
          ...(this.ehRd() && this.cabecalhoDeAutenticacao().trim()
            ? { configuracao: { cabecalhoDeAutenticacao: this.cabecalhoDeAutenticacao().trim() } }
            : {}),
          ...(this.seguranca() === 'GERAR' ? { gerarSegredo: true } : {}),
          ...(this.seguranca() === 'INFORMAR' ? { segredo: this.segredoInformado().trim() } : {}),
        });
      } else {
        const atualizado = await this.api.atualizarEntrada(atual.id, {
          nome: this.nome().trim(),
          alvo: this.alvo(),
          modo: this.modo(),
          ...(Object.keys(digitada).length ? { credencial: digitada } : {}),
        });
        this.atual.set(atualizado);
        this.houveMudanca = true;
      }
      this.credencial.set({});
      return true;
    } catch (falha) {
      this.tratarErro(erroDaApi(falha), 'acao');
      return false;
    } finally {
      this.enviando.set(false);
    }
  }

  /** Cria a integração inativa (o "Salvar" do fim é que a ativa) e guarda o que só vem agora. */
  private async criarInativa(extra: Partial<DadosWebhookEntrada>): Promise<void> {
    const app = this.app();
    if (!app) {
      return;
    }
    const criado = await this.api.criarEntrada({
      ...this.dadosBase(),
      aplicativo: app.aplicativo,
      ativo: false,
      ...extra,
    });
    this.atual.set(criado.webhook);
    this.urlCompleta.set(criado.url);
    this.segredoGerado.set(criado.segredo ?? null);
    this.criadaAgora = true;
    this.houveMudanca = true;
    this.criado.emit(criado);
    this.carregarCamposDoModelo();
  }

  // --- Facebook Lead Ads -----------------------------------------------------------------------

  protected escolherConexao(conexao: ConexaoFacebook | null): void {
    if (conexao?.id !== this.conexaoFacebook()?.id) {
      this.paginaFacebook.set(null);
      this.formularioFacebook.set(null);
      this.formularioFacebookEscolhido.set(null);
    }
    this.conexaoFacebook.set(conexao);
    this.erroGeral.set(null);
  }

  protected atualizarConexaoDasPaginas(conexao: ConexaoFacebook): void {
    this.conexaoFacebook.set(conexao);
  }

  /** Cria (inativa) ou ajusta a integração com a conexão, a página e o formulário escolhidos. */
  private async gravarFacebook(): Promise<boolean> {
    const conexao = this.conexaoFacebook();
    const paginaId = this.paginaFacebook();
    const formularioId = this.formularioFacebook();
    if (!conexao || !paginaId || !formularioId) {
      this.tocou.set(true);
      this.erroGeral.set('Escolha a página e o formulário de leads.');
      return false;
    }
    const configuracao = { conexaoId: conexao.id, paginaId, formularioId };
    this.enviando.set(true);
    try {
      const atual = this.atual();
      if (!atual) {
        await this.criarInativa({ configuracao });
      } else {
        const antiga = atual.configuracao;
        const mudou =
          antiga.conexaoId !== conexao.id ||
          antiga.paginaId !== paginaId ||
          antiga.formularioId !== formularioId;
        if (mudou) {
          this.atual.set(await this.api.atualizarEntrada(atual.id, { configuracao }));
          this.houveMudanca = true;
        }
      }
      this.chaveDasPerguntas = '';
      return true;
    } catch (falha) {
      this.tratarErro(erroDaApi(falha), 'endereco');
      return false;
    } finally {
      this.enviando.set(false);
    }
  }

  /** Editar: a conexão da integração, para o passo da página e do formulário. */
  private async carregarConexaoDaIntegracao(id: string | undefined): Promise<void> {
    if (!id || this.conexaoFacebook()) {
      return;
    }
    try {
      const conexao = (await this.apiFacebook.conexoes()).find((c) => c.id === id) ?? null;
      if (!this.conexaoFacebook()) {
        this.conexaoFacebook.set(conexao);
      }
    } catch {
      // O passo "Conexão" mostra o erro, com "Tentar de novo".
    }
  }

  /** Busca as perguntas do formulário escolhido (uma vez por formulário) para o mapeamento. */
  private async buscarPerguntas(): Promise<void> {
    const chave = `${this.paginaFacebook()}/${this.formularioFacebook()}`;
    if (!this.atual() || this.chaveDasPerguntas === chave) {
      return;
    }
    this.chaveDasPerguntas = chave;
    this.linhas.update((lista) => lista.filter((l) => l.origem !== 'buscado'));
    await this.buscarCampos();
  }

  // --- Plataformas de curso --------------------------------------------------------------------

  private resumoDosEventos(): string {
    const tabela = this.tabelaDeEventos();
    if (!this.ehCurso()) {
      return '—';
    }
    const contagem = new Map<string, number>();
    for (const regra of Object.values(tabela)) {
      if (regra.acao !== 'IGNORAR') {
        const rotulo = ROTULO_ACAO_DO_EVENTO[regra.acao];
        contagem.set(rotulo, (contagem.get(rotulo) ?? 0) + 1);
      }
    }
    const partes = [...contagem].map(
      ([rotulo, total]) => `${total} × ${rotulo.toLocaleLowerCase('pt-BR')}`,
    );
    return partes.length ? partes.join(', ') : 'todos ignorados';
  }

  /** Mudar o funil zera as etapas escolhidas na tabela: elas eram do funil anterior. */
  private limparEtapasDaTabela(funil: FunilDoDestino): void {
    const tabela = this.tabelaDeEventos();
    if (!tabela) {
      return;
    }
    const abertas = new Set(funil.etapas.filter((e) => e.tipo === 'ABERTA').map((e) => e.id));
    if (!Object.values(tabela).some((r) => r.etapaId && !abertas.has(r.etapaId))) {
      return;
    }
    this.tabelaDeEventos.set(
      Object.fromEntries(
        Object.entries(tabela).map(([codigo, regra]) => [
          codigo,
          regra.etapaId && !abertas.has(regra.etapaId) ? { ...regra, etapaId: null } : regra,
        ]),
      ),
    );
  }

  /** A chave que a plataforma gerou (Hottok, token do webhook…), colada depois do endereço. */
  protected async salvarSegredoDaPlataforma(): Promise<void> {
    const atual = this.atual();
    const segredo = this.segredoNovo().trim();
    if (!atual) {
      return;
    }
    if (segredo.length < TAMANHO_MINIMO_SEGREDO || segredo.length > TAMANHO_MAXIMO_SEGREDO) {
      this.erroDoSegredo.set('A chave precisa ter de 16 a 200 caracteres.');
      return;
    }
    this.salvandoSegredo.set(true);
    this.erroDoSegredo.set(null);
    try {
      const resposta = await this.api.definirSegredo(atual.id, segredo);
      this.atual.set(resposta.webhook);
      this.segredoNovo.set('');
      this.houveMudanca = true;
      this.avisos.sucesso(`${this.rotuloDoSegredo()} guardado.`);
    } catch (falha) {
      this.erroDoSegredo.set(erroDaApi(falha).resumo);
    } finally {
      this.salvandoSegredo.set(false);
    }
  }

  protected async removerSegredoDaPlataforma(): Promise<void> {
    const atual = this.atual();
    if (!atual) {
      return;
    }
    this.salvandoSegredo.set(true);
    this.erroDoSegredo.set(null);
    try {
      this.atual.set(await this.api.removerSegredo(atual.id));
      this.houveMudanca = true;
      this.avisos.sucesso('A integração deixou de conferir a chave.');
    } catch (falha) {
      this.erroDoSegredo.set(erroDaApi(falha).resumo);
    } finally {
      this.salvandoSegredo.set(false);
    }
  }

  // --- Endereço e formulário -------------------------------------------------------------------

  protected async gerarNovoEndereco(): Promise<void> {
    const atual = this.atual();
    if (!atual) {
      return;
    }
    const caixa: { novo?: { webhook: WebhookEntrada; url: string } } = {};
    const ok = await this.confirmacao.confirmar({
      titulo: `Gerar um novo endereço para “${atual.nome}”?`,
      mensagem:
        'O endereço atual para de funcionar na hora (responde 404). Depois de gerar, atualize a ferramenta que envia com o endereço novo.',
      confirmar: 'Gerar novo endereço',
      perigo: true,
      executar: async () => {
        caixa.novo = await this.api.regenerarToken(atual.id);
      },
    });
    if (ok && caixa.novo) {
      this.atual.set(caixa.novo.webhook);
      this.urlCompleta.set(caixa.novo.url);
      this.erroEndereco.set(null);
      this.houveMudanca = true;
      this.avisos.sucesso('Endereço novo gerado.');
    }
  }

  protected async carregarEndereco(): Promise<void> {
    const atual = this.atual();
    if (!atual || this.urlCompleta() || !atual.enderecoDisponivel) {
      return;
    }
    this.carregandoEndereco.set(true);
    this.erroEndereco.set(null);
    try {
      this.urlCompleta.set(await this.api.endereco(atual.id));
    } catch (falha) {
      this.erroEndereco.set(erroDaApi(falha));
    } finally {
      this.carregandoEndereco.set(false);
    }
  }

  protected async carregarFormularios(): Promise<void> {
    const atual = this.atual();
    if (!atual) {
      return;
    }
    this.carregandoFormularios.set(true);
    this.erroFormularios.set(null);
    try {
      this.formularios.set(await this.api.formularios(atual.id));
    } catch (falha) {
      this.erroFormularios.set(erroDaApi(falha));
    } finally {
      this.carregandoFormularios.set(false);
    }
  }

  private async gravarFormulario(): Promise<boolean> {
    const atual = this.atual();
    const formulario = this.formularioId();
    if (!atual) {
      return false;
    }
    if (!formulario) {
      this.erroGeral.set('Escolha o formulário que vai enviar as respostas.');
      return false;
    }
    if (
      atual.configuracao.formularioId === formulario &&
      atual.configuracao.webhookRegistrado &&
      !atual.configuracao.webhookErro
    ) {
      return true;
    }
    this.enviando.set(true);
    try {
      const atualizado = await this.api.atualizarEntrada(atual.id, {
        configuracao: { formularioId: formulario },
      });
      this.atual.set(atualizado);
      this.houveMudanca = true;
      if (atualizado.configuracao.webhookErro) {
        this.erroGeral.set(
          `O CRM não conseguiu registrar o webhook no Typeform: ${atualizado.configuracao.webhookErro}`,
        );
        return false;
      }
      return true;
    } catch (falha) {
      this.tratarErro(erroDaApi(falha), 'endereco');
      return false;
    } finally {
      this.enviando.set(false);
    }
  }

  // --- Mapeamento ------------------------------------------------------------------------------

  protected escolherModelo(modelo: ModeloMapeamento | null): void {
    if (!modelo) {
      return;
    }
    this.modeloEscolhido.set(modelo);
    this.restaurarModelo();
  }

  /** Volta às regras do modelo (os campos recebidos e buscados continuam na lista). */
  protected restaurarModelo(): void {
    const modelo = this.modeloAtual();
    const mantidas = this.linhas().filter((l) => l.origem === 'recebido' || l.origem === 'buscado');
    const doModelo = (modelo?.mapeamento.campos ?? []).map((regra) =>
      this.novaLinha(regra.caminho, regra.destino, 'modelo'),
    );
    const vistos = new Set(doModelo.map((l) => l.caminho));
    this.linhas.set([
      ...doModelo,
      ...mantidas
        .filter((l) => !vistos.has(l.caminho))
        .map((l) => ({ ...l, destino: null, chave: '' })),
    ]);
    this.condicoes.set(
      (modelo?.mapeamento.ignorarQuando ?? []).map((c) => ({
        id: this.proximaLinha++,
        caminho: c.caminho,
        valor: String(c.valor),
      })),
    );
    this.modificado.set(false);
    this.previa.set(null);
    this.sincronizarExemplo();
    void this.mesclarRecebidos(false);
  }

  protected editarLinha(
    id: number,
    mudanca: Partial<Pick<LinhaDoMapa, 'caminho' | 'destino' | 'chave'>>,
  ): void {
    this.linhas.update((lista) => lista.map((l) => (l.id === id ? { ...l, ...mudanca } : l)));
    this.modificado.set(true);
    this.previa.set(null);
  }

  protected definirDestino(id: number, destino: string | null): void {
    this.editarLinha(id, {
      destino,
      ...(destino === DESTINO_DO_CONTATO || destino === DESTINO_DO_NEGOCIO ? {} : { chave: '' }),
    });
  }

  protected adicionarCampo(): void {
    const linha = this.novaLinha('', null, 'adicionado');
    this.linhas.update((lista) => [linha, ...lista]);
    this.modificado.set(true);
    setTimeout(() =>
      this.elemento.nativeElement
        .querySelector<HTMLElement>(`[data-linha="${linha.id}"] input`)
        ?.focus(),
    );
  }

  protected removerLinha(id: number): void {
    this.linhas.update((lista) => lista.filter((l) => l.id !== id));
    this.modificado.set(true);
    this.previa.set(null);
  }

  protected adicionarCondicao(): void {
    this.condicoes.update((lista) => [
      ...lista,
      { id: this.proximaLinha++, caminho: '', valor: '' },
    ]);
    this.modificado.set(true);
  }

  protected editarCondicao(id: number, mudanca: Partial<CondicaoEditavel>): void {
    this.condicoes.update((lista) => lista.map((c) => (c.id === id ? { ...c, ...mudanca } : c)));
    this.modificado.set(true);
  }

  protected removerCondicao(id: number): void {
    this.condicoes.update((lista) => lista.filter((c) => c.id !== id));
    this.modificado.set(true);
  }

  /** "Atualizar campos recebidos": os caminhos dos últimos recebimentos, com um exemplo de valor. */
  protected async atualizarRecebidos(): Promise<void> {
    this.atualizandoRecebidos.set(true);
    try {
      await this.mesclarRecebidos(true);
    } finally {
      this.atualizandoRecebidos.set(false);
    }
  }

  /** "Buscar campos da integração": os campos da conta na ferramenta (credencial salva). */
  protected async buscarCampos(): Promise<void> {
    const atual = this.atual();
    if (!atual) {
      return;
    }
    this.buscandoCampos.set(true);
    this.avisoDosCampos.set(null);
    try {
      const resposta = await this.api.buscarCampos(atual.id);
      this.mesclarBuscados(resposta.campos);
      const total = resposta.campos.length;
      this.avisoDosCampos.set(
        this.ehFacebook()
          ? total
            ? `${total} perguntas e dados do lead buscados no formulário.`
            : 'O Facebook não devolveu nenhuma pergunta deste formulário.'
          : total
            ? `${total} campos buscados na ferramenta.`
            : 'A ferramenta não devolveu nenhum campo.',
      );
    } catch (falha) {
      const erro = erroDaApi(falha);
      this.avisoDosCampos.set(`Não conseguimos buscar os campos: ${erro.resumo}`);
      void this.atualizarSituacao();
    } finally {
      this.buscandoCampos.set(false);
    }
  }

  /** Prévia do mapeamento sobre o corpo de exemplo (nada é gravado). */
  protected async verPrevia(): Promise<void> {
    const exemplo = lerExemplo(this.exemplo());
    if ('erro' in exemplo) {
      this.erroExemplo.set(exemplo.erro);
      this.previa.set(null);
      return;
    }
    this.erroExemplo.set(null);
    const problema = this.problemaDoMapeamento();
    if (problema) {
      this.erroGeral.set(problema);
      return;
    }
    this.erroGeral.set(null);
    this.carregandoPrevia.set(true);
    try {
      this.previa.set(
        await this.api.previa({
          aplicativo: this.app()?.aplicativo,
          modo: this.modo(),
          ...this.dadosDoMapeamento(),
          etiquetasFixas: separarEtiquetas(this.etiquetas()),
          exemplo: exemplo.valor,
        }),
      );
    } catch (falha) {
      const erro = erroDaApi(falha);
      this.previa.set(null);
      if (erro.ehDadosInvalidos || erro.ehRegraViolada) {
        this.erroGeral.set(erro.resumo);
      } else {
        this.avisos.erro(erro);
      }
    } finally {
      this.carregandoPrevia.set(false);
    }
  }

  protected rotuloDestino(destino: string): string {
    return rotuloDoDestino(destino);
  }

  private modeloAtual(): { mapeamento: Mapeamento } | null {
    const app = this.app();
    if (app?.aplicativo === 'WEBHOOK') {
      return this.modelosDoWebhook().find((m) => m.modelo === this.modeloEscolhido()) ?? null;
    }
    return app?.modelo ?? null;
  }

  private novaLinha(
    caminho: string,
    destinoDaApi: string | null,
    origem: LinhaDoMapa['origem'],
    extras: Partial<Pick<LinhaDoMapa, 'exemplo' | 'rotulo'>> = {},
  ): LinhaDoMapa {
    const separado = destinoDaApi ? separarDestino(destinoDaApi) : { destino: null, chave: '' };
    return {
      id: this.proximaLinha++,
      caminho,
      destino: separado.destino,
      chave: separado.chave,
      origem,
      exemplo: extras.exemplo ?? null,
      rotulo: extras.rotulo ?? null,
    };
  }

  private carregarCamposDoModelo(): void {
    if (this.linhas().length === 0 && !this.modificado()) {
      this.restaurarModelo();
    }
  }

  private async mesclarRecebidos(avisar: boolean): Promise<void> {
    const atual = this.atual();
    if (!atual) {
      return;
    }
    try {
      const resposta = await this.api.camposRecebidos(atual.id);
      this.linhas.update((lista) => {
        const novas = [...lista];
        for (const campo of resposta.campos) {
          const i = novas.findIndex((l) => l.caminho === campo.caminho);
          if (i >= 0) {
            novas[i] = { ...novas[i], exemplo: campo.exemplo ?? '' };
          } else {
            novas.push(
              this.novaLinha(campo.caminho, null, 'recebido', { exemplo: campo.exemplo ?? '' }),
            );
          }
        }
        return novas;
      });
      if (avisar) {
        this.avisoDosCampos.set(
          resposta.campos.length
            ? `${resposta.campos.length} campos nos últimos ${resposta.recebimentosLidos} recebimentos.`
            : 'Ainda não chegou nenhum envio. Mande um teste pela ferramenta e atualize de novo.',
        );
      }
    } catch (falha) {
      if (avisar) {
        this.avisoDosCampos.set(
          `Não conseguimos ler os campos recebidos: ${erroDaApi(falha).resumo}`,
        );
      }
    }
  }

  private mesclarBuscados(campos: readonly CampoDeIntegracao[]): void {
    this.linhas.update((lista) => {
      const novas = [...lista];
      for (const campo of campos) {
        const i = novas.findIndex((l) => l.caminho === campo.caminho);
        if (i >= 0) {
          novas[i] = { ...novas[i], rotulo: campo.rotulo };
        } else {
          novas.push(this.novaLinha(campo.caminho, null, 'buscado', { rotulo: campo.rotulo }));
        }
      }
      return novas;
    });
  }

  private mapeamentoAtual(): Mapeamento {
    const campos = this.linhas()
      .filter((l) => !!l.destino && l.caminho.trim())
      .map((l) => ({ caminho: l.caminho.trim(), destino: juntarDestino(l) }));
    const ignorarQuando: CondicaoParaIgnorar[] = this.condicoes()
      .filter((c) => c.caminho.trim() && c.valor.trim())
      .map((c) => ({ caminho: c.caminho.trim(), valor: valorDaCondicao(c.valor) }));
    return { campos, ignorarQuando };
  }

  private dadosDoMapeamento(): Pick<DadosWebhookEntrada, 'modeloMapeamento' | 'mapeamento'> {
    if (this.modificado()) {
      return { modeloMapeamento: 'PERSONALIZADO', mapeamento: this.mapeamentoAtual() };
    }
    return { modeloMapeamento: this.modeloEscolhido() };
  }

  /** O que a API recusaria (R8.1): toda integração precisa de e-mail ou telefone, e criar, de nome. */
  private problemaDoMapeamento(): string | null {
    if (!this.modificado()) {
      return null;
    }
    const incompleta = this.linhas().find(
      (l) =>
        !!l.destino &&
        (!l.caminho.trim() ||
          ((l.destino === DESTINO_DO_CONTATO || l.destino === DESTINO_DO_NEGOCIO) &&
            !l.chave.trim())),
    );
    if (incompleta) {
      return incompleta.caminho.trim()
        ? 'Dê um nome ao campo personalizado que você escolheu.'
        : 'Há um campo do CRM sem o campo recebido: preencha ou remova a linha.';
    }
    const destinos = this.mapeamentoAtual().campos.map((c) => c.destino);
    if (!destinos.includes('email') && !destinos.includes('telefone')) {
      return 'O mapeamento precisa de um campo para o E-mail ou o Telefone.';
    }
    if (this.modo() !== 'ATUALIZAR' && !destinos.includes('nome')) {
      return 'O mapeamento precisa de um campo para o Nome do contato.';
    }
    return null;
  }

  private problemaDasConfiguracoes(): string | null {
    if (!this.funilId() || !this.etapaId()) {
      return 'Escolha o funil e a etapa de entrada.';
    }
    if (this.ehFixo() && !this.responsavelId() && !this.ehContato()) {
      return 'Escolha o responsável fixo.';
    }
    if (this.ehCurso() && this.motivoPadraoObrigatorio() && !this.motivoPerda().trim()) {
      return 'Informe o motivo de perda padrão: há eventos de perda na tabela sem motivo próprio.';
    }
    if (!this.ehCurso() && this.ehPerdido() && !this.motivoPerda().trim() && !this.ehContato()) {
      return 'Informe o motivo de perda padrão para negócios que já entram como perdidos.';
    }
    return null;
  }

  // --- Salvar ----------------------------------------------------------------------------------

  private dadosBase(): DadosWebhookEntrada {
    const contato = this.ehContato();
    return {
      nome: this.nome().trim(),
      alvo: this.alvo(),
      modo: this.modo(),
      funilId: this.funilId() ?? '',
      etapaId: this.etapaId() ?? '',
      statusInicial: contato || this.ehCurso() ? 'ABERTO' : this.statusInicial(),
      motivoPerdaPadrao: this.motivoPerda().trim() || null,
      estrategia: this.estrategia(),
      responsavelFixoId: this.ehFixo() ? this.responsavelId() : null,
      modeloMapeamento: this.modeloEscolhido(),
      etiquetasFixas: separarEtiquetas(this.etiquetas()),
    };
  }

  private async salvar(): Promise<void> {
    const atual = this.atual();
    if (!atual) {
      return;
    }
    this.enviando.set(true);
    try {
      const dados: Partial<DadosWebhookEntrada> = {
        ...this.dadosBase(),
        ...this.dadosDoMapeamento(),
        ...(this.ehCurso()
          ? {
              configuracao: {
                eventos: tabelaParaApi(this.tabelaDeEventos()),
                produtos: listaDoTexto(this.produtos()),
              },
            }
          : {}),
        ...(this.editando() ? {} : { ativo: true }),
      };
      const salvo = await this.api.atualizarEntrada(atual.id, dados);
      this.atual.set(salvo);
      this.finalizada = true;
      this.salvo.emit(salvo);
      if (salvo.configuracao.assinaturaErro) {
        this.avisos.atencao(
          `A integração foi salva, mas a Meta recusou a assinatura da página: ${salvo.configuracao.assinaturaErro}`,
        );
      }
      this.avisos.sucesso(
        this.editando()
          ? `Integração “${salvo.nome}” atualizada.`
          : `Integração “${salvo.nome}” criada e ativa.`,
      );
      this.aberto.set(false);
    } catch (falha) {
      this.tratarErro(erroDaApi(falha), 'salvar');
    } finally {
      this.enviando.set(false);
    }
  }

  /** Erro da API: vai para o campo (e o passo) certo, ou para o alerta do passo. */
  private tratarErro(erro: ErroApi, passo: IdDoPasso): void {
    const nome = erro.mensagemDoCampo('nome');
    if (erro.ehConflito || nome) {
      this.erroNome.set(nome ?? erro.resumo);
      this.passoAtual.set('acao');
      this.focarPrimeiroInvalido();
      return;
    }
    if (erro.ehDadosInvalidos || erro.ehRegraViolada) {
      this.erroGeral.set(erro.resumo);
      if (passo === 'salvar') {
        this.passoAtual.set(this.passoDoErro(erro));
      }
      return;
    }
    this.avisos.erro(erro);
  }

  private passoDoErro(erro: ErroApi): IdDoPasso {
    const campos = ['mapeamento', 'modeloMapeamento'].some((c) => erro.mensagemDoCampo(c));
    return campos ? 'mapeamento' : 'configuracoes';
  }

  // --- Abrir e fechar --------------------------------------------------------------------------

  private aoEntrarNoPasso(id: IdDoPasso): void {
    if (id === 'endereco' && !this.ehFacebook()) {
      if (this.escolheFormulario()) {
        void this.carregarFormularios();
      } else {
        void this.carregarEndereco();
      }
    }
    if (id === 'mapeamento' && this.ehFacebook()) {
      if (!this.linhas().length && !this.modificado()) {
        this.restaurarModelo();
      }
      void this.buscarPerguntas();
    } else if (id === 'mapeamento') {
      if (!this.linhas().length && !this.modificado()) {
        this.restaurarModelo();
      } else {
        void this.mesclarRecebidos(false);
      }
      if (
        this.buscaCampos() &&
        this.atual()?.camposBuscados &&
        !this.linhas().some((l) => l.origem === 'buscado')
      ) {
        this.mesclarBuscados(this.atual()?.camposBuscados ?? []);
      }
    }
  }

  private iniciar(): void {
    const app = this.app();
    const integracao = this.integracao();
    const retorno = this.retornoFacebook();
    this.passoAtual.set(app?.aplicativo === 'FACEBOOK_LEAD_ADS' && retorno ? 'conexao' : 'comecar');
    this.erroGeral.set(null);
    this.erroNome.set(null);
    this.erroEndereco.set(null);
    this.tocou.set(false);
    this.previa.set(null);
    this.avisoDosCampos.set(null);
    this.testeDaCredencial.set(null);
    this.criadaAgora = false;
    this.houveMudanca = false;
    this.finalizada = false;
    this.atual.set(integracao);
    this.urlCompleta.set(null);
    this.segredoGerado.set(null);
    this.credencial.set({});
    this.seguranca.set('NENHUMA');
    this.segredoInformado.set('');
    this.cabecalhoDeAutenticacao.set('');
    this.formularios.set([]);
    this.linhas.set([]);
    this.condicoes.set([]);
    this.modificado.set(false);
    this.nome.set(
      integracao?.nome ?? (this.contextoDoLogin()?.nome || (app ? `${app.nome} — ` : '')),
    );
    this.alvo.set(integracao?.alvo ?? 'NEGOCIO');
    this.modo.set(integracao?.modo ?? 'CRIAR_OU_ATUALIZAR');
    this.statusInicial.set(integracao?.statusInicial ?? 'ABERTO');
    this.motivoPerda.set(integracao?.motivoPerdaPadrao ?? '');
    this.etiquetas.set(integracao?.etiquetasFixas.join(', ') ?? '');
    this.estrategia.set(integracao?.estrategia ?? 'RODIZIO');
    this.responsavelId.set(integracao?.responsavelFixo?.id ?? null);
    this.funilId.set(integracao?.funil.id ?? this.funilInicial());
    this.etapaId.set(integracao?.etapa.id ?? null);
    this.formularioId.set(integracao?.configuracao.formularioId ?? null);
    this.conexaoFacebook.set(null);
    this.paginaFacebook.set(integracao?.configuracao.paginaId ?? null);
    this.formularioFacebook.set(integracao?.configuracao.formularioId ?? null);
    this.formularioFacebookEscolhido.set(null);
    this.chaveDasPerguntas = '';
    this.segredoNovo.set('');
    this.erroDoSegredo.set(null);
    this.tabelaDeEventos.set(
      app?.eventos ? tabelaInicial(app.eventos, integracao?.configuracao.eventos) : {},
    );
    this.produtos.set(integracao?.configuracao.produtos?.join(', ') ?? '');
    this.exemplo.set('');
    this.exemploEhDeModelo = true;
    this.modeloEscolhido.set(
      integracao && integracao.modeloMapeamento !== 'PERSONALIZADO'
        ? integracao.modeloMapeamento
        : app?.aplicativo === 'WEBHOOK'
          ? 'GENERICO'
          : 'DO_APLICATIVO',
    );
    if (integracao) {
      this.carregarDaIntegracao(integracao);
      if (integracao.aplicativo === 'FACEBOOK_LEAD_ADS') {
        void this.carregarConexaoDaIntegracao(integracao.configuracao.conexaoId);
      }
    }
    void this.carregarApoio();
  }

  private carregarDaIntegracao(integracao: WebhookEntrada): void {
    this.linhas.set(
      integracao.mapeamento.campos.map((regra) =>
        this.novaLinha(regra.caminho, regra.destino, 'modelo'),
      ),
    );
    this.condicoes.set(
      integracao.mapeamento.ignorarQuando.map((c) => ({
        id: this.proximaLinha++,
        caminho: c.caminho,
        valor: String(c.valor),
      })),
    );
    this.modificado.set(integracao.modeloMapeamento === 'PERSONALIZADO');
    if (integracao.camposBuscados) {
      this.mesclarBuscados(integracao.camposBuscados);
    }
  }

  private aoFechar(): void {
    const atual = this.atual();
    if (!atual) {
      return;
    }
    if (this.criadaAgora && !this.finalizada) {
      this.avisos.info(
        `“${atual.nome}” ficou inativa. Reabra pela lista (Editar) para terminar e ativar.`,
      );
    }
    if (this.houveMudanca && !this.finalizada) {
      this.salvo.emit(atual);
    }
    this.atual.set(null);
  }

  private async carregarApoio(forcar = false): Promise<void> {
    if (!forcar && this.funis().length && (!this.ehWebhook() || this.modelosDoWebhook().length)) {
      this.aplicarPadroes();
      return;
    }
    this.carregandoApoio.set(true);
    this.erroApoio.set(null);
    try {
      const [funis, usuarios, modelos] = await Promise.all([
        this.api.funis(),
        this.api.usuariosAtivos(),
        this.ehWebhook() ? this.api.modelos() : Promise.resolve(null),
      ]);
      this.funis.set(funis);
      this.usuarios.set(usuarios);
      if (modelos) {
        this.modelosDoWebhook.set(modelos.modelos);
      }
      this.aplicarPadroes();
    } catch (falha) {
      this.erroApoio.set(erroDaApi(falha));
    } finally {
      this.carregandoApoio.set(false);
    }
  }

  /** Funil de Marketing (ou o primeiro ativo) e o exemplo do modelo, quando ainda não escolhidos. */
  private aplicarPadroes(): void {
    if (!this.funilId() || !this.funis().some((f) => f.id === this.funilId())) {
      const areaPadrao = this.ehCurso() ? 'COMERCIAL' : 'MARKETING';
      const padrao =
        this.funis().find((f) => f.area === areaPadrao && f.ativo) ??
        this.funis().find((f) => f.ativo);
      this.funilId.set(padrao?.id ?? null);
    }
    if (!this.etapaId()) {
      this.etapaId.set(this.funilEscolhido()?.etapas.find((e) => e.tipo === 'ABERTA')?.id ?? null);
    }
    if (
      this.atual() &&
      !this.linhas().length &&
      !this.modificado() &&
      this.passoAtual() !== 'comecar'
    ) {
      this.restaurarModelo();
    }
    this.sincronizarExemplo();
  }

  private sincronizarExemplo(): void {
    const app = this.app();
    if (!this.exemplo().trim() || this.exemploEhDeModelo) {
      const modelo = this.ehWebhook()
        ? this.modelosDoWebhook().find((m) => m.modelo === this.modeloEscolhido())
        : app?.modelo;
      if (modelo?.exemplo) {
        this.exemplo.set(JSON.stringify(modelo.exemplo, null, 2));
        this.exemploEhDeModelo = true;
      }
    }
  }

  protected editarExemplo(texto: ValorCampoTexto): void {
    this.exemplo.set(String(texto ?? ''));
    this.exemploEhDeModelo = false;
    this.erroExemplo.set(null);
  }

  protected escolherFormulario(id: string | null): void {
    this.formularioId.set(id);
  }

  // --- Foco ------------------------------------------------------------------------------------

  /** Depois que a tela do passo novo for desenhada, o foco vai para o título dele. */
  private focarTitulo(): void {
    afterNextRender(
      () =>
        this.elemento.nativeElement
          .querySelector<HTMLElement>('.assistente__titulo-passo')
          ?.focus(),
      { injector: this.injector },
    );
  }

  private focarPrimeiroInvalido(): void {
    afterNextRender(
      () =>
        this.elemento.nativeElement
          .querySelector<HTMLElement>('.assistente [aria-invalid="true"]')
          ?.focus(),
      { injector: this.injector },
    );
  }
}
