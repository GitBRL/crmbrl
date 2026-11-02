import {
  DOCUMENT,
  type EnvironmentProviders,
  inject,
  provideEnvironmentInitializer,
} from '@angular/core';
import { NavigationEnd, type NavigationError, Router } from '@angular/router';

/** Chave (sessionStorage) com a URL que já foi recarregada por falha de carregamento. */
export const CHAVE_RECARGA = 'crmbrl.recarga';

// Mensagens do Chrome/Edge, Firefox ("error loading dynamically imported module") e Safari.
const FALHA_DE_CARREGAMENTO =
  /dynamically imported module|Importing a module script failed|Failed to fetch/i;

type Janela = Pick<Window, 'location' | 'sessionStorage'>;

/** O erro de navegação é uma parte do app (página carregada sob demanda) que não chegou? */
export function ehFalhaDeCarregamento(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : typeof erro === 'string' ? erro : '';
  return FALHA_DE_CARREGAMENTO.test(mensagem);
}

/**
 * Depois de um deploy, uma aba aberta antes dele pede arquivos de páginas que não existem
 * mais: o clique no menu "morre" e só o console registra o erro. Aqui a navegação que falhou
 * por isso vira um carregamento completo da página de destino, que já vem com os arquivos
 * novos — no máximo uma vez por URL, para não entrar em laço se o deploy estiver quebrado.
 * Devolve `true` quando recarregou. Use com `withNavigationErrorHandler` no `provideRouter`.
 */
export function recarregarSeFalhouCarregamento(
  evento: NavigationError,
  janela: Janela | null = inject(DOCUMENT).defaultView,
): boolean {
  if (!janela || !ehFalhaDeCarregamento(evento.error) || lerMarca(janela) === evento.url) {
    return false;
  }
  gravarMarca(janela, evento.url);
  janela.location.assign(evento.url);
  return true;
}

/** Esquece a marca da recarga na próxima navegação que der certo. */
export function provideLimpezaDaRecarga(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const janela = inject(DOCUMENT).defaultView;
    inject(Router).events.subscribe((evento) => {
      if (evento instanceof NavigationEnd && janela) {
        removerMarca(janela);
      }
    });
  });
}

// sessionStorage pode estar bloqueado (modo privado, política do navegador): nunca quebra.
function lerMarca(janela: Janela): string | null {
  try {
    return janela.sessionStorage.getItem(CHAVE_RECARGA);
  } catch {
    return null;
  }
}

function gravarMarca(janela: Janela, url: string): void {
  try {
    janela.sessionStorage.setItem(CHAVE_RECARGA, url);
  } catch {
    // Sem a marca, uma nova falha na mesma URL recarregaria de novo: aceitável.
  }
}

function removerMarca(janela: Janela): void {
  try {
    janela.sessionStorage.removeItem(CHAVE_RECARGA);
  } catch {
    // Nada a fazer.
  }
}
