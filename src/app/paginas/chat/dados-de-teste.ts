import { TestBed } from '@angular/core/testing';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import type {
  ChatCanal,
  ChatMembro,
  ChatMensagem,
  ChatPessoa,
  PaginaMensagensChat,
} from './chat.tipos';

/**
 * **Só para testes (specs) do Chat da equipe.** Modelos da API com valores típicos; cada
 * função aceita ajustes. Nenhum código do app importa isto.
 */

export function pessoa(id: string, nome: string, ajustes: Partial<ChatPessoa> = {}): ChatPessoa {
  return {
    id,
    nome,
    avatarUrl: null,
    papel: 'COMERCIAL',
    rotuloPapel: 'Comercial',
    area: 'COMERCIAL',
    ativo: true,
    online: false,
    ...ajustes,
  };
}

export const ANA = pessoa('u-ana', 'Ana Lima', { online: true });
export const BRUNO = pessoa('u-bruno', 'Bruno Tavares', {
  papel: 'LIDER_CS',
  rotuloPapel: 'Líder CS',
  area: 'CS',
});

export function canal(ajustes: Partial<ChatCanal> = {}): ChatCanal {
  return {
    id: 'c1',
    tipo: 'GRUPO',
    nome: 'Lançamento',
    descricao: null,
    area: null,
    outraPessoa: null,
    totalMembros: 3,
    administrador: false,
    automatico: false,
    silenciado: false,
    naoLidas: 0,
    mencoesNaoLidas: 0,
    ultimaLeituraEm: null,
    ultimaMensagem: null,
    ultimaMensagemEm: null,
    arquivadoEm: null,
    podeEnviar: true,
    motivoSemEnvio: null,
    podeGerenciar: false,
    podeSair: true,
    criadoEm: '2026-10-20T10:00:00.000Z',
    ...ajustes,
  };
}

export function mensagem(ajustes: Partial<ChatMensagem> = {}): ChatMensagem {
  const texto = ajustes.texto === undefined ? 'Olá' : ajustes.texto;
  return {
    id: 'm1',
    canalId: 'c1',
    autor: ANA,
    sistema: false,
    texto,
    partes: texto ? [{ tipo: 'texto', texto }] : [],
    anexo: null,
    mencoes: [],
    referencias: [],
    respostaA: null,
    editadaEm: null,
    excluida: false,
    criadaEm: '2026-10-26T13:00:00.000Z',
    ...ajustes,
  };
}

export function membro(usuario: ChatPessoa, ajustes: Partial<ChatMembro> = {}): ChatMembro {
  return {
    usuario,
    administrador: false,
    automatico: false,
    entrouEm: '2026-10-20T10:00:00.000Z',
    ...ajustes,
  };
}

export function paginaDeMensagens(
  itens: readonly ChatMensagem[],
  ajustes: Partial<PaginaMensagensChat> = {},
): PaginaMensagensChat {
  return { itens, temAnteriores: false, temPosteriores: false, ...ajustes };
}

/** Entra como o papel e devolve a pessoa do chat correspondente ao usuário da sessão. */
export function entrarNoChat(papel: Parameters<typeof entrarComo>[0] = 'COMERCIAL'): ChatPessoa {
  entrarComo(papel);
  const usuario = TestBed.inject(SessaoService).usuario()!;
  return pessoa(usuario.id, usuario.nome);
}

/** Espera as promessas e os temporizadores curtos (rolagem virtual, efeitos). */
export async function assentar(vezes = 3): Promise<void> {
  for (let i = 0; i < vezes; i++) {
    await new Promise((resolver) => setTimeout(resolver));
  }
}

/** Escreve no campo como a pessoa (valor, cursor no fim e o evento `input`). */
export function digitarNoCampo(campo: HTMLTextAreaElement | HTMLInputElement, texto: string): void {
  campo.focus();
  campo.value = texto;
  campo.setSelectionRange(texto.length, texto.length);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Tecla no elemento (passa pela captura dos ancestrais, como no navegador). */
export function teclar(
  elemento: Element,
  key: string,
  ajustes: KeyboardEventInit = {},
): KeyboardEvent {
  const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...ajustes });
  elemento.dispatchEvent(evento);
  return evento;
}
