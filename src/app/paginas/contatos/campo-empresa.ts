import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, map, of } from 'rxjs';

import { CampoBase } from '../../ui/campo/campo-base';
import { MolduraCampo } from '../../ui/campo/moldura-campo';
import { ContatosApi } from './contatos.api';
import type { Empresa } from './contatos.tipos';

/** Empresa escolhida no campo: uma cadastrada (`id`) ou um nome novo (`id` nulo). */
export interface EmpresaEscolhida {
  readonly id: string | null;
  readonly nome: string;
}

function mesmoNome(a: string, b: string): boolean {
  return a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'base' }) === 0;
}

/**
 * Empresa do contato: digite o nome e escolha uma das cadastradas (sugestões em `<datalist>`
 * nativo, buscadas na API enquanto se digita) ou deixe um nome novo, que vira empresa ao
 * salvar. A dica embaixo diz qual dos dois vai acontecer.
 */
@Component({
  selector: 'app-campo-empresa',
  imports: [MolduraCampo],
  template: `
    <app-moldura-campo
      [rotulo]="rotulo()"
      [paraId]="id"
      [idDica]="idDica"
      [idErro]="idErro"
      [dica]="situacao()"
      [erro]="mensagemErro()"
      [ajuda]="ajuda()"
      [opcional]="opcional()"
      [rotuloOculto]="rotuloOculto()"
    >
      <div
        class="controle"
        [class.controle--invalido]="!!mensagemErro()"
        [class.controle--desabilitado]="estaDesabilitado()"
      >
        <input
          #campo
          class="controle__campo"
          type="text"
          autocomplete="off"
          [id]="id"
          [attr.list]="idSugestoes"
          [attr.placeholder]="placeholder()"
          [attr.aria-invalid]="mensagemErro() ? true : null"
          [attr.aria-describedby]="descricao()"
          [disabled]="estaDesabilitado()"
          (input)="aoDigitar($event)"
          (blur)="tocar()"
        />
        <datalist [id]="idSugestoes">
          @for (empresa of sugestoes(); track empresa.id) {
            <option [value]="empresa.nome">
              {{ empresa.cidade ? empresa.nome + ' · ' + empresa.cidade : empresa.nome }}
            </option>
          }
        </datalist>
      </div>
    </app-moldura-campo>
  `,
  styleUrl: '../../ui/campo-texto/campo-texto.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'campo-empresa' },
})
export class CampoEmpresa extends CampoBase<EmpresaEscolhida | null> {
  readonly valor = model<EmpresaEscolhida | null>(null);
  readonly placeholder = input<string | null>('Comece a digitar o nome');

  private readonly api = inject(ContatosApi);
  protected readonly idSugestoes = `${this.id}-sugestoes`;

  /** O que está digitado, para buscar as sugestões (com uma pausa). */
  private readonly termo = signal('');
  private readonly termoComPausa = toSignal(toObservable(this.termo).pipe(debounceTime(300)), {
    initialValue: '',
  });

  private readonly busca = rxResource({
    params: () => {
      const termo = this.termoComPausa().trim();
      return termo.length >= 2 ? termo : undefined;
    },
    stream: ({ params }) =>
      this.api.listarEmpresas({ busca: params, porPagina: 8, ordenarPor: 'nome' }).pipe(
        map((pagina) => pagina.itens),
        // Sugestão é ajuda: se a busca falhar, o campo continua aceitando o nome digitado.
        catchError(() => of([] as readonly Empresa[])),
      ),
  });

  protected readonly sugestoes = computed<readonly Empresa[]>(() =>
    this.busca.hasValue() ? this.busca.value() : [],
  );

  protected readonly situacao = computed(() => {
    const escolhida = this.valor();
    if (!escolhida?.nome.trim()) {
      return this.dica();
    }
    if (escolhida.id) {
      return 'Empresa cadastrada.';
    }
    if (this.busca.isLoading() || this.termo() !== this.termoComPausa()) {
      return 'Procurando nas empresas cadastradas…';
    }
    return 'Empresa nova: será cadastrada ao salvar.';
  });

  constructor() {
    super();
    this.sincronizarTexto((valor) => valor?.nome ?? '');
    // As sugestões chegaram depois de digitar o nome inteiro: liga à empresa cadastrada.
    effect(() => {
      const sugestoes = this.sugestoes();
      untracked(() => {
        const escolhida = this.valor();
        if (escolhida && !escolhida.id) {
          const achada = sugestoes.find((empresa) => mesmoNome(empresa.nome, escolhida.nome));
          if (achada) {
            this.lerDoCampo({ id: achada.id, nome: escolhida.nome });
          }
        }
      });
    });
  }

  protected override normalizar(valor: unknown): EmpresaEscolhida | null {
    if (!valor || typeof valor !== 'object') {
      return null;
    }
    const { id, nome } = valor as Partial<EmpresaEscolhida>;
    return typeof nome === 'string' && nome.trim() ? { id: id ?? null, nome } : null;
  }

  protected aoDigitar(evento: Event): void {
    const nome = (evento.target as HTMLInputElement).value;
    this.termo.set(nome);
    if (!nome.trim()) {
      this.lerDoCampo(null);
      return;
    }
    const achada = this.sugestoes().find((empresa) => mesmoNome(empresa.nome, nome));
    this.lerDoCampo({ id: achada?.id ?? null, nome });
  }
}
