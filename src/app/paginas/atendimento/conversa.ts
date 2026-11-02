import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideArrowLeftRight,
  LucideBriefcase,
  LucideCircleCheck,
  LucideDynamicIcon,
  LucideFlag,
  LucideFileText,
  LucideHand,
  LucideHistory,
  LucideHourglass,
  LucideLockKeyhole,
  LucidePanelRight,
  LucideRotateCcw,
  LucideTag,
} from '@lucide/angular';
import { Subscription } from 'rxjs';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import {
  acompanharSala,
  aoReceber,
  aoReconectar,
  digitandoEm,
} from '../../nucleo/tempo-real/auxiliares';
import { TempoRealService } from '../../nucleo/tempo-real/tempo-real.service';
import { BotaoLigar } from '../../layout/ligacao/botao-ligar';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Dica } from '../../ui/dica/dica';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { type ItemMenuAcoes, MenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import {
  Compositor,
  type EnvioCompositor,
  type ModoCompositor,
} from '../../ui/mensagens/compositor';
import { ListaMensagens } from '../../ui/mensagens/lista-mensagens';
import type { MensagemConversa } from '../../ui/mensagens/mensagens';
import { tipoDoAnexo } from '../../ui/mensagens/mensagens';
import { Modal } from '../../ui/modal/modal';
import { PainelLateral } from '../../ui/painel-lateral/painel-lateral';
import { Selo } from '../../ui/selo/selo';
import { AtendimentoApi } from './atendimento.api';
import type {
  AlteracaoConversa,
  ConversaDetalhe,
  ConversaResumo,
  MensagemDaConversa,
  Transferencia,
} from './atendimento.tipos';
import {
  CANAL,
  janela24h,
  juntarMensagens,
  nomeDoContato,
  paraMensagemConversa,
  rotaDoNegocio,
  ROTULO_PRIORIDADE,
  slaEstourado,
  variaveisDaConversa,
} from './apresentacao';
import { CriarNegocio } from './criar-negocio';
import { EditarEtiquetas } from './editar-etiquetas';
import { EstadoAtendimento } from './estado-atendimento';
import { HistoricoConversa } from './historico-conversa';
import { PainelContato } from './painel-contato';
import { SeletorTemplate } from './seletor-template';
import { TransferirConversa } from './transferir-conversa';

/** Largura da conversa a partir da qual o painel do contato fica ao lado (senão, por cima). */
export const LARGURA_PAINEL_AO_LADO = 740;
/** Marcar como lida espera um pouco (várias mensagens seguidas viram uma chamada só). */
const ESPERA_LIDA_MS = 800;

/** Uma parte do envio: cada anexo vira uma mensagem (o texto vai junto com o primeiro). */
interface ParteDoEnvio {
  readonly texto: string;
  readonly arquivo: File | null;
  readonly audio: boolean;
}

/** Mensagem ainda sem resposta da API (ou que falhou antes de chegar a ela). */
interface Pendente {
  readonly mensagem: MensagemConversa;
  readonly parte: ParteDoEnvio | null;
  readonly nota: boolean;
}

/**
 * Conversa aberta (`/atendimento/:conversaId`, contrato da Onda A §7): cabeçalho com o contato,
 * o canal, a fila, o responsável e as ações (assumir, transferir, resolver, reabrir, criar
 * negócio, etiquetas, prioridade, aguardando o contato, histórico); as mensagens (bolhas por
 * direção, notas internas, mídia, status de entrega, "digitando"); o compositor com anexos,
 * áudio, respostas rápidas por "/" e o aviso da janela de 24 h da Meta; e o painel do contato
 * ao lado (ou por cima, quando falta largura). Tudo atualiza em tempo real.
 */
@Component({
  selector: 'app-atendimento-conversa',
  imports: [
    Avatar,
    Botao,
    BotaoIcone,
    BotaoLigar,
    Compositor,
    CriarNegocio,
    Dica,
    EditarEtiquetas,
    EstadoVazio,
    Esqueleto,
    HistoricoConversa,
    ListaMensagens,
    LucideDynamicIcon,
    MenuAcoes,
    PainelContato,
    PainelLateral,
    RouterLink,
    Selo,
    TransferirConversa,
    SeletorTemplate,
    Modal,
  ],
  templateUrl: './conversa.html',
  styleUrl: './conversa.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.conversa--com-painel]': 'painelAoLado()',
  },
})
export class Conversa {
  readonly conversaId = input.required<string>();

