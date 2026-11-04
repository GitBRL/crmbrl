import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideSettings,
  LucideSlidersHorizontal,
  LucideSparkles,
  LucideWebhook,
  LucideWorkflow,
  LucideX,
  type LucideIconInput,
  LucideDynamicIcon,
} from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { formatarDataHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { type Area, SLUG_AREA } from '../../nucleo/sessao/perfil';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { CampoData } from '../../ui/campo-data/campo-data';
import { Cartao } from '../../ui/cartao/cartao';
import { Dica } from '../../ui/dica/dica';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { PainelLateral } from '../../ui/painel-lateral/painel-lateral';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { BlocoCodigo } from '../integracoes/comum/bloco-codigo';
import { BotaoCopiar } from '../integracoes/comum/botao-copiar';
import { formatarIp, formatarJson } from '../integracoes/comum/copiar';
import { AdministracaoApi, type FiltroAuditoria } from './administracao.api';
import { IntegracoesApi } from '../integracoes/integracoes.api';
import type { FunilDoDestino } from '../integracoes/tipos';
import { dadosLegiveis, formatarValor, nomesDosDados, type ValorFormatado } from './formatar-valor';
import { fimDoDia, inicioDoDia, problemaDoPeriodo } from './periodo';
import {
  type EventoAuditoria,
  type EventoAuditoriaDetalhe,
  type FiltrosDaAuditoria,
  type PessoaDoFiltro,
  rotuloDaAcao,
  rotuloDaEntidade,
  rotuloDoCampo,
  ROTULO_TIPO_ATOR,
  type TipoAtor,
} from './tipos';

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'quando', rotulo: 'Quando', largura: '8.5rem' },
  { id: 'ator', rotulo: 'Quem', largura: '13rem' },
  { id: 'acao', rotulo: 'Ação', largura: '14rem' },
  { id: 'resumo', rotulo: 'Resumo', noCartao: 'titulo' },
  { id: 'campos', rotulo: 'Campos', alinhar: 'fim', largura: '5.5rem' },
];

const ICONE_ATOR: Readonly<Record<Exclude<TipoAtor, 'USUARIO'>, LucideIconInput>> = {
  SISTEMA: LucideSettings,
  WEBHOOK: LucideWebhook,
  AUTOMACAO: LucideWorkflow,
  IA: LucideSparkles,
};

interface LinhaDoDiff {
  readonly campo: string;
  readonly antes: ValorFormatado;
  readonly depois: ValorFormatado;
}

interface LinkDaEntidade {
  readonly rotulo: string;
  readonly comandos: readonly string[];
  readonly query?: Readonly<Record<string, string>>;
}

interface Relacionado {
  readonly entidade: string;
  readonly id: string;
  readonly nome: string | null;
  readonly link: LinkDaEntidade | null;
}

type ItemRelacionado = EventoAuditoriaDetalhe['relacionados'][number];

/** Ações que apagam o alvo (`webhook_entrada.excluido`): não há tela para abrir depois. */
function apagou(acao: string): boolean {
  return /\.(excluid[oa]|removid[oa])$/.test(acao);
}

/**
 * Auditoria (`/administracao/auditoria`, Admin e C-level) — TELAS-FASE1 §8, R3.4: filtros
 * (período, pessoa, ação, entidade, tipo de ator, texto e id da requisição), a tabela densa
 * com tempo, ator, ação e resumo, "Carregar mais" (cursor) e o painel lateral com o antes e
 * depois de cada campo (`?evento=<id>`).
 */
