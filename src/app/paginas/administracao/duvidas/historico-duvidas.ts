import { numeroCurtoDoChamado } from '../../../layout/ajuda/numero-chamado';
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
import { LucideDownload } from '@lucide/angular';

import { POR_PAGINA_PADRAO, type Pagina } from '../../../nucleo/api/api';
import { erroDaApi, type ErroApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { formatarTempoRelativo, formatarDataHora } from '../../../nucleo/formatos';
import { ROTULO_PAPEL } from '../../../nucleo/papeis';
import { AREAS, ROTULO_AREA } from '../../../nucleo/sessao/perfil';
import {
  ROTULO_CATEGORIA,
  type AvaliacaoFiltro,
  type CategoriaAssistente,
  type PerguntaDoHistorico,
} from '../../../layout/ajuda/ajuda.tipos';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { CampoBusca } from '../../../ui/campo-busca/campo-busca';
import { CampoData } from '../../../ui/campo-data/campo-data';
import { CampoTexto } from '../../../ui/campo-texto/campo-texto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { Paginacao } from '../../../ui/paginacao/paginacao';
import { Seletor, type OpcaoSeletor } from '../../../ui/seletor/seletor';
import { Selo, type VarianteSelo } from '../../../ui/selo/selo';
import { CelulaTabela } from '../../../ui/tabela/celula-tabela';
import { Tabela, type ColunaTabela } from '../../../ui/tabela/tabela';
import { BiApi } from '../../bi/bi.api';
import type { FormatoExportacao } from '../../bi/bi.tipos';
import { DetalheConversaDuvida } from './detalhe-conversa';
import { DuvidasApi } from './duvidas.api';

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'quando', rotulo: 'Quando', largura: '8rem' },
  { id: 'usuario', rotulo: 'Pessoa', largura: '11rem' },
  { id: 'pergunta', rotulo: 'Pergunta' },
  { id: 'categoria', rotulo: 'Tipo', largura: '10rem' },
  { id: 'resolvido', rotulo: 'Resolvida', largura: '7rem' },
  { id: 'avaliacao', rotulo: 'Avaliação', largura: '8rem' },
  { id: 'chamado', rotulo: 'Chamado', largura: '8rem' },
];

const SIM_NAO: readonly OpcaoSeletor<'sim' | 'nao'>[] = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
];

const SELO_CATEGORIA: Readonly<Record<CategoriaAssistente, VarianteSelo>> = {
  duvida_de_uso: 'neutro',
  funcionalidade_inexistente_no_escopo: 'lima',
  fora_do_escopo: 'contorno',
  erro_do_sistema: 'coral',
};

/**
 * Histórico de dúvidas (só Admin): todas as perguntas feitas ao assistente, com filtros por
 * período, tipo, área, pessoa, módulo, resolvida, avaliação, chamado e texto; abrir uma linha
 * mostra a conversa; a lista filtrada pode ser exportada (CSV ou planilha).
 */
