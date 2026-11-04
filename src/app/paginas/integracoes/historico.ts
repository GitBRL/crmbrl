import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { LucideRefreshCw } from '@lucide/angular';

import { POR_PAGINA_MAXIMO } from '../../nucleo/api/api';
import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { Botao } from '../../ui/botao/botao';
import { CampoData } from '../../ui/campo-data/campo-data';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import type { FiltroRecebimentos } from './integracoes.api';
import { IntegracoesApi } from './integracoes.api';
import { Recebimentos } from './recebimentos';
import type {
  AplicativoDoCatalogo,
  AplicativoIntegracao,
  StatusRecebimento,
  WebhookEntrada,
} from './tipos';

const FILTROS: readonly OpcaoFiltro[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'ERRO', rotulo: 'Com erro' },
  { id: 'IGNORADO', rotulo: 'Ignorados' },
  { id: 'PROCESSADO', rotulo: 'Processados' },
  { id: 'RECEBIDO', rotulo: 'Na fila' },
];

/** `AAAA-MM-DD` (dia local) → ISO do início desse dia (ou do dia seguinte, com `diaSeguinte`). */
export function inicioDoDia(dia: string, diaSeguinte = false): string | undefined {
  const [ano, mes, d] = dia.split('-').map(Number);
  if (!ano || !mes || !d) {
    return undefined;
  }
  return new Date(ano, mes - 1, d + (diaSeguinte ? 1 : 0)).toISOString();
}

/**
 * Histórico (`/integracoes/historico`, Admin) — Onda H, R8.6: todos os recebimentos das
 * integrações (90 dias), com filtros de data, status, aplicativo e integração. Cada
 * recebimento abre no lugar (cabeçalhos, corpo, avisos, o que foi criado) com "Reprocessar",
 * "Copiar JSON" e "Editar integração". `?integracao=<id>` já chega filtrado ("Ver histórico").
 */
