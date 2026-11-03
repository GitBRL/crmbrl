import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import {
  LucideDynamicIcon,
  LucidePhoneIncoming,
  LucidePhoneMissed,
  LucidePhoneOutgoing,
  LucideSlidersHorizontal,
} from '@lucide/angular';

import { erroDaApi, type ErroApi } from '../../../nucleo/api/erro-api';
import { formatarDataHora } from '../../../nucleo/formatos';
import { LigacoesApi } from '../../../nucleo/ligacoes/ligacoes.api';
import { formatarDuracao } from '../../../nucleo/ligacoes/ligacoes.textos';
import type { LigacaoDoHistorico } from '../../../nucleo/ligacoes/ligacoes.tipos';
import { TempoRealService } from '../../../nucleo/tempo-real/tempo-real.service';
import { Botao } from '../../../ui/botao/botao';
import { BotaoIcone } from '../../../ui/botao-icone/botao-icone';
import { CampoBusca } from '../../../ui/campo-busca/campo-busca';
import { CampoData } from '../../../ui/campo-data/campo-data';
import { Dica } from '../../../ui/dica/dica';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../../ui/filtros-pilula/filtros-pilula';
import { Selo } from '../../../ui/selo/selo';
import { Seletor, type OpcaoSeletor } from '../../../ui/seletor/seletor';
import { AbasAtendimento } from '../abas-atendimento';
import { AtendimentoApi } from '../atendimento.api';
import type { Atendente, CanalDoAtendimento, Fila } from '../atendimento.tipos';
import {
  descricaoDaLigacao,
  destacarTermos,
  FILTROS_INICIAIS,
  filtrosLigados,
  paraParametros,
  resultadoDoEstado,
  ROTULO_DIRECAO,
  ROTULO_RESULTADO,
  SITUACOES_DO_FILTRO,
  termosDaBusca,
  VARIANTE_RESULTADO,
  type FiltrosDoHistorico,
  type PeriodoDoHistorico,
} from './historico.logica';
import { marcaDeTempo } from '../painel-ligacao/painel-ligacao.logica';

const POR_PAGINA = 30;

const OPCOES_PERIODO: readonly OpcaoFiltro[] = [
  { id: '7', rotulo: '7 dias' },
  { id: '30', rotulo: '30 dias' },
  { id: '90', rotulo: '90 dias' },
  { id: 'todos', rotulo: 'Tudo' },
  { id: 'outro', rotulo: 'Outro período' },
];

const OPCOES_DIRECAO: readonly OpcaoFiltro[] = [
  { id: 'TODAS', rotulo: 'Todas' },
  { id: 'RECEBIDA', rotulo: 'Recebidas' },
  { id: 'FEITA', rotulo: 'Feitas' },
];

const FALANTE: Readonly<Record<string, string>> = {
  atendente: 'Atendente',
  cliente: 'Cliente',
  participante: 'Participante',
};

/**
 * Aba **Ligações** do Atendimento (Onda E, E4, `/atendimento/ligacoes`): o histórico de todas
 * as ligações que a pessoa pode ver, da mais recente para a mais antiga, com filtros (período,
 * direção, situação, atendente, fila, conta do canal) e busca no texto das transcrições (sem
 * diferenciar acento, maiúscula nem flexão; aceita "frase exata", -palavra e "or"). Cada ligação
 * abre o painel da E3 (player, transcrição, resumo) na rota filha. No celular, uma coluna por vez.
 */
@Component({
  selector: 'app-pagina-ligacoes',
  imports: [
    AbasAtendimento,
    Botao,
    BotaoIcone,
    CampoBusca,
    CampoData,
    Dica,
    Esqueleto,
    EstadoVazio,
    FiltrosPilula,
    LucideDynamicIcon,
    RouterLink,
    RouterOutlet,
    Selo,
    Seletor,
  ],
  templateUrl: './pagina-ligacoes.html',
  styleUrl: './pagina-ligacoes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.ligacoes--aberta]': 'aberta()' },
})
export class PaginaLigacoes {
  private readonly api = inject(LigacoesApi);
  private readonly atendimento = inject(AtendimentoApi);
  private readonly roteador = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly tempoReal = inject(TempoRealService);

