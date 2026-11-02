import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucidePlus } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { Botao } from '../../ui/botao/botao';
import { CampoData, localParaIso } from '../../ui/campo-data/campo-data';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Dica } from '../../ui/dica/dica';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { comMaiuscula, quandoDaAtividade, TIPOS, TIPOS_DA_AGENDA } from './apresentacao';
import {
  AtividadesApi,
  vinculoParaCriar,
  type Atividade,
  type NovaAtividade,
  type TipoAtividade,
  type Vinculo,
} from './atividades.api';
import { interpretarTitulo, quandoReconhecido } from './interpretar-titulo';
import { SeletorVinculo } from './seletor-vinculo';

/** Duração padrão de uma reunião criada aqui, em minutos. */
export const DURACAO_REUNIAO_MIN = 60;

const dois = (numero: number) => String(numero).padStart(2, '0');

/** "2026-10-22T10:00" + 60 min → "11:00" (a hora local do fim). */
export function horaDoFim(inicio: string | null, minutos = DURACAO_REUNIAO_MIN): string | null {
  if (!inicio) {
    return null;
  }
  const data = new Date(inicio);
  if (Number.isNaN(data.getTime())) {
    return null;
  }
  data.setMinutes(data.getMinutes() + minutos);
  return `${dois(data.getHours())}:${dois(data.getMinutes())}`;
}

/**
 * Criação rápida no topo de Atividades (TELAS-FASE1 §5): o que fazer, o tipo, quando e o
 * vínculo opcional. A frase escrita já preenche o tipo e a data ("Ligar para Maria amanhã às
 * 10h" → ligação amanhã às 10:00, título "Ligar para Maria"), enquanto a pessoa não escolher
 * esses campos à mão. A reunião pede também a hora do fim (padrão: uma hora depois).
 */
@Component({
  selector: 'app-criacao-rapida',
  imports: [Botao, CampoData, CampoTexto, Dica, GrupoOpcoes, SeletorVinculo],
  template: `
    <form
      class="criacao"
      novalidate
      (submit)="criar($event)"
      (focusin)="focado.set(true)"
      (focusout)="aoSairDoFoco($event)"
    >
      <div class="criacao__topo">
        <h2 class="criacao__titulo">Nova atividade</h2>
        <app-dica
          rotulo="Como funciona a criação rápida"
          titulo="Criação rápida"
          texto="Escreva como você falaria: “Ligar para Maria amanhã às 10h” já vira uma ligação para amanhã às 10:00, com o título “Ligar para Maria”. O tipo, a data e o vínculo também podem ser escolhidos à mão. Uma hora antes do prazo, o responsável recebe um lembrete."
        />
      </div>

      <div class="criacao__linha">
        <app-campo-texto
          #campoTitulo
          class="criacao__o-que"
          rotulo="O que precisa ser feito?"
          placeholder="Ligar para Maria amanhã às 10h"
          [maximoCaracteres]="200"
          [valor]="titulo()"
          [erro]="erroTitulo()"
          [dica]="dicaTitulo()"
          (valorChange)="aoDigitar($event)"
        />
        <button
          appBotao
          type="submit"
          variante="invertido"
          class="criacao__enviar"
          [icone]="iconeAdicionar"
          [carregando]="enviando()"
        >
          Adicionar
        </button>
      </div>

      <div class="criacao__detalhes">
        <app-grupo-opcoes
          class="criacao__tipo"
          rotulo="Tipo"
          disposicao="pilulas"
          [opcoes]="opcoesTipo"
          [valor]="tipo()"
          (valorChange)="escolherTipo($event)"
        />
        <div class="criacao__quando">
          <app-campo-data
            tipo="data-hora"
            [rotulo]="ehReuniao() ? 'Começa em' : 'Vence em'"
            [opcional]="!ehReuniao()"
            [valor]="quando()"
            [erro]="erroQuando()"
            (valorChange)="escolherQuando($event)"
          />
          @if (ehReuniao()) {
            <app-campo-data
              class="criacao__fim"
              tipo="hora"
              rotulo="Termina às"
              [valor]="fimEfetivo()"
              [erro]="erroFim()"
              (valorChange)="fim.set($event)"
            />
          }
        </div>
        <app-seletor-vinculo class="criacao__vinculo" [(vinculo)]="vinculo" />
      </div>
    </form>
  `,
  styleUrl: './criacao-rapida.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'criacao-rapida', '[class.criacao-rapida--aberta]': 'aberta()' },
})
export class CriacaoRapida {
  private readonly api = inject(AtividadesApi);
  private readonly avisos = inject(AvisosService);

