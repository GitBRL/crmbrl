import { computed, signal } from '@angular/core';

import { type ErroApi, erroDaApi } from '../../../../nucleo/api/erro-api';
import { ROTULO_AREA } from '../../../../nucleo/sessao/perfil';
import type { OpcaoSeletor } from '../../../../ui/seletor/seletor';
import type { CanaisApi } from '../canais.api';
import type { FilaDoCanal } from '../canais.modelos';

/** Explicação da fila padrão, igual em todos os canais. */
export const AJUDA_FILA_PADRAO =
  'As conversas novas deste canal entram nesta fila e são distribuídas entre as pessoas dela, do jeito que a fila manda (rodízio, menor carga ou manual). Sem fila, a conversa fica sem responsável e só Admin e C-level a veem. As filas ficam em Configurações → Atendimento.';

/**
 * As filas do Atendimento para o seletor "Fila das conversas novas" dos canais. Carrega uma vez
 * (ou de novo com `carregar(true)`); se falhar, o seletor continua com "Sem fila" e a fila que o
 * canal já tem.
 */
export class FilasDisponiveis {
  private readonly _filas = signal<readonly FilaDoCanal[] | null>(null);
  private readonly _carregando = signal(false);
  private readonly _erro = signal<ErroApi | null>(null);
  /** A fila atual do canal, que continua na lista mesmo se não vier (desativada, sem acesso). */
  private readonly atual = signal<FilaDoCanal | null>(null);

  readonly carregando = this._carregando.asReadonly();
  readonly erro = this._erro.asReadonly();

  readonly opcoes = computed<readonly OpcaoSeletor<string>[]>(() => {
    const filas = [...(this._filas() ?? [])];
    const atual = this.atual();
    if (atual && !filas.some((fila) => fila.id === atual.id)) {
      filas.push(atual);
    }
    return filas.map((fila) => ({
      valor: fila.id,
      rotulo: fila.area ? `${fila.nome} · ${ROTULO_AREA[fila.area]}` : fila.nome,
    }));
  });

  constructor(private readonly api: CanaisApi) {}

  /** Garante a fila atual do canal entre as opções. */
  definirAtual(fila: FilaDoCanal | null): void {
    this.atual.set(fila);
  }

  async carregar(forcar = false): Promise<void> {
    if (this._carregando() || (this._filas() !== null && !forcar)) {
      return;
    }
    this._carregando.set(true);
    this._erro.set(null);
    try {
      this._filas.set(await this.api.listarFilas());
    } catch (falha) {
      this._erro.set(erroDaApi(falha));
    } finally {
      this._carregando.set(false);
    }
  }
}
