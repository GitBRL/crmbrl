import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  afterNextRender,
  booleanAttribute,
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
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  LucideDynamicIcon,
  LucideFileText,
  LucideLockKeyhole,
  LucideMic,
  LucidePaperclip,
  LucideSend,
  LucideSquare,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';

import { BotaoIcone } from '../botao-icone/botao-icone';
import { gerarId } from '../tipos';
import { type AudioGravado, GravadorAudio, liberarAudio } from './gravador-audio';
import {
  ACEITAR_ANEXOS,
  duracaoLegivel,
  extensao,
  LIMITES_ANEXO,
  type LimitesAnexo,
  motivoDeRecusa,
  substituirVariaveis,
  tamanhoLegivel,
  tipoDoAnexo,
} from './mensagens';
import { PlayerAudio } from './player-audio';
import { filtrarRespostas, type RespostaRapidaOpcao, RespostasRapidas } from './respostas-rapidas';

/** O que o compositor entrega ao enviar. */
export interface EnvioCompositor {
  /** Texto aparado (vazio num envio só de anexos ou de áudio). */
  readonly texto: string;
  readonly anexos: readonly File[];
  /** Nota interna (só a equipe vê). */
  readonly nota: boolean;
  /** O anexo é um áudio gravado agora (vai como mensagem de voz). */
  readonly audio: boolean;
}

export type ModoCompositor = 'mensagem' | 'nota';

interface AnexoLocal {
  readonly id: string;
  readonly arquivo: File;
  /** `blob:` da miniatura (só imagens). */
  readonly miniatura: string | null;
  readonly detalhe: string;
}

/** Repete o "digitando" no máximo a cada 3 s e para depois de 4 s sem tecla. */
export const INTERVALO_DIGITANDO_MS = 3_000;
export const PAUSA_DIGITANDO_MS = 4_000;

/**
 * Compositor de mensagens (DESIGN-SYSTEM.md §4.6): a pílula de escrever com anexar, o campo que
 * cresce até 6 linhas e, à direita, enviar (círculo invertido) ou gravar áudio.
 *
 * - **Teclado:** Enter envia, Shift+Enter quebra a linha (no toque, Enter quebra e o botão
 *   envia); Ctrl/Cmd+Enter sempre envia.
 * - **Respostas rápidas:** "/" no começo de uma palavra abre a lista filtrada pelo que vem
 *   depois (setas, Enter ou Tab escolhe, Esc fecha); as variáveis (`{{contato.nome}}`) saem de
 *   `variaveis`.
 * - **Anexos:** pelo clipe, colando (Ctrl+V de uma imagem) ou soltando arquivos na pílula;
 *   cada um vira uma pílula com miniatura ou ícone, nome, tamanho e remover. SVG, HTML e o que
 *   passa do limite (R11: 25 MB; documentos 100 MB) são recusados com o motivo.
 * - **Áudio:** grava pelo navegador (lixeira cancela, ■ para e deixa ouvir antes, ➤ envia).
 * - **Nota interna** (`permitirNota`): "Mensagem | Nota interna"; na nota a pílula fica no
 *   coral listrado das notas.
 * - **Bloqueado** (`desabilitado` + `motivo`, ex.: janela de 24 h da Meta): o campo dá lugar ao
 *   motivo.
 *
 * Ao enviar, emite `(enviar)` e se limpa (`restaurar(envio)` devolve tudo se a API falhar).
 * `(digitando)` avisa `true` enquanto a pessoa escreve e `false` quando para.
 *
 * ```html
 * <app-compositor
 *   [respostasRapidas]="respostas()"
 *   [variaveis]="{ 'contato.nome': contato().nome }"
 *   permitirNota
 *   (enviar)="enviar($event)"
 *   (digitando)="tempoReal.digitando({ conversaId }, $event)"
 * />
 * ```
 */
