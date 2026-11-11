import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucidePlus, LucideRefreshCw } from '@lucide/angular';

import { slugDaArea } from '../../../nucleo/setores/setores';
import { SessaoService } from '../../../nucleo/sessao/sessao.service';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { CaixaSelecao } from '../../../ui/caixa-selecao/caixa-selecao';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { Selo } from '../../../ui/selo/selo';
import { FunisApi } from '../../funis/funis.api';
import type { Funil } from '../../funis/funis.tipos';
import {
  agruparPorSetor,
  nivelDoFunil,
  podeConfigurarPorNivel,
  ROTULO_NIVEL,
  ROTULO_VISIBILIDADE,
} from '../../funis/nivel-funil';
import { Carregamento } from '../carregamento';
import { podeCriarFunil } from './permissao';

/** "3 etapas", "1 etapa". */
export function rotuloDeEtapas(quantas: number): string {
  return quantas === 1 ? '1 etapa' : `${quantas} etapas`;
}

/**
 * Configurações → Funis (`/configuracoes/funis`): todos os funis que a pessoa vê, agrupados por
 * setor, com visibilidade, número de etapas, funil-base, arquivado (filtro "Mostrar arquivados")
 * e as ações pelo nível dela (R5.12): quem só vê ou age abre o quadro; quem configura também
 * abre a tela "Configurar funil". "Novo funil" só para Admin, C-level e líderes.
 */
@Component({
  selector: 'app-funis-config',
  imports: [Botao, CaixaSelecao, Cartao, Esqueleto, EstadoVazio, RouterLink, Selo],
  template: `
    <section class="secao" aria-labelledby="funis-titulo">
      <header class="secao__cabecalho">
        <div class="secao__textos">
          <h2 class="secao__titulo" id="funis-titulo">Funis</h2>
          <p class="secao__frase">
            Os funis que você vê, por setor. Quem lidera o setor, o C-level e o Admin criam e
            configuram; os demais abrem o quadro com o acesso que receberam.
          </p>
        </div>
        @if (podeCriar()) {
          <a appBotao variante="invertido" class="secao__acao" [icone]="iconeNovo" routerLink="novo"
            ><span class="secao__acao-texto">Novo funil</span></a
          >
        }
      </header>

      <div class="filtro">
        <app-caixa-selecao
          rotulo="Mostrar arquivados"
          [valor]="arquivados()"
          (valorChange)="mostrarArquivados($event)"
        />
      </div>

      @if (lista.erro(); as erro) {
        <app-estado-vazio
          variante="erro"
          [falha]="erro"
          titulo="Não conseguimos carregar os funis"
          [texto]="erro.resumo"
          [codigo]="erro.ehFalhaDoServidor ? erro.requisicaoId : null"
        >
          <button
            appBotao
            type="button"
            variante="invertido"
            [icone]="iconeTentar"
            (click)="carregar()"
          >
            Tentar de novo
          </button>
        </app-estado-vazio>
      } @else if (lista.dados() === null) {
        <div aria-busy="true" class="grupos">
          <p class="visualmente-oculto" role="status">Carregando os funis…</p>
          <app-cartao
            ><app-esqueleto largura="40%" /><app-esqueleto forma="bloco" altura="64px"
          /></app-cartao>
        </div>
      } @else if (grupos().length === 0) {
        <app-estado-vazio
          titulo="Você não vê nenhum funil"
          [texto]="
            arquivados()
              ? 'Não há funis para mostrar.'
              : 'Os funis do seu setor podem estar restritos a líderes e convidados, ou arquivados. Peça acesso a quem lidera o setor.'
          "
        />
      } @else {
        <div class="grupos">
          @for (grupo of grupos(); track grupo.area) {
            <app-cartao
              regiao
              [nivel]="3"
              [titulo]="grupo.nome"
              [complemento]="'· ' + rotuloDeFunis(grupo.funis.length)"
            >
              <ul class="funis" [attr.data-setor]="grupo.area">
                @for (funil of grupo.funis; track funil.id) {
                  <li
                    class="funil"
                    [class.funil--arquivado]="!funil.ativo"
                    [attr.data-funil]="funil.nome"
                  >
                    <div class="funil__texto">
                      <p class="funil__nome">{{ funil.nome }}</p>
                      @if (funil.descricao) {
                        <p class="funil__descricao">{{ funil.descricao }}</p>
                      }
                      <p class="funil__selos">
                        @if (funil.base) {
                          <app-selo variante="ciano" tamanho="sm">Funil-base</app-selo>
                        }
                        @if (!funil.ativo) {
                          <app-selo variante="contorno" tamanho="sm">Arquivado</app-selo>
                        }
                        <app-selo variante="neutro" tamanho="sm">{{
                          rotuloVisibilidade[funil.visibilidade ?? 'SETOR']
                        }}</app-selo>
                        <app-selo variante="contorno" tamanho="sm">{{
                          rotuloDeEtapas(funil.etapas.length)
                        }}</app-selo>
                        <app-selo variante="contorno" tamanho="sm">{{
                          rotuloDoNivel(funil)
                        }}</app-selo>
                      </p>
                    </div>
                    <div class="funil__acoes">
                      @if (funil.ativo) {
                        <a
                          appBotao
                          variante="contorno"
                          tamanho="sm"
                          [routerLink]="['/funis', slug(funil.area)]"
                          [queryParams]="consulta(funil)"
                          >Abrir quadro</a
                        >
                      }
                      @if (configura(funil)) {
                        <a appBotao variante="invertido" tamanho="sm" [routerLink]="[funil.id]"
                          >Configurar</a
                        >
                      }
                    </div>
                  </li>
                }
              </ul>
            </app-cartao>
          }
        </div>
      }
    </section>
  `,
  styleUrl: './funis-config.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FunisConfig {
  private readonly api = inject(FunisApi);
  private readonly sessao = inject(SessaoService);

  protected readonly iconeNovo = LucidePlus;
  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly rotuloVisibilidade = ROTULO_VISIBILIDADE;
  protected readonly rotuloDeEtapas = rotuloDeEtapas;
  protected readonly slug = slugDaArea;
  protected readonly lista = new Carregamento<readonly Funil[]>();
  protected readonly arquivados = signal(false);
  protected readonly podeCriar = computed(() => podeCriarFunil(this.sessao.usuario()));
  protected readonly grupos = computed(() => agruparPorSetor(this.lista.dados() ?? []));

  constructor() {
    this.carregar();
  }

  protected carregar(): void {
    void this.lista.executar(() => this.api.funis(this.arquivados()));
  }

  protected mostrarArquivados(valor: boolean): void {
    this.arquivados.set(valor);
    this.carregar();
  }

  protected rotuloDeFunis(quantos: number): string {
    return quantos === 1 ? '1 funil' : `${quantos} funis`;
  }

  protected nivel(funil: Funil) {
    return nivelDoFunil(funil, this.sessao.perfil());
  }

  protected rotuloDoNivel(funil: Funil): string {
    return ROTULO_NIVEL[this.nivel(funil)];
  }

  /** Funil-base do próprio setor abre sem `?funil`; os demais levam o id. */
  protected consulta(funil: Funil): Record<string, string> {
    const doSetor = this.sessao.permissoes()?.areasVisiveis.includes(funil.area) ?? false;
    return funil.base && doSetor ? {} : { funil: funil.id };
  }

  protected configura(funil: Funil): boolean {
    return podeConfigurarPorNivel(this.nivel(funil));
  }
}
