import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  InjectionToken,
  input,
  model,
  signal,
} from '@angular/core';
import { LucidePlus, LucideTrash2 } from '@lucide/angular';

import { BotaoIcone } from '../botao-icone/botao-icone';
import { Botao } from '../botao/botao';
import { CampoData } from '../campo-data/campo-data';
import { CampoTexto } from '../campo-texto/campo-texto';
import { type OpcaoSeletor, Seletor } from '../seletor/seletor';
import { gerarId } from '../tipos';
import {
  type CampoSegmento,
  type Combinacao,
  type CondicaoSegmento,
  entradaDoValor,
  erroDaCondicao,
  novaCondicao,
  type OperadorSegmento,
  operadoresDoTipo,
  ROTULO_OPERADOR,
  SEGMENTO_VAZIO,
  type Segmento,
  segmentoCompleto,
  trocarCampo,
  trocarOperador,
} from './segmento';

/**
 * Conta quantos contatos o segmento alcança. A tela entrega a função (hoje uma simulação, depois
 * a chamada à API); o componente chama sempre com o segmento completo, depois da pausa de
 * digitação, e ignora respostas atrasadas.
 */
export type ContagemSegmento = (segmento: Segmento) => Promise<number>;

/** Função de contagem padrão da árvore (quando a entrada `contagem` não é passada). */
export const CONTAGEM_SEGMENTO = new InjectionToken<ContagemSegmento>('CONTAGEM_SEGMENTO');

type EstadoContagem =
  { tipo: 'sem' } | { tipo: 'carregando' } | { tipo: 'pronto'; total: number } | { tipo: 'erro' };

const COMBINACOES: readonly OpcaoSeletor<Combinacao>[] = [
  { valor: 'todos', rotulo: 'todas as condições' },
  { valor: 'qualquer', rotulo: 'qualquer uma das condições' },
];

/**
 * Construtor de segmento (DESIGN-SYSTEM.md §4.7): filtros de contatos em linguagem simples.
 * Cada linha é "campo · operador · valor" ("Etiqueta é Cliente"); com duas ou mais, a pessoa
 * escolhe se o contato precisa atender a todas ou a qualquer uma. Embaixo, a contagem ao vivo
 * ("1.248 contatos") vinda da função injetável (`contagem` ou `CONTAGEM_SEGMENTO`), com
 * estados de carregando e de erro; linhas incompletas não entram na contagem.
 *
 * `<app-construtor-segmento [campos]="campos" [contagem]="contar" [(valor)]="segmento" />`
 */