  /** A atividade acabou de ser criada (a tela recarrega a agenda e a destaca). */
  readonly criada = output<Atividade>();

  protected readonly iconeAdicionar = LucidePlus;
  protected readonly opcoesTipo: readonly OpcaoGrupo<TipoAtividade>[] = TIPOS_DA_AGENDA.map(
    (tipo) => ({ valor: tipo, rotulo: TIPOS[tipo].rotulo, icone: TIPOS[tipo].icone }),
  );

  protected readonly titulo = signal('');
  protected readonly tipo = signal<TipoAtividade>('TAREFA');
  /** A pessoa escolheu o tipo à mão: a frase não muda mais o tipo. */
  protected readonly tipoManual = signal(false);
  /** "2026-10-22T10:00" (hora local) ou `null`. */
  protected readonly quando = signal<string | null>(null);
  /** A pessoa escolheu a data à mão: a frase não muda mais a data. */
  private readonly quandoManual = signal(false);
  /** Hora do fim da reunião ("11:00"); `null` = uma hora depois do início. */
  protected readonly fim = signal<string | null>(null);
  protected readonly vinculo = signal<Vinculo | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erroTitulo = signal<string | null>(null);
  protected readonly erroQuando = signal<string | null>(null);
  protected readonly erroFim = signal<string | null>(null);

  /** O foco está em algum campo do formulário. */
  protected readonly focado = signal(false);
  /**
   * No celular, o cartão começa só com o "O que precisa ser feito?": tipo, quando, vínculo e
   * o Adicionar aparecem com o foco no formulário ou quando já há algo preenchido.
   */
  protected readonly aberta = computed(
    () =>
      this.focado() ||
      this.titulo().trim() !== '' ||
      this.quando() !== null ||
      this.vinculo() !== null ||
      this.tipoManual(),
  );

  protected readonly ehReuniao = computed(() => this.tipo() === 'REUNIAO');
  protected readonly fimEfetivo = computed(() => this.fim() ?? horaDoFim(this.quando()));
  private readonly interpretacao = computed(() => interpretarTitulo(this.titulo()));
  /** A data veio da frase (e não foi trocada à mão): o trecho sai do título. */
  private readonly dataDaFrase = computed(
    () =>
      !this.quandoManual() &&
      this.quando() !== null &&
      this.interpretacao().titulo !== this.titulo().trim(),
  );

  /** Embaixo do campo: o que foi entendido da frase, ou o exemplo. */
  protected readonly dicaTitulo = computed(() => {
    if (this.erroTitulo()) {
      return null;
    }
    const interpretacao = this.interpretacao();
    const partes: string[] = [];
    if (!this.tipoManual() && interpretacao.tipo) {
      partes.push(TIPOS[interpretacao.tipo].rotulo);
    }
    if (this.dataDaFrase()) {
      partes.push(this.quandoLegivel()?.toLocaleLowerCase('pt-BR') ?? '');
    }
    if (partes.length === 0) {
      return 'Dica: “amanhã às 10h” no texto já preenche a data.';
    }
    const titulo = this.dataDaFrase() ? ` · título “${interpretacao.titulo}”` : '';
    return `Entendido: ${partes.join(', ')}${titulo}.`;
  });

  private readonly campoTitulo = viewChild.required<CampoTexto>('campoTitulo');

  /** Leva o foco ao "O que precisa ser feito?" (ação principal da página). */
  focar(): void {
    this.campoTitulo().focar();
  }

  protected aoSairDoFoco(evento: FocusEvent): void {
    const destino = evento.relatedTarget as Node | null;
    const formulario = evento.currentTarget as HTMLElement;
    if (!destino || !formulario.contains(destino)) {
      this.focado.set(false);
    }
  }

  protected aoDigitar(texto: string | number | null): void {
    const valor = typeof texto === 'string' ? texto : '';
    this.titulo.set(valor);
    this.erroTitulo.set(null);
    const interpretacao = interpretarTitulo(valor);
    if (!this.tipoManual()) {
      this.tipo.set(interpretacao.tipo ?? 'TAREFA');
    }
    if (!this.quandoManual()) {
      this.quando.set(quandoReconhecido(interpretacao));
      this.erroQuando.set(null);
    }
  }

