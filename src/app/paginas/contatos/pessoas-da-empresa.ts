import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { LucidePlus, LucideRefreshCw } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { POR_PAGINA_MAXIMO } from '../../nucleo/api/api';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Selo } from '../../ui/selo/selo';
import { ContatosApi } from './contatos.api';
import { type Contato, type Empresa, formatarTelefone } from './contatos.tipos';
import { FormularioContato } from './formulario-contato';

/**
 * Aba "Pessoas" do detalhe da empresa: os contatos ligados a ela, com o link para cada um, e
 * o cadastro de uma pessoa já nesta empresa.
 */
@Component({
  selector: 'app-pessoas-da-empresa',
  imports: [Avatar, Botao, Esqueleto, EstadoVazio, FormularioContato, RouterLink, Selo],
  template: `
    <div class="pessoas__topo">
      <p class="pessoas__resumo" aria-live="polite">{{ resumo() }}</p>
      <button
        appBotao
        type="button"
        variante="contorno"
        tamanho="sm"
        [icone]="icones.nova"
        (click)="cadastrando.set(true)"
      >
        Nova pessoa
      </button>
    </div>

    @if (erro(); as falha) {
      <app-estado-vazio
        compacto
        variante="erro"
        [falha]="falha"
        titulo="Não conseguimos carregar as pessoas"
        [texto]="falha.resumo"
        [codigo]="falha.requisicaoId"
      >
        <button
          appBotao
          type="button"
          variante="invertido"
          tamanho="sm"
          [icone]="icones.tentar"
          (click)="dados.reload()"
        >
          Tentar de novo
        </button>
      </app-estado-vazio>
    } @else if (dados.isLoading() && !dados.hasValue()) {
      <div class="pessoas" aria-busy="true">
        <p class="visualmente-oculto" role="status">Carregando as pessoas…</p>
        @for (linha of [1, 2, 3]; track linha) {
          <div class="pessoa">
            <app-esqueleto forma="circulo" largura="32px" altura="32px" />
            <app-esqueleto [linhas]="2" largura="50%" />
          </div>
        }
      </div>
    } @else if (itens().length === 0) {
      <app-estado-vazio
        compacto
        titulo="Ninguém desta empresa ainda"
        texto="Cadastre uma pessoa já ligada a esta empresa."
      >
        <button
          appBotao
          type="button"
          variante="invertido"
          tamanho="sm"
          [icone]="icones.nova"
          (click)="cadastrando.set(true)"
        >
          Nova pessoa
        </button>
      </app-estado-vazio>
    } @else {
      <ul class="pessoas">
        @for (contato of itens(); track contato.id) {
          <li class="pessoa">
            <app-avatar [nome]="contato.nome" tamanho="sm" decorativo />
            <div class="pessoa__texto">
              <a class="pessoa__nome" [routerLink]="['/contatos', contato.id]">{{
                contato.nome
              }}</a>
              <span class="pessoa__sub">
                {{ contato.cargo ?? 'Sem cargo' }}
                @if (contato.email || contato.telefone) {
                  · {{ contato.email ?? formatarTelefone(contato.telefone) }}
                }
              </span>
            </div>
            @if (contato.optOutMarketing) {
              <app-selo tamanho="sm" variante="contorno">Opt-out</app-selo>
            }
          </li>
        }
      </ul>
    }

    <app-formulario-contato
      [(aberto)]="cadastrando"
      [empresaInicial]="{ id: empresa().id, nome: empresa().nome }"
      (salvo)="aoCadastrar($event)"
    />
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-4);
      min-width: 0;
    }

    .pessoas__topo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--esp-3);
    }

    .pessoas__resumo {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .pessoas {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
      gap: var(--esp-2) var(--esp-4);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .pessoa {
      display: flex;
      align-items: center;
      gap: var(--esp-3);
      min-width: 0;
      padding: var(--esp-3) var(--esp-4);
      border-radius: var(--raio-lg);
      background: var(--cor-superficie-2);
    }

    .pessoa__texto {
      display: grid;
      flex: 1;
      min-width: 0;
    }

    .pessoa__nome {
      overflow: hidden;
      color: var(--cor-texto);
      font: var(--fonte-rotulo);
      text-decoration: none;
      text-overflow: ellipsis;
      white-space: nowrap;

      &:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }

    .pessoa__sub {
      overflow: hidden;
      color: var(--cor-texto-fraco);
      font: var(--fonte-legenda);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PessoasDaEmpresa {
  readonly empresa = input.required<Empresa>();

  private readonly api = inject(ContatosApi);
  private readonly router = inject(Router);

  protected readonly icones = { nova: LucidePlus, tentar: LucideRefreshCw };
  protected readonly formatarTelefone = formatarTelefone;
  protected readonly cadastrando = signal(false);

  protected readonly dados = rxResource({
    params: () => this.empresa().id,
    stream: ({ params }) =>
      this.api.listarContatos({
        empresaId: params,
        ordenarPor: 'nome',
        porPagina: POR_PAGINA_MAXIMO,
      }),
  });

  protected readonly itens = computed<readonly Contato[]>(() =>
    this.dados.hasValue() ? this.dados.value().itens : [],
  );

  protected readonly erro = computed(() => {
    const falha = this.dados.error();
    return falha ? erroDaApi(falha) : null;
  });

  protected readonly resumo = computed(() => {
    if (!this.dados.hasValue()) {
      return '';
    }
    const total = this.dados.value().total;
    return total === 1 ? '1 pessoa nesta empresa' : `${total} pessoas nesta empresa`;
  });

  protected aoCadastrar(contato: Contato): void {
    void this.router.navigate(['/contatos', contato.id]);
  }
}
