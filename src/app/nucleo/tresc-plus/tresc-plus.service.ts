import { HttpClient } from '@angular/common/http';
import {
  computed,
  effect,
  inject,
  Injectable,
  Injector,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';

import { urlApi } from '../api/api';
import { erroDaApi } from '../api/erro-api';
import { AvisosService } from '../avisos.service';
import { SessaoService } from '../sessao/sessao.service';
import { TempoRealService } from '../tempo-real/tempo-real.service';
import { TrescPlusApi } from './tresc-plus.api';
import { LIGACAO_TRESC_TERMINAL } from './tresc-plus.textos';
import type {
  DadosLigarTresc,
  EstadoDaLigacaoTresc,
  EstadoDoAgenteApi,
  EventoTrescAgente,
  EventoTrescLigacao,
  EventoTrescRecebida,
  ModoDoAgente,
  VinculoDoUsuario,
} from './tresc-plus.tipos';

/** A ligação do 3C+ que a barra mostra. */
export interface LigacaoEmCursoTresc {
  readonly id: string;
  readonly estado: EstadoDaLigacaoTresc;
  readonly direcao: 'RECEBIDA' | 'FEITA';
  readonly telefone: string | null;
  readonly nome: string | null;
  readonly contatoId: string | null;
  readonly negocioId: string | null;
  readonly atendidaEm: string | null;
  readonly duracaoSegundos: number | null;
  readonly motivoTexto: string | null;
  /** Início da chamada no relógio do navegador (para contar antes de ser atendida). */
  readonly iniciadaEm: number;
}

/** Quanto tempo o resultado de uma ligação sem qualificação pendente fica na barra. */
export const RESULTADO_VISIVEL_MS = 6000;
/** Quanto tempo o aviso de ligação recebida fica na tela. */
export const RECEBIDA_VISIVEL_MS = 45_000;
/** Rota do Meu perfil (onde se conecta ao 3C+). */
export const ROTA_CONECTAR = '/configuracoes/perfil';
export const ANCORA_CONECTAR = 'conectar-3c';

/**
 * Estado do 3C+ para a casca inteira (R34.8): o vínculo do usuário, o estado do agente, a
 * ligação em curso, a qualificação pendente e o aviso de ligação recebida. Alimenta o painel
 * do agente, a barra, o modal e os botões "Ligar pelo 3C+". Tudo que muda vem do tempo real
 * (`tresc.*`); ao reconectar, a tela pergunta de novo ao servidor.
 */
@Injectable({ providedIn: 'root' })
export class TrescPlusService {
  private readonly api = inject(TrescPlusApi);
  private readonly sessao = inject(SessaoService);
  private readonly avisos = inject(AvisosService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly tempoReal = inject(TempoRealService);
  private readonly injetor = inject(Injector);
  private iniciado = false;

  private readonly _vinculo = signal<VinculoDoUsuario | null>(null);
  private readonly _agente = signal<EstadoDoAgenteApi | null>(null);
  private readonly _ligacao = signal<LigacaoEmCursoTresc | null>(null);
  private readonly _qualificar = signal<{ ligacaoId: string; campanhaId: number | null } | null>(
    null,
  );
  private readonly _recebida = signal<EventoTrescRecebida | null>(null);
  private readonly _carregando = signal(false);
  private readonly _erro = signal<string | null>(null);
  private readonly _entrando = signal(false);
  private readonly _ligando = signal(false);
  private readonly _agindo = signal(false);
  private readonly _modalQualificacaoAberto = signal(false);
  private temporizadorResultado: ReturnType<typeof setTimeout> | undefined;
  private temporizadorRecebida: ReturnType<typeof setTimeout> | undefined;
  private usuarioCarregado: string | null = null;

  readonly vinculo = this._vinculo.asReadonly();
  readonly agente = this._agente.asReadonly();
  readonly ligacao = this._ligacao.asReadonly();
  readonly qualificacaoPendente = this._qualificar.asReadonly();
  readonly recebida = this._recebida.asReadonly();
  readonly carregando = this._carregando.asReadonly();
  /** Mensagem de falha ao consultar o 3C+ (`null`: tudo certo). */
  readonly erro = this._erro.asReadonly();
  /** O vendedor ainda está fora da campanha e a API está entrando por ele para ligar. */
  readonly entrando = this._entrando.asReadonly();
  readonly ligando = this._ligando.asReadonly();
  readonly agindo = this._agindo.asReadonly();
  readonly modalQualificacaoAberto = this._modalQualificacaoAberto.asReadonly();

  readonly vinculado = computed(() => this._vinculo()?.vinculado === true);
  /** A empresa tem a integração configurada (há campanha padrão) ou o usuário já é vinculado. */
  readonly disponivel = computed(
    () => this.vinculado() || (this._agente()?.campanhaPadrao ?? null) !== null,
  );
  /** A tela está esperando o servidor e a conexão ao vivo caiu. */
  readonly reconectando = computed(() => this.tempoReal.estado() === 'reconectando');
  /** Há uma ligação ativa (chamando, tocando ou em andamento): bloqueia nova ligação. */
  readonly ocupado = computed(() => {
    const ligacao = this._ligacao();
    return (
      this._ligando() ||
      (ligacao !== null && !LIGACAO_TRESC_TERMINAL.includes(ligacao.estado)) ||
      this._agente()?.estado === 'em_ligacao'
    );
  });

  constructor() {
    this.tempoReal.ouvir('tresc.agente', (dados) => this.aoAgente(dados));
    this.tempoReal.ouvir('tresc.ligacao', (dados) => this.aoLigacao(dados));
    this.tempoReal.ouvir('tresc.recebida', (dados) => this.aoRecebida(dados));
    this.tempoReal.ouvir('tresc.qualificar', (dados) => {
      this._qualificar.set({ ligacaoId: dados.ligacaoId, campanhaId: dados.campanhaId });
      this._modalQualificacaoAberto.set(true);
    });
    this.tempoReal.aoReconectar(() => {
      if (this.usuarioCarregado) {
        void this.carregar(true);
      }
    });
  }

  /**
   * Começa a acompanhar o usuário da sessão (a casca chama uma vez): consulta o vínculo e o
   * estado do agente ao entrar e zera tudo ao sair. Telas isoladas (e seus testes) não pagam
   * essas consultas.
   */
  iniciar(): void {
    if (this.iniciado) {
      return;
    }
    this.iniciado = true;
    runInInjectionContext(this.injetor, () =>
      effect(() => {
        const usuario = this.sessao.usuario()?.id ?? null;
        untracked(() => {
          if (usuario === this.usuarioCarregado) {
            return;
          }
          this.usuarioCarregado = usuario;
          this.zerar();
          if (usuario) {
            void this.carregar();
          }
        });
      }),
    );
  }

  /** Consulta o vínculo e o estado do agente (`atualizar`: confere no 3C+, não só no CRM). */
  async carregar(atualizar = false): Promise<void> {
    this._carregando.set(true);
    try {
      const vinculo = await this.api.vinculo();
      this._vinculo.set(vinculo);
      const agente = await this.api.agente(atualizar && vinculo.vinculado);
      this._agente.set(agente);
      this._erro.set(null);
      if (agente.estado === 'pos_atendimento' && agente.ligacaoId && this._qualificar() === null) {
        this.pedirQualificacao(agente.ligacaoId, agente.campanha?.id ?? null);
      }
    } catch (falha) {
      this._erro.set(erroDaApi(falha).mensagem);
    } finally {
      this._carregando.set(false);
    }
  }

  /** Depois de conectar ou desconectar no Meu perfil. */
  async aposMudarVinculo(): Promise<void> {
    this.zerar();
    await this.carregar();
  }

  /** Abre o modal de qualificação para uma ligação que ficou esperando. */
  pedirQualificacao(ligacaoId: string, campanhaId: number | null): void {
    this._qualificar.set({ ligacaoId, campanhaId });
    this._modalQualificacaoAberto.set(true);
  }

  fecharModalQualificacao(): void {
    this._modalQualificacaoAberto.set(false);
  }

  /** Qualificou: limpa a pendência e a ligação da barra. */
  qualificada(): void {
    this._qualificar.set(null);
    this._modalQualificacaoAberto.set(false);
    clearTimeout(this.temporizadorResultado);
    this._ligacao.set(null);
  }

  dispensarRecebida(): void {
    clearTimeout(this.temporizadorRecebida);
    this._recebida.set(null);
  }

  irParaConectar(): void {
    void this.router.navigate([ROTA_CONECTAR], { fragment: ANCORA_CONECTAR });
  }

  /**
   * Liga pelo 3C+. Sem vínculo, leva ao Meu perfil. Com o vendedor fora da campanha, a API
   * entra sozinha (a tela mostra "Entrando na campanha…").
   */
  async ligar(dados: DadosLigarTresc, nome: string | null = null): Promise<boolean> {
    if (!this.vinculado()) {
      this.irParaConectar();
      return false;
    }
    if (this.ocupado() || this._qualificar() !== null) {
      this.avisos.atencao(
        this._qualificar()
          ? 'Qualifique a ligação anterior antes de fazer outra.'
          : 'Você já está numa ligação.',
      );
      return false;
    }
    this._ligando.set(true);
    this._entrando.set(this._agente()?.estado === 'desconectado');
    try {
      const criada = await this.api.ligar(dados);
      clearTimeout(this.temporizadorResultado);
      this._ligacao.set({
        id: criada.id,
        estado: criada.estado,
        direcao: 'FEITA',
        telefone: dados.telefone ?? null,
        nome: criada.contato?.nome ?? nome,
        contatoId: criada.contato?.id ?? dados.contatoId ?? null,
        negocioId: criada.negocioId ?? dados.negocioId ?? null,
        atendidaEm: null,
        duracaoSegundos: null,
        motivoTexto: null,
        iniciadaEm: Date.now(),
      });
      return true;
    } catch (falha) {
      this.avisos.erro(falha);
      return false;
    } finally {
      this._ligando.set(false);
      this._entrando.set(false);
    }
  }

  async desligar(): Promise<void> {
    const ligacao = this._ligacao();
    if (!ligacao || this._agindo()) {
      return;
    }
    this._agindo.set(true);
    try {
      await this.api.desligar(ligacao.id);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this._agindo.set(false);
    }
  }

  async entrarNaCampanha(campanhaId?: number, modo?: ModoDoAgente): Promise<boolean> {
    return this.agir(async () => {
      this._entrando.set(true);
      try {
        this._agente.set(await this.api.entrar(campanhaId, modo));
      } finally {
        this._entrando.set(false);
      }
    }, 'Você entrou na campanha.');
  }

  async sairDaCampanha(): Promise<boolean> {
    return this.agir(async () => {
      await this.api.sair();
      await this.carregar();
    }, 'Você saiu da campanha.');
  }

  async entrarNaPausa(intervaloId: number): Promise<boolean> {
    return this.agir(async () => {
      await this.api.entrarNaPausa(intervaloId);
    });
  }

  async voltarDaPausa(): Promise<boolean> {
    return this.agir(async () => {
      await this.api.sairDaPausa();
    });
  }

  private async agir(acao: () => Promise<void>, sucesso?: string): Promise<boolean> {
    if (this._agindo()) {
      return false;
    }
    this._agindo.set(true);
    try {
      await acao();
      if (sucesso) {
        this.avisos.sucesso(sucesso);
      }
      return true;
    } catch (falha) {
      this.avisos.erro(falha);
      return false;
    } finally {
      this._agindo.set(false);
    }
  }

  private zerar(): void {
    clearTimeout(this.temporizadorResultado);
    clearTimeout(this.temporizadorRecebida);
    this._vinculo.set(null);
    this._agente.set(null);
    this._ligacao.set(null);
    this._qualificar.set(null);
    this._recebida.set(null);
    this._modalQualificacaoAberto.set(false);
    this._erro.set(null);
  }

  private aoAgente(dados: EventoTrescAgente): void {
    const atual = this._agente();
    this._agente.set({
      vinculado: true,
      estado: dados.estado,
      desde: dados.desde,
      campanha: dados.campanha,
      modo: dados.modo,
      pausa: dados.pausa,
      ligacaoId: atual?.ligacaoId ?? null,
      campanhaPadrao: atual?.campanhaPadrao ?? null,
    });
    if (this._vinculo()?.vinculado !== true) {
      this._vinculo.update((vinculo) => ({ ...(vinculo ?? {}), vinculado: true }));
    }
    this._entrando.set(false);
    if (dados.erro) {
      this.avisos.atencao(dados.erro);
    }
  }

  private aoLigacao(dados: EventoTrescLigacao): void {
    const atual = this._ligacao();
    const mesma = atual?.id === dados.ligacaoId;
    const terminal = LIGACAO_TRESC_TERMINAL.includes(dados.estado);
    if (!mesma && terminal) {
      return;
    }
    const nome = mesma ? atual.nome : (this._recebida()?.contato?.nome ?? null);
    const proxima: LigacaoEmCursoTresc = {
      id: dados.ligacaoId,
      estado: dados.estado,
      direcao: dados.direcao,
      telefone: dados.telefone ?? atual?.telefone ?? null,
      nome,
      contatoId: dados.contatoId ?? atual?.contatoId ?? null,
      negocioId: dados.negocioId ?? atual?.negocioId ?? null,
      atendidaEm: dados.atendidaEm ?? atual?.atendidaEm ?? null,
      duracaoSegundos: dados.duracaoSegundos,
      motivoTexto: dados.motivoTexto,
      iniciadaEm: mesma ? atual.iniciadaEm : Date.now(),
    };
    clearTimeout(this.temporizadorResultado);
    this._ligacao.set(proxima);
    if (!nome && proxima.contatoId) {
      void this.buscarNome(proxima.id, proxima.contatoId);
    }
    if (terminal) {
      this.temporizadorResultado = setTimeout(() => {
        if (this._qualificar()?.ligacaoId !== dados.ligacaoId) {
          this._ligacao.set(null);
        }
      }, RESULTADO_VISIVEL_MS);
    }
  }

  private async buscarNome(ligacaoId: string, contatoId: string): Promise<void> {
    try {
      const contato = await new Promise<{ nome?: string }>((resolver, rejeitar) =>
        this.http.get<{ nome?: string }>(urlApi('contatos', contatoId)).subscribe({
          next: resolver,
          error: rejeitar,
        }),
      );
      const atual = this._ligacao();
      if (atual?.id === ligacaoId && contato.nome) {
        this._ligacao.set({ ...atual, nome: contato.nome });
      }
    } catch {
      // Sem o nome, a barra mostra o telefone.
    }
  }

  private aoRecebida(dados: EventoTrescRecebida): void {
    clearTimeout(this.temporizadorRecebida);
    this._recebida.set(dados);
    this.temporizadorRecebida = setTimeout(() => this._recebida.set(null), RECEBIDA_VISIVEL_MS);
  }
}
