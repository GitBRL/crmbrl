import { Injectable, signal } from '@angular/core';

import { erroDaApi } from './api/erro-api';

/**
 * Avisos curtos (toasts) no canto inferior: o retorno de toda ação (TELAS-FASE1, princípios).
 * O serviço guarda a fila em signal; quem desenha é o host `app-avisos` (`ui/avisos`), que a
 * casca e as telas de acesso já incluem. O host conta o tempo de cada aviso (pausa com mouse
 * ou foco, WCAG 2.2.1) e **anuncia cada aviso aos leitores de tela** (CDK `LiveAnnouncer`:
 * assertivo para erro, educado para os outros).
 *
 * ```ts
 * avisos.sucesso('Contato salvo.');
 * avisos.erro(falha);   // ErroApi ou qualquer falha: mensagem humana + código p/ o suporte (5xx)
 * avisos.sucesso('Atividade concluída.', { acao: { rotulo: 'Desfazer', executar: () => this.reabrir(id) } });
 * ```
 */

export type TipoAviso = 'sucesso' | 'info' | 'atencao' | 'erro';

/** Aviso na fila (o mesmo formato que o host `app-avisos` recebe). */
export interface Aviso {
  readonly id: number;
  readonly tipo: TipoAviso;
  /** Frase curta, em português ("Contato salvo."). */
  readonly mensagem: string;
  readonly titulo?: string;
  /** Rótulo do botão de ação ("Desfazer"). */
  readonly acao?: string;
  /** `requisicaoId` de um erro do servidor, para o suporte. */
  readonly codigo?: string;
  /** Quanto tempo fica (ms); 0 = até fechar. Sem valor: 5 s; 20 s com ação; erro fica. */
  readonly duracao?: number;
}

export interface AcaoAviso {
  /** Rótulo do botão ("Desfazer", "Abrir"). */
  readonly rotulo: string;
  readonly executar: () => void;
}

export interface OpcoesAviso {
  readonly titulo?: string;
  readonly acao?: AcaoAviso;
  /** Em ms; 0 = fica até a pessoa fechar. */
  readonly duracao?: number;
  /** Avisos com a mesma chave não se acumulam: o novo substitui o anterior. */
  readonly chave?: string;
  /** Código para o suporte (o `requisicaoId`); `erro(falha)` já preenche nos 5xx. */
  readonly codigo?: string;
}

/** Mais que isso na tela, o mais antigo sai. */
export const MAXIMO_AVISOS = 3;

@Injectable({ providedIn: 'root' })
export class AvisosService {
  private readonly _lista = signal<readonly Aviso[]>([]);
  private readonly acoes = new Map<number, () => void>();
  private readonly chaves = new Map<string, number>();
  private proximoId = 1;

  /** Avisos na tela, do mais antigo ao mais novo (entrada do host `app-avisos`). */
  readonly lista = this._lista.asReadonly();

  sucesso(mensagem: string, opcoes?: OpcoesAviso): number {
    return this.mostrar('sucesso', mensagem, opcoes);
  }

  info(mensagem: string, opcoes?: OpcoesAviso): number {
    return this.mostrar('info', mensagem, opcoes);
  }

  atencao(mensagem: string, opcoes?: OpcoesAviso): number {
    return this.mostrar('atencao', mensagem, opcoes);
  }

  /**
   * Erro: aceita o texto ou a própria falha. Com uma falha, usa a mensagem humana do
   * `ErroApi` e, nos erros do servidor, mostra o id da requisição como código para o suporte.
   */
  erro(textoOuFalha: unknown, opcoes: OpcoesAviso = {}): number {
    if (typeof textoOuFalha === 'string') {
      return this.mostrar('erro', textoOuFalha, opcoes);
    }
    const erro = erroDaApi(textoOuFalha);
    const codigo = erro.ehFalhaDoServidor ? (erro.requisicaoId ?? undefined) : undefined;
    return this.mostrar('erro', codigo ? erro.resumo : erro.mensagem, {
      codigo,
      ...opcoes,
    });
  }

  mostrar(tipo: TipoAviso, mensagem: string, opcoes: OpcoesAviso = {}): number {
    if (opcoes.chave) {
      const anterior = this.chaves.get(opcoes.chave);
      if (anterior !== undefined) {
        this.dispensar(anterior);
      }
    }
    const id = this.proximoId++;
    const aviso: Aviso = {
      id,
      tipo,
      mensagem,
      ...(opcoes.titulo ? { titulo: opcoes.titulo } : {}),
      ...(opcoes.acao ? { acao: opcoes.acao.rotulo } : {}),
      ...(opcoes.codigo ? { codigo: opcoes.codigo } : {}),
      ...(opcoes.duracao !== undefined ? { duracao: opcoes.duracao } : {}),
    };
    const atuais = this._lista();
    for (const antigo of atuais.slice(0, Math.max(0, atuais.length + 1 - MAXIMO_AVISOS))) {
      this.dispensar(antigo.id);
    }
    if (opcoes.acao) {
      this.acoes.set(id, opcoes.acao.executar);
    }
    if (opcoes.chave) {
      this.chaves.set(opcoes.chave, id);
    }
    this._lista.update((lista) => [...lista, aviso]);
    return id;
  }

  /** Tira o aviso da fila (tempo esgotado, "Fechar" ou depois da ação). */
  dispensar(id: number | string): void {
    const numero = Number(id);
    this.acoes.delete(numero);
    for (const [chave, valor] of this.chaves) {
      if (valor === numero) {
        this.chaves.delete(chave);
      }
    }
    this._lista.update((lista) => lista.filter((aviso) => aviso.id !== numero));
  }

  /** A pessoa clicou na ação do aviso ("Desfazer"). O host dispensa o aviso em seguida. */
  agir(id: number | string): void {
    const chave = Number(id);
    const executar = this.acoes.get(chave);
    this.acoes.delete(chave);
    executar?.();
  }

  /** Tira todos os avisos. */
  limpar(): void {
    this.acoes.clear();
    this.chaves.clear();
    this._lista.set([]);
  }
}
