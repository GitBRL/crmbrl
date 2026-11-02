/**
 * Apoio aos painéis suspensos da barra superior (menu da conta, notificações): fecha o painel
 * quando o usuário toca ou clica fora dele. Devolve a função que remove o ouvinte.
 *
 * Usa `pointerdown` na fase de captura, para fechar antes de outro painel abrir no mesmo
 * clique (só um painel aberto por vez).
 */
export function fecharAoTocarFora(
  documento: Document,
  elemento: HTMLElement,
  fechar: () => void,
): () => void {
  const ouvinte = (evento: Event) => {
    if (!elemento.contains(evento.target as Node | null)) {
      fechar();
    }
  };
  documento.addEventListener('pointerdown', ouvinte, true);
  return () => documento.removeEventListener('pointerdown', ouvinte, true);
}

/** `true` quando o foco saiu de `elemento` para outro ponto da página (Tab, atalho…). */
export function focoSaiuDe(elemento: HTMLElement, evento: FocusEvent): boolean {
  const destino = evento.relatedTarget as Node | null;
  return destino !== null && !elemento.contains(destino);
}