@Component({
  selector: 'app-construtor-segmento',
  imports: [Seletor, CampoTexto, CampoData, Botao, BotaoIcone],
  template: `
    <div class="segmento">
      @if (valor().condicoes.length > 1) {
        <p class="segmento__frase">
          <span>Incluir contatos que atendem a</span>
          <app-seletor
            class="segmento__combinacao"
            rotulo="Combinação das condições"
            [rotuloOculto]="true"
            [opcoes]="combinacoes"
            [valor]="valor().combinacao"
            (valorChange)="mudarCombinacao($event)"
          />
        </p>
      }

      @if (linhas().length) {
        <ol class="segmento__lista">
          @for (linha of linhas(); track linha.condicao.id; let i = $index) {
            <li class="segmento__linha">
              <app-seletor
                class="segmento__campo"
                [rotulo]="'Campo da condição ' + (i + 1)"
                [rotuloOculto]="true"
                [opcoes]="opcoesCampos()"
                [valor]="linha.condicao.campo"
                (valorChange)="escolherCampo(linha.condicao, $event)"
              />
              <app-seletor
                class="segmento__operador"
                [rotulo]="'Operador da condição ' + (i + 1)"
                [rotuloOculto]="true"
                [opcoes]="linha.operadores"
                [valor]="linha.condicao.operador"
                (valorChange)="escolherOperador(linha.condicao, $event)"
              />
              @switch (linha.entrada) {
                @case ('texto') {
                  <app-campo-texto
                    class="segmento__valor"
                    [rotulo]="'Valor da condição ' + (i + 1)"
                    [rotuloOculto]="true"
                    placeholder="Valor"
                    [valor]="linha.condicao.valor"
                    (valorChange)="mudarValor(linha.condicao, $event)"
                  />
                }
                @case ('numero') {
                  <app-campo-texto
                    class="segmento__valor"
                    tipo="number"
                    [rotulo]="'Valor da condição ' + (i + 1)"
                    [rotuloOculto]="true"
                    placeholder="0"
                    [minimo]="0"
                    [valor]="linha.condicao.valor"
                    (valorChange)="mudarValor(linha.condicao, $event)"
                  />
                }
                @case ('data') {
                  <app-campo-data
                    class="segmento__valor"
                    [rotulo]="'Data da condição ' + (i + 1)"
                    [rotuloOculto]="true"
                    [valor]="textoDoValor(linha.condicao)"
                    (valorChange)="mudarValor(linha.condicao, $event)"
                  />
                }
                @case ('opcao') {
                  <app-seletor
                    class="segmento__valor"
                    [rotulo]="'Valor da condição ' + (i + 1)"
                    [rotuloOculto]="true"
                    placeholder="Escolha"
                    [opcoes]="linha.opcoes"
                    [valor]="textoDoValor(linha.condicao)"
                    (valorChange)="mudarValor(linha.condicao, $event)"
                  />
                }
                @default {
                  <span class="segmento__valor segmento__valor--nenhum" aria-hidden="true"></span>
                }
              }
              <button
                appBotaoIcone
                type="button"
                class="segmento__remover"
                variante="neutro"
                tamanho="sm"
                [icone]="iconeRemover"
                [rotulo]="'Remover condição ' + (i + 1)"
                (click)="remover(linha.condicao.id)"
              ></button>
            </li>
          }
        </ol>
      } @else {
        <p class="segmento__vazio">
          Sem condições: vale para todos os contatos. Adicione uma para filtrar.
        </p>
      }

      <div class="segmento__rodape">
        <button
          appBotao
          type="button"
          variante="contorno"
          tamanho="sm"
          [icone]="iconeAdicionar"
          [disabled]="campos().length === 0"
          (click)="adicionar()"
        >
          Adicionar condição
        </button>

        <p
          class="segmento__contagem"
          aria-live="polite"
          [attr.aria-busy]="estado().tipo === 'carregando'"
        >
          @switch (estado().tipo) {
            @case ('carregando') {
              <span class="segmento__contagem-texto">Contando…</span>
            }
            @case ('erro') {
              <span class="segmento__contagem-texto segmento__contagem-texto--erro"
                >Não deu para contar agora.
                <button type="button" class="segmento__tentar" (click)="recontar()">
                  Tentar de novo
                </button></span
              >
            }
            @case ('pronto') {
              <span class="segmento__numero numeros">{{ total() }}</span>
              <span class="segmento__contagem-texto">{{ rotuloTotal() }}</span>
            }
          }
        </p>
      </div>
      @if (incompletas() > 0) {
        <p class="segmento__nota">
          {{ incompletas() === 1 ? '1 condição está' : incompletas() + ' condições estão' }}
          incompleta{{ incompletas() === 1 ? '' : 's' }} e não entra{{
            incompletas() === 1 ? '' : 'm'
          }}
          na contagem.
        </p>
      }
    </div>
  `,
  styleUrl: './construtor-segmento.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConstrutorSegmento {
  private readonly contagemInjetada = inject(CONTAGEM_SEGMENTO, { optional: true });

  /** Campos que podem ser filtrados. */
  readonly campos = input.required<readonly CampoSegmento[]>();
  readonly valor = model<Segmento>(SEGMENTO_VAZIO);
  /** Função de contagem; sem ela, usa `CONTAGEM_SEGMENTO` e, sem os dois, não mostra contagem. */
  readonly contagem = input<ContagemSegmento | null>(null);
  /** Pausa depois da última alteração, antes de contar (ms). */
  readonly atrasoMs = input(400);
  /** "contato"/"contatos" na frase da contagem. */
  readonly substantivo = input<readonly [singular: string, plural: string]>([
    'contato',
    'contatos',
  ]);

  protected readonly iconeAdicionar = LucidePlus;
  protected readonly iconeRemover = LucideTrash2;
  protected readonly combinacoes = COMBINACOES;

  protected readonly estado = signal<EstadoContagem>({ tipo: 'sem' });
  private readonly nova = signal(0);
  private chamada = 0;

  protected readonly opcoesCampos = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.campos().map((campo) => ({
      valor: campo.id,
      rotulo: campo.grupo ? `${campo.grupo} · ${campo.rotulo}` : campo.rotulo,
    })),
  );

  /** Cada condição com o que a linha precisa para se desenhar. */
  protected readonly linhas = computed(() =>
    this.valor().condicoes.map((condicao) => {
      const campo = this.campos().find((c) => c.id === condicao.campo);
      const tipo = campo?.tipo ?? 'texto';
      return {
        condicao,
        entrada: entradaDoValor(tipo, condicao.operador),
        operadores: operadoresDoTipo(tipo).map<OpcaoSeletor<OperadorSegmento>>((operador) => ({
          valor: operador,
          rotulo: ROTULO_OPERADOR[operador],
        })),
        opcoes: (campo?.opcoes ?? []).map<OpcaoSeletor<string>>((o) => ({
          valor: o.valor,
          rotulo: o.rotulo,
        })),
      };
    }),
  );

  protected readonly incompletas = computed(
    () => this.valor().condicoes.filter((c) => erroDaCondicao(c, this.campos()) !== null).length,
  );

  private readonly paraContar = computed(() => segmentoCompleto(this.valor(), this.campos()));
  private readonly funcao = computed(() => this.contagem() ?? this.contagemInjetada);

  protected readonly total = computed(() => {
    const estado = this.estado();
    return estado.tipo === 'pronto' ? estado.total.toLocaleString('pt-BR') : '';
  });
  protected readonly rotuloTotal = computed(() => {
    const estado = this.estado();
    const [singular, plural] = this.substantivo();
    const quantos = estado.tipo === 'pronto' ? estado.total : 0;
    const filtrado = this.paraContar().condicoes.length > 0;
    return `${quantos === 1 ? singular : plural}${filtrado ? ' neste segmento' : ' no total'}`;
  });

  constructor() {
    effect((limpar) => {
      const segmento = this.paraContar();
      const funcao = this.funcao();
      this.nova();
      const atraso = this.atrasoMs();
      const numero = ++this.chamada;
      if (!funcao) {
        this.estado.set({ tipo: 'sem' });
        return;
      }
      this.estado.set({ tipo: 'carregando' });
      const espera = setTimeout(() => {
        funcao(segmento).then(
          (total) => {
            if (numero === this.chamada) {
              this.estado.set({ tipo: 'pronto', total });
            }
          },
          () => {
            if (numero === this.chamada) {
              this.estado.set({ tipo: 'erro' });
            }
          },
        );
      }, atraso);
      limpar(() => clearTimeout(espera));
    });
  }

  protected adicionar(): void {
    const primeiro = this.campos()[0];
    if (primeiro) {
      this.atualizar([...this.valor().condicoes, novaCondicao(gerarId('condicao'), primeiro)]);
    }
  }

  protected remover(id: string): void {
    this.atualizar(this.valor().condicoes.filter((c) => c.id !== id));
  }

  protected mudarCombinacao(combinacao: Combinacao | null): void {
    this.valor.set({ ...this.valor(), combinacao: combinacao ?? 'todos' });
  }

  protected escolherCampo(condicao: CondicaoSegmento, id: string | null): void {
    const novo = this.campos().find((c) => c.id === id);
    if (novo) {
      const antigo = this.campos().find((c) => c.id === condicao.campo);
      this.trocar(trocarCampo(condicao, antigo, novo));
    }
  }

  protected escolherOperador(condicao: CondicaoSegmento, operador: OperadorSegmento | null): void {
    if (operador) {
      const campo = this.campos().find((c) => c.id === condicao.campo);
      this.trocar(trocarOperador(condicao, campo, operador));
    }
  }

  protected mudarValor(condicao: CondicaoSegmento, bruto: string | number | null): void {
    const campo = this.campos().find((c) => c.id === condicao.campo);
    const numerico = entradaDoValor(campo?.tipo ?? 'texto', condicao.operador) === 'numero';
    const valor = bruto === null || bruto === '' ? null : numerico ? Number(bruto) : String(bruto);
    this.trocar({ ...condicao, valor: Number.isNaN(valor) ? null : valor });
  }

  protected textoDoValor(condicao: CondicaoSegmento): string | null {
    return condicao.valor === null ? null : String(condicao.valor);
  }

  protected recontar(): void {
    this.nova.update((n) => n + 1);
  }

  private trocar(nova: CondicaoSegmento): void {
    this.atualizar(this.valor().condicoes.map((c) => (c.id === nova.id ? nova : c)));
  }

  private atualizar(condicoes: readonly CondicaoSegmento[]): void {
    this.valor.set({ ...this.valor(), condicoes });
  }
}
