import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideCopy,
  LucideDownload,
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideShare2,
  LucideTrash2,
} from '@lucide/angular';

import { erroDaApi, type ErroApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../../nucleo/confirmacao.service';
import { formatarData, formatarHora } from '../../../nucleo/formatos';
import { SessaoService } from '../../../nucleo/sessao/sessao.service';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { Selo } from '../../../ui/selo/selo';
import { FunisApi } from '../../funis/funis.api';
import { BiApi } from '../bi.api';
import type { FormatoExportacao } from '../bi.tipos';
import { CompartilharPainel } from './compartilhar-painel';
import { EditorPainel } from './editor-painel';
import {
  FiltrosIndicador,
  type OpcoesDosFiltrosIndicador,
  SEM_OPCOES_INDICADOR,
} from './filtros-indicador';
import { IndicadoresApi } from './indicadores.api';
import { filtrosEscolhidos, type DestinoDaLista } from './indicadores.formatos';
import type {
  Catalogo,
  FiltrosDoIndicador,
  PainelDeIndicadores,
  RespostaDeCalculo,
} from './indicadores.tipos';
import { WidgetIndicador } from './widget-indicador';

type Estado = 'carregando' | 'pronto' | 'erro' | 'sem-acesso';
type Modo = 'ver' | 'editar' | 'novo';

/** O período personalizado só consulta com as duas datas (a API recusa o resto, R20.3). */
export function periodoConsultavel(filtros: FiltrosDoIndicador): boolean {
  const periodo = filtros.periodo;
  if (!periodo || periodo.tipo !== 'PERSONALIZADO') {
    return true;
  }
  if (!periodo.de || !periodo.ate) {
    return false;
  }
  const dias = (Date.parse(periodo.ate) - Date.parse(periodo.de)) / 86_400_000;
  return dias > 0 && dias <= 366;
}

/**
 * Indicadores configuráveis (`/bi/indicadores` e `/bi/indicadores/:id`, R33.8): a lista dos painéis
 * (meus e compartilhados comigo), a visualização em grade com filtros no topo, o editor, o
 * compartilhamento e a exportação. Os números vêm prontos de `POST /indicadores/calcular`, já
 * recortados pelo que a pessoa vê (R33.4).
 */
@Component({
  selector: 'app-indicadores',
  imports: [
    Botao,
    Cartao,
    CompartilharPainel,
    EditorPainel,
    Esqueleto,
    EstadoVazio,
    FiltrosIndicador,
    RouterLink,
    Selo,
    WidgetIndicador,
  ],
  templateUrl: './indicadores.html',
  styleUrl: './indicadores.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Indicadores {
  private readonly api = inject(IndicadoresApi);
  private readonly biApi = inject(BiApi);
  private readonly funisApi = inject(FunisApi);
  private readonly sessao = inject(SessaoService);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly roteador = inject(Router);
  private readonly documento = inject(DOCUMENT);

  /** Id do painel na URL (`/bi/indicadores/:id`); sem ele, a lista. */
  readonly id = input<string | null>(null);

  protected readonly icones = {
    novo: LucidePlus,
    editar: LucidePencil,
    duplicar: LucideCopy,
    excluir: LucideTrash2,
    compartilhar: LucideShare2,
    atualizar: LucideRefreshCw,
    baixar: LucideDownload,
  };
  protected readonly diretoria = this.sessao.ehDiretoria;
  protected readonly podeCriar = computed(() => this.sessao.ehDiretoria() || this.sessao.ehLider());

  protected readonly catalogo = signal<Catalogo | null>(null);
  protected readonly opcoes = signal<OpcoesDosFiltrosIndicador>(SEM_OPCOES_INDICADOR);
  protected readonly pessoas = signal<readonly { readonly id: string; readonly nome: string }[]>(
    [],
  );

  // Lista ------------------------------------------------------------------------------
  protected readonly lista = signal<readonly PainelDeIndicadores[] | null>(null);
  protected readonly estadoLista = signal<Estado>('carregando');
  protected readonly erroLista = signal<ErroApi | null>(null);
  protected readonly criandoModelo = signal(false);

  // Painel aberto ----------------------------------------------------------------------
  protected readonly painel = signal<PainelDeIndicadores | null>(null);
  protected readonly modo = signal<Modo>('ver');
  protected readonly estado = signal<Estado>('carregando');
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly filtros = signal<FiltrosDoIndicador>({});
  protected readonly resultado = signal<RespostaDeCalculo | null>(null);
  protected readonly atualizando = signal(false);
  protected readonly exportando = signal<FormatoExportacao | null>(null);
  protected readonly compartilhando = signal(false);
  private consulta = 0;

  protected readonly modeloTime = computed(
    () => this.catalogo()?.modelos.find((m) => m.chave === 'time_comercial') ?? null,
  );
  protected readonly widgetsOrdenados = computed(() =>
    [...(this.resultado()?.widgets ?? [])].sort((a, b) => a.ordem - b.ordem),
  );
  protected readonly periodoTexto = computed(() => {
    const r = this.resultado();
    if (!r?.periodo) {
      return null;
    }
    const fim = (iso: string) => formatarData(new Date(Date.parse(iso) - 1));
    const intervalo = (p: { de: string; ate: string }) => `${formatarData(p.de)} a ${fim(p.ate)}`;
    return {
      atual: intervalo(r.periodo),
      anterior: r.anterior ? intervalo(r.anterior) : null,
      hora: formatarHora(r.geradoEm),
    };
  });
  protected readonly periodoOk = computed(() => periodoConsultavel(this.filtros()));

  constructor() {
    void this.carregarBase();

    // A URL mudou: lista ou um painel.
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.modo.set('ver');
        if (id) {
          void this.abrirPainel(id);
        } else {
          this.painel.set(null);
          this.resultado.set(null);
          void this.carregarLista();
        }
      });
    });

    // Filtros do topo mudaram: calcula de novo.
    effect(() => {
      const painel = this.painel();
      const filtros = this.filtros();
      const ok = this.periodoOk();
      if (!painel || !ok || untracked(() => this.modo()) !== 'ver') {
        return;
      }
      untracked(() => void this.calcular(painel, filtros));
    });
  }

  private async carregarBase(): Promise<void> {
    const [catalogo, pessoas, lideres, funis] = await Promise.all([
      this.api.catalogo().catch(() => null),
      this.biApi.pessoas(),
      this.sessao.ehDiretoria() ? this.biApi.lideres() : Promise.resolve([]),
      this.funisApi.funis().catch(() => []),
    ]);
    this.catalogo.set(catalogo);
    this.pessoas.set(pessoas.map(({ id, nome }) => ({ id, nome })));
    this.opcoes.set({
      pessoas: pessoas.map(({ id, nome }) => ({ id, nome })),
      lideres: lideres.map(({ id, nome }) => ({ id, nome })),
      funis: funis
        .filter((f) => f.ativo)
        .map((f) => ({
          id: f.id,
          nome: f.nome,
          etapas: f.etapas.map((e) => ({ id: e.id, nome: e.nome })),
        })),
    });
  }

  // Lista ------------------------------------------------------------------------------

  protected async carregarLista(): Promise<void> {
    this.estadoLista.set('carregando');
    this.erroLista.set(null);
    try {
      this.lista.set(await this.api.paineis());
      this.estadoLista.set('pronto');
    } catch (falha) {
      this.erroLista.set(erroDaApi(falha));
      this.estadoLista.set('erro');
    }
  }

  protected async criarModelo(): Promise<void> {
    this.criandoModelo.set(true);
    try {
      const criado = await this.api.criar({ modelo: 'time_comercial' });
      this.avisos.sucesso('Painel "Time comercial" criado.');
      void this.roteador.navigate(['/bi/indicadores', criado.id]);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.criandoModelo.set(false);
    }
  }

  protected novoPainel(): void {
    this.painel.set(null);
    this.resultado.set(null);
    this.modo.set('novo');
    this.estado.set('pronto');
  }

  protected async duplicar(painel: PainelDeIndicadores): Promise<void> {
    try {
      const copia = await this.api.duplicar(painel.id);
      this.avisos.sucesso('Painel duplicado.');
      void this.roteador.navigate(['/bi/indicadores', copia.id]);
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  protected async excluir(painel: PainelDeIndicadores): Promise<void> {
    const confirmado = await this.confirmacao.confirmar({
      titulo: `Excluir "${painel.nome}"?`,
      mensagem:
        'O painel deixa de aparecer para todos com quem foi compartilhado. Os dados do CRM não mudam.',
      confirmar: 'Excluir',
      perigo: true,
      executar: () => this.api.excluir(painel.id),
    });
    if (confirmado) {
      this.avisos.sucesso('Painel excluído.');
      if (this.id()) {
        void this.roteador.navigate(['/bi/indicadores']);
      } else {
        void this.carregarLista();
      }
    }
  }

  // Painel -----------------------------------------------------------------------------

  private async abrirPainel(id: string): Promise<void> {
    this.estado.set('carregando');
    this.erro.set(null);
    this.resultado.set(null);
    try {
      const painel = await this.api.painel(id);
      this.filtros.set(painel.filtrosPadrao);
      this.painel.set(painel);
      this.estado.set('pronto');
    } catch (falha) {
      const erro = erroDaApi(falha);
      this.erro.set(erro);
      this.painel.set(null);
      this.estado.set(erro.ehSemPermissao || erro.status === 404 ? 'sem-acesso' : 'erro');
    }
  }

  protected async calcular(
    painel: PainelDeIndicadores,
    filtros: FiltrosDoIndicador,
    semCache = false,
  ): Promise<void> {
    const consulta = ++this.consulta;
    this.atualizando.set(true);
    try {
      const resposta = await this.api.calcular(
        { painelId: painel.id, filtros: filtrosEscolhidos(filtros, painel.filtrosPadrao) },
        semCache,
      );
      if (consulta === this.consulta) {
        this.resultado.set(resposta);
        this.erro.set(null);
      }
    } catch (falha) {
      if (consulta === this.consulta) {
        this.resultado.set(null);
        this.erro.set(erroDaApi(falha));
      }
    } finally {
      if (consulta === this.consulta) {
        this.atualizando.set(false);
      }
    }
  }

  protected atualizar(): void {
    const painel = this.painel();
    if (painel && this.periodoOk()) {
      void this.calcular(painel, this.filtros(), true);
    }
  }

  protected aoSalvar(painel: PainelDeIndicadores): void {
    this.modo.set('ver');
    if (this.id() === painel.id) {
      this.filtros.set(painel.filtrosPadrao);
      this.painel.set(painel);
    } else {
      void this.roteador.navigate(['/bi/indicadores', painel.id]);
    }
  }

  protected aoCompartilhar(painel: PainelDeIndicadores): void {
    this.painel.set(painel);
  }

  protected abrirLista(destino: DestinoDaLista): void {
    void this.roteador.navigate([...destino.comandos], { queryParams: destino.consulta });
  }

  protected async exportar(formato: FormatoExportacao): Promise<void> {
    const painel = this.painel();
    if (!painel || this.exportando()) {
      return;
    }
    this.exportando.set(formato);
    try {
      const arquivo = await this.api.exportar(
        { painelId: painel.id, filtros: this.filtros() },
        formato,
      );
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

  protected tentarDeNovo(): void {
    if (this.id()) {
      void this.abrirPainel(this.id()!);
    } else {
      void this.carregarLista();
    }
  }

  protected setorDaPessoa(): string | null {
    return this.sessao.area();
  }
}
