import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LucidePlus, LucideTrash2 } from '@lucide/angular';

import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Botao } from '../../ui/botao/botao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import type { RamoDefinicao } from './chatbot.tipos';
import { ContextoEditor, ROTULO_TIPO_CANAL } from './contexto-editor';
import {
  type CondicaoFluxo,
  condicaoVazia,
  condicoesDoRamo,
  problemaDaCondicao,
  texto,
} from './definicao';

const TIPOS: readonly OpcaoSeletor<string>[] = [
  { valor: 'variavel', rotulo: 'Resposta do cliente' },
  { valor: 'campo_contato', rotulo: 'Dado do contato' },
  { valor: 'etiqueta', rotulo: 'Etiqueta do contato' },
  { valor: 'canal', rotulo: 'Canal da conversa' },
  { valor: 'horario', rotulo: 'Horário de atendimento' },
];

const OPERADORES: readonly OpcaoSeletor<string>[] = [
  { valor: 'igual', rotulo: 'é igual a' },
  { valor: 'diferente', rotulo: 'é diferente de' },
  { valor: 'contem', rotulo: 'contém' },
  { valor: 'comeca_com', rotulo: 'começa com' },
  { valor: 'maior', rotulo: 'é maior que' },
  { valor: 'menor', rotulo: 'é menor que' },
  { valor: 'existe', rotulo: 'foi preenchido' },
  { valor: 'nao_existe', rotulo: 'está vazio' },
];

const CAMPOS: readonly OpcaoSeletor<string>[] = [
  { valor: 'nome', rotulo: 'Nome' },
  { valor: 'email', rotulo: 'E-mail' },
  { valor: 'telefone', rotulo: 'Telefone' },
  { valor: 'cargo', rotulo: 'Cargo' },
  { valor: 'campos', rotulo: 'Campo personalizado' },
];

/**
 * Um caminho de uma condição: o nome e as condições (todas precisam valer). O caminho sem condição
 * é o “Senão”, que só aparece com o nome fixo.
 */