@Component({
  selector: 'app-auditoria',
  imports: [
    RouterLink,
    LucideDynamicIcon,
    Avatar,
    Botao,
    CampoBusca,
    CampoData,
    Cartao,
    Dica,
    EstadoVazio,
    Esqueleto,
    FiltrosPilula,
    PainelLateral,
    Seletor,
    Selo,
    Tabela,
    CelulaTabela,
    BlocoCodigo,
    BotaoCopiar,
  ],
  templateUrl: './auditoria.html',
  styleUrl: './consulta.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Auditoria {
  private readonly api = inject(AdministracaoApi);
  private readonly apiIntegracoes = inject(IntegracoesApi);
  private readonly router = inject(Router);
  private readonly sessao = inject(SessaoService);

  /** Filtro pelo id da requisição (query `requisicao`, vindo dos logs técnicos). */
  readonly requisicao = input<string | null>(null);
  /** Evento aberto no painel (query `evento`). */
  readonly evento = input<string | null>(null);

  protected readonly colunas = COLUNAS;
  protected readonly iconeLimpar = LucideX;
  protected readonly iconeFiltros = LucideSlidersHorizontal;
  protected readonly rotuloTipoAtor = ROTULO_TIPO_ATOR;

  // Filtros
  protected readonly texto = signal('');
  private readonly textoAplicado = signal('');
  protected readonly de = signal<string | null>(null);
  protected readonly ate = signal<string | null>(null);
  protected readonly usuarioId = signal<string | null>(null);
  protected readonly acao = signal<string | null>(null);
  protected readonly entidade = signal<string | null>(null);
  protected readonly tiposAtor = signal<readonly string[]>([]);
  /** No celular, os filtros além da busca ficam recolhidos atrás do botão "Filtros". */
  protected readonly filtrosAbertos = signal(false);
  protected readonly requisicaoId = linkedSignal(() => this.requisicao());

  // Dados
  protected readonly opcoesDosFiltros = signal<FiltrosDaAuditoria | null>(null);
  private readonly pessoas = signal<readonly PessoaDoFiltro[]>([]);
  private readonly funis = signal<readonly FunilDoDestino[]>([]);
  protected readonly itens = signal<readonly EventoAuditoria[]>([]);
  protected readonly proximoCursor = signal<string | null>(null);
  protected readonly carregando = signal(true);
  protected readonly carregandoMais = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly erroMais = signal<ErroApi | null>(null);

  // Painel
  protected readonly detalhe = signal<EventoAuditoriaDetalhe | null>(null);
  protected readonly erroDetalhe = signal<ErroApi | null>(null);

  protected readonly podeVerLogs = computed(() => this.sessao.permite((p) => p.verLogsTecnicos));
  protected readonly problemaPeriodo = computed(() => problemaDoPeriodo(this.de(), this.ate()));

  protected readonly opcoesPessoa = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.pessoas().map((pessoa) => ({
      valor: pessoa.id,
      rotulo: pessoa.ativo ? pessoa.nome : `${pessoa.nome} (desligado)`,
    })),
  );
  protected readonly opcoesAcao = computed<readonly OpcaoSeletor<string>[]>(() =>
    (this.opcoesDosFiltros()?.acoes ?? [])
      .map((acao) => ({ valor: acao, rotulo: rotuloDaAcao(acao) }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR')),
  );
  protected readonly opcoesEntidade = computed<readonly OpcaoSeletor<string>[]>(() =>
    (this.opcoesDosFiltros()?.entidades ?? [])
      .map((entidade) => ({ valor: entidade, rotulo: rotuloDaEntidade(entidade) }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR')),
  );
  protected readonly opcoesTipoAtor = computed<readonly OpcaoFiltro[]>(() =>
    (this.opcoesDosFiltros()?.tiposAtor ?? (Object.keys(ROTULO_TIPO_ATOR) as TipoAtor[])).map(
      (tipo) => ({ id: tipo, rotulo: ROTULO_TIPO_ATOR[tipo] }),
    ),
  );
  /** Quantos filtros recolhíveis estão ligados (o número no botão "Filtros" do celular). */
  protected readonly quantosFiltros = computed(
    () =>
      [this.de(), this.ate(), this.usuarioId(), this.acao(), this.entidade()].filter(Boolean)
        .length + this.tiposAtor().length,
  );

  private readonly filtro = computed<FiltroAuditoria>(() => ({
    de: inicioDoDia(this.de()),
    ate: fimDoDia(this.ate()),
    usuarioId: this.usuarioId(),
    acao: this.acao() ? [this.acao()!] : [],
    entidade: this.entidade(),
    tipoAtor: this.tiposAtor() as TipoAtor[],
    texto: this.textoAplicado(),
    requisicaoId: this.requisicaoId(),
  }));

  protected readonly temFiltro = computed(
    () =>
      !!(
        this.de() ||
        this.ate() ||
        this.usuarioId() ||
        this.acao() ||
        this.entidade() ||
        this.tiposAtor().length ||
        this.textoAplicado() ||
        this.requisicaoId()
      ),
  );

  protected readonly contagem = computed(() => {
    const total = this.itens().length;
    if (!total) {
      return '';
    }
    const eventos = total === 1 ? '1 evento' : `${total} eventos`;
    return this.proximoCursor() ? `Mostrando ${eventos} · há mais` : `Mostrando ${eventos}`;
  });

  // Painel: título, complemento, diff
  protected readonly painelAberto = computed(() => !!this.evento());
  protected readonly tituloPainel = computed(() => {
    const evento = this.detalhe() ?? this.itens().find((item) => item.id === this.evento());
    return evento ? rotuloDaAcao(evento.acao) : this.erroDetalhe() ? 'Evento' : 'Carregando…';
  });
  protected readonly complementoPainel = computed(() => {
    const evento = this.detalhe() ?? this.itens().find((item) => item.id === this.evento());
    return evento ? `· ${formatarTempoRelativo(evento.criadoEm)}` : null;
  });
  protected readonly descricaoPainel = computed(
    () =>
      (this.detalhe() ?? this.itens().find((item) => item.id === this.evento()))?.resumo ?? null,
  );
  /** Ids que viram nome no diff: pessoas, funis, etapas e os `{ id, nome }` do evento. */
  private readonly nomesConhecidos = computed(() => {
    const nomes = new Map<string, string>();
    for (const pessoa of this.pessoas()) {
      nomes.set(pessoa.id.toLowerCase(), pessoa.nome);
    }
    for (const funil of this.funis()) {
      nomes.set(funil.id.toLowerCase(), funil.nome);
      for (const etapa of funil.etapas) {
        nomes.set(etapa.id.toLowerCase(), etapa.nome);
      }
    }
    return nomesDosDados(this.detalhe()?.dados, nomes);
  });
  protected readonly diff = computed<readonly LinhaDoDiff[]>(() => {
    const nomes = this.nomesConhecidos();
    return (this.detalhe()?.alteracoes ?? []).map((alteracao) => ({
      campo: rotuloDoCampo(alteracao.campo),
      antes: formatarValor(alteracao.antes, nomes),
      depois: formatarValor(alteracao.depois, nomes),
    }));
  });
  /** Outros dados gravados no evento (sem o `alteracoes`, que já está no diff). */
  private readonly restoDosDados = computed(() => {
    const dados = this.detalhe()?.dados;
    if (!dados) {
      return null;
    }
    const { alteracoes: _alteracoes, ...resto } = dados as Record<string, unknown>;
    return Object.keys(resto).length ? resto : null;
  });
  /** Os dados como lista legível ("Quem recebeu: Rafael Mendes (Líder Comercial)"). */
  protected readonly dadosLegiveis = computed(() => {
    const resto = this.restoDosDados();
    return resto ? dadosLegiveis(resto, rotuloDoCampo, this.nomesConhecidos()) : [];
  });
  /** O mesmo, em JSON, para a TI ("Ver dados técnicos"). */
  protected readonly dadosExtras = computed(() => {
    const resto = this.restoDosDados();
    return resto ? formatarJson(resto) : null;
  });
  /** Funil → área, para os links de negócio (`/funis/<área>/<id>`). */
  private readonly areaDoFunil = computed(
    () => new Map<string, Area>(this.funis().map((funil) => [funil.id.toLowerCase(), funil.area])),
  );
  protected readonly linkDaEntidade = computed(() => {
    const evento = this.detalhe();
    return evento?.entidadeId && !apagou(evento.acao)
      ? this.link(evento.entidade, evento.entidadeId, evento.relacionados)
      : null;
  });
  /** "Ligado a": cada item com o nome, quando sabemos, e o link para a tela dele. */
  protected readonly relacionados = computed<readonly Relacionado[]>(() => {
    const evento = this.detalhe();
    if (!evento) {
      return [];
    }
    const nomes = this.nomesConhecidos();
    return evento.relacionados.map((item) => {
      // O próprio alvo do evento já tem o link nos fatos (e, se foi apagado, não tem tela).
      const proprio = item.entidade === evento.entidade && item.id === evento.entidadeId;
      return {
        entidade: rotuloDaEntidade(item.entidade),
        id: item.id,
        nome: nomes.get(item.id.toLowerCase()) ?? null,
        link: proprio ? null : this.link(item.entidade, item.id, evento.relacionados),
      };
    });
  });

  private versao = 0;

  constructor() {
    void this.carregarApoio();

    effect(() => {
      const filtro = this.filtro();
      const problema = this.problemaPeriodo();
      untracked(() => {
        if (!problema) {
          void this.carregar(filtro);
        }
      });
    });

    effect(() => {
      const id = this.evento();
      untracked(() => void this.abrirDetalhe(id));
    });
  }

  // --- Filtros -------------------------------------------------------------------------------

  protected buscar(texto: string): void {
    this.textoAplicado.set(texto.trim());
  }

  protected aoDigitar(texto: string): void {
    this.texto.set(texto);
    if (!texto.trim() && this.textoAplicado()) {
      this.textoAplicado.set('');
    }
  }

  protected alternarFiltros(): void {
    this.filtrosAbertos.update((aberto) => !aberto);
  }

  protected limparFiltros(): void {
    this.texto.set('');
    this.textoAplicado.set('');
    this.de.set(null);
    this.ate.set(null);
    this.usuarioId.set(null);
    this.acao.set(null);
    this.entidade.set(null);
    this.tiposAtor.set([]);
    this.limparRequisicao();
  }

  protected limparRequisicao(): void {
    this.requisicaoId.set(null);
    if (this.requisicao()) {
      void this.router.navigate([], {
        queryParams: { requisicao: null },
        queryParamsHandling: 'merge',
      });
    }
  }

  protected filtrarPorRequisicao(id: string): void {
    this.requisicaoId.set(id);
    this.fecharPainel();
  }

  // --- Lista ---------------------------------------------------------------------------------

  async carregar(filtro: FiltroAuditoria = this.filtro()): Promise<void> {
    const versao = ++this.versao;
    this.carregando.set(true);
    this.erro.set(null);
    this.erroMais.set(null);
    try {
      const resposta = await this.api.auditoria(filtro);
      if (versao === this.versao) {
        this.itens.set(resposta.itens);
        this.proximoCursor.set(resposta.proximoCursor);
      }
    } catch (falha) {
      if (versao === this.versao) {
        this.erro.set(erroDaApi(falha));
      }
    } finally {
      if (versao === this.versao) {
        this.carregando.set(false);
      }
    }
  }

  protected async carregarMais(): Promise<void> {
    const cursor = this.proximoCursor();
    if (!cursor || this.carregandoMais()) {
      return;
    }
    const versao = this.versao;
    this.carregandoMais.set(true);
    this.erroMais.set(null);
    try {
      const resposta = await this.api.auditoria({ ...this.filtro(), cursor });
      if (versao === this.versao) {
        this.itens.update((itens) => [...itens, ...resposta.itens]);
        this.proximoCursor.set(resposta.proximoCursor);
      }
    } catch (falha) {
      this.erroMais.set(erroDaApi(falha));
    } finally {
      this.carregandoMais.set(false);
    }
  }

  protected recarregar(): void {
    void this.carregar();
  }

  protected quando(evento: EventoAuditoria): string {
    return formatarTempoRelativo(evento.criadoEm);
  }

  protected dataHora(iso: string): string {
    return formatarDataHora(iso);
  }

  protected acaoLegivel(acao: string): string {
    return rotuloDaAcao(acao);
  }

  protected ip(ip: string | null): string {
    return formatarIp(ip);
  }

  protected entidadeLegivel(entidade: string): string {
    return rotuloDaEntidade(entidade);
  }

  protected nomeDoAtor(evento: EventoAuditoria): string {
    return evento.atorDescricao ?? ROTULO_TIPO_ATOR[evento.tipoAtor];
  }

  protected iconeDoAtor(tipo: TipoAtor): LucideIconInput | null {
    return tipo === 'USUARIO' ? null : ICONE_ATOR[tipo];
  }

  // --- Painel --------------------------------------------------------------------------------

  protected abrir(evento: EventoAuditoria): void {
    void this.router.navigate([], {
      queryParams: { evento: evento.id },
      queryParamsHandling: 'merge',
    });
  }

  protected fecharPainel(): void {
    if (!this.evento()) {
      return;
    }
    void this.router.navigate([], {
      queryParams: { evento: null },
      queryParamsHandling: 'merge',
    });
  }

  private async abrirDetalhe(id: string | null): Promise<void> {
    this.erroDetalhe.set(null);
    this.detalhe.set(null);
    if (!id) {
      return;
    }
    try {
      const detalhe = await this.api.eventoDaAuditoria(id);
      if (this.evento() === id) {
        this.detalhe.set(detalhe);
      }
    } catch (falha) {
      if (this.evento() === id) {
        this.erroDetalhe.set(erroDaApi(falha));
      }
    }
  }

  private async carregarApoio(): Promise<void> {
    // Os filtros funcionam sem estas listas; se falharem, os seletores ficam vazios.
    const [filtros, pessoas, funis] = await Promise.allSettled([
      this.api.filtrosDaAuditoria(),
      this.api.pessoas(),
      this.apiIntegracoes.funis(),
    ]);
    if (filtros.status === 'fulfilled') {
      this.opcoesDosFiltros.set(filtros.value);
    }
    if (pessoas.status === 'fulfilled') {
      this.pessoas.set(pessoas.value);
    }
    if (funis.status === 'fulfilled') {
      this.funis.set(funis.value);
    }
  }

  /** Para onde o "Abrir" do painel leva, conforme a entidade (e o que o papel vê). */
  private link(
    entidade: string,
    id: string,
    relacionados: readonly ItemRelacionado[],
  ): LinkDaEntidade | null {
    switch (entidade) {
      case 'negocio': {
        // O negócio abre sobre o quadro do funil dele: a área vem do funil relacionado.
        const funilId = relacionados.find((item) => item.entidade === 'funil')?.id;
        const area = funilId ? this.areaDoFunil().get(funilId.toLowerCase()) : undefined;
        return funilId && area
          ? {
              rotulo: 'Abrir o negócio',
              comandos: ['/funis', SLUG_AREA[area], id],
              query: { funil: funilId },
            }
          : null;
      }
      case 'funil': {
        const area = this.areaDoFunil().get(id.toLowerCase());
        return area
          ? { rotulo: 'Abrir o funil', comandos: ['/funis', SLUG_AREA[area]], query: { funil: id } }
          : null;
      }
      case 'contato':
        return { rotulo: 'Abrir o contato', comandos: ['/contatos', id] };
      case 'empresa':
        return { rotulo: 'Abrir a empresa', comandos: ['/empresas', id] };
      case 'atividade':
        return { rotulo: 'Abrir a atividade', comandos: ['/atividades'], query: { atividade: id } };
      case 'webhook_entrada':
        return this.sessao.ehAdmin()
          ? {
              rotulo: 'Abrir a integração',
              comandos: ['/integracoes/aplicativos'],
              query: { integracao: id },
            }
          : null;
      case 'webhook_saida':
        return this.sessao.ehAdmin()
          ? {
              rotulo: 'Abrir o webhook',
              comandos: ['/integracoes/saida'],
              query: { webhookSaida: id },
            }
          : null;
      default:
        return null;
    }
  }
}
