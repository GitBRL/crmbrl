import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { ehConsultaComercial } from './acesso-financeiro';

interface Secao {
  readonly caminho: string;
  readonly rotulo: string;
}

/**
 * Casca do Financeiro (`/financeiro`): título, frase e as seções em pílula (Contratos, Parcelas,
 * Régua, Indicadores). A Régua não aparece para Comercial (a API devolve 403 para eles).
 */
@Component({
  selector: 'app-financeiro',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <header class="topo">
      <h1 class="texto-display">Financeiro</h1>
      <p class="topo__frase">{{ frase() }}</p>
    </header>
    <nav class="secoes" aria-label="Seções do Financeiro">
      @for (secao of secoes(); track secao.caminho) {
        <a
          class="secao"
          routerLinkActive="secao--ativa"
          ariaCurrentWhenActive="page"
          [routerLink]="secao.caminho"
          >{{ secao.rotulo }}</a
        >
      }
    </nav>
    <router-outlet />
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-5);
      min-width: 0;
    }

    router-outlet {
      display: none;
    }

    .topo {
      display: grid;
      gap: var(--esp-3);
    }

    .topo__frase {
      max-width: 62ch;
      color: var(--cor-texto-suave);
      font: var(--fonte-lead);
    }

    .secoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
      padding: 2px;
    }

    .secao {
      display: inline-flex;
      align-items: center;
      min-height: var(--altura-md);
      padding: 0 var(--esp-5);
      border: 1px solid var(--cor-contorno-controle);
      border-radius: var(--raio-pilula);
      background: var(--cor-superficie-2);
      color: var(--cor-texto-suave);
      font: var(--fonte-rotulo);
      white-space: nowrap;
      text-decoration: none;
      transition:
        background-color var(--duracao) var(--curva),
        color var(--duracao) var(--curva);

      &:hover {
        background: var(--cor-superficie-3);
        color: var(--cor-texto);
      }
    }

    .secao--ativa,
    .secao--ativa:hover {
      border-color: transparent;
      background: var(--cor-inverso);
      color: var(--cor-sobre-inverso);
    }

    @media (forced-colors: active) {
      .secao--ativa {
        border: 2px solid CanvasText;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Financeiro {
  private readonly sessao = inject(SessaoService);

  protected readonly somenteLeitura = computed(() => ehConsultaComercial(this.sessao.usuario()));

  protected readonly secoes = computed<readonly Secao[]>(() => {
    const lista: Secao[] = [
      { caminho: 'contratos', rotulo: 'Contratos' },
      { caminho: 'parcelas', rotulo: 'Parcelas a receber' },
    ];
    if (!this.somenteLeitura()) {
      lista.push({ caminho: 'regua', rotulo: 'Régua de cobrança' });
    }
    lista.push({ caminho: 'indicadores', rotulo: 'Indicadores' });
    return lista;
  });

  protected readonly frase = computed(() =>
    this.somenteLeitura()
      ? 'Veja os contratos dos negócios que você ganhou e como estão os pagamentos. Aqui você só consulta.'
      : 'Contratos, parcelas a receber e a cobrança automática dos clientes, num só lugar.',
  );
}
