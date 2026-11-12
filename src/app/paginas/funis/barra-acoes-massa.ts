import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { CampoData, localParaIso } from '../../ui/campo-data/campo-data';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { type ItemMenuAcoes, MenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { Modal } from '../../ui/modal/modal';
import { EscolherResponsavel } from './escolher-responsavel';
import { EstadoQuadro, type OpcaoResponsavel } from './estado-quadro';
import type { FalhaEmMassa, PedidoEmMassa, ResultadoEmMassa, TipoAtividade } from './funis.tipos';
import { ROTULO_TIPO_ATIVIDADE } from './linha-do-tempo-negocio';
import { MotivoPerda } from './motivo-perda';

/** Tipos que dá para criar em massa (a reunião pede início e fim: só pelo negócio). */
const TIPOS_EM_MASSA: readonly TipoAtividade[] = ['TAREFA', 'LIGACAO', 'EMAIL', 'WHATSAPP', 'NOTA'];

/** Ação que espera o motivo da perda. */
type Pendente = { readonly acao: 'PERDER' } | { readonly acao: 'MOVER'; readonly etapaId: string };

export function textoDeNegocios(quantos: number): string {
  return `${quantos} ${quantos === 1 ? 'negócio' : 'negócios'}`;
}

/** "12 de 14 negócios atualizados" (e a frase quando nada deu certo). */
export function resumoDoResultado(resultado: Pick<ResultadoEmMassa, 'total' | 'sucesso'>): string {
  if (resultado.sucesso === 0) {
    return `Nenhum negócio foi atualizado (${resultado.total}).`;
  }
  if (resultado.sucesso === resultado.total) {
    return resultado.total === 1
      ? '1 negócio atualizado.'
      : `${resultado.total} negócios atualizados.`;
  }
  return `${resultado.sucesso} de ${resultado.total} negócios atualizados.`;
}

/**
 * Barra de ações em massa do quadro (R5.16): aparece no modo seleção, no rodapé, com a
 * contagem e as ações — Mover para etapa, Trocar responsável, Ganho, Perdido (pede o motivo),
 * Etiquetas, Criar atividade e Excluir (só quem configura o funil). Cada ação vai à API, que
 * passa cada negócio pelas regras de sempre: o sucesso é parcial e as falhas aparecem numa
 * lista (título e motivo). Ações indisponíveis ficam com `aria-disabled` e a dica do porquê.
 */
@Component({
  selector: 'app-barra-acoes-massa',
  imports: [
    AreaTexto,
    Botao,
    CampoData,
    CampoTexto,
    EscolherResponsavel,
    GrupoOpcoes,
    MenuAcoes,
    Modal,
    MotivoPerda,
  ],
  template: `
    <section class="barra" aria-label="Ações em massa">
      <p class="barra__contagem" role="status" aria-live="polite">
        @if (quantos() === 0) {
          Nenhum selecionado. Marque os cartões.
        } @else {
          <strong class="numeros">{{ quantos() }}</strong>
          {{ quantos() === 1 ? 'selecionado' : 'selecionados' }}
        }
      </p>

      <div class="barra__acoes">
        <app-menu-acoes
          texto="Mover para etapa…"
          rotulo="Mover para etapa"
          variante="contorno"
          tamanho="sm"
          [itens]="itensEtapas()"
          (escolher)="moverPara($event)"
        />
        <button
          appBotao
          type="button"
          variante="contorno"
          tamanho="sm"
          [disabled]="!!indisponivel()"
          [attr.title]="indisponivel()"
          (click)="se(!indisponivel(), abrirResponsavel)"
        >
          Trocar responsável…
        </button>
        <button
          appBotao
          type="button"
          variante="contorno"
          tamanho="sm"
          [disabled]="!!indisponivel()"
          [attr.title]="indisponivel()"
          (click)="se(!indisponivel(), ganhar)"
        >
          Ganho
        </button>
        <button
          appBotao
          type="button"
          variante="contorno"
          tamanho="sm"
          [disabled]="!!indisponivel()"
          [attr.title]="indisponivel()"
          (click)="se(!indisponivel(), perder)"
        >
          {{ rotuloPerdido() }}
        </button>
        <app-menu-acoes
          texto="Etiquetas"
          rotulo="Etiquetas dos contatos"
          variante="contorno"
          tamanho="sm"
          [itens]="itensEtiquetas()"
          (escolher)="abrirEtiquetas($event)"
        />
        <button
          appBotao
          type="button"
          variante="contorno"
          tamanho="sm"
          [disabled]="!!indisponivel()"
          [attr.title]="indisponivel()"
          (click)="se(!indisponivel(), abrirAtividade)"
        >
          Criar atividade…
        </button>
        <button
          appBotao
          type="button"
          variante="contorno"
          tamanho="sm"
          class="barra__excluir"
          [disabled]="!!indisponivelExcluir()"
          [attr.title]="indisponivelExcluir()"
          (click)="se(!indisponivelExcluir(), excluir)"
        >
          Excluir
        </button>
      </div>

      <button appBotao type="button" variante="invertido" tamanho="sm" (click)="cancelar()">
        Cancelar
      </button>
      @if (dica(); as texto) {
        <p class="barra__dica" role="note">{{ texto }}</p>
      }
    </section>

    <app-escolher-responsavel
      [(aberto)]="responsavelAberto"
      titulo="Trocar responsável"
      [frase]="'Quem passa a cuidar de ' + textoSelecionados() + '.'"
      [opcoes]="opcoesResponsavel()"
      [atualId]="null"
      (escolhido)="trocarResponsavel($event)"
    />

    <app-motivo-perda
      [aberto]="!!pendente()"
      [negocio]="'os ' + textoSelecionados()"
      [etapa]="null"
      [titulo]="marketing() ? 'Por que descartar?' : 'Por que perdemos?'"
      [rotuloConfirmar]="marketing() ? 'Descartar' : 'Marcar como perdido'"
      (confirmado)="confirmarMotivo($event)"
      (cancelado)="pendente.set(null)"
    />

    <app-modal
      [(aberto)]="etiquetasAberto"
      [titulo]="modoEtiqueta() === 'ETIQUETAR' ? 'Adicionar etiquetas' : 'Remover etiquetas'"
      largura="sm"
    >
      <form
        class="formulario"
        id="form-etiquetas-em-massa"
        (submit)="$event.preventDefault(); confirmarEtiquetas()"
      >
        <p class="formulario__frase">
          As etiquetas ficam nos contatos de {{ textoSelecionados() }}: o negócio não tem etiqueta
          própria.
        </p>
        <app-campo-texto
          rotulo="Etiquetas"
          ajuda="Separe com vírgula."
          placeholder="Ex.: VIP, Indicação"
          [erro]="erroEtiquetas()"
          [(valor)]="textoEtiquetas"
        />
        @if (sugestoes().length) {
          <ul class="formulario__sugestoes" aria-label="Etiquetas em uso">
            @for (etiqueta of sugestoes(); track etiqueta) {
              <li>
                <button
                  type="button"
                  class="sugestao"
                  [attr.aria-pressed]="etiquetasEscolhidas().includes(etiqueta)"
                  (click)="alternarSugestao(etiqueta)"
                >
                  {{ etiqueta }}
                </button>
              </li>
            }
          </ul>
        }
      </form>
      <div modal-rodape class="formulario__acoes">
        <button appBotao type="button" variante="contorno" (click)="etiquetasAberto.set(false)">
          Cancelar
        </button>
        <button
          appBotao
          type="submit"
          form="form-etiquetas-em-massa"
          variante="invertido"
          [carregando]="executando()"
        >
          {{ modoEtiqueta() === 'ETIQUETAR' ? 'Adicionar' : 'Remover' }}
        </button>
      </div>
    </app-modal>

    <app-modal [(aberto)]="atividadeAberta" titulo="Criar atividade" largura="sm">
      <form
        class="formulario"
        id="form-atividade-em-massa"
        (submit)="$event.preventDefault(); confirmarAtividade()"
      >
        <p class="formulario__frase">
          Uma atividade para cada um dos {{ textoSelecionados() }}, para o responsável do negócio
          (sem responsável, para você).
        </p>
        <app-grupo-opcoes
          rotulo="Tipo"
          disposicao="pilulas"
          [opcoes]="tiposAtividade"
          [(valor)]="tipoAtividade"
        />
        <app-campo-texto
          rotulo="Título"
          obrigatorio
          [maximoCaracteres]="200"
          [erro]="erroAtividade()"
          [(valor)]="tituloAtividade"
        />
        @if (tipoAtividade() !== 'NOTA') {
          <app-campo-data rotulo="Vence em" tipo="data-hora" opcional [(valor)]="venceAtividade" />
        }
        <app-area-texto
          rotulo="Descrição (opcional)"
          [linhas]="2"
          [maximoCaracteres]="5000"
          [(valor)]="descricaoAtividade"
        />
      </form>
      <div modal-rodape class="formulario__acoes">
        <button appBotao type="button" variante="contorno" (click)="atividadeAberta.set(false)">
          Cancelar
        </button>
        <button
          appBotao
          type="submit"
          form="form-atividade-em-massa"
          variante="invertido"
          [carregando]="executando()"
        >
          Criar {{ quantos() === 1 ? 'atividade' : quantos() + ' atividades' }}
        </button>
      </div>
    </app-modal>

    <app-modal [(aberto)]="falhasAbertas" [titulo]="tituloDoResultado()" largura="md">
      <div class="formulario">
        <p class="formulario__frase">
          O que deu certo já foi feito. Estes negócios continuam marcados, para você tentar de novo
          ou ajustar:
        </p>
        <ul class="falhas" aria-label="Negócios que não foram atualizados">
          @for (falha of falhas(); track falha.negocioId) {
            <li class="falha">
              <strong class="falha__titulo">{{
                falha.titulo ?? 'Negócio que você não vê mais'
              }}</strong>
              <span class="falha__motivo">{{ falha.mensagem }}</span>
            </li>
          }
        </ul>
      </div>
      <div modal-rodape class="formulario__acoes">
        <button appBotao type="button" variante="invertido" (click)="falhasAbertas.set(false)">
          Entendi
        </button>
      </div>
    </app-modal>
  `,
  styleUrl: './barra-acoes-massa.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarraAcoesMassa {
  private readonly estado = inject(EstadoQuadro);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);

  protected readonly quantos = computed(() => this.estado.selecionados().length);
  protected readonly textoSelecionados = computed(() => textoDeNegocios(this.quantos()));
  protected readonly marketing = computed(() => this.estado.area() === 'MARKETING');
  protected readonly rotuloPerdido = computed(() => (this.marketing() ? 'Descartado' : 'Perdido'));
  protected readonly executando = signal(false);

  /** Por que as ações estão indisponíveis (vazio = disponíveis). */
  protected readonly indisponivel = computed<string | null>(() => {
    if (!this.estado.podeAgir()) {
      return 'Você só pode ver este funil: as ações exigem o acesso “Como membro” ou mais.';
    }
    if (this.quantos() === 0) {
      return 'Marque ao menos um negócio.';
    }
    return this.executando() ? 'Aguarde: a ação anterior ainda está rodando.' : null;
  });
  protected readonly indisponivelExcluir = computed<string | null>(() => {
    if (!this.estado.podeConfigurar()) {
      return 'Só quem configura o funil (líder do setor, C-level e Admin) exclui negócios.';
    }
    return this.indisponivel();
  });

  /** A dica do que está indisponível e por quê (os botões desabilitados também levam no `title`). */
  protected readonly dica = computed<string | null>(() => {
    const geral = this.indisponivel();
    if (geral && this.quantos() > 0 && !this.executando()) {
      return geral;
    }
    return this.quantos() > 0 ? this.indisponivelExcluir() : null;
  });

  protected readonly itensEtapas = computed<ItemMenuAcoes[]>(() => {
    const motivo = this.indisponivel() ?? undefined;
    return this.estado.etapas().map((etapa) => ({
      id: etapa.id,
      rotulo: etapa.nome,
      desabilitado: !!motivo,
      motivo,
    }));
  });
  protected readonly itensEtiquetas = computed<ItemMenuAcoes[]>(() => {
    const motivo = this.indisponivel() ?? undefined;
    return [
      { id: 'ETIQUETAR', rotulo: 'Adicionar etiquetas…', desabilitado: !!motivo, motivo },
      { id: 'DESETIQUETAR', rotulo: 'Remover etiquetas…', desabilitado: !!motivo, motivo },
    ];
  });

  // Trocar responsável
  protected readonly responsavelAberto = signal(false);
  protected readonly opcoesResponsavel = computed<readonly OpcaoResponsavel[]>(() =>
    this.estado.opcoesDeResponsavel(null),
  );

  // Perdido / mover para etapa de perda
  protected readonly pendente = signal<Pendente | null>(null);

  // Etiquetas
  protected readonly etiquetasAberto = signal(false);
  protected readonly modoEtiqueta = signal<'ETIQUETAR' | 'DESETIQUETAR'>('ETIQUETAR');
  protected readonly textoEtiquetas = signal<string | number | null>('');
  protected readonly erroEtiquetas = signal<string | null>(null);
  protected readonly sugestoes = computed(() => this.estado.etiquetas());
  protected readonly etiquetasEscolhidas = computed(() =>
    lerEtiquetas(String(this.textoEtiquetas() ?? '')),
  );

  // Atividade
  protected readonly atividadeAberta = signal(false);
  protected readonly tiposAtividade: OpcaoGrupo<TipoAtividade>[] = TIPOS_EM_MASSA.map((tipo) => ({
    valor: tipo,
    rotulo: ROTULO_TIPO_ATIVIDADE[tipo],
  }));
  protected readonly tipoAtividade = signal<TipoAtividade | null>('TAREFA');
  protected readonly tituloAtividade = signal<string | number | null>('');
  protected readonly venceAtividade = signal<string | null>(null);
  protected readonly descricaoAtividade = signal('');
  protected readonly erroAtividade = signal<string | null>(null);

  // Resultado com falhas
  protected readonly falhasAbertas = signal(false);
  protected readonly falhas = signal<readonly FalhaEmMassa[]>([]);
  protected readonly tituloDoResultado = signal('Alguns negócios não foram atualizados');

  /** Executa `acao` só se estiver disponível (os botões usam `aria-disabled`, não `disabled`). */
  protected se(disponivel: boolean, acao: () => void): void {
    if (disponivel) {
      acao.call(this);
    }
  }

  protected cancelar(): void {
    this.estado.sairDaSelecao();
  }

  // Mover ---------------------------------------------------------------------------------

  protected moverPara(item: ItemMenuAcoes): void {
    if (this.indisponivel()) {
      return;
    }
    const etapa = this.estado.etapas().find((candidata) => candidata.id === item.id);
    if (!etapa) {
      return;
    }
    if (etapa.tipo === 'PERDIDO') {
      this.pendente.set({ acao: 'MOVER', etapaId: etapa.id });
      return;
    }
    void this.enviar({ acao: 'MOVER', dados: { etapaId: etapa.id } });
  }

  // Responsável ---------------------------------------------------------------------------

  protected readonly abrirResponsavel = (): void => {
    void this.estado.carregarUsuarios().catch(() => undefined);
    this.responsavelAberto.set(true);
  };

  protected trocarResponsavel(opcao: OpcaoResponsavel | null): void {
    void this.enviar({ acao: 'RESPONSAVEL', dados: { responsavelId: opcao?.id ?? null } });
  }

  // Ganho e perdido -----------------------------------------------------------------------

  protected readonly ganhar = (): void => {
    void this.enviar({ acao: 'GANHAR' });
  };

  protected readonly perder = (): void => {
    this.pendente.set({ acao: 'PERDER' });
  };

  protected confirmarMotivo(motivo: string): void {
    const pendente = this.pendente();
    this.pendente.set(null);
    if (!pendente) {
      return;
    }
    void this.enviar(
      pendente.acao === 'PERDER'
        ? { acao: 'PERDER', dados: { motivoPerda: motivo } }
        : { acao: 'MOVER', dados: { etapaId: pendente.etapaId, motivoPerda: motivo } },
    );
  }

  // Etiquetas -----------------------------------------------------------------------------

  protected abrirEtiquetas(item: ItemMenuAcoes): void {
    if (this.indisponivel() || (item.id !== 'ETIQUETAR' && item.id !== 'DESETIQUETAR')) {
      return;
    }
    this.modoEtiqueta.set(item.id);
    this.textoEtiquetas.set('');
    this.erroEtiquetas.set(null);
    this.etiquetasAberto.set(true);
  }

  protected alternarSugestao(etiqueta: string): void {
    const atuais = this.etiquetasEscolhidas();
    const novas = atuais.includes(etiqueta)
      ? atuais.filter((item) => item !== etiqueta)
      : [...atuais, etiqueta];
    this.textoEtiquetas.set(novas.join(', '));
  }

  protected confirmarEtiquetas(): void {
    const etiquetas = this.etiquetasEscolhidas();
    if (!etiquetas.length) {
      this.erroEtiquetas.set('Informe ao menos uma etiqueta.');
      return;
    }
    this.etiquetasAberto.set(false);
    void this.enviar({ acao: this.modoEtiqueta(), dados: { etiquetas } });
  }

  // Atividade -----------------------------------------------------------------------------

  protected readonly abrirAtividade = (): void => {
    this.tipoAtividade.set('TAREFA');
    this.tituloAtividade.set('');
    this.venceAtividade.set(null);
    this.descricaoAtividade.set('');
    this.erroAtividade.set(null);
    this.atividadeAberta.set(true);
  };

  protected confirmarAtividade(): void {
    const titulo = String(this.tituloAtividade() ?? '').trim();
    const tipo = this.tipoAtividade();
    if (!titulo || !tipo) {
      this.erroAtividade.set('Informe o título da atividade.');
      return;
    }
    const vencimento = tipo === 'NOTA' ? null : localParaIso(this.venceAtividade(), 'data-hora');
    const descricao = this.descricaoAtividade().trim();
    this.atividadeAberta.set(false);
    void this.enviar({
      acao: 'ATIVIDADE',
      dados: {
        tipo,
        titulo,
        ...(vencimento ? { vencimento } : {}),
        ...(descricao ? { descricao } : {}),
      },
    });
  }

  // Excluir -------------------------------------------------------------------------------

  protected readonly excluir = async (): Promise<void> => {
    const quantos = this.quantos();
    const confirmou = await this.confirmacao.confirmar({
      titulo: `Excluir ${textoDeNegocios(quantos)}?`,
      mensagem: `${textoDeNegocios(quantos)} saem do quadro e das listas. Os contatos e o histórico ficam.`,
      confirmar: `Excluir ${textoDeNegocios(quantos)}`,
      perigo: true,
    });
    if (confirmou) {
      await this.enviar({ acao: 'EXCLUIR' });
    }
  };

  // Envio ---------------------------------------------------------------------------------

  private async enviar(parcial: Omit<PedidoEmMassa, 'negocioIds'>): Promise<void> {
    const ids = this.estado.selecionados().map((negocio) => negocio.id);
    if (!ids.length || this.executando()) {
      return;
    }
    this.executando.set(true);
    try {
      const resultado = await this.estado.executarEmMassa({ negocioIds: ids, ...parcial });
      this.mostrarResultado(resultado);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.executando.set(false);
    }
  }

  private mostrarResultado(resultado: ResultadoEmMassa): void {
    const resumo = resumoDoResultado(resultado);
    if (resultado.falhas.length === 0) {
      this.avisos.sucesso(resumo, { chave: 'em-massa' });
      return;
    }
    this.falhas.set(resultado.falhas);
    this.tituloDoResultado.set(resumo.replace(/\.$/, ''));
    this.avisos.atencao(resumo, {
      chave: 'em-massa',
      duracao: 0,
      acao: { rotulo: 'Ver falhas', executar: () => this.falhasAbertas.set(true) },
    });
    this.falhasAbertas.set(true);
  }
}

/** "VIP, vip, Quente" → ["VIP", "Quente"] (sem repetir, sem diferenciar caixa). */
export function lerEtiquetas(texto: string): string[] {
  const vistas = new Set<string>();
  const resultado: string[] = [];
  for (const parte of texto.split(',')) {
    const etiqueta = parte.replace(/\s+/g, ' ').trim();
    const chave = etiqueta.toLocaleLowerCase('pt-BR');
    if (etiqueta && !vistas.has(chave)) {
      vistas.add(chave);
      resultado.push(etiqueta);
    }
  }
  return resultado;
}