  protected readonly icones = {
    recebida: LucidePhoneIncoming,
    feita: LucidePhoneOutgoing,
    perdida: LucidePhoneMissed,
    filtros: LucideSlidersHorizontal,
  };
  protected readonly opcoesPeriodo = OPCOES_PERIODO;
  protected readonly opcoesDirecao = OPCOES_DIRECAO;
  protected readonly rotuloResultado = ROTULO_RESULTADO;
  protected readonly varianteResultado = VARIANTE_RESULTADO;
  protected readonly rotuloDirecao = ROTULO_DIRECAO;
  protected readonly marcaDeTempo = marcaDeTempo;
  protected readonly formatarDuracao = formatarDuracao;
  protected readonly idFiltros = 'ligacoes-filtros';
  protected readonly semAcesso = signal(false);

  protected readonly filtros = signal<FiltrosDoHistorico>(FILTROS_INICIAIS);
  protected readonly filtrosAbertos = signal(false);
  protected readonly ligados = computed(() => filtrosLigados(this.filtros()));
  protected readonly termo = signal('');
  private esperaBusca: ReturnType<typeof setTimeout> | undefined;

  protected readonly situacao = signal<'carregando' | 'pronta' | 'erro'>('carregando');
  protected readonly falha = signal<ErroApi | null>(null);
  protected readonly itens = signal<readonly LigacaoDoHistorico[]>([]);
  protected readonly total = signal<number | null>(null);
  protected readonly cursor = signal<string | null>(null);
  protected readonly carregandoMais = signal(false);
  protected readonly erroMais = signal(false);
  protected readonly selecionadaId = signal<string | null>(null);
  protected readonly aberta = signal(false);

  private readonly atendentes = signal<readonly Atendente[]>([]);
  private readonly filas = signal<readonly Fila[]>([]);
  private readonly canais = signal<readonly CanalDoAtendimento[]>([]);
  private geracao = 0;

