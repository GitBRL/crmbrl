import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarMoeda, paraDecimal, paraNumero } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { CampoData } from '../../ui/campo-data/campo-data';
import { Modal } from '../../ui/modal/modal';
import { CampoTexto, type ValorCampoTexto } from '../../ui/campo-texto/campo-texto';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { type Vinculo } from '../atividades/atividades.api';
import { SeletorVinculo } from '../atividades/seletor-vinculo';
import { FinanceiroApi } from './financeiro.api';
import {
  FORMAS,
  type FormaPagamento,
  hojeIso,
  type Parcela,
  ROTULO_FORMA,
} from './financeiro.tipos';

/** Modal com formulário, mensagem de erro e botões padrão (Cancelar / ação). */
@Component({
  selector: 'app-modal-base',
  imports: [Modal, Botao],
  template: `
    <app-modal
      [titulo]="titulo()"
      [complemento]="complemento()"
      [largura]="largura()"
      [aberto]="aberto()"
      (abertoChange)="aberto.set($event)"
    >
      <form class="formulario" [id]="formId()" (submit)="$event.preventDefault(); confirmar.emit()">
        <ng-content />
        @if (erro(); as mensagem) {
          <p class="erro-inline" role="alert">{{ mensagem }}</p>
        }
      </form>
      <div modal-rodape>
        <button appBotao type="button" variante="contorno" (click)="aberto.set(false)">
          Cancelar
        </button>
        <button
          appBotao
          type="submit"
          variante="marca"
          [attr.form]="formId()"
          [carregando]="salvando()"
        >
          {{ rotuloAcao() }}
        </button>
      </div>
    </app-modal>
  `,
  styleUrl: './financeiro-comum.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalBase {
  readonly aberto = model(false);
  readonly titulo = input.required<string>();
  readonly complemento = input<string | null>(null);
  readonly largura = input<'sm' | 'md' | 'lg'>('md');
  readonly formId = input.required<string>();
  readonly rotuloAcao = input('Salvar');
  readonly salvando = input(false);
  readonly erro = input<string | null>(null);
  readonly confirmar = output<void>();
}

/** Texto de erro de formulário: a mensagem do campo (quando a API aponta) ou o resumo. */
export function textoDoErro(falha: unknown): string {
  const erro = erroDaApi(falha);
  const campos = erro.campos.flatMap((c) => c.mensagens);
  const texto = campos.length > 0 ? campos.join(' ') : erro.resumo;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function numeroDoCampo(valor: ValorCampoTexto): number | null {
  if (valor === null || valor === '') {
    return null;
  }
  return paraNumero(valor);
}

const OPCOES_FORMA: readonly OpcaoSeletor<FormaPagamento>[] = FORMAS.map((valor) => ({
  valor,
  rotulo: ROTULO_FORMA[valor],
}));

/** Baixa manual: data, valor recebido e forma de pagamento (encerra a régua do título). */
@Component({
  selector: 'app-modal-baixa',
  imports: [CampoData, CampoTexto, Seletor, ModalBase],
  template: `
    <app-modal-base
      titulo="Dar baixa"
      [complemento]="parcela()?.numero ?? null"
      largura="sm"
      [(aberto)]="aberto"
      formId="form-baixa"
      rotuloAcao="Confirmar pagamento"
      [salvando]="salvando()"
      [erro]="erro()"
      (confirmar)="salvar()"
    >
      <p class="nota">
        Use quando o cliente já pagou. A régua de cobrança deste título é encerrada e as mensagens
        que ainda não saíram são canceladas.
      </p>
      <app-campo-data rotulo="Data do pagamento" [(valor)]="pagoEm" [maximo]="hoje" />
      <app-campo-texto
        rotulo="Valor recebido"
        tipo="number"
        prefixo="R$"
        [passo]="0.01"
        [minimo]="0.01"
        [valor]="valorPago()"
        (valorChange)="valorPago.set($event)"
      />
      <app-seletor
        rotulo="Forma de pagamento"
        placeholder="Escolha a forma"
        permitirVazio
        [opcoes]="opcoes"
        [(valor)]="forma"
      />
    </app-modal-base>
  `,
  styles: `
    .nota {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalBaixa {
  private readonly api = inject(FinanceiroApi);
  private readonly avisos = inject(AvisosService);

  readonly aberto = model(false);
  readonly parcela = input<Parcela | null>(null);
  readonly concluido = output<Parcela>();

  protected readonly hoje = hojeIso();
  protected readonly opcoes = OPCOES_FORMA;
  protected readonly pagoEm = signal<string | null>(hojeIso());
  protected readonly valorPago = signal<ValorCampoTexto>(null);
  protected readonly forma = signal<FormaPagamento | null>(null);
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    effect(() => {
      const parcela = this.parcela();
      if (this.aberto() && parcela) {
        untracked(() => {
          this.pagoEm.set(hojeIso());
          this.valorPago.set(paraNumero(parcela.valor));
          this.forma.set(null);
          this.erro.set(null);
        });
      }
    });
  }

  protected async salvar(): Promise<void> {
    const parcela = this.parcela();
    if (!parcela || this.salvando()) {
      return;
    }
    const valor = numeroDoCampo(this.valorPago());
    if (valor === null || valor <= 0) {
      this.erro.set('Informe o valor recebido.');
      return;
    }
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const atualizada = await this.api.baixar(parcela.id, {
        pagoEm: this.pagoEm() ?? undefined,
        valorPago: paraDecimal(valor) ?? undefined,
        formaPagamento: this.forma() ?? undefined,
      });
      this.avisos.sucesso(`Parcela ${parcela.numero} paga: ${formatarMoeda(valor)}.`);
      this.aberto.set(false);
      this.concluido.emit(atualizada);
    } catch (falha) {
      this.erro.set(textoDoErro(falha));
    } finally {
      this.salvando.set(false);
    }
  }
}

/** Renegociação: novo vencimento (e valor, se mudar). Cria a parcela "<número>-R1" com a régua do zero. */
@Component({
  selector: 'app-modal-renegociar',
  imports: [CampoData, CampoTexto, ModalBase],
  template: `
    <app-modal-base
      titulo="Renegociar parcela"
      [complemento]="parcela()?.numero ?? null"
      largura="sm"
      [(aberto)]="aberto"
      formId="form-renegociar"
      rotuloAcao="Renegociar"
      [salvando]="salvando()"
      [erro]="erro()"
      (confirmar)="salvar()"
    >
      <p class="nota">
        A parcela atual fica como “renegociada” e nasce uma nova, com a régua de cobrança do início.
      </p>
      <app-campo-data rotulo="Novo vencimento" [minimo]="hoje" [(valor)]="vencimento" />
      <app-campo-texto
        rotulo="Novo valor"
        tipo="number"
        prefixo="R$"
        opcional
        [passo]="0.01"
        [minimo]="0.01"
        dica="Deixe como está para manter o valor."
        [valor]="valor()"
        (valorChange)="valor.set($event)"
      />
    </app-modal-base>
  `,
  styles: `
    .nota {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalRenegociar {
  private readonly api = inject(FinanceiroApi);
  private readonly avisos = inject(AvisosService);

  readonly aberto = model(false);
  readonly parcela = input<Parcela | null>(null);
  readonly concluido = output<Parcela>();

  protected readonly hoje = hojeIso();
  protected readonly vencimento = signal<string | null>(null);
  protected readonly valor = signal<ValorCampoTexto>(null);
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    effect(() => {
      const parcela = this.parcela();
      if (this.aberto() && parcela) {
        untracked(() => {
          this.vencimento.set(null);
          this.valor.set(paraNumero(parcela.valor));
          this.erro.set(null);
        });
      }
    });
  }

  protected async salvar(): Promise<void> {
    const parcela = this.parcela();
    if (!parcela || this.salvando()) {
      return;
    }
    if (!this.vencimento()) {
      this.erro.set('Escolha o novo vencimento.');
      return;
    }
    const valor = numeroDoCampo(this.valor());
    const mudou = valor !== null && valor !== paraNumero(parcela.valor);
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const nova = await this.api.renegociar(parcela.id, {
        vencimento: this.vencimento()!,
        ...(mudou ? { valor: paraDecimal(valor) ?? undefined } : {}),
      });
      this.avisos.sucesso(`Nova parcela ${nova.numero} criada.`);
      this.aberto.set(false);
      this.concluido.emit(nova);
    } catch (falha) {
      this.erro.set(textoDoErro(falha));
    } finally {
      this.salvando.set(false);
    }
  }
}

/** Criar uma parcela avulsa ou editar uma em aberto (vencimento, valor, links e Pix). */
@Component({
  selector: 'app-modal-parcela',
  imports: [CampoData, CampoTexto, SeletorVinculo, ModalBase],
  template: `
    <app-modal-base
      [titulo]="parcela() ? 'Editar parcela' : 'Nova parcela'"
      [complemento]="parcela()?.numero ?? null"
      [(aberto)]="aberto"
      formId="form-parcela"
      rotuloAcao="Salvar"
      [salvando]="salvando()"
      [erro]="erro()"
      (confirmar)="salvar()"
    >
      @if (!parcela()) {
        <app-seletor-vinculo
          rotulo="Cliente"
          placeholder="Buscar contato, empresa ou negócio"
          [opcional]="false"
          dica="Quem vai pagar esta parcela."
          [(vinculo)]="vinculo"
        />
        <app-campo-texto
          rotulo="Número do título"
          opcional
          dica="Se ficar em branco, o CRM cria um número."
          [maximoCaracteres]="40"
          [valor]="numero()"
          (valorChange)="numero.set('' + ($event ?? ''))"
        />
      }
      <div class="grade-campos">
        <app-campo-data rotulo="Vencimento" [(valor)]="vencimento" />
        <app-campo-texto
          rotulo="Valor"
          tipo="number"
          prefixo="R$"
          [passo]="0.01"
          [minimo]="0.01"
          [valor]="valor()"
          (valorChange)="valor.set($event)"
        />
      </div>
      <app-campo-texto
        rotulo="Descrição"
        opcional
        [maximoCaracteres]="200"
        [valor]="descricao()"
        (valorChange)="descricao.set('' + ($event ?? ''))"
      />
      <app-campo-texto
        rotulo="Link do boleto"
        opcional
        tipo="url"
        [valor]="linkBoleto()"
        (valorChange)="linkBoleto.set('' + ($event ?? ''))"
      />
      <app-campo-texto
        rotulo="Link de pagamento"
        opcional
        tipo="url"
        [valor]="linkPagamento()"
        (valorChange)="linkPagamento.set('' + ($event ?? ''))"
      />
      <app-campo-texto
        rotulo="Pix copia e cola"
        opcional
        [valor]="pix()"
        (valorChange)="pix.set('' + ($event ?? ''))"
      />
    </app-modal-base>
  `,
  styleUrl: './financeiro-comum.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalParcela {
  private readonly api = inject(FinanceiroApi);
  private readonly avisos = inject(AvisosService);

  readonly aberto = model(false);
  /** Parcela em edição; sem ela, cria uma nova. */
  readonly parcela = input<Parcela | null>(null);
  readonly contratoId = input<string | null>(null);
  readonly concluido = output<Parcela>();

  protected readonly vinculo = signal<Vinculo | null>(null);
  protected readonly numero = signal('');
  protected readonly vencimento = signal<string | null>(null);
  protected readonly valor = signal<ValorCampoTexto>(null);
  protected readonly descricao = signal('');
  protected readonly linkBoleto = signal('');
  protected readonly linkPagamento = signal('');
  protected readonly pix = signal('');
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly editando = computed(() => this.parcela() !== null);

  constructor() {
    effect(() => {
      if (!this.aberto()) {
        return;
      }
      const p = this.parcela();
      untracked(() => {
        this.vinculo.set(null);
        this.numero.set('');
        this.vencimento.set(p?.vencimento ?? null);
        this.valor.set(p ? paraNumero(p.valor) : null);
        this.descricao.set(p?.descricao ?? '');
        this.linkBoleto.set(p?.linkBoleto ?? '');
        this.linkPagamento.set(p?.linkPagamento ?? '');
        this.pix.set(p?.pix ?? '');
        this.erro.set(null);
      });
    });
  }

  protected async salvar(): Promise<void> {
    if (this.salvando()) {
      return;
    }
    const valor = numeroDoCampo(this.valor());
    if (!this.vencimento() || valor === null || valor <= 0) {
      this.erro.set('Informe o vencimento e o valor.');
      return;
    }
    const atual = this.parcela();
    const comuns = {
      descricao: this.descricao().trim() || null,
      vencimento: this.vencimento()!,
      valor: paraDecimal(valor)!,
      linkBoleto: this.linkBoleto().trim() || null,
      linkPagamento: this.linkPagamento().trim() || null,
      pix: this.pix().trim() || null,
    };
    const vinculo = this.vinculo();
    if (!atual && !vinculo && !this.contratoId()) {
      this.erro.set('Escolha o cliente da parcela.');
      return;
    }
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const resposta = atual
        ? await this.api.alterarParcela(atual.id, comuns)
        : await this.api.criarParcela({
            ...comuns,
            numero: this.numero().trim() || undefined,
            contratoId: this.contratoId(),
            contatoId: vinculo
              ? vinculo.tipo === 'contato'
                ? vinculo.id
                : vinculo.contatoId
              : null,
            empresaId: vinculo
              ? vinculo.tipo === 'empresa'
                ? vinculo.id
                : vinculo.empresaId
              : null,
          });
      this.avisos.sucesso(atual ? 'Parcela atualizada.' : `Parcela ${resposta.numero} criada.`);
      this.aberto.set(false);
      this.concluido.emit(resposta);
    } catch (falha) {
      this.erro.set(textoDoErro(falha));
    } finally {
      this.salvando.set(false);
    }
  }
}
