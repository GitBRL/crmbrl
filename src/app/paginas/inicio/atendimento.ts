import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideMessagesSquare } from '@lucide/angular';

import { BarraFunil } from '../../ui/barra-funil/barra-funil';
import { Dica } from '../../ui/dica/dica';
import { Indicador } from '../../ui/indicador/indicador';
import { Legenda } from '../../ui/legenda/legenda';
import { Selo } from '../../ui/selo/selo';
import { SERIES_ATENDIMENTO, type DadosAtendimento, type Periodo } from './dados-exemplo';

/**
 * Aba "Atendimento" do palco (prévia do módulo da Fase 2): conversas abertas, tempo da
 * 1ª resposta, SLA e satisfação, e o volume por canal nas mesmas barras de cápsulas do
 * funil — chatbot, equipe e em andamento. O nome da aba já titula o painel: o título fica só
 * para leitores de tela.
 */
@Component({
  selector: 'app-inicio-atendimento',
  imports: [BarraFunil, Dica, Indicador, Legenda, LucideMessagesSquare, Selo],
  template: `
    <h2 class="visualmente-oculto">Atendimento · {{ periodo().complemento }}</h2>
    <header class="palco__topo">
      <app-selo variante="contorno" [icone]="iconeFase">módulo da Fase 2</app-selo>
    </header>

    <div class="palco__bloco">
      <p class="palco__base">Variações {{ periodo().comparacao }}</p>
      <div class="palco__kpis palco__kpis--4">
        <app-indicador
          [valor]="dados().conversasAbertas"
          legenda="Conversas abertas agora"
          dica="Conversas em andamento neste momento, somando todos os canais."
        />
        <app-indicador
          variacaoAbaixo
          [valor]="dados().primeiraRespostaMin"
          unidade="min"
          legenda="Tempo médio da 1ª resposta"
          [variacao]="dados().variacaoPrimeiraResposta"
          quedaEhBoa
          [dica]="dicas().resposta"
        />
        <app-indicador
          variacaoAbaixo
          unidadeVariacao="p.p."
          [valor]="dados().slaCumprido"
          unidade="%"
          legenda="SLA cumprido"
          [variacao]="dados().variacaoSla"
          [dica]="dicas().sla"
        />
        <app-indicador
          variacaoAbaixo
          unidadeVariacao="p.p."
          [valor]="dados().csat"
          unidade="%"
          legenda="Satisfação (CSAT)"
          [variacao]="dados().variacaoCsat"
          [dica]="dicas().csat"
        />
      </div>
    </div>

    <div class="canais">
      <div class="palco__topo">
        <div class="palco__titulo-linha">
          <h3 class="canais__titulo">Volume por canal</h3>
          <app-dica
            rotulo="Sobre o volume por canal"
            texto="Conversas do período em cada canal, do maior para o menor. Cada barra mostra quantas o chatbot resolveu sozinho, quantas a equipe resolveu e quantas ainda estão em andamento."
          />
        </div>
        <app-legenda [series]="series" />
      </div>
      @for (canal of dados().canais; track canal.canal) {
        <app-barra-funil
          [etapa]="canal.canal"
          [total]="canal.total"
          [series]="canal.series"
          [totalReferencia]="maior()"
        />
      }
    </div>

    <p class="palco__nota">
      <svg lucideMessagesSquare [size]="16" />
      <span>
        Prévia do módulo Atendimento: WhatsApp por conexão própria, sem serviços de terceiros, além
        de Instagram, e-mail e chat do site, com chatbot e distribuição de conversas — tudo dentro
        do CRM.
      </span>
    </p>
  `,
  styleUrl: './atendimento.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioAtendimento {
  readonly dados = input.required<DadosAtendimento>();
  readonly periodo = input.required<Periodo>();

  protected readonly series = SERIES_ATENDIMENTO;
  protected readonly iconeFase = LucideMessagesSquare;
  /** Cada dica termina dizendo com o que a seta compara (o período anterior). */
  protected readonly dicas = computed(() => {
    const compara = `A seta compara com ${this.periodo().anterior}`;
    return {
      resposta: `Tempo entre a mensagem do cliente e a primeira resposta de alguém da equipe. Aqui, cair é bom. ${compara}.`,
      sla: `SLA é o prazo máximo combinado para responder o cliente (aqui, 15 minutos). Mostra a parte das conversas respondidas dentro dele. ${compara}, em pontos percentuais (p.p.).`,
      csat: `CSAT é a nota que o cliente dá ao fim do atendimento, de 1 a 5. Mostra a parte das notas 4 e 5. ${compara}, em pontos percentuais (p.p.).`,
    };
  });
  /** As barras são proporcionais ao canal com mais conversas. */
  protected readonly maior = computed(() =>
    Math.max(0, ...this.dados().canais.map((canal) => canal.total)),
  );
}
