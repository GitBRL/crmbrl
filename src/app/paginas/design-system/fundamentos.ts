import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  signal,
  viewChild,
} from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

import { MODULOS } from '../../nucleo/navegacao';
import { Indicador } from '../../ui/indicador/indicador';
import { Logo } from '../../ui/logo/logo';
import { partirTitulo } from '../../ui/tipos';
import {
  ALTURAS,
  CAMADAS,
  ESPACOS,
  MOVIMENTO,
  PALETA_BASE,
  PONTOS_DE_QUEBRA,
  RAIOS,
  TIPOGRAFIA,
  TOKENS_COR,
} from './dados';
import { Exemplo } from './exemplo';
import { Secao } from './secao';

/** Valor de um token de cor nos dois temas, como aparece no catálogo ("#161616", "branco 7%"). */
export interface ValorDosTemas {
  readonly escuro: string;
  readonly claro: string;
}

/**
 * Descreve uma cor já resolvida pelo navegador (`rgb(…)`/`rgba(…)`) do jeito do catálogo:
 * hex em maiúsculas quando opaca; "branco 7%" / "preto 16%" para as transparências da
 * interface; "transparente" quando some.
 */
export function descreverCor(cor: string): string {
  const partes = /^rgba?\(([^)]*)\)$/.exec(cor.trim());
  if (!partes) {
    return cor.trim();
  }
  const [r, g, b, a = 1] = partes[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);
  if (a === 0) {
    return 'transparente';
  }
  const hex = `#${[r, g, b].map((canal) => canal.toString(16).padStart(2, '0')).join('')}`;
  if (a >= 1) {
    return hex.toUpperCase();
  }
  const opacidade = `${Math.round(a * 100)}%`;
  if (r === 255 && g === 255 && b === 255) {
    return `branco ${opacidade}`;
  }
  if (r === 0 && g === 0 && b === 0) {
    return `preto ${opacidade}`;
  }
  return `${hex.toUpperCase()} ${opacidade}`;
}

/**
 * Fundamentos do catálogo (seções 01–04): cores, tipografia, espaço e forma, ícones.
 * Os valores das cores saem do CSS: depois da primeira renderização, duas sondas escondidas
 * (uma com `data-tema="escuro"`, outra com `data-tema="claro"`) leem cada token com
 * `getComputedStyle`. Assim o catálogo nunca mostra um valor diferente do que vale na tela.
 * Uso interno de paginas/design-system.
 */
@Component({
  selector: 'app-ds-fundamentos',
  imports: [LucideDynamicIcon, Exemplo, Indicador, Logo, Secao],
  templateUrl: './fundamentos.html',
  styleUrl: './fundamentos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fundamentos {
  protected readonly paleta = PALETA_BASE;
  protected readonly tokensCor = TOKENS_COR;
  protected readonly tipografia = TIPOGRAFIA;
  protected readonly espacos = ESPACOS;
  protected readonly raios = RAIOS;
  protected readonly alturas = ALTURAS;
  protected readonly movimento = MOVIMENTO;
  protected readonly camadas = CAMADAS;
  protected readonly pontosDeQuebra = PONTOS_DE_QUEBRA;
  protected readonly modulos = MODULOS;
  protected readonly partirTitulo = partirTitulo;

  /** Valor de cada token nos dois temas, lido do CSS (vazio até a primeira renderização). */
  protected readonly valores = signal<Readonly<Record<string, ValorDosTemas>>>({});

  private readonly sondaEscuro = viewChild.required<ElementRef<HTMLElement>>('sondaEscuro');
  private readonly sondaClaro = viewChild.required<ElementRef<HTMLElement>>('sondaClaro');

  constructor() {
    afterNextRender(() => this.lerValores());
  }

  /** Valor de um token (a paleta base é igual nos dois temas). */
  protected valor(token: string, tema: keyof ValorDosTemas = 'escuro'): string {
    return this.valores()[token]?.[tema] ?? '';
  }

  private lerValores(): void {
    const escuro = this.sondaEscuro().nativeElement;
    const claro = this.sondaClaro().nativeElement;
    const tokens = [
      ...this.paleta.map((cor) => cor.token),
      ...this.tokensCor.flatMap((grupo) => grupo.tokens.map((cor) => cor.token)),
    ];
    const lidos: Record<string, ValorDosTemas> = {};
    for (const token of tokens) {
      lidos[token] = { escuro: lerCorDoToken(escuro, token), claro: lerCorDoToken(claro, token) };
    }
    this.valores.set(lidos);
  }
}

/**
 * Valor de um token de cor dentro de um elemento (uma sonda, um painel com `data-tema`), do
 * jeito do catálogo ("#000000", "branco 7%"): o navegador converte qualquer escrita (hex curto,
 * `rgba`, `var(…)`) em `rgb(…)`/`rgba(…)` ao aplicá-la como cor. Vazio se o token não existe.
 */
export function lerCorDoToken(sonda: HTMLElement, token: string): string {
  const bruto = getComputedStyle(sonda).getPropertyValue(token).trim();
  if (!bruto) {
    return '';
  }
  sonda.style.color = '';
  sonda.style.color = bruto;
  const resolvido = sonda.style.color ? getComputedStyle(sonda).color : bruto;
  sonda.style.color = '';
  return descreverCor(resolvido);
}
