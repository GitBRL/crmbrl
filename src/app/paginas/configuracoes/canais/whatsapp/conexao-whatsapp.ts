import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  LucideCheck,
  LucideDynamicIcon,
  LucideInfo,
  LucideLoaderCircle,
  LucideMonitor,
  LucideQrCode,
  LucideRefreshCw,
  LucideTriangleAlert,
  LucideUnplug,
} from '@lucide/angular';

import { Botao } from '../../../../ui/botao/botao';
import { formatarTelefone } from '../../textos';
import { segundosAte } from '../apresentacao';
import type { StatusWhatsapp } from '../canais.modelos';

/** O que o cartão mostra. */
export type FaseDaConexao = 'qr' | 'conectando' | 'conectado' | 'parado' | 'erro';

/** Depois de vencer, espera um pouco pelo QR novo antes de mostrar "O código venceu". */
const FOLGA_VENCIMENTO_S = 3;

/**
 * O cartão da conexão de um número de WhatsApp (R13), conforme o status ao vivo:
 *
 * - **Esperando o QR**: o código (data URL que chega pelo evento `whatsapp.conexao`), a contagem
 *   até ele mudar e o passo a passo para quem nunca conectou; vencido sem um novo, "Gerar outro";
 * - **Conectando**: o QR foi lido e o gateway termina a conexão;
 * - **Conectado**: o telefone em destaque e "Desconectar";
 * - **Desconectado / erro / bloqueado**: o motivo, "Conectar com QR" e o resumo dos passos.
 */
@Component({
  selector: 'app-conexao-whatsapp',
  imports: [Botao, LucideCheck, LucideDynamicIcon, LucideInfo, LucideLoaderCircle, LucideMonitor],
  templateUrl: './conexao-whatsapp.html',
  styleUrl: './conexao-whatsapp.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConexaoWhatsapp {
  readonly status = input.required<StatusWhatsapp>();
  readonly qr = input<string | null>(null);
  readonly qrExpiraEm = input<string | null>(null);
  readonly telefone = input<string | null>(null);
  readonly motivo = input<string | null>(null);
  /** "Conectado há 2 h". */
  readonly desde = input<string | null>(null);
  /** O pedido de conexão está a caminho. */
  readonly conectando = input(false);
  /** O gateway não respondeu (503): a frase para a tela. */
  readonly erroGateway = input<string | null>(null);

  readonly conectar = output<void>();
  readonly desconectar = output<void>();

  protected readonly iconeQr = LucideQrCode;
  protected readonly iconeAlerta = LucideTriangleAlert;
  protected readonly iconeRenovar = LucideRefreshCw;
  protected readonly iconeDesconectar = LucideUnplug;

  /** Relógio de 1 s, só enquanto há um QR na tela (para a contagem). */
  private readonly agora = signal(Date.now());
  /** Quanto tempo o QR atual vale no total (para a barra), medido quando ele chega. */
  private readonly duracaoDoQr = signal(20);

  protected readonly fase = computed<FaseDaConexao>(() => {
    switch (this.status()) {
      case 'AGUARDANDO_QR':
        return 'qr';
      case 'CONECTANDO':
        return this.qr() ? 'qr' : 'conectando';
      case 'CONECTADO':
        return 'conectado';
      case 'ERRO':
      case 'BANIDO':
        return 'erro';
      default:
        return 'parado';
    }
  });

  protected readonly restante = computed(() => segundosAte(this.qrExpiraEm(), this.agora()));

  protected readonly vencido = computed(() => {
    if (!this.qr() || !this.qrExpiraEm()) {
      return false;
    }
    const alvo = new Date(this.qrExpiraEm()!).getTime();
    return this.agora() - alvo > FOLGA_VENCIMENTO_S * 1000;
  });

  protected readonly fracaoRestante = computed(() => {
    const restante = this.restante();
    return restante === null ? 1 : Math.min(1, restante / Math.max(1, this.duracaoDoQr()));
  });

  protected readonly textoTempo = computed(() => {
    const restante = this.restante();
    if (restante === null) {
      return 'O código muda sozinho de tempos em tempos.';
    }
    if (restante === 0) {
      return 'Trocando o código…';
    }
    return `O código muda em ${restante} s`;
  });

  protected readonly telefoneFormatado = computed(() => formatarTelefone(this.telefone()));

  protected readonly rotuloConectar = computed(() =>
    this.status() === 'DESCONECTADO' ? 'Conectar com QR' : 'Conectar de novo',
  );

  protected readonly tituloParado = computed(() => {
    switch (this.status()) {
      case 'BANIDO':
        return 'O WhatsApp bloqueou este número';
      case 'ERRO':
        return 'A conexão falhou';
      default:
        return 'Este número não está conectado';
    }
  });

  protected readonly textoParado = computed(() => {
    switch (this.status()) {
      case 'BANIDO':
        return 'Nada chega nem sai por ele. Confira o número no celular e, se precisar, peça a revisão ao suporte do WhatsApp antes de conectar de novo.';
      case 'ERRO':
        return 'As mensagens deste número não estão chegando. Conecte de novo; se o celular desvinculou o aparelho, vai aparecer um QR novo.';
      default:
        return 'Enquanto estiver desconectado, as mensagens que chegarem neste número não entram no Atendimento e as respostas não saem.';
    }
  });

  constructor() {
    let relogio: ReturnType<typeof setInterval> | null = null;
    const parar = () => {
      if (relogio) {
        clearInterval(relogio);
        relogio = null;
      }
    };
    effect(() => {
      const comQr = this.qr() !== null && this.qrExpiraEm() !== null;
      if (comQr && !relogio) {
        this.agora.set(Date.now());
        relogio = setInterval(() => this.agora.set(Date.now()), 1000);
      } else if (!comQr) {
        parar();
      }
    });
    // Cada QR novo: mede quanto tempo ele vale (a barra começa cheia).
    effect(() => {
      const expira = this.qrExpiraEm();
      if (this.qr() && expira) {
        const total = segundosAte(expira, Date.now());
        if (total !== null && total > 0) {
          this.duracaoDoQr.set(total);
        }
        this.agora.set(Date.now());
      }
    });
    inject(DestroyRef).onDestroy(parar);
  }
}
