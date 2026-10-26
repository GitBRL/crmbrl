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
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideBell,
  LucideBellOff,
  LucideDynamicIcon,
  LucideHandshake,
  LucideHash,
  LucideHeartHandshake,
  type LucideIconInput,
  LucideInfo,
  LucideMegaphone,
  LucideUsersRound,
  LucideArchive,
} from '@lucide/angular';
import { map } from 'rxjs';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { copiarTexto } from '../../nucleo/copiar';
import { formatarData } from '../../nucleo/formatos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import {
  acompanharSala,
  aoReceber,
  aoReconectar,
  digitandoEm,
} from '../../nucleo/tempo-real/auxiliares';
import type { EntidadeTempoReal } from '../../nucleo/tempo-real/eventos';
import { TempoRealService } from '../../nucleo/tempo-real/tempo-real.service';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { ListaMensagens } from '../../ui/mensagens/lista-mensagens';
import {
  type MensagemConversa,
  tipoDoAnexo,
  type TipoMensagem,
} from '../../ui/mensagens/mensagens';
import { PilhaAvatares } from '../../ui/pilha-avatares/pilha-avatares';
import { type AcaoMensagem, AcoesMensagem } from './acoes-mensagem';
import { ChatApi } from './chat.api';
import { ChatEstado } from './chat-estado';
import {
  type ChatCanal,
  type ChatMembro,
  type ChatMensagem,
  mesclarMensagens,
  paraMensagemConversa,
  primeiroNome,
  resumoDaCitada,
  rotuloDoTipo,
  textoDasPartes,
} from './chat.tipos';
import { Composicao, type EdicaoChat, type EnvioChat } from './composicao';
import { DetalhesCanal } from './detalhes-canal';
import { focoPerdido } from './foco';

/** Mensagem enviada daqui que ainda não voltou da API (ou que falhou). */
interface MensagemLocal {
  readonly id: string;
  readonly texto: string | null;
  readonly arquivo: File | null;
  readonly respostaAId?: string;
  /** `blob:` do anexo, para a bolha mostrar antes de subir. */
  readonly endereco: string | null;
  readonly conversa: MensagemConversa;
}

/** Páginas de "depois de" buscadas de uma vez (abrir no meio, reconectar). */
const MAXIMO_VOLTAS = 10;

const ICONE_DA_AREA: Readonly<Record<string, LucideIconInput>> = {
  MARKETING: LucideMegaphone,
  COMERCIAL: LucideHandshake,
  CS: LucideHeartHandshake,
};

/** A mensagem que chega pelo tempo real tem a forma do `ChatMensagemDto`. */
function comoMensagem(entidade: EntidadeTempoReal): ChatMensagem | null {
  const mensagem = entidade as unknown as Partial<ChatMensagem>;
  return typeof mensagem.id === 'string' &&
    typeof mensagem.criadaEm === 'string' &&
    Array.isArray(mensagem.partes)
    ? (entidade as unknown as ChatMensagem)
    : null;
}

function tipoDoArquivo(arquivo: File | null): TipoMensagem {
  if (!arquivo) {
    return 'TEXTO';
  }
  const tipo = tipoDoAnexo(arquivo.type, arquivo.name);
  return tipo === 'imagem'
    ? 'IMAGEM'
    : tipo === 'audio'
      ? 'AUDIO'
      : tipo === 'video'
        ? 'VIDEO'
        : 'DOCUMENTO';
}

/**
 * Canal aberto do Chat da equipe (`/chat/:canalId`): cabeçalho (nome, quem participa, silenciar,
 * detalhes), as mensagens (`app-lista-mensagens`, com rolagem virtual e "carregar anteriores")
 * e o compositor com menções e referências. Ao vivo: entra na sala `chat:<canalId>`, recebe
 * `chat.mensagem` (nova, editada ou excluída) e `digitando`, avisa quando a pessoa digita e
 * marca como lido enquanto a conversa está na tela. Ao reconectar, busca o que chegou nesse
 * meio-tempo. `?mensagem=<id>` abre já na mensagem (aviso de menção, busca).
 */
