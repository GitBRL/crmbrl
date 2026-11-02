import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { LucideDownload } from '@lucide/angular';

import { formatarData, formatarHora } from '../../nucleo/formatos';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Grafico, type CliqueNoGrafico } from '../../ui/grafico/grafico';
import { Indicador } from '../../ui/indicador/indicador';
import { Tabela, type ColunaTabela } from '../../ui/tabela/tabela';
import { formatarCelula, valorDoCartao } from './bi.formatos';
import { montarGrafico, type GraficoMontado } from './bi.graficos';
import { PAINEIS_BI, type BlocoBi, type DestinoClique } from './bi.paineis';
import type { Cartao as CartaoBi, FiltrosBi, RespostaPainel, TabelaBi } from './bi.tipos';

type LinhaTexto = Readonly<Record<string, string>>;

interface BlocoPronto {
  readonly bloco: BlocoBi;
  readonly tabela: TabelaBi;
  readonly titulo: string;
  readonly grafico: GraficoMontado | null;
  readonly colunas: readonly ColunaTabela[];
  readonly linhas: readonly LinhaTexto[];
  readonly vazio: boolean;
}

interface CartaoPronto {
  readonly cartao: CartaoBi;
  readonly valor: string | number;
  readonly prefixo: string | null;
  readonly unidade: string | null;
  readonly casas: string;
  readonly variacao: number | null;
  readonly semDado: boolean;
}

const MODOS: readonly ItemAba[] = [
  { id: 'grafico', rotulo: 'Gráfico' },
  { id: 'numeros', rotulo: 'Números' },
];

/**
 * Um painel do BI já carregado: os cartões de indicador (do período, com a variação, e os de
 * "agora") e, em seguida, um cartão por tabela da API — gráfico com a alternativa em números,
 * ou só a tabela. Cada gráfico e cada tabela leva ao filtro ou à lista correspondente quando a
 * linha tem um `id` (etapa, responsável, canal, fila…).
 */
