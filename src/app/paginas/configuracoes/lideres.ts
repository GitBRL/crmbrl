import { signal } from '@angular/core';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import type { Papel } from '../../nucleo/papeis';
import type { ConfiguracoesApi } from './configuracoes.api';
import type { Usuario } from './configuracoes.modelos';
import { liderEsperado } from './hierarquia';

/**
 * Quem pode liderar cada papel (R1.2), para os seletores de líder do convite, da edição e da
 * reativação: os usuários **ativos** com o papel de líder esperado (membro → líderes do mesmo
 * setor; líder → C-levels). Guarda as respostas por papel e setor e ignora a resposta de uma troca de
 * papel que já ficou para trás.
 */
export class CandidatosALider {
  private readonly _candidatos = signal<readonly Usuario[] | null>(null);
  private readonly _carregando = signal(false);
  private readonly _erro = signal<ErroApi | null>(null);
  private readonly cache = new Map<string, Promise<readonly Usuario[]>>();
  private pedido = 0;

  /** `null` enquanto não carregou (ou falhou); `[]` para Admin e C-level. */
  readonly candidatos = this._candidatos.asReadonly();
  readonly carregando = this._carregando.asReadonly();
  readonly erro = this._erro.asReadonly();

  constructor(private readonly api: ConfiguracoesApi) {}

  /**
   * Carrega para o `papel` de quem vai ser liderado. Devolve a lista, ou `null` se falhou ou se
   * outra troca de papel chegou antes.
   */
  async carregar(
    papel: Papel | null,
    area: string | null = null,
    recarregar = false,
  ): Promise<readonly Usuario[] | null> {
    const atual = ++this.pedido;
    this._erro.set(null);
    const esperado = papel ? liderEsperado(papel) : null;
    // Membro só tem candidatos quando o setor já foi escolhido (o líder é do mesmo setor).
    if (!esperado || (esperado === 'LIDER' && !area)) {
      this._candidatos.set([]);
      this._carregando.set(false);
      return [];
    }
    const chave = esperado === 'LIDER' ? `${esperado}:${area}` : esperado;
    if (recarregar) {
      this.cache.delete(chave);
    }
    let busca = this.cache.get(chave);
    if (!busca) {
      busca = this.api.listarAtivosDoPapel(esperado, esperado === 'LIDER' ? area : null);
      this.cache.set(chave, busca);
    }
    this._carregando.set(true);
    try {
      const candidatos = await busca;
      if (atual !== this.pedido) {
        return null;
      }
      this._candidatos.set(candidatos);
      return candidatos;
    } catch (falha) {
      this.cache.delete(chave);
      if (atual === this.pedido) {
        this._candidatos.set(null);
        this._erro.set(erroDaApi(falha));
      }
      return null;
    } finally {
      if (atual === this.pedido) {
        this._carregando.set(false);
      }
    }
  }

  /** Começa de novo (o modal reabriu): esquece a lista mostrada, mas mantém o que já buscou. */
  reiniciar(): void {
    this.pedido++;
    this._candidatos.set(null);
    this._erro.set(null);
    this._carregando.set(false);
  }

  /** Esquece o que já buscou (depois de criar, editar, desligar ou reativar alguém). */
  esquecer(): void {
    this.cache.clear();
  }
}
