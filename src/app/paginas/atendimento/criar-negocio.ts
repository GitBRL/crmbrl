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
import { paraDecimal } from '../../nucleo/formatos';
import { ROTULO_AREA } from '../../nucleo/sessao/perfil';
import { Botao } from '../../ui/botao/botao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Modal } from '../../ui/modal/modal';
import { AtendimentoApi } from './atendimento.api';
import type { ConversaDetalhe } from './atendimento.tipos';
import { CANAL } from './apresentacao';

/**
 * Criar um negócio para o contato da conversa: entra no funil da área da fila (ou da área de
 * quem cria), na primeira etapa, com a origem do canal, e fica ligado à conversa.
 */
@Component({
  selector: 'app-criar-negocio',
  imports: [Botao, CampoTexto, Modal],
  template: `
    <app-modal
      [(aberto)]="aberto"
      titulo="Criar negócio"
      [complemento]="complemento()"
      largura="sm"
    >
      <form class="negocio" id="form-negocio" (submit)="$event.preventDefault(); criar()">
        <p class="negocio__frase">{{ frase() }}</p>
        <app-campo-texto
          rotulo="Título"
          [valor]="titulo()"
          (valorChange)="titulo.set($any($event) ?? '')"
          [maximoCaracteres]="200"
          [erro]="erroTitulo()"
        />
        <app-campo-texto
          rotulo="Valor"
          opcional
          tipo="number"
          prefixo="R$"
          [passo]="0.01"
          [minimo]="0"
          [valor]="valor()"
          (valorChange)="valor.set($any($event))"
          [erro]="erroValor()"
        />
      </form>
      <div modal-rodape class="negocio__rodape">
        <button appBotao type="button" variante="contorno" (click)="aberto.set(false)">
          Cancelar
        </button>
        <button
          appBotao
          type="submit"
          form="form-negocio"
          variante="invertido"
          [carregando]="enviando()"
        >
          Criar negócio
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .negocio {
      display: grid;
      gap: var(--esp-4);
    }

    .negocio__frase {
      margin: 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .negocio__rodape {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--esp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CriarNegocio {
  readonly aberto = model(false);
  readonly conversa = input.required<ConversaDetalhe>();
  readonly criado = output<{ readonly id: string }>();

  private readonly api = inject(AtendimentoApi);
  private readonly avisos = inject(AvisosService);

  protected readonly titulo = signal('');
  protected readonly valor = signal<number | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erroTitulo = signal<string | null>(null);
  protected readonly erroValor = signal<string | null>(null);

  protected readonly complemento = computed(() => `· ${this.conversa().contato.nome}`);
  protected readonly frase = computed(() => {
    const conversa = this.conversa();
    const area = conversa.fila ? ROTULO_AREA[conversa.fila.area] : null;
    return `O negócio entra no funil ${area ? `de ${area}` : 'da sua área'}, na primeira etapa, com a origem ${CANAL[conversa.canal.tipo].rotulo}, e fica ligado a esta conversa.`;
  });

  constructor() {
    effect(() => {
      if (!this.aberto()) {
        return;
      }
      untracked(() => {
        this.titulo.set(this.conversa().contato.nome);
        this.valor.set(null);
        this.erroTitulo.set(null);
        this.erroValor.set(null);
      });
    });
  }

  protected async criar(): Promise<void> {
    const titulo = this.titulo().trim();
    if (!titulo) {
      this.erroTitulo.set('Dê um título ao negócio.');
      return;
    }
    this.erroTitulo.set(null);
    this.erroValor.set(null);
    this.enviando.set(true);
    try {
      const valor = this.valor() === null ? null : paraDecimal(this.valor());
      const negocio = await this.api.criarNegocio(this.conversa().id, {
        titulo,
        ...(valor ? { valor } : {}),
      });
      this.criado.emit(negocio);
    } catch (falha) {
      const erro = erroDaApi(falha);
      const campoValor = erro.campos.find((campo) => campo.campo === 'valor');
      const campoTitulo = erro.campos.find((campo) => campo.campo === 'titulo');
      if (campoValor || campoTitulo) {
        this.erroValor.set(campoValor?.mensagens[0] ?? null);
        this.erroTitulo.set(campoTitulo?.mensagens[0] ?? null);
      } else {
        this.avisos.erro(falha);
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
