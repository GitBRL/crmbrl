import { formatDate } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  LOCALE_ID,
  effect,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { LucideCheck, LucideShare2, LucideSparkles, LucideX } from '@lucide/angular';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { copiarTexto } from '../../nucleo/copiar';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { PilhaAvatares, type PessoaAvatar } from '../../ui/pilha-avatares/pilha-avatares';
import { gerarId } from '../../ui/tipos';
import { AnaliseIa } from './analise-ia';
import { InicioAtendimento } from './atendimento';
import { DADOS_POR_PERIODO, ehIdPeriodo, PERIODO_PADRAO, PERIODOS } from './dados-exemplo';
import { InicioEquipe } from './equipe';
import { InicioIndicadores } from './indicadores';
import { InicioJornada, type EstadoJornada } from './jornada';
import {
  MetricasJornadaApi,
  montarIndicadores,
  montarJornada,
  PessoasDoCrmApi,
  type MedidasDaJornada,
} from './metricas-jornada';
import { InicioBiApi, type MedidasBi } from './metricas-bi';
import { ProximasAtividades } from './proximas-atividades';
import { fornecerRelogio, RELOGIO } from './relogio';
import { StatusSistema } from './status-sistema';

type Compartilhamento = 'copiado' | 'falhou';

/** Quanto tempo o retorno do "Compartilhar" fica na tela. */
export const DURACAO_RETORNO_MS: Readonly<Record<Compartilhamento, number>> = {
  copiado: 3000,
  falhou: 6000,
};

/**
 * "21/09 a 20/10/2026": os `dias` do período terminando em `fim` (hoje), contando os dois
 * extremos. O ano só aparece no início quando muda.
 */
export function formatarIntervalo(fim: Date, dias: number, locale: string): string {
  const inicio = new Date(fim);
  inicio.setDate(fim.getDate() - (dias - 1));
  const formatoInicio = inicio.getFullYear() === fim.getFullYear() ? 'dd/MM' : 'dd/MM/y';
  return `${formatDate(inicio, formatoInicio, locale)} a ${formatDate(fim, 'dd/MM/y', locale)}`;
}

/**
 * Visão geral (`/inicio`, TELAS-FASE1 §9). Real: a aba "Jornada do cliente" (métricas dos
 * funis, R5.10), os indicadores de leads e taxa de ganho, a pilha de quem usa o CRM, as
 * próximas atividades e o status do sistema. De exemplo (`dados-exemplo.ts`, com o selo), só
 * o que depende de módulos futuros: as abas Atendimento e Equipe (metas), o MRR, o health
 * score e a análise com IA.
 *
 * Estrutura: cabeçalho (título em dois tons à esquerda; à direita o período com as datas, a
 * equipe, compartilhar e a análise com IA, que só o Admin vê) → palco com abas entalhadas
 * (jornada, atendimento — para quem acessa o módulo —, equipe) → indicadores; à direita,
 * próximas atividades e status do sistema. A página fornece um relógio só para os blocos.
 */
@Component({
  selector: 'app-inicio',
  imports: [
    Abas,
    AnaliseIa,
    Botao,
    BotaoIcone,
    InicioAtendimento,
    InicioEquipe,
    InicioIndicadores,
    InicioJornada,
    PilhaAvatares,
    ProximasAtividades,
    StatusSistema,
  ],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [fornecerRelogio()],
})
export class Inicio {
  protected readonly perfil = inject(SessaoService);
  private readonly documento = inject(DOCUMENT);
  private readonly locale = inject(LOCALE_ID);
  private readonly agora = inject(RELOGIO);
  private readonly metricasApi = inject(MetricasJornadaApi);
  private readonly pessoasApi = inject(PessoasDoCrmApi);
  private readonly biApi = inject(InicioBiApi);

  /** "outubro de 2026" — o segundo tom do título. */
  protected readonly mesAtual = formatDate(new Date(), "MMMM 'de' y", this.locale);
  protected readonly icones = { ia: LucideSparkles };

