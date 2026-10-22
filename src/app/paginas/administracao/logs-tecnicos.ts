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
import { LucideSlidersHorizontal, LucideX } from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { formatarDataHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Botao } from '../../ui/botao/botao';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { CampoData } from '../../ui/campo-data/campo-data';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { PainelLateral } from '../../ui/painel-lateral/painel-lateral';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { BlocoCodigo } from '../integracoes/comum/bloco-codigo';
import { BotaoCopiar } from '../integracoes/comum/botao-copiar';
import { formatarJson } from '../integracoes/comum/copiar';
import { AdministracaoApi, type FiltroLogs } from './administracao.api';
import { fimDoDia, inicioDoDia, problemaDoPeriodo } from './periodo';
import {
  type LogTecnico,
  type LogTecnicoDetalhe,
  type NivelLog,
  type PessoaDoFiltro,
  ROTULO_NIVEL,
  SELO_NIVEL,
} from './tipos';

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'quando', rotulo: 'Quando', largura: '8.5rem' },
  { id: 'nivel', rotulo: 'Nível', largura: '8rem' },
  { id: 'contexto', rotulo: 'Origem', largura: '12rem' },
  { id: 'mensagem', rotulo: 'Mensagem', noCartao: 'titulo' },
  { id: 'http', rotulo: 'Chamada HTTP', largura: '14rem' },
];

const NIVEIS: readonly OpcaoFiltro[] = [
  { id: 'ERRO', rotulo: 'Erros' },
  { id: 'AVISO', rotulo: 'Avisos' },
  { id: 'INFO', rotulo: 'Informações' },
  { id: 'DEBUG', rotulo: 'Depuração' },
];

/** O erro guardado em `dados.erro` (nome, mensagem, código e pilha), se houver. */
interface ErroDoLog {
  readonly nome?: string;
  readonly mensagem?: string;
  readonly codigo?: string;
  readonly pilha?: string;
}

/**
 * Logs técnicos (`/administracao/logs`, Admin) — TELAS-FASE1 §8, R3.6: erros 5xx, avisos e
 * falhas de tarefas, com filtros por nível, período, origem, texto e requisição; selo por
 * nível; "Carregar mais" (cursor) e o detalhe com os dados, a pilha do erro e o id da
 * requisição (que leva à auditoria da mesma requisição).
 */
