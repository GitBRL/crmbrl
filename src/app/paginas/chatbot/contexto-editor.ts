import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type Pagina, parametros, urlApi } from '../../nucleo/api/api';
import type { OpcaoSeletor } from '../../ui/seletor/seletor';
import type { TipoDePasso } from './chatbot.tipos';

export interface EtapaDoFunil {
  readonly id: string;
  readonly nome: string;
}

export interface FunilDoEditor {
  readonly id: string;
  readonly nome: string;
  readonly etapas: readonly EtapaDoFunil[];
}

export interface CanalDoEditor {
  readonly id: string;
  readonly tipo: string;
  readonly nome: string;
}

export const ROTULO_TIPO_CANAL: Readonly<Record<string, string>> = {
  WHATSAPP: 'WhatsApp',
  WEBCHAT: 'Chat do site',
  EMAIL: 'E-mail',
  INSTAGRAM: 'Instagram',
  MESSENGER: 'Messenger',
};

/**
 * Dados de apoio do editor (filas, pessoas, funis, canais, catálogo de passos e variáveis do
 * fluxo). Um por editor (provido em `EditorFluxo`); os passos leem daqui em vez de receber tudo
 * por entrada. Cada lista que falha fica vazia: o campo continua usável, só sem sugestões.
 */
@Injectable()
export class ContextoEditor {
  private readonly http = inject(HttpClient);

  readonly catalogo = signal<readonly TipoDePasso[]>([]);
  readonly filas = signal<readonly OpcaoSeletor<string>[]>([]);
  readonly pessoas = signal<readonly OpcaoSeletor<string>[]>([]);
  readonly funis = signal<readonly FunilDoEditor[]>([]);
  readonly canais = signal<readonly CanalDoEditor[]>([]);
  /** Variáveis que as perguntas do fluxo gravam. */
  readonly variaveis = signal<readonly string[]>([]);
  /** Quantos passos o fluxo tem agora (limite de 150). */
  readonly totalDePassos = signal(0);
  /** Cartões de passo abertos (compartilhado entre a lista e os caminhos). */
  readonly abertos = signal<ReadonlySet<string>>(new Set());

  async carregarApoio(): Promise<void> {
    const [filas, pessoas, funis, canais] = await Promise.allSettled([
      firstValueFrom(
        this.http.get<readonly { id: string; nome: string; ativa?: boolean }[]>(
          urlApi('atendimento', 'filas'),
        ),
      ),
      firstValueFrom(
        this.http.get<Pagina<{ id: string; nome: string }>>(urlApi('usuarios'), {
          params: parametros({ porPagina: 100, ativo: true }),
        }),
      ),
      firstValueFrom(this.http.get<readonly FunilDoEditor[]>(urlApi('funis'))),
      firstValueFrom(this.http.get<readonly CanalDoEditor[]>(urlApi('atendimento', 'canais'))),
    ]);
    if (filas.status === 'fulfilled') {
      this.filas.set(
        filas.value
          .filter((fila) => fila.ativa !== false)
          .map((fila) => ({ valor: fila.id, rotulo: fila.nome })),
      );
    }
    if (pessoas.status === 'fulfilled') {
      this.pessoas.set(pessoas.value.itens.map((p) => ({ valor: p.id, rotulo: p.nome })));
    }
    if (funis.status === 'fulfilled') {
      this.funis.set(funis.value);
    }
    if (canais.status === 'fulfilled') {
      this.canais.set(canais.value);
    }
  }
}
