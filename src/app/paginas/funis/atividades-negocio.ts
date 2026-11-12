import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarDataHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { CaixaSelecao } from '../../ui/caixa-selecao/caixa-selecao';
import { CampoData, localParaIso } from '../../ui/campo-data/campo-data';
import { CampoTexto, type ValorCampoTexto } from '../../ui/campo-texto/campo-texto';
import { RESULTADOS } from '../atividades/apresentacao';
import type { ConclusaoDeAtividade } from '../atividades/atividades.api';
import { ResultadoReuniaoModal } from '../atividades/resultado-reuniao';
import { Selo } from '../../ui/selo/selo';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { FunisApi } from './funis.api';
import type { Atividade, TipoAtividade } from './funis.tipos';
import { ROTULO_TIPO_ATIVIDADE } from './linha-do-tempo-negocio';

const TIPOS: readonly TipoAtividade[] = [
  'TAREFA',
  'LIGACAO',
  'REUNIAO',
  'EMAIL',
  'WHATSAPP',
  'NOTA',
];

/** Data da atividade para ordenar (reunião: início; as outras: vencimento; sem data no fim). */
function dataDa(atividade: Atividade): number {
  const quando = atividade.inicioEm ?? atividade.venceEm;
  return quando ? new Date(quando).getTime() : Number.POSITIVE_INFINITY;
}

/** A próxima atividade pendente (a de data mais próxima; atrasadas primeiro). */
export function proximaPendente(atividades: readonly Atividade[]): Atividade | null {
  return (
    [...atividades]
      .filter((atividade) => atividade.status === 'PENDENTE')
      .sort((a, b) => dataDa(a) - dataDa(b))[0] ?? null
  );
}

/**
 * Aba "Atividades" do detalhe do negócio: as pendentes (concluir pela caixa grande, com
 * "Desfazer" no aviso), as concluídas e a criação rápida (tipo, título e data; reunião com
 * início e fim, R6.1; nota já nasce concluída e vai só para a linha do tempo).
 */