@Component({
  selector: 'app-chat-canal',
  imports: [
    RouterLink,
    LucideDynamicIcon,
    Avatar,
    Botao,
    BotaoIcone,
    Esqueleto,
    EstadoVazio,
    ListaMensagens,
    PilhaAvatares,
    AcoesMensagem,
    Composicao,
    DetalhesCanal,
  ],
  templateUrl: './canal.html',
  styleUrl: './canal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Canal {
  readonly canalId = input.required<string>();

  protected readonly estado = inject(ChatEstado);
  private readonly api = inject(ChatApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly sessao = inject(SessaoService);
  private readonly tempoReal = inject(TempoRealService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly documento = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** `?mensagem=<id>`: abrir já nesta mensagem. */
  private readonly mensagemAlvo = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((parametros) => parametros.get('mensagem'))),
    { initialValue: null },
  );

  protected readonly icones = {
    voltar: LucideArrowLeft,
    avisos: LucideBell,
    silenciado: LucideBellOff,
    detalhes: LucideInfo,
    arquivado: LucideArchive,
  };

  /** O canal buscado à parte (ainda não estava na lista: direta nova, lista carregando). */
  private readonly avulso = signal<ChatCanal | null>(null);
  protected readonly falhaCanal = signal<ErroApi | null>(null);
  protected readonly canal = computed(() => {
    const id = this.canalId();
    const avulso = this.avulso();
    return this.estado.canal(id) ?? (avulso?.id === id ? avulso : null);
  });

  /** As mensagens da API (da mais antiga para a mais nova). */
  protected readonly servidor = signal<readonly ChatMensagem[]>([]);
  private readonly locais = signal<readonly MensagemLocal[]>([]);
  protected readonly temAnteriores = signal(false);
  protected readonly carregando = signal(true);
  protected readonly carregandoAnteriores = signal(false);
  protected readonly falhaMensagens = signal<ErroApi | null>(null);
  protected readonly membros = signal<readonly ChatMembro[] | null>(null);
  protected readonly respondendo = signal<ChatMensagem | null>(null);
  protected readonly editando = signal<ChatMensagem | null>(null);
  protected readonly detalhesAberto = signal(false);
  private readonly visivel = signal(true);

  /** Conversão para a bolha, guardada por mensagem (objetos da API não mudam: são trocados). */
  private cache = new WeakMap<ChatMensagem, MensagemConversa>();
  private cacheDe: string | null = null;

  protected readonly mensagens = computed<readonly MensagemConversa[]>(() => {
    const eu = this.estado.eu();
    if (eu !== this.cacheDe) {
      this.cache = new WeakMap();
      this.cacheDe = eu;
    }
    const daApi = this.servidor().map((mensagem) => {
      let convertida = this.cache.get(mensagem);
      if (!convertida) {
        convertida = paraMensagemConversa(mensagem, eu);
        this.cache.set(mensagem, convertida);
      }
      return convertida;
    });
    return [...daApi, ...this.locais().map((local) => local.conversa)];
  });

  private readonly ultimaDaApi = computed(() => {
    const lista = this.servidor();
    return lista[lista.length - 1] ?? null;
  });

  protected readonly digitando = digitandoEm(() => ({ canalId: this.canalId() }));
  protected readonly nomesDigitando = computed(() => this.digitando().map((pessoa) => pessoa.nome));

  /** O rascunho guardado do canal, lido só quando o canal muda. */
  protected readonly rascunho = computed(() => {
    const id = this.canalId();
    return untracked(() => this.estado.rascunho(id));
  });

  protected readonly iconeDoCanal = computed<LucideIconInput>(() => {
    const canal = this.canal();
    if (canal?.tipo === 'AREA' && canal.area) {
      return ICONE_DA_AREA[canal.area] ?? LucideHash;
    }
    if (canal?.tipo === 'GRUPO') {
      return canal.arquivadoEm ? LucideArchive : LucideUsersRound;
    }
    return LucideHash;
  });

  /** A linha embaixo do nome: papel e se está online (direta), pessoas e descrição. */
  protected readonly meta = computed(() => {
    const canal = this.canal();
    if (!canal) {
      return '';
    }
    if (canal.tipo === 'DIRETO') {
      const pessoa = canal.outraPessoa;
      if (!pessoa) {
        return 'Conversa direta';
      }
      const situacao = !pessoa.ativo ? 'desligada do CRM' : pessoa.online ? 'online' : 'offline';
      return `${pessoa.rotuloPapel} · ${situacao}`;
    }
    const pessoas = canal.totalMembros === 1 ? '1 pessoa' : `${canal.totalMembros} pessoas`;
    if (canal.arquivadoEm) {
      return `${pessoas} · arquivado em ${formatarData(canal.arquivadoEm)}`;
    }
    return `${pessoas} · ${canal.descricao || rotuloDoTipo(canal)}`;
  });

  /** Quem aparece na pilha do cabeçalho (os online primeiro, sem você). */
  protected readonly pessoasDaPilha = computed(() => {
    const eu = this.estado.eu();
    return [...(this.membros() ?? [])]
      .filter((membro) => membro.usuario.id !== eu)
      .sort((a, b) => Number(b.usuario.online) - Number(a.usuario.online))
      .map((membro) => ({ nome: membro.usuario.nome, foto: membro.usuario.avatarUrl }));
  });

  protected readonly textoVazio = computed(() => {
    const canal = this.canal();
    switch (canal?.tipo) {
      case 'DIRETO':
        return `Nenhuma mensagem ainda. Diga olá para ${primeiroNome(canal.nome)}!`;
      case 'GRUPO':
        return 'Nenhuma mensagem ainda. Comece a conversa do grupo.';
      case 'GERAL':
        return 'Nenhuma mensagem ainda. Que tal um bom-dia para a equipe?';
      default:
        return 'Nenhuma mensagem ainda.';
    }
  });

  private readonly lista = viewChild(ListaMensagens);
  private readonly composicao = viewChild(Composicao);
  private readonly acoes = viewChild(AcoesMensagem);
  /** Cada abertura de canal ganha um número: respostas de um canal anterior são ignoradas. */
  private geracao = 0;
  private sequencia = 0;
  private ultimaLida: string | null = null;
  private saindo = false;
  /** O canal em que a pessoa está digitando (para avisar que parou ao sair dele). */
  private digitandoNo: string | null = null;

  constructor() {
    // Só entra na sala de um canal que a pessoa enxerga (o de outra pessoa a API recusa).
    acompanharSala(() => (this.canal() ? { tipo: 'chat', id: this.canalId() } : null));

    effect(() => {
      const id = this.canalId();
      const alvo = this.mensagemAlvo();
      untracked(() => void this.abrir(id, alvo));
    });

    // O canal ainda não está na lista (direta nova, link de outra pessoa): busca à parte.
    effect(() => {
      const id = this.canalId();
      const lista = this.estado.canais();
      if (lista === null || lista.some((canal) => canal.id === id)) {
        return;
      }
      untracked(() => {
        if (this.avulso()?.id !== id && this.estado.removido()?.id !== id && !this.saindo) {
          void this.buscarCanal(id);
        }
      });
    });

    // Saiu do canal ou foi tirado dele (em outra aba, por quem administra): volta à lista.
    effect(() => {
      const removido = this.estado.removido();
      if (!removido || removido.id !== untracked(this.canalId) || this.saindo) {
        return;
      }
      untracked(() => {
        this.avisos.info(
          removido.nome
            ? `Você não faz mais parte de “${removido.nome}”.`
            : 'Você não faz mais parte desta conversa.',
        );
        void this.router.navigate(['/chat']);
      });
    });

    // Enquanto a conversa está na tela, o que chega já fica lido.
    effect(() => {
      const canal = this.canal();
      const ultima = this.ultimaDaApi();
      if (!canal || !ultima || !this.visivel() || this.carregando()) {
        return;
      }
      if (canal.naoLidas === 0 && canal.mencoesNaoLidas === 0) {
        return;
      }
      untracked(() => this.marcarLido(canal.id, ultima.id));
    });

    aoReceber('chat.mensagem', ({ canalId, mensagem }) => {
      const nova = comoMensagem(mensagem);
      if (canalId !== this.canalId() || !nova) {
        return;
      }
      this.servidor.update((lista) => mesclarMensagens(lista, [nova]));
      if (nova.excluida && this.editando()?.id === nova.id) {
        this.editando.set(null);
      }
      if (nova.excluida && this.respondendo()?.id === nova.id) {
        this.respondendo.set(null);
      }
    });
    aoReconectar(() => void this.buscarNovas());

    const destroyRef = inject(DestroyRef);
    const aoMudarVisibilidade = () => this.visivel.set(this.documento.visibilityState !== 'hidden');
    this.documento.addEventListener('visibilitychange', aoMudarVisibilidade);
    destroyRef.onDestroy(() => {
      this.documento.removeEventListener('visibilitychange', aoMudarVisibilidade);
      this.limparLocais();
      if (this.estado.aberto() === untracked(this.canalId)) {
        this.estado.aberto.set(null);
      }
      this.pararDeDigitar();
    });
  }

  // Abrir e carregar ------------------------------------------------------------------------

  private async abrir(id: string, alvo: string | null): Promise<void> {
    const geracao = ++this.geracao;
    this.pararDeDigitar();
    this.estado.aberto.set(id);
    this.acoes()?.esconderAgora();
    this.limparLocais();
    this.servidor.set([]);
    this.temAnteriores.set(false);
    this.carregando.set(true);
    this.falhaMensagens.set(null);
    this.falhaCanal.set(null);
    this.respondendo.set(null);
    this.editando.set(null);
    this.detalhesAberto.set(false);
    this.membros.set(null);
    this.ultimaLida = null;
    this.saindo = false;
    void this.carregarMembros(id, geracao);
    try {
      const primeira = await this.carregarPagina(id, alvo, geracao);
      if (!primeira) {
        return;
      }
      this.temAnteriores.set(primeira.temAnteriores);
      if (alvo && primeira.achouAlvo) {
        this.irParaMensagem(alvo);
      }
      this.recuperarFoco();
    } catch (falha) {
      if (geracao !== this.geracao) {
        return;
      }
      const erro = erroDaApi(falha);
      this.falhaMensagens.set(erro);
      if (erro.ehNaoEncontrado) {
        this.falhaCanal.set(erro);
      }
    } finally {
      if (geracao === this.geracao) {
        this.carregando.set(false);
      }
    }
  }

  /**
   * As últimas mensagens ou, com `alvo`, uma janela em volta dele — e então o que veio depois,
   * para a lista ir até a mais recente (as novas chegam no fim). Mensagem que não existe mais:
   * abre do fim, com um aviso.
   */
  private async carregarPagina(
    id: string,
    alvo: string | null,
    geracao: number,
  ): Promise<{ temAnteriores: boolean; achouAlvo: boolean } | null> {
    let pagina;
    let achouAlvo = !!alvo;
    try {
      pagina = await this.api.mensagens(id, alvo ? { aoRedorDe: alvo } : {});
    } catch (falha) {
      if (!alvo || !erroDaApi(falha).ehNaoEncontrado) {
        throw falha;
      }
      pagina = await this.api.mensagens(id);
      achouAlvo = false;
      if (geracao === this.geracao) {
        this.avisos.info('Essa mensagem não está mais disponível. Mostrando as mais recentes.');
      }
    }
    if (geracao !== this.geracao) {
      return null;
    }
    let itens = pagina.itens;
    const temAnteriores = pagina.temAnteriores;
    for (let volta = 0; pagina.temPosteriores && itens.length && volta < MAXIMO_VOLTAS; volta++) {
      pagina = await this.api.mensagens(id, { depoisDe: itens[itens.length - 1].id, limite: 100 });
      if (geracao !== this.geracao) {
        return null;
      }
      itens = [...itens, ...pagina.itens];
    }
    this.servidor.set(mesclarMensagens([], itens));
    return { temAnteriores, achouAlvo };
  }

  private async carregarMembros(id: string, geracao = this.geracao): Promise<void> {
    try {
      const membros = await this.api.membros(id);
      if (geracao === this.geracao) {
        this.membros.set(membros);
      }
    } catch {
      if (geracao === this.geracao) {
        this.membros.set([]);
      }
    }
  }

  private async buscarCanal(id: string): Promise<void> {
    try {
      const canal = await this.api.canal(id);
      if (id === this.canalId()) {
        this.avulso.set(canal);
        this.estado.guardar(canal);
      }
    } catch (falha) {
      if (id === this.canalId()) {
        this.falhaCanal.set(erroDaApi(falha));
      }
    }
  }

  protected tentarDeNovo(): void {
    void this.abrir(this.canalId(), this.mensagemAlvo());
  }

  protected async carregarAnteriores(): Promise<void> {
    const primeira = this.servidor()[0];
    if (!primeira || this.carregandoAnteriores()) {
      return;
    }
    const geracao = this.geracao;
    this.carregandoAnteriores.set(true);
    try {
      const pagina = await this.api.mensagens(this.canalId(), { antesDe: primeira.id });
      if (geracao !== this.geracao) {
        return;
      }
      this.servidor.update((lista) => mesclarMensagens(lista, pagina.itens));
      this.temAnteriores.set(pagina.temAnteriores);
    } catch (falha) {
      if (geracao === this.geracao) {
        this.avisos.erro(falha);
      }
    } finally {
      if (geracao === this.geracao) {
        this.carregandoAnteriores.set(false);
      }
    }
  }

  /**
   * Depois de reconectar: as mais recentes de novo (traz também edições e exclusões recentes).
   * Se entre elas e as que estão na tela ficou um buraco, a lista recomeça das recentes.
   */
  private async buscarNovas(): Promise<void> {
    const id = this.canalId();
    const geracao = this.geracao;
    if (this.carregando()) {
      return;
    }
    if (this.falhaMensagens()) {
      this.tentarDeNovo();
      return;
    }
    try {
      const pagina = await this.api.mensagens(id);
      if (geracao !== this.geracao) {
        return;
      }
      const atuais = this.servidor();
      const ultimaAtual = atuais[atuais.length - 1];
      const buraco =
        !!ultimaAtual &&
        pagina.temAnteriores &&
        !pagina.itens.some((mensagem) => mensagem.id === ultimaAtual.id) &&
        Date.parse(pagina.itens[0]?.criadaEm ?? '') > Date.parse(ultimaAtual.criadaEm);
      if (buraco) {
        this.servidor.set(pagina.itens);
        this.temAnteriores.set(true);
      } else {
        this.servidor.update((lista) => mesclarMensagens(lista, pagina.itens));
      }
      void this.carregarMembros(id, geracao);
    } catch {
      // Sem conexão com a API ainda: a próxima reconexão tenta de novo.
    }
  }

  private marcarLido(canalId: string, mensagemId: string): void {
    if (this.ultimaLida === mensagemId) {
      return;
    }
    this.ultimaLida = mensagemId;
    this.estado.marcarLidoLocalmente(canalId);
    this.api.marcarLeitura(canalId, mensagemId).then(
      (canal) => this.estado.guardar(canal),
      () => {
        if (this.ultimaLida === mensagemId) {
          this.ultimaLida = null;
        }
      },
    );
  }

  /**
   * No celular a lista some quando o canal abre e o foco ficaria perdido (no `<body>`): ele vai
   * para o nome do canal, de onde o leitor de tela e o Tab seguem pela conversa.
   */
  private recuperarFoco(): void {
    afterNextRender(
      () => {
        if (focoPerdido(this.documento)) {
          this.host.querySelector<HTMLElement>('.canal__nome')?.focus();
        }
      },
      { injector: this.injector },
    );
  }

  /** Rola até a mensagem e a destaca por um instante. */
  private irParaMensagem(id: string): void {
    const ir = () => this.lista()?.rolarAte(id);
    afterNextRender(
      () => {
        ir();
        setTimeout(() => {
          ir();
          this.destacar(id);
        }, 120);
      },
      { injector: this.injector },
    );
  }

  private destacar(id: string): void {
    const bolha = this.host.querySelector<HTMLElement>(`[data-chave="m:${CSS.escape(id)}"] .bolha`);
    const janela = this.documento.defaultView;
    if (!bolha || typeof bolha.animate !== 'function' || !janela) {
      return;
    }
    const reduzido = janela.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const cor =
      janela.getComputedStyle(this.host).getPropertyValue('--cor-foco').trim() || 'currentColor';
    bolha.animate(
      [
        { boxShadow: `0 0 0 3px ${cor}` },
        { boxShadow: `0 0 0 3px ${cor}`, offset: 0.7 },
        { boxShadow: '0 0 0 0 transparent' },
      ],
      { duration: reduzido ? 2400 : 2000, easing: 'ease-out' },
    );
  }

  // Enviar --------------------------------------------------------------------------------------

  protected async enviar(envio: EnvioChat): Promise<void> {
    const canalId = this.canalId();
    const partes = envio.anexos.length
      ? envio.anexos.map((arquivo, indice) => ({
          texto: indice === 0 ? envio.texto || null : null,
          visivel: indice === 0 ? envio.visivel : '',
          arquivo,
          respostaAId: indice === 0 ? envio.respostaA?.id : undefined,
        }))
      : [
          {
            texto: envio.texto,
            visivel: envio.visivel,
            arquivo: null,
            respostaAId: envio.respostaA?.id,
          },
        ];
    const novos = partes.map((parte) =>
      this.criarLocal(
        parte.texto,
        parte.visivel,
        parte.arquivo,
        parte.respostaAId,
        envio.respostaA,
      ),
    );
    this.locais.update((lista) => [...lista, ...novos]);
    this.pararDeDigitar();
    afterNextRender(() => this.lista()?.rolarParaOFim('smooth'), { injector: this.injector });
    for (const local of novos) {
      await this.transmitir(local, canalId);
    }
  }

  protected reenviar(mensagem: MensagemConversa): void {
    const local = this.locais().find((item) => item.id === mensagem.id);
    if (!local) {
      return;
    }
    this.atualizarLocal(local.id, { status: 'PENDENTE', erro: null });
    void this.transmitir(local, this.canalId());
  }

  private async transmitir(local: MensagemLocal, canalId: string): Promise<void> {
    try {
      const arquivoId = local.arquivo
        ? (await this.api.enviarArquivo(local.arquivo)).id
        : undefined;
      const mensagem = await this.api.enviar(canalId, {
        texto: local.texto || null,
        ...(arquivoId ? { arquivoId } : {}),
        ...(local.respostaAId ? { respostaAId: local.respostaAId } : {}),
      });
      if (canalId === this.canalId()) {
        this.servidor.update((lista) => mesclarMensagens(lista, [mensagem]));
        this.removerLocal(local.id);
      }
    } catch (falha) {
      if (canalId === this.canalId()) {
        this.atualizarLocal(local.id, { status: 'FALHOU', erro: erroDaApi(falha).resumo });
      }
    }
  }

  private criarLocal(
    texto: string | null,
    visivel: string,
    arquivo: File | null,
    respostaAId: string | undefined,
    respostaA: ChatMensagem | null,
  ): MensagemLocal {
    const id = `local:${++this.sequencia}`;
    const endereco =
      arquivo && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(arquivo) : null;
    const usuario = this.sessao.usuario();
    return {
      id,
      texto,
      arquivo,
      respostaAId,
      endereco,
      conversa: {
        id,
        direcao: 'SAIDA',
        tipo: tipoDoArquivo(arquivo),
        texto: visivel || null,
        anexo: arquivo
          ? {
              nome: arquivo.name,
              mime: arquivo.type || 'application/octet-stream',
              url: endereco ?? '',
              tamanho: arquivo.size,
            }
          : null,
        status: 'PENDENTE',
        criadaEm: new Date().toISOString(),
        autor: { id: usuario?.id, nome: usuario?.nome ?? 'Você', foto: usuario?.avatarUrl ?? null },
        respondeA:
          respostaA && respostaAId
            ? {
                autor: respostaA.autor?.nome ?? null,
                texto: resumoDaCitada({
                  id: respostaA.id,
                  autor: null,
                  resumo: textoDasPartes(respostaA.partes),
                  anexoNome: respostaA.anexo?.nome ?? null,
                  excluida: respostaA.excluida,
                }),
              }
            : null,
      },
    };
  }

  private atualizarLocal(
    id: string,
    mudanca: Partial<Pick<MensagemConversa, 'status' | 'erro'>>,
  ): void {
    this.locais.update((lista) =>
      lista.map((local) =>
        local.id === id ? { ...local, conversa: { ...local.conversa, ...mudanca } } : local,
      ),
    );
  }

  private removerLocal(id: string): void {
    const local = this.locais().find((item) => item.id === id);
    if (local?.endereco) {
      URL.revokeObjectURL(local.endereco);
    }
    this.locais.update((lista) => lista.filter((item) => item.id !== id));
  }

  private limparLocais(): void {
    for (const local of this.locais()) {
      if (local.endereco) {
        URL.revokeObjectURL(local.endereco);
      }
    }
    this.locais.set([]);
  }

  protected avisarDigitando(ativo: boolean): void {
    if (!this.canal()?.podeEnviar) {
      return;
    }
    const canalId = this.canalId();
    this.tempoReal.digitando({ canalId }, ativo);
    this.digitandoNo = ativo ? canalId : null;
  }

  /** Saiu do canal (ou enviou) no meio da digitação: quem está nele para de ver "digitando…". */
  private pararDeDigitar(): void {
    if (this.digitandoNo) {
      this.tempoReal.digitando({ canalId: this.digitandoNo }, false);
      this.digitandoNo = null;
    }
  }

  // Editar, responder, excluir ----------------------------------------------------------------

  protected async salvarEdicao({ mensagem, texto }: EdicaoChat): Promise<void> {
    const original = textoDasPartes(mensagem.partes);
    if (texto === (mensagem.texto ?? '') || (!texto && !mensagem.anexo && !original)) {
      return;
    }
    try {
      const editada = await this.api.editar(mensagem.id, texto);
      this.servidor.update((lista) => mesclarMensagens(lista, [editada]));
    } catch (falha) {
      this.avisos.erro(falha, { titulo: 'A edição não foi salva' });
      this.editando.set(mensagem);
    }
  }

  protected editarUltima(): void {
    const eu = this.estado.eu();
    const ultima = [...this.servidor()]
      .reverse()
      .find((mensagem) => mensagem.autor?.id === eu && !mensagem.sistema && !mensagem.excluida);
    if (ultima && this.canal()?.podeEnviar) {
      this.editando.set(ultima);
    }
  }

  protected async agir({ tipo, mensagem }: AcaoMensagem): Promise<void> {
    switch (tipo) {
      case 'responder':
        this.editando.set(null);
        this.respondendo.set(mensagem);
        return;
      case 'editar':
        this.editando.set(mensagem);
        return;
      case 'copiar': {
        const ok = await copiarTexto(textoDasPartes(mensagem.partes), this.documento);
        if (ok) {
          this.avisos.sucesso('Texto copiado.');
        } else {
          this.avisos.atencao('Não foi possível copiar. Selecione o texto e copie à mão.');
        }
        return;
      }
      case 'excluir':
        await this.excluir(mensagem);
        return;
    }
  }

  private async excluir(mensagem: ChatMensagem): Promise<void> {
    const ok = await this.confirmacao.confirmar({
      titulo: 'Excluir a mensagem?',
      mensagem: mensagem.anexo
        ? 'O texto e o anexo somem para todos. No lugar fica o aviso “Mensagem apagada”.'
        : 'O texto some para todos. No lugar fica o aviso “Mensagem apagada”.',
      confirmar: 'Excluir',
      perigo: true,
      executar: () => this.api.excluir(mensagem.id),
    });
    if (!ok) {
      return;
    }
    this.servidor.update((lista) =>
      mesclarMensagens(lista, [
        {
          ...mensagem,
          texto: null,
          partes: [],
          anexo: null,
          excluida: true,
          excluidaEm: new Date().toISOString(),
        },
      ]),
    );
    if (this.editando()?.id === mensagem.id) {
      this.editando.set(null);
    }
    this.avisos.sucesso('Mensagem excluída.');
  }

  // Cabeçalho e detalhes ------------------------------------------------------------------------

  protected async alternarSilencio(canal: ChatCanal): Promise<void> {
    try {
      const atualizado = await this.api.silenciar(canal.id, !canal.silenciado);
      this.estado.guardar(atualizado);
      this.avisos.sucesso(
        atualizado.silenciado
          ? 'Conversa silenciada: ela não conta mais no menu (menções a você continuam avisando).'
          : 'Avisos desta conversa ligados de novo.',
      );
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  protected recarregarMembros(): void {
    void this.carregarMembros(this.canalId());
  }

  protected aoSair(): void {
    this.saindo = true;
    this.estado.remover(this.canalId());
    void this.router.navigate(['/chat']);
  }

  protected focarCompositor(): void {
    this.composicao()?.focar();
  }
}
