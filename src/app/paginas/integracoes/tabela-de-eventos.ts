import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { LucidePlus, LucideX } from '@lucide/angular';

import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { CampoTexto, type ValorCampoTexto } from '../../ui/campo-texto/campo-texto';
import { Dica } from '../../ui/dica/dica';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import {
  type AcaoDoEvento,
  ACOES_DO_EVENTO,
  aplicarModelo,
  type DefinicaoDeEvento,
  type EventosDoAplicativo,
  type GrupoDeEvento,
  listaDoTexto,
  modeloDaTabela,
  ORDEM_DOS_GRUPOS,
  type RegraDoEvento,
  ROTULO_ACAO_DO_EVENTO,
  ROTULO_GRUPO_DE_EVENTO,
  type TabelaDeEventos,
} from './eventos.tipos';

interface GrupoDaTabela {
  readonly codigo: GrupoDeEvento | 'OUTROS';
  readonly titulo: string;
  readonly linhas: readonly LinhaDaTabela[];
}

interface LinhaDaTabela {
  readonly codigo: string;
  readonly nome: string;
  readonly descricao: string;
  /** Código que a plataforma não lista: o Admin o acrescentou e pode removê-lo. */
  readonly extra: boolean;
  readonly regra: RegraDoEvento;
}

const OPCOES_ACAO: readonly OpcaoSeletor<AcaoDoEvento>[] = ACOES_DO_EVENTO.map((acao) => ({
  valor: acao,
  rotulo: ROTULO_ACAO_DO_EVENTO[acao],
}));

/**
 * Tabela de eventos de uma plataforma de curso (REGRAS-DE-NEGOCIO R32.15): cada evento tem um
 * nome amigável e uma ação (ignorar, abrir na etapa X, ganho com valor, perdido com motivo ou só
 * etiquetar), mais etiquetas. Começa por um modelo pronto; o resto é ajuste fino. O filtro de
 * produtos é opcional.
 */
@Component({
  selector: 'app-tabela-de-eventos',
  imports: [Botao, BotaoIcone, CampoTexto, Dica, GrupoOpcoes, Seletor],
  templateUrl: './tabela-de-eventos.html',
  styleUrl: './tabela-de-eventos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabelaDeEventosPasso {
  readonly eventos = input.required<EventosDoAplicativo>();
  /** Etapas abertas do funil da integração (para a ação "Abrir negócio"). */
  readonly etapas = input<readonly OpcaoSeletor<string>[]>([]);
  readonly funilNome = input<string | null>(null);
  readonly tabela = model.required<TabelaDeEventos>();
  /** O filtro de produtos, em texto (separado por vírgula). */
  readonly produtos = model('');

  protected readonly opcoesAcao = OPCOES_ACAO;
  protected readonly icones = { adicionar: LucidePlus, remover: LucideX };
  protected readonly novoCodigo = signal('');
  protected readonly erroDoCodigo = signal<string | null>(null);
  /** O que está sendo digitado nas etiquetas (a vírgula no fim não pode sumir enquanto digita). */
  private readonly textosDeEtiqueta = signal<Readonly<Record<string, string>>>({});

  protected readonly opcoesModelo = computed<readonly OpcaoGrupo<string>[]>(() =>
    this.eventos().modelos.map((m) => ({ valor: m.codigo, rotulo: m.nome, dica: m.descricao })),
  );
  protected readonly modeloAtual = computed(() => modeloDaTabela(this.eventos(), this.tabela()));
  protected readonly nomeDoModelo = computed(
    () => this.eventos().modelos.find((m) => m.codigo === this.modeloAtual())?.nome ?? null,
  );

  protected readonly grupos = computed<readonly GrupoDaTabela[]>(() => {
    const tabela = this.tabela();
    const conhecidos = new Map<string, DefinicaoDeEvento>(
      this.eventos().eventos.map((e) => [e.codigo, e]),
    );
    const grupos: GrupoDaTabela[] = [];
    for (const codigoDoGrupo of ORDEM_DOS_GRUPOS) {
      const linhas = this.eventos()
        .eventos.filter((e) => e.grupo === codigoDoGrupo)
        .map<LinhaDaTabela>((e) => ({
          codigo: e.codigo,
          nome: e.nome,
          descricao: e.descricao,
          extra: false,
          regra: tabela[e.codigo] ?? e.padrao,
        }));
      if (linhas.length) {
        grupos.push({
          codigo: codigoDoGrupo,
          titulo: ROTULO_GRUPO_DE_EVENTO[codigoDoGrupo],
          linhas,
        });
      }
    }
    const outros = Object.entries(tabela)
      .filter(([codigo]) => !conhecidos.has(codigo))
      .map<LinhaDaTabela>(([codigo, regra]) => ({
        codigo,
        nome: codigo,
        descricao: 'Evento que você acrescentou: use o código exatamente como a plataforma envia.',
        extra: true,
        regra,
      }));
    if (outros.length) {
      grupos.push({ codigo: 'OUTROS', titulo: 'Outros eventos', linhas: outros });
    }
    return grupos;
  });

  protected escolherModelo(codigo: string | null): void {
    const modelo = this.eventos().modelos.find((m) => m.codigo === codigo);
    if (!modelo) {
      return;
    }
    this.textosDeEtiqueta.set({});
    this.tabela.set(aplicarModelo(this.eventos(), modelo, this.tabela()));
  }

  protected acao(codigo: string, acao: AcaoDoEvento | null): void {
    if (!acao) {
      return;
    }
    this.mudar(codigo, { acao });
  }

  protected etapa(codigo: string, etapaId: string | null): void {
    this.mudar(codigo, { etapaId });
  }

  protected motivo(codigo: string, valor: ValorCampoTexto): void {
    this.mudar(codigo, { motivoPerda: String(valor ?? '') });
  }

  protected etiquetas(codigo: string, valor: ValorCampoTexto): void {
    const texto = String(valor ?? '');
    this.textosDeEtiqueta.update((atual) => ({ ...atual, [codigo]: texto }));
    this.mudar(codigo, { etiquetas: listaDoTexto(texto) });
  }

  protected textoDasEtiquetas(linha: LinhaDaTabela): string {
    return this.textosDeEtiqueta()[linha.codigo] ?? (linha.regra.etiquetas ?? []).join(', ');
  }

  protected adicionarEvento(): void {
    const codigo = this.novoCodigo().trim();
    if (!codigo) {
      this.erroDoCodigo.set('Digite o código do evento, como a plataforma envia.');
      return;
    }
    if (codigo in this.tabela()) {
      this.erroDoCodigo.set('Esse evento já está na tabela.');
      return;
    }
    this.erroDoCodigo.set(null);
    this.novoCodigo.set('');
    this.tabela.update((atual) => ({ ...atual, [codigo]: { acao: 'IGNORAR', etiquetas: [] } }));
  }

  protected removerEvento(codigo: string): void {
    this.tabela.update((atual) => {
      const { [codigo]: _removido, ...resto } = atual;
      return resto;
    });
  }

  protected rotuloDaAcao(acao: AcaoDoEvento): string {
    return ROTULO_ACAO_DO_EVENTO[acao];
  }

  private mudar(codigo: string, mudanca: Partial<RegraDoEvento>): void {
    this.tabela.update((atual) => ({
      ...atual,
      [codigo]: { ...(atual[codigo] ?? { acao: 'IGNORAR' }), ...mudanca },
    }));
  }
}
