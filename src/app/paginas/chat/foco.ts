/**
 * O foco está no `<body>` ou num elemento que sumiu da tela (escondido, removido)? No celular
 * a lista e o canal se revezam na tela, e quem estava com o foco some junto.
 */
export function focoPerdido(documento: Document): boolean {
  const ativo = documento.activeElement as HTMLElement | null;
  if (!ativo || ativo === documento.body || !ativo.isConnected) {
    return true;
  }
  return typeof ativo.checkVisibility === 'function' ? !ativo.checkVisibility() : false;
}
