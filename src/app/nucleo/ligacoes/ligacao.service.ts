import { DOCUMENT } from '@angular/common';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  Injectable,
  InjectionToken,
  signal,
  untracked,
} from '@angular/core';

import { erroDaApi } from '../api/erro-api';
import { AvisosService } from '../avisos.service';
import { SessaoService } from '../sessao/sessao.service';
import { TempoRealService } from '../tempo-real/tempo-real.service';
import { type AvisoEmExecucao, tocarAvisoParaOCliente } from './aviso-gravacao';
import { GravacaoApi } from './gravacao.api';
import { AMBIENTE_DO_NAVEGADOR, type AmbienteDoGravador, Gravador } from './gravador';
import { LigacoesApi } from './ligacoes.api';
import { formatarTelefone, resumoDoFim } from './ligacoes.textos';
import {
  type CanalDeLigacao,
  type ContatoDaLigacao,
  type DirecaoLigacao,
  type EstadoLigacao,
  type EventoLigacaoDeixouDeTocar,
  type EventoLigacaoEncerrada,
  type EventoLigacaoEstado,
  type EventoLigacaoRespostaSdp,
  type EventoLigacaoTocando,
  estaAtiva,
  type Ligacao,
} from './ligacoes.tipos';
import {
  ErroDeMidia,
  erroDeMidia,
  type FabricaWebrtc,
  FABRICA_WEBRTC_DO_NAVEGADOR,
  type QualidadeDaLigacao,
  SessaoWebrtc,
} from './sessao-webrtc';
import { ToqueSonoro } from './toque';

/** O que o navegador dá ao serviço (trocado nos testes). */
export interface AmbienteDeLigacao {
  readonly webrtc: FabricaWebrtc;
  criarToque(): ToqueSonoro;
  criarAudio(): HTMLAudioElement;
  /** Gravação e Web Audio (nulo: o navegador de verdade). */
  readonly gravador?: AmbienteDoGravador;
  /** Microfones e alto-falantes (nulo: o navegador não lista). */
  dispositivos(): MediaDevices | null;
}

export const AMBIENTE_DE_LIGACAO = new InjectionToken<AmbienteDeLigacao>('AMBIENTE_DE_LIGACAO', {
  providedIn: 'root',
  factory: () => ({
    webrtc: FABRICA_WEBRTC_DO_NAVEGADOR,
    criarToque: () => new ToqueSonoro(),
    criarAudio: () => {
      const audio = new Audio();
      audio.autoplay = true;
      return audio;
    },
    dispositivos: () =>
      typeof navigator === 'undefined' ? null : (navigator.mediaDevices ?? null),
  }),
});

/** Intervalo entre as medições da qualidade do áudio. */
export const INTERVALO_QUALIDADE_MS = 3_000;
/** Depois de aceita, sem conexão de mídia por este tempo: avisa que a rede pode estar bloqueando. */
export const LIMITE_SEM_MIDIA_MS = 12_000;
/** Espera da confirmação do encerramento (webhook da Meta) antes de conferir na API. */
export const ESPERA_ENCERRAMENTO_MS = 25_000;
/** A anotação rápida é gravada depois de uma pausa na digitação. */
export const ESPERA_ANOTACAO_MS = 1_200;
/** O resultado fica na barra por este tempo (falhas ficam até a pessoa fechar). */
export const DURACAO_DO_FIM_MS = 12_000;
/** Folga depois de `expiraEm` antes de tirar o aviso de toque (o servidor confirma antes). */
const FOLGA_DO_TOQUE_MS = 1_500;

const CHAVE_MICROFONE = 'crmbrl.ligacao.microfone';
const CHAVE_ALTO_FALANTE = 'crmbrl.ligacao.altofalante';

export type FaseDaLigacao =
  'preparando' | 'conectando' | 'chamando' | 'tocando' | 'em-andamento' | 'encerrando';

export interface LigacaoEmCurso {
  /** `null` enquanto a ligação feita ainda está sendo criada (microfone, oferta e envio). */
  readonly id: string | null;
  readonly direcao: DirecaoLigacao;
  readonly contato: ContatoDaLigacao;
  readonly canal: { readonly id: string; readonly nome: string } | null;
  readonly conversaId: string | null;
  readonly atividadeId: string | null;
  readonly fase: FaseDaLigacao;
  /** Quando a conversa começou (o cronômetro parte daqui), em ms. */
  readonly inicioEm: number | null;
  /**
   * `true` quando a ligação existe na API mas a mídia não está nesta aba (outra aba ou a página
   * foi recarregada): só dá para encerrar.
   */
  readonly semAudioNestaAba: boolean;
}

export interface Toque {
  readonly ligacaoId: string;
  readonly contato: ContatoDaLigacao;
  readonly canal: { readonly id: string; readonly nome: string };
  readonly ofertaSdp: string;
  readonly expiraEm: string;
  readonly conversaId: string | null;
}

export type TomDoFim = 'sucesso' | 'info' | 'erro';

/** O resultado da última ligação, mostrado na barra até a pessoa fechar (ou por alguns segundos). */
export interface FimDeLigacao {
  readonly ligacaoId: string;
  readonly estado: EstadoLigacao;
  readonly direcao: DirecaoLigacao;
  readonly contato: ContatoDaLigacao;
  readonly duracaoSegundos: number | null;
  readonly texto: string;
  readonly tom: TomDoFim;
}

export interface DadosParaLigar {
  readonly contato: {
    readonly id: string;
    readonly nome: string;
    readonly telefone?: string | null;
    readonly empresa?: string | null;
  };
  readonly canalId?: string | null;
  readonly atividadeId?: string | null;
  readonly conversaId?: string | null;
}

export type ResultadoDeLigar =
  | { readonly ok: true; readonly ligacao: Ligacao }
  | {
      readonly ok: false;
      readonly mensagem: string;
      /** `detalhes.motivo` da API (`sem_sem_permissao`…) ou `microfone`. */
      readonly motivo: string | null;
    };

export interface DispositivoDeAudio {
  readonly id: string;
  readonly rotulo: string;
}

type EventoBufferizado =
  | { readonly tipo: 'estado'; readonly dados: EventoLigacaoEstado }
  | { readonly tipo: 'resposta'; readonly dados: EventoLigacaoRespostaSdp }
  | { readonly tipo: 'encerrada'; readonly dados: EventoLigacaoEncerrada };

