import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  type ElementRef,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideCircleHelp,
  LucideHistory,
  LucideMessageSquarePlus,
  LucideSend,
  LucideThumbsDown,
  LucideThumbsUp,
  LucideTicketPlus,
} from '@lucide/angular';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Modal } from '../../ui/modal/modal';
import { PainelLateral } from '../../ui/painel-lateral/painel-lateral';
import { AjudaApi } from './ajuda.api';
import {
  ROTULO_CATEGORIA,
  type Avaliacao,
  type CategoriaAssistente,
  type ChamadoDto,
  type DetalheConversa,
  type EstadoAssistente,
  type EventoPergunta,
  type PerguntaDto,
  type ResumoConversa,
} from './ajuda.tipos';
import { MarkdownSimples } from './markdown';

/** Aviso padrão quando o estado ainda não chegou. */
export const AVISO_PADRAO =
  'As perguntas ficam registradas e o administrador do CRM pode lê-las. Não escreva dados de clientes.';

/** Uma pergunta e a resposta do assistente na conversa aberta. */
export interface Turno {
  readonly chave: number;
  readonly id: string | null;
  readonly pergunta: string;
  readonly status: 'andamento' | 'ok' | 'erro';
  readonly etapa: 'enviando' | 'pensando' | 'escrevendo';
  readonly retentando: boolean;
  readonly resposta: string;
  readonly erro: string | null;
  readonly categoria: CategoriaAssistente | null;
  readonly resolvido: boolean | null;
  readonly resumoDoPedido: string | null;
  readonly podeAbrirChamado: boolean;
  readonly avaliacao: Avaliacao | null;
  readonly chamado: ChamadoDto | null;
}

export const EXEMPLOS = [
  'Como crio um negócio no funil?',
  'Como importo contatos de uma planilha?',
  'Quem pode ver a auditoria?',
] as const;

const INTERVALO_CHAMADO_MS = 2500;
const INTERVALO_LENTO_MS = 15000;

