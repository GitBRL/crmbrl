import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Resposta rápida oferecida pelo "/" do compositor (modelo `RespostaRapida` da API). */
export interface RespostaRapidaOpcao {
  readonly id: string;
  /** Sem a barra: "boasvindas". */
  readonly atalho: string;
  readonly titulo: string;
  /** Pode ter variáveis: `{{contato.nome}}`. */
  readonly texto: string;
}

/** Quantas sugestões aparecem de uma vez. */
export const MAXIMO_SUGESTOES = 8;

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
}

/**
 * As respostas que combinam com o que veio depois da "/": primeiro as de atalho que começa
 * com o termo, depois as de atalho, título ou texto que o contêm (sem diferenciar acentos).
 */
export function filtrarRespostas(
  opcoes: readonly RespostaRapidaOpcao[],
  consulta: string,
  limite = MAXIMO_SUGESTOES,
): readonly RespostaRapidaOpcao[] {
  const termo = normalizar(consulta.trim());
  if (!termo) {
    return opcoes.slice(0, limite);
  }
  const comeca = opcoes.filter((opcao) => normalizar(opcao.atalho).startsWith(termo));
  const contem = opcoes.filter(
    (opcao) =>
      !comeca.includes(opcao) &&
      [opcao.atalho, opcao.titulo, opcao.texto].some((campo) => normalizar(campo).includes(termo)),
  );
  return [...comeca, ...contem].slice(0, limite);
}

/**
 * Lista das respostas rápidas sob o "/" do compositor (padrão listbox do WAI-ARIA): o foco
 * continua no campo de texto, que aponta para a opção ativa (`aria-activedescendant`); setas
 * mudam a ativa e Enter/Tab escolhem (o teclado é tratado pelo compositor). Uso interno do
 * `app-compositor`.
 */
@Component({
  selector: 'app-respostas-rapidas',
  template: `
    <p class="respostas__titulo" aria-hidden="true">Respostas rápidas</p>
    @if (opcoes().length) {
      <ul class="respostas__lista" role="listbox" [id]="idLista()" aria-label="Respostas rápidas">
        @for (opcao of opcoes(); track opcao.id; let i = $index) {
          <li
            class="respostas__opcao"
            role="option"
            [id]="idLista() + '-' + i"
            [attr.aria-selected]="i === ativa()"
            [class.respostas__opcao--ativa]="i === ativa()"
            (pointerdown)="$event.preventDefault()"
            (pointerenter)="passar.emit(i)"
            (click)="escolher.emit(opcao)"
          >
            <span class="respostas__linha">
              <code class="respostas__atalho">/{{ opcao.atalho }}</code>
              <span class="respostas__nome">{{ opcao.titulo }}</span>
            </span>
            <span class="respostas__texto">{{ opcao.texto }}</span>
          </li>
        }
      </ul>
    } @else {
      <p class="respostas__vazio">Nenhuma resposta rápida com “{{ consulta() }}”.</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-1);
      max-height: 300px;
      padding: var(--esp-2);
      overflow-y: auto;
      overscroll-behavior: contain;
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-lg);
      background: var(--cor-flutuante);
      color: var(--cor-texto);
      box-shadow: var(--sombra-flutuante);
    }

    .respostas__titulo,
    .respostas__vazio {
      padding: var(--esp-1) var(--esp-3);
      color: var(--cor-texto-fraco);
      font: var(--fonte-legenda);
      font-weight: 500;
    }

    .respostas__vazio {
      font-weight: 400;
    }

    .respostas__lista {
      display: grid;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .respostas__opcao {
      display: grid;
      gap: 2px;
      min-height: var(--altura-md);
      padding: var(--esp-2) var(--esp-3);
      border-radius: var(--raio-md);
      cursor: pointer;
    }

    .respostas__opcao--ativa {
      background: var(--cor-vidro-forte);
    }

    .respostas__linha {
      display: flex;
      align-items: baseline;
      gap: var(--esp-2);
      min-width: 0;
    }

    .respostas__atalho {
      flex: none;
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda);
      font-family: var(--familia-mono);
    }

    .respostas__nome {
      overflow: hidden;
      font: var(--fonte-rotulo);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .respostas__texto {
      overflow: hidden;
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda-lg);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    @media (forced-colors: active) {
      .respostas__opcao--ativa {
        outline: 2px solid Highlight;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RespostasRapidas {
  /** Já filtradas (`filtrarRespostas`). */
  readonly opcoes = input.required<readonly RespostaRapidaOpcao[]>();
  readonly ativa = input(0);
  readonly idLista = input.required<string>();
  /** O que veio depois da "/", para a frase de "nenhuma". */
  readonly consulta = input('');
  readonly escolher = output<RespostaRapidaOpcao>();
  /** O ponteiro passou por uma opção (vira a ativa). */
  readonly passar = output<number>();
}
