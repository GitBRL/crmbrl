import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  LucideBriefcaseBusiness,
  LucideBuilding2,
  LucideContact,
  LucideDynamicIcon,
  type LucideIconInput,
  LucidePencil,
  LucideReply,
  LucideX,
} from '@lucide/angular';

import { Avatar } from '../../ui/avatar/avatar';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Compositor, type EnvioCompositor } from '../../ui/mensagens/compositor';
import { gerarId } from '../../ui/tipos';
import { ChatApi, type ItemCitavel } from './chat.api';
import {
  aplicarMarcacoes,
  type ChatCanal,
  type ChatMembro,
  type ChatMensagem,
  filtrarPessoas,
  gatilhoNoCursor,
  LIMITES_CHAT,
  type Marcacao,
  marcacoesPresentes,
  marcarMencao,
  marcarReferencia,
  primeiroNome,
  type RascunhoChat,
  resumoDaCitada,
  textoDasPartes,
  textoParaEdicao,
  type TipoReferencia,
} from './chat.tipos';

/** O que a composição entrega para enviar. */
export interface EnvioChat {
  /** O texto com as marcações da API (`<@id>`, `<negocio:id>`), aparado. */
  readonly texto: string;
  /** O mesmo texto como a pessoa vê (para a bolha enquanto envia). */
  readonly visivel: string;
  readonly anexos: readonly File[];
  readonly audio: boolean;
  readonly respostaA: ChatMensagem | null;
}

/** A edição pronta para salvar. */
export interface EdicaoChat {
  readonly mensagem: ChatMensagem;
  readonly texto: string;
}

type OpcaoSugestao =
  | { readonly tipo: 'pessoa'; readonly id: string; readonly membro: ChatMembro }
  | { readonly tipo: 'item'; readonly id: string; readonly item: ItemCitavel };

interface EstadoSugestoes {
  readonly tipo: 'mencao' | 'referencia';
  readonly inicio: number;
  readonly consulta: string;
}

/** A busca de negócios, contatos e empresas (`#`) começa com duas letras e espera a pausa. */
export const MINIMO_CITAVEL = 2;
export const ESPERA_CITAVEL_MS = 250;

const ROTULO_REFERENCIA: Readonly<Record<TipoReferencia, string>> = {
  negocio: 'Negócio',
  contato: 'Contato',
  empresa: 'Empresa',
};

const ICONE_REFERENCIA: Readonly<Record<TipoReferencia, LucideIconInput>> = {
  negocio: LucideBriefcaseBusiness,
  contato: LucideContact,
  empresa: LucideBuilding2,
};

/**
 * O compositor do Chat da equipe: o `app-compositor` de `ui/mensagens/` com o que é só do chat.
 *
 * - **Menções:** `@` no começo de uma palavra abre as pessoas do canal (filtradas pelo que vem
 *   depois, sem acentos); escolher põe `@Nome` no texto, que vai para a API como `<@id>` e
 *   notifica a pessoa.
 * - **Referências:** `#` procura negócios, contatos e empresas que a pessoa vê; escolher põe
 *   `#Título`, que vai como `<negocio:id>` (vira link na mensagem).
 * - Setas, Enter/Tab e Esc na lista (o foco fica no campo, que aponta para a opção ativa).
 * - **Responder** e **editar** mostram uma faixa acima do campo (Esc cancela); ↑ com o campo
 *   vazio edita a sua última mensagem.
 *
 * O teclado da lista é tratado na fase de captura, antes do compositor (Enter escolhe a pessoa
 * em vez de enviar a mensagem).
 */