@Component({
  selector: 'app-atividades-negocio',
  imports: [
    Botao,
    CaixaSelecao,
    CampoData,
    CampoTexto,
    Esqueleto,
    EstadoVazio,
    GrupoOpcoes,
    ResultadoReuniaoModal,
    Selo,
  ],
  template: `
    <form class="nova" novalidate (submit)="$event.preventDefault(); criar()">
      <h3 class="nova__titulo">Nova atividade</h3>
      <app-grupo-opcoes
        rotulo="Tipo"
        rotuloOculto
        disposicao="pilulas"
        [opcoes]="tipos"
        [(valor)]="tipo"
      />
      <app-campo-texto
        #campoTitulo
        rotulo="O que fazer"
        [placeholder]="exemplo()"
        [maximoCaracteres]="200"
        [erro]="erroTitulo()"
        [(valor)]="titulo"
      />
      @if (tipo() === 'REUNIAO') {
        <div class="nova__linha">
          <app-campo-data
            rotulo="Início"
            tipo="data-hora"
            [erro]="erroInicio()"
            [(valor)]="inicio"
          />
          <app-campo-data rotulo="Fim" tipo="data-hora" [erro]="erroFim()" [(valor)]="fim" />
        </div>
      } @else if (tipo() !== 'NOTA') {
        <app-campo-data rotulo="Vence em" tipo="data-hora" opcional [(valor)]="vence" />
      }
      @if (erroGeral(); as erro) {
        <p class="nova__erro" role="alert">{{ erro }}</p>
      }
      <button
        appBotao
        type="submit"
        variante="contorno"
        class="nova__enviar"
        [carregando]="criando()"
      >
        {{ tipo() === 'NOTA' ? 'Registrar nota' : 'Adicionar atividade' }}
      </button>
    </form>

    @if (carregando() && !atividades().length) {
      <div class="lista" aria-busy="true">
        <p class="visualmente-oculto" role="status">Carregando as atividades…</p>
        @for (linha of [1, 2]; track linha) {
          <app-esqueleto forma="bloco" altura="64px" />
        }
      </div>
    } @else if (erro(); as falha) {
      <app-estado-vazio
        compacto
        variante="erro"
        [falha]="falha"
        titulo="Não conseguimos carregar as atividades"
        [texto]="falha.resumo"
        [codigo]="falha.requisicaoId"
      >
        <button appBotao type="button" variante="contorno" (click)="carregar()">
          Tentar de novo
        </button>
      </app-estado-vazio>
    } @else {
      <section class="grupo" aria-labelledby="atividades-pendentes">
        <h3 class="grupo__titulo" id="atividades-pendentes">
          Pendentes <span class="tom-fraco">· {{ pendentes().length }}</span>
        </h3>
        @if (pendentes().length) {
          <ul class="lista">
            @for (atividade of pendentes(); track atividade.id) {
              <li class="atividade" [class.atividade--atrasada]="atividade.atrasada">
                <app-caixa-selecao
                  tamanho="lg"
                  forma="circulo"
                  rotuloOculto
                  [rotulo]="'Concluir ' + atividade.titulo"
                  [valor]="ocupadas().has(atividade.id) || reuniaoAguardando()?.id === atividade.id"
                  [desabilitado]="ocupadas().has(atividade.id)"
                  (valorChange)="$event && concluir(atividade)"
                />
                <div class="atividade__texto">
                  <p class="atividade__titulo">{{ atividade.titulo }}</p>
                  <p class="atividade__detalhe">
                    {{ rotuloTipo(atividade.tipo) }}
                    @if (quando(atividade); as data) {
                      ·
                      <span
                        [class.atividade__atraso]="
                          atividade.atrasada && !atividade.aguardandoResultado
                        "
                        [title]="dataCompleta(atividade)"
                      >
                        {{
                          atividade.aguardandoResultado
                            ? 'Aguardando resultado · '
                            : atividade.atrasada
                              ? 'Atrasada · '
                              : ''
                        }}{{ data }}
                      </span>
                    }
                    · {{ atividade.responsavel.nome }}
                  </p>
                </div>
              </li>
            }
          </ul>
        } @else {
          <p class="grupo__vazio">Nenhuma atividade pendente. Que tal combinar o próximo passo?</p>
        }
      </section>

      @if (concluidas().length) {
        <section class="grupo" aria-labelledby="atividades-concluidas">
          <h3 class="grupo__titulo" id="atividades-concluidas">
            Concluídas <span class="tom-fraco">· {{ concluidas().length }}</span>
          </h3>
          <ul class="lista">
            @for (atividade of concluidas(); track atividade.id) {
              <li class="atividade atividade--concluida">
                <app-caixa-selecao
                  tamanho="lg"
                  forma="circulo"
                  rotuloOculto
                  [rotulo]="'Reabrir ' + atividade.titulo"
                  [valor]="!ocupadas().has(atividade.id)"
                  [desabilitado]="ocupadas().has(atividade.id)"
                  (valorChange)="!$event && reabrir(atividade)"
                />
                <div class="atividade__texto">
                  <p class="atividade__titulo">{{ atividade.titulo }}</p>
                  <p class="atividade__detalhe">
                    {{ rotuloTipo(atividade.tipo) }} · concluída {{ concluidaHa(atividade) }}
                    @if (atividade.resultadoReuniao; as resultado) {
                      <app-selo tamanho="sm" [variante]="resultados[resultado].variante">{{
                        resultados[resultado].rotulo
                      }}</app-selo>
                    }
                  </p>
                </div>
              </li>
            }
          </ul>
        </section>
      }
    }

    <app-resultado-reuniao
      [(aberto)]="resultadoAberto"
      [reuniao]="reuniaoAguardando()?.titulo ?? ''"
      (confirmado)="confirmarResultado($event)"
      (cancelado)="cancelarResultado()"
    />
  `,
  styleUrl: './atividades-negocio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtividadesNegocio {
  readonly negocioId = input.required<string>();
  /** A próxima pendente mudou (o cartão do quadro mostra). */
  readonly proximaMudou = output<Atividade | null>();
  /** Algo mudou (a linha do tempo recarrega). */
  readonly alterou = output<void>();

  private readonly api = inject(FunisApi);
  private readonly avisos = inject(AvisosService);

  protected readonly tipos: OpcaoGrupo<TipoAtividade>[] = TIPOS.map((tipo) => ({
    valor: tipo,
    rotulo: ROTULO_TIPO_ATIVIDADE[tipo],
  }));
  protected readonly atividades = signal<readonly Atividade[]>([]);
  protected readonly carregando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly ocupadas = signal<ReadonlySet<string>>(new Set());

  protected readonly tipo = signal<TipoAtividade | null>('TAREFA');
  protected readonly titulo = signal<ValorCampoTexto>('');
  protected readonly vence = signal<string | null>(null);
  protected readonly inicio = signal<string | null>(null);
  protected readonly fim = signal<string | null>(null);
  protected readonly enviado = signal(false);
  protected readonly criando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  private readonly campoTitulo = viewChild<CampoTexto>('campoTitulo');
  private pedido = 0;

  protected readonly pendentes = computed(() =>
    [...this.atividades()]
      .filter((atividade) => atividade.status === 'PENDENTE')
      .sort((a, b) => dataDa(a) - dataDa(b)),
  );
  protected readonly concluidas = computed(() =>
    this.atividades()
      .filter((atividade) => atividade.status === 'CONCLUIDA')
      .sort((a, b) => (b.concluidaEm ?? '').localeCompare(a.concluidaEm ?? ''))
      .slice(0, 10),
  );
  protected readonly exemplo = computed(() => {
    switch (this.tipo()) {
      case 'LIGACAO':
        return 'Ex.: Ligar para apresentar a proposta';
      case 'REUNIAO':
        return 'Ex.: Demonstração com a diretoria';
      case 'EMAIL':
        return 'Ex.: Enviar a proposta revisada';
      case 'WHATSAPP':
        return 'Ex.: Mandar o vídeo de demonstração';
      case 'NOTA':
        return 'Ex.: Cliente pediu desconto para fechar este mês';
      default:
        return 'Ex.: Preparar a proposta';
    }
  });
  protected readonly erroTitulo = computed(() =>
    this.enviado() && !String(this.titulo() ?? '').trim()
      ? 'Escreva o que precisa ser feito.'
      : null,
  );
  protected readonly erroInicio = computed(() =>
    this.enviado() && this.tipo() === 'REUNIAO' && !this.inicio()
      ? 'Informe o início da reunião.'
      : null,
  );
  protected readonly erroFim = computed(() => {
    if (!this.enviado() || this.tipo() !== 'REUNIAO') {
      return null;
    }
    if (!this.fim()) {
      return 'Informe o fim da reunião.';
    }
    const inicio = this.inicio();
    return inicio && this.fim()! < inicio ? 'O fim precisa ser depois do início.' : null;
  });

  constructor() {
    effect(() => {
      this.negocioId();
      untracked(() => void this.carregar());
    });
  }

  protected rotuloTipo(tipo: TipoAtividade): string {
    return ROTULO_TIPO_ATIVIDADE[tipo];
  }

  protected quando(atividade: Atividade): string | null {
    const data = atividade.inicioEm ?? atividade.venceEm;
    return data ? formatarTempoRelativo(data) : null;
  }

  protected dataCompleta(atividade: Atividade): string {
    return formatarDataHora(atividade.inicioEm ?? atividade.venceEm);
  }

  protected concluidaHa(atividade: Atividade): string {
    return atividade.concluidaEm ? formatarTempoRelativo(atividade.concluidaEm) : '';
  }

  async carregar(): Promise<void> {
    const pedido = ++this.pedido;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const pagina = await this.api.atividadesDoNegocio(this.negocioId());
      if (pedido === this.pedido) {
        this.atividades.set(pagina.itens);
      }
    } catch (falha) {
      if (pedido === this.pedido) {
        this.erro.set(erroDaApi(falha));
      }
    } finally {
      if (pedido === this.pedido) {
        this.carregando.set(false);
      }
    }
  }

  protected async criar(): Promise<void> {
    this.enviado.set(true);
    this.erroGeral.set(null);
    const tipo = this.tipo() ?? 'TAREFA';
    if (this.erroTitulo() || this.erroInicio() || this.erroFim()) {
      if (this.erroTitulo()) {
        this.campoTitulo()?.focar();
      }
      return;
    }
    this.criando.set(true);
    try {
      const criada = await this.api.criarAtividade({
        tipo,
        titulo: String(this.titulo()).trim(),
        negocioId: this.negocioId(),
        ...(tipo === 'REUNIAO'
          ? {
              inicioEm: localParaIso(this.inicio(), 'data-hora'),
              fimEm: localParaIso(this.fim(), 'data-hora'),
            }
          : tipo === 'NOTA'
            ? {}
            : { venceEm: localParaIso(this.vence(), 'data-hora') }),
      });
      if (tipo !== 'NOTA') {
        this.atividades.update((lista) => [criada, ...lista]);
        this.emitirProxima();
      }
      this.avisos.sucesso(
        tipo === 'NOTA'
          ? 'Nota registrada na linha do tempo.'
          : `Atividade “${criada.titulo}” criada.`,
      );
      this.titulo.set('');
      this.vence.set(null);
      this.inicio.set(null);
      this.fim.set(null);
      this.enviado.set(false);
      this.alterou.emit();
    } catch (falha) {
      this.erroGeral.set(erroDaApi(falha).mensagem);
    } finally {
      this.criando.set(false);
    }
  }

  /** R6.6 — a reunião que espera o resultado no modal (a caixa fica marcada enquanto isso). */
  protected readonly reuniaoAguardando = signal<Atividade | null>(null);
  protected readonly resultadoAberto = signal(false);
  protected readonly resultados = RESULTADOS;

  protected confirmarResultado(conclusao: ConclusaoDeAtividade): void {
    const atividade = this.reuniaoAguardando();
    this.reuniaoAguardando.set(null);
    if (atividade) {
      void this.concluir(atividade, conclusao);
    }
  }

  protected cancelarResultado(): void {
    this.reuniaoAguardando.set(null);
  }

  protected async concluir(atividade: Atividade, conclusao?: ConclusaoDeAtividade): Promise<void> {
    if (atividade.tipo === 'REUNIAO' && !conclusao) {
      this.reuniaoAguardando.set(atividade);
      this.resultadoAberto.set(true);
      return;
    }
    await this.trocarStatus(atividade, () => this.api.concluirAtividade(atividade.id, conclusao));
    if (this.atividades().find((item) => item.id === atividade.id)?.status === 'CONCLUIDA') {
      this.avisos.sucesso(`Atividade “${atividade.titulo}” concluída.`, {
        acao: { rotulo: 'Desfazer', executar: () => void this.reabrir(atividade) },
      });
    }
  }

  protected async reabrir(atividade: Atividade): Promise<void> {
    await this.trocarStatus(atividade, () => this.api.reabrirAtividade(atividade.id));
  }

  private async trocarStatus(atividade: Atividade, acao: () => Promise<Atividade>): Promise<void> {
    this.ocupadas.update((atual) => new Set(atual).add(atividade.id));
    try {
      const nova = await acao();
      this.atividades.update((lista) => lista.map((item) => (item.id === nova.id ? nova : item)));
      this.emitirProxima();
      this.alterou.emit();
    } catch (falha) {
      // A caixa volta sozinha: ela segue `ocupadas`, que perde o id no `finally`.
      this.avisos.erro(falha);
    } finally {
      this.ocupadas.update((atual) => {
        const novo = new Set(atual);
        novo.delete(atividade.id);
        return novo;
      });
    }
  }

  private emitirProxima(): void {
    this.proximaMudou.emit(proximaPendente(this.atividades()));
  }
}
