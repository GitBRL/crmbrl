/**
 * Atalhos de teclado do CRM (Onda E, E4). No Windows e no Linux o modificador é **Alt**; no
 * Mac (e iPad com teclado) é **Control+Shift**, porque no Mac a tecla Option escreve letras
 * especiais (Option+A é "å") e Control+Option é o prefixo do VoiceOver. A tecla é sempre
 * conferida pelo `event.code` (posição física), então vale em qualquer layout (AZERTY, Dvorak…).
 * O AltGr do Windows (que o navegador manda como Ctrl+Alt) nunca aciona um atalho.
 */

export type SistemaDeAtalhos = 'apple' | 'outro';

/** Detecta o sistema pela plataforma que o navegador informa (nunca falha). */
export function sistemaDeAtalhos(): SistemaDeAtalhos {
  try {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const plataforma = nav.userAgentData?.platform || nav.platform || '';
    return /mac|iphone|ipad|ipod/i.test(plataforma) ? 'apple' : 'outro';
  } catch {
    return 'outro';
  }
}

/** `KeyA` para "A"; `ArrowDown` continua `ArrowDown`. */
function codigoDaTecla(tecla: string): string {
  return /^[A-Za-z]$/.test(tecla) ? `Key${tecla.toUpperCase()}` : tecla;
}

/** O evento é o atalho (modificador do sistema + tecla), sem outros modificadores. */
export function ehAtalho(
  evento: KeyboardEvent,
  tecla: string,
  sistema: SistemaDeAtalhos = sistemaDeAtalhos(),
): boolean {
  if (evento.code !== codigoDaTecla(tecla) || evento.metaKey) {
    return false;
  }
  if (sistema === 'apple') {
    return evento.ctrlKey && evento.shiftKey && !evento.altKey;
  }
  return (
    evento.altKey &&
    !evento.ctrlKey &&
    !evento.shiftKey &&
    !(evento.getModifierState?.('AltGraph') ?? false)
  );
}

/** O evento tem o modificador do atalho (qualquer tecla), para a página testar antes. */
export function temModificadorDeAtalho(
  evento: KeyboardEvent,
  sistema: SistemaDeAtalhos = sistemaDeAtalhos(),
): boolean {
  if (evento.metaKey) {
    return false;
  }
  if (sistema === 'apple') {
    return evento.ctrlKey && evento.shiftKey && !evento.altKey;
  }
  return (
    evento.altKey &&
    !evento.ctrlKey &&
    !evento.shiftKey &&
    !(evento.getModifierState?.('AltGraph') ?? false)
  );
}

const SETAS: Readonly<Record<string, string>> = { ArrowDown: '↓', ArrowUp: '↑' };

/** O atalho como aparece na tela: "Alt+A" ou "⌃⇧A". */
export function rotuloDoAtalho(
  tecla: string,
  sistema: SistemaDeAtalhos = sistemaDeAtalhos(),
): string {
  const simbolo = SETAS[tecla] ?? tecla.toUpperCase();
  return sistema === 'apple' ? `⌃⇧${simbolo}` : `Alt+${simbolo}`;
}

/** O atalho falado ("Alt A", "Control Shift A"), para leitor de tela. */
export function atalhoFalado(
  tecla: string,
  sistema: SistemaDeAtalhos = sistemaDeAtalhos(),
): string {
  const falada =
    tecla === 'ArrowDown'
      ? 'seta para baixo'
      : tecla === 'ArrowUp'
        ? 'seta para cima'
        : tecla.toUpperCase();
  return sistema === 'apple' ? `Control Shift ${falada}` : `Alt ${falada}`;
}

/** Valor de `aria-keyshortcuts`: "Alt+A" ou "Control+Shift+A". */
export function atalhoAria(tecla: string, sistema: SistemaDeAtalhos = sistemaDeAtalhos()): string {
  const nome = tecla.startsWith('Arrow') ? tecla : tecla.toUpperCase();
  return sistema === 'apple' ? `Control+Shift+${nome}` : `Alt+${nome}`;
}