  protected readonly estado = inject(EstadoAtendimento);
  private readonly api = inject(AtendimentoApi);
  private readonly avisos = inject(AvisosService);
  private readonly sessao = inject(SessaoService);
  private readonly router = inject(Router);
  private readonly documento = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly tempoReal = inject(TempoRealService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  private readonly compositor = viewChild(Compositor);
  private readonly lista = viewChild(ListaMensagens);
  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');

  protected readonly icones = {
    voltar: LucideArrowLeft,
    transferir: LucideArrowLeftRight,
    resolver: LucideCircleCheck,
    reabrir: LucideRotateCcw,
    assumir: LucideHand,
    painel: LucidePanelRight,
    nota: LucideLockKeyhole,
    espera: LucideHourglass,
    negocio: LucideBriefcase,
    etiqueta: LucideTag,
    template: LucideFileText,
  };
  protected readonly ROTULO_PRIORIDADE = ROTULO_PRIORIDADE;

  // Dados ------------------------------------------------------------------------------------

  protected readonly detalhe = signal<ConversaDetalhe | null>(null);
  protected readonly situacao = signal<'carregando' | 'pronta' | 'erro'>('carregando');
  protected readonly falha = signal<ErroApi | null>(null);

  private readonly dtos = signal<readonly MensagemDaConversa[]>([]);
  private readonly pendentes = signal<readonly Pendente[]>([]);
  protected readonly carregandoMensagens = signal(true);
  protected readonly carregandoAnteriores = signal(false);
  private readonly cursor = signal<string | null>(null);
  protected readonly temAnteriores = computed(() => this.cursor() !== null);

  protected readonly acao = signal<string | null>(null);
  protected readonly modo = signal<ModoCompositor>('mensagem');
  /** Rascunho por conversa (fica enquanto a página estiver aberta). */
  private readonly rascunhos = new Map<string, string>();
  protected readonly rascunho = signal('');

  // Modais e painéis -------------------------------------------------------------------------

  protected readonly transferirAberto = signal(false);
  protected readonly etiquetasAberto = signal(false);
  protected readonly negocioAberto = signal(false);
  protected readonly historicoAberto = signal(false);
  /** Painel do contato por cima (quando não cabe ao lado). */
  protected readonly painelSobreposto = signal(false);

  private readonly largura = signal(Number.POSITIVE_INFINITY);
  /** Celular e tablet em pé (< 900px): o painel do contato abre sempre por cima. */
  private readonly telaLarga = signal(true);
  private readonly cabeAoLado = computed(
    () => this.telaLarga() && this.largura() >= LARGURA_PAINEL_AO_LADO,
  );
  protected readonly painelAoLado = computed(
    () => this.estado.painelContato() && this.cabeAoLado(),
  );

  // Derivados --------------------------------------------------------------------------------

  protected readonly nome = computed(() => {
    const detalhe = this.detalhe();
    return detalhe ? nomeDoContato(detalhe.contato) : '';
  });

  protected readonly canal = computed(() => {
    const detalhe = this.detalhe();
    return detalhe ? CANAL[detalhe.canal.tipo] : null;
  });

  protected readonly mensagens = computed<readonly MensagemConversa[]>(() => {
    const contexto = { contato: this.nome() || 'Contato' };
    return [
      ...this.dtos().map((dto) => paraMensagemConversa(dto, contexto)),
      ...this.pendentes().map((pendente) => pendente.mensagem),
    ];
  });

  protected readonly responsavelRotulo = computed(() => {
    const responsavel = this.detalhe()?.responsavel;
    if (!responsavel) {
      return null;
    }
    return responsavel.id === this.sessao.usuario()?.id ? 'você' : responsavel.nome;
  });

  protected readonly janela = computed(() => {
    const detalhe = this.detalhe();
    return detalhe ? janela24h(detalhe, this.estado.agora()) : null;
  });

  protected readonly estourada = computed(() => {
    const detalhe = this.detalhe();
    return !!detalhe && slaEstourado(detalhe, this.estado.agora());
  });

  /** Por que não dá para mandar mensagem ao contato agora (`null` = dá). */
  protected readonly bloqueio = computed(() => {
    const detalhe = this.detalhe();
    if (!detalhe) {
      return null;
    }
    if (detalhe.status === 'RESOLVIDA') {
      return detalhe.acoes.reabrir
        ? 'Esta conversa foi resolvida. Reabra para responder ao contato.'
        : 'Esta conversa foi resolvida.';
    }
    if (!detalhe.podeResponder.pode) {
      return detalhe.podeResponder.motivo || 'Este canal não aceita resposta agora.';
    }
    if (!detalhe.acoes.responder) {
      return detalhe.responsavel
        ? `Esta conversa está com ${detalhe.responsavel.nome}. Peça a transferência para responder.`
        : 'Você não pode responder esta conversa.';
    }
    return null;
  });

  /**
   * Canal de templates (WhatsApp oficial) com a janela de 24 h fechada: o compositor livre dá lugar
   * à lista de templates. Vale a janela do servidor e também a que fechou enquanto a tela ficou aberta.
   */
  protected readonly somenteTemplate = computed(() => {
    const detalhe = this.detalhe();
    if (!detalhe || detalhe.status === 'RESOLVIDA' || !detalhe.acoes.enviarTemplate) {
      return false;
    }
    const janela = this.janela();
    return !!detalhe.podeResponder.apenasTemplate || (!!janela && !janela.aberta);
  });

  /** Janela aberta num canal de templates: o compositor livre fica e o template é um extra. */
  protected readonly templateOpcional = computed(
    () => !!this.detalhe()?.acoes.enviarTemplate && !this.somenteTemplate() && !this.bloqueio(),
  );

  protected readonly avisoDaJanela = computed(() => {
    const detalhe = this.detalhe();
    return (
      detalhe?.podeResponder.motivo ||
      'Passaram mais de 24 horas desde a última mensagem do contato: o WhatsApp só permite enviar um template aprovado.'
    );
  });

  protected readonly textoDaJanela = computed(() =>
    this.detalhe()?.canal.tipo === 'WHATSAPP_OFICIAL'
      ? 'No WhatsApp oficial, a empresa só pode mandar texto livre até 24 horas depois da última mensagem do cliente. Passado esse prazo, só um template aprovado pela Meta. Notas internas continuam liberadas.'
      : 'No Instagram e no Messenger, a Meta só deixa a empresa responder até 24 horas depois da última mensagem do cliente. Passado esse prazo, a conversa só continua quando o cliente escrever de novo. Notas internas continuam liberadas.',
  );

  protected readonly templateAberto = signal(false);

  protected readonly compositorBloqueado = computed(
    () => this.modo() === 'mensagem' && this.bloqueio() !== null,
  );

  protected readonly respostas = computed(() =>
    this.estado.respostas().map(({ id, atalho, titulo, texto }) => ({ id, atalho, titulo, texto })),
  );

  protected readonly variaveis = computed(() => {
    const detalhe = this.detalhe();
    if (!detalhe) {
      return {};
    }
    return variaveisDaConversa(detalhe, this.sessao.usuario(), this.empresa(), this.estado.agora());
  });
  /** Empresa do contato (do painel), para a variável `{{contato.empresa}}`. */
  protected readonly empresa = signal<string | null>(null);

  protected readonly digitando = digitandoEm(
    () => (this.conversaId() ? { conversaId: this.conversaId() } : null),
    { nomeDoContato: () => this.nome() },
  );
  protected readonly nomesDigitando = computed(() => this.digitando().map((pessoa) => pessoa.nome));

  protected readonly acaoPrincipal = computed<'assumir' | 'resolver' | 'reabrir' | null>(() => {
    const acoes = this.detalhe()?.acoes;
    if (!acoes) {
      return null;
    }
    return acoes.assumir
      ? 'assumir'
      : acoes.resolver
        ? 'resolver'
        : acoes.reabrir
          ? 'reabrir'
          : null;
  });

  protected readonly itensMenu = computed<readonly ItemMenuAcoes[]>(() => {
    const detalhe = this.detalhe();
    if (!detalhe) {
      return [];
    }
    const acoes = detalhe.acoes;
    const emAberto = detalhe.status !== 'RESOLVIDA';
    const podeEditar = emAberto && (acoes.transferir || acoes.resolver);
    const principal = this.acaoPrincipal();
    const itens: ItemMenuAcoes[] = [];
    if (acoes.resolver && principal !== 'resolver') {
      itens.push({ id: 'resolver', rotulo: 'Resolver', icone: LucideCircleCheck });
    }
    if (acoes.transferir) {
      itens.push({ id: 'transferir', rotulo: 'Transferir…', icone: LucideArrowLeftRight });
    }
    if (emAberto) {
      itens.push(
        detalhe.status === 'PENDENTE'
          ? {
              id: 'aberta',
              rotulo: 'Voltar para em aberto',
              icone: LucideHourglass,
              desabilitado: !podeEditar,
              motivo: podeEditar ? undefined : 'Só quem atende a conversa muda a situação.',
            }
          : {
              id: 'pendente',
              rotulo: 'Aguardando o contato',
              icone: LucideHourglass,
              desabilitado: !podeEditar,
              motivo: podeEditar ? undefined : 'Só quem atende a conversa muda a situação.',
            },
      );
      const urgente = detalhe.prioridade === 'URGENTE' || detalhe.prioridade === 'ALTA';
      itens.push({
        id: urgente ? 'prioridade-normal' : 'prioridade-alta',
        rotulo: urgente ? 'Prioridade normal' : 'Marcar como prioridade alta',
        icone: LucideFlag,
        desabilitado: !podeEditar,
        motivo: podeEditar ? undefined : 'Só quem atende a conversa muda a prioridade.',
      });
    }
    itens.push({
      id: 'etiquetas',
      rotulo: 'Etiquetas…',
      icone: LucideTag,
      desabilitado: !podeEditar,
      motivo: podeEditar ? undefined : 'Só quem atende uma conversa em aberto muda as etiquetas.',
    });
    if (detalhe.negocio) {
      itens.push({
        id: 'abrir-negocio',
        rotulo: 'Abrir o negócio',
        icone: LucideBriefcase,
        separarAntes: true,
      });
    } else {
      itens.push({
        id: 'negocio',
        rotulo: 'Criar negócio…',
        icone: LucideBriefcase,
        separarAntes: true,
        desabilitado: !acoes.criarNegocio,
        motivo: acoes.criarNegocio ? undefined : 'Seu papel não cria negócios para este contato.',
      });
    }
    itens.push({ id: 'historico', rotulo: 'Histórico de atendimento', icone: LucideHistory });
    return itens;
  });

  private carga: Subscription | null = null;
  private esperaLida: ReturnType<typeof setTimeout> | undefined;
  private esperaDetalhe: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    acompanharSala(() => (this.conversaId() ? { tipo: 'conversa', id: this.conversaId() } : null));

    // Trocar de conversa: guarda o rascunho, limpa e carrega a nova.
    effect((aoLimpar) => {
      const id = this.conversaId();
      untracked(() => {
        this.estado.selecionadaId.set(id);
        this.abrir(id);
      });
      aoLimpar(() => this.rascunhos.set(id, untracked(this.rascunho)));
    });

    // Atalhos da página (Alt+M, Alt+C).
    effect(() => {
      const pedido = this.estado.foco();
      if (!pedido || (pedido.alvo !== 'compositor' && pedido.alvo !== 'contato')) {
        return;
      }
      untracked(() => {
        this.estado.foco.set(null);
        if (pedido.alvo === 'compositor') {
          this.compositor()?.focar();
        } else {
          this.mostrarContato(true);
        }
      });
    });

    aoReceber('mensagem.nova', ({ conversaId, mensagem }) => {
      if (conversaId !== this.conversaId()) {
        return;
      }
      const dto = mensagem as unknown as MensagemDaConversa;
      this.casarPendente(dto);
      this.dtos.update((atuais) => juntarMensagens(atuais, [dto]));
      if (dto.direcao === 'ENTRADA') {
        this.marcarLidaDepois();
      }
      if (dto.direcao === 'SISTEMA') {
        this.conferirDetalhe();
      }
    });
    aoReceber('mensagem.status', (evento) => {
      if (evento.conversaId !== this.conversaId()) {
        return;
      }
      this.dtos.update((atuais) =>
        atuais.map((dto) =>
          dto.id === evento.mensagemId
            ? {
                ...dto,
                status: evento.status,
                erro: evento.erro ?? (evento.status === 'FALHOU' ? dto.erro : null),
              }
            : dto,
        ),
      );
    });
    aoReceber('conversa.atualizada', ({ conversa }) => {
      if (conversa.id !== this.conversaId()) {
        return;
      }
      const resumo = conversa as unknown as ConversaResumo;
      this.detalhe.update((atual) => (atual ? { ...atual, ...resumo } : atual));
      // As ações e o "pode responder" dependem de quem pede: confere no detalhe.
      this.conferirDetalhe();
    });
    aoReconectar(() => this.recarregar());

    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const largas = matchMedia('(min-width: 900px)');
      this.telaLarga.set(largas.matches);
      const aoMudar = (evento: MediaQueryListEvent) => this.telaLarga.set(evento.matches);
      largas.addEventListener('change', aoMudar);
      this.destroyRef.onDestroy(() => largas.removeEventListener('change', aoMudar));
      const observador = new ResizeObserver(([entrada]) =>
        this.largura.set(entrada.contentRect.width),
      );
      observador.observe(this.host.nativeElement);
      this.destroyRef.onDestroy(() => observador.disconnect());
    });
    this.destroyRef.onDestroy(() => {
      this.carga?.unsubscribe();
      clearTimeout(this.esperaLida);
      clearTimeout(this.esperaDetalhe);
      for (const pendente of this.pendentes()) {
        this.liberarPrevia(pendente.mensagem);
      }
    });
  }

  // Carga ------------------------------------------------------------------------------------

  private abrir(id: string): void {
    this.carga?.unsubscribe();
    clearTimeout(this.esperaLida);
    this.detalhe.set(null);
    this.situacao.set('carregando');
    this.falha.set(null);
    this.dtos.set([]);
    this.pendentes.set([]);
    this.cursor.set(null);
    this.carregandoMensagens.set(true);
    this.modo.set('mensagem');
    this.empresa.set(null);
    this.painelSobreposto.set(false);
    this.rascunho.set(this.rascunhos.get(id) ?? '');

    // Um contêiner só para as duas cargas: a do detalhe termina antes e não pode levar junto a
    // das mensagens.
    this.carga = new Subscription();
    this.carga.add(
      this.api.conversa(id).subscribe({
        next: (detalhe) => {
          this.detalhe.set(detalhe);
          this.situacao.set('pronta');
          if (detalhe.naoLidas > 0) {
            this.marcarLidaDepois(0);
          }
        },
        error: (falha: unknown) => {
          this.falha.set(erroDaApi(falha));
          this.situacao.set('erro');
        },
      }),
    );
    this.carga.add(
      this.api.mensagens(id).subscribe({
        next: (pagina) => {
          this.dtos.set(juntarMensagens([], pagina.itens));
          this.cursor.set(pagina.proximoCursor);
          this.carregandoMensagens.set(false);
        },
        error: () => this.carregandoMensagens.set(false),
      }),
    );
  }

  /** Depois de reconectar: o detalhe e as mensagens mais novas (sem perder as já carregadas). */
  private recarregar(): void {
    const id = this.conversaId();
    this.conferirDetalhe(0);
    this.api.mensagens(id).subscribe({
      next: (pagina) => {
        if (id === this.conversaId()) {
          this.dtos.update((atuais) => juntarMensagens(atuais, pagina.itens));
        }
      },
      error: () => undefined,
    });
  }

  protected conferirDetalhe(espera = 400): void {
    clearTimeout(this.esperaDetalhe);
    this.esperaDetalhe = setTimeout(() => {
      const id = this.conversaId();
      this.api.conversa(id).subscribe({
        next: (detalhe) => {
          if (id === this.conversaId()) {
            this.detalhe.set(detalhe);
          }
        },
        error: () => undefined,
      });
    }, espera);
  }

  protected carregarAnteriores(): void {
    const cursor = this.cursor();
    if (!cursor || this.carregandoAnteriores()) {
      return;
    }
    const id = this.conversaId();
    this.carregandoAnteriores.set(true);
    this.api.mensagens(id, cursor).subscribe({
      next: (pagina) => {
        if (id === this.conversaId()) {
          this.dtos.update((atuais) => juntarMensagens(atuais, pagina.itens));
          this.cursor.set(pagina.proximoCursor);
        }
        this.carregandoAnteriores.set(false);
      },
      error: (falha: unknown) => {
        this.carregandoAnteriores.set(false);
        this.avisos.erro(falha);
      },
    });
  }

  protected tentarAbrirDeNovo(): void {
    this.abrir(this.conversaId());
  }

  private marcarLidaDepois(espera = ESPERA_LIDA_MS): void {
    clearTimeout(this.esperaLida);
    this.esperaLida = setTimeout(() => {
      if (this.documento.visibilityState === 'hidden') {
        // Volta a tentar quando a aba aparecer de novo.
        this.documento.addEventListener('visibilitychange', () => this.marcarLidaDepois(0), {
          once: true,
        });
        return;
      }
      const id = this.conversaId();
      this.estado.marcarLidaNaLista(id);
      this.api.marcarLida(id).catch(() => undefined);
    }, espera);
  }

  // Ações ------------------------------------------------------------------------------------

  /** Aplica a resposta de uma ação: o detalhe, a linha da lista e o aviso. */
  private aplicar(detalhe: ConversaDetalhe): void {
    if (detalhe.id === this.conversaId()) {
      this.detalhe.set(detalhe);
    }
    this.estado.receber(detalhe);
  }

  private async executar(
    nome: string,
    acao: () => Promise<ConversaDetalhe>,
    sucesso: (detalhe: ConversaDetalhe) => void,
  ): Promise<boolean> {
    if (this.acao()) {
      return false;
    }
    this.acao.set(nome);
    try {
      const detalhe = await acao();
      this.aplicar(detalhe);
      sucesso(detalhe);
      return true;
    } catch (falha) {
      const erro = erroDaApi(falha);
      this.avisos.erro(falha);
      if (erro.status === 409 || erro.status === 422) {
        this.conferirDetalhe(0);
      }
      return false;
    } finally {
      this.acao.set(null);
    }
  }

  protected agirPrincipal(): void {
    switch (this.acaoPrincipal()) {
      case 'assumir':
        void this.assumir();
        break;
      case 'resolver':
        void this.resolver();
        break;
      case 'reabrir':
        void this.reabrir();
        break;
    }
  }

  protected async assumir(): Promise<void> {
    const id = this.conversaId();
    await this.executar(
      'assumir',
      () => this.api.assumir(id),
      () => {
        this.avisos.sucesso('A conversa agora é sua.');
        this.compositor()?.focar();
      },
    );
  }

  protected async resolver(): Promise<void> {
    const id = this.conversaId();
    const canal = this.estado.canais().find((item) => item.id === this.detalhe()?.canal.id);
    await this.executar(
      'resolver',
      () => this.api.resolver(id, true),
      (detalhe) => {
        const pesquisa = detalhe.satisfacao.solicitadaEm && canal?.pesquisaSatisfacao !== false;
        this.avisos.sucesso(
          pesquisa
            ? 'Conversa resolvida. O contato recebeu a pesquisa de satisfação.'
            : 'Conversa resolvida.',
          {
            acao: detalhe.acoes.reabrir
              ? { rotulo: 'Desfazer', executar: () => void this.reabrir(id) }
              : undefined,
          },
        );
      },
    );
  }

  protected async reabrir(id = this.conversaId()): Promise<void> {
    await this.executar(
      'reabrir',
      () => this.api.reabrir(id),
      () => this.avisos.sucesso('Conversa reaberta.'),
    );
  }

  protected async transferir(transferencia: Transferencia): Promise<void> {
    const id = this.conversaId();
    const ok = await this.executar(
      'transferir',
      () => this.api.transferir(id, transferencia),
      (detalhe) => {
        const destino = detalhe.responsavel
          ? detalhe.responsavel.id === this.sessao.usuario()?.id
            ? 'você'
            : detalhe.responsavel.nome
          : `a fila ${detalhe.fila?.nome ?? ''}`.trim();
        this.avisos.sucesso(`Conversa transferida para ${destino}.`);
      },
    );
    if (ok) {
      this.transferirAberto.set(false);
      // Quem é membro da equipe deixa de ver a conversa que passou para outra pessoa (R12).
      const detalhe = this.detalhe();
      const comigo = detalhe?.responsavel?.id === this.sessao.usuario()?.id;
      if (!comigo && !this.sessao.ehDiretoria() && !this.sessao.ehLider()) {
        void this.router.navigate(['/atendimento']);
      }
    }
  }

  protected async alterar(alteracao: AlteracaoConversa, mensagem: string): Promise<boolean> {
    const id = this.conversaId();
    return this.executar(
      'alterar',
      () => this.api.atualizar(id, alteracao),
      () => this.avisos.sucesso(mensagem),
    );
  }

  protected async salvarEtiquetas(etiquetas: readonly string[]): Promise<void> {
    if (await this.alterar({ etiquetas }, 'Etiquetas salvas.')) {
      this.etiquetasAberto.set(false);
      this.estado.recarregarEtiquetas();
    }
  }

  protected aoCriarNegocio(negocio: { readonly id: string }): void {
    this.negocioAberto.set(false);
    this.conferirDetalhe(0);
    this.api.conversa(this.conversaId()).subscribe({
      next: (detalhe) => {
        this.aplicar(detalhe);
        const rota = detalhe.negocio ? rotaDoNegocio(detalhe.negocio) : null;
        this.avisos.sucesso('Negócio criado e ligado a esta conversa.', {
          acao: rota
            ? { rotulo: 'Abrir', executar: () => void this.router.navigate(rota) }
            : undefined,
        });
      },
      error: () => this.avisos.sucesso(`Negócio criado (${negocio.id.slice(0, 8)}).`),
    });
  }

  protected escolher(item: ItemMenuAcoes): void {
    const detalhe = this.detalhe();
    switch (item.id) {
      case 'resolver':
        void this.resolver();
        break;
      case 'transferir':
        this.transferirAberto.set(true);
        break;
      case 'pendente':
        void this.alterar({ status: 'PENDENTE' }, 'Conversa marcada como aguardando o contato.');
        break;
      case 'aberta':
        void this.alterar({ status: 'ABERTA' }, 'A conversa voltou para em aberto.');
        break;
      case 'prioridade-alta':
        void this.alterar({ prioridade: 'ALTA' }, 'Prioridade alta.');
        break;
      case 'prioridade-normal':
        void this.alterar({ prioridade: 'NORMAL' }, 'Prioridade normal.');
        break;
      case 'etiquetas':
        this.etiquetasAberto.set(true);
        break;
      case 'negocio':
        this.negocioAberto.set(true);
        break;
      case 'abrir-negocio':
        if (detalhe?.negocio) {
          void this.router.navigate(rotaDoNegocio(detalhe.negocio));
        }
        break;
      case 'historico':
        this.historicoAberto.set(true);
        break;
    }
  }

  /** Mostra o painel do contato: ao lado (desktop) ou por cima (sem espaço). */
  protected mostrarContato(focar = false): void {
    if (this.cabeAoLado()) {
      this.estado.painelContato.set(true);
      if (focar) {
        afterNextRender(
          () =>
            this.host.nativeElement
              .querySelector<HTMLElement>('.conversa__painel [tabindex="-1"]')
              ?.focus(),
          { injector: this.injector },
        );
      }
    } else {
      this.painelSobreposto.set(true);
    }
  }

  protected alternarContato(): void {
    if (this.cabeAoLado()) {
      this.estado.painelContato.update((aberto) => !aberto);
    } else {
      this.painelSobreposto.set(true);
    }
  }

  protected rotaNegocio(conversa: ConversaDetalhe): readonly string[] | null {
    return conversa.negocio ? rotaDoNegocio(conversa.negocio) : null;
  }

  protected focarTitulo(): void {
    this.titulo()?.nativeElement.focus();
  }

  // Envio ------------------------------------------------------------------------------------

  protected aoMudarRascunho(texto: string): void {
    this.rascunho.set(texto);
  }

  protected escreverNota(): void {
    this.modo.set('nota');
    afterNextRender(() => this.compositor()?.focar(), { injector: this.injector });
  }

  /** Um template foi enviado (no painel fora da janela ou no modal): a bolha entra na conversa. */
  protected aoEnviarTemplate(dto: MensagemDaConversa): void {
    this.templateAberto.set(false);
    this.dtos.update((atuais) => juntarMensagens(atuais, [dto]));
    this.lista()?.rolarParaOFim('smooth');
    this.conferirDetalhe(0);
  }

  protected async enviar(envio: EnvioCompositor): Promise<void> {
    const id = this.conversaId();
    if (envio.nota) {
      await this.enviarNota(id, envio);
      return;
    }
    if (this.bloqueio()) {
      this.compositor()?.restaurar(envio);
      this.avisos.atencao(this.bloqueio()!);
      return;
    }
    const partes: ParteDoEnvio[] = envio.anexos.length
      ? envio.anexos.map((arquivo, indice) => ({
          texto: indice === 0 ? envio.texto : '',
          arquivo,
          audio: envio.audio,
        }))
      : [{ texto: envio.texto, arquivo: null, audio: false }];
    const locais = partes.map((parte) => this.criarPendente(parte, false));
    this.pendentes.update((atuais) => [...atuais, ...locais]);
    this.lista()?.rolarParaOFim('smooth');

    for (let indice = 0; indice < locais.length; indice++) {
      const falha = await this.enviarParte(id, locais[indice]);
      if (falha && indice === 0) {
        // Nada saiu: tira as bolhas, devolve tudo ao compositor e diz por quê.
        this.removerPendentes(locais.map((local) => local.mensagem.id));
        if (id === this.conversaId()) {
          this.compositor()?.restaurar(envio);
        }
        this.avisos.erro(falha);
        return;
      }
    }
  }

  private async enviarNota(id: string, envio: EnvioCompositor): Promise<void> {
    if (envio.anexos.length) {
      this.compositor()?.restaurar(envio);
      this.avisos.atencao(
        'Notas internas levam só texto. Para mandar o arquivo, envie como mensagem.',
      );
      return;
    }
    const local = this.criarPendente({ texto: envio.texto, arquivo: null, audio: false }, true);
    this.pendentes.update((atuais) => [...atuais, local]);
    this.lista()?.rolarParaOFim('smooth');
    try {
      const dto = await this.api.nota(id, envio.texto);
      this.removerPendentes([local.mensagem.id]);
      if (id === this.conversaId()) {
        this.dtos.update((atuais) => juntarMensagens(atuais, [dto]));
      }
    } catch (falha) {
      this.removerPendentes([local.mensagem.id]);
      if (id === this.conversaId()) {
        this.compositor()?.restaurar(envio);
      }
      this.avisos.erro(falha);
    }
  }

  /**
   * Sobe o anexo (se houver) e envia; na falha, a bolha mostra o motivo e "Tentar de novo" e a
   * falha volta para quem chamou (`null` = enviada).
   */
  private async enviarParte(id: string, pendente: Pendente): Promise<unknown> {
    const parte = pendente.parte!;
    try {
      let arquivoId: string | undefined;
      if (parte.arquivo) {
        const arquivo = await this.api.enviarArquivo(parte.arquivo);
        arquivoId = arquivo.id;
      }
      const dto = await this.api.enviar(id, {
        ...(parte.texto ? { texto: parte.texto } : {}),
        ...(arquivoId ? { arquivoId } : {}),
      });
      this.removerPendentes([pendente.mensagem.id]);
      if (id === this.conversaId()) {
        this.dtos.update((atuais) => juntarMensagens(atuais, [dto]));
        if (!this.detalhe()?.responsavel) {
          this.conferirDetalhe(0);
        }
      }
      return null;
    } catch (falha) {
      const erro = erroDaApi(falha);
      this.pendentes.update((atuais) =>
        atuais.map((item) =>
          item.mensagem.id === pendente.mensagem.id
            ? { ...item, mensagem: { ...item.mensagem, status: 'FALHOU', erro: erro.mensagem } }
            : item,
        ),
      );
      if (erro.status === 422) {
        this.conferirDetalhe(0);
      }
      return falha;
    }
  }

  protected async tentarDeNovo(mensagem: MensagemConversa): Promise<void> {
    const local = this.pendentes().find((pendente) => pendente.mensagem.id === mensagem.id);
    if (local?.parte) {
      const reiniciado: Pendente = {
        ...local,
        mensagem: { ...local.mensagem, status: 'PENDENTE', erro: null },
      };
      this.pendentes.update((atuais) =>
        atuais.map((item) => (item.mensagem.id === mensagem.id ? reiniciado : item)),
      );
      const falha = await this.enviarParte(this.conversaId(), reiniciado);
      if (falha) {
        this.avisos.erro(falha);
      }
      return;
    }
    try {
      const dto = await this.api.reenviar(this.conversaId(), mensagem.id);
      this.dtos.update((atuais) => juntarMensagens(atuais, [dto]));
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  private criarPendente(parte: ParteDoEnvio, nota: boolean): Pendente {
    const usuario = this.sessao.usuario();
    const arquivo = parte.arquivo;
    const tipo = !arquivo
      ? 'TEXTO'
      : ({ imagem: 'IMAGEM', video: 'VIDEO', audio: 'AUDIO', documento: 'DOCUMENTO' } as const)[
          tipoDoAnexo(arquivo.type, arquivo.name)
        ];
    return {
      parte,
      nota,
      mensagem: {
        id: `local:${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
        direcao: nota ? 'INTERNA' : 'SAIDA',
        tipo,
        texto: parte.texto || null,
        anexo: arquivo
          ? {
              nome: arquivo.name,
              mime: arquivo.type || 'application/octet-stream',
              url: URL.createObjectURL(arquivo),
              tamanho: arquivo.size,
            }
          : null,
        status: nota ? null : 'PENDENTE',
        criadaEm: new Date(),
        autor: usuario ? { id: usuario.id, nome: usuario.nome, foto: usuario.avatarUrl } : null,
      },
    };
  }

  private removerPendentes(ids: readonly string[]): void {
    const remover = new Set(ids);
    for (const pendente of this.pendentes()) {
      if (remover.has(pendente.mensagem.id)) {
        this.liberarPrevia(pendente.mensagem);
      }
    }
    this.pendentes.update((atuais) => atuais.filter((item) => !remover.has(item.mensagem.id)));
  }

  private liberarPrevia(mensagem: MensagemConversa): void {
    if (mensagem.anexo?.url.startsWith('blob:')) {
      URL.revokeObjectURL(mensagem.anexo.url);
    }
  }

  /**
   * A mensagem que eu mesmo enviei chegou pelo tempo real antes da resposta do envio: a bolha
   * provisória sai (a resposta do envio depois só confirma a mesma mensagem, pelo id).
   */
  private casarPendente(dto: MensagemDaConversa): void {
    const meu = this.sessao.usuario()?.id;
    if (!meu || dto.autor?.id !== meu || (dto.direcao !== 'SAIDA' && dto.direcao !== 'INTERNA')) {
      return;
    }
    const igual = this.pendentes().find(
      (pendente) =>
        pendente.mensagem.status !== 'FALHOU' &&
        pendente.mensagem.direcao === dto.direcao &&
        (pendente.mensagem.texto ?? '') === (dto.texto ?? '') &&
        (pendente.mensagem.anexo?.nome ?? null) === (dto.arquivo?.nome ?? null),
    );
    if (igual) {
      this.removerPendentes([igual.mensagem.id]);
    }
  }
}
