import { computed, DOCUMENT, inject, Injectable, signal } from '@angular/core';

import { gravarArmazenado, lerArmazenado, removerArmazenado } from './armazenamento';

export type Tema = 'escuro' | 'claro';

export const CHAVE_TEMA = 'crmbrl.tema';

/** Cor da `meta[name=theme-color]` — acompanha `--cor-fundo` de cada tema. */
const COR_DO_FUNDO: Readonly<Record<Tema, string>> = { escuro: '#000000', claro: '#efefec' };

function ehTema(valor: unknown): valor is Tema {
  return valor === 'escuro' || valor === 'claro';
}

/**
 * Tema claro/escuro (DESIGN-SYSTEM.md §3). Enquanto o usuário não escolhe, acompanha o
 * sistema operacional; depois da escolha (salva em `localStorage['crmbrl.tema']`), fica fixo.
 * O script inline do index.html aplica a mesma regra antes da primeira pintura.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly documento = inject(DOCUMENT);
  private readonly midia =
    this.documento.defaultView?.matchMedia?.('(prefers-color-scheme: light)') ?? null;

  private readonly escolha = signal<Tema | null>(this.lerEscolha());
  private readonly sistema = signal<Tema>(this.midia?.matches ? 'claro' : 'escuro');

  /** Tema em uso. */
  readonly tema = computed<Tema>(() => this.escolha() ?? this.sistema());
  /** `true` enquanto o tema segue o sistema operacional (sem escolha salva). */
  readonly segueSistema = computed(() => this.escolha() === null);
  readonly ehEscuro = computed(() => this.tema() === 'escuro');

  constructor() {
    this.midia?.addEventListener?.('change', (evento) => {
      this.sistema.set(evento.matches ? 'claro' : 'escuro');
      this.aplicar();
    });
    // Outra aba trocou o tema: acompanha.
    this.documento.defaultView?.addEventListener('storage', (evento) => {
      if (evento.key === CHAVE_TEMA) {
        this.escolha.set(ehTema(evento.newValue) ? evento.newValue : null);
        this.aplicar();
      }
    });
    this.aplicar();
  }

  alternar(): void {
    this.definir(this.tema() === 'escuro' ? 'claro' : 'escuro');
  }

  definir(tema: Tema): void {
    this.escolha.set(tema);
    gravarArmazenado(CHAVE_TEMA, tema);
    this.aplicar();
  }

  /** Esquece a escolha e volta a seguir o sistema operacional. */
  seguirSistema(): void {
    this.escolha.set(null);
    removerArmazenado(CHAVE_TEMA);
    this.aplicar();
  }

  private lerEscolha(): Tema | null {
    const salvo = lerArmazenado(CHAVE_TEMA);
    return ehTema(salvo) ? salvo : null;
  }

  /** Atualiza `data-tema`, `color-scheme` e a `meta[name=theme-color]`. */
  private aplicar(): void {
    const tema = this.tema();
    const raiz = this.documento.documentElement;
    raiz.setAttribute('data-tema', tema);
    raiz.style.colorScheme = tema === 'claro' ? 'light' : 'dark';
    this.documento
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', COR_DO_FUNDO[tema]);
  }
}