@Component({
  selector: 'app-logs-tecnicos',
  imports: [
    RouterLink,
    Botao,
    CampoBusca,
    CampoData,
    CampoTexto,
    Cartao,
    EstadoVazio,
    Esqueleto,
    FiltrosPilula,
    PainelLateral,
    Selo,
    Tabela,
    CelulaTabela,
    BlocoCodigo,
    BotaoCopiar,
  ],
  templateUrl: './logs-tecnicos.html',
  styleUrl: './consulta.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsTecnicos {
  private readonly api = inject(AdministracaoApi);
  private readonly router = inject(Router);
  private readonly sessao = inject(SessaoService);

  /** Filtro pelo id da requisição (query `requisicao`, vindo da auditoria). */
  readonly requisicao = input<string | null>(null);
  /** Log aberto no painel (query `log`). */
  readonly log = input<string | null>(null);

  protected readonly colunas = COLUNAS;
  protected readonly niveis = NIVEIS;
  protected readonly iconeLimpar = LucideX;
  protected readonly iconeFiltros = LucideSlidersHorizontal;
  protected readonly rotuloNivel = ROTULO_NIVEL;
  protected readonly seloNivel = SELO_NIVEL;

  // Filtros
  protected readonly niveisMarcados = signal<readonly string[]>([]);
  protected readonly texto = signal('');
  private readonly textoAplicado = signal('');
  protected readonly origem = signal('');
  private readonly origemAplicada = signal('');
  protected readonly de = signal<string | null>(null);
  protected readonly ate = signal<string | null>(null);
  protected readonly requisicaoId = linkedSignal(() => this.requisicao());
  /** No celular, origem e período ficam recolhidos atrás do botão "Filtros". */
  protected readonly filtrosAbertos = signal(false);

  // Dados
  private readonly pessoas = signal<readonly PessoaDoFiltro[]>([]);
  protected readonly itens = signal<readonly LogTecnico[]>([]);
  protected readonly proximoCursor = signal<string | null>(null);
  protected readonly carregando = signal(true);
  protected readonly carregandoMais = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly erroMais = signal<ErroApi | null>(null);
  protected readonly detalhe = signal<LogTecnicoDetalhe | null>(null);
  protected readonly erroDetalhe = signal<ErroApi | null>(null);

  protected readonly podeVerAuditoria = computed(() => this.sessao.permite((p) => p.verAuditoria));
  protected readonly problemaPeriodo = computed(() => problemaDoPeriodo(this.de(), this.ate()));

  private readonly filtro = computed<FiltroLogs>(() => ({
    nivel: this.niveisMarcados() as NivelLog[],
    de: inicioDoDia(this.de()),
    ate: fimDoDia(this.ate()),
    contexto: this.origemAplicada(),
    texto: this.textoAplicado(),
    requisicaoId: this.requisicaoId(),
  }));

  protected readonly temFiltro = computed(
    () =>
      !!(
        this.niveisMarcados().length ||
        this.de() ||
        this.ate() ||
        this.origemAplicada() ||
        this.textoAplicado() ||
        this.requisicaoId()
      ),
  );

  /** Quantos filtros recolhíveis estão ligados (o número no botão "Filtros" do celular). */
  protected readonly quantosFiltros = computed(
    () => [this.origemAplicada(), this.de(), this.ate()].filter(Boolean).length,
  );

  protected readonly contagem = computed(() => {
    const total = this.itens().length;
    if (!total) {
      return '';
    }
    const logs = total === 1 ? '1 registro' : `${total} registros`;
    return this.proximoCursor() ? `Mostrando ${logs} · há mais` : `Mostrando ${logs}`;
  });

  protected readonly painelAberto = computed(() => !!this.log());
  private readonly logDoPainel = computed(
    () => this.detalhe() ?? this.itens().find((item) => item.id === this.log()) ?? null,
  );
  protected readonly tituloPainel = computed(() => {
    const log = this.logDoPainel();
    return log ? ROTULO_NIVEL[log.nivel] : this.erroDetalhe() ? 'Log técnico' : 'Carregando…';
  });
  protected readonly complementoPainel = computed(() => {
    const log = this.logDoPainel();
    return log ? `· ${log.contexto}` : null;
  });
  protected readonly descricaoPainel = computed(() => {
    const log = this.logDoPainel();
    return log ? formatarDataHora(log.criadoEm) : null;
  });
  protected readonly erroDoLog = computed<ErroDoLog | null>(() => {
    const erro = this.detalhe()?.dados?.['erro'];
    return erro && typeof erro === 'object' ? (erro as ErroDoLog) : null;
  });
  protected readonly dadosDoLog = computed(() => {
    const dados = this.detalhe()?.dados;
    if (!dados) {
      return null;
    }
    const { erro: _erro, ...resto } = dados as Record<string, unknown>;
    return Object.keys(resto).length ? formatarJson(resto) : null;
  });
  protected readonly pessoaDoLog = computed(() => {
    const id = this.detalhe()?.usuarioId;
    if (!id) {
      return null;
    }
    return this.pessoas().find((pessoa) => pessoa.id === id)?.nome ?? id;
  });

  private versao = 0;

  constructor() {
    void this.carregarPessoas();

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
      const id = this.log();
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

  protected aplicarOrigem(): void {
    this.origemAplicada.set(this.origem().trim());
  }

  protected aoDigitarOrigem(entrada: string | number | null): void {
    const valor = entrada === null ? '' : String(entrada);
    this.origem.set(valor);
    if (!valor.trim() && this.origemAplicada()) {
      this.origemAplicada.set('');
    }
  }

  protected alternarFiltros(): void {
    this.filtrosAbertos.update((aberto) => !aberto);
  }

  protected limparFiltros(): void {
    this.niveisMarcados.set([]);
    this.texto.set('');
    this.textoAplicado.set('');
    this.origem.set('');
    this.origemAplicada.set('');
    this.de.set(null);
    this.ate.set(null);
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

  async carregar(filtro: FiltroLogs = this.filtro()): Promise<void> {
    const versao = ++this.versao;
    this.carregando.set(true);
    this.erro.set(null);
    this.erroMais.set(null);
    try {
      const resposta = await this.api.logs(filtro);
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
      const resposta = await this.api.logs({ ...this.filtro(), cursor });
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

  protected quando(iso: string): string {
    return formatarTempoRelativo(iso);
  }

  protected dataHora(iso: string): string {
    return formatarDataHora(iso);
  }

  /** "POST /api/v1/negocios/:id/mover · 500 · 120 ms". */
  protected http(log: LogTecnico): string | null {
    if (!log.metodo && !log.rota) {
      return null;
    }
    return [
      [log.metodo, log.rota].filter(Boolean).join(' '),
      log.status !== null ? String(log.status) : null,
      log.duracaoMs !== null ? `${log.duracaoMs} ms` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  // --- Painel --------------------------------------------------------------------------------

  protected abrir(log: LogTecnico): void {
    void this.router.navigate([], { queryParams: { log: log.id }, queryParamsHandling: 'merge' });
  }

  protected fecharPainel(): void {
    if (!this.log()) {
      return;
    }
    void this.router.navigate([], { queryParams: { log: null }, queryParamsHandling: 'merge' });
  }

  private async abrirDetalhe(id: string | null): Promise<void> {
    this.erroDetalhe.set(null);
    this.detalhe.set(null);
    if (!id) {
      return;
    }
    try {
      const detalhe = await this.api.log(id);
      if (this.log() === id) {
        this.detalhe.set(detalhe);
      }
    } catch (falha) {
      if (this.log() === id) {
        this.erroDetalhe.set(erroDaApi(falha));
      }
    }
  }

  private async carregarPessoas(): Promise<void> {
    try {
      this.pessoas.set(await this.api.pessoas());
    } catch {
      // Sem a lista, o detalhe mostra o id do usuário.
    }
  }
}
