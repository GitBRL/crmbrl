import type { TemplateDoCanal } from '../configuracoes/canais/canais.modelos';
import type { VariaveisDoTemplate } from './atendimento.tipos';

/**
 * Funções puras dos templates do WhatsApp oficial: prévia com as variáveis preenchidas, quais
 * campos o formulário pede e se o envio já pode sair. Testadas em `templates.spec.ts`.
 * As variáveis são preenchidas na ordem em que aparecem (`variaveis.corpo[i]` preenche a i-ésima
 * de `corpo.variaveis`); o botão de URL aceita no máximo uma.
 */

/** Troca `{{nome}}` pelo valor da posição correspondente; sem valor, deixa o marcador à vista. */
export function preencherTexto(
  texto: string,
  nomes: readonly string[],
  valores: readonly (string | null | undefined)[],
): string {
  return texto.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (marcador, nome: string) => {
    const indice = nomes.indexOf(nome);
    const valor = indice >= 0 ? valores[indice]?.trim() : '';
    return valor ? valor : marcador;
  });
}

export interface PreviaDoTemplate {
  readonly cabecalho: string | null;
  readonly corpo: string;
  readonly rodape: string | null;
}

/** O que o contato verá (cabeçalho de texto, corpo e rodapé), com as variáveis preenchidas. */
export function previaDoTemplate(
  template: TemplateDoCanal,
  variaveis: VariaveisDoTemplate,
): PreviaDoTemplate {
  const cabecalho =
    template.cabecalho?.formato === 'TEXT' && template.cabecalho.texto
      ? preencherTexto(
          template.cabecalho.texto,
          template.cabecalho.variaveis,
          variaveis.cabecalho ?? [],
        )
      : null;
  return {
    cabecalho,
    corpo: preencherTexto(template.corpo.texto, template.corpo.variaveis, variaveis.corpo ?? []),
    rodape: template.rodape,
  };
}

/** Formatos de cabeçalho que exigem um arquivo no envio. */
export function exigeMidia(template: TemplateDoCanal): boolean {
  const formato = template.cabecalho?.formato;
  return formato === 'IMAGE' || formato === 'VIDEO' || formato === 'DOCUMENT';
}

/** `accept` do seletor de arquivo conforme o formato do cabeçalho. */
export function aceitaDoCabecalho(template: TemplateDoCanal): string {
  switch (template.cabecalho?.formato) {
    case 'IMAGE':
      return 'image/jpeg,image/png';
    case 'VIDEO':
      return 'video/mp4,video/3gpp';
    default:
      return '';
  }
}

export const ROTULO_MIDIA: Readonly<Record<string, string>> = {
  IMAGE: 'Imagem',
  VIDEO: 'Vídeo',
  DOCUMENT: 'Documento',
};

/** Estado do formulário de um template. */
export interface RascunhoDoTemplate {
  readonly cabecalho: readonly string[];
  readonly corpo: readonly string[];
  /** Um valor por botão (só os de URL com variável usam). */
  readonly botoes: readonly string[];
}

export function rascunhoVazio(template: TemplateDoCanal): RascunhoDoTemplate {
  return {
    cabecalho: (template.cabecalho?.variaveis ?? []).map(() => ''),
    corpo: template.corpo.variaveis.map(() => ''),
    botoes: template.botoes.map(() => ''),
  };
}

/** Variáveis que ainda faltam preencher, em português ("cabeçalho {{1}}", "corpo {{2}}"…). */
export function variaveisFaltando(
  template: TemplateDoCanal,
  rascunho: RascunhoDoTemplate,
): readonly string[] {
  const faltando: string[] = [];
  (template.cabecalho?.variaveis ?? []).forEach((nome, i) => {
    if (!rascunho.cabecalho[i]?.trim()) {
      faltando.push(`cabeçalho {{${nome}}}`);
    }
  });
  template.corpo.variaveis.forEach((nome, i) => {
    if (!rascunho.corpo[i]?.trim()) {
      faltando.push(`corpo {{${nome}}}`);
    }
  });
  template.botoes.forEach((botao, i) => {
    if (botao.variaveis.length > 0 && !rascunho.botoes[i]?.trim()) {
      faltando.push(`botão “${botao.texto}”`);
    }
  });
  return faltando;
}

/** O corpo do envio (`template.variaveis`); omite o que o template não usa. */
export function variaveisDoEnvio(
  template: TemplateDoCanal,
  rascunho: RascunhoDoTemplate,
): VariaveisDoTemplate {
  const cabecalho = rascunho.cabecalho.map((v) => v.trim());
  const corpo = rascunho.corpo.map((v) => v.trim());
  const temBotao = template.botoes.some((b) => b.variaveis.length > 0);
  const botoes = template.botoes.map((b, i) =>
    b.variaveis.length > 0 ? rascunho.botoes[i].trim() : null,
  );
  return {
    ...(template.cabecalho?.variaveis.length ? { cabecalho } : {}),
    ...(template.corpo.variaveis.length ? { corpo } : {}),
    ...(temBotao ? { botoes } : {}),
  };
}

/** Filtra por nome, texto do corpo ou categoria (sem acento, sem caixa). */
export function filtrarTemplates(
  templates: readonly TemplateDoCanal[],
  busca: string,
): readonly TemplateDoCanal[] {
  const termo = normalizar(busca);
  if (!termo) {
    return templates;
  }
  return templates.filter((t) =>
    normalizar(`${t.nome} ${t.corpo.texto} ${t.cabecalho?.texto ?? ''}`).includes(termo),
  );
}

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim();
}