function lerPreferencia(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarPreferencia(chave: string, valor: string | null): void {
  try {
    if (valor) {
      localStorage.setItem(chave, valor);
    } else {
      localStorage.removeItem(chave);
    }
  } catch {
    // sem armazenamento: a escolha vale só nesta aba
  }
}

/** R12: Marketing não usa o Atendimento, então também não liga nem atende. */
export function usuarioUsaAtendimento(usuario: { readonly area?: string | null } | null): boolean {
  return !!usuario && usuario.area !== 'MARKETING';
}

/**
 * Softphone do CRM (Onda E, E2). **Um por aba**: guarda a ligação em andamento, os toques, o
 * cronômetro, o mudo, os dispositivos de áudio e a qualidade, e sobrevive à navegação porque a
 * barra e o aviso de toque ficam na casca. Uma ligação por vez.
 *
 * - **Recebida:** `ligacao.tocando` → toque sonoro e aviso → `atender()` abre o microfone, monta a
 *   resposta SDP e a envia (`POST /ligacoes/:id/atender`); o áudio só liga depois do 200.
 * - **Feita:** `ligar()` abre o microfone, monta a oferta e a envia (`POST /ligacoes`); a resposta
 *   SDP vem pelo tempo real (`ligacao.resposta_sdp`).
 * - **Fim:** `encerrar()` desliga o áudio na hora e avisa a API (que manda `terminate` à Meta); o
 *   estado final vem em `ligacao.encerrada`.
 * - **Gravação (E3):** `streamLocal` e `streamRemoto` expõem os `MediaStream` da ligação.
 */
@Injectable({ providedIn: 'root' })
export class LigacaoService {
  private readonly api = inject(LigacoesApi);
  private readonly avisos = inject(AvisosService);
  private readonly sessao = inject(SessaoService);
  private readonly tempoReal = inject(TempoRealService);
  private readonly ambiente = inject(AMBIENTE_DE_LIGACAO);
  private readonly documento = inject(DOCUMENT);
  private readonly injetor = inject(Injector);

  // ----- Estado (signals) ---------------------------------------------------------------------

  private readonly _emCurso = signal<LigacaoEmCurso | null>(null);
  private readonly _toques = signal<readonly Toque[]>([]);
  private readonly _fim = signal<FimDeLigacao | null>(null);
  private readonly _mudo = signal(false);
  private readonly _segundos = signal(0);
  private readonly _qualidade = signal<QualidadeDaLigacao>('desconhecida');
  private readonly _semMidia = signal(false);
  private readonly _streamLocal = signal<MediaStream | null>(null);
  private readonly _streamRemoto = signal<MediaStream | null>(null);
  private readonly _canais = signal<readonly CanalDeLigacao[] | null>(null);
  private readonly _microfones = signal<readonly DispositivoDeAudio[]>([]);
  private readonly _altoFalantes = signal<readonly DispositivoDeAudio[]>([]);
  private readonly _microfoneId = signal<string | null>(lerPreferencia(CHAVE_MICROFONE));
  private readonly _altoFalanteId = signal<string | null>(lerPreferencia(CHAVE_ALTO_FALANTE));
  private readonly _anotacao = signal('');
  private readonly _situacaoDaAnotacao = signal<'salvando' | 'salva' | 'erro' | null>(null);
  private readonly _somDesligado = signal(false);
  private readonly _destaque = signal<string | null>(null);
  private readonly _encerradas = signal(0);
  private readonly _gravando = signal(false);
  private readonly _gravacaoComFalha = signal(false);

  /** A ligação desta aba (recebida atendida ou feita), ou `null`. */
  readonly emCurso = this._emCurso.asReadonly();
  /** Ligações recebidas tocando agora (a mais antiga primeiro). */
  readonly toques = this._toques.asReadonly();
  /** O resultado da última ligação, até a pessoa fechar. */
  readonly fim = this._fim.asReadonly();
  readonly mudo = this._mudo.asReadonly();
  /** Segundos de conversa (cronômetro). */
  readonly segundos = this._segundos.asReadonly();
  readonly qualidade = this._qualidade.asReadonly();
  /** A mídia não se conectou a tempo (rede bloqueando UDP, por exemplo). */
  readonly semMidia = this._semMidia.asReadonly();
  /** Áudio do atendente (microfone), para a gravação da E3. `null` fora de uma ligação. */
  readonly streamLocal = this._streamLocal.asReadonly();
  /** Áudio do cliente, para a gravação da E3. `null` fora de uma ligação. */
  readonly streamRemoto = this._streamRemoto.asReadonly();
  readonly canais = this._canais.asReadonly();
  readonly microfones = this._microfones.asReadonly();
  readonly altoFalantes = this._altoFalantes.asReadonly();
  readonly microfoneId = this._microfoneId.asReadonly();
  readonly altoFalanteId = this._altoFalanteId.asReadonly();
  readonly anotacao = this._anotacao.asReadonly();
  readonly situacaoDaAnotacao = this._situacaoDaAnotacao.asReadonly();
  /** O navegador ainda não liberou o som (ninguém clicou na página): o toque está mudo. */
  readonly somDesligado = this._somDesligado.asReadonly();
  /** Toque a destacar (clique na notificação push). */
  readonly destaque = this._destaque.asReadonly();
  /** Sobe a cada ligação que termina (telas de contato e atividades recarregam a linha do tempo). */
  readonly encerradas = this._encerradas.asReadonly();
  /** A gravação da ligação está rodando (a E3 liga; a barra mostra o indicador "Gravando"). */
  readonly gravando = this._gravando.asReadonly();
  /** Alguma parte da gravação não está subindo (a barra avisa; segue tentando). */
  readonly gravacaoComFalha = this._gravacaoComFalha.asReadonly();
  /** O navegador deixa escolher o alto-falante (`setSinkId`). */
  readonly suportaAltoFalante =
    typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

  readonly usaAtendimento = computed(() => usuarioUsaAtendimento(this.sessao.usuario()));
  readonly ocupado = computed(() => this._emCurso() !== null);
  readonly emAndamento = computed(() => this._emCurso()?.fase === 'em-andamento');
  /** A conexão com o CRM caiu durante a ligação (a API encerra se passar de 15 s). */
  readonly semConexaoComOCrm = computed(
    () => this._emCurso() !== null && !this.tempoReal.conectado(),
  );
  /** Frase de alerta da conexão (rede ruim, sem mídia, sem conexão com o CRM), ou `null`. */
  readonly alerta = computed<string | null>(() => {
    const curso = this._emCurso();
    if (!curso || curso.fase === 'encerrando') {
      return null;
    }
    if (this.semConexaoComOCrm()) {
      return 'Sem conexão com o CRM. A ligação continua, mas será encerrada se a conexão não voltar em 15 segundos.';
    }
    if (this._semMidia()) {
      return 'O áudio não conectou. Sua rede pode estar bloqueando a chamada: tente outra rede ou encerre e ligue de novo.';
    }
    if (curso.fase === 'em-andamento' && this._qualidade() === 'ruim') {
      return 'Conexão ruim: o áudio pode falhar ou atrasar.';
    }
    return null;
  });

  // ----- Internos -----------------------------------------------------------------------------

  private readonly toque: ToqueSonoro = this.ambiente.criarToque();
  private readonly saidaDeAudio: HTMLAudioElement = this.ambiente.criarAudio();
  private readonly expiracoes = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly dispensadas = new Set<string>();
  private midia: SessaoWebrtc | null = null;
  private gravador: Gravador | null = null;
  private avisoDeGravacao: AvisoEmExecucao | null = null;
  private paraGravar: { id: string; canalId: string } | null = null;
  private anotacaoPendente = false;
  private geracao = 0;
  private criando = false;
  private buffer: EventoBufferizado[] = [];
  private stunUrls: readonly string[] | null = null;
  private relogio: ReturnType<typeof setInterval> | undefined;
  private medidor: ReturnType<typeof setInterval> | undefined;
  private vigiaDeMidia: ReturnType<typeof setTimeout> | undefined;
  private vigiaDoFim: ReturnType<typeof setTimeout> | undefined;
  private esperaEncerrar: ReturnType<typeof setTimeout> | undefined;
  private gravacaoDaAnotacao: ReturnType<typeof setTimeout> | undefined;
  private ruinsSeguidas = 0;
  private canaisCarregando: Promise<void> | null = null;

  constructor() {
    this.toque.aoMudarSilencio((silenciado) =>
      this._somDesligado.set(silenciado && this._toques().length > 0),
    );
    this.toque.preparar(this.documento);

    this.tempoReal.ouvir('ligacao.tocando', (dados) => this.aoTocar(dados));
    this.tempoReal.ouvir('ligacao.deixou_de_tocar', (dados) => this.aoDeixarDeTocar(dados));
    this.tempoReal.ouvir('ligacao.resposta_sdp', (dados) => this.aoReceberResposta(dados));
    this.tempoReal.ouvir('ligacao.estado', (dados) => this.aoMudarEstado(dados));
    this.tempoReal.ouvir('ligacao.encerrada', (dados) => this.aoEncerrar(dados));

    // Ao conectar (e a cada reconexão): retoma o que a API sabe (tocando e em andamento) e confere
    // quais canais têm o botão Ligar (o Admin pode ter mudado a configuração).
    effect(() => {
      if (this.tempoReal.conectado() && this.usaAtendimento()) {
        untracked(() => {
          void this.sincronizar();
          void this.carregarCanais(true);
        });
      }
    });
    // Saiu da sessão: nada de áudio aberto.
    effect(() => {
      if (!this.sessao.autenticado()) {
        untracked(() => this.limparTudo());
      }
    });

    const janela = this.documento.defaultView;
    const aoSair = (evento: BeforeUnloadEvent) => {
      const curso = this._emCurso();
      if (curso && !curso.semAudioNestaAba && curso.fase !== 'encerrando') {
        evento.preventDefault();
      }
    };
    janela?.addEventListener('beforeunload', aoSair);
    // A aba está mesmo saindo: finaliza a gravação com o que já subiu.
    const aoSumir = () => this.gravador?.sairDaPagina();
    janela?.addEventListener('pagehide', aoSumir);
    const aoMudarDispositivos = () => void this.listarDispositivos();
    this.ambiente.dispositivos()?.addEventListener?.('devicechange', aoMudarDispositivos);
    inject(DestroyRef).onDestroy(() => {
      janela?.removeEventListener('beforeunload', aoSair);
      janela?.removeEventListener('pagehide', aoSumir);
      this.ambiente.dispositivos()?.removeEventListener?.('devicechange', aoMudarDispositivos);
      this.limparTudo();
      this.toque.destruir();
    });
  }

  // ----- Canais e retomada --------------------------------------------------------------------

  /**
   * Canais com ligações ativas e botão visível (some o botão Ligar se vazio). O serviço os carrega
   * ao conectar o tempo real; as telas só leem `canais()`.
   */
  carregarCanais(forcar = false): Promise<void> {
    if (!this.usaAtendimento()) {
      this._canais.set([]);
      return Promise.resolve();
    }
    if (this._canais() !== null && !forcar) {
      return Promise.resolve();
    }
    this.canaisCarregando ??= this.api
      .canais()
      .then((canais) => this._canais.set(canais))
      .catch(() => this._canais.set([]))
      .finally(() => (this.canaisCarregando = null));
    return this.canaisCarregando;
  }

  /** Confere na API o que está tocando e em andamento (ao conectar, reconectar ou abrir um link). */
  async sincronizar(): Promise<void> {
    let ativas;
    try {
      ativas = await this.api.ativas();
    } catch {
      return;
    }
    const idsTocando = new Set(ativas.tocando.map((item) => item.id));
    for (const toque of this._toques()) {
      if (!idsTocando.has(toque.ligacaoId)) {
        this.removerToque(toque.ligacaoId);
      }
    }
    for (const ligacao of ativas.tocando) {
      if (this.ocupado() || this.dispensadas.has(ligacao.id) || !ligacao.ofertaSdp) {
        continue;
      }
      this.adicionarToque({
        ligacaoId: ligacao.id,
        contato: ligacao.contato,
        canal: ligacao.canal,
        ofertaSdp: ligacao.ofertaSdp,
        expiraEm: ligacao.expiraEm ?? new Date(Date.now() + 10_000).toISOString(),
        conversaId: ligacao.conversaId,
      });
    }
    const curso = this._emCurso();
    const servidor = ativas.emAndamento;
    if (servidor && !curso && !this.criando) {
      // A ligação existe, mas o áudio não está nesta aba (outra aba ou página recarregada).
      this._emCurso.set({
        id: servidor.id,
        direcao: servidor.direcao,
        contato: servidor.contato,
        canal: servidor.canal,
        conversaId: servidor.conversaId,
        atividadeId: servidor.atividadeId,
        fase: faseDoEstado(servidor.estado),
        inicioEm: servidor.atendidaEm ? Date.parse(servidor.atendidaEm) : null,
        semAudioNestaAba: true,
      });
      this._anotacao.set(servidor.anotacao ?? '');
      this.iniciarRelogio();
    } else if (curso?.id && !servidor && !this.criando && curso.fase !== 'conectando') {
      // Terminou enquanto a conexão estava fora do ar.
      try {
        this.concluirComLigacao(await this.api.detalhar(curso.id));
      } catch {
        // tenta de novo na próxima reconexão
      }
    }
  }

  /** Link do push (`/atendimento?ligacao=<id>`): mostra o toque se a ligação ainda estiver tocando. */
  async abrirPorLink(id: string): Promise<void> {
    if (this._toques().some((toque) => toque.ligacaoId === id)) {
      this._destaque.set(id);
      return;
    }
    if (this._emCurso()?.id === id) {
      return;
    }
    try {
      const ligacao = await this.api.detalhar(id);
      if (ligacao.estado === 'TOCANDO' && ligacao.ofertaSdp && !this.ocupado()) {
        this.dispensadas.delete(id);
        this.adicionarToque({
          ligacaoId: ligacao.id,
          contato: ligacao.contato,
          canal: ligacao.canal,
          ofertaSdp: ligacao.ofertaSdp,
          expiraEm: ligacao.expiraEm ?? new Date(Date.now() + 10_000).toISOString(),
          conversaId: ligacao.conversaId,
        });
        this._destaque.set(id);
      } else {
        this.avisos.info(
          ligacao.estado === 'EM_ANDAMENTO'
            ? 'Essa ligação já foi atendida.'
            : 'Essa ligação já terminou.',
        );
      }
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  limparDestaque(): void {
    this._destaque.set(null);
  }

  // ----- Recebida -----------------------------------------------------------------------------

  /** Atende a ligação que está tocando (gesto da pessoa: clique ou atalho). */
  async atender(ligacaoId: string): Promise<void> {
    const toque = this._toques().find((item) => item.ligacaoId === ligacaoId);
    if (!toque || this.ocupado()) {
      return;
    }
    const geracao = ++this.geracao;
    this._fim.set(null);
    this.removerToque(ligacaoId);
    this.definirCurso({
      id: ligacaoId,
      direcao: 'RECEBIDA',
      contato: toque.contato,
      canal: toque.canal,
      conversaId: toque.conversaId,
      atividadeId: null,
      fase: 'conectando',
      inicioEm: null,
      semAudioNestaAba: false,
    });
    try {
      const sessao = await this.novaMidia(geracao);
      if (!sessao) {
        return;
      }
      const microfone = await sessao.abrirMicrofone(this._microfoneId());
      if (geracao !== this.geracao) {
        return;
      }
      this._streamLocal.set(microfone);
      sessao.definirMicrofoneAtivo(false);
      const sdp = await sessao.responder(toque.ofertaSdp);
      if (geracao !== this.geracao) {
        return;
      }
      const ligacao = await this.api.atender(ligacaoId, sdp);
      if (geracao !== this.geracao) {
        // Encerrou durante o "Conectando…" e a API aceitou o atendimento mesmo assim: desliga.
        void this.api.encerrar(ligacaoId).catch(() => undefined);
        return;
      }
      this.aoAceitar(ligacao);
    } catch (falha) {
      if (geracao !== this.geracao) {
        return;
      }
      this.falharAoAtender(falha, toque);
    }
  }

  /**
   * "Recusar": avisa a API (`POST /ligacoes/:id/recusar`, idempotente). O aviso some na hora; os
   * outros atendentes seguem sendo chamados e, se todos recusarem, a ligação vira perdida. Se a
   * API disser que a ligação já foi atendida ou terminou (409) ou que ela não tocou para você
   * (403), o aviso já saiu da tela mesmo assim. Nunca lança.
   */
  async recusar(ligacaoId: string): Promise<void> {
    this.dispensar(ligacaoId);
    try {
      await this.api.recusar(ligacaoId);
    } catch {
      // O tempo real (ligacao.deixou_de_tocar) e o recarregamento corrigem qualquer diferença.
    }
  }

  /** Só some o aviso e o som, nesta aba (usado ao começar outra ligação). */
  dispensar(ligacaoId: string): void {
    this.dispensadas.add(ligacaoId);
    this.removerToque(ligacaoId);
  }

  // ----- Feita --------------------------------------------------------------------------------

  /** Liga para o contato. Nunca lança: o resultado diz o que mostrar. */
  async ligar(dados: DadosParaLigar): Promise<ResultadoDeLigar> {
    if (this.ocupado()) {
      return {
        ok: false,
        mensagem: 'Você já está em uma ligação. Encerre a atual antes de começar outra.',
        motivo: 'ja_em_ligacao',
      };
    }
    const geracao = ++this.geracao;
    this._fim.set(null);
    this._toques().forEach((toque) => this.dispensar(toque.ligacaoId));
    this.criando = true;
    this.buffer = [];
    this.definirCurso({
      id: null,
      direcao: 'FEITA',
      contato: {
        id: dados.contato.id,
        nome: dados.contato.nome,
        telefone: dados.contato.telefone ?? null,
        empresa: dados.contato.empresa ?? null,
      },
      canal: null,
      conversaId: dados.conversaId ?? null,
      atividadeId: dados.atividadeId ?? null,
      fase: 'preparando',
      inicioEm: null,
      semAudioNestaAba: false,
    });
    try {
      const sessao = await this.novaMidia(geracao);
      if (!sessao) {
        return { ok: false, mensagem: 'Ligação cancelada.', motivo: 'cancelada' };
      }
      const microfone = await sessao.abrirMicrofone(this._microfoneId());
      if (geracao !== this.geracao) {
        return { ok: false, mensagem: 'Ligação cancelada.', motivo: 'cancelada' };
      }
      this._streamLocal.set(microfone);
      sessao.definirMicrofoneAtivo(true);
      const sdp = await sessao.oferecer();
      if (geracao !== this.geracao) {
        return { ok: false, mensagem: 'Ligação cancelada.', motivo: 'cancelada' };
      }
      const ligacao = await this.api.ligar({
        contatoId: dados.contato.id,
        ...(dados.canalId ? { canalId: dados.canalId } : {}),
        ...(dados.atividadeId ? { atividadeId: dados.atividadeId } : {}),
        sdp,
      });
      if (geracao !== this.geracao) {
        // Cancelada durante o envio: pede o encerramento da que acabou de nascer.
        void this.api.encerrar(ligacao.id).catch(() => undefined);
        return { ok: false, mensagem: 'Ligação cancelada.', motivo: 'cancelada' };
      }
      this.criando = false;
      this.paraGravar = ligacao.gravar ? { id: ligacao.id, canalId: ligacao.canal.id } : null;
      this.definirCurso({
        ...this._emCurso()!,
        id: ligacao.id,
        canal: ligacao.canal,
        conversaId: ligacao.conversaId,
        atividadeId: ligacao.atividadeId ?? dados.atividadeId ?? null,
        fase: faseDoEstado(ligacao.estado, 'chamando'),
      });
      const pendentes = this.buffer.filter((item) => item.dados.ligacaoId === ligacao.id);
      this.buffer = [];
      for (const item of pendentes) {
        if (item.tipo === 'resposta') {
          this.aoReceberResposta(item.dados);
        } else if (item.tipo === 'estado') {
          this.aoMudarEstado(item.dados);
        } else {
          this.aoEncerrar(item.dados);
        }
      }
      return { ok: true, ligacao };
    } catch (falha) {
      this.criando = false;
      this.buffer = [];
      if (geracao === this.geracao) {
        this.abandonar();
      }
      if (falha instanceof ErroDeMidia) {
        return { ok: false, mensagem: falha.mensagem, motivo: 'microfone' };
      }
      const erro = erroDaApi(falha);
      const motivo = erro.detalhes?.['motivo'];
      return {
        ok: false,
        mensagem: erro.mensagem,
        motivo: typeof motivo === 'string' ? motivo : null,
      };
    }
  }

  // ----- Durante a ligação --------------------------------------------------------------------

  /** Desliga (ou cancela a chamada). O áudio para na hora; o estado final vem da API. */
  async encerrar(): Promise<void> {
    const curso = this._emCurso();
    if (!curso || curso.fase === 'encerrando') {
      return;
    }
    if (curso.id === null) {
      // Ainda montando a oferta: cancela sem falar com a API.
      this.geracao++;
      this.criando = false;
      this.abandonar();
      return;
    }
    const ligacaoId = curso.id;
    if (curso.direcao === 'RECEBIDA' && curso.fase === 'conectando') {
      // Desistiu durante o "Conectando…": a ligação ainda toca na API (que só aceita encerrar
      // depois de atendida). Vale como recusar; se o `atender` em curso já foi aceito, ele mesmo
      // pede o encerramento ao ver que a geração mudou.
      this.geracao++;
      this.abandonar();
      await this.recusar(ligacaoId);
      return;
    }
    await this.gravarAnotacaoAgora();
    this.fecharMidia();
    this.definirCurso({ ...curso, fase: 'encerrando' });
    clearTimeout(this.esperaEncerrar);
    try {
      const ligacao = await this.api.encerrar(ligacaoId);
      if (this._emCurso()?.id !== ligacaoId) {
        return;
      }
      if (!estaAtiva(ligacao.estado)) {
        this.concluirComLigacao(ligacao);
        return;
      }
      this.esperarConfirmacaoDoFim(ligacaoId);
    } catch (falha) {
      if (this._emCurso()?.id !== ligacaoId) {
        return;
      }
      const erro = erroDaApi(falha);
      if (erro.detalhes?.['motivo'] === 'ligacao_encerrada') {
        void this.conferirFim(ligacaoId);
        return;
      }
      this.avisos.erro(falha);
      this.esperarConfirmacaoDoFim(ligacaoId);
    }
  }

  alternarMudo(): void {
    const curso = this._emCurso();
    if (!curso || curso.semAudioNestaAba || curso.fase === 'encerrando') {
      return;
    }
    const mudo = !this._mudo();
    this._mudo.set(mudo);
    if (curso.fase === 'em-andamento' || curso.direcao === 'FEITA') {
      this.midia?.definirMicrofoneAtivo(!mudo);
    }
  }

  /** Escolhe o microfone (vale já, no meio da ligação, e nas próximas). */
  async escolherMicrofone(id: string | null): Promise<void> {
    this._microfoneId.set(id);
    gravarPreferencia(CHAVE_MICROFONE, id);
    if (this.midia && this._emCurso()?.fase === 'em-andamento') {
      try {
        await this.midia.trocarMicrofone(id, !this._mudo());
        this._streamLocal.set(this.midia.streamLocal);
        const local = this.midia.streamLocal;
        if (local) {
          this.gravador?.trocarLocal(local);
        }
      } catch (falha) {
        this.avisos.erro(erroDeMidia(falha).mensagem);
      }
    }
  }

  async escolherAltoFalante(id: string | null): Promise<void> {
    this._altoFalanteId.set(id);
    gravarPreferencia(CHAVE_ALTO_FALANTE, id);
    await this.aplicarAltoFalante();
  }

  /** Atualiza a lista de microfones e alto-falantes (os nomes só aparecem depois da permissão). */
  async listarDispositivos(): Promise<void> {
    const midia = this.ambiente.dispositivos();
    if (!midia?.enumerateDevices) {
      return;
    }
    try {
      const todos = await midia.enumerateDevices();
      const rotular = (tipo: MediaDeviceKind, padrao: string) =>
        todos
          .filter((item) => item.kind === tipo && item.deviceId)
          .map((item, indice) => ({
            id: item.deviceId,
            rotulo: item.label || `${padrao} ${indice + 1}`,
          }));
      this._microfones.set(rotular('audioinput', 'Microfone'));
      this._altoFalantes.set(rotular('audiooutput', 'Alto-falante'));
    } catch {
      // sem lista: o padrão do sistema continua valendo
    }
  }

  /** Anotação rápida: gravada na ligação (e na descrição da atividade) depois de uma pausa. */
  anotar(texto: string): void {
    this._anotacao.set(texto);
    this.anotacaoPendente = true;
    this._situacaoDaAnotacao.set(null);
    clearTimeout(this.gravacaoDaAnotacao);
    this.gravacaoDaAnotacao = setTimeout(() => void this.gravarAnotacaoAgora(), ESPERA_ANOTACAO_MS);
  }

  fecharFim(): void {
    clearTimeout(this.vigiaDoFim);
    this._fim.set(null);
  }

  // ----- Eventos do tempo real ----------------------------------------------------------------

  private aoTocar(dados: EventoLigacaoTocando): void {
    if (this.ocupado() || this.dispensadas.has(dados.ligacaoId)) {
      return;
    }
    this.adicionarToque({
      ligacaoId: dados.ligacaoId,
      contato: dados.contato,
      canal: dados.canal,
      ofertaSdp: dados.ofertaSdp,
      expiraEm: dados.expiraEm,
      conversaId: dados.conversaId ?? null,
    });
  }

  private aoDeixarDeTocar(dados: EventoLigacaoDeixouDeTocar): void {
    const tocava = this._toques().some((item) => item.ligacaoId === dados.ligacaoId);
    this.removerToque(dados.ligacaoId);
    this.dispensadas.delete(dados.ligacaoId);
    if (dados.motivo === 'recusada_por_voce') {
      return;
    }
    const curso = this._emCurso();
    if (curso?.id === dados.ligacaoId && curso.fase === 'conectando') {
      // Outra pessoa atendeu primeiro (ou o cliente desligou) enquanto eu montava a resposta.
      this.geracao++;
      const porOutro = dados.motivo === 'atendida_por_outro';
      this.abandonar();
      this.mostrarFim({
        ligacaoId: dados.ligacaoId,
        estado: 'PERDIDA',
        direcao: 'RECEBIDA',
        contato: curso.contato,
        duracaoSegundos: null,
        texto: porOutro
          ? `A ligação foi atendida por ${dados.atendidaPor?.nome ?? 'outra pessoa'}.`
          : dados.motivo === 'cliente_desligou'
            ? 'O cliente desligou antes de você atender.'
            : 'A ligação não está mais disponível.',
        tom: 'info',
      });
      return;
    }
    if (tocava && dados.motivo === 'atendida_por_outro') {
      this.avisos.info(`Ligação atendida por ${dados.atendidaPor?.nome ?? 'outra pessoa'}.`, {
        chave: 'ligacao-atendida-por-outro',
      });
    }
  }

  private aoReceberResposta(dados: EventoLigacaoRespostaSdp): void {
    if (this.criando) {
      this.buffer.push({ tipo: 'resposta', dados });
      return;
    }
    const curso = this._emCurso();
    if (!curso || curso.id !== dados.ligacaoId || !this.midia) {
      return;
    }
    const geracao = this.geracao;
    this.midia.aplicarResposta(dados.sdp).then(
      () => {
        if (geracao === this.geracao) {
          this.ligarAudioDoCliente();
          this.vigiarMidia();
        }
      },
      () => {
        if (geracao === this.geracao) {
          this.avisos.erro('O áudio da ligação não pôde ser montado. Encerrando.');
          void this.encerrar();
        }
      },
    );
  }

  private aoMudarEstado(dados: EventoLigacaoEstado): void {
    if (this.criando) {
      this.buffer.push({ tipo: 'estado', dados });
      return;
    }
    const curso = this._emCurso();
    if (!curso || curso.id !== dados.ligacaoId || curso.fase === 'encerrando') {
      return;
    }
    if (dados.estado === 'EM_ANDAMENTO') {
      const inicio = dados.atendidaEm
        ? Math.min(Date.parse(dados.atendidaEm), Date.now())
        : Date.now();
      this.definirCurso({ ...curso, fase: 'em-andamento', inicioEm: curso.inicioEm ?? inicio });
      this.iniciarRelogio();
      if (curso.direcao === 'FEITA') {
        this.ligarAudioDoCliente();
        if (this.paraGravar?.id === curso.id) {
          this.comecarGravacao(this.paraGravar);
        }
      }
    } else if (dados.estado === 'TOCANDO' && curso.fase !== 'em-andamento') {
      this.definirCurso({ ...curso, fase: curso.direcao === 'FEITA' ? 'tocando' : curso.fase });
    } else if (dados.estado === 'CHAMANDO' && curso.fase === 'preparando') {
      this.definirCurso({ ...curso, fase: 'chamando' });
    }
  }

  private aoEncerrar(dados: EventoLigacaoEncerrada): void {
    if (this.criando) {
      this.buffer.push({ tipo: 'encerrada', dados });
      return;
    }
    const curso = this._emCurso();
    if (!curso || curso.id !== dados.ligacaoId) {
      return;
    }
    void this.gravarAnotacaoAgora().finally(() => undefined);
    this.concluir(
      curso,
      dados.estado,
      dados.duracaoSegundos,
      dados.motivoTexto ?? null,
      dados.motivo,
    );
  }

  // ----- Transições ---------------------------------------------------------------------------

  /** A API aceitou o atendimento: liga o áudio dos dois lados e começa o cronômetro. */
  private aoAceitar(ligacao: Ligacao): void {
    const curso = this._emCurso();
    if (!curso || curso.id !== ligacao.id) {
      return;
    }
    const inicio = ligacao.atendidaEm
      ? Math.min(Date.parse(ligacao.atendidaEm), Date.now())
      : Date.now();
    this.definirCurso({
      ...curso,
      fase: 'em-andamento',
      inicioEm: inicio,
      conversaId: ligacao.conversaId,
    });
    this.iniciarRelogio();
    this.midia?.definirMicrofoneAtivo(!this._mudo());
    this.ligarAudioDoCliente();
    this.vigiarMidia();
    void this.listarDispositivos();
    if (ligacao.gravar) {
      this.comecarGravacao({ id: ligacao.id, canalId: ligacao.canal.id });
    }
  }

  private falharAoAtender(falha: unknown, toque: Toque): void {
    this.abandonar();
    if (falha instanceof ErroDeMidia) {
      // O microfone falhou: a ligação continua tocando, então o aviso volta para tentar de novo.
      this.avisos.erro(falha.mensagem, { chave: 'ligacao-microfone' });
      if (Date.parse(toque.expiraEm) > Date.now()) {
        this.dispensadas.delete(toque.ligacaoId);
        this.adicionarToque(toque);
      }
      return;
    }
    const erro = erroDaApi(falha);
    const motivo = erro.detalhes?.['motivo'];
    let texto = erro.mensagem;
    if (motivo === 'atendida_por_outro') {
      const quem = (erro.detalhes?.['atendidaPor'] as { nome?: string } | undefined)?.nome;
      texto = `A ligação foi atendida por ${quem ?? 'outra pessoa'}.`;
    } else if (motivo === 'tempo_esgotado' || motivo === 'ligacao_encerrada') {
      texto = 'A ligação já terminou antes de você atender.';
    } else if (motivo === 'meta_recusou') {
      texto = 'A Meta não aceitou o atendimento desta ligação. Ela foi encerrada.';
    }
    this.mostrarFim({
      ligacaoId: toque.ligacaoId,
      estado: motivo === 'meta_recusou' ? 'FALHOU' : 'PERDIDA',
      direcao: 'RECEBIDA',
      contato: toque.contato,
      duracaoSegundos: null,
      texto,
      tom: motivo === 'atendida_por_outro' ? 'info' : 'erro',
    });
  }

  private concluirComLigacao(ligacao: Ligacao): void {
    const curso = this._emCurso();
    if (!curso || curso.id !== ligacao.id) {
      return;
    }
    this.concluir(
      curso,
      ligacao.estado,
      ligacao.duracaoSegundos,
      resumoDoFim(ligacao),
      ligacao.motivo,
      true,
    );
  }

  private concluir(
    curso: LigacaoEmCurso,
    estado: EstadoLigacao,
    duracao: number | null,
    texto: string | null,
    motivo: string | null,
    textoPronto = false,
  ): void {
    this.geracao++;
    const resumo =
      textoPronto && texto
        ? texto
        : resumoDoFim({ estado, motivoTexto: texto, duracaoSegundos: duracao });
    this.abandonar();
    this._encerradas.update((total) => total + 1);
    const ruim = estado === 'FALHOU' || (estado === 'ENCERRADA' && motivo === 'falha_de_midia');
    this.mostrarFim({
      ligacaoId: curso.id ?? '',
      estado,
      direcao: curso.direcao,
      contato: curso.contato,
      duracaoSegundos: duracao,
      texto: resumo,
      tom: ruim ? 'erro' : estado === 'ENCERRADA' ? 'sucesso' : 'info',
    });
  }

  private mostrarFim(fim: FimDeLigacao): void {
    clearTimeout(this.vigiaDoFim);
    this._fim.set(fim);
    if (fim.tom !== 'erro') {
      this.vigiaDoFim = setTimeout(() => this.fecharFim(), DURACAO_DO_FIM_MS);
    }
  }

  /** Para a gravação da E3 avisar a barra. */
  definirGravando(gravando: boolean): void {
    this._gravando.set(gravando);
  }

  /** Larga tudo da ligação desta aba (mídia, cronômetro, anotação), sem mostrar resultado. */
  private abandonar(): void {
    this.fecharMidia();
    clearInterval(this.relogio);
    clearTimeout(this.esperaEncerrar);
    clearTimeout(this.gravacaoDaAnotacao);
    this.relogio = undefined;
    this._emCurso.set(null);
    this._segundos.set(0);
    this._mudo.set(false);
    this._anotacao.set('');
    this.anotacaoPendente = false;
    this._situacaoDaAnotacao.set(null);
    this._qualidade.set('desconhecida');
    this._semMidia.set(false);
    this._gravando.set(false);
    this._gravacaoComFalha.set(false);
  }

  private limparTudo(): void {
    this.geracao++;
    this.criando = false;
    this.buffer = [];
    this.abandonar();
    for (const toque of this._toques()) {
      this.removerToque(toque.ligacaoId);
    }
    clearTimeout(this.vigiaDoFim);
    this._fim.set(null);
    this._canais.set(null);
  }

  private definirCurso(curso: LigacaoEmCurso): void {
    this._emCurso.set(curso);
  }

  // ----- Toques -------------------------------------------------------------------------------

  private adicionarToque(toque: Toque): void {
    if (this._toques().some((item) => item.ligacaoId === toque.ligacaoId)) {
      return;
    }
    this._toques.update((lista) => [...lista, toque]);
    const espera = Math.max(0, Date.parse(toque.expiraEm) - Date.now()) + FOLGA_DO_TOQUE_MS;
    this.expiracoes.set(
      toque.ligacaoId,
      setTimeout(
        () => this.removerToque(toque.ligacaoId),
        Number.isFinite(espera) ? espera : 12_000,
      ),
    );
    this.toque.tocar();
    this._somDesligado.set(this.toque.silenciado());
  }

  private removerToque(ligacaoId: string): void {
    clearTimeout(this.expiracoes.get(ligacaoId));
    this.expiracoes.delete(ligacaoId);
    this._toques.update((lista) => lista.filter((item) => item.ligacaoId !== ligacaoId));
    if (this._toques().length === 0) {
      this.toque.parar();
      this._somDesligado.set(false);
    }
    if (this._destaque() === ligacaoId) {
      this._destaque.set(null);
    }
  }

  // ----- Mídia --------------------------------------------------------------------------------

  /** Cria a sessão de mídia desta ligação (depois de saber os servidores STUN). */
  private async novaMidia(geracao: number): Promise<SessaoWebrtc | null> {
    this.fecharMidia();
    const stunUrls = await this.carregarStun();
    if (geracao !== this.geracao) {
      return null;
    }
    const sessao = new SessaoWebrtc({ fabrica: this.ambiente.webrtc, stunUrls });
    sessao.aoMudarEstado((estado) => this.aoMudarConexao(estado));
    sessao.aoReceberAudio((stream) => this._streamRemoto.set(stream));
    this.midia = sessao;
    return sessao;
  }

  private async carregarStun(): Promise<readonly string[]> {
    if (this.stunUrls) {
      return this.stunUrls;
    }
    try {
      this.stunUrls = (await this.api.configuracaoWebrtc()).stunUrls;
    } catch {
      this.stunUrls = [];
    }
    return this.stunUrls;
  }

  private aoMudarConexao(estado: RTCPeerConnectionState): void {
    const curso = this._emCurso();
    if (!curso || curso.fase === 'encerrando') {
      return;
    }
    if (estado === 'connected') {
      clearTimeout(this.vigiaDeMidia);
      this._semMidia.set(false);
    } else if (estado === 'failed') {
      this.avisos.erro('A conexão de áudio caiu. A ligação foi encerrada.', {
        chave: 'ligacao-midia',
      });
      void this.encerrar();
    } else if (estado === 'disconnected') {
      this._qualidade.set('ruim');
    }
  }

  /** Aceita a ligação: se a mídia não conectar a tempo, avisa que a rede pode estar bloqueando. */
  private vigiarMidia(): void {
    clearTimeout(this.vigiaDeMidia);
    this.vigiaDeMidia = setTimeout(() => {
      if (this.midia && this.midia.estado !== 'connected' && this._emCurso()) {
        this._semMidia.set(true);
      }
    }, LIMITE_SEM_MIDIA_MS);
  }

  private ligarAudioDoCliente(): void {
    const stream = this.midia?.streamRemoto;
    if (!stream) {
      return;
    }
    if (this.saidaDeAudio.srcObject !== stream) {
      this.saidaDeAudio.srcObject = stream;
    }
    void this.aplicarAltoFalante();
    void this.saidaDeAudio.play().catch(() => {
      this.avisos.atencao('O navegador bloqueou o som da ligação. Clique na página para ouvir.', {
        chave: 'ligacao-som',
      });
    });
    this.midia?.definirMicrofoneAtivo(!this._mudo());
  }

  private async aplicarAltoFalante(): Promise<void> {
    const id = this._altoFalanteId();
    const saida = this.saidaDeAudio as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (!saida.setSinkId) {
      return;
    }
    try {
      await saida.setSinkId(id ?? '');
    } catch {
      this.avisos.atencao(
        'Não foi possível usar este alto-falante. O som sai pelo padrão do sistema.',
        {
          chave: 'ligacao-altofalante',
        },
      );
    }
  }

  private fecharMidia(): void {
    this.encerrarGravacao();
    clearInterval(this.medidor);
    clearTimeout(this.vigiaDeMidia);
    this.medidor = undefined;
    this.midia?.fechar();
    this.midia = null;
    if (!this.saidaDeAudio.paused) {
      this.saidaDeAudio.pause();
    }
    this.saidaDeAudio.srcObject = null;
    this._streamLocal.set(null);
    this._streamRemoto.set(null);
  }

  // ----- Gravação (E3) ------------------------------------------------------------------------

  /**
   * Começa a gravar (o canal grava) e toca o áudio de aviso para o cliente, se houver. Só roda
   * nesta aba, que tem o áudio da ligação.
   */
  private comecarGravacao(info: { id: string; canalId: string }): void {
    if (this.gravador || !this.midia) {
      return;
    }
    const ambiente = this.ambiente.gravador ?? AMBIENTE_DO_NAVEGADOR;
    if (!ambiente.suportado()) {
      this.avisos.atencao(
        'Este navegador não consegue gravar a ligação. Ela segue sem gravação; use o Chrome, o Edge ou o Firefox atualizados.',
        { chave: 'ligacao-gravacao' },
      );
      return;
    }
    const sessao = this.midia;
    const geracao = this.geracao;
    const iniciar = (remoto: MediaStream) => {
      const local = sessao.streamLocal;
      if (geracao !== this.geracao || this.gravador || !local) {
        return;
      }
      const gravador = new Gravador({
        ligacaoId: info.id,
        envio: this.injetor.get(GravacaoApi),
        ambiente,
        aoMudar: (_situacao, falha) => this._gravacaoComFalha.set(falha),
      });
      if (gravador.iniciar(local, remoto)) {
        this.gravador = gravador;
        this._gravando.set(true);
        void this.tocarAviso(info.canalId, geracao, ambiente);
      } else {
        this.avisos.atencao('Não foi possível iniciar a gravação. A ligação segue sem gravar.', {
          chave: 'ligacao-gravacao',
        });
      }
    };
    const remoto = sessao.streamRemoto;
    if (remoto) {
      iniciar(remoto);
    } else {
      sessao.aoReceberAudio(iniciar);
    }
  }

  private async tocarAviso(
    canalId: string,
    geracao: number,
    ambiente: AmbienteDoGravador,
  ): Promise<void> {
    try {
      const audio = await this.injetor.get(GravacaoApi).audioDeAviso(canalId);
      const sessao = this.midia;
      const local = sessao?.streamLocal;
      const conexao = sessao?.conexao;
      if (!audio || geracao !== this.geracao || !local || !conexao) {
        return;
      }
      this.avisoDeGravacao = tocarAvisoParaOCliente(ambiente, local, conexao, audio);
    } catch {
      // sem aviso sonoro: o atendente avisa de viva voz (o lembrete está na barra)
    }
  }

  /** Fecha a gravação (envia o que falta e finaliza) sem travar o encerramento da ligação. */
  private encerrarGravacao(): void {
    this.avisoDeGravacao?.cancelar();
    this.avisoDeGravacao = null;
    this.paraGravar = null;
    const gravador = this.gravador;
    this.gravador = null;
    if (gravador) {
      void gravador.parar().then(() => {
        if (gravador.situacao === 'falhou') {
          this.avisos.atencao(
            'A gravação da ligação não foi enviada por completo. Parte do áudio pode faltar.',
            { chave: 'ligacao-gravacao-falhou' },
          );
        }
      });
    }
  }

  // ----- Cronômetro e qualidade ---------------------------------------------------------------

  private iniciarRelogio(): void {
    clearInterval(this.relogio);
    const atualizar = () => {
      const inicio = this._emCurso()?.inicioEm;
      this._segundos.set(inicio ? Math.max(0, Math.floor((Date.now() - inicio) / 1000)) : 0);
    };
    atualizar();
    this.relogio = setInterval(atualizar, 1_000);
    if (this.midia && !this.medidor) {
      this.ruinsSeguidas = 0;
      this.medidor = setInterval(() => void this.medir(), INTERVALO_QUALIDADE_MS);
    }
  }

  private async medir(): Promise<void> {
    const sessao = this.midia;
    if (!sessao || this._emCurso()?.fase !== 'em-andamento') {
      return;
    }
    try {
      const qualidade = await sessao.medirQualidade();
      // Duas medições ruins seguidas, para não piscar o aviso por um soluço.
      this.ruinsSeguidas = qualidade === 'ruim' ? this.ruinsSeguidas + 1 : 0;
      this._qualidade.set(
        qualidade === 'ruim' ? (this.ruinsSeguidas >= 2 ? 'ruim' : this._qualidade()) : qualidade,
      );
    } catch {
      // sem estatísticas: sem aviso
    }
  }

  // ----- Encerramento e anotação --------------------------------------------------------------

  private esperarConfirmacaoDoFim(ligacaoId: string): void {
    clearTimeout(this.esperaEncerrar);
    this.esperaEncerrar = setTimeout(
      () => void this.conferirFim(ligacaoId),
      ESPERA_ENCERRAMENTO_MS,
    );
  }

  private async conferirFim(ligacaoId: string): Promise<void> {
    if (this._emCurso()?.id !== ligacaoId) {
      return;
    }
    try {
      const ligacao = await this.api.detalhar(ligacaoId);
      if (!estaAtiva(ligacao.estado)) {
        this.concluirComLigacao(ligacao);
      } else {
        this.esperarConfirmacaoDoFim(ligacaoId);
      }
    } catch {
      this.esperarConfirmacaoDoFim(ligacaoId);
    }
  }

  private async gravarAnotacaoAgora(): Promise<void> {
    clearTimeout(this.gravacaoDaAnotacao);
    const curso = this._emCurso();
    if (!curso?.id || !this.anotacaoPendente) {
      return;
    }
    this.anotacaoPendente = false;
    this._situacaoDaAnotacao.set('salvando');
    try {
      await this.api.anotar(curso.id, this._anotacao().trim() || null);
      this._situacaoDaAnotacao.set('salva');
    } catch {
      this.anotacaoPendente = true;
      this._situacaoDaAnotacao.set('erro');
    }
  }
}

function faseDoEstado(
  estado: EstadoLigacao,
  padrao: FaseDaLigacao = 'em-andamento',
): FaseDaLigacao {
  switch (estado) {
    case 'CHAMANDO':
      return 'chamando';
    case 'TOCANDO':
      return 'tocando';
    case 'EM_ANDAMENTO':
      return 'em-andamento';
    default:
      return padrao;
  }
}

/** "Maria · (11) 99999-0001" para anúncios e títulos. */
export function descricaoDoContato(contato: Pick<ContatoDaLigacao, 'nome' | 'telefone'>): string {
  return `${contato.nome} (${formatarTelefone(contato.telefone)})`;
}