  /** A pilha do cabeçalho: os usuários ativos que a pessoa vê (o membro só vê a si mesmo). */
  protected readonly equipe = signal<readonly PessoaAvatar[]>([]);
  protected readonly rotuloEquipe = computed(() =>
    this.perfil.ehLider() ? 'Sua equipe' : 'Quem usa o CRM',
  );

  protected readonly periodos: readonly ItemAba[] = PERIODOS.map(({ id, rotulo }) => ({
    id,
    rotulo,
  }));
  protected readonly periodo = signal<string | null>(PERIODO_PADRAO);
  protected readonly dados = computed(() => {
    const periodo = this.periodo();
    return DADOS_POR_PERIODO[ehIdPeriodo(periodo) ? periodo : PERIODO_PADRAO];
  });
  /** Métricas reais dos funis no período (R5.10): a jornada e os indicadores reais. */
  protected readonly estadoJornada = signal<EstadoJornada>('carregando');
  protected readonly erroJornada = signal<ErroApi | null>(null);
  private readonly medidas = signal<MedidasDaJornada | null>(null);
  protected readonly jornada = computed(() => {
    const medidas = this.medidas();
    return medidas ? montarJornada(medidas) : null;
  });
  protected readonly indicadoresReais = computed(() => {
    const medidas = this.medidas();
    return medidas ? montarIndicadores(medidas) : null;
  });
  private consultaJornada = 0;

  /** Painéis do BI (atendimento, comercial, financeiro e CS) do mesmo período. */
  protected readonly estadoBi = signal<EstadoJornada>('carregando');
  protected readonly erroBi = signal<ErroApi | null>(null);
  protected readonly bi = signal<MedidasBi | null>(null);
  private consultaBi = 0;
  /** Falha de um painel só (a lista veio): a aba dele mostra o erro. */
  protected readonly estadoBiAtendimento = computed<EstadoJornada>(() =>
    this.estadoDoPainel('atendimento'),
  );
  protected readonly estadoBiComercial = computed<EstadoJornada>(() =>
    this.estadoDoPainel('comercial'),
  );

  /** As datas que o período cobre ("21/09 a 20/10/2026"), ao lado do seletor. */
  protected readonly intervalo = computed(() =>
    formatarIntervalo(this.agora(), this.dados().periodo.dias, this.locale),
  );
  protected readonly idIntervalo = gerarId('periodo-intervalo');

  /** A aba Atendimento só aparece para quem acessa o módulo (o Marketing, não). */
  protected readonly abas = computed<readonly ItemAba[]>(() => {
    // Com a lista de painéis do BI em mãos, ela manda; antes dela, vale o acesso ao módulo.
    const paineis = this.bi()?.paineis;
    const comAtendimento = paineis
      ? paineis.includes('atendimento')
      : this.perfil.pode('atendimento');
    const comEquipe = paineis ? paineis.includes('comercial') : true;
    return [
      { id: 'jornada', rotulo: 'Jornada do cliente' },
      ...(comAtendimento ? [{ id: 'atendimento', rotulo: 'Atendimento' }] : []),
      ...(comEquipe ? [{ id: 'equipe', rotulo: 'Equipe' }] : []),
    ];
  });
  protected readonly aba = signal<string | null>('jornada');
  /** A aba escolhida, ou a Jornada se ela sumiu com a troca de persona. */
  protected readonly abaVisivel = computed(() => {
    const aba = this.aba();
    return this.abas().some((item) => item.id === aba) ? aba : 'jornada';
  });

  protected readonly analiseAberta = signal(false);

