/**
 * Regras do chat do site que a tela confere antes de enviar (a API confere de novo, com as
 * mesmas regras: crmbrl-api, `src/canais/webchat/configuracao-webchat.ts`). Funções puras,
 * testadas em `widget.spec.ts`.
 */

const COR = /^#[0-9a-f]{6}$/i;
const HOST =
  /^(\*\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

/**
 * Domínio digitado → a origem que o navegador manda (`https://www.site.com.br`): sem caminho,
 * sem barra no fim, em minúsculas; sem esquema, vale `https://`; `*.` no começo vale para os
 * subdomínios. `null` quando não serve.
 *
 * `www.site.com.br/contato` → `https://www.site.com.br`; `http://localhost:8080/` →
 * `http://localhost:8080`.
 */
export function normalizarDominio(entrada: string): string | null {
  let texto = entrada.trim().toLowerCase();
  if (texto === '') {
    return null;
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(texto)) {
    texto = `https://${texto}`;
  }
  const curinga = /^(https?:\/\/)\*\./.exec(texto);
  const semCuringa = curinga ? texto.replace('*.', '') : texto;
  let url: URL;
  try {
    url = new URL(semCuringa);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  if (url.username || url.password) {
    return null;
  }
  const host = `${curinga ? '*.' : ''}${url.hostname}`;
  if (!HOST.test(host) && !/^\[[0-9a-f:.]+\]$/.test(url.hostname)) {
    return null;
  }
  return `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`;
}

/** `#RRGGBB`? */
export function ehCor(valor: string | null | undefined): valor is string {
  return typeof valor === 'string' && COR.test(valor.trim());
}

/**
 * Cor do texto (branco ou quase preto) de mais contraste sobre a cor de fundo — a mesma conta
 * da API para a "cor do texto automática".
 */
export function corDeTextoPara(fundo: string): string {
  const valor = ehCor(fundo) ? fundo.trim().slice(1) : '2563EB';
  const canais = [0, 2, 4].map((inicio) => {
    const c = Number.parseInt(valor.slice(inicio, inicio + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminancia = 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
  return 1.05 / (luminancia + 0.05) >= (luminancia + 0.05) / 0.05 ? '#FFFFFF' : '#111827';
}

/** Razão de contraste entre duas cores `#RRGGBB` (1 a 21). */
export function contraste(a: string, b: string): number {
  const luminancia = (cor: string) => {
    const valor = ehCor(cor) ? cor.trim().slice(1) : '000000';
    const [r, g, bl] = [0, 2, 4].map((inicio) => {
      const c = Number.parseInt(valor.slice(inicio, inicio + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}
