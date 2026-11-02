import { Injectable, signal } from '@angular/core';

/**
 * Confirmação em modal para ações destrutivas ou que não têm volta (TELAS-FASE1: "dizendo
 * exatamente o que vai acontecer"). O modal é desenhado pelo host `app-confirmacao`
 * (`layout/confirmacao.ts`), que a casca e as telas de acesso já incluem.
 *
 * ```ts
 * const ok = await this.confirmacao.confirmar({
 *   titulo: 'Remover a etapa “Proposta”?',
 *   mensagem: 'A etapa sai do funil Comercial. Isso não pode ser desfeito.',
 *   confirmar: 'Remover etapa',
 *   perigo: true,
 * });
 * if (ok) { … }
 * ```
 *
 * Com `executar`, o modal fica aberto com o botão "carregando" até a ação terminar; se ela
 * falhar, a mensagem do erro aparece no próprio modal e a pessoa pode tentar de novo ou
 * cancelar. `confirmar()` só resolve `true` depois do sucesso.
 */
export interface PedidoConfirmacao {
  /** Pergunta curta, sem ponto final: "Desligar Pedro Alves?". */
  readonly titulo: string;
  /** O que vai acontecer, exatamente. */
  readonly mensagem: string;
  /** Consequências em lista (opcional): "12 atividades pendentes vão para Carla". */
  readonly detalhes?: readonly string[];
  /** Rótulo do botão que confirma (padrão "Confirmar"): use o verbo da ação. */
  readonly confirmar?: string;
  /** Rótulo do botão que desiste (padrão "Cancelar"). */
  readonly cancelar?: string;
  /** Ação destrutiva: o modal ganha o aviso de atenção. */
  readonly perigo?: boolean;
  /**
   * Confirmação forte: a pessoa precisa digitar este texto (sem diferenciar maiúsculas e
   * acentos), como o primeiro nome de quem será desligado.
   */
  readonly exigirTexto?: string;
  /** Rótulo do campo da confirmação forte (padrão: `Digite “<texto>” para confirmar`). */
  readonly rotuloTexto?: string;
  /** Ação executada com o modal aberto (ver acima). */
  readonly executar?: () => Promise<unknown>;
}

export interface ConfirmacaoAberta {
  readonly id: number;
  readonly pedido: PedidoConfirmacao;
  readonly responder: (confirmado: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmacaoService {
  private readonly _aberta = signal<ConfirmacaoAberta | null>(null);
  private proximoId = 1;

  /** A confirmação na tela (lida pelo host). */
  readonly aberta = this._aberta.asReadonly();

  /** Abre o modal e resolve `true` (confirmou) ou `false` (cancelou, Esc, véu). */
  confirmar(pedido: PedidoConfirmacao): Promise<boolean> {
    // Só uma por vez: a anterior conta como cancelada.
    this._aberta()?.responder(false);
    return new Promise<boolean>((resolver) => {
      const id = this.proximoId++;
      this._aberta.set({
        id,
        pedido,
        responder: (confirmado) => {
          if (this._aberta()?.id === id) {
            this._aberta.set(null);
          }
          resolver(confirmado);
        },
      });
    });
  }
}

/** "Pedro" ≈ "pedro " ≈ "PÉDRO": compara sem maiúsculas, acentos e espaços nas pontas. */
export function textoConfere(digitado: string, esperado: string): boolean {
  const normalizar = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLocaleLowerCase('pt-BR');
  return normalizar(digitado) === normalizar(esperado) && normalizar(esperado) !== '';
}