/** Texto corrido da resposta (sem marcas de Markdown), para o leitor de tela. */
export function textoPuro(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mensagem humana para um erro que veio antes do streaming. */
export function mensagemDoErro(falha: ErroApi): string {
  const motivo = falha.detalhes?.['motivo'];
  switch (falha.status) {
    case 0:
      return 'Sem conexão com o CRM. Confira a internet e tente de novo.';
    case 409:
      return 'Ainda estou respondendo a pergunta anterior desta conversa. Espere um instante.';
    case 429:
      return motivo === 'orcamento_mensal'
        ? 'O orçamento de uso da IA neste mês acabou. Fale com o administrador.'
        : motivo === 'desligado'
          ? 'O assistente está desligado pelo administrador.'
          : 'Você chegou ao limite de perguntas de hoje. Volte amanhã.';
    case 503:
      return motivo === 'base_vazia'
        ? 'O assistente ainda não tem a base de ajuda carregada. Fale com o administrador.'
        : 'O assistente ainda não foi configurado. Fale com o administrador.';
    case 422:
      return 'Esta conversa chegou ao limite ou mudou de contexto. Comece uma nova conversa.';
    case 404:
      return 'Não encontrei esta conversa. Comece uma nova.';
    default:
      return falha.resumo;
  }
}

export function turnoDaPergunta(chave: number, p: PerguntaDto): Turno {
  return {
    chave,
    id: p.id,
    pergunta: p.pergunta,
    status: p.status === 'CONCLUIDA' ? 'ok' : p.status === 'FALHOU' ? 'erro' : 'andamento',
    etapa: 'escrevendo',
    retentando: false,
    resposta: p.resposta ?? '',
    erro:
      p.status === 'CONCLUIDA' ? null : (p.erro ?? 'Esta pergunta não chegou a ser respondida.'),
    categoria: p.categoria,
    resolvido: p.resolvido,
    resumoDoPedido: p.resumoDoPedido,
    podeAbrirChamado: p.podeAbrirChamado,
    avaliacao: p.avaliacao,
    chamado: p.chamado,
  };
}

/** Só endereços http(s) viram link. */
export function linkSeguro(link: string | null): string | null {
  return link && /^https?:\/\//i.test(link) ? link : null;
}

/**
 * Botão "Ajuda" da barra superior e o painel lateral de conversa com o assistente (R25).
 * Envia a rota atual com cada pergunta, mostra a resposta em streaming, deixa avaliar
 * (útil / não útil) e, quando a resposta pede, abre um chamado depois da confirmação.
 */
@Component({
  selector: 'app-ajuda',
  imports: [
    AreaTexto,
    Botao,
    BotaoIcone,
    CampoTexto,
    LucideThumbsDown,
    LucideThumbsUp,
    MarkdownSimples,
    Modal,
    PainelLateral,
  ],
  templateUrl: './ajuda.html',
  styleUrl: './ajuda.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Ajuda {
  private readonly api = inject(AjudaApi);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);

  protected readonly icones = {
    ajuda: LucideCircleHelp,
    historico: LucideHistory,
    nova: LucideMessageSquarePlus,
    enviar: LucideSend,
    chamado: LucideTicketPlus,
  };
  protected readonly exemplos = EXEMPLOS;
  protected readonly rotuloCategoria = ROTULO_CATEGORIA;

  protected readonly aberto = signal(false);
  protected readonly estado = signal<EstadoAssistente | null>(null);
  protected readonly falhaEstado = signal<string | null>(null);
  protected readonly turnos = signal<readonly Turno[]>([]);
  protected readonly conversaId = signal<string | null>(null);
  protected readonly texto = signal('');
  protected readonly anuncio = signal('');
  protected readonly modo = signal<'conversa' | 'lista'>('conversa');
  protected readonly conversas = signal<readonly ResumoConversa[] | null>(null);
  protected readonly carregandoConversas = signal(false);
  protected readonly erroConversas = signal<string | null>(null);

  // Chamado
  protected readonly chamadoAberto = signal(false);
  protected readonly turnoDoChamado = signal<Turno | null>(null);
  protected readonly telaDoChamado = signal('/');
  protected readonly chamadoTitulo = signal<string | number>('');
  protected readonly chamadoDescricao = signal('');
  protected readonly enviandoChamado = signal(false);
  protected readonly erroChamado = signal<string | null>(null);

  private readonly rolagem = viewChild<ElementRef<HTMLElement>>('fim');
  private controle: AbortController | null = null;
  private proximaChave = 1;
  private readonly temporizadores = new Map<number, ReturnType<typeof setTimeout>>();

  protected readonly aviso = computed(() => this.estado()?.aviso ?? AVISO_PADRAO);
  protected readonly ocupado = computed(() => this.turnos().some((t) => t.status === 'andamento'));
  protected readonly maxCaracteres = computed(() => this.estado()?.maxCaracteresPergunta ?? 2000);
  protected readonly totalNaConversa = computed(() => this.turnos().length);
  protected readonly conversaCheia = computed(
    () => this.totalNaConversa() >= (this.estado()?.maxPerguntasPorConversa ?? 30),
  );
  protected readonly bloqueio = computed<string | null>(() => {
    const estado = this.estado();
    if (estado && !estado.disponivel) {
      return estado.motivo ?? 'O assistente não está disponível agora.';
    }
    if (estado && estado.perguntasPorDia > 0 && estado.restantesHoje <= 0) {
      return 'Você chegou ao limite de perguntas de hoje. Volte amanhã.';
    }
    if (this.conversaCheia()) {
      return 'Esta conversa chegou ao limite de perguntas. Comece uma nova conversa.';
    }
    return null;
  });
  protected readonly textoValido = computed(() => {
    const tamanho = this.texto().trim().length;
    return tamanho >= 2 && tamanho <= this.maxCaracteres();
  });
  protected readonly podeEnviar = computed(
    () => this.textoValido() && !this.ocupado() && this.bloqueio() === null,
  );
  protected readonly erroDoTitulo = computed(() => {
    const tamanho = String(this.chamadoTitulo()).trim().length;
    return tamanho >= 3 && tamanho <= 200 ? null : 'O título precisa ter de 3 a 200 caracteres.';
  });
  protected readonly erroDaDescricao = computed(() =>
    this.chamadoDescricao().length > 4000 ? 'A descrição passa de 4000 caracteres.' : null,
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.controle?.abort();
      this.temporizadores.forEach((t) => clearTimeout(t));
    });
  }

  protected abrir(): void {
    this.aberto.set(true);
    void this.carregarEstado();
  }

  protected async carregarEstado(): Promise<void> {
    this.falhaEstado.set(null);
    try {
      this.estado.set(await this.api.estado());
    } catch (falha) {
      this.falhaEstado.set(mensagemDoErro(erroDaApi(falha)));
    }
  }

  private limparRota(): string {
    return this.router.url.split('?')[0].split('#')[0] || '/';
  }

  protected usarExemplo(exemplo: string): void {
    this.texto.set(exemplo);
    if (this.podeEnviar()) {
      void this.enviar();
    }
  }

  protected aoTeclar(evento: Event): void {
    const tecla = evento as KeyboardEvent;
    if (tecla.key === 'Enter' && !tecla.shiftKey && !tecla.isComposing) {
      tecla.preventDefault();
      if (this.podeEnviar()) {
        void this.enviar();
      }
    }
  }

  private mudar(chave: number, mudanca: Partial<Turno>): void {
    this.turnos.update((lista) => lista.map((t) => (t.chave === chave ? { ...t, ...mudanca } : t)));
  }

  protected async enviar(): Promise<void> {
    if (!this.podeEnviar()) {
      return;
    }
    const pergunta = this.texto().trim();
    const chave = this.proximaChave++;
    this.texto.set('');
    this.turnos.update((lista) => [
      ...lista,
      {
        chave,
        id: null,
        pergunta,
        status: 'andamento',
        etapa: 'enviando',
        retentando: false,
        resposta: '',
        erro: null,
        categoria: null,
        resolvido: null,
        resumoDoPedido: null,
        podeAbrirChamado: false,
        avaliacao: null,
        chamado: null,
      },
    ]);
    this.anuncio.set('Pergunta enviada. O assistente está pensando…');
    this.rolarAoFim();
    const controle = new AbortController();
    this.controle = controle;
    let terminou = false;
    try {
      for await (const evento of this.api.perguntar(
        pergunta,
        this.limparRota(),
        this.conversaId(),
        controle.signal,
      )) {
        terminou = this.tratar(chave, evento) || terminou;
      }
      if (!terminou && !controle.signal.aborted) {
        this.falhar(chave, 'A conexão caiu antes do fim da resposta. Tente de novo.');
      }
    } catch (falha) {
      const erro = erroDaApi(falha);
      this.falhar(chave, mensagemDoErro(erro));
      if (erro.status === 429 || erro.status === 503) {
        void this.carregarEstado();
      }
    } finally {
      if (this.controle === controle) {
        this.controle = null;
      }
    }
  }

  /** Aplica um evento; devolve `true` quando ele encerra a pergunta. */
  private tratar(chave: number, evento: EventoPergunta): boolean {
    switch (evento.evento) {
      case 'inicio':
        this.conversaId.set(evento.conversaId);
        this.mudar(chave, { id: evento.perguntaId, etapa: 'pensando' });
        return false;
      case 'fase':
        this.mudar(chave, { etapa: evento.fase });
        return false;
      case 'parcial':
        this.mudar(chave, { resposta: evento.resposta, etapa: 'escrevendo', retentando: false });
        this.rolarAoFim();
        return false;
      case 'nova_tentativa':
        this.mudar(chave, { resposta: '', etapa: 'pensando', retentando: true });
        this.anuncio.set('Refazendo a resposta…');
        return false;
      case 'concluido':
        this.mudar(chave, {
          id: evento.perguntaId,
          status: 'ok',
          resposta: evento.resposta,
          categoria: evento.categoria,
          resolvido: evento.resolvido,
          resumoDoPedido: evento.resumoDoPedido,
          podeAbrirChamado: evento.podeAbrirChamado,
          retentando: false,
        });
        this.estado.update((e) =>
          e && evento.restantesHoje !== null ? { ...e, restantesHoje: evento.restantesHoje } : e,
        );
        this.anuncio.set(`Resposta do assistente: ${textoPuro(evento.resposta).slice(0, 1200)}`);
        this.rolarAoFim();
        return true;
      case 'erro':
        if (evento.conversaId) {
          this.conversaId.set(evento.conversaId);
        }
        this.falhar(chave, evento.mensagem);
        return true;
    }
  }

  private falhar(chave: number, mensagem: string): void {
    this.mudar(chave, { status: 'erro', erro: mensagem, retentando: false });
    this.anuncio.set(`Não deu certo: ${mensagem}`);
  }

  protected tentarDeNovo(turno: Turno): void {
    if (this.ocupado()) {
      return;
    }
    this.turnos.update((lista) => lista.filter((t) => t.chave !== turno.chave));
    this.texto.set(turno.pergunta);
    void this.enviar();
  }

  protected novaConversa(): void {
    this.controle?.abort();
    this.controle = null;
    this.turnos.set([]);
    this.conversaId.set(null);
    this.texto.set('');
    this.anuncio.set('Nova conversa.');
    this.modo.set('conversa');
  }

  // Conversas anteriores -------------------------------------------------------------------------

  protected async verConversas(): Promise<void> {
    if (this.modo() === 'lista') {
      this.modo.set('conversa');
      return;
    }
    this.modo.set('lista');
    this.carregandoConversas.set(true);
    this.erroConversas.set(null);
    try {
      this.conversas.set(await this.api.conversas());
    } catch (falha) {
      this.erroConversas.set(mensagemDoErro(erroDaApi(falha)));
    } finally {
      this.carregandoConversas.set(false);
    }
  }

  protected async abrirConversa(resumo: ResumoConversa): Promise<void> {
    this.carregandoConversas.set(true);
    this.erroConversas.set(null);
    try {
      const detalhe: DetalheConversa = await this.api.conversa(resumo.id);
      this.controle?.abort();
      this.conversaId.set(detalhe.id);
      this.turnos.set(detalhe.perguntas.map((p) => turnoDaPergunta(this.proximaChave++, p)));
      this.modo.set('conversa');
      for (const turno of this.turnos()) {
        if (turno.chamado?.status === 'PENDENTE') {
          this.acompanhar(turno.chave, turno.chamado);
        }
      }
      this.rolarAoFim();
    } catch (falha) {
      this.erroConversas.set(mensagemDoErro(erroDaApi(falha)));
    } finally {
      this.carregandoConversas.set(false);
    }
  }

  protected quando(valor: string): string {
    return formatarTempoRelativo(valor);
  }

  // Avaliação -------------------------------------------------------------------------------------

  protected async avaliar(turno: Turno, avaliacao: Avaliacao): Promise<void> {
    if (!turno.id) {
      return;
    }
    const nova = turno.avaliacao === avaliacao ? null : avaliacao;
    const anterior = turno.avaliacao;
    this.mudar(turno.chave, { avaliacao: nova });
    try {
      const salva = await this.api.avaliar(turno.id, nova);
      this.mudar(turno.chave, { avaliacao: salva.avaliacao });
      this.anuncio.set(
        salva.avaliacao === 'UTIL'
          ? 'Avaliação salva: útil.'
          : salva.avaliacao === 'NAO_UTIL'
            ? 'Avaliação salva: não útil.'
            : 'Avaliação removida.',
      );
    } catch (falha) {
      this.mudar(turno.chave, { avaliacao: anterior });
      this.avisos.erro(falha);
    }
  }

  // Chamado ---------------------------------------------------------------------------------------

  protected pedirChamado(turno: Turno): void {
    this.turnoDoChamado.set(turno);
    this.telaDoChamado.set(this.limparRota());
    this.chamadoTitulo.set((turno.resumoDoPedido ?? turno.pergunta).slice(0, 200));
    this.chamadoDescricao.set(turno.pergunta);
    this.erroChamado.set(null);
    this.chamadoAberto.set(true);
  }

  protected async confirmarChamado(): Promise<void> {
    const turno = this.turnoDoChamado();
    if (!turno?.id || this.enviandoChamado() || this.erroDoTitulo() || this.erroDaDescricao()) {
      return;
    }
    this.enviandoChamado.set(true);
    this.erroChamado.set(null);
    try {
      const chamado = await this.api.abrirChamado(turno.id, {
        titulo: String(this.chamadoTitulo()).trim(),
        descricao: this.chamadoDescricao().trim() || undefined,
      });
      this.mudar(turno.chave, { chamado });
      this.chamadoAberto.set(false);
      this.anuncio.set('Chamado enviado para a fila. Vou avisar quando tiver o número.');
      this.acompanhar(turno.chave, chamado);
    } catch (falha) {
      const erro = erroDaApi(falha);
      this.erroChamado.set(
        erro.status === 503
          ? 'O destino dos chamados ainda não foi configurado. Fale com o administrador.'
          : erro.status === 409
            ? 'Esta pergunta já tem um chamado.'
            : erro.resumo,
      );
    } finally {
      this.enviandoChamado.set(false);
    }
  }

  private acompanhar(chave: number, chamado: ChamadoDto): void {
    clearTimeout(this.temporizadores.get(chave));
    if (chamado.status !== 'PENDENTE') {
      this.temporizadores.delete(chave);
      return;
    }
    const espera =
      chamado.proximaTentativaEm && Date.parse(chamado.proximaTentativaEm) - Date.now() > 10_000
        ? INTERVALO_LENTO_MS
        : INTERVALO_CHAMADO_MS;
    this.temporizadores.set(
      chave,
      setTimeout(() => void this.consultarChamado(chave, chamado.id), espera),
    );
  }

  private async consultarChamado(chave: number, id: string): Promise<void> {
    try {
      const chamado = await this.api.chamado(id);
      this.mudar(chave, { chamado });
      if (chamado.status === 'ENVIADO') {
        this.anuncio.set(`Chamado aberto. Número ${chamado.numero ?? ''}.`.replace(' .', '.'));
      } else if (chamado.status === 'FALHOU') {
        this.anuncio.set('Não foi possível abrir o chamado.');
      }
      this.acompanhar(chave, chamado);
    } catch {
      // Falha passageira: tenta de novo mais devagar.
      this.temporizadores.set(
        chave,
        setTimeout(() => void this.consultarChamado(chave, id), INTERVALO_LENTO_MS),
      );
    }
  }

  protected situacaoDoChamado(chamado: ChamadoDto): string {
    if (chamado.status === 'ENVIADO') {
      return chamado.numero !== null && chamado.numero !== ''
        ? `Chamado nº ${chamado.numero} aberto.`
        : 'Chamado aberto.';
    }
    if (chamado.status === 'FALHOU') {
      return 'Não foi possível abrir o chamado. O administrador foi avisado e pode reenviar.';
    }
    return chamado.proximaTentativaEm
      ? `Não deu para enviar agora; tentando de novo às ${formatarHora(chamado.proximaTentativaEm)}.`
      : 'Enviando o chamado…';
  }

  protected link(chamado: ChamadoDto): string | null {
    return linkSeguro(chamado.link);
  }

  protected etapaTexto(turno: Turno): string {
    return turno.retentando
      ? 'Refazendo a resposta…'
      : turno.etapa === 'escrevendo'
        ? 'Escrevendo…'
        : 'Pensando…';
  }

  private rolarAoFim(): void {
    queueMicrotask(() => {
      this.rolagem()?.nativeElement.scrollIntoView?.({ block: 'end' });
    });
  }
}