  protected readonly compartilhamento = signal<Compartilhamento | null>(null);
  protected readonly iconeCompartilhar = computed(() => {
    switch (this.compartilhamento()) {
      case 'copiado':
        return LucideCheck;
      case 'falhou':
        return LucideX;
      default:
        return LucideShare2;
    }
  });
  protected readonly rotuloCompartilhar = computed(() => {
    switch (this.compartilhamento()) {
      case 'copiado':
        return 'Link copiado';
      case 'falhou':
        return 'Não deu para copiar';
      default:
        return 'Compartilhar';
    }
  });
  /** Retorno visível (e anunciado) do "Compartilhar", logo abaixo das ações. */
  protected readonly avisoCompartilhamento = computed(() => {
    switch (this.compartilhamento()) {
      case 'copiado':
        return 'Link copiado.';
      case 'falhou':
        return 'Não deu para copiar o link. Copie o endereço na barra do navegador.';
      default:
        return '';
    }
  });

  private readonly seletorPeriodo = viewChild.required('seletorPeriodo', { read: ElementRef });
  private esperaAviso: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.esperaAviso));
    // Período novo: as métricas da jornada são buscadas de novo.
    effect(() => {
      const dias = this.dados().periodo.dias;
      untracked(() => {
        void this.carregarJornada(dias);
        void this.carregarBi(dias);
      });
    });
    if (this.perfil.permite((permissoes) => permissoes.verUsuarios !== 'PROPRIOS')) {
      this.pessoasApi
        .listar()
        .then((pessoas) => this.equipe.set(pessoas))
        .catch(() => this.equipe.set([]));
    }
    // As datas descrevem o grupo de opções do período (o radiogroup fica dentro do app-abas).
    afterNextRender(() => {
      const grupo = (this.seletorPeriodo().nativeElement as HTMLElement).querySelector(
        '[role="radiogroup"]',
      );
      grupo?.setAttribute('aria-describedby', this.idIntervalo);
    });
  }

  /**
   * Busca as métricas dos funis visíveis do início do primeiro dia do período (meia-noite
   * local) até agora; o período anterior, de mesmo tamanho, vem junto para as variações.
   */
  protected async carregarJornada(dias = this.dados().periodo.dias): Promise<void> {
    const consulta = ++this.consultaJornada;
    this.estadoJornada.set('carregando');
    this.erroJornada.set(null);
    const ate = new Date();
    const de = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate() - (dias - 1));
    try {
      const medidas = await this.metricasApi.carregar(de, ate);
      if (consulta !== this.consultaJornada) {
        return;
      }
      this.medidas.set(medidas);
      this.estadoJornada.set('pronto');
    } catch (falha) {
      if (consulta !== this.consultaJornada) {
        return;
      }
      this.medidas.set(null);
      this.erroJornada.set(erroDaApi(falha));
      this.estadoJornada.set('erro');
    }
  }

  private estadoDoPainel(painel: 'atendimento' | 'comercial'): EstadoJornada {
    const estado = this.estadoBi();
    return estado === 'pronto' && this.bi()?.falhas.includes(painel) ? 'erro' : estado;
  }

  /** Os painéis do BI usados pela Visão geral, nos últimos `dias` dias. */
  protected async carregarBi(dias = this.dados().periodo.dias): Promise<void> {
    const consulta = ++this.consultaBi;
    this.estadoBi.set('carregando');
    this.erroBi.set(null);
    try {
      const medidas = await this.biApi.carregar(dias);
      if (consulta !== this.consultaBi) {
        return;
      }
      this.bi.set(medidas);
      this.estadoBi.set('pronto');
    } catch (falha) {
      if (consulta !== this.consultaBi) {
        return;
      }
      this.erroBi.set(erroDaApi(falha));
      this.estadoBi.set('erro');
    }
  }

  /** Copia o link da página e mostra o resultado no botão e logo abaixo das ações. */
  protected async compartilhar(): Promise<void> {
    const copiou = await copiarTexto(this.documento.location.href, this.documento);
    const resultado: Compartilhamento = copiou ? 'copiado' : 'falhou';
    this.compartilhamento.set(resultado);
    clearTimeout(this.esperaAviso);
    this.esperaAviso = setTimeout(
      () => this.compartilhamento.set(null),
      DURACAO_RETORNO_MS[resultado],
    );
  }
}
