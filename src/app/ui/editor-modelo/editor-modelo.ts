import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  signal,
} from '@angular/core';
import { LucideShuffle } from '@lucide/angular';

import { AreaTexto } from '../area-texto/area-texto';
import { Botao } from '../botao/botao';
import { type OpcaoSeletor, Seletor } from '../seletor/seletor';
import { gerarId } from '../tipos';
import {
  type ContatoPrevia,
  contarCombinacoes,
  inserirNoTexto,
  marcadorDaVariavel,
  renderizarModelo,
  temVariacao,
  validarModelo,
  type VariavelModelo,
  VARIAVEIS_PADRAO,
} from './modelo-mensagem';

/** Contatos de exemplo da prévia, quando a tela não passa os dela. */
export const CONTATOS_PREVIA_PADRAO: readonly ContatoPrevia[] = [
  {
    id: 'exemplo-1',
    rotulo: 'Maria Souza',
    dados: {
      'contato.nome': 'Maria Souza',
      'contato.primeiro_nome': 'Maria',
      'empresa.nome': 'Colégio Horizonte',
      'negocio.titulo': 'Plano Rede 2027',
      'responsavel.nome': 'Ana Ribeiro',
    },
  },
  {
    id: 'exemplo-2',
    rotulo: 'João Batista',
    dados: {
      'contato.nome': 'João Batista',
      'contato.primeiro_nome': 'João',
      'empresa.nome': 'Escola Novo Rumo',
      'responsavel.nome': 'Rafael Souto',
    },
  },
];

/**
 * Editor de modelo de mensagem (DESIGN-SYSTEM.md §4.7): a área de texto da mensagem com
 * botões que inserem variáveis (`{{contato.primeiro_nome}}`) e variações (`{olá|oi}`) onde o
 * cursor está, aviso de variável desconhecida, e uma prévia por contato (seletor de contato,
 * "Outra variação" para sortear de novo). O valor é o texto do modelo, no mesmo formato que a
 * API renderiza. Campos personalizados (`{{contato.campos.vencimento}}`) são sempre aceitos.
 *
 * `<app-editor-modelo [(valor)]="texto" [variaveis]="variaveis" [contatos]="contatos" />`
 */