@Component({
  selector: 'app-bi-painel',
  imports: [Abas, BotaoIcone, Cartao, EstadoVazio, Grafico, Indicador, Tabela],
  templateUrl: './painel-bi.html',
  styleUrl: './painel-bi.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PainelBi {
  private readonly roteador = inject(Router);

  readonly dados = input.required<RespostaPainel>();
  readonly filtros = input.required<FiltrosBi>();
  /** O clique numa linha de pessoa vira o filtro "Responsável". */
  readonly filtrarPessoa = output<string>();
  /** Baixa uma tabela em CSV. */
  readonly baixarTabela = output<string>();

  protected readonly iconeBaixar = LucideDownload;
  protected readonly modos = MODOS;
  private readonly modoDoBloco = signal<Readonly<Record<string, string | null>>>({});

  protected readonly especificacao = computed(() => PAINEIS_BI[this.dados().painel]);

  protected readonly periodo = computed(() => {
    const { periodo, anterior, geradoEm } = this.dados();
    const fim = (iso: string) => formatarData(new Date(Date.parse(iso) - 1));
    const intervalo = (p: { de: string; ate: string }) => `${formatarData(p.de)} a ${fim(p.ate)}`;
    return {
      atual: intervalo(periodo),
      anterior: anterior ? intervalo(anterior) : null,
      geradoEm: formatarHora(geradoEm),
    };
  });

  protected readonly cartoes = computed(() => {
    const { cartoes, anterior } = this.dados();
    const agora = new Set(this.especificacao().agora);
    const pronto = (cartao: CartaoBi): CartaoPronto => {
      const formatado = valorDoCartao(cartao);
      return {
        cartao,
        valor: formatado?.valor ?? '—',
        prefixo: formatado?.prefixo ?? null,
        unidade: formatado?.unidade ?? null,
        casas: formatado?.casas ?? '1.0-1',
        variacao: anterior ? cartao.variacao : null,
        semDado: formatado === null,
      };
    };
    return {
      periodo: cartoes.filter((c) => !agora.has(c.chave)).map(pronto),
      agora: cartoes.filter((c) => agora.has(c.chave)).map(pronto),
    };
  });

  protected readonly blocos = computed<readonly BlocoPronto[]>(() => {
    const { tabelas } = this.dados();
    return this.especificacao()
      .blocos.map((bloco): BlocoPronto | null => {
        const tabela = tabelas[bloco.tabela];
        if (!tabela) {
          return null;
        }
        const visiveis = tabela.colunas.filter((coluna) => coluna.visivel);
        const colunas: ColunaTabela[] = visiveis.map((coluna, indice) => ({
          id: coluna.chave,
          rotulo: coluna.rotulo,
          alinhar: ['texto', 'data'].includes(coluna.tipo) ? 'inicio' : 'fim',
          noCartao: indice === 0 ? 'titulo' : 'mostrar',
        }));
        const linhas = tabela.linhas.map((linha, posicao) => {
          const texto: Record<string, string> = { _posicao: String(posicao) };
          for (const coluna of visiveis) {
            texto[coluna.chave] = formatarCelula(linha[coluna.chave], coluna.tipo, coluna.chave);
          }
          return texto;
        });
        const grafico = bloco.grafico ? montarGrafico(tabela, bloco.grafico) : null;
        return {
          bloco,
          tabela,
          titulo: bloco.titulo ?? tabela.titulo,
          grafico,
          colunas,
          linhas,
          vazio: grafico ? grafico.vazio : tabela.linhas.length === 0,
        };
      })
      .filter((bloco): bloco is BlocoPronto => bloco !== null);
  });

  protected modoDe(id: string): string {
    return this.modoDoBloco()[id] ?? 'grafico';
  }

  protected trocarModo(id: string, modo: string | null): void {
    this.modoDoBloco.update((atual) => ({ ...atual, [id]: modo }));
  }

  protected ehClicavel(bloco: BlocoPronto): boolean {
    return !!bloco.bloco.clique;
  }

  protected aoClicarNoGrafico(bloco: BlocoPronto, clique: CliqueNoGrafico): void {
    const id = (clique.dado as { id?: unknown } | null)?.id;
    if (typeof id === 'string' && bloco.bloco.clique) {
      this.abrir(bloco.bloco.clique, id);
    }
  }

  protected aoAbrirLinha(bloco: BlocoPronto, linha: LinhaTexto): void {
    const destino = bloco.bloco.clique;
    if (!destino) {
      return;
    }
    const original = bloco.tabela.linhas[Number(linha['_posicao'])];
    const id = original?.[destino.coluna];
    if (typeof id === 'string') {
      this.abrir(destino, id);
    }
  }

  protected chaveDaLinha = (linha: LinhaTexto): string => linha['_posicao'];

  private abrir(destino: DestinoClique, id: string): void {
    const funil = this.filtros().funilId;
    switch (destino.tipo) {
      case 'etapa':
        void this.roteador.navigate(['/funis', destino.area], {
          queryParams: { etapaId: id, ...(funil ? { funil } : {}) },
        });
        break;
      case 'pessoa':
        this.filtrarPessoa.emit(id);
        break;
      case 'canal':
        void this.roteador.navigate(['/atendimento'], { queryParams: { canalId: id } });
        break;
      case 'fila':
        void this.roteador.navigate(['/atendimento'], { queryParams: { filaId: id } });
        break;
      case 'negocio':
        void this.roteador.navigate(['/funis', destino.area, id]);
        break;
      case 'contato':
        void this.roteador.navigate(['/contatos', id]);
        break;
      case 'campanha':
        void this.roteador.navigate(['/disparos', id]);
        break;
    }
  }

  protected textoDoClique(destino: DestinoClique): string {
    switch (destino.tipo) {
      case 'etapa':
        return 'Clique numa barra ou numa linha para ver os negócios daquela etapa.';
      case 'pessoa':
        return 'Clique numa linha para ver só os números dessa pessoa.';
      case 'canal':
        return 'Clique numa barra ou numa linha para ver as conversas do canal.';
      case 'fila':
        return 'Clique numa barra ou numa linha para ver as conversas da fila.';
      case 'negocio':
        return 'Clique numa linha para abrir o negócio.';
      case 'contato':
        return 'Clique numa linha para abrir o contato.';
      case 'campanha':
        return 'Clique numa linha para abrir a campanha.';
    }
  }
}
