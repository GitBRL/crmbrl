import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

/**
 * Markdown simples (o que o assistente escreve): parágrafos, títulos, listas com marcador ou
 * numeradas, negrito, itálico, código e links. Vira uma árvore de dados e o componente a
 * desenha com elementos do Angular — nunca `innerHTML`, então nada que a IA escreva vira HTML.
 */
export type Trecho =
  | { readonly tipo: 'texto' | 'negrito' | 'italico' | 'codigo'; readonly texto: string }
  | {
      readonly tipo: 'link';
      readonly texto: string;
      readonly href: string;
      readonly interno: boolean;
    };

export type BlocoMarkdown =
  | { readonly tipo: 'paragrafo'; readonly trechos: readonly Trecho[] }
  | { readonly tipo: 'titulo'; readonly trechos: readonly Trecho[] }
  | {
      readonly tipo: 'lista';
      readonly ordenada: boolean;
      readonly itens: readonly (readonly Trecho[])[];
    }
  | { readonly tipo: 'codigo'; readonly texto: string };

const INLINE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g;

function hrefSeguro(href: string): { href: string; interno: boolean } | null {
  if (/^https?:\/\//i.test(href)) {
    return { href, interno: false };
  }
  if (href.startsWith('/') && !href.startsWith('//')) {
    return { href, interno: true };
  }
  return null;
}

export function trechosDoTexto(linha: string): readonly Trecho[] {
  const trechos: Trecho[] = [];
  let ultimo = 0;
  for (const achado of linha.matchAll(INLINE)) {
    const bruto = achado[0];
    const inicio = achado.index ?? 0;
    if (inicio > ultimo) {
      trechos.push({ tipo: 'texto', texto: linha.slice(ultimo, inicio) });
    }
    ultimo = inicio + bruto.length;
    if (bruto.startsWith('**') || bruto.startsWith('__')) {
      trechos.push({ tipo: 'negrito', texto: bruto.slice(2, -2) });
    } else if (bruto.startsWith('`')) {
      trechos.push({ tipo: 'codigo', texto: bruto.slice(1, -1) });
    } else if (bruto.startsWith('[')) {
      const meio = bruto.indexOf('](');
      const rotulo = bruto.slice(1, meio);
      const alvo = hrefSeguro(bruto.slice(meio + 2, -1));
      trechos.push(
        alvo ? { tipo: 'link', texto: rotulo, ...alvo } : { tipo: 'texto', texto: rotulo },
      );
    } else {
      trechos.push({ tipo: 'italico', texto: bruto.slice(1, -1) });
    }
  }
  if (ultimo < linha.length) {
    trechos.push({ tipo: 'texto', texto: linha.slice(ultimo) });
  }
  return trechos;
}

export function blocosDoMarkdown(markdown: string): readonly BlocoMarkdown[] {
  const blocos: BlocoMarkdown[] = [];
  const linhas = markdown.replace(/\r\n?/g, '\n').split('\n');
  let paragrafo: string[] = [];
  let lista: { ordenada: boolean; itens: string[] } | null = null;
  const fecharParagrafo = () => {
    if (paragrafo.length) {
      blocos.push({ tipo: 'paragrafo', trechos: trechosDoTexto(paragrafo.join(' ')) });
      paragrafo = [];
    }
  };
  const fecharLista = () => {
    if (lista) {
      blocos.push({
        tipo: 'lista',
        ordenada: lista.ordenada,
        itens: lista.itens.map(trechosDoTexto),
      });
      lista = null;
    }
  };
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (linha.trimStart().startsWith('```')) {
      fecharParagrafo();
      fecharLista();
      const codigo: string[] = [];
      i++;
      while (i < linhas.length && !linhas[i].trimStart().startsWith('```')) {
        codigo.push(linhas[i++]);
      }
      blocos.push({ tipo: 'codigo', texto: codigo.join('\n') });
      continue;
    }
    if (linha.trim() === '') {
      fecharParagrafo();
      fecharLista();
      continue;
    }
    const titulo = /^#{1,6}\s+(.*)$/.exec(linha);
    if (titulo) {
      fecharParagrafo();
      fecharLista();
      blocos.push({ tipo: 'titulo', trechos: trechosDoTexto(titulo[1]) });
      continue;
    }
    const item = /^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/.exec(linha);
    if (item) {
      fecharParagrafo();
      const ordenada = item[2] !== undefined;
      if (lista && lista.ordenada !== ordenada) {
        fecharLista();
      }
      lista ??= { ordenada, itens: [] };
      lista.itens.push(item[3]);
      continue;
    }
    fecharLista();
    paragrafo.push(linha.trim());
  }
  fecharParagrafo();
  fecharLista();
  return blocos;
}