@Component({
  selector: 'app-compositor',
  imports: [BotaoIcone, LucideDynamicIcon, PlayerAudio, RespostasRapidas],
  templateUrl: './compositor.html',
  styleUrl: './compositor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'compositor',
    '[class.compositor--nota]': "modo() === 'nota'",
  },
})
export class Compositor {
  /** Rascunho (`[(texto)]` permite guardar um por conversa). */
  readonly texto = model('');
  readonly modo = model<ModoCompositor>('mensagem');
  /** Nome do campo para o leitor de tela. */
  readonly rotulo = input('Mensagem');
  readonly placeholder = input<string | null>(null);
  readonly respostasRapidas = input<readonly RespostaRapidaOpcao[]>([]);
  readonly variaveis = input<Readonly<Record<string, string | null | undefined>>>({});
  readonly permitirAnexos = input(true, { transform: booleanAttribute });
  readonly permitirAudio = input(true, { transform: booleanAttribute });
  readonly permitirNota = input(false, { transform: booleanAttribute });
  readonly desabilitado = input(false, { transform: booleanAttribute });
  /** Por que não dá para enviar agora (aparece no lugar do campo). */
  readonly motivo = input<string | null>(null);
  /** Envio em andamento: o botão fica ocupado. */
  readonly enviando = input(false, { transform: booleanAttribute });
  readonly limites = input<LimitesAnexo>(LIMITES_ANEXO);
  readonly maximoAnexos = input(10);
  /** Limite de caracteres (o contador aparece perto dele). */
  readonly maximoCaracteres = input<number | null>(null);

  readonly enviar = output<EnvioCompositor>();
  readonly digitando = output<boolean>();

  protected readonly icones = {
    anexar: LucidePaperclip,
    enviar: LucideSend,
    gravar: LucideMic,
    parar: LucideSquare,
    descartar: LucideTrash2,
    remover: LucideX,
    documento: LucideFileText,
    nota: LucideLockKeyhole,
  };
  protected readonly aceitar = ACEITAR_ANEXOS;
  protected readonly gravador = new GravadorAudio();
  protected readonly suportaAudio = GravadorAudio.suportado();
  protected readonly anexos = signal<readonly AnexoLocal[]>([]);
  protected readonly audio = signal<AudioGravado | null>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly arrastando = signal(false);
  protected readonly idCampo = gerarId('compositor');
  protected readonly idLista = gerarId('respostas');
  protected readonly idDica = gerarId('compositor-dica');
  /** O que veio depois da "/" (`null`: lista fechada). */
  protected readonly consulta = signal<string | null>(null);
  protected readonly ativa = signal(0);
  /** Onde começa a "/" que está sendo completada. */
  private inicioBarra = -1;

  protected readonly sugestoes = computed(() => {
    const consulta = this.consulta();
    return consulta === null ? [] : filtrarRespostas(this.respostasRapidas(), consulta);
  });
  protected readonly listaAberta = computed(
    () => this.consulta() !== null && this.respostasRapidas().length > 0,
  );
  protected readonly idAtiva = computed(() =>
    this.listaAberta() && this.sugestoes().length ? `${this.idLista}-${this.ativa()}` : null,
  );
  protected readonly podeEnviar = computed(
    () =>
      !this.desabilitado() &&
      !this.enviando() &&
      (this.texto().trim().length > 0 || this.anexos().length > 0) &&
      !this.passouDoLimite(),
  );
  protected readonly passouDoLimite = computed(() => {
    const maximo = this.maximoCaracteres();
    return maximo !== null && this.texto().length > maximo;
  });
  /** "3.900 de 4.096", perto do limite. */
  protected readonly contador = computed(() => {
    const maximo = this.maximoCaracteres();
    const total = this.texto().length;
    if (maximo === null || total < maximo * 0.8) {
      return null;
    }
    const formatar = (n: number) => new Intl.NumberFormat('pt-BR').format(n);
    return `${formatar(total)} de ${formatar(maximo)}`;
  });
  /** Curto (uma linha também no celular); os atalhos ficam na linha de ajuda. */
  protected readonly textoDoPlaceholder = computed(
    () =>
      this.placeholder() ??
      (this.modo() === 'nota' ? 'Escreva uma nota interna…' : 'Escreva uma mensagem…'),
  );
  /** Linha de ajuda sob a pílula: quem vê a nota, o teclado e o "/" das respostas rápidas. */
  protected readonly dica = computed(() => {
    const atalhos: string[] = [];
    if (!this.toqueAtivo && !this.telaEstreita) {
      atalhos.push('Enter envia, Shift+Enter quebra a linha');
    }
    if (this.respostasRapidas().length) {
      atalhos.push(
        this.toqueAtivo ? 'Digite / para as respostas rápidas' : '/ abre as respostas rápidas',
      );
    }
    const nota = this.modo() === 'nota' ? 'Só a equipe vê as notas internas.' : '';
    return [nota, atalhos.join(' · ')].filter(Boolean).join(' ');
  });
  protected readonly duracaoGravacao = computed(() => duracaoLegivel(this.gravador.segundos()));
  protected readonly mostrarGravar = computed(
    () => this.permitirAudio() && this.suportaAudio && this.modo() === 'mensagem',
  );

