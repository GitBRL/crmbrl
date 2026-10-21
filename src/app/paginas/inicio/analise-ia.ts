import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  LOCALE_ID,
  model,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideLoaderCircle, LucideSparkles, LucideWandSparkles, LucideX } from '@lucide/angular';

import { moduloPorId } from '../../nucleo/navegacao';
import { Botao } from '../../ui/botao/botao';
import { Modal } from '../../ui/modal/modal';
import { gerarSugestoes, type DadosPeriodo } from './dados-exemplo';

type EstadoAnalise = 'inicial' | 'gerando' | 'pronta';

/** Quanto a análise simulada "demora" (contrato: ~1,2 s). */
export const DURACAO_ANALISE_MS = 1200;

/**
 * Modal "Análise com IA · beta" (só o Admin abre). Explica o que a IA vai fazer e, em
 * "Gerar análise" (o foco começa nele), simula ~1,2 s de leitura e mostra três sugestões
 * montadas com os números do período: a métrica observada, a hipótese, a ação sugerida e o
 * módulo onde ela vai ser feita. Uma região viva fixa anuncia a leitura e a conclusão.
 * Como a simulação sempre dá o mesmo resultado, depois dela o botão do rodapé fecha o modal.
 * Nada sai do navegador.
 */
@Component({
  selector: 'app-inicio-analise',
  imports: [Botao, LucideLoaderCircle, LucideWandSparkles, Modal, RouterLink],
  template: `
    <app-modal
      [(aberto)]="aberto"
      titulo="Análise com IA"
      complemento="· beta"
      largura="lg"
      (fechado)="aoFechar()"
    >
      <p class="analise__intro">
        A IA vai ler as métricas deste painel — funil, atendimento e equipe
        {{ dados().periodo.doPeriodo }} — e sugerir ações para o time, cada uma com a métrica que
        chamou a atenção e a hipótese por trás.
      </p>
      <p class="visualmente-oculto" role="status">{{ anuncio() }}</p>

      @switch (estado()) {
        @case ('gerando') {
          <div class="analise__aguarde">
            <svg lucideLoaderCircle class="analise__giro" [size]="20" />
            Lendo as métricas do painel…
          </div>
        }
        @case ('pronta') {
          <ol class="analise__lista" role="list" aria-label="Sugestões da IA">
            @for (sugestao of sugestoes(); track sugestao.id; let i = $index) {
              <li class="sugestao">
                <span class="sugestao__numero" aria-hidden="true">{{ i + 1 }}</span>
                <div class="sugestao__corpo">
                  <h3 class="sugestao__titulo">{{ sugestao.titulo }}</h3>
                  <dl class="sugestao__partes">
                    <div>
                      <dt>Métrica observada</dt>
                      <dd>{{ sugestao.metrica }}</dd>
                    </div>
                    <div>
                      <dt>Hipótese</dt>
                      <dd>{{ sugestao.hipotese }}</dd>
                    </div>
                    <div>
                      <dt>Ação sugerida</dt>
                      <dd>{{ sugestao.acao }}</dd>
                    </div>
                  </dl>
                  @if (sugestao.destino; as destino) {
                    <a
                      appBotao
                      class="sugestao__ir"
                      tamanho="sm"
                      variante="contorno"
                      [routerLink]="destino.rota"
                      [icone]="destino.icone"
                      (click)="aberto.set(false)"
                    >
                      {{ destino.rotulo }} · em breve
                    </a>
                  }
                </div>
              </li>
            }
          </ol>
        }
        @default {
          <div class="analise__vazio">
            <span class="analise__simbolo" aria-hidden="true">
              <svg lucideWandSparkles [size]="24" [strokeWidth]="1.5" />
            </span>
            <p>
              Clique em <strong>Gerar análise</strong> para ver três sugestões com os números
              {{ dados().periodo.doPeriodo }}.
            </p>
          </div>
        }
      }

      <div modal-rodape class="analise__rodape">
        <p class="analise__nota">Exemplo ilustrativo — a IA será conectada na etapa de BI.</p>
        <!-- Um botão só (o foco não se perde quando ele vira "Fechar"). -->
        <button
          appBotao
          type="button"
          autofocus
          [variante]="estado() === 'pronta' ? 'invertido' : 'marca'"
          [icone]="estado() === 'pronta' ? icones.fechar : icones.ia"
          [carregando]="estado() === 'gerando'"
          (click)="estado() === 'pronta' ? aberto.set(false) : gerar()"
        >
          {{ estado() === 'pronta' ? 'Fechar' : 'Gerar análise' }}
        </button>
      </div>
    </app-modal>
  `,
  styleUrl: './analise-ia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnaliseIa {
  private readonly locale = inject(LOCALE_ID);

  readonly aberto = model(false);
  readonly dados = input.required<DadosPeriodo>();

  protected readonly icones = { ia: LucideSparkles, fechar: LucideX };
  protected readonly estado = signal<EstadoAnalise>('inicial');
  /** O que a região viva anuncia: a leitura em andamento e a conclusão. */
  protected readonly anuncio = signal('');
  /**
   * As sugestões e, em cada uma, o módulo onde a ação vai ser feita (rótulo, rota e o ícone
   * da navegação — o mesmo que a pessoa vai procurar no menu).
   */
  protected readonly sugestoes = computed(() =>
    gerarSugestoes(this.dados(), this.locale).map((sugestao) => {
      const modulo = moduloPorId(sugestao.modulo);
      return {
        ...sugestao,
        destino: modulo ? { rotulo: modulo.rotulo, rota: modulo.rota, icone: modulo.icone } : null,
      };
    }),
  );
  private espera: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.espera));
  }

  protected gerar(): void {
    if (this.estado() === 'gerando') {
      return;
    }
    this.estado.set('gerando');
    this.anuncio.set('Lendo as métricas do painel…');
    clearTimeout(this.espera);
    this.espera = setTimeout(() => {
      this.estado.set('pronta');
      this.anuncio.set(`Análise pronta: ${this.sugestoes().length} sugestões na lista abaixo.`);
    }, DURACAO_ANALISE_MS);
  }

  /** Fechar cancela uma análise em andamento; a próxima abertura começa do zero. */
  protected aoFechar(): void {
    clearTimeout(this.espera);
    this.estado.set('inicial');
    this.anuncio.set('');
  }
}