@Component({
  selector: 'app-historico-duvidas',
  imports: [
    Botao,
    CampoBusca,
    CampoData,
    CampoTexto,
    Cartao,
    CelulaTabela,
    DetalheConversaDuvida,
    EstadoVazio,
    Paginacao,
    Seletor,
    Selo,
    Tabela,
  ],
  templateUrl: './historico-duvidas.html',
  styleUrl: './duvidas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoricoDuvidas {
  protected readonly numeroCurto = numeroCurtoDoChamado;
  private readonly api = inject(DuvidasApi);
  private readonly biApi = inject(BiApi);
  private readonly avisos = inject(AvisosService);
  private readonly documento = inject(DOCUMENT);

  /** Filtros que vêm da aba "Temas" (a aba é recriada ao trocar). */
  readonly modulo0 = input<string | null>(null, { alias: 'modulo' });
  readonly categoria0 = input<CategoriaAssistente | null>(null, { alias: 'categoria' });
  readonly resolvido0 = input<boolean | null>(null, { alias: 'resolvido' });

  protected readonly icones = { baixar: LucideDownload };
  protected readonly colunas = COLUNAS;
  protected readonly porPagina = POR_PAGINA_PADRAO;
  protected readonly rotuloPapel = ROTULO_PAPEL;
  protected readonly rotuloCategoria = ROTULO_CATEGORIA;
  protected readonly simNao = SIM_NAO;

  protected readonly opcoesCategoria: readonly OpcaoSeletor<CategoriaAssistente>[] = (
    Object.keys(ROTULO_CATEGORIA) as CategoriaAssistente[]
  ).map((valor) => ({ valor, rotulo: ROTULO_CATEGORIA[valor] }));
  protected readonly opcoesArea: readonly OpcaoSeletor<string>[] = [
    ...AREAS.map((a) => ({ valor: a, rotulo: ROTULO_AREA[a] })),
    { valor: 'SEM_AREA', rotulo: 'Sem área' },
  ];
  protected readonly opcoesAvaliacao: readonly OpcaoSeletor<AvaliacaoFiltro>[] = [
    { valor: 'UTIL', rotulo: 'Útil' },
    { valor: 'NAO_UTIL', rotulo: 'Não útil' },
    { valor: 'SEM_AVALIACAO', rotulo: 'Sem avaliação' },
  ];
  protected readonly opcoesPessoa = signal<readonly OpcaoSeletor<string>[]>([]);

  protected readonly busca = signal('');
  protected readonly de = signal<string | null>(null);
  protected readonly ate = signal<string | null>(null);
  protected readonly categoria = signal<CategoriaAssistente | null>(null);
  protected readonly area = signal<string | null>(null);
  protected readonly usuarioId = signal<string | null>(null);
  protected readonly modulo = signal<string | number>('');
  protected readonly resolvido = signal<'sim' | 'nao' | null>(null);
  protected readonly avaliacao = signal<AvaliacaoFiltro | null>(null);
  protected readonly comChamado = signal<'sim' | 'nao' | null>(null);
  protected readonly pagina = signal(1);

  protected readonly lista = signal<Pagina<PerguntaDoHistorico> | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly exportando = signal<FormatoExportacao | null>(null);
  protected readonly conversaAberta = signal<string | null>(null);
  protected readonly detalheAberto = signal(false);
  private consulta = 0;

  protected readonly itens = computed(() => this.lista()?.itens ?? []);
  protected readonly filtrado = computed(
    () =>
      this.busca().trim() !== '' ||
      this.de() !== null ||
      this.ate() !== null ||
      this.categoria() !== null ||
      this.area() !== null ||
      this.usuarioId() !== null ||
      String(this.modulo()).trim() !== '' ||
      this.resolvido() !== null ||
      this.avaliacao() !== null ||
      this.comChamado() !== null,
  );
  private readonly filtros = computed(() => ({
    de: this.de(),
    ate: this.ate(),
    categoria: this.categoria(),
    area: this.area(),
    usuarioId: this.usuarioId(),
    modulo: String(this.modulo()),
    resolvido: this.resolvido() === null ? null : this.resolvido() === 'sim',
    avaliacao: this.avaliacao(),
    comChamado: this.comChamado() === null ? null : this.comChamado() === 'sim',
    busca: this.busca(),
  }));

  constructor() {
    void this.carregarPessoas();
    // Filtros que vieram de fora entram uma vez.
    effect(() => {
      const modulo = this.modulo0();
      const categoria = this.categoria0();
      const resolvido = this.resolvido0();
      untracked(() => {
        if (modulo) {
          this.modulo.set(modulo);
        }
        if (categoria) {
          this.categoria.set(categoria);
        }
        if (resolvido !== null) {
          this.resolvido.set(resolvido ? 'sim' : 'nao');
        }
      });
    });
    effect(() => {
      const filtros = { ...this.filtros(), pagina: this.pagina(), porPagina: this.porPagina };
      untracked(() => void this.carregar(filtros));
    });
  }

  private async carregarPessoas(): Promise<void> {
    const pessoas = await this.biApi.pessoas();
    this.opcoesPessoa.set(pessoas.map((p) => ({ valor: p.id, rotulo: p.nome })));
  }

  protected async carregar(
    filtros = { ...this.filtros(), pagina: this.pagina(), porPagina: this.porPagina },
  ): Promise<void> {
    const consulta = ++this.consulta;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const lista = await this.api.historico(filtros);
      if (consulta === this.consulta) {
        this.lista.set(lista);
      }
    } catch (falha) {
      if (consulta === this.consulta) {
        this.erro.set(erroDaApi(falha));
        this.lista.set(null);
      }
    } finally {
      if (consulta === this.consulta) {
        this.carregando.set(false);
      }
    }
  }

  protected mudou(): void {
    this.pagina.set(1);
  }

  protected buscar(texto: string): void {
    this.busca.set(texto);
    this.mudou();
  }

  /** O "x" do campo limpa a busca sem Enter. */
  protected aoDigitarBusca(texto: string): void {
    if (texto === '' && this.busca() !== '') {
      this.buscar('');
    }
  }

  protected limpar(): void {
    this.busca.set('');
    this.de.set(null);
    this.ate.set(null);
    this.categoria.set(null);
    this.area.set(null);
    this.usuarioId.set(null);
    this.modulo.set('');
    this.resolvido.set(null);
    this.avaliacao.set(null);
    this.comChamado.set(null);
    this.pagina.set(1);
  }

  protected abrir(item: PerguntaDoHistorico): void {
    this.conversaAberta.set(item.conversaId);
    this.detalheAberto.set(true);
  }

  protected quando(valor: string): string {
    return formatarTempoRelativo(valor);
  }
  protected dataHora(valor: string): string {
    return formatarDataHora(valor);
  }
  protected seloCategoria(c: CategoriaAssistente): VarianteSelo {
    return SELO_CATEGORIA[c];
  }

  protected async exportar(formato: FormatoExportacao): Promise<void> {
    if (this.exportando()) {
      return;
    }
    this.exportando.set(formato);
    try {
      const arquivo = await this.api.exportar(this.filtros(), formato);
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
