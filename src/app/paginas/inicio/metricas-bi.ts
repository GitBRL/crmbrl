import { inject, Injectable } from '@angular/core';

import { ultimosDias } from '../bi/filtros-bi';
import { BiApi } from '../bi/bi.api';
import { FILTROS_PADRAO, type IdPainel, type RespostaPainel } from '../bi/bi.tipos';

/**
 * O que a Visão geral lê da API de BI (`GET /bi/:painel`): os painéis que o papel vê e, de cada
 * um dos que a tela usa, a resposta do período. Um painel que falha vira `null` sem derrubar
 * os outros (a aba ou o indicador dele mostra o aviso).
 */
export interface MedidasBi {
  readonly paineis: readonly IdPainel[];
  readonly comercial: RespostaPainel | null;
  readonly cs: RespostaPainel | null;
  readonly atendimento: RespostaPainel | null;
  readonly financeiro: RespostaPainel | null;
  /** Os painéis que o papel vê e deram erro. */
  readonly falhas: readonly IdPainel[];
}

const USADOS = ['comercial', 'cs', 'atendimento', 'financeiro'] as const;

@Injectable({ providedIn: 'root' })
export class InicioBiApi {
  private readonly api = inject(BiApi);

  /** Os últimos `dias` dias (contando hoje), comparados com os `dias` anteriores. */
  async carregar(dias: number): Promise<MedidasBi> {
    const paineis = await this.api.paineis();
    const filtros = { ...FILTROS_PADRAO, ...ultimosDias(dias) };
    const falhas: IdPainel[] = [];
    const respostas = await Promise.all(
      USADOS.map(async (id) => {
        if (!paineis.includes(id)) {
          return null;
        }
        try {
          return await this.api.painel(id, filtros);
        } catch {
          falhas.push(id);
          return null;
        }
      }),
    );
    const [comercial, cs, atendimento, financeiro] = respostas;
    return { paineis, comercial, cs, atendimento, financeiro, falhas };
  }
}
