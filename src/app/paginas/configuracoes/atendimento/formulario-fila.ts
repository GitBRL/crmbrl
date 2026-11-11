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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { type ErroApi, erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { AreaTexto } from '../../../ui/area-texto/area-texto';
import { Botao } from '../../../ui/botao/botao';
import { CaixaSelecao } from '../../../ui/caixa-selecao/caixa-selecao';
import { CampoTexto } from '../../../ui/campo-texto/campo-texto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../../ui/grupo-opcoes/grupo-opcoes';
import { Modal } from '../../../ui/modal/modal';
import { Seletor, type OpcaoSeletor } from '../../../ui/seletor/seletor';
import { gerarId } from '../../../ui/tipos';
import {
  DICA_SLA,
  ESTRATEGIA,
  ESTRATEGIAS,
  juntarMinutos,
  partirMinutos,
  rotuloDaArea,
  type UnidadeDeTempo,
} from './apresentacao';
import { AtendimentoConfigApi } from './atendimento.api';
import {
  type AreaDoAtendimento,
  type DadosFila,
  type EstrategiaFila,
  type Fila,
  SLA_PRIMEIRA_RESPOSTA_MAXIMO,
  SLA_RESOLUCAO_MAXIMO,
} from './atendimento.modelos';

export type PedidoFormularioFila =
  { readonly modo: 'criar' } | { readonly modo: 'editar'; readonly fila: Fila };

const OPCOES_ESTRATEGIA: readonly OpcaoGrupo<EstrategiaFila>[] = ESTRATEGIAS.map((valor) => ({
  valor,
  rotulo: ESTRATEGIA[valor].rotulo,
  dica: ESTRATEGIA[valor].descricao,
}));

const OPCOES_UNIDADE: readonly OpcaoSeletor<UnidadeDeTempo>[] = [
  { valor: 'minutos', rotulo: 'minutos' },
  { valor: 'horas', rotulo: 'horas' },
  { valor: 'dias', rotulo: 'dias' },
];

/**
 * Criar e editar uma fila (R12): nome, área (Comercial ou CS; o líder só a dele), descrição,
 * estratégia de distribuição e os dois prazos (SLA) — cada um pode ficar "sem prazo". Quem recebe
 * se ajusta depois, no cartão da fila (a fila nova vale para o setor inteiro).
 */
@Component({
  selector: 'app-formulario-fila',
  imports: [
    ReactiveFormsModule,
    AreaTexto,
    Botao,
    CaixaSelecao,
    CampoTexto,
    GrupoOpcoes,
    Modal,
    Seletor,
  ],
  template: `
    <app-modal
      [titulo]="editando() ? 'Editar fila' : 'Nova fila'"
      [complemento]="editando() ? '· ' + editando()!.nome : null"
      largura="lg"
      [aberto]="pedido() !== null"
      (fechado)="fechado.emit()"
    >
      <form
        class="formulario"
        novalidate
        [id]="idFormulario"
        [formGroup]="formulario"
        (ngSubmit)="salvar()"
      >
        <div class="formulario__par">
          <app-campo-texto
            #campoNome
            rotulo="Nome"
            placeholder="Ex.: Comercial — WhatsApp"
            autocomplete="off"
            [maximoCaracteres]="100"
            formControlName="nome"
          />
          @if (opcoesArea().length > 1) {
            <app-grupo-opcoes
              rotulo="Setor"
              disposicao="pilulas"
              [opcoes]="opcoesArea()"
              formControlName="area"
            />
          } @else {
            <div class="formulario__fixo">
              <span class="formulario__fixo-rotulo">Setor</span>
              <span class="formulario__fixo-valor">{{ rotuloArea() }}</span>
            </div>
          }
        </div>
        <app-area-texto
          rotulo="Descrição"
          opcional
          placeholder="Para que serve esta fila (aparece só aqui)."
          [linhas]="2"
          [maximoCaracteres]="500"
          formControlName="descricao"
        />
        <app-grupo-opcoes
          rotulo="Quem recebe cada conversa nova"
          [opcoes]="opcoesEstrategia"
          formControlName="estrategia"
        />

        <fieldset class="formulario__grupo">
          <legend class="formulario__legenda">Prazos (SLA)</legend>
          <p class="formulario__legenda-frase">{{ dicaSla }}</p>
          <div class="prazo">
            <app-caixa-selecao
              rotulo="Prazo para a primeira resposta"
              formControlName="comPrimeira"
            />
            @if (formulario.controls.comPrimeira.value) {
              <div class="prazo__campos">
                <app-campo-texto
                  rotulo="Primeira resposta em até"
                  rotuloOculto
                  tipo="number"
                  [minimo]="1"
                  [passo]="1"
                  formControlName="primeiraValor"
                />
                <app-seletor
                  rotulo="Unidade da primeira resposta"
                  rotuloOculto
                  [opcoes]="opcoesUnidade"
                  formControlName="primeiraUnidade"
                />
              </div>
            }
          </div>
          <div class="prazo">
            <app-caixa-selecao rotulo="Prazo para resolver" formControlName="comResolucao" />
            @if (formulario.controls.comResolucao.value) {
              <div class="prazo__campos">
                <app-campo-texto
                  rotulo="Resolver em até"
                  rotuloOculto
                  tipo="number"
                  [minimo]="1"
                  [passo]="1"
                  formControlName="resolucaoValor"
                />
                <app-seletor
                  rotulo="Unidade da resolução"
                  rotuloOculto
                  [opcoes]="opcoesUnidade"
                  formControlName="resolucaoUnidade"
                />
              </div>
            }
          </div>
          @if (erroPrazo(); as erro) {
            <p class="formulario__erro" role="alert">{{ erro }}</p>
          }
        </fieldset>

        @if (!editando()) {
          <p class="formulario__nota">
            A fila nova vale para todas as pessoas ativas do setor. Depois de criar, ligue ou
            desligue cada pessoa no cartão da fila.
          </p>
        }
        @if (erro(); as erro) {
          <p class="formulario__erro" role="alert">{{ erro.mensagem }}</p>
        }
      </form>
      <ng-container modal-rodape>
        <button
          appBotao
          type="submit"
          variante="invertido"
          [carregando]="enviando()"
          [attr.form]="idFormulario"
        >
          {{ editando() ? 'Salvar' : 'Criar fila' }}
        </button>
        <button appBotao type="button" variante="contorno" (click)="fechado.emit()">
          Cancelar
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    @use '../canais/comum/tela-canal' as t;

    @include t.formulario;

    .formulario__fixo {
      display: grid;
      gap: var(--esp-2);
      padding-inline-start: var(--esp-4);
    }

    .formulario__fixo-rotulo {
      font: var(--fonte-rotulo);
    }

    .formulario__fixo-valor {
      display: flex;
      align-items: center;
      min-height: var(--altura-md);
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo);
    }

    .prazo {
      display: grid;
      gap: var(--esp-2);
    }

    .prazo__campos {
      display: grid;
      grid-template-columns: minmax(0, 8rem) minmax(0, 10rem);
      gap: var(--esp-3);
      margin-left: calc(22px + var(--esp-3));
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioFila {
  /** `null` = fechado. */
  readonly pedido = input<PedidoFormularioFila | null>(null);
  /** Setores em que a pessoa pode criar (Admin e C-level: todos os que atendem; o líder: o dele). */
  readonly areasPermitidas = input<readonly AreaDoAtendimento[]>([]);
  readonly salva = output<Fila>();
  readonly fechado = output<void>();

  private readonly api = inject(AtendimentoConfigApi);
  private readonly avisos = inject(AvisosService);

  protected readonly idFormulario = gerarId('formulario-fila');
  protected readonly dicaSla = DICA_SLA;
  protected readonly opcoesEstrategia = OPCOES_ESTRATEGIA;
  protected readonly opcoesUnidade = OPCOES_UNIDADE;
  protected readonly enviando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly erroPrazo = signal<string | null>(null);

  private readonly campoNome = viewChild<CampoTexto>('campoNome');

  protected readonly formulario = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    area: new FormControl<AreaDoAtendimento>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    estrategia: new FormControl<EstrategiaFila>('RODIZIO', { nonNullable: true }),
    comPrimeira: new FormControl(true, { nonNullable: true }),
    primeiraValor: new FormControl<number | null>(15, { validators: [Validators.min(1)] }),
    primeiraUnidade: new FormControl<UnidadeDeTempo>('minutos', { nonNullable: true }),
    comResolucao: new FormControl(true, { nonNullable: true }),
    resolucaoValor: new FormControl<number | null>(1, { validators: [Validators.min(1)] }),
    resolucaoUnidade: new FormControl<UnidadeDeTempo>('dias', { nonNullable: true }),
  });

  protected readonly editando = computed(() => {
    const pedido = this.pedido();
    return pedido?.modo === 'editar' ? pedido.fila : null;
  });

  protected readonly opcoesArea = computed<readonly OpcaoGrupo<AreaDoAtendimento>[]>(() => {
    const fila = this.editando();
    const areas = new Set(this.areasPermitidas());
    if (fila) {
      areas.add(fila.area);
    }
    return [...areas].map((area) => ({ valor: area, rotulo: rotuloDaArea(area) }));
  });

  protected readonly rotuloArea = computed(() => {
    const opcoes = this.opcoesArea();
    return opcoes.length ? opcoes[0].rotulo : '';
  });

  constructor() {
    effect(() => {
      const pedido = this.pedido();
      if (pedido) {
        untracked(() => this.preencher(pedido));
      }
    });
  }

  private preencher(pedido: PedidoFormularioFila): void {
    this.erro.set(null);
    this.erroPrazo.set(null);
    if (pedido.modo === 'criar') {
      this.formulario.reset({
        nome: '',
        area: this.areasPermitidas()[0] ?? '',
        descricao: '',
        estrategia: 'RODIZIO',
        comPrimeira: true,
        primeiraValor: 15,
        primeiraUnidade: 'minutos',
        comResolucao: true,
        resolucaoValor: 1,
        resolucaoUnidade: 'dias',
      });
      return;
    }
    const fila = pedido.fila;
    const primeira = fila.slaPrimeiraRespostaMinutos
      ? partirMinutos(fila.slaPrimeiraRespostaMinutos)
      : { valor: 15, unidade: 'minutos' as const };
    const resolucao = fila.slaResolucaoMinutos
      ? partirMinutos(fila.slaResolucaoMinutos)
      : { valor: 1, unidade: 'dias' as const };
    this.formulario.reset({
      nome: fila.nome,
      area: fila.area,
      descricao: fila.descricao ?? '',
      estrategia: fila.estrategia,
      comPrimeira: fila.slaPrimeiraRespostaMinutos !== null,
      primeiraValor: primeira.valor,
      primeiraUnidade: primeira.unidade,
      comResolucao: fila.slaResolucaoMinutos !== null,
      resolucaoValor: resolucao.valor,
      resolucaoUnidade: resolucao.unidade,
    });
  }

  /** Os dois prazos em minutos, ou a frase do problema. */
  private prazos(): { primeira: number | null; resolucao: number | null } | string {
    const v = this.formulario.getRawValue();
    const primeira =
      v.comPrimeira && v.primeiraValor ? juntarMinutos(v.primeiraValor, v.primeiraUnidade) : null;
    const resolucao =
      v.comResolucao && v.resolucaoValor
        ? juntarMinutos(v.resolucaoValor, v.resolucaoUnidade)
        : null;
    if ((v.comPrimeira && !primeira) || (v.comResolucao && !resolucao)) {
      return 'Informe os prazos marcados (pelo menos 1 minuto).';
    }
    if (primeira !== null && primeira > SLA_PRIMEIRA_RESPOSTA_MAXIMO) {
      return 'A primeira resposta pode ter no máximo 30 dias de prazo.';
    }
    if (resolucao !== null && resolucao > SLA_RESOLUCAO_MAXIMO) {
      return 'A resolução pode ter no máximo 365 dias de prazo.';
    }
    if (primeira !== null && resolucao !== null && resolucao < primeira) {
      return 'O prazo para resolver não pode ser menor que o da primeira resposta.';
    }
    return { primeira, resolucao };
  }

  protected async salvar(): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.erro.set(null);
    this.erroPrazo.set(null);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) {
      this.campoNome()?.focar();
      return;
    }
    const prazos = this.prazos();
    if (typeof prazos === 'string') {
      this.erroPrazo.set(prazos);
      return;
    }
    const v = this.formulario.getRawValue();
    const fila = this.editando();
    const completo: DadosFila = {
      nome: v.nome.trim(),
      area: v.area,
      descricao: v.descricao.trim() || null,
      estrategia: v.estrategia,
      slaPrimeiraRespostaMinutos: prazos.primeira,
      slaResolucaoMinutos: prazos.resolucao,
    };
    const dados: DadosFila = fila
      ? Object.fromEntries(
          Object.entries(completo).filter(
            ([chave, valor]) => (fila as unknown as Record<string, unknown>)[chave] !== valor,
          ),
        )
      : completo;
    if (fila && Object.keys(dados).length === 0) {
      this.avisos.info('Nada mudou: não havia o que salvar.');
      this.fechado.emit();
      return;
    }
    this.enviando.set(true);
    try {
      const salva = fila
        ? await this.api.atualizarFila(fila.id, dados)
        : await this.api.criarFila(dados);
      this.avisos.sucesso(fila ? `Fila “${salva.nome}” salva.` : `Fila “${salva.nome}” criada.`);
      this.salva.emit(salva);
      this.fechado.emit();
    } catch (falha) {
      const erro = erroDaApi(falha);
      const doNome = erro.mensagemDoCampo('nome');
      if (doNome) {
        this.formulario.controls.nome.setErrors({ api: doNome });
        this.campoNome()?.focar();
      } else {
        this.erro.set(erro);
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
