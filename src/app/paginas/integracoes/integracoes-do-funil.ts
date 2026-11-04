import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucidePlus } from '@lucide/angular';

import { POR_PAGINA_MAXIMO } from '../../nucleo/api/api';
import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { Botao } from '../../ui/botao/botao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Selo } from '../../ui/selo/selo';
import { LogotipoAplicativo } from './comum/logotipo-aplicativo';
import { IntegracoesApi } from './integracoes.api';
import { ROTULO_SITUACAO, rotuloDaAcao, SELO_SITUACAO, type WebhookEntrada } from './tipos';

/**
 * As integrações que entram num funil (só o Admin as vê): a lista, com a situação de cada uma,
 * e "Nova integração" já com o funil escolhido (`/integracoes/aplicativos?funil=<id>`).
 * Mora nas configurações do funil.
 */
@Component({
  selector: 'app-integracoes-do-funil',
  imports: [RouterLink, Botao, EstadoVazio, Esqueleto, Selo, LogotipoAplicativo],
  template: `
    <section class="integracoes" aria-labelledby="integracoes-do-funil-titulo">
      <div class="integracoes__cabecalho">
        <h3 class="integracoes__titulo" id="integracoes-do-funil-titulo">
          Integrações deste funil
        </h3>
        <a
          appBotao
          variante="contorno"
          tamanho="sm"
          [icone]="iconeNova"
          [routerLink]="['/integracoes/aplicativos']"
          [queryParams]="{ funil: funilId() }"
        >
          Nova integração
        </a>
      </div>
      <p class="integracoes__frase">
        Ferramentas que mandam leads para este funil (formulários, automações, plataformas de
        venda).
      </p>

      @if (carregando()) {
        <div aria-busy="true">
          <p class="visualmente-oculto" role="status">Carregando as integrações…</p>
          <app-esqueleto forma="bloco" altura="3rem" />
        </div>
      } @else if (erro(); as falha) {
        <app-estado-vazio
          compacto
          variante="erro"
          [falha]="falha"
          titulo="Não conseguimos carregar as integrações"
          [texto]="falha.resumo"
          [codigo]="falha.requisicaoId"
        >
          <button appBotao type="button" variante="contorno" tamanho="sm" (click)="carregar()">
            Tentar de novo
          </button>
        </app-estado-vazio>
      } @else if (!itens().length) {
        <app-estado-vazio
          compacto
          titulo="Nenhuma integração neste funil"
          texto="Use “Nova integração” para receber leads aqui."
        />
      } @else {
        <ul class="integracoes__lista" aria-label="Integrações do funil">
          @for (item of itens(); track item.id) {
            <li class="integracoes__item">
              <app-logotipo-aplicativo [aplicativo]="item.aplicativo" />
              <span class="integracoes__texto">
                <a
                  class="integracoes__nome"
                  [routerLink]="['/integracoes/aplicativos']"
                  [queryParams]="{ integracao: item.id }"
                  >{{ item.nome }}</a
                >
                <span class="integracoes__fraco"
                  >{{ item.aplicativoNome }} · {{ acao(item) }} · {{ item.etapa.nome }}</span
                >
              </span>
              <app-selo tamanho="sm" ponto [variante]="seloSituacao[item.situacao]">{{
                rotuloSituacao[item.situacao]
              }}</app-selo>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .integracoes {
      display: grid;
      gap: var(--esp-3);
      padding-top: var(--esp-5);
      border-top: 1px solid var(--cor-borda);
    }

    .integracoes__cabecalho {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--esp-3);
    }

    .integracoes__titulo {
      font: var(--fonte-rotulo);
      font-weight: 600;
    }

    .integracoes__frase {
      margin: 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .integracoes__lista {
      display: grid;
      gap: var(--esp-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .integracoes__item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: var(--esp-3);
      align-items: center;
    }

    .integracoes__texto {
      display: grid;
      min-width: 0;
    }

    .integracoes__nome {
      overflow-wrap: anywhere;
      color: var(--cor-texto);
      font-weight: 500;
    }

    .integracoes__fraco {
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda-lg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegracoesDoFunil {
  private readonly api = inject(IntegracoesApi);

  readonly funilId = input.required<string>();

  protected readonly iconeNova = LucidePlus;
  protected readonly rotuloSituacao = ROTULO_SITUACAO;
  protected readonly seloSituacao = SELO_SITUACAO;
  protected readonly itens = signal<readonly WebhookEntrada[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  private versao = 0;

  constructor() {
    effect(() => {
      void this.funilId();
      untracked(() => void this.carregar());
    });
  }

  protected acao(item: WebhookEntrada): string {
    return rotuloDaAcao(item.alvo, item.modo);
  }

  protected async carregar(): Promise<void> {
    const versao = ++this.versao;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const resposta = await this.api.listarEntradas({
        funilId: this.funilId(),
        porPagina: POR_PAGINA_MAXIMO,
      });
      if (versao === this.versao) {
        this.itens.set(resposta.itens);
      }
    } catch (falha) {
      if (versao === this.versao) {
        this.erro.set(erroDaApi(falha));
      }
    } finally {
      if (versao === this.versao) {
        this.carregando.set(false);
      }
    }
  }
}