@Component({
  selector: 'app-condicoes-ramo',
  imports: [Botao, BotaoIcone, CampoTexto, Seletor],
  template: `
    <div class="ramo">
      @if (senao()) {
        <p class="ramo__senao">
          <strong>Senão</strong> — quando nenhuma das condições acima bater.
        </p>
      } @else {
        <div class="ramo__topo">
          <app-campo-texto
            class="ramo__nome"
            rotulo="Nome do caminho"
            [maximoCaracteres]="60"
            placeholder="Cliente de São Paulo"
            [desabilitado]="somenteLeitura()"
            [valor]="ramo().rotulo ?? ''"
            (valorChange)="mudou.emit({ ...ramo(), rotulo: '' + ($event ?? '') })"
          />
          @if (!somenteLeitura() && podeRemover()) {
            <button
              appBotaoIcone
              type="button"
              tamanho="sm"
              [icone]="iconeLixeira"
              [rotulo]="'Remover o caminho ' + (ramo().rotulo || indice() + 1)"
              (click)="remover.emit()"
            ></button>
          }
        </div>
        @for (condicao of condicoes(); track $index; let i = $index) {
          <div class="condicao">
            <p class="condicao__conector">{{ i === 0 ? 'Se' : 'e' }}</p>
            <div class="condicao__campos">
              <app-seletor
                rotulo="Verificar"
                [opcoes]="tipos"
                [desabilitado]="somenteLeitura()"
                [valor]="condicao.tipo ?? null"
                (valorChange)="trocarTipo(i, $event)"
              />
              @switch (condicao.tipo) {
                @case ('variavel') {
                  <app-campo-texto
                    rotulo="Resposta guardada em"
                    placeholder="assunto"
                    [dica]="sugestao()"
                    [desabilitado]="somenteLeitura()"
                    [valor]="texto(condicao['chave'])"
                    (valorChange)="mudarCondicao(i, { chave: '' + ($event ?? '') })"
                  />
                }
                @case ('campo_contato') {
                  <app-seletor
                    rotulo="Dado"
                    [opcoes]="campos"
                    placeholder="Escolha o dado"
                    [desabilitado]="somenteLeitura()"
                    [valor]="campoAtual(condicao)"
                    (valorChange)="
                      mudarCondicao(i, { campo: $event === 'campos' ? 'campos.' : $event })
                    "
                  />
                  @if (campoAtual(condicao) === 'campos') {
                    <app-campo-texto
                      rotulo="Nome do campo personalizado"
                      [desabilitado]="somenteLeitura()"
                      [valor]="texto(condicao['campo']).replace('campos.', '')"
                      (valorChange)="mudarCondicao(i, { campo: 'campos.' + $event })"
                    />
                  }
                }
                @case ('etiqueta') {
                  <app-campo-texto
                    rotulo="Etiqueta"
                    placeholder="Cliente VIP"
                    [desabilitado]="somenteLeitura()"
                    [valor]="texto(condicao['etiqueta'])"
                    (valorChange)="mudarCondicao(i, { etiqueta: '' + ($event ?? '') })"
                  />
                  <app-seletor
                    rotulo="O contato"
                    [opcoes]="tem"
                    [desabilitado]="somenteLeitura()"
                    [valor]="condicao['tem'] === false ? 'nao' : 'sim'"
                    (valorChange)="mudarCondicao(i, { tem: $event !== 'nao' })"
                  />
                }
                @case ('canal') {
                  <app-seletor
                    rotulo="O canal é"
                    placeholder="Escolha o canal"
                    [opcoes]="tiposDeCanal()"
                    [desabilitado]="somenteLeitura()"
                    [valor]="canalAtual(condicao)"
                    (valorChange)="mudarCondicao(i, { canalTipos: $event ? [$event] : [] })"
                  />
                }
                @case ('horario') {
                  <app-seletor
                    rotulo="A conversa chegou"
                    [opcoes]="horarios"
                    [desabilitado]="somenteLeitura()"
                    [valor]="condicao['dentro'] === false ? 'fora' : 'dentro'"
                    (valorChange)="mudarCondicao(i, { dentro: $event !== 'fora' })"
                  />
                }
              }
              @if (condicao.tipo === 'variavel' || condicao.tipo === 'campo_contato') {
                <app-seletor
                  rotulo="Comparação"
                  [opcoes]="operadores"
                  [desabilitado]="somenteLeitura()"
                  [valor]="texto(condicao['operador']) || null"
                  (valorChange)="mudarCondicao(i, { operador: $event })"
                />
                @if (precisaValor(condicao)) {
                  <app-campo-texto
                    rotulo="Valor"
                    [desabilitado]="somenteLeitura()"
                    [valor]="texto(condicao['valor'])"
                    (valorChange)="mudarCondicao(i, { valor: '' + ($event ?? '') })"
                  />
                }
              }
            </div>
            @if (!somenteLeitura() && condicoes().length > 1) {
              <button
                appBotaoIcone
                type="button"
                tamanho="sm"
                [icone]="iconeLixeira"
                [rotulo]="'Remover a condição ' + (i + 1)"
                (click)="removerCondicao(i)"
              ></button>
            }
          </div>
          @if (problema(condicao); as erro) {
            <p class="condicao__erro" role="status">{{ erro }}</p>
          }
        }
        @if (!somenteLeitura()) {
          <button
            appBotao
            type="button"
            variante="contorno"
            tamanho="sm"
            [icone]="iconeMais"
            (click)="adicionarCondicao()"
          >
            Exigir também outra condição
          </button>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .ramo {
      display: grid;
      gap: var(--esp-3);
      min-width: 0;
    }

    .ramo__topo {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--esp-2);
      align-items: end;
    }

    .ramo__senao {
      margin: 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .condicao {
      display: grid;
      grid-template-columns: 2rem minmax(0, 1fr) auto;
      gap: var(--esp-2);
      align-items: start;
    }

    .condicao__conector {
      margin: 0;
      padding-top: var(--esp-6);
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
      font-weight: 600;
    }

    .condicao__campos {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
      gap: var(--esp-3);
      min-width: 0;
    }

    .condicao__erro {
      margin: 0;
      color: var(--cor-erro);
      font: var(--fonte-corpo-sm);
    }

    @media (max-width: 30rem) {
      .condicao {
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .condicao__conector {
        grid-column: 1 / -1;
        padding-top: 0;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CondicoesRamo {
  private readonly contexto = inject(ContextoEditor);

  readonly ramo = input.required<RamoDefinicao>();
  readonly indice = input(0);
  readonly senao = input(false);
  readonly somenteLeitura = input(false);
  readonly podeRemover = input(true);
  readonly mudou = output<RamoDefinicao>();
  readonly remover = output<void>();

  protected readonly iconeMais = LucidePlus;
  protected readonly iconeLixeira = LucideTrash2;
  protected readonly tipos = TIPOS;
  protected readonly operadores = OPERADORES;
  protected readonly campos = CAMPOS;
  protected readonly tem: readonly OpcaoSeletor<string>[] = [
    { valor: 'sim', rotulo: 'tem a etiqueta' },
    { valor: 'nao', rotulo: 'não tem a etiqueta' },
  ];
  protected readonly horarios: readonly OpcaoSeletor<string>[] = [
    { valor: 'dentro', rotulo: 'dentro do horário de atendimento' },
    { valor: 'fora', rotulo: 'fora do horário de atendimento' },
  ];
  protected readonly texto = texto;
  protected readonly condicoes = computed(() => condicoesDoRamo(this.ramo()));
  protected readonly sugestao = computed(() => {
    const lista = this.contexto.variaveis();
    return lista.length > 0 ? `Já existem: ${lista.join(', ')}.` : null;
  });
  protected readonly tiposDeCanal = computed<readonly OpcaoSeletor<string>[]>(() => {
    const tipos = new Set(this.contexto.canais().map((c) => c.tipo));
    for (const padrao of ['WHATSAPP', 'WEBCHAT', 'EMAIL']) {
      tipos.add(padrao);
    }
    return [...tipos].map((tipo) => ({ valor: tipo, rotulo: ROTULO_TIPO_CANAL[tipo] ?? tipo }));
  });

  protected problema(condicao: CondicaoFluxo): string | null {
    return problemaDaCondicao(condicao);
  }

  protected precisaValor(condicao: CondicaoFluxo): boolean {
    return !['existe', 'nao_existe'].includes(texto(condicao['operador']));
  }

  protected campoAtual(condicao: CondicaoFluxo): string | null {
    const campo = texto(condicao['campo']);
    return campo.startsWith('campos') ? 'campos' : campo || null;
  }

  protected canalAtual(condicao: CondicaoFluxo): string | null {
    const tipos = condicao['canalTipos'];
    return Array.isArray(tipos) && typeof tipos[0] === 'string' ? tipos[0] : null;
  }

  private emitir(condicoes: CondicaoFluxo[]): void {
    const { condicao: _antiga, ...resto } = this.ramo().config ?? {};
    this.mudou.emit({ ...this.ramo(), config: { ...resto, condicoes } });
  }

  protected mudarCondicao(indice: number, mudancas: Record<string, unknown>): void {
    this.emitir(this.condicoes().map((c, i) => (i === indice ? { ...c, ...mudancas } : c)));
  }

  protected trocarTipo(indice: number, tipo: string | null): void {
    const base: CondicaoFluxo =
      tipo === 'variavel'
        ? condicaoVazia()
        : tipo === 'campo_contato'
          ? { tipo, campo: '', operador: 'igual', valor: '' }
          : tipo === 'etiqueta'
            ? { tipo, etiqueta: '', tem: true }
            : tipo === 'canal'
              ? { tipo, canalTipos: [] }
              : { tipo: tipo ?? 'horario', dentro: true };
    this.emitir(this.condicoes().map((c, i) => (i === indice ? base : c)));
  }

  protected adicionarCondicao(): void {
    this.emitir([...this.condicoes(), condicaoVazia()]);
  }

  protected removerCondicao(indice: number): void {
    this.emitir(this.condicoes().filter((_, i) => i !== indice));
  }
}
