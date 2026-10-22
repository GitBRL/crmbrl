import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  LucideCircleDashed,
  LucideDynamicIcon,
  LucideLockKeyhole,
  LucideSearch,
  LucideX,
  type LucideIconInput,
} from '@lucide/angular';

export type VarianteEstado = 'vazio' | 'busca' | 'erro' | 'sem-acesso';

/** O que o estado usa de uma falha da API (um `ErroApi` do núcleo serve). */
export interface FalhaDoEstado {
  /** 403: o papel não pode ver isto. */
  readonly ehSemPermissao: boolean;
  /** 5xx ou sem resposta: só aí o código para o suporte ajuda. */
  readonly ehFalhaDoServidor: boolean;
  readonly requisicaoId?: string | null;
}

const ICONES: Readonly<Record<VarianteEstado, LucideIconInput>> = {
  vazio: LucideCircleDashed,
  busca: LucideSearch,
  erro: LucideX,
  'sem-acesso': LucideLockKeyhole,
};

/**
 * Estado vazio (DESIGN-SYSTEM.md §4.3): o que a tela mostra quando não há o que mostrar —
 * ilustração simples (um círculo com ícone sobre três pílulas de dado, como um funil), uma
 * frase e a ação que resolve, projetada (`<button appBotao>`). Variantes:
 *
 * - `vazio`: ainda não há itens ("Nenhum contato ainda" + "Novo contato");
 * - `busca`: a busca/filtro não achou nada ("Limpar filtros");
 * - `erro`: não deu para carregar ("Tentar de novo"); `codigo` mostra o `requisicaoId` e o
 *   bloco é anunciado (`role="alert"`);
 * - `sem-acesso`: o papel não pode ver isto.
 *
 * Com `falha` (o `ErroApi` que fez a tela cair no erro): um 403 vira "sem acesso", sem as
 * ações projetadas ("Tentar de novo" daria o mesmo 403; `manterAcoes` as mantém quando são
 * "Voltar" ou "Fechar"), e o código para o suporte só aparece em falha do servidor.
 *
 * `compacto` para dentro de cartões, colunas do kanban e tabelas.
 *
 * `<app-estado-vazio titulo="Nenhum contato ainda" texto="…"><button appBotao …>Novo contato</button></app-estado-vazio>`
 */
@Component({
  selector: 'app-estado-vazio',
  imports: [LucideDynamicIcon],
  template: `
    <div class="estado__ilustracao" aria-hidden="true">
      <span class="estado__barra estado__barra--1"></span>
      <span class="estado__barra estado__barra--2"></span>
      <span class="estado__barra estado__barra--3"></span>
      <span class="estado__circulo">
        <svg [lucideIcon]="iconeAtual()" [size]="compacto() ? 22 : 28" [strokeWidth]="1.5" />
      </span>
    </div>
    <p class="estado__titulo">{{ tituloAtual() }}</p>
    @if (texto(); as frase) {
      <p class="estado__texto">{{ frase }}</p>
    }
    @if (codigoAtual(); as id) {
      <p class="estado__codigo">
        Código para o suporte: <span class="numeros">{{ id }}</span>
      </p>
    }
    @if (!semAcesso() || manterAcoes()) {
      <div class="estado__acoes"><ng-content /></div>
    }
  `,
  styleUrl: './estado-vazio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'estado',
    '[class]': "'estado--' + varianteAtual()",
    '[class.estado--compacto]': 'compacto()',
    '[attr.role]': "varianteAtual() === 'erro' ? 'alert' : null",
  },
})
export class EstadoVazio {
  readonly titulo = input.required<string>();
  /** Uma frase dizendo o que fazer. */
  readonly texto = input<string | null>(null);
  readonly variante = input<VarianteEstado>('vazio');
  /** Ícone no lugar do padrão da variante. */
  readonly icone = input<LucideIconInput | null>(null);
  /** Id da requisição que falhou (erro), para o suporte achar no log. */
  readonly codigo = input<string | null>(null);
  readonly compacto = input(false, { transform: booleanAttribute });
  /** A falha da API por trás do erro (ver acima). */
  readonly falha = input<FalhaDoEstado | null>(null);
  /** As ações projetadas continuam no "sem acesso" (são "Voltar" ou "Fechar"). */
  readonly manterAcoes = input(false, { transform: booleanAttribute });

  protected readonly semAcesso = computed(() => this.falha()?.ehSemPermissao === true);
  protected readonly varianteAtual = computed<VarianteEstado>(() =>
    this.semAcesso() ? 'sem-acesso' : this.variante(),
  );
  protected readonly tituloAtual = computed(() =>
    this.semAcesso() ? 'Você não tem acesso a isto' : this.titulo(),
  );
  protected readonly codigoAtual = computed(() => {
    const falha = this.falha();
    if (!falha) {
      return this.codigo();
    }
    return falha.ehFalhaDoServidor ? (falha.requisicaoId ?? this.codigo()) : null;
  });
  protected readonly iconeAtual = computed(() => this.icone() ?? ICONES[this.varianteAtual()]);
}