@Component({
  selector: 'app-chat-composicao',
  imports: [LucideDynamicIcon, Avatar, BotaoIcone, Compositor],
  templateUrl: './composicao.html',
  styleUrl: './composicao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Composicao {
  readonly canal = input.required<ChatCanal>();
  readonly membros = input<readonly ChatMembro[] | null>(null);
  readonly eu = input<string | null>(null);
  /** Respondendo a esta mensagem (faixa acima do campo). */
  readonly respondendo = model<ChatMensagem | null>(null);
  /** Editando esta mensagem (o campo traz o texto dela). */
  readonly editando = model<ChatMensagem | null>(null);
  /** Rascunho inicial do canal (a página guarda um por canal). */
  readonly rascunhoInicial = input<RascunhoChat | null>(null);

  readonly enviar = output<EnvioChat>();
  readonly salvarEdicao = output<EdicaoChat>();
  /** ↑ com o campo vazio: editar a última mensagem própria. */
  readonly editarUltima = output<void>();
  readonly digitando = output<boolean>();
  /** O rascunho mudou (texto e marcações), para a página guardar. */
  readonly rascunhoMudou = output<RascunhoChat>();

  protected readonly icones = { responder: LucideReply, editar: LucidePencil, cancelar: LucideX };
  protected readonly limite = LIMITES_CHAT.texto;
  protected readonly idLista = gerarId('sugestoes');
  protected readonly texto = signal('');
  protected readonly sugestoes = signal<EstadoSugestoes | null>(null);
  protected readonly ativa = signal(0);
  /** Resultado da busca do `#` (`null`: buscando ou ainda sem letras suficientes). */
  protected readonly citaveis = signal<readonly ItemCitavel[] | null>(null);
  protected readonly falhaCitaveis = signal(false);
  private marcacoes: Marcacao[] = [];
  /** O rascunho de antes de começar a editar (volta ao campo quando a edição termina). */
  private antesDaEdicao: (RascunhoChat & { readonly canalId: string }) | null = null;

  protected readonly opcoes = computed<readonly OpcaoSugestao[]>(() => {
    const estado = this.sugestoes();
    if (!estado) {
      return [];
    }
    if (estado.tipo === 'mencao') {
      const eu = this.eu();
      const candidatos = (this.membros() ?? []).filter(
        (membro) => membro.usuario.id !== eu && membro.usuario.ativo,
      );
      const porNome = filtrarPessoas(
        candidatos.map((membro) => ({ nome: membro.usuario.nome, membro })),
        estado.consulta,
      );
      return porNome.map(({ membro }) => ({ tipo: 'pessoa', id: membro.usuario.id, membro }));
    }
    return (this.citaveis() ?? []).map((item) => ({
      tipo: 'item',
      id: `${item.tipo}:${item.id}`,
      item,
    }));
  });

  /** O que mostrar quando a lista não tem opções. */
  protected readonly avisoSugestoes = computed(() => {
    const estado = this.sugestoes();
    if (!estado || this.opcoes().length) {
      return null;
    }
    if (estado.tipo === 'mencao') {
      return this.membros() === null
        ? 'Carregando as pessoas do canal…'
        : estado.consulta
          ? `Ninguém do canal com “${estado.consulta}”.`
          : 'Não há outras pessoas neste canal para mencionar.';
    }
    if (estado.consulta.trim().length < MINIMO_CITAVEL) {
      return 'Digite o nome de um negócio, contato ou empresa.';
    }
    if (this.falhaCitaveis()) {
      return 'Não foi possível buscar agora. Tente de novo em instantes.';
    }
    return this.citaveis() === null ? 'Buscando…' : `Nada encontrado com “${estado.consulta}”.`;
  });

  protected readonly idAtiva = computed(() =>
    this.sugestoes() && this.opcoes().length ? `${this.idLista}-${this.ativa()}` : null,
  );

  protected readonly placeholder = computed(() => {
    const canal = this.canal();
    if (this.editando()) {
      return 'Edite a mensagem…';
    }
    const nome = canal.tipo === 'DIRETO' ? primeiroNome(canal.nome) : canal.nome;
    return nome.length <= 18 ? `Mensagem para ${nome}` : 'Escreva uma mensagem…';
  });

  protected readonly rotulo = computed(() => `Mensagem para ${this.canal().nome}`);

  protected readonly citada = computed(() => {
    const mensagem = this.respondendo();
    if (!mensagem) {
      return null;
    }
    const texto =
      textoDasPartes(mensagem.partes) || (mensagem.anexo ? `Anexo: ${mensagem.anexo.nome}` : '');
    return {
      autor: mensagem.autor?.id === this.eu() ? 'você' : (mensagem.autor?.nome ?? 'aviso'),
      texto: resumoDaCitada({
        id: mensagem.id,
        autor: null,
        resumo: texto,
        anexoNome: null,
        excluida: mensagem.excluida,
      }),
    };
  });

  private readonly compositor = viewChild.required(Compositor);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly api = inject(ChatApi);
  private readonly anunciador = inject(LiveAnnouncer);
  private readonly injector = inject(Injector);
  private esperaCitaveis: ReturnType<typeof setTimeout> | undefined;
  private pedidoCitaveis = 0;

  constructor() {
    // Rascunho do canal (troca de canal: a página passa o rascunho guardado do novo).
    effect(() => {
      const rascunho = this.rascunhoInicial();
      untracked(() => {
        this.antesDaEdicao = null;
        this.texto.set(rascunho?.texto ?? '');
        this.marcacoes = [...(rascunho?.marcacoes ?? [])];
        this.fecharSugestoes();
      });
    });

    // Editar: o campo recebe o texto da mensagem, com as marcações na forma visível. O que
    // estava sendo escrito volta ao campo quando a edição termina (salva ou cancelada).
    effect(() => {
      const mensagem = this.editando();
      untracked(() => {
        const canalId = this.canal().id;
        if (!mensagem) {
          const antes = this.antesDaEdicao;
          this.antesDaEdicao = null;
          if (antes && antes.canalId === canalId) {
            this.texto.set(antes.texto);
            this.marcacoes = [...antes.marcacoes];
            this.rascunhoMudou.emit({ texto: antes.texto, marcacoes: antes.marcacoes });
          }
          return;
        }
        this.antesDaEdicao ??= { canalId, texto: this.texto(), marcacoes: [...this.marcacoes] };
        const { texto, marcacoes } = textoParaEdicao(mensagem);
        this.respondendo.set(null);
        this.texto.set(texto);
        this.marcacoes = [...marcacoes];
        this.focarNoFim();
      });
    });

    effect(() => {
      if (this.respondendo()) {
        untracked(() => this.compositor().focar());
      }
    });

    // A busca do "#": espera a pausa e só a resposta do último pedido vale.
    effect(() => {
      const estado = this.sugestoes();
      clearTimeout(this.esperaCitaveis);
      const consulta = estado?.tipo === 'referencia' ? estado.consulta.trim() : '';
      untracked(() => {
        this.citaveis.set(null);
        this.falhaCitaveis.set(false);
      });
      if (consulta.length < MINIMO_CITAVEL) {
        return;
      }
      const pedido = ++this.pedidoCitaveis;
      this.esperaCitaveis = setTimeout(() => {
        this.api.citaveis(consulta).then(
          (itens) => pedido === this.pedidoCitaveis && this.citaveis.set(itens),
          () => {
            if (pedido === this.pedidoCitaveis) {
              this.falhaCitaveis.set(true);
              this.citaveis.set([]);
            }
          },
        );
      }, ESPERA_CITAVEL_MS);
    });

    // O campo aponta para a opção ativa (o compositor não usa a própria lista no chat).
    effect(() => {
      const aberta = !!this.sugestoes();
      const ativa = this.idAtiva();
      untracked(() => {
        const campo = this.campo();
        if (!campo) {
          return;
        }
        alternarAtributo(campo, 'aria-controls', aberta ? this.idLista : null);
        alternarAtributo(campo, 'aria-activedescendant', ativa);
      });
    });

    // Anuncia quantas opções há quando a lista abre ou o filtro muda.
    let ultimoAnuncio = '';
    effect(() => {
      const estado = this.sugestoes();
      const total = this.opcoes().length;
      const aviso = this.avisoSugestoes();
      untracked(() => {
        let frase = '';
        if (estado && total) {
          const coisa = estado.tipo === 'mencao' ? 'pessoa' : 'item';
          frase = `${total} ${coisa}${total === 1 ? '' : 's'}. Setas escolhem, Enter insere, Esc fecha.`;
        } else if (estado && aviso && aviso !== 'Buscando…') {
          frase = aviso;
        }
        if (frase && frase !== ultimoAnuncio) {
          void this.anunciador.announce(frase, 'polite');
        }
        ultimoAnuncio = frase;
      });
    });

    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const teclar = (evento: KeyboardEvent) => this.aoTeclar(evento);
      const digitar = (evento: Event) => this.aoMudarCampo(evento.target);
      const mover = (evento: Event) => this.aoMudarCampo(evento.target);
      const sair = (evento: FocusEvent) => {
        if (!this.host.contains(evento.relatedTarget as Node | null)) {
          this.fecharSugestoes();
        }
      };
      this.host.addEventListener('keydown', teclar, true);
      this.host.addEventListener('input', digitar);
      this.host.addEventListener('click', mover);
      this.host.addEventListener('keyup', mover);
      this.host.addEventListener('focusout', sair);
      destroyRef.onDestroy(() => {
        clearTimeout(this.esperaCitaveis);
        this.host.removeEventListener('keydown', teclar, true);
        this.host.removeEventListener('input', digitar);
        this.host.removeEventListener('click', mover);
        this.host.removeEventListener('keyup', mover);
        this.host.removeEventListener('focusout', sair);
      });
    });
  }

  /** Põe o foco no campo. */
  focar(): void {
    this.compositor().focar();
  }

  /** Devolve um envio que falhou antes de chegar à API (o texto volta ao campo). */
  restaurar(envio: EnvioChat): void {
    this.texto.set(envio.visivel);
    this.compositor().restaurar({
      texto: envio.visivel,
      anexos: envio.anexos,
      nota: false,
      audio: envio.audio,
    });
  }

  protected cancelarModo(): void {
    if (this.editando()) {
      // O rascunho de antes volta pelo efeito da edição.
      this.texto.set('');
      this.marcacoes = [];
      this.editando.set(null);
    }
    this.respondendo.set(null);
    this.compositor().focar();
  }

  protected aoEnviar(envio: EnvioCompositor): void {
    const marcacoes = marcacoesPresentes(envio.texto, this.marcacoes);
    const texto = aplicarMarcacoes(envio.texto, marcacoes);
    const editando = this.editando();
    this.marcacoes = [];
    this.fecharSugestoes();
    if (editando) {
      this.editando.set(null);
      this.salvarEdicao.emit({ mensagem: editando, texto });
      return;
    }
    const respostaA = this.respondendo();
    this.respondendo.set(null);
    this.enviar.emit({
      texto,
      visivel: envio.texto,
      anexos: envio.anexos,
      audio: envio.audio,
      respostaA,
    });
  }

  protected aoMudarTexto(texto: string): void {
    this.texto.set(texto);
    if (!this.editando()) {
      this.rascunhoMudou.emit({ texto, marcacoes: marcacoesPresentes(texto, this.marcacoes) });
    }
  }

  protected aoDigitando(ativo: boolean): void {
    if (!this.editando()) {
      this.digitando.emit(ativo);
    }
  }

  protected escolher(opcao: OpcaoSugestao | undefined): void {
    const estado = this.sugestoes();
    const campo = this.campo();
    if (!opcao || !estado || !campo) {
      return;
    }
    const visivel =
      opcao.tipo === 'pessoa' ? `@${opcao.membro.usuario.nome}` : `#${opcao.item.titulo}`;
    const marcacao =
      opcao.tipo === 'pessoa'
        ? marcarMencao(opcao.membro.usuario.id)
        : marcarReferencia(opcao.item.tipo, opcao.item.id);
    const atual = this.texto();
    const fim = campo.selectionStart ?? atual.length;
    const depois = atual.slice(fim);
    const inserido = `${visivel}${depois.startsWith(' ') ? '' : ' '}`;
    const novo = atual.slice(0, estado.inicio) + inserido + depois;
    this.marcacoes = [
      ...this.marcacoes.filter((item) => item.visivel !== visivel),
      { visivel, marcacao },
    ];
    this.texto.set(novo);
    this.fecharSugestoes();
    const cursor = estado.inicio + inserido.length;
    afterNextRender(
      () => {
        const elemento = this.campo();
        elemento?.focus();
        elemento?.setSelectionRange(cursor, cursor);
      },
      { injector: this.injector },
    );
    if (!this.editando()) {
      this.rascunhoMudou.emit({ texto: novo, marcacoes: marcacoesPresentes(novo, this.marcacoes) });
    }
  }

  protected passar(indice: number): void {
    this.ativa.set(indice);
  }

  protected rotuloReferencia(tipo: TipoReferencia): string {
    return ROTULO_REFERENCIA[tipo];
  }

  protected iconeReferencia(tipo: TipoReferencia): LucideIconInput {
    return ICONE_REFERENCIA[tipo];
  }

  // Teclado e cursor -----------------------------------------------------------------------------

  private campo(): HTMLTextAreaElement | null {
    return this.host.querySelector<HTMLTextAreaElement>('textarea');
  }

  private aoTeclar(evento: KeyboardEvent): void {
    if (evento.isComposing || !(evento.target instanceof HTMLTextAreaElement)) {
      return;
    }
    if (this.sugestoes()) {
      const total = this.opcoes().length;
      if ((evento.key === 'ArrowDown' || evento.key === 'ArrowUp') && total) {
        this.engolir(evento);
        const passo = evento.key === 'ArrowDown' ? 1 : -1;
        this.ativa.set((this.ativa() + passo + total) % total);
        return;
      }
      if ((evento.key === 'Enter' || evento.key === 'Tab') && total && !evento.shiftKey) {
        this.engolir(evento);
        this.escolher(this.opcoes()[this.ativa()]);
        return;
      }
      if (evento.key === 'Escape') {
        this.engolir(evento);
        this.fecharSugestoes();
        return;
      }
    }
    if (evento.key === 'Escape' && (this.editando() || this.respondendo())) {
      this.engolir(evento);
      this.cancelarModo();
      return;
    }
    if (
      evento.key === 'ArrowUp' &&
      !evento.shiftKey &&
      !this.editando() &&
      evento.target.value === '' &&
      !this.sugestoes()
    ) {
      this.engolir(evento);
      this.editarUltima.emit();
    }
  }

  private engolir(evento: KeyboardEvent): void {
    evento.preventDefault();
    evento.stopPropagation();
  }

  /** O texto ou o cursor mudou: abre, filtra ou fecha a lista do `@`/`#`. */
  private aoMudarCampo(alvo: EventTarget | null): void {
    if (!(alvo instanceof HTMLTextAreaElement)) {
      return;
    }
    if (alvo.selectionStart !== alvo.selectionEnd) {
      this.fecharSugestoes();
      return;
    }
    const gatilho = gatilhoNoCursor(alvo.value, alvo.selectionStart ?? alvo.value.length);
    if (!gatilho) {
      this.fecharSugestoes();
      return;
    }
    const anterior = this.sugestoes();
    // Com espaço na consulta e nenhuma pessoa: a pessoa só estava escrevendo depois do "@".
    if (gatilho.tipo === 'mencao' && gatilho.consulta.includes(' ')) {
      const pessoas = filtrarPessoas(
        (this.membros() ?? []).map((membro) => ({ nome: membro.usuario.nome })),
        gatilho.consulta,
      );
      if (!pessoas.length) {
        this.fecharSugestoes();
        return;
      }
    }
    if (
      !anterior ||
      anterior.tipo !== gatilho.tipo ||
      anterior.inicio !== gatilho.inicio ||
      anterior.consulta !== gatilho.consulta
    ) {
      this.sugestoes.set(gatilho);
      this.ativa.set(0);
    }
  }

  private fecharSugestoes(): void {
    if (this.sugestoes()) {
      this.sugestoes.set(null);
      this.ativa.set(0);
    }
  }

  private focarNoFim(): void {
    afterNextRender(
      () => {
        const campo = this.campo();
        if (campo) {
          campo.focus();
          campo.setSelectionRange(campo.value.length, campo.value.length);
        }
      },
      { injector: this.injector },
    );
  }
}

function alternarAtributo(elemento: HTMLElement, nome: string, valor: string | null): void {
  if (valor === null) {
    elemento.removeAttribute(nome);
  } else {
    elemento.setAttribute(nome, valor);
  }
}
