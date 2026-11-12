import type { HttpTestingController } from '@angular/common/http/testing';

import { setoresDeTeste } from '../sessao/sessao-de-teste';
import type { Setor } from './setores';

/**
 * **Só para testes (specs).** Responde ao `GET /setores` pendente (se houver) com os setores de
 * base mais os `extras`; devolve quantos pedidos respondeu.
 */
export function responderSetores(
  http: HttpTestingController,
  extras: readonly Partial<Setor>[] = [],
): number {
  const pedidos = http.match((pedido) => pedido.url === '/api/v1/setores');
  for (const pedido of pedidos) {
    pedido.flush(setoresDeTeste(extras));
  }
  return pedidos.length;
}
