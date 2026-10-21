/**
 * Acesso seguro ao `localStorage`. Modo privado, cota cheia ou armazenamento bloqueado não
 * podem quebrar a tela: nesses casos a leitura devolve `null` e a gravação é ignorada.
 */
export function lerArmazenado(chave: string): string | null {
  try {
    return globalThis.localStorage?.getItem(chave) ?? null;
  } catch {
    return null;
  }
}

export function gravarArmazenado(chave: string, valor: string): void {
  try {
    globalThis.localStorage?.setItem(chave, valor);
  } catch {
    // Sem persistência: a escolha vale só nesta sessão.
  }
}

export function removerArmazenado(chave: string): void {
  try {
    globalThis.localStorage?.removeItem(chave);
  } catch {
    // Nada a fazer.
  }
}
