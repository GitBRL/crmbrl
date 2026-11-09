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
import { Router } from '@angular/router';
import {
  LucideHistory,
  LucideKeyRound,
  LucidePencil,
  LucidePower,
  LucideRefreshCw,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';

import { POR_PAGINA_MAXIMO } from '../../nucleo/api/api';
import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { formatarDataHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { type ItemMenuAcoes, MenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { Selo } from '../../ui/selo/selo';
import { AssistenteAplicativo } from './assistente-aplicativo';
import { LogotipoAplicativo } from './comum/logotipo-aplicativo';
import { exemploCurlEntrada } from './exemplos';
import {
  type ContextoDoLogin,
  consumirContextoDoLogin,
  lerRetornoDoFacebook,
  type RetornoDoFacebook,
} from './facebook.tipos';
import {
  lerRetornoDoLogin,
  NOME_DO_SERVICO,
  type RetornoDoLogin,
  type ServicoDeLogin,
} from './login/login.tipos';
import { IntegracoesApi } from './integracoes.api';
import { ModalSegredoEntrada } from './modal-segredo-entrada';
import { ResultadoUnico, type ResultadoUnicoDados } from './resultado-unico';
import {
  type AplicativoDoCatalogo,
  type AplicativoIntegracao,
  type DestinoDeMapeamento,
  fimDoEndereco,
  type FunilDoDestino,
  ROTULO_SITUACAO,
  rotuloDaAcao,
  SELO_SITUACAO,
  type WebhookEntrada,
  type WebhookEntradaCriado,
} from './tipos';

const FILTROS: readonly OpcaoFiltro[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'ATIVA', rotulo: 'Ativas' },
  { id: 'INATIVA', rotulo: 'Inativas' },
  { id: 'PRECISA_ATENCAO', rotulo: 'Precisam de atenção' },
];

interface GrupoDeAplicativo {
  readonly aplicativo: AplicativoIntegracao;
  readonly nome: string;
  readonly integracoes: readonly WebhookEntrada[];
}

/** Sem acento e em minúsculas: a busca não diferencia ("Great" acha "great pages"). */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
}

/**
 * Aplicativos (`/integracoes/aplicativos`, Admin) — Onda H: o catálogo (busca e cartões com o
 * logotipo, em ordem alfabética) e "Suas integrações", agrupadas por aplicativo, com situação,
 * último recebimento e as ações (editar, ativar/desativar, histórico, endereço, segredo e
 * excluir). Escolher um aplicativo abre o assistente; `?funil=<id>` já o abre com o funil
 * escolhido e `?integracao=<id>` abre a edição (link das notificações).
 */
@Component({
  selector: 'app-aplicativos',
  imports: [
    Botao,
    Cartao,
    CampoBusca,
    EstadoVazio,
    Esqueleto,
    FiltrosPilula,
    MenuAcoes,
    Selo,
    LogotipoAplicativo,
    AssistenteAplicativo,
    ModalSegredoEntrada,
    ResultadoUnico,
  ],
  templateUrl: './aplicativos.html',
  styleUrl: './aplicativos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Aplicativos {
  private readonly api = inject(IntegracoesApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly router = inject(Router);

  /** Funil escolhido (query `funil`): filtra a lista e entra pré-escolhido no assistente. */
  readonly funil = input<string | null>(null);
  /** Integração a editar (query `integracao`, link das notificações). */
  readonly integracao = input<string | null>(null);
  /** Retorno do login do Facebook (a API redireciona a `/integracoes?facebook=…&conexao=…`). */
  readonly facebook = input<string | null>(null);
  /** O mesmo para o Typeform e o RD Station (`?typeform=conectado`, `?rd-station=erro`). */
  readonly typeform = input<string | null>(null);
  readonly rdStation = input<string | null>(null, { alias: 'rd-station' });
  readonly conexao = input<string | null>(null);
  readonly motivo = input<string | null>(null);
  readonly mensagem = input<string | null>(null);

  protected readonly filtros = FILTROS;
  protected readonly fimDoEndereco = fimDoEndereco;
  protected readonly rotuloSituacao = ROTULO_SITUACAO;
  protected readonly seloSituacao = SELO_SITUACAO;
  protected readonly iconeLimpar = LucideX;

  // Catálogo
  protected readonly catalogo = signal<readonly AplicativoDoCatalogo[] | null>(null);
  protected readonly destinos = signal<readonly DestinoDeMapeamento[]>([]);
  protected readonly carregandoCatalogo = signal(true);
  protected readonly erroCatalogo = signal<ErroApi | null>(null);
  protected readonly buscaCatalogo = signal('');

  // Suas integrações
  protected readonly integracoes = signal<readonly WebhookEntrada[] | null>(null);
  protected readonly carregandoLista = signal(true);
  protected readonly erroLista = signal<ErroApi | null>(null);
  protected readonly filtro = signal<string | null>('todas');
  protected readonly buscaLista = signal('');
  private readonly funis = signal<readonly FunilDoDestino[]>([]);

  // Assistente e diálogos
  protected readonly assistenteAberto = signal(false);
  protected readonly aplicativoEscolhido = signal<AplicativoDoCatalogo | null>(null);
  protected readonly emEdicao = signal<WebhookEntrada | null>(null);
  protected readonly alvoDoSegredo = signal<WebhookEntrada | null>(null);
  protected readonly resultadoUnico = signal<ResultadoUnicoDados | null>(null);
  protected readonly retornoFacebook = signal<RetornoDoFacebook | null>(null);
  protected readonly retornoConta = signal<RetornoDoLogin | null>(null);
  protected readonly contextoDoLogin = signal<ContextoDoLogin | null>(null);
  private retornoTratado = false;
  private retornoDaContaTratado = false;

  /** Catálogo em ordem alfabética, filtrado pela busca. */
  protected readonly cartoes = computed(() => {
    const busca = normalizar(this.buscaCatalogo().trim());
    return [...(this.catalogo() ?? [])]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .filter((app) => !busca || normalizar(`${app.nome} ${app.descricao}`).includes(busca));
  });

  protected readonly funilDaUrl = computed(
    () => this.funis().find((funil) => funil.id === this.funil()) ?? null,
  );

  protected readonly visiveis = computed(() => {
    const filtro = this.filtro() ?? 'todas';
    const busca = normalizar(this.buscaLista().trim());
    const funilId = this.funil();
    return (this.integracoes() ?? []).filter(
      (item) =>
        (filtro === 'todas' || item.situacao === filtro) &&
        (!funilId || item.funil.id === funilId) &&
        (!busca || normalizar(`${item.nome} ${item.aplicativoNome}`).includes(busca)),
    );
  });

  protected readonly grupos = computed<readonly GrupoDeAplicativo[]>(() => {
    const mapa = new Map<AplicativoIntegracao, WebhookEntrada[]>();
    for (const item of this.visiveis()) {
      mapa.set(item.aplicativo, [...(mapa.get(item.aplicativo) ?? []), item]);
    }
    return [...mapa.entries()]
      .map(([aplicativo, lista]) => ({
        aplicativo,
        nome: lista[0].aplicativoNome,
        integracoes: lista,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  });

  protected readonly total = computed(() => this.integracoes()?.length ?? 0);
  protected readonly comFiltro = computed(
    () => (this.filtro() ?? 'todas') !== 'todas' || !!this.buscaLista().trim() || !!this.funil(),
  );
  protected readonly precisamAtencao = computed(
    () => (this.integracoes() ?? []).filter((item) => item.situacao === 'PRECISA_ATENCAO').length,
  );

  constructor() {
    void this.carregarCatalogo();
    void this.carregarLista();
    void this.carregarFunis();

    // Link das notificações (`?integracao=<id>`): abre a edição dessa integração.
    effect(() => {
      const id = this.integracao();
      const itens = this.integracoes();
      const catalogo = this.catalogo();
      if (id && itens && catalogo) {
        untracked(() => this.abrirPorLink(id, itens, catalogo));
      }
    });

    // Volta do login do Facebook: reabre o assistente no passo da conexão.
    effect(() => {
      const retorno = lerRetornoDoFacebook({
        facebook: this.facebook(),
        conexao: this.conexao(),
        motivo: this.motivo(),
        mensagem: this.mensagem(),
      });
      const itens = this.integracoes();
      const catalogo = this.catalogo();
      if (!retorno) {
        this.retornoTratado = false;
      } else if (itens && catalogo && !this.retornoTratado) {
        this.retornoTratado = true;
        untracked(() => this.abrirRetornoDoFacebook(retorno, itens, catalogo));
      }
    });

    // Volta do login do Typeform ou do RD Station (pop-up bloqueado): reabre no passo da conta.
    effect(() => {
      const servico: ServicoDeLogin | null = this.typeform()
        ? 'typeform'
        : this.rdStation()
          ? 'rd-station'
          : null;
      const retorno = servico
        ? lerRetornoDoLogin({
            app: servico,
            resultado: servico === 'typeform' ? this.typeform() : this.rdStation(),
            conexao: this.conexao(),
            motivo: this.motivo(),
            mensagem: this.mensagem(),
          })
        : null;
      const itens = this.integracoes();
      const catalogo = this.catalogo();
      if (!retorno) {
        this.retornoDaContaTratado = false;
      } else if (itens && catalogo && !this.retornoDaContaTratado) {
        this.retornoDaContaTratado = true;
        untracked(() => this.abrirRetornoDaConta(retorno, itens, catalogo));
      }
    });

    // O retorno só vale para a abertura que ele provocou.
    effect(() => {
      if (!this.assistenteAberto()) {
        untracked(() => {
          this.retornoFacebook.set(null);
          this.retornoConta.set(null);
        });
      }
    });
  }

  // --- Carregamento ----------------------------------------------------------------------------

  protected async carregarCatalogo(): Promise<void> {
    this.carregandoCatalogo.set(true);
    this.erroCatalogo.set(null);
    try {
      const resposta = await this.api.catalogo();
      this.catalogo.set(resposta.aplicativos);
      this.destinos.set(resposta.destinos);
    } catch (falha) {
      this.erroCatalogo.set(erroDaApi(falha));
    } finally {
      this.carregandoCatalogo.set(false);
    }
  }

  protected async carregarLista(): Promise<void> {
    this.carregandoLista.set(true);
    this.erroLista.set(null);
    try {
      const todas: WebhookEntrada[] = [];
      for (let pagina = 1; pagina <= 10; pagina++) {
        const resposta = await this.api.listarEntradas({ pagina, porPagina: POR_PAGINA_MAXIMO });
        todas.push(...resposta.itens);
        if (todas.length >= resposta.total || !resposta.itens.length) {
          break;
        }
      }
      this.integracoes.set(todas);
    } catch (falha) {
      this.erroLista.set(erroDaApi(falha));
    } finally {
      this.carregandoLista.set(false);
    }
  }

  private async carregarFunis(): Promise<void> {
    try {
      this.funis.set(await this.api.funis());
    } catch {
      // Só enfeita o filtro; o assistente carrega os funis por conta própria.
    }
  }

  // --- Catálogo --------------------------------------------------------------------------------

  protected escolher(app: AplicativoDoCatalogo): void {
    if (!app.disponivel) {
      return;
    }
    this.emEdicao.set(null);
    this.retornoFacebook.set(null);
    this.retornoConta.set(null);
    this.contextoDoLogin.set(null);
    this.aplicativoEscolhido.set(app);
    this.assistenteAberto.set(true);
  }

  // --- Lista -----------------------------------------------------------------------------------

  protected acao(item: WebhookEntrada): string {
    return rotuloDaAcao(item.alvo, item.modo);
  }

  protected ultimo(item: WebhookEntrada): string {
    return item.ultimoRecebimentoEm ? formatarTempoRelativo(item.ultimoRecebimentoEm) : 'Nunca';
  }

  protected ultimoCompleto(item: WebhookEntrada): string {
    return item.ultimoRecebimentoEm ? formatarDataHora(item.ultimoRecebimentoEm) : '';
  }

  protected escolherFiltro(id: string | null): void {
    this.filtro.set(id ?? 'todas');
  }

  protected limparFunil(): void {
    void this.router.navigate([], { queryParams: { funil: null }, queryParamsHandling: 'merge' });
  }

  protected acoesDe(item: WebhookEntrada): readonly ItemMenuAcoes[] {
    return [
      { id: 'editar', rotulo: 'Editar', icone: LucidePencil },
      {
        id: item.ativo ? 'desativar' : 'ativar',
        rotulo: item.ativo ? 'Desativar' : 'Ativar',
        icone: LucidePower,
      },
      { id: 'historico', rotulo: 'Ver histórico', icone: LucideHistory },
      { id: 'endereco', rotulo: 'Gerar novo endereço', icone: LucideRefreshCw, separarAntes: true },
      ...(item.aplicativo === 'WEBHOOK' || item.aplicativo === 'RD_STATION'
        ? [
            {
              id: 'segredo',
              rotulo: item.exigeAssinatura ? 'Trocar o segredo' : 'Exigir assinatura',
              icone: LucideKeyRound,
            },
            ...(item.exigeAssinatura
              ? [{ id: 'sem-segredo', rotulo: 'Deixar de exigir assinatura', icone: LucideX }]
              : []),
          ]
        : []),
      { id: 'excluir', rotulo: 'Excluir', icone: LucideTrash2, perigo: true, separarAntes: true },
    ];
  }

  protected agir(acao: string, item: WebhookEntrada): void {
    switch (acao) {
      case 'editar':
        this.editar(item);
        break;
      case 'ativar':
      case 'desativar':
        void this.alternarAtivo(item);
        break;
      case 'historico':
        void this.router.navigate(['/integracoes/historico'], {
          queryParams: { integracao: item.id },
        });
        break;
      case 'endereco':
        void this.gerarNovoEndereco(item);
        break;
      case 'segredo':
        this.alvoDoSegredo.set(item);
        break;
      case 'sem-segredo':
        void this.removerSegredo(item);
        break;
      case 'excluir':
        void this.excluir(item);
        break;
    }
  }

  protected editar(item: WebhookEntrada): void {
    const app = (this.catalogo() ?? []).find((a) => a.aplicativo === item.aplicativo) ?? null;
    if (!app) {
      this.avisos.erro('O catálogo de aplicativos ainda não carregou. Tente de novo em instantes.');
      return;
    }
    this.aplicativoEscolhido.set(app);
    this.emEdicao.set(item);
    this.assistenteAberto.set(true);
  }

  private abrirPorLink(
    id: string,
    itens: readonly WebhookEntrada[],
    catalogo: readonly AplicativoDoCatalogo[],
  ): void {
    const item = itens.find((outro) => outro.id === id);
    const app = item && catalogo.find((a) => a.aplicativo === item.aplicativo);
    void this.router.navigate([], {
      queryParams: { integracao: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (item && app) {
      this.editar(item);
    } else {
      this.avisos.erro('Não encontramos essa integração. Ela pode ter sido excluída.');
    }
  }

  private abrirRetornoDoFacebook(
    retorno: RetornoDoFacebook,
    itens: readonly WebhookEntrada[],
    catalogo: readonly AplicativoDoCatalogo[],
  ): void {
    const contexto = consumirContextoDoLogin();
    void this.router.navigate([], {
      queryParams: { facebook: null, conexao: null, motivo: null, mensagem: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    const app = catalogo.find((a) => a.aplicativo === 'FACEBOOK_LEAD_ADS');
    if (!app?.disponivel) {
      this.avisos.erro('A integração com o Facebook Lead Ads não está disponível agora.');
      return;
    }
    const emEdicao = contexto?.integracaoId
      ? (itens.find((i) => i.id === contexto.integracaoId) ?? null)
      : null;
    this.retornoFacebook.set(retorno);
    this.contextoDoLogin.set(contexto);
    this.emEdicao.set(emEdicao);
    this.aplicativoEscolhido.set(app);
    this.assistenteAberto.set(true);
  }

  private abrirRetornoDaConta(
    retorno: RetornoDoLogin,
    itens: readonly WebhookEntrada[],
    catalogo: readonly AplicativoDoCatalogo[],
  ): void {
    const contexto = consumirContextoDoLogin();
    void this.router.navigate([], {
      queryParams: {
        typeform: null,
        'rd-station': null,
        conexao: null,
        motivo: null,
        mensagem: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    const aplicativo = retorno.app === 'typeform' ? 'TYPEFORM' : 'RD_STATION';
    const app = catalogo.find((a) => a.aplicativo === aplicativo);
    if (!app?.disponivel) {
      this.avisos.erro(
        `A integração com o ${NOME_DO_SERVICO[retorno.app]} não está disponível agora.`,
      );
      return;
    }
    const emEdicao = contexto?.integracaoId
      ? (itens.find((i) => i.id === contexto.integracaoId) ?? null)
      : null;
    this.retornoConta.set(retorno);
    this.contextoDoLogin.set(contexto);
    this.emEdicao.set(emEdicao);
    this.aplicativoEscolhido.set(app);
    this.assistenteAberto.set(true);
  }

  // --- Assistente ------------------------------------------------------------------------------

  protected aoCriar(_criado: WebhookEntradaCriado): void {
    void this.carregarLista();
  }

  protected aoSalvar(salvo: WebhookEntrada): void {
    this.atualizarNaTela(salvo);
  }

  // --- Ações -----------------------------------------------------------------------------------

  protected async alternarAtivo(item: WebhookEntrada): Promise<void> {
    if (item.ativo) {
      const ok = await this.confirmacao.confirmar({
        titulo: `Desativar “${item.nome}”?`,
        mensagem:
          'O endereço passa a responder 410 e nada do que chegar é registrado, até você ativar de novo.',
        confirmar: 'Desativar',
        perigo: true,
        executar: () => this.salvarAtivo(item, false),
      });
      if (ok) {
        this.avisos.sucesso(`“${item.nome}” desativada.`);
      }
      return;
    }
    try {
      await this.salvarAtivo(item, true);
      this.avisos.sucesso(`“${item.nome}” ativada: o endereço volta a receber leads.`);
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  protected async gerarNovoEndereco(item: WebhookEntrada): Promise<void> {
    const caixa: { novo?: { webhook: WebhookEntrada; url: string } } = {};
    const ok = await this.confirmacao.confirmar({
      titulo: `Gerar um novo endereço para “${item.nome}”?`,
      mensagem:
        'O endereço atual para de funcionar na hora (responde 404). Atualize a ferramenta que envia com o endereço novo.',
      confirmar: 'Gerar novo endereço',
      perigo: true,
      executar: async () => {
        caixa.novo = await this.api.regenerarToken(item.id);
      },
    });
    const gerado = caixa.novo;
    if (!ok || !gerado) {
      return;
    }
    this.atualizarNaTela(gerado.webhook);
    this.resultadoUnico.set({
      titulo: 'Endereço novo',
      texto: 'O endereço novo já está valendo. O anterior não funciona mais.',
      valores: [{ rotulo: 'Endereço da integração', valor: gerado.url, oQue: 'Endereço' }],
      exemplo: {
        rotulo: 'Teste com curl',
        codigo: exemploCurlEntrada(gerado.url, undefined, {
          exige: gerado.webhook.exigeAssinatura,
        }),
      },
    });
  }

  protected aoDefinirSegredo(resposta: { webhook: WebhookEntrada; segredo?: string }): void {
    this.atualizarNaTela(resposta.webhook);
    if (resposta.segredo) {
      this.resultadoUnico.set({
        titulo: 'Segredo da assinatura',
        texto:
          'Copie agora e configure na ferramenta que envia: é a única vez que o segredo aparece.',
        valores: [{ rotulo: 'Segredo', valor: resposta.segredo, oQue: 'Segredo' }],
      });
    }
  }

  protected async removerSegredo(item: WebhookEntrada): Promise<void> {
    const caixa: { atualizado?: WebhookEntrada } = {};
    const ok = await this.confirmacao.confirmar({
      titulo: `Deixar de exigir assinatura em “${item.nome}”?`,
      mensagem: 'O segredo é apagado e as chamadas passam a ser aceitas sem assinatura.',
      confirmar: 'Deixar de exigir',
      perigo: true,
      executar: async () => {
        caixa.atualizado = await this.api.removerSegredo(item.id);
      },
    });
    if (ok && caixa.atualizado) {
      this.atualizarNaTela(caixa.atualizado);
      this.avisos.sucesso(`“${item.nome}” não exige mais assinatura.`);
    }
  }

  protected async excluir(item: WebhookEntrada): Promise<void> {
    const ok = await this.confirmacao.confirmar({
      titulo: `Excluir “${item.nome}”?`,
      mensagem:
        'O endereço passa a responder 404 e a integração sai da lista. Os contatos e negócios que ela criou continuam no CRM.',
      confirmar: 'Excluir integração',
      perigo: true,
      exigirTexto: item.nome,
      rotuloTexto: 'Digite o nome da integração para confirmar',
      executar: () => this.api.excluirEntrada(item.id),
    });
    if (!ok) {
      return;
    }
    this.avisos.sucesso(`Integração “${item.nome}” excluída.`);
    void this.carregarLista();
  }

  private async salvarAtivo(item: WebhookEntrada, ativo: boolean): Promise<void> {
    this.atualizarNaTela(await this.api.atualizarEntrada(item.id, { ativo }));
  }

  /** Troca a integração na lista, sem recarregar tudo. */
  private atualizarNaTela(item: WebhookEntrada): void {
    this.integracoes.update((lista) =>
      lista ? lista.map((outra) => (outra.id === item.id ? item : outra)) : lista,
    );
  }
}
