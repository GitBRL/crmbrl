import { DestroyRef, inject } from '@angular/core';

import { TempoRealService } from '../../nucleo/tempo-real/tempo-real.service';
import type { EventoCampanhaProgresso } from './disparos.tipos';

/**
 * Ouve `campanha.progresso` enquanto o componente existir (chame no construtor). A entrega é
 * "pelo menos uma vez": evento repetido ou mais velho que o último visto da mesma campanha é
 * ignorado (pelo campo `em`).
 */
export function aoReceberProgresso(tratar: (evento: EventoCampanhaProgresso) => void): void {
  const tempoReal = inject(TempoRealService);
  const ultimo = new Map<string, string>();
  const parar = tempoReal.ouvir('campanha.progresso', (evento: EventoCampanhaProgresso | null) => {
    if (!evento?.campanhaId || !evento.contadores) {
      return;
    }
    const visto = ultimo.get(evento.campanhaId);
    if (visto && evento.em && evento.em <= visto) {
      return;
    }
    ultimo.set(evento.campanhaId, evento.em ?? '');
    tratar(evento);
  });
  inject(DestroyRef).onDestroy(parar);
}

/** Chama `tratar` quando a conexão volta depois de cair (para buscar o que se perdeu). */
export function aoVoltarConexao(tratar: () => void): void {
  const parar = inject(TempoRealService).aoReconectar(tratar);
  inject(DestroyRef).onDestroy(parar);
}