@Component({
  selector: 'app-markdown-simples',
  imports: [NgTemplateOutlet, RouterLink],
  template: `
    @for (bloco of blocos(); track $index) {
      @switch (bloco.tipo) {
        @case ('paragrafo') {
          <p>
            <ng-container
              [ngTemplateOutlet]="inline"
              [ngTemplateOutletContext]="{ $implicit: bloco.trechos }"
            />
          </p>
        }
        @case ('titulo') {
          <p class="md__titulo">
            <strong
              ><ng-container
                [ngTemplateOutlet]="inline"
                [ngTemplateOutletContext]="{ $implicit: bloco.trechos }"
            /></strong>
          </p>
        }
        @case ('lista') {
          @if (bloco.ordenada) {
            <ol>
              @for (item of bloco.itens; track $index) {
                <li>
                  <ng-container
                    [ngTemplateOutlet]="inline"
                    [ngTemplateOutletContext]="{ $implicit: item }"
                  />
                </li>
              }
            </ol>
          } @else {
            <ul>
              @for (item of bloco.itens; track $index) {
                <li>
                  <ng-container
                    [ngTemplateOutlet]="inline"
                    [ngTemplateOutletContext]="{ $implicit: item }"
                  />
                </li>
              }
            </ul>
          }
        }
        @case ('codigo') {
          <pre class="md__codigo"><code>{{ bloco.texto }}</code></pre>
        }
      }
    }
    <ng-template #inline let-trechos>
      @for (trecho of trechos; track $index) {
        @switch (trecho.tipo) {
          @case ('negrito') {
            <strong>{{ trecho.texto }}</strong>
          }
          @case ('italico') {
            <em>{{ trecho.texto }}</em>
          }
          @case ('codigo') {
            <code>{{ trecho.texto }}</code>
          }
          @case ('link') {
            @if (trecho.interno) {
              <a [routerLink]="trecho.href">{{ trecho.texto }}</a>
            } @else {
              <a [href]="trecho.href" target="_blank" rel="noopener noreferrer">{{
                trecho.texto
              }}</a>
            }
          }
          @default {
            {{ trecho.texto }}
          }
        }
      }
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
      overflow-wrap: anywhere;
    }
    p,
    ul,
    ol {
      margin: 0 0 0.6em;
    }
    :host > :last-child {
      margin-bottom: 0;
    }
    ul,
    ol {
      padding-inline-start: 1.25rem;
    }
    code {
      font-family: var(--fonte-mono, ui-monospace, monospace);
      font-size: 0.9em;
      padding: 0.05em 0.3em;
      border-radius: 4px;
      background: color-mix(in srgb, currentColor 10%, transparent);
    }
    .md__codigo {
      margin: 0 0 0.6em;
      padding: 0.6rem 0.75rem;
      border-radius: 8px;
      overflow-x: auto;
      background: color-mix(in srgb, currentColor 8%, transparent);
    }
    .md__codigo code {
      padding: 0;
      background: none;
    }
    a {
      color: inherit;
      text-decoration: underline;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownSimples {
  readonly texto = input.required<string>();
  protected readonly blocos = computed(() => blocosDoMarkdown(this.texto()));
}