  protected escolherTipo(tipo: TipoAtividade | null): void {
    if (tipo) {
      this.tipo.set(tipo);
      this.tipoManual.set(true);
      this.erroQuando.set(null);
    }
  }

  protected escolherQuando(valor: string | null): void {
    this.quando.set(valor);
    this.quandoManual.set(true);
    this.erroQuando.set(null);
    this.erroFim.set(null);
  }

  protected async criar(evento: Event): Promise<void> {
    evento.preventDefault();
    if (this.enviando()) {
      return;
    }
    const nova = this.montar();
    if (!nova) {
      return;
    }
    this.enviando.set(true);
    try {
      const atividade = await this.api.criar(nova);
      const quando = quandoDaAtividade(atividade);
      this.avisos.sucesso(
        atividade.venceEm || atividade.inicioEm
          ? `Atividade “${atividade.titulo}” criada para ${quando.toLocaleLowerCase('pt-BR')}.`
          : `Atividade “${atividade.titulo}” criada, sem data.`,
        { chave: 'atividade-criada' },
      );
      this.limpar();
      this.criada.emit(atividade);
      this.focar();
    } catch (falha) {
      const erro = erroDaApi(falha);
      const doTitulo = erro.mensagemDoCampo('titulo');
      const daData = erro.mensagemDoCampo('venceEm') ?? erro.mensagemDoCampo('inicioEm');
      const doFim = erro.mensagemDoCampo('fimEm');
      if (doTitulo || daData || doFim) {
        this.erroTitulo.set(doTitulo);
        this.erroQuando.set(daData);
        this.erroFim.set(doFim);
      } else {
        this.avisos.erro(erro);
      }
    } finally {
      this.enviando.set(false);
    }
  }

  /** O pedido para a API, ou `null` (com os erros nos campos) se falta algo. */
  private montar(): NovaAtividade | null {
    const texto = this.titulo().trim();
    const titulo = this.dataDaFrase() ? this.interpretacao().titulo : texto;
    const tipo = this.tipo();
    const quando = this.quando();
    let valido = true;
    if (!texto) {
      this.erroTitulo.set('Escreva o que precisa ser feito.');
      valido = false;
    }
    if (tipo === 'REUNIAO' && !quando) {
      this.erroQuando.set('Diga quando a reunião começa.');
      valido = false;
    }
    let fimEm: string | null = null;
    if (tipo === 'REUNIAO' && quando) {
      const hora = this.fimEfetivo();
      fimEm = hora ? localParaIso(`${quando.slice(0, 10)}T${hora}`, 'data-hora') : null;
      const inicioEm = localParaIso(quando, 'data-hora');
      if (!fimEm || !inicioEm || fimEm < inicioEm) {
        this.erroFim.set('O fim precisa ser no mesmo dia, depois do início.');
        valido = false;
      }
    }
    if (!valido) {
      if (!texto) {
        this.focar();
      }
      return null;
    }
    const iso = localParaIso(quando, 'data-hora');
    return {
      tipo,
      titulo: titulo.slice(0, 200),
      ...(tipo === 'REUNIAO' ? { inicioEm: iso, fimEm } : { venceEm: iso }),
      ...vinculoParaCriar(this.vinculo()),
    };
  }

  /** "Amanhã às 10:00" do que está nos campos (para a dica). */
  private quandoLegivel(): string | null {
    const quando = this.quando();
    if (!quando) {
      return null;
    }
    const iso = localParaIso(quando, 'data-hora');
    return comMaiuscula(
      quandoDaAtividade({
        tipo: 'TAREFA',
        status: 'PENDENTE',
        atrasada: false,
        venceEm: iso,
        inicioEm: null,
        fimEm: null,
      } as Atividade),
    );
  }

  private limpar(): void {
    this.titulo.set('');
    this.tipo.set('TAREFA');
    this.tipoManual.set(false);
    this.quando.set(null);
    this.quandoManual.set(false);
    this.fim.set(null);
    this.vinculo.set(null);
    this.erroTitulo.set(null);
    this.erroQuando.set(null);
    this.erroFim.set(null);
  }
}
