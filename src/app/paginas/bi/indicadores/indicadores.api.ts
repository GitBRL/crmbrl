import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { urlApi } from '../../../nucleo/api/api';
import type { ArquivoExportado, FormatoExportacao } from '../bi.tipos';
import type {
  Catalogo,
  EntradaDePainel,
  PainelDeIndicadores,
  PedidoDeCalculo,
  RespostaDeCalculo,
} from './indicadores.tipos';

/** `/indicadores/*` (R33.7). */
@Injectable({ providedIn: 'root' })
export class IndicadoresApi {
  private readonly http = inject(HttpClient);

  catalogo(): Promise<Catalogo> {
    return firstValueFrom(this.http.get<Catalogo>(urlApi('indicadores', 'catalogo')));
  }

  paineis(): Promise<readonly PainelDeIndicadores[]> {
    return firstValueFrom(
      this.http.get<readonly PainelDeIndicadores[]>(urlApi('indicadores', 'paineis')),
    );
  }

  painel(id: string): Promise<PainelDeIndicadores> {
    return firstValueFrom(this.http.get<PainelDeIndicadores>(urlApi('indicadores', 'paineis', id)));
  }

  criar(entrada: EntradaDePainel): Promise<PainelDeIndicadores> {
    return firstValueFrom(
      this.http.post<PainelDeIndicadores>(urlApi('indicadores', 'paineis'), entrada),
    );
  }

  atualizar(id: string, entrada: EntradaDePainel): Promise<PainelDeIndicadores> {
    return firstValueFrom(
      this.http.patch<PainelDeIndicadores>(urlApi('indicadores', 'paineis', id), entrada),
    );
  }

  duplicar(id: string, nome?: string): Promise<PainelDeIndicadores> {
    return firstValueFrom(
      this.http.post<PainelDeIndicadores>(urlApi('indicadores', 'paineis', id, 'duplicar'), {
        nome,
      }),
    );
  }

  excluir(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('indicadores', 'paineis', id)));
  }

  calcular(pedido: PedidoDeCalculo, semCache = false): Promise<RespostaDeCalculo> {
    return firstValueFrom(
      this.http.post<RespostaDeCalculo>(urlApi('indicadores', 'calcular'), pedido, {
        headers: semCache ? new HttpHeaders({ 'Cache-Control': 'no-cache' }) : undefined,
      }),
    );
  }

  exportar(
    pedido: PedidoDeCalculo,
    formato: FormatoExportacao,
    widgetId?: string,
  ): Promise<ArquivoExportado> {
    return firstValueFrom(
      this.http.post<ArquivoExportado>(urlApi('indicadores', 'exportar'), {
        ...pedido,
        formato,
        ...(widgetId ? { widgetId } : {}),
      }),
    );
  }
}
