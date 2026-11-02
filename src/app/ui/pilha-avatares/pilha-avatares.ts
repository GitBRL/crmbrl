import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Avatar } from '../avatar/avatar';
import { CORES_DADO } from '../tipos';

export interface PessoaAvatar {
  readonly nome: string;
  readonly foto?: string | null;
}

/**
 * Pilha de avatares (DESIGN-SYSTEM.md §4): até `maximo` pessoas em pílulas coloridas
 * sobrepostas (ciano, menta, lima…) e um círculo translúcido "+k" com o restante.
 * Para leitores de tela é uma imagem só, com a lista de nomes no `aria-label`; a mesma lista
 * aparece no `title` ao passar o mouse. O anel entre os avatares usa `--pilha-anel` (padrão:
 * `--cor-fundo`).
 */
@Component({
  selector: 'app-pilha-avatares',
  imports: [Avatar],
  template: `
    @for (pessoa of visiveis(); track $index) {
      <app-avatar
        class="pilha__avatar"
        forma="pilula"
        decorativo
        [nome]="pessoa.nome"
        [foto]="pessoa.foto ?? null"
        [cor]="cores[$index % cores.length]"
        [tamanho]="tamanho()"
      />
    }
    @if (restantes() > 0) {
      <span class="pilha__mais" aria-hidden="true">+{{ restantes() }}</span>
    }
  `,
  styleUrl: './pilha-avatares.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pilha',
    role: 'img',
    '[class.pilha--sm]': "tamanho() === 'sm'",
    '[attr.aria-label]': 'descricao()',
    '[attr.title]': 'descricao()',
  },
})
export class PilhaAvatares {
  readonly pessoas = input.required<readonly PessoaAvatar[]>();
  /** Quantas pessoas aparecem antes do "+k". */
  readonly maximo = input(3);
  readonly tamanho = input<'sm' | 'md'>('md');
  /** Início do nome acessível: "Equipe: Ana, Bruno e mais 2 pessoas". */
  readonly rotulo = input('Equipe');

  protected readonly cores = CORES_DADO;
  protected readonly visiveis = computed(() => this.pessoas().slice(0, Math.max(0, this.maximo())));
  protected readonly restantes = computed(() => this.pessoas().length - this.visiveis().length);
  protected readonly descricao = computed(() => {
    const nomes = this.visiveis().map((pessoa) => pessoa.nome);
    const restantes = this.restantes();
    if (restantes > 0) {
      nomes.push(`mais ${restantes} ${restantes === 1 ? 'pessoa' : 'pessoas'}`);
    }
    const lista =
      nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : nomes[0];
    return lista ? `${this.rotulo()}: ${lista}` : this.rotulo();
  });
}
