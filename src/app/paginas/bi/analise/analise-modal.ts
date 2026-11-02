import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideHistory,
  LucideLoaderCircle,
  LucideSend,
  LucideSparkles,
  LucideWandSparkles,
  LucideX,
} from '@lucide/angular';

import { erroDaApi, type ErroApi } from '../../../nucleo/api/erro-api';
import { formatarData, formatarDataHora, formatarEspera } from '../../../nucleo/formatos';
import { AreaTexto } from '../../../ui/area-texto/area-texto';
import { Botao } from '../../../ui/botao/botao';
import { Modal } from '../../../ui/modal/modal';
import { Selo } from '../../../ui/selo/selo';
import { FILTROS_PADRAO, ROTULO_PAINEL, type FiltrosBi, type IdPainel } from '../bi.tipos';
import { AnaliseApi } from './analise.api';
import {
  ROTULO_STATUS,
  type ConteudoAnalise,
  type DetalheAnalise,
  type EstadoAnalise,
  type EventoAnalise,
} from './analise.tipos';
import { ResultadoAnalise } from './resultado-analise';
import { textoDoPeriodo } from './periodo';

/** Limites do texto de uma pergunta (a API recusa fora disto). */
export const PERGUNTA_MINIMO = 3;
export const PERGUNTA_MAXIMO = 1000;

/** Uma rodada (a análise ou uma pergunta) em andamento, concluída ou com erro. */
export interface Turno {
  readonly status: 'andamento' | 'ok' | 'erro';
  readonly conteudo: ConteudoAnalise | null;
  readonly etapa: 'enviando' | 'pensando' | 'escrevendo';
  readonly retentando: boolean;
  readonly erro: string | null;
}

export interface TurnoPergunta extends Turno {
  readonly pergunta: string;
  readonly id: string | null;
}

const TURNO_NOVO: Turno = {
  status: 'andamento',
  conteudo: null,
  etapa: 'enviando',
  retentando: false,
  erro: null,
};

export type Tela =
  | 'carregando'
  | 'falha'
  | 'nao-configurada'
  | 'indisponivel'
  | 'pronto'
  | 'gerando'
  | 'concluida'
  | 'erro';

const ETAPAS = [
  { id: 'enviando', rotulo: 'Enviando os números do painel' },
  { id: 'pensando', rotulo: 'Pensando' },
  { id: 'escrevendo', rotulo: 'Escrevendo' },
] as const;

/** Quantos blocos o conteúdo tem, para o anúncio do fim ("2 destaques, 1 risco e 3 ações"). */
export function contarBlocos(conteudo: ConteudoAnalise | null): string {
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const partes = [
    plural(conteudo?.destaques?.length ?? 0, 'destaque', 'destaques'),
    plural(conteudo?.riscos?.length ?? 0, 'risco', 'riscos'),
    plural(conteudo?.acoes?.length ?? 0, 'ação', 'ações'),
  ];
  return `${partes[0]}, ${partes[1]} e ${partes[2]}`;
}

/**
 * Modal "Análise com IA" (só o Admin abre). Mostra o estado da IA (sem chave, limite do dia),
 * pede a análise do painel e dos filtros recebidos e a exibe em streaming (resumo, destaques,
 * riscos e ações com link para a lista filtrada); depois da análise, aceita perguntas de
 * acompanhamento. Com `analiseId`, reabre uma análise do histórico. Fechar o modal cancela a
 * chamada no servidor (aborta o `fetch`). Uma região viva fixa anuncia o início, a nova
 * tentativa e o fim.
 */
