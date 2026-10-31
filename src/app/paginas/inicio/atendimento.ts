import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { ErroApi } from '../../nucleo/api/erro-api';
import { BarraFunil, type SerieFunil } from '../../ui/barra-funil/barra-funil';
import { Botao } from '../../ui/botao/botao';
import { Dica } from '../../ui/dica/dica';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Indicador } from '../../ui/indicador/indicador';
import { Legenda } from '../../ui/legenda/legenda';
import { valorDoCartao } from '../bi/bi.formatos';
import type { Cartao, RespostaPainel } from '../bi/bi.tipos';
import type { Periodo } from './dados-exemplo';
import type { EstadoJornada } from './jornada';

const SERIES = ['Resolvidas', 'Em andamento'] as const;

/** Os quatro indicadores do topo, na ordem, e a legenda curta de cada um. */
const INDICADORES: readonly { readonly chave: string; readonly legenda: string }[] = [
  { chave: 'emAberto', legenda: 'Conversas abertas agora' },
  { chave: 'primeiraRespostaMediana', legenda: 'Tempo típico da 1ª resposta' },
  { chave: 'slaPrimeiraResposta', legenda: 'SLA da 1ª resposta cumprido' },
  { chave: 'csat', legenda: 'Satisfação (CSAT)' },
];

/**
 * Aba "Atendimento" do palco: os números do painel de Atendimento do BI (`GET /bi/atendimento`)
 * — conversas abertas, tempo da 1ª resposta, SLA e satisfação — e o volume por canal nas barras
 * de cápsulas: resolvidas e ainda em andamento. O nome da aba já titula o painel: o título fica
 * só para leitores de tela.
 */
@Component({
  selector: 'app-inicio-atendimento',
  imports: [BarraFunil, Botao, Dica, Esqueleto, EstadoVazio, Indicador, Legenda, RouterLink],
  template: `
    <h2 class="visualmente-oculto">Atendimento · {{ periodo().complemento }}</h2>
    @switch (estado()) {
      @case ('carregando') {
        <div class="palco__bloco" aria-busy="true">
          <span class="visualmente-oculto" role="status">Carregando o atendimento…</span>
          <app-esqueleto forma="bloco" altura="6rem" />
          <app-esqueleto forma="bloco" altura="10rem" />
        </div>
      }
      @case ('erro') {
        <app-estado-vazio
          compacto
          variante="erro"
          [falha]="erro()"
          titulo="Não conseguimos carregar o atendimento"
          [texto]="erro()?.resumo ?? null"
          [codigo]="erro()?.requisicaoId ?? null"
        >
          <button appBotao variante="invertido" type="button" (click)="recarregar.emit()">
            Tentar de novo
          </button>
        </app-estado-vazio>
      }
      @default {
        @if (resposta() === null) {
          <app-estado-vazio
            compacto
            variante="sem-acesso"
            titulo="O atendimento não está no seu painel"
            texto="Peça ao seu líder ou ao administrador para liberar o acesso."
          />
        } @else {
          <div class="palco__bloco">
            <p class="palco__base">Variações {{ periodo().comparacao }}</p>
            <div class="palco__kpis palco__kpis--4">
              @for (kpi of indicadores(); track kpi.chave) {
                <app-indicador
                  variacaoAbaixo
                  [valor]="kpi.valor"
                  [prefixo]="kpi.prefixo"
                  [unidade]="kpi.unidade"
                  [casas]="kpi.casas"
                  [legenda]="kpi.legenda"
                  [variacao]="kpi.variacao"
                  [quedaEhBoa]="kpi.quedaEhBoa"
                  [dica]="kpi.dica"
                />
              }
            </div>
          </div>

          <div class="canais">
            <div class="palco__topo">
              <div class="palco__titulo-linha">
                <h3 class="canais__titulo">Volume por canal</h3>
                <app-dica
                  rotulo="Sobre o volume por canal"
                  texto="Conversas do período em cada canal, do maior para o menor. Cada barra mostra quantas já foram resolvidas e quantas ainda estão em andamento."
                />
              </div>
              <app-legenda [series]="series" />
            </div>
            @if (canais().length === 0) {
              <app-estado-vazio
                compacto
                titulo="Nenhuma conversa no período"
                texto="Escolha um período maior para ver o volume por canal."
              />
            } @else {
              @for (canal of canais(); track canal.id ?? canal.nome) {
                <app-barra-funil
                  [etapa]="canal.nome"
                  [total]="canal.total"
                  [series]="canal.series"
                  [totalReferencia]="maior()"
                />
              }
            }
          </div>

          <p class="palco__nota">
            <a appBotao tamanho="sm" routerLink="/bi/atendimento">Ver o painel completo no BI</a>
          </p>
        }
      }
    }
  `,
  styleUrl: './atendimento.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioAtendimento {
  /** `null` = o papel não vê o painel (ou ele ainda não veio). */
  readonly resposta = input.required<RespostaPainel | null>();
  readonly estado = input<EstadoJornada>('carregando');
  readonly erro = input<ErroApi | null>(null);
  readonly periodo = input.required<Periodo>();
  readonly recarregar = output<void>();

  protected readonly series = SERIES;

  protected readonly indicadores = computed(() => {
    const cartoes = new Map<string, Cartao>(
      (this.resposta()?.cartoes ?? []).map((cartao) => [cartao.chave, cartao]),
    );
    return INDICADORES.flatMap(({ chave, legenda }) => {
      const cartao = cartoes.get(chave);
      if (!cartao) {
        return [];
      }
      const formatado = valorDoCartao(cartao);
      return [
        {
          chave,
          legenda,
          valor: formatado?.valor ?? '—',
          prefixo: formatado?.prefixo ?? null,
          unidade: formatado?.unidade ?? null,
          casas: formatado?.casas ?? '1.0-1',
          variacao: this.resposta()?.anterior ? cartao.variacao : null,
          quedaEhBoa: cartao.melhorQuando === 'menor',
          dica: cartao.dica,
        },
      ];
    });
  });

  /** Canais com conversas no período, do maior para o menor. */
  protected readonly canais = computed(() => {
    const linhas = this.resposta()?.tabelas['porCanal']?.linhas ?? [];
    return linhas
      .map((linha) => {
        const total = Number(linha['conversas']) || 0;
        const resolvidas = Math.min(total, Number(linha['resolvidas']) || 0);
        const series: readonly SerieFunil[] = [
          { rotulo: SERIES[0], valor: resolvidas },
          { rotulo: SERIES[1], valor: total - resolvidas },
        ];
        return {
          id: typeof linha['id'] === 'string' ? linha['id'] : null,
          nome: String(linha['nome'] ?? 'Sem canal'),
          total,
          series,
        };
      })
      .filter((canal) => canal.total > 0)
      .sort((a, b) => b.total - a.total);
  });

  /** As barras são proporcionais ao canal com mais conversas. */
  protected readonly maior = computed(() =>
    Math.max(0, ...this.canais().map((canal) => canal.total)),
  );
}