@Component({
  selector: 'app-editor-modelo',
  imports: [AreaTexto, Botao, Seletor],
  template: `
    <div class="modelo">
      <app-area-texto
        class="modelo__texto"
        [rotulo]="rotulo()"
        [dica]="dica()"
        [linhas]="6"
        [maximoCaracteres]="maximoCaracteres()"
        [valor]="valor()"
        (valorChange)="valor.set($event)"
      />

      <div class="modelo__ferramentas">
        <div class="modelo__variaveis" role="group" aria-label="Inserir variável">
          <span class="modelo__sub" aria-hidden="true">Inserir</span>
          @for (variavel of variaveis(); track variavel.id) {
            <button type="button" class="modelo__variavel" (click)="inserirVariavel(variavel)">
              {{ variavel.rotulo }}
            </button>
          }
        </div>
        <button
          appBotao
          type="button"
          tamanho="sm"
          variante="contorno"
          [icone]="iconeVariacao"
          (click)="inserirVariacao()"
        >
          Adicionar variação
        </button>
      </div>

      @if (problemas().length) {
        <ul class="modelo__problemas" role="alert">
          @for (problema of problemas(); track problema.mensagem) {
            <li>{{ problema.mensagem }}</li>
          }
        </ul>
      }

      <section class="modelo__previa" [attr.aria-labelledby]="idPrevia">
        <header class="modelo__previa-topo">
          <h3 class="modelo__previa-titulo" [id]="idPrevia">Prévia</h3>
          <app-seletor
            class="modelo__contato"
            rotulo="Como o contato vê"
            [rotuloOculto]="true"
            [opcoes]="opcoesContato()"
            [valor]="contatoId()"
            (valorChange)="escolherContato($event)"
          />
          @if (comVariacao()) {
            <button
              appBotao
              type="button"
              tamanho="sm"
              variante="contorno"
              (click)="outraVariacao()"
            >
              Outra variação
            </button>
          }
        </header>
        @if (partes().length) {
          <p class="modelo__bolha" data-teste="previa">
            @for (parte of partes(); track $index) {
              @switch (parte.tipo) {
                @case ('texto') {
                  <span>{{ parte.texto }}</span>
                }
                @case ('faltando') {
                  <mark class="modelo__destaque modelo__destaque--faltando"
                    >[sem {{ parte.texto }}]</mark
                  >
                }
                @default {
                  <mark class="modelo__destaque">{{ parte.texto }}</mark>
                }
              }
            }
          </p>
        } @else {
          <p class="modelo__vazio">Escreva a mensagem para ver como ela chega ao contato.</p>
        }
        @if (comVariacao()) {
          <p class="modelo__nota">
            Esta mensagem tem {{ combinacoes() }} combinações; cada contato recebe uma.
          </p>
        }
      </section>
    </div>
  `,
  styleUrl: './editor-modelo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorModelo {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  /** Texto do modelo. */
  readonly valor = model('');
  readonly rotulo = input('Mensagem');
  readonly dica = input<string | null>(
    'Use os botões para personalizar a mensagem para cada contato.',
  );
  readonly variaveis = input<readonly VariavelModelo[]>(VARIAVEIS_PADRAO);
  readonly contatos = input<readonly ContatoPrevia[]>(CONTATOS_PREVIA_PADRAO);
  readonly maximoCaracteres = input<number | null>(1000);

  protected readonly idPrevia = gerarId('previa');
  protected readonly iconeVariacao = LucideShuffle;
  private readonly escolhido = signal<string | null>(null);
  private readonly rodada = signal(0);

  protected readonly opcoesContato = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.contatos().map((contato) => ({ valor: contato.id, rotulo: contato.rotulo })),
  );
  protected readonly contatoId = computed(() => {
    const id = this.escolhido();
    return this.contatos().some((c) => c.id === id) ? id : (this.contatos()[0]?.id ?? null);
  });
  private readonly contato = computed(() => this.contatos().find((c) => c.id === this.contatoId()));

  protected readonly problemas = computed(() => validarModelo(this.valor(), this.variaveis()));
  protected readonly comVariacao = computed(() => temVariacao(this.valor()));
  protected readonly combinacoes = computed(() => contarCombinacoes(this.valor()));
  protected readonly partes = computed(() =>
    this.valor().trim()
      ? renderizarModelo(
          this.valor(),
          this.contato()?.dados ?? {},
          `${this.contato()?.id ?? ''}:${this.rodada()}`,
        )
      : [],
  );

  protected escolherContato(id: string | null): void {
    this.escolhido.set(id);
  }

  protected outraVariacao(): void {
    this.rodada.update((n) => n + 1);
  }

  protected inserirVariavel(variavel: VariavelModelo): void {
    this.inserir(marcadorDaVariavel(variavel.id));
  }

  /** Com texto selecionado, `{selecionado|}` com o cursor depois da barra; sem, duas opções. */
  protected inserirVariacao(): void {
    const area = this.textarea();
    const { inicio, fim } = this.selecao(area);
    const marcado = this.valor().slice(inicio, fim);
    if (marcado) {
      const texto = `{${marcado}|}`;
      this.inserir(texto, { de: texto.length - 1, ate: texto.length - 1 });
    } else {
      this.inserir('{opção 1|opção 2}', { de: 1, ate: 16 });
    }
  }

  private inserir(texto: string, selecao?: { de: number; ate: number }): void {
    const { inicio, fim } = this.selecao(this.textarea());
    const resultado = inserirNoTexto(this.valor(), inicio, fim, texto, selecao);
    this.valor.set(resultado.texto);
    // O texto novo chega ao <textarea> na próxima renderização; só então dá para selecionar.
    afterNextRender(
      () => {
        const area = this.textarea();
        area?.focus();
        area?.setSelectionRange(resultado.de, resultado.ate);
      },
      { injector: this.injector },
    );
  }

  private textarea(): HTMLTextAreaElement | null {
    return this.host.querySelector('textarea');
  }

  private selecao(area: HTMLTextAreaElement | null): { inicio: number; fim: number } {
    const tamanho = this.valor().length;
    return {
      inicio: Math.min(area?.selectionStart ?? tamanho, tamanho),
      fim: Math.min(area?.selectionEnd ?? tamanho, tamanho),
    };
  }
}
