import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { formatarData } from '../../../nucleo/formatos';
import { Abas, type ItemAba } from '../../../ui/abas/abas';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { Grafico, type CliqueNoGrafico } from '../../../ui/grafico/grafico';
import { Indicador } from '../../../ui/indicador/indicador';
import { Tabela, type ColunaTabela } from '../../../ui/tabela/tabela';
import { formatarCelula } from '../bi.formatos';
import { montarGrafico } from '../bi.graficos';
import {
  destinoDaEtapa,
  destinoDoClique,
  ROTULO_AGRUPAMENTO,
  tabelaDoWidget,
  textoDoValor,
  valorDoWidget,
  type DestinoDaLista,
} from './indicadores.formatos';
import type { LinhaDoWidget, ResultadoDoWidget } from './indicadores.tipos';

const MODOS: readonly ItemAba[] = [
  { id: 'grafico', rotulo: 'Gráfico' },
  { id: 'numeros', rotulo: 'Números' },
];

type LinhaTexto = Readonly<Record<string, string>>;

/**
 * Um indicador já calculado (R33.2): número com variação e meta, série, ranking, por etapa,
 * barras ou funil. O erro de um indicador aparece só nele, com "Tentar de novo". Clicar abre a
 * lista que sustenta o número quando houver (R20.8).
 */
@Component({
  selector: 'app-widget-indicador',
  imports: [Abas, Botao, Cartao, DecimalPipe, EstadoVazio, Grafico, Indicador, Tabela],
  templateUrl: './widget-indicador.html',
  styleUrl: './widget-indicador.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetIndicador {
  readonly resultado = input.required<ResultadoDoWidget>();
  /** Mostra os botões de editar e remover (modo editor). */
  readonly recalculando = input(false);
  readonly abrir = output<DestinoDaLista>();
  readonly tentarDeNovo = output<void>();

  protected readonly modos = MODOS;
  protected readonly modo = signal<string | null>('grafico');

  protected readonly valor = computed(() => {
    const r = this.resultado();
    return valorDoWidget(r.unidade, r.valor);
  });

  protected readonly periodo = computed(() => {
    const r = this.resultado();
    if (!r.periodo) {
      return 'Agora';
    }
    const fim = (iso: string) => formatarData(new Date(Date.parse(iso) - 1));
    return `${formatarData(r.periodo.de)} a ${fim(r.periodo.ate)}`;
  });

  protected readonly agrupamento = computed(() => {
    const a = this.resultado().agrupamento;
    return a ? ROTULO_AGRUPAMENTO[a] : null;
  });

  protected readonly metaTexto = computed(() => {
    const r = this.resultado();
    return r.meta ? textoDoValor(r.unidade, r.meta.alvo) : null;
  });

  protected readonly destino = computed(() => destinoDoClique(this.resultado().clique));

  protected readonly tabela = computed(() => tabelaDoWidget(this.resultado()));

  protected readonly grafico = computed(() => {
    const r = this.resultado();
    if (r.visualizacao === 'NUMERO' || r.visualizacao === 'RANKING') {
      return null;
    }
    const tipoValor =
      r.visualizacao === 'FUNIL'
        ? 'numero'
        : r.unidade === 'PERCENTUAL'
          ? 'percentual'
          : r.unidade === 'MOEDA'
            ? 'moeda'
            : r.unidade === 'DURACAO'
              ? 'segundos'
              : 'numero';
    return montarGrafico(this.tabela(), {
      tipoValor,
      categoria: 'rotulo',
      chaveId: 'id',
      orientacao: r.visualizacao === 'SERIE' ? 'colunas' : 'barras',
      series: [
        {
          chave: 'valor',
          nome: r.visualizacao === 'FUNIL' ? 'Negócios' : r.nome,
          cor: 0,
          tipo: r.visualizacao === 'SERIE' ? 'linha' : 'barra',
        },
      ],
    });
  });

  protected readonly colunas = computed<readonly ColunaTabela[]>(() =>
    this.tabela()
      .colunas.filter((c) => c.visivel)
      .map((c, i) => ({
        id: c.chave,
        rotulo: c.rotulo,
        alinhar: c.tipo === 'texto' ? 'inicio' : 'fim',
        noCartao: i === 0 ? 'titulo' : 'mostrar',
      })),
  );

  protected readonly linhasTabela = computed<readonly LinhaTexto[]>(() => {
    const colunas = this.tabela().colunas.filter((c) => c.visivel);
    return this.tabela().linhas.map((linha, i) => {
      const texto: Record<string, string> = { _posicao: String(i) };
      for (const c of colunas) {
        texto[c.chave] = formatarCelula(linha[c.chave] ?? null, c.tipo, c.chave);
      }
      return texto;
    });
  });

  protected readonly vazio = computed(() => {
    const r = this.resultado();
    if (r.visualizacao === 'SERIE') {
      return (r.pontos ?? []).every((p) => !p.valor);
    }
    return (
      (r.linhas ?? []).length === 0 ||
      (r.visualizacao !== 'FUNIL' && (r.linhas ?? []).every((l) => !l.valor))
    );
  });

  protected readonly clicavelNaLinha = computed(
    () =>
      this.resultado().visualizacao === 'POR_ETAPA' || this.resultado().visualizacao === 'FUNIL',
  );

  protected textoLinha(linha: LinhaDoWidget): string {
    return textoDoValor(this.resultado().unidade, linha.valor);
  }

  protected textoMeta(linha: LinhaDoWidget): string | null {
    return linha.meta ? textoDoValor(this.resultado().unidade, linha.meta.alvo) : null;
  }

  protected larguraDaBarra(progresso: number | null | undefined): number {
    return Math.max(0, Math.min(100, progresso ?? 0));
  }

  protected chaveDaLinha = (linha: LinhaTexto): string => linha['_posicao'];

  protected abrirLista(responsavelId: string | null = null): void {
    const r = this.resultado();
    const destino = destinoDoClique(r.clique, { responsavelId });
    if (destino) {
      this.abrir.emit(destino);
    }
  }

  protected abrirEtapa(etapaId: string | null): void {
    const funil = this.resultado().funil;
    const destino = funil ? destinoDaEtapa(funil.area, funil.id, etapaId, false) : null;
    if (destino) {
      this.abrir.emit(destino);
    }
  }

  protected aoClicarNoGrafico(clique: CliqueNoGrafico): void {
    const id = (clique.dado as { id?: unknown } | null)?.id;
    if (this.clicavelNaLinha() && typeof id === 'string') {
      this.abrirEtapa(id);
    }
  }

  protected aoAbrirLinha(linha: LinhaTexto): void {
    const original = this.tabela().linhas[Number(linha['_posicao'])];
    const id = original?.['id'];
    if (this.clicavelNaLinha() && typeof id === 'string') {
      this.abrirEtapa(id);
    }
  }
}
