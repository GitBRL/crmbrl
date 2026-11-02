import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArchive,
  LucideBellOff,
  LucideDynamicIcon,
  LucideHandshake,
  LucideHash,
  LucideHeartHandshake,
  type LucideIconInput,
  LucideMegaphone,
  LucideMessageCirclePlus,
  LucideUsersRound,
} from '@lucide/angular';

import type { ErroApi } from '../../nucleo/api/erro-api';
import { RolagemEsmaecida } from '../../layout/rolagem';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { ChatApi } from './chat.api';
import {
  type ChatCanal,
  destacarTermos,
  previaDoCanal,
  quandoCurto,
  type ResultadoBuscaChat,
  rotuloDoItem,
  secoesDosCanais,
  textoContagem,
  textoDasPartes,
} from './chat.tipos';

/** A busca nas mensagens começa com esta quantidade de letras e espera a pausa da digitação. */
export const MINIMO_BUSCA = 2;
export const ESPERA_BUSCA_MS = 350;

const ICONE_DA_AREA: Readonly<Record<string, LucideIconInput>> = {
  MARKETING: LucideMegaphone,
  COMERCIAL: LucideHandshake,
  CS: LucideHeartHandshake,
};

/**
 * Lista de canais do Chat da equipe: **Canais** (Geral e áreas), **Grupos**, **Conversas
 * diretas** e **Arquivados**, cada um com a prévia da última mensagem, a hora, as não lidas
 * (contador na cor do sino), as menções a você ("@") e o sino cortado dos silenciados. A busca
 * filtra os canais pelo nome na hora e, a partir de duas letras, procura também nas mensagens
 * de todos os canais da pessoa.
 */
@Component({
  selector: 'app-chat-lista-canais',
  imports: [
    RouterLink,
    LucideDynamicIcon,
    RolagemEsmaecida,
    Avatar,
    Botao,
    BotaoIcone,
    CampoBusca,
    Esqueleto,
    EstadoVazio,
  ],
  templateUrl: './lista-canais.html',
  styleUrl: './lista-canais.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListaCanais {
  readonly canais = input<readonly ChatCanal[] | null>(null);
  readonly carregando = input(false, { transform: booleanAttribute });
  readonly falha = input<ErroApi | null>(null);
  /** O canal aberto (fica marcado e não mostra não lidas). */
  readonly ativo = input<string | null>(null);
  readonly eu = input<string | null>(null);

  readonly novaDireta = output<void>();
  readonly novoGrupo = output<void>();
  readonly tentarDeNovo = output<void>();

  protected readonly icones = {
    direta: LucideMessageCirclePlus,
    grupo: LucideUsersRound,
    silenciado: LucideBellOff,
  };

  protected readonly busca = signal('');
  protected readonly secoes = computed(() => secoesDosCanais(this.canais() ?? [], this.busca()));
  protected readonly buscandoMensagens = computed(() => this.busca().trim().length >= MINIMO_BUSCA);
  protected readonly resultados = signal<readonly ResultadoBuscaChat[] | null>(null);
  protected readonly totalResultados = signal(0);
  protected readonly falhaBusca = signal(false);
  protected readonly esqueletos = [72, 54, 64, 48, 60];

  private readonly api = inject(ChatApi);

  constructor() {
    let espera: ReturnType<typeof setTimeout> | undefined;
    let pedido = 0;
    effect(() => {
      const termo = this.busca().trim();
      clearTimeout(espera);
      untracked(() => {
        this.resultados.set(null);
        this.falhaBusca.set(false);
      });
      if (termo.length < MINIMO_BUSCA) {
        return;
      }
      const atual = ++pedido;
      espera = setTimeout(() => {
        this.api.buscarMensagens(termo).then(
          (pagina) => {
            if (atual === pedido) {
              this.resultados.set(pagina.itens);
              this.totalResultados.set(pagina.total);
            }
          },
          () => {
            if (atual === pedido) {
              this.falhaBusca.set(true);
              this.resultados.set([]);
            }
          },
        );
      }, ESPERA_BUSCA_MS);
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(espera));
  }

  protected iconeDoCanal(canal: ChatCanal): LucideIconInput {
    if (canal.tipo === 'AREA' && canal.area) {
      return ICONE_DA_AREA[canal.area] ?? LucideHash;
    }
    if (canal.tipo === 'GRUPO') {
      return canal.arquivadoEm ? LucideArchive : LucideUsersRound;
    }
    return LucideHash;
  }

  protected previa(canal: ChatCanal): string {
    return previaDoCanal(canal, this.eu());
  }

  protected quando(canal: ChatCanal): string {
    return quandoCurto(canal.ultimaMensagemEm);
  }

  /** Nome acessível do item: o canal, as não lidas e a prévia da última mensagem. */
  protected rotulo(canal: ChatCanal): string {
    return `${rotuloDoItem(canal, canal.id === this.ativo())}. ${this.previa(canal)}`;
  }

  protected naoLidas(canal: ChatCanal): number {
    return canal.id === this.ativo() ? 0 : canal.naoLidas;
  }

  protected mencoes(canal: ChatCanal): number {
    return canal.id === this.ativo() ? 0 : canal.mencoesNaoLidas;
  }

  protected contagem(total: number): string {
    return textoContagem(total);
  }

  protected trechosDoResultado(resultado: ResultadoBuscaChat) {
    const texto = textoDasPartes(resultado.mensagem.partes) || resultado.mensagem.anexo?.nome || '';
    return destacarTermos(texto, this.busca());
  }

  protected autorDoResultado(resultado: ResultadoBuscaChat): string {
    const autor = resultado.mensagem.autor;
    return autor ? (autor.id === this.eu() ? 'Você' : autor.nome) : 'Aviso';
  }

  protected quandoResultado(resultado: ResultadoBuscaChat): string {
    return quandoCurto(resultado.mensagem.criadaEm);
  }

  protected limparBusca(): void {
    this.busca.set('');
  }
}
