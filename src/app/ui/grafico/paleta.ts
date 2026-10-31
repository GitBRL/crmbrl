/**
 * Cores e fonte dos gráficos, lidas dos tokens do tema em uso (DESIGN-SYSTEM.md §2.2): nada de
 * cor fixa no desenho, assim claro e escuro saem certos.
 */
export interface PaletaGrafico {
  /** As quatro cores de dado, na ordem fixa: ciano, menta, lima, coral. */
  readonly dados: readonly [string, string, string, string];
  readonly texto: string;
  readonly textoSuave: string;
  readonly textoFraco: string;
  readonly borda: string;
  readonly superficie: string;
  readonly flutuante: string;
  /** Contorno de 1px dos preenchimentos de dado (só no tema claro; transparente no escuro). */
  readonly contornoDado: string;
  readonly erro: string;
  readonly familia: string;
}

/** Lê o valor computado de uma propriedade personalizada (`--cor-texto`) na raiz. */
function token(estilo: CSSStyleDeclaration, nome: string, padrao: string): string {
  const valor = estilo.getPropertyValue(nome).trim();
  return valor || padrao;
}

export function lerPaleta(raiz: HTMLElement): PaletaGrafico {
  const estilo = getComputedStyle(raiz);
  return {
    dados: [
      token(estilo, '--dado-1', '#00BDF9'),
      token(estilo, '--dado-2', '#00F99B'),
      token(estilo, '--dado-3', '#E5F900'),
      token(estilo, '--dado-4', '#F46F51'),
    ],
    texto: token(estilo, '--cor-texto', '#ffffff'),
    textoSuave: token(estilo, '--cor-texto-suave', '#b3b3b3'),
    textoFraco: token(estilo, '--cor-texto-fraco', '#969696'),
    borda: token(estilo, '--cor-borda', 'rgba(255,255,255,.08)'),
    superficie: token(estilo, '--cor-superficie', '#161616'),
    flutuante: token(estilo, '--cor-flutuante', '#232323'),
    contornoDado: token(estilo, '--cor-contorno-dado', 'transparent'),
    erro: token(estilo, '--cor-erro', '#ff5a5f'),
    familia: token(estilo, '--familia', 'sans-serif'),
  };
}
