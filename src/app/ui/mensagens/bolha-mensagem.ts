import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideDynamicIcon,
  LucideLockKeyhole,
  LucideRotateCcw,
  LucideTriangleAlert,
} from '@lucide/angular';

import { paraData } from '../../nucleo/formatos';
import { Avatar } from '../avatar/avatar';
import { Botao } from '../botao/botao';
import {
  horaDaMensagem,
  type MensagemConversa,
  ROTULO_TIPO,
  tipoDoAnexo,
  type TipoMensagem,
  type TrechoMensagem,
  trechosDoTexto,
} from './mensagens';
import { PreviaAnexo } from './previa-anexo';
import { StatusEntrega } from './status-entrega';

/** De que direções a bolha mostra o nome do autor (no começo de cada grupo). */
export type NomesNasBolhas = 'entrada' | 'saida' | 'todas' | 'nenhuma';

/**
 * Bolha de mensagem (DESIGN-SYSTEM.md §4.6), pela direção:
 *
 * - **entrada** (o contato; no Chat da equipe, os outros): à esquerda, `--cor-superficie-2` com
 *   borda, avatar na última do grupo;
 * - **saída** (a equipe; no Chat, o próprio usuário): à direita, a superfície tingida de menta,
 *   com o status de entrega (`app-status-entrega`) ao lado da hora; falha mostra o motivo e
 *   "Tentar de novo";
 * - **nota interna**: à direita, no coral listrado do cartão destaque, com "Nota interna · Ana";
 * - **sistema**: centralizada, uma linha suave ("Conversa transferida para Ana · 10:32").
 *
 * O texto é só texto (quebras de linha mantidas; endereços da web viram links que abrem em
 * outra aba; `trechos` permite menções e referências com link interno). Anexos usam
 * `app-previa-anexo`. Mensagens seguidas do mesmo autor formam um grupo (`continuacao`,
 * `seguida`): o nome aparece só na primeira e o avatar só na última. Para o leitor de tela, cada
 * bolha começa com quem falou ("Maria Souza:") e termina com a hora e o status.
 *
 * ```html
 * <app-bolha-mensagem [mensagem]="m" nomes="saida" (tentarDeNovo)="reenviar($event)" />
 * ```
 */
@Component({
  selector: 'app-bolha-mensagem',
  imports: [RouterLink, LucideDynamicIcon, Avatar, Botao, PreviaAnexo, StatusEntrega],
  templateUrl: './bolha-mensagem.html',
  styleUrl: './bolha-mensagem.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'bolha-mensagem',
    '[class.bolha-mensagem--entrada]': "direcao() === 'ENTRADA'",
    '[class.bolha-mensagem--saida]': "direcao() === 'SAIDA'",
    '[class.bolha-mensagem--nota]': "direcao() === 'INTERNA'",
    '[class.bolha-mensagem--sistema]': "direcao() === 'SISTEMA'",
    '[class.bolha-mensagem--continuacao]': 'continuacao()',
    '[class.bolha-mensagem--recuo]': "avatares() && direcao() === 'ENTRADA' && seguida()",
  },
})
export class BolhaMensagem {
  readonly mensagem = input.required<MensagemConversa>();
  /** Continua a mensagem anterior do mesmo autor (sem nome, mais perto dela). */
  readonly continuacao = input(false, { transform: booleanAttribute });
  /** A próxima mensagem é do mesmo autor (o avatar fica para ela). */
  readonly seguida = input(false, { transform: booleanAttribute });
  /** Quais direções mostram o nome do autor: `entrada` (padrão, Chat), `saida` (Atendimento)… */
  readonly nomes = input<NomesNasBolhas>('entrada');
  /** Avatar do autor nas mensagens de entrada. */
  readonly avatares = input(true, { transform: booleanAttribute });
  /** "Tentar de novo" de uma mensagem que falhou. */
  readonly tentarDeNovo = output<MensagemConversa>();