  private readonly campo = viewChild<ElementRef<HTMLTextAreaElement>>('campo');
  private readonly seletor = viewChild<ElementRef<HTMLInputElement>>('seletor');
  private readonly anunciador = inject(LiveAnnouncer);
  private readonly injector = inject(Injector);
  /** Tela de toque: Enter quebra a linha e o botão envia. */
  protected readonly toqueAtivo =
    inject(DOCUMENT).defaultView?.matchMedia?.('(pointer: coarse)').matches ?? false;
  /** Celular (mesmo sem toque detectado, como em emuladores): a dica de Shift+Enter não cabe nem serve. */
  private readonly telaEstreita =
    inject(DOCUMENT).defaultView?.matchMedia?.('(max-width: 600px)').matches ?? false;
  private avisouDigitandoEm = 0;
  private pausaDigitando: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // O valor vai para o campo só quando não veio dele (o cursor não pula ao digitar), e a
    // altura acompanha o texto até 6 linhas.
    effect(() => {
      const texto = this.texto();
      const campo = this.campo()?.nativeElement;
      if (campo && campo.value !== texto) {
        campo.value = texto;
      }
      if (campo) {
        ajustarAltura(campo);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.pausaDigitando);
      this.gravador.cancelar();
      liberarAudio(this.audio());
      this.anexos().forEach((anexo) => anexo.miniatura && URL.revokeObjectURL(anexo.miniatura));
    });
  }

  /** Põe o foco no campo de texto. */
  focar(): void {
    this.campo()?.nativeElement.focus();
  }

  /** Esvazia texto, anexos e áudio. */
  limpar(): void {
    this.texto.set('');
    this.anexos().forEach((anexo) => anexo.miniatura && URL.revokeObjectURL(anexo.miniatura));
    this.anexos.set([]);
    liberarAudio(this.audio());
    this.audio.set(null);
    this.erro.set(null);
    this.fecharLista();
    this.pararDigitando();
  }

  /** Devolve um envio que falhou (texto e anexos), para a pessoa tentar de novo. */
  restaurar(envio: EnvioCompositor): void {
    if (envio.audio) {
      return;
    }
    this.texto.set(envio.texto);
    this.adicionarArquivos(envio.anexos);
  }

  /** Acrescenta texto onde está o cursor (ou no fim). */
  inserirTexto(texto: string): void {
    const campo = this.campo()?.nativeElement;
    const atual = this.texto();
    const inicio = campo?.selectionStart ?? atual.length;
    const fim = campo?.selectionEnd ?? atual.length;
    this.texto.set(atual.slice(0, inicio) + texto + atual.slice(fim));
    this.posicionarCursor(inicio + texto.length);
  }

  protected escolherModo(modo: ModoCompositor): void {
    this.modo.set(modo);
    this.focar();
  }

  protected aoDigitar(evento: Event): void {
    const campo = evento.target as HTMLTextAreaElement;
    this.texto.set(campo.value);
    this.erro.set(null);
    this.atualizarLista(campo);
    ajustarAltura(campo);
    if (campo.value.trim()) {
      this.avisarDigitando();
    } else {
      this.pararDigitando();
    }
  }

  protected aoTeclar(evento: KeyboardEvent): void {
    if (evento.isComposing) {
      return;
    }
    if (this.listaAberta()) {
      const total = this.sugestoes().length;
      if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
        evento.preventDefault();
        if (total) {
          const passo = evento.key === 'ArrowDown' ? 1 : -1;
          this.ativa.set((this.ativa() + passo + total) % total);
        }
        return;
      }
      if ((evento.key === 'Enter' || evento.key === 'Tab') && total && !evento.shiftKey) {
        evento.preventDefault();
        this.escolher(this.sugestoes()[this.ativa()]);
        return;
      }
      if (evento.key === 'Escape') {
        evento.preventDefault();
        evento.stopPropagation();
        this.fecharLista();
        return;
      }
    }
    if (evento.key === 'Enter') {
      const sempre = evento.ctrlKey || evento.metaKey;
      if (sempre || (!evento.shiftKey && !this.toqueAtivo)) {
        evento.preventDefault();
        this.enviarTexto();
      }
    }
  }

  /** O cursor andou (setas para os lados, clique): a "/" pode ter ficado para trás. */
  protected aoMoverCursor(evento?: KeyboardEvent): void {
    if (evento && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(evento.key)) {
      return;
    }
    const campo = this.campo()?.nativeElement;
    if (campo && this.listaAberta()) {
      this.atualizarLista(campo);
    }
  }

  protected escolher(opcao: RespostaRapidaOpcao | undefined): void {
    const campo = this.campo()?.nativeElement;
    if (!opcao || !campo || this.inicioBarra < 0) {
      return;
    }
    const atual = this.texto();
    const fim = campo.selectionStart ?? atual.length;
    const conteudo = substituirVariaveis(opcao.texto, this.variaveis());
    this.texto.set(atual.slice(0, this.inicioBarra) + conteudo + atual.slice(fim));
    this.posicionarCursor(this.inicioBarra + conteudo.length);
    this.fecharLista();
    this.avisarDigitando();
  }

  protected enviarTexto(): void {
    if (!this.podeEnviar()) {
      return;
    }
    this.enviar.emit({
      texto: this.texto().trim(),
      anexos: this.anexos().map((anexo) => anexo.arquivo),
      nota: this.modo() === 'nota',
      audio: false,
    });
    this.limpar();
    this.focar();
  }

  // Anexos --------------------------------------------------------------------------------------

  protected abrirSeletor(): void {
    this.seletor()?.nativeElement.click();
  }

  protected aoEscolherArquivos(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.adicionarArquivos(Array.from(entrada.files ?? []));
    entrada.value = '';
  }

  protected aoColar(evento: ClipboardEvent): void {
    const arquivos = Array.from(evento.clipboardData?.files ?? []);
    if (arquivos.length && this.permitirAnexos()) {
      evento.preventDefault();
      this.adicionarArquivos(arquivos);
    }
  }

  protected aoArrastar(evento: DragEvent): void {
    if (!this.permitirAnexos() || this.desabilitado()) {
      return;
    }
    if (evento.dataTransfer?.types.includes('Files')) {
      evento.preventDefault();
      evento.dataTransfer.dropEffect = 'copy';
      this.arrastando.set(true);
    }
  }

  protected aoSairDoArraste(evento: DragEvent): void {
    const destino = evento.relatedTarget as Node | null;
    if (!destino || !(evento.currentTarget as HTMLElement).contains(destino)) {
      this.arrastando.set(false);
    }
  }

  protected aoSoltar(evento: DragEvent): void {
    this.arrastando.set(false);
    if (!this.permitirAnexos() || this.desabilitado()) {
      return;
    }
    evento.preventDefault();
    this.adicionarArquivos(Array.from(evento.dataTransfer?.files ?? []));
  }

  protected removerAnexo(anexo: AnexoLocal): void {
    if (anexo.miniatura) {
      URL.revokeObjectURL(anexo.miniatura);
    }
    this.anexos.update((lista) => lista.filter((item) => item.id !== anexo.id));
    void this.anunciador.announce(`${anexo.arquivo.name} removido.`, 'polite');
    this.focar();
  }

  private adicionarArquivos(arquivos: readonly File[]): void {
    if (!arquivos.length) {
      return;
    }
    const recusas: string[] = [];
    const novos: AnexoLocal[] = [];
    for (const arquivo of arquivos) {
      if (this.anexos().length + novos.length >= this.maximoAnexos()) {
        recusas.push(`Dá para enviar até ${this.maximoAnexos()} arquivos de uma vez.`);
        break;
      }
      const motivo = motivoDeRecusa(arquivo, this.limites());
      if (motivo) {
        recusas.push(motivo);
        continue;
      }
      const imagem = tipoDoAnexo(arquivo.type, arquivo.name) === 'imagem';
      novos.push({
        id: gerarId('anexo'),
        arquivo,
        miniatura:
          imagem && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(arquivo) : null,
        detalhe: [extensao(arquivo.name), tamanhoLegivel(arquivo.size)].filter(Boolean).join(' · '),
      });
    }
    if (novos.length) {
      this.anexos.update((lista) => [...lista, ...novos]);
      void this.anunciador.announce(
        novos.length === 1
          ? `${novos[0].arquivo.name} anexado.`
          : `${novos.length} arquivos anexados.`,
        'polite',
      );
    }
    this.erro.set(recusas.length ? recusas.join(' ') : null);
  }

  // Áudio ---------------------------------------------------------------------------------------

  protected async gravar(): Promise<void> {
    this.erro.set(null);
    if (await this.gravador.iniciar()) {
      void this.anunciador.announce('Gravando áudio.', 'polite');
    } else {
      this.erro.set(this.gravador.erro());
    }
  }

  protected cancelarGravacao(): void {
    this.gravador.cancelar();
    void this.anunciador.announce('Gravação descartada.', 'polite');
    this.focarDepois();
  }

  /** ■: para e deixa ouvir antes de enviar. */
  protected async pararGravacao(): Promise<void> {
    const audio = await this.gravador.parar();
    this.audio.set(audio);
    if (audio) {
      void this.anunciador.announce(
        `Áudio de ${duracaoLegivel(audio.duracao)} gravado. Ouça ou envie.`,
        'polite',
      );
    }
  }

  /** ➤ durante a gravação ou depois de ouvir. */
  protected async enviarAudio(): Promise<void> {
    const audio =
      this.gravador.estado() === 'gravando' ? await this.gravador.parar() : this.audio();
    if (!audio) {
      return;
    }
    this.enviar.emit({ texto: '', anexos: [audio.arquivo], nota: false, audio: true });
    liberarAudio(audio);
    this.audio.set(null);
    this.focarDepois();
  }

  protected descartarAudio(): void {
    liberarAudio(this.audio());
    this.audio.set(null);
    void this.anunciador.announce('Áudio descartado.', 'polite');
    this.focarDepois();
  }

  // Apoio ---------------------------------------------------------------------------------------

  /** "/" no começo de uma palavra, antes do cursor: abre (ou filtra) as respostas rápidas. */
  private atualizarLista(campo: HTMLTextAreaElement): void {
    if (!this.respostasRapidas().length) {
      return;
    }
    const antes = campo.value.slice(0, campo.selectionStart ?? campo.value.length);
    const achado = /(^|\s)\/([^\s/]*)$/.exec(antes);
    if (!achado) {
      this.fecharLista();
      return;
    }
    const consulta = achado[2];
    this.inicioBarra = antes.length - consulta.length - 1;
    if (this.consulta() === consulta) {
      return;
    }
    this.ativa.set(0);
    this.consulta.set(consulta);
    const total = this.sugestoes().length;
    void this.anunciador.announce(
      total === 0
        ? 'Nenhuma resposta rápida.'
        : `${total} ${total === 1 ? 'resposta rápida' : 'respostas rápidas'}. Use as setas para escolher.`,
      'polite',
    );
  }

  private fecharLista(): void {
    this.consulta.set(null);
    this.inicioBarra = -1;
    this.ativa.set(0);
  }

  private avisarDigitando(): void {
    const agora = Date.now();
    if (agora - this.avisouDigitandoEm >= INTERVALO_DIGITANDO_MS) {
      this.avisouDigitandoEm = agora;
      this.digitando.emit(true);
    }
    clearTimeout(this.pausaDigitando);
    this.pausaDigitando = setTimeout(() => this.pararDigitando(), PAUSA_DIGITANDO_MS);
  }

  protected pararDigitando(): void {
    clearTimeout(this.pausaDigitando);
    if (this.avisouDigitandoEm) {
      this.avisouDigitandoEm = 0;
      this.digitando.emit(false);
    }
  }

  private posicionarCursor(posicao: number): void {
    afterNextRender(
      () => {
        const campo = this.campo()?.nativeElement;
        if (campo) {
          campo.focus();
          campo.setSelectionRange(posicao, posicao);
        }
      },
      { injector: this.injector },
    );
  }

  private focarDepois(): void {
    afterNextRender(() => this.focar(), { injector: this.injector });
  }
}

/** Altura do campo pelo conteúdo, até 6 linhas (onde `field-sizing: content` não existe). */
function ajustarAltura(campo: HTMLTextAreaElement): void {
  if (typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content')) {
    return;
  }
  campo.style.height = 'auto';
  campo.style.height = `${campo.scrollHeight}px`;
}
