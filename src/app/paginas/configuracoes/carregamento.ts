import { signal } from '@angular/core';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';

/**
 * Estado de uma leitura da API (dados, carregando, erro) para as seções de Configurações. Só a
 * resposta do pedido mais recente vale: um filtro trocado no meio do caminho não deixa a
 * resposta antiga sobrescrever a nova.
 *
 * ```ts
 * readonly lista = new Carregamento<Pagina<Usuario>>();
 * this.lista.executar(() => this.api.listarUsuarios(filtros));
 * // template: @if (lista.erro(); as erro) {…} @else if (lista.carregando()) {…}
 * ```
 */
export class Carregamento<T> {
  private readonly _dados = signal<T | null>(null);
  private readonly _carregando = signal(false);
  private readonly _erro = signal<ErroApi | null>(null);
  private pedido = 0;

  readonly dados = this._dados.asReadonly();
  readonly carregando = this._carregando.asReadonly();
  readonly erro = this._erro.asReadonly();

  /** Faz a leitura; `false` se falhou (o erro fica em `erro()`) ou foi superada por outra. */
  async executar(ler: () => Promise<T>): Promise<boolean> {
    const atual = ++this.pedido;
    this._carregando.set(true);
    this._erro.set(null);
    try {
      const dados = await ler();
      if (atual !== this.pedido) {
        return false;
      }
      this._dados.set(dados);
      return true;
    } catch (falha) {
      if (atual === this.pedido) {
        this._erro.set(erroDaApi(falha));
      }
      return false;
    } finally {
      if (atual === this.pedido) {
        this._carregando.set(false);
      }
    }
  }

  /** Esquece tudo (e ignora a resposta de um pedido ainda em andamento). */
  limpar(): void {
    this.pedido++;
    this._dados.set(null);
    this._erro.set(null);
    this._carregando.set(false);
  }

  /** Troca os dados sem ir à API (resposta de uma alteração que já devolve o novo estado). */
  definir(dados: T): void {
    this._dados.set(dados);
  }
}