  protected readonly icones = {
    nota: LucideLockKeyhole,
    alerta: LucideTriangleAlert,
    tentar: LucideRotateCcw,
  };

  protected readonly direcao = computed(() => this.mensagem().direcao);
  protected readonly hora = computed(() => horaDaMensagem(this.mensagem().criadaEm));
  protected readonly iso = computed(
    () => paraData(this.mensagem().criadaEm)?.toISOString() ?? null,
  );
  protected readonly autor = computed(() => this.mensagem().autor?.nome?.trim() || null);

  protected readonly trechos = computed<readonly TrechoMensagem[]>(() => {
    const mensagem = this.mensagem();
    return mensagem.trechos?.length ? mensagem.trechos : trechosDoTexto(mensagem.texto);
  });

  /** imagem/vídeo sem texto: a hora vai por cima da mídia; áudio/documento: numa linha. */
  protected readonly arranjo = computed<'texto' | 'midia' | 'linha'>(() => {
    const mensagem = this.mensagem();
    if (this.trechos().length && !mensagem.excluida) {
      return 'texto';
    }
    const anexo = mensagem.anexo;
    const tipo = anexo ? tipoDoAnexo(anexo.mime, anexo.nome) : null;
    return !mensagem.excluida && (tipo === 'imagem' || tipo === 'video') ? 'midia' : 'linha';
  });

  /** Figurinha: a imagem solta, sem o fundo da bolha. */
  protected readonly figurinha = computed(
    () => this.mensagem().tipo === 'FIGURINHA' && !!this.mensagem().anexo,
  );

  /** Rótulo do tipo quando não há texto nem anexo que o mostre ("Localização", "Contato"). */
  protected readonly rotuloTipo = computed(() => {
    const { tipo, anexo } = this.mensagem();
    return ['LOCALIZACAO', 'CONTATO', 'REACAO'].includes(tipo) && !anexo ? ROTULO_TIPO[tipo] : null;
  });

  protected readonly mostrarNome = computed(() => {
    const direcao = this.direcao();
    if (this.continuacao() || !this.autor() || direcao === 'INTERNA' || direcao === 'SISTEMA') {
      return false;
    }
    const nomes = this.nomes();
    return (
      nomes === 'todas' ||
      (nomes === 'entrada' && direcao === 'ENTRADA') ||
      (nomes === 'saida' && direcao === 'SAIDA')
    );
  });

  protected readonly mostrarAvatar = computed(
    () => this.avatares() && this.direcao() === 'ENTRADA' && !this.seguida(),
  );

  /** O começo falado da bolha: quem disse. */
  protected readonly prefixoFalado = computed(() => {
    const autor = this.autor();
    switch (this.direcao()) {
      case 'INTERNA':
        return `Nota interna${autor ? ` de ${autor}` : ''}:`;
      case 'SAIDA':
        return `${autor ?? 'Você'}:`;
      default:
        return `${autor ?? 'Contato'}:`;
    }
  });

  protected readonly rotuloAnexo = computed(() => {
    const mensagem = this.mensagem();
    const autor = this.autor();
    return `${ROTULO_TIPO[mensagem.tipo] === 'Mensagem' ? 'Anexo' : ROTULO_TIPO[mensagem.tipo]}${autor ? ` de ${autor}` : ''}`;
  });

  /** O link interno de um trecho (o `routerLink` aceita texto ou lista). */
  protected rotaDoTrecho(trecho: TrechoMensagem): string | readonly unknown[] {
    return trecho.link ?? [];
  }

  /** Link externo: só `http(s)`, `mailto` e `tel` (o resto vira texto sem destino). */
  protected hrefDoTrecho(trecho: TrechoMensagem): string | null {
    const link = typeof trecho.link === 'string' ? trecho.link.trim() : '';
    return /^(https?:\/\/|mailto:|tel:)/i.test(link) ? link : null;
  }

  protected rotuloTipoCitado(tipo: TipoMensagem): string {
    return ROTULO_TIPO[tipo];
  }
}