@Component({
  selector: 'app-historico',
  imports: [Botao, Cartao, CampoData, EstadoVazio, FiltrosPilula, Seletor, Recebimentos],
  template: `
    <app-cartao
      titulo="Histórico de recebimentos"
      dica="Tudo o que as ferramentas enviaram ao CRM nos últimos 90 dias: o que chegou, o que foi criado e o que deu errado. Abra um recebimento para ver o corpo e reprocessá-lo."
    >
      <div class="filtros__status">
        <app-filtros-pilula
          rotulo="Filtrar por status"
          [opcoes]="filtrosDeStatus"
          [selecionado]="status()"
          (selecionadoChange)="status.set($event ?? 'todos')"
        />
      </div>

      <div class="filtros" role="group" aria-label="Filtros do histórico">
        <app-seletor
          rotulo="Aplicativo"
          placeholder="Todos os aplicativos"
          permitirVazio
          [opcoes]="opcoesAplicativo()"
          [valor]="aplicativo()"
          (valorChange)="escolherAplicativo($event)"
        />
        <app-seletor
          rotulo="Integração"
          placeholder="Todas as integrações"
          permitirVazio
          [opcoes]="opcoesIntegracao()"
          [valor]="integracaoId()"
          (valorChange)="integracaoId.set($event)"
        />
        <app-campo-data rotulo="De" [maximo]="ate()" [(valor)]="de" />
        <app-campo-data rotulo="Até" [minimo]="de()" [(valor)]="ate" />
        @if (comFiltro()) {
          <button
            appBotao
            type="button"
            variante="neutro"
            class="filtros__limpar"
            (click)="limpar()"
          >
            Limpar filtros
          </button>
        }
      </div>

      @if (erroApoio(); as falha) {
        <app-estado-vazio
          compacto
          variante="erro"
          [falha]="falha"
          titulo="Não conseguimos carregar as integrações para filtrar"
          [texto]="falha.resumo"
          [codigo]="falha.requisicaoId"
        >
          <button
            appBotao
            type="button"
            variante="contorno"
            tamanho="sm"
            [icone]="iconeAtualizar"
            (click)="carregarApoio()"
          >
            Tentar de novo
          </button>
        </app-estado-vazio>
      }

      <app-recebimentos
        [consulta]="consulta()"
        [funilDaIntegracao]="funilDaIntegracao()"
        (editarIntegracao)="editar($event)"
      />
    </app-cartao>
  `,
  styleUrl: './historico.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Historico {
  private readonly api = inject(IntegracoesApi);
  private readonly router = inject(Router);

  /** Integração já filtrada (query `integracao`, de "Ver histórico"). */
  readonly integracao = input<string | null>(null);

  protected readonly filtrosDeStatus = FILTROS;
  protected readonly iconeAtualizar = LucideRefreshCw;

  protected readonly status = signal<string | null>('todos');
  protected readonly aplicativo = signal<AplicativoIntegracao | null>(null);
  protected readonly integracaoId = signal<string | null>(null);
  protected readonly de = signal<string | null>(null);
  protected readonly ate = signal<string | null>(null);

  private readonly catalogo = signal<readonly AplicativoDoCatalogo[]>([]);
  private readonly integracoes = signal<readonly WebhookEntrada[]>([]);
  protected readonly erroApoio = signal<ErroApi | null>(null);

  protected readonly opcoesAplicativo = computed<readonly OpcaoSeletor<AplicativoIntegracao>[]>(
    () =>
      [...this.catalogo()]
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((app) => ({ valor: app.aplicativo, rotulo: app.nome })),
  );

  protected readonly opcoesIntegracao = computed<readonly OpcaoSeletor<string>[]>(() => {
    const app = this.aplicativo();
    return this.integracoes()
      .filter((item) => !app || item.aplicativo === app)
      .map((item) => ({ valor: item.id, rotulo: `${item.nome} (${item.aplicativoNome})` }));
  });

  protected readonly funilDaIntegracao = computed(
    () => new Map(this.integracoes().map((item) => [item.id, item.funil.id])),
  );

  protected readonly consulta = computed<Omit<FiltroRecebimentos, 'pagina' | 'porPagina'>>(() => {
    const status = this.status();
    const de = this.de();
    const ate = this.ate();
    const app = this.aplicativo();
    return {
      ...(status && status !== 'todos' ? { status: [status as StatusRecebimento] } : {}),
      ...(app ? { aplicativo: [app] } : {}),
      ...(this.integracaoId() ? { integracaoId: this.integracaoId() as string } : {}),
      ...(de ? { de: inicioDoDia(de) } : {}),
      ...(ate ? { ate: inicioDoDia(ate, true) } : {}),
    };
  });

  protected readonly comFiltro = computed(() => Object.keys(this.consulta()).length > 0);

  constructor() {
    void this.carregarApoio();
    effect(() => {
      const id = this.integracao();
      untracked(() => this.integracaoId.set(id));
    });
  }

  protected async carregarApoio(): Promise<void> {
    this.erroApoio.set(null);
    try {
      const [catalogo, primeira] = await Promise.all([
        this.api.catalogo(),
        this.api.listarEntradas({ pagina: 1, porPagina: POR_PAGINA_MAXIMO }),
      ]);
      this.catalogo.set(catalogo.aplicativos.filter((app) => app.disponivel));
      this.integracoes.set(primeira.itens);
    } catch (falha) {
      this.erroApoio.set(erroDaApi(falha));
    }
  }

  protected escolherAplicativo(app: AplicativoIntegracao | null): void {
    this.aplicativo.set(app);
    const atual = this.integracoes().find((item) => item.id === this.integracaoId());
    if (app && atual && atual.aplicativo !== app) {
      this.integracaoId.set(null);
    }
  }

  protected limpar(): void {
    this.status.set('todos');
    this.aplicativo.set(null);
    this.integracaoId.set(null);
    this.de.set(null);
    this.ate.set(null);
    if (this.integracao()) {
      void this.router.navigate([], {
        queryParams: { integracao: null },
        queryParamsHandling: 'merge',
      });
    }
  }

  protected editar(id: string): void {
    void this.router.navigate(['/integracoes/aplicativos'], { queryParams: { integracao: id } });
  }
}