@Component({
  selector: 'app-analise-ia',
  imports: [
    AreaTexto,
    Botao,
    LucideLoaderCircle,
    LucideWandSparkles,
    Modal,
    ResultadoAnalise,
    RouterLink,
    Selo,
  ],
  templateUrl: './analise-modal.html',
  styleUrl: './analise-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnaliseIa {
  private readonly api = inject(AnaliseApi);
  private readonly documento = inject(DOCUMENT);

  readonly aberto = model(false);
  /** O painel e os filtros que a análise nova usa (ignorados ao reabrir uma do histórico). */
  readonly painel = input<IdPainel | null>(null);
  readonly filtros = input<FiltrosBi>(FILTROS_PADRAO);
  /** Reabre esta análise (histórico) em vez de começar uma nova. */
  readonly analiseId = input<string | null>(null);
  /** Esconde o link "Histórico" (a própria página do histórico já está aberta). */
  readonly semHistorico = input(false, { transform: booleanAttribute });

  protected readonly icones = {
    ia: LucideSparkles,
    enviar: LucideSend,
    fechar: LucideX,
    historico: LucideHistory,
  };
  protected readonly etapas = ETAPAS;
  protected readonly minimo = PERGUNTA_MINIMO;
  protected readonly maximo = PERGUNTA_MAXIMO;
  protected readonly rotuloStatus = ROTULO_STATUS;
  protected readonly formatarDataHora = formatarDataHora;

  protected readonly estado = signal<EstadoAnalise | null>(null);
  protected readonly carregando = signal(false);
  protected readonly falha = signal<ErroApi | null>(null);
  protected readonly principal = signal<Turno | null>(null);
  protected readonly perguntas = signal<readonly TurnoPergunta[]>([]);
  protected readonly detalhe = signal<DetalheAnalise | null>(null);
  protected readonly textoPergunta = signal('');
  /** O que a região viva anuncia. */
  protected readonly anuncio = signal('');
  private readonly idDaAnalise = signal<string | null>(null);
  private controle: AbortController | null = null;

  protected readonly tela = computed<Tela>(() => {
    if (this.carregando()) {
      return 'carregando';
    }
    if (this.falha()) {
      return 'falha';
    }
    const principal = this.principal();
    if (principal) {
      return principal.status === 'andamento'
        ? 'gerando'
        : principal.status === 'ok'
          ? 'concluida'
          : 'erro';
    }
    const estado = this.estado();
    if (estado && !estado.configurada) {
      return 'nao-configurada';
    }
    if (estado && !estado.disponivel) {
      return 'indisponivel';
    }
    return 'pronto';
  });

  protected readonly modoHistorico = computed(() => this.analiseId() !== null);
  protected readonly maxPerguntas = computed(() => this.estado()?.maxPerguntasPorAnalise ?? 5);
  protected readonly perguntaEmAndamento = computed(() =>
    this.perguntas().some((p) => p.status === 'andamento'),
  );
  protected readonly podePerguntar = computed(() => {
    const falhou = this.perguntas().at(-1)?.status === 'erro';
    return (
      this.tela() === 'concluida' &&
      this.idDaAnalise() !== null &&
      this.estado()?.configurada !== false &&
      !this.perguntaEmAndamento() &&
      !falhou &&
      this.perguntas().length < this.maxPerguntas()
    );
  });
  protected readonly perguntasRestantes = computed(
    () => this.maxPerguntas() - this.perguntas().length,
  );
  protected readonly perguntaValida = computed(() => {
    const tamanho = this.textoPergunta().trim().length;
    return tamanho >= PERGUNTA_MINIMO && tamanho <= PERGUNTA_MAXIMO;
  });

  /** "Comercial · 01/10/2026 a 30/10/2026" — o que a análise vai ler. */
  protected readonly escopo = computed(() => {
    const detalhe = this.detalhe();
    const painel = detalhe?.painel ?? this.painel();
    const periodo = detalhe?.periodo ?? null;
    const f = this.filtros();
    const partes = [painel ? ROTULO_PAINEL[painel] : 'Painel'];
    if (periodo) {
      partes.push(textoDoPeriodo(periodo));
    } else if (f.de && f.ate) {
      partes.push(`${formatarData(f.de)} a ${formatarData(f.ate)}`);
    }
    return partes.join(' · ');
  });

  protected readonly dadosEnviados = computed(() => {
    const entrada = this.detalhe()?.entrada;
    return entrada === undefined || entrada === null ? null : JSON.stringify(entrada, null, 2);
  });

  protected readonly tokensTotal = computed(() => {
    const t = this.detalhe()?.tokens;
    return t ? t.entrada + t.saida : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.controle?.abort());
    effect(() => {
      if (this.aberto()) {
        untracked(() => void this.iniciarSessao());
      } else {
        untracked(() => this.encerrar());
      }
    });
    // A pergunta nova entra na tela logo acima do campo: leva o olho até ela.
    effect(() => {
      if (this.perguntas().length === 0) {
        return;
      }
      queueMicrotask(() => {
        const alvo = this.documento.querySelector('[data-ultimo-turno]');
        if (alvo && typeof alvo.scrollIntoView === 'function') {
          alvo.scrollIntoView({ block: 'nearest' });
        }
      });
    });
  }

  protected restantesTexto(): string {
    const restantes = this.estado()?.restantesHoje;
    if (restantes === undefined) {
      return '';
    }
    return restantes === 1 ? 'Resta 1 análise hoje.' : `Restam ${restantes} análises hoje.`;
  }

  protected perguntasTexto(): string {
    const n = this.perguntasRestantes();
    return n === 1 ? 'Pode fazer mais 1 pergunta.' : `Pode fazer mais ${n} perguntas.`;
  }

  protected etapaAtual(turno: Turno): number {
    return ETAPAS.findIndex((e) => e.id === turno.etapa);
  }

  // Ciclo de vida ------------------------------------------------------------------------------

  private encerrar(): void {
    this.controle?.abort();
    this.controle = null;
    this.estado.set(null);
    this.falha.set(null);
    this.carregando.set(false);
    this.principal.set(null);
    this.perguntas.set([]);
    this.detalhe.set(null);
    this.idDaAnalise.set(null);
    this.textoPergunta.set('');
    this.anuncio.set('');
  }

  protected async iniciarSessao(): Promise<void> {
    this.encerrar();
    this.carregando.set(true);
    const id = this.analiseId();
    try {
      if (id) {
        const [detalhe, estado] = await Promise.all([
          this.api.detalhe(id),
          this.api.estado().catch(() => null),
        ]);
        if (!this.aberto()) {
          return;
        }
        this.estado.set(estado);
        this.detalhe.set(detalhe);
        this.idDaAnalise.set(detalhe.id);
        this.principal.set({
          ...TURNO_NOVO,
          status: detalhe.status === 'CONCLUIDA' ? 'ok' : 'erro',
          conteudo: detalhe.resultado,
          erro:
            detalhe.status === 'FALHOU'
              ? (detalhe.erro ?? 'Esta análise não foi concluída.')
              : detalhe.status === 'EM_ANDAMENTO'
                ? 'Esta análise não chegou ao fim.'
                : null,
        });
        this.perguntas.set(
          detalhe.perguntas.map((p) => ({
            ...TURNO_NOVO,
            id: p.id,
            pergunta: p.pergunta,
            status: p.status === 'CONCLUIDA' ? 'ok' : 'erro',
            conteudo: p.resposta,
            erro: p.status === 'CONCLUIDA' ? null : (p.erro ?? 'Esta pergunta não foi respondida.'),
          })),
        );
      } else {
        const estado = await this.api.estado();
        if (!this.aberto()) {
          return;
        }
        this.estado.set(estado);
      }
      this.falha.set(null);
    } catch (erro) {
      if (this.aberto()) {
        this.falha.set(erroDaApi(erro));
      }
    } finally {
      if (this.aberto()) {
        this.carregando.set(false);
      }
    }
  }

  // Análise ------------------------------------------------------------------------------------

  protected async gerar(): Promise<void> {
    const painel = this.painel();
    if (!painel || this.tela() === 'gerando') {
      return;
    }
    this.controle?.abort();
    const controle = new AbortController();
    this.controle = controle;
    this.idDaAnalise.set(null);
    this.perguntas.set([]);
    this.principal.set(TURNO_NOVO);
    this.anuncio.set('Gerando a análise. Leva alguns segundos.');
    const fluxo = this.api.analisar(painel, this.filtros(), controle.signal);
    const erro = await this.consumir(fluxo, controle, (mudanca) =>
      this.principal.update((turno) => ({ ...(turno ?? TURNO_NOVO), ...mudanca })),
    );
    if (erro && !controle.signal.aborted) {
      this.principal.set(null);
      this.tratarErroAntesDoStreaming(erro);
    }
  }

  /** Para a análise em andamento e volta ao início (a chamada é cancelada no servidor). */
  protected cancelar(): void {
    this.controle?.abort();
    this.controle = null;
    this.principal.set(null);
    this.idDaAnalise.set(null);
    this.anuncio.set('Análise cancelada.');
  }

  /** 429 e 503 antes do streaming viram o estado da tela; o resto, erro com nova tentativa. */
  private tratarErroAntesDoStreaming(erro: ErroApi): void {
    const estado = this.estado();
    if (erro.status === 429 && estado) {
      const espera = erro.tentarDeNovoEmSegundos;
      this.estado.set({
        ...estado,
        disponivel: false,
        restantesHoje: 0,
        motivo:
          erro.mensagemDaApi ??
          `O limite de análises de hoje foi atingido${espera ? `; tente de novo em ${formatarEspera(espera)}` : ''}.`,
      });
      this.anuncio.set('O limite diário de análises foi atingido.');
    } else if (erro.status === 503 && estado) {
      const como = erro.detalhes?.['comoConfigurar'];
      this.estado.set({
        ...estado,
        configurada: false,
        disponivel: false,
        comoConfigurar: typeof como === 'string' ? como : estado.comoConfigurar,
      });
      this.anuncio.set('A análise com IA ainda não está configurada.');
    } else {
      this.principal.set({ ...TURNO_NOVO, status: 'erro', erro: erro.resumo });
      this.anuncio.set(erro.resumo);
    }
  }

  // Perguntas ----------------------------------------------------------------------------------

  protected async perguntar(textoRepetido?: string): Promise<void> {
    const id = this.idDaAnalise();
    const texto = (textoRepetido ?? this.textoPergunta()).trim();
    if (!id || this.perguntaEmAndamento() || texto.length < PERGUNTA_MINIMO) {
      return;
    }
    if (texto.length > PERGUNTA_MAXIMO) {
      return;
    }
    this.controle?.abort();
    const controle = new AbortController();
    this.controle = controle;
    this.textoPergunta.set('');
    const turno: TurnoPergunta = { ...TURNO_NOVO, id: null, pergunta: texto };
    this.perguntas.update((lista) => [...lista, turno]);
    this.anuncio.set('Enviando a pergunta. Leva alguns segundos.');
    // A rodada em andamento é sempre a última da lista.
    const mudar = (mudanca: Partial<Turno>) =>
      this.perguntas.update((lista) =>
        lista.map((item, i) => (i === lista.length - 1 ? { ...item, ...mudanca } : item)),
      );
    const erro = await this.consumir(
      this.api.perguntar(id, texto, controle.signal),
      controle,
      mudar,
    );
    if (erro && !controle.signal.aborted) {
      mudar({ status: 'erro', erro: erro.resumo });
      this.anuncio.set(erro.resumo);
    }
  }

  /** Repete a última pergunta que falhou. */
  protected repetirPergunta(): void {
    const ultima = this.perguntas().at(-1);
    if (!ultima || ultima.status !== 'erro') {
      return;
    }
    this.perguntas.update((lista) => lista.slice(0, -1));
    void this.perguntar(ultima.pergunta);
  }

  // Streaming ----------------------------------------------------------------------------------

  /**
   * Lê os eventos e vai aplicando no turno. Devolve o erro de uma falha antes do streaming
   * (429, 503, 4xx…), que o chamador trata; erros do evento `erro` já ficam no turno.
   */
  private async consumir(
    fluxo: AsyncGenerator<EventoAnalise, void, undefined>,
    controle: AbortController,
    mudar: (mudanca: Partial<Turno>) => void,
  ): Promise<ErroApi | null> {
    let terminou = false;
    try {
      for await (const evento of fluxo) {
        if (controle.signal.aborted) {
          return null;
        }
        switch (evento.evento) {
          case 'inicio':
            if (evento.tipo === 'analise') {
              this.idDaAnalise.set(evento.analiseId);
            }
            break;
          case 'fase':
            mudar({ etapa: evento.fase });
            break;
          case 'parcial':
            mudar({ conteudo: evento.conteudo, retentando: false, etapa: 'escrevendo' });
            break;
          case 'nova_tentativa':
            mudar({ conteudo: null, retentando: true, etapa: 'pensando' });
            this.anuncio.set('Tentando de novo.');
            break;
          case 'concluido':
            terminou = true;
            mudar({ status: 'ok', conteudo: evento.conteudo, retentando: false, erro: null });
            this.aoConcluir(evento);
            break;
          case 'erro':
            terminou = true;
            mudar({ status: 'erro', erro: evento.mensagem, retentando: false });
            this.anuncio.set(evento.mensagem);
            break;
        }
      }
      if (!terminou && !controle.signal.aborted) {
        const mensagem = 'A conexão foi interrompida antes do fim. Tente de novo.';
        mudar({ status: 'erro', erro: mensagem });
        this.anuncio.set(mensagem);
      }
      return null;
    } catch (falha) {
      return controle.signal.aborted ? null : erroDaApi(falha);
    }
  }

  private aoConcluir(evento: Extract<EventoAnalise, { evento: 'concluido' }>): void {
    if (evento.tipo === 'analise') {
      this.anuncio.set(`Análise pronta: ${contarBlocos(evento.conteudo)}.`);
      const estado = this.estado();
      if (estado && evento.restantesHoje !== null) {
        this.estado.set({
          ...estado,
          restantesHoje: evento.restantesHoje,
          usadasHoje: Math.max(0, estado.limiteDiario - evento.restantesHoje),
          disponivel: evento.restantesHoje > 0,
        });
      }
    } else {
      this.perguntas.update((lista) =>
        lista.map((p, i) => (i === lista.length - 1 ? { ...p, id: evento.perguntaId } : p)),
      );
      this.anuncio.set('Resposta pronta.');
    }
  }
}
