import { toSignal } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideDownload, LucideRefreshCw } from '@lucide/angular';
import { map } from 'rxjs';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { Botao } from '../../ui/botao/botao';
import { Dica } from '../../ui/dica/dica';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { BiApi } from './bi.api';
import {
  ehPainel,
  FILTROS_PADRAO,
  ROTULO_PAINEL,
  type FiltrosBi,
  type FormatoExportacao,
  type IdPainel,
  type RespostaPainel,
} from './bi.tipos';
import { FiltrosBiComponente, SEM_OPCOES, ultimosDias, type OpcoesDosFiltros } from './filtros-bi';
import { PainelBi } from './painel-bi';

type EstadoPagina = 'carregando' | 'pronto' | 'erro' | 'sem-acesso';

/**
 * BI e relatórios (`/bi`, `/bi/:painel`): uma aba por painel que o papel enxerga (Marketing,
 * Comercial, Sucesso do cliente, Atendimento e Financeiro), filtros no topo, indicadores com a
 * variação sobre o período anterior, gráficos e tabelas, exportação em planilha e CSV.
 * Os números vêm prontos da API (`GET /bi/:painel`), que já recorta pelo que cada papel vê.
 */
@Component({
  selector: 'app-bi',
  imports: [Abas, Botao, Dica, Esqueleto, EstadoVazio, FiltrosBiComponente, PainelBi],
  templateUrl: './bi.html',
  styleUrl: './bi.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Bi {
  private readonly api = inject(BiApi);
  private readonly sessao = inject(SessaoService);
  private readonly roteador = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly avisos = inject(AvisosService);
  private readonly documento = inject(DOCUMENT);

  protected readonly icones = { baixar: LucideDownload, atualizar: LucideRefreshCw };
  protected readonly diretoria = this.sessao.ehDiretoria;

  private readonly painelDaRota = toSignal(
    this.rota.paramMap.pipe(map((params) => params.get('painel'))),
    { initialValue: this.rota.snapshot.paramMap.get('painel') },
  );

  /** Painéis do papel (`null` enquanto carrega). */
  protected readonly paineis = signal<readonly IdPainel[] | null>(null);
  protected readonly estadoPaineis = signal<'carregando' | 'pronto' | 'erro'>('carregando');
  protected readonly erroPaineis = signal<ErroApi | null>(null);

  protected readonly abas = computed<readonly ItemAba[]>(() =>
    (this.paineis() ?? []).map((id) => ({ id, rotulo: ROTULO_PAINEL[id] })),
  );

  /** O painel aberto: o da URL se o papel o vê; sem painel na URL, o primeiro da lista. */
  protected readonly painelAtual = computed<IdPainel | null>(() => {
    const lista = this.paineis();
    const pedido = this.painelDaRota();
    if (!lista || lista.length === 0) {
      return null;
    }
    if (!pedido) {
      return lista[0];
    }
    return ehPainel(pedido) && lista.includes(pedido) ? pedido : null;
  });

  protected readonly filtros = signal<FiltrosBi>({ ...FILTROS_PADRAO, ...ultimosDias(30) });
  protected readonly opcoes = signal<OpcoesDosFiltros>(SEM_OPCOES);

  protected readonly dados = signal<RespostaPainel | null>(null);
  protected readonly estado = signal<EstadoPagina>('carregando');
  protected readonly atualizando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly exportando = signal<FormatoExportacao | null>(null);
  private consulta = 0;
  private painelCarregado: IdPainel | null = null;

  /** O período escolhido é válido (de ≤ ate, até 1 ano)? Senão, não consulta. */
  private readonly periodoValido = computed(() => {
    const { de, ate } = this.filtros();
    if (!de || !ate || de > ate) {
      return false;
    }
    return (Date.parse(ate) - Date.parse(de)) / 86_400_000 + 1 <= 366;
  });

  constructor() {
    void this.carregarPaineis();

    // Painel ou filtros mudaram: consulta de novo.
    effect(() => {
      const painel = this.painelAtual();
      const filtros = this.filtros();
      const valido = this.periodoValido();
      if (!painel || !valido) {
        return;
      }
      untracked(() => void this.carregar(painel, filtros));
    });

    // Pedido de um painel que o papel não vê.
    effect(() => {
      const lista = this.paineis();
      if (lista && lista.length > 0 && this.painelDaRota() && !this.painelAtual()) {
        this.estado.set('sem-acesso');
      }
    });
  }

  private async carregarPaineis(): Promise<void> {
    this.estadoPaineis.set('carregando');
    this.erroPaineis.set(null);
    try {
      const lista = await this.api.paineis();
      this.paineis.set(lista);
      this.estadoPaineis.set('pronto');
      if (lista.length > 0) {
        void this.carregarOpcoes();
      }
    } catch (falha) {
      this.erroPaineis.set(erroDaApi(falha));
      this.estadoPaineis.set('erro');
    }
  }

  private async carregarOpcoes(): Promise<void> {
    const lista = this.paineis() ?? [];
    const [pessoas, lideres, funis, canais, filas] = await Promise.all([
      this.api.pessoas(),
      this.diretoria() ? this.api.lideres() : Promise.resolve([]),
      this.api.funis(),
      lista.includes('atendimento') || lista.includes('marketing')
        ? this.api.canais()
        : Promise.resolve([]),
      lista.includes('atendimento') ? this.api.filas() : Promise.resolve([]),
    ]);
    this.opcoes.set({ pessoas, lideres, funis, canais, filas });
  }

  protected async carregar(painel: IdPainel, filtros: FiltrosBi, semCache = false): Promise<void> {
    const consulta = ++this.consulta;
    const trocouDePainel = this.painelCarregado !== painel;
    if (trocouDePainel || !this.dados()) {
      this.estado.set('carregando');
      this.dados.set(null);
    } else {
      this.atualizando.set(true);
    }
    this.erro.set(null);
    try {
      const resposta = await this.api.painel(painel, filtros, semCache);
      if (consulta !== this.consulta) {
        return;
      }
      this.painelCarregado = painel;
      this.dados.set(resposta);
      this.estado.set('pronto');
    } catch (falha) {
      if (consulta !== this.consulta) {
        return;
      }
      const erro = erroDaApi(falha);
      this.erro.set(erro);
      this.dados.set(null);
      this.painelCarregado = null;
      this.estado.set(erro.ehSemPermissao ? 'sem-acesso' : 'erro');
    } finally {
      if (consulta === this.consulta) {
        this.atualizando.set(false);
      }
    }
  }

  protected trocarPainel(id: string | null): void {
    if (!id || id === this.painelAtual()) {
      return;
    }
    // Funil, canal, fila e área são de cada painel; período, comparação, equipe e pessoa seguem.
    this.filtros.update((f) => ({
      ...f,
      area: null,
      funilId: null,
      canalId: null,
      filaId: null,
    }));
    void this.roteador.navigate(['/bi', id]);
  }

  protected atualizar(): void {
    const painel = this.painelAtual();
    if (painel && this.periodoValido()) {
      void this.carregar(painel, this.filtros(), true);
    }
  }

  protected filtrarPessoa(id: string): void {
    this.filtros.update((f) => ({ ...f, pessoaId: id }));
  }

  protected tentarDeNovo(): void {
    if (this.estadoPaineis() === 'erro') {
      void this.carregarPaineis();
    } else {
      this.atualizar();
    }
  }

  protected async exportar(formato: FormatoExportacao, tabela?: string): Promise<void> {
    const painel = this.painelAtual();
    if (!painel || this.exportando()) {
      return;
    }
    this.exportando.set(formato);
    try {
      const arquivo = await this.api.exportar(painel, this.filtros(), formato, tabela);
      const link = this.documento.createElement('a');
      link.href = arquivo.url;
      link.download = arquivo.nome;
      link.rel = 'noopener';
      this.documento.body.append(link);
      link.click();
      link.remove();
      this.avisos.sucesso('Arquivo pronto. O download começou.');
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.exportando.set(null);
    }
  }
}
