import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight } from '@lucide/angular';

import { Selo, type VarianteSelo } from '../../../ui/selo/selo';
import {
  ROTULO_NIVEL,
  ROTULO_TENDENCIA,
  type Acao,
  type ConteudoAnalise,
  type Destaque,
  type Nivel,
  type Risco,
} from './analise.tipos';

const SELO_TENDENCIA: Readonly<Record<string, VarianteSelo>> = {
  positiva: 'menta',
  negativa: 'coral',
  neutra: 'neutro',
};
const SELO_GRAVIDADE: Readonly<Record<string, VarianteSelo>> = {
  alta: 'coral',
  media: 'lima',
  baixa: 'neutro',
};

/** O caminho do link só vale se for uma rota do próprio CRM. */
export function caminhoSeguro(caminho: string | undefined): string | null {
  return caminho && caminho.startsWith('/') && !caminho.startsWith('//') ? caminho : null;
}

/**
 * Resultado de uma análise (ou a resposta de uma pergunta): texto, destaques, riscos e ações,
 * inteiro ou ainda em formação (os campos podem faltar). As ações levam à lista filtrada que as
 * sustenta. Não anuncia nada sozinho: quem o hospeda avisa o fim.
 */
@Component({
  selector: 'app-analise-resultado',
  imports: [RouterLink, Selo, LucideArrowRight],
  template: `
    @if (conteudo(); as c) {
      @if (c.texto) {
        <section class="bloco" [attr.aria-label]="rotuloTexto()">
          <h3 class="bloco__titulo">{{ rotuloTexto() }}</h3>
          <p class="texto">{{ c.texto }}</p>
        </section>
      }
      @if (destaques().length) {
        <section class="bloco" aria-label="Destaques">
          <h3 class="bloco__titulo">Destaques</h3>
          <ul class="lista" role="list">
            @for (item of destaques(); track $index) {
              <li class="item">
                <div class="item__topo">
                  @if (item.titulo) {
                    <h4 class="item__titulo">{{ item.titulo }}</h4>
                  }
                  @if (item.tendencia; as t) {
                    <app-selo tamanho="sm" [variante]="seloTendencia(t)">
                      {{ rotuloTendencia(t) }}
                    </app-selo>
                  }
                </div>
                @if (item.detalhe) {
                  <p class="item__detalhe">{{ item.detalhe }}</p>
                }
              </li>
            }
          </ul>
        </section>
      }
      @if (riscos().length) {
        <section class="bloco" aria-label="Riscos">
          <h3 class="bloco__titulo">Riscos</h3>
          <ul class="lista" role="list">
            @for (item of riscos(); track $index) {
              <li class="item">
                <div class="item__topo">
                  @if (item.titulo) {
                    <h4 class="item__titulo">{{ item.titulo }}</h4>
                  }
                  @if (item.gravidade; as g) {
                    <app-selo tamanho="sm" [variante]="seloGravidade(g)">
                      Gravidade {{ rotuloNivel(g).toLowerCase() }}
                    </app-selo>
                  }
                </div>
                @if (item.detalhe) {
                  <p class="item__detalhe">{{ item.detalhe }}</p>
                }
              </li>
            }
          </ul>
        </section>
      }
      @if (acoes().length) {
        <section class="bloco" aria-label="Ações recomendadas">
          <h3 class="bloco__titulo">Ações recomendadas</h3>
          <ol class="lista" role="list">
            @for (item of acoes(); track $index; let i = $index) {
              <li class="item item--acao">
                <span class="item__numero" aria-hidden="true">{{ i + 1 }}</span>
                <div class="item__corpo">
                  <div class="item__topo">
                    @if (item.titulo) {
                      <h4 class="item__titulo">{{ item.titulo }}</h4>
                    }
                    @if (item.prioridade; as p) {
                      <app-selo tamanho="sm" variante="contorno">
                        Prioridade {{ rotuloNivel(p).toLowerCase() }}
                      </app-selo>
                    }
                  </div>
                  @if (item.detalhe) {
                    <p class="item__detalhe">{{ item.detalhe }}</p>
                  }
                  @if (item.link; as link) {
                    @if (caminho(link.caminho); as destino) {
                      <a
                        class="item__ir"
                        [routerLink]="destino"
                        [queryParams]="link.parametros"
                        (click)="navegou.emit()"
                      >
                        {{ link.rotulo }}
                        <svg lucideArrowRight [size]="16" aria-hidden="true" />
                      </a>
                      @if (link.ajustado) {
                        <p class="item__nota">
                          Filtros ajustados ao que você pode ver e ao que existe hoje.
                        </p>
                      }
                    }
                  }
                </div>
              </li>
            }
          </ol>
        </section>
      }
    }
  `,
  styleUrl: './resultado-analise.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultadoAnalise {
  readonly conteudo = input<ConteudoAnalise | null>(null);
  readonly rotuloTexto = input('Resumo');
  /** Emitido ao seguir o link de uma ação (o modal fecha). */
  readonly navegou = output<void>();

  protected readonly destaques = computed<readonly Destaque[]>(
    () => this.conteudo()?.destaques ?? [],
  );
  protected readonly riscos = computed<readonly Risco[]>(() => this.conteudo()?.riscos ?? []);
  protected readonly acoes = computed<readonly Acao[]>(() => this.conteudo()?.acoes ?? []);

  protected readonly caminho = caminhoSeguro;
  protected seloTendencia(valor: string): VarianteSelo {
    return SELO_TENDENCIA[valor] ?? 'neutro';
  }
  protected seloGravidade(valor: string): VarianteSelo {
    return SELO_GRAVIDADE[valor] ?? 'neutro';
  }
  protected rotuloTendencia(valor: string): string {
    return (ROTULO_TENDENCIA as Record<string, string>)[valor] ?? valor;
  }
  protected rotuloNivel(valor: Nivel | string): string {
    return (ROTULO_NIVEL as Record<string, string>)[valor] ?? valor;
  }
}