  protected readonly opcoesSituacao = SITUACOES_DO_FILTRO.map((item): OpcaoFiltro => ({
    id: item.id,
    rotulo: item.rotulo,
  }));
  protected readonly opcoesAtendente = computed<readonly OpcaoSeletor<string>[]>(() => [
    { valor: 'sem', rotulo: 'Sem atendente (perdidas)' },
    ...this.atendentes().map((a) => ({ valor: a.id, rotulo: a.nome })),
  ]);
  protected readonly opcoesFila = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.filas().map((fila) => ({ valor: fila.id, rotulo: fila.nome })),
  );
  protected readonly opcoesCanal = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.canais().map((canal) => ({ valor: canal.id, rotulo: canal.nome })),
  );
  protected readonly termos = computed(() => termosDaBusca(this.filtros().busca));
  protected readonly buscando = computed(() => this.filtros().busca.trim().length > 0);

  protected readonly linhas = computed(() => {
    const termos = this.termos();
    return this.itens().map((ligacao) => {
      const resultado = resultadoDoEstado(ligacao.estado);
      return {
        ligacao,
        resultado,
        rotulo: descricaoDaLigacao(ligacao),
        icone:
          resultado === 'perdida'
            ? this.icones.perdida
            : ligacao.direcao === 'FEITA'
              ? this.icones.feita
              : this.icones.recebida,
        quando: formatarDataHora(ligacao.iniciadaEm),
        duracao: ligacao.estado === 'ENCERRADA' ? formatarDuracao(ligacao.duracaoSegundos) : null,
        assunto: ligacao.resumo?.conteudo?.assunto ?? null,
        trechos: ligacao.trechosEncontrados.map((trecho) => ({
          marca: marcaDeTempo(trecho.inicio),
          falante: FALANTE[trecho.falante] ?? 'Participante',
          pedacos: destacarTermos(trecho.texto, termos),
        })),
      };
    });
  });

  protected readonly resumoTotal = computed(() => {
    const total = this.total();
    if (total === null) {
      return '';
    }
    return total === 1 ? '1 ligação' : `${total} ligações`;
  });

  constructor() {
    this.carregarApoio();
    void this.carregar();
    const lerSelecao = () =>
      this.selecionadaId.set(this.rota.firstChild?.snapshot.paramMap.get('ligacaoId') ?? null);
    this.roteador.events
      .pipe(takeUntilDestroyed())
      .subscribe((evento) => evento instanceof NavigationEnd && lerSelecao());
    const parar = [
      // Uma ligação terminou (ou foi processada): a lista se atualiza sem piscar.
      this.tempoReal.ouvir('ligacao.encerrada', () => void this.carregar(true)),
      this.tempoReal.aoReconectar(() => void this.carregar(true)),
    ];
    inject(DestroyRef).onDestroy(() => {
      parar.forEach((fn) => fn());
      clearTimeout(this.esperaBusca);
    });
  }

  /** Atendentes, filas e contas para os filtros (se algum falhar, o filtro fica só com "todos"). */
  private carregarApoio(): void {
    const mudo = () => undefined;
    this.atendimento.atendentes().subscribe({ next: (v) => this.atendentes.set(v), error: mudo });
    this.atendimento.filas().subscribe({ next: (v) => this.filas.set(v), error: mudo });
    this.atendimento.canais().subscribe({ next: (v) => this.canais.set(v), error: mudo });
  }

  /** Lê a primeira página com os filtros de agora. `silencioso`: sem trocar a lista por esqueletos. */
  protected async carregar(silencioso = false): Promise<void> {
    const geracao = ++this.geracao;
    if (!silencioso || this.situacao() !== 'pronta') {
      this.situacao.set('carregando');
    }
    this.erroMais.set(false);
    try {
      const pagina = await this.api.listar({
        ...paraParametros(this.filtros()),
        limite: POR_PAGINA,
      });
      if (geracao !== this.geracao) {
        return;
      }
      this.itens.set(pagina.itens);
      this.total.set(pagina.total);
      this.cursor.set(pagina.proximoCursor);
      this.falha.set(null);
      this.semAcesso.set(false);
      this.situacao.set('pronta');
    } catch (erro) {
      if (geracao !== this.geracao) {
        return;
      }
      const falha = erroDaApi(erro);
      if (silencioso && this.situacao() === 'pronta') {
        return;
      }
      this.semAcesso.set(falha?.status === 403);
      this.falha.set(falha);
      this.situacao.set('erro');
    }
  }

  protected async carregarMais(): Promise<void> {
    const cursor = this.cursor();
    if (!cursor || this.carregandoMais()) {
      return;
    }
    const geracao = this.geracao;
    this.carregandoMais.set(true);
    this.erroMais.set(false);
    try {
      const pagina = await this.api.listar({
        ...paraParametros(this.filtros()),
        limite: POR_PAGINA,
        cursor,
      });
      if (geracao !== this.geracao) {
        return;
      }
      const ja = new Set(this.itens().map((i) => i.id));
      this.itens.update((atuais) => [...atuais, ...pagina.itens.filter((i) => !ja.has(i.id))]);
      this.total.set(pagina.total);
      this.cursor.set(pagina.proximoCursor);
    } catch {
      this.erroMais.set(true);
    } finally {
      this.carregandoMais.set(false);
    }
  }

  private mudar(parcial: Partial<FiltrosDoHistorico>): void {
    this.filtros.update((atuais) => ({ ...atuais, ...parcial }));
    void this.carregar();
  }

  protected escolherPeriodo(id: string | null): void {
    const periodo = (id ?? '30') as PeriodoDoHistorico;
    this.mudar({ periodo, ...(periodo === 'outro' ? {} : { de: null, ate: null }) });
  }

  protected escolherDe(valor: string | null): void {
    this.mudar({ de: valor });
  }

  protected escolherAte(valor: string | null): void {
    this.mudar({ ate: valor });
  }

  protected escolherDirecao(id: string | null): void {
    this.mudar({ direcao: id === 'RECEBIDA' || id === 'FEITA' ? id : null });
  }

  protected escolherSituacoes(ids: readonly string[]): void {
    this.mudar({ situacoes: ids });
  }

  protected escolherAtendente(id: string | null): void {
    this.mudar({ atendenteId: id });
  }

  protected escolherFila(id: string | null): void {
    this.mudar({ filaId: id });
  }

  protected escolherCanal(id: string | null): void {
    this.mudar({ canalId: id });
  }

  /** Digitar na busca espera uma pausa; Enter busca já. */
  protected digitar(texto: string): void {
    this.termo.set(texto);
    clearTimeout(this.esperaBusca);
    this.esperaBusca = setTimeout(() => this.aplicarBusca(texto), 450);
  }

  protected aplicarBusca(texto: string): void {
    clearTimeout(this.esperaBusca);
    this.termo.set(texto);
    if (texto.trim() !== this.filtros().busca.trim()) {
      this.mudar({ busca: texto.trim() });
    }
  }

  protected limparTudo(): void {
    clearTimeout(this.esperaBusca);
    this.termo.set('');
    this.filtros.set(FILTROS_INICIAIS);
    void this.carregar();
  }

  protected aoAtivar(): void {
    this.aberta.set(true);
  }

  protected aoDesativar(): void {
    this.aberta.set(false);
  }
}
