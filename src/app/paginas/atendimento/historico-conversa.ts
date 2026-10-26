import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { formatarDataHora } from '../../nucleo/formatos';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Modal } from '../../ui/modal/modal';
import { AtendimentoApi } from './atendimento.api';
import type { Atribuicao, ConversaDetalhe } from './atendimento.tipos';

/** "Distribuída por Vendas para Lucas", "Transferida por Rafael de Lucas para Juliana"… */
export function fraseDaAtribuicao(atribuicao: Atribuicao): string {
  const para =
    atribuicao.para?.nome ??
    (atribuicao.paraFila ? `a fila ${atribuicao.paraFila.nome}` : 'ninguém');
  const de = atribuicao.de?.nome ?? (atribuicao.deFila ? `a fila ${atribuicao.deFila.nome}` : null);
  const por = atribuicao.por?.nome ?? 'o sistema';
  switch (atribuicao.motivo) {
    case 'DISTRIBUICAO':
      return atribuicao.paraFila
        ? `A fila ${atribuicao.paraFila.nome} entregou para ${atribuicao.para?.nome ?? 'ninguém (aguardando alguém assumir)'}`
        : `Distribuída para ${para}`;
    case 'ASSUMIDA':
      return `${atribuicao.para?.nome ?? por} assumiu a conversa`;
    case 'TRANSFERENCIA':
      return de ? `${por} transferiu de ${de} para ${para}` : `${por} transferiu para ${para}`;
    case 'DESLIGAMENTO':
      return `Passou para ${para} no desligamento de ${atribuicao.de?.nome ?? 'quem atendia'}`;
    case 'REABERTURA':
      return `${por} reabriu a conversa${atribuicao.para ? `, que ficou com ${atribuicao.para.nome}` : ''}`;
    case 'MANUAL':
      return `${por} entregou a conversa para ${para}`;
    default:
      return `Ficou com ${para}`;
  }
}

/** Histórico de quem cuidou da conversa: distribuição, assumir, transferências (com nota). */
@Component({
  selector: 'app-historico-conversa',
  imports: [EstadoVazio, Esqueleto, Modal],
  template: `
    <app-modal
      [(aberto)]="aberto"
      titulo="Histórico de atendimento"
      [complemento]="'· ' + conversa().contato.nome"
    >
      @if (carregando()) {
        <div aria-busy="true">
          <p class="visualmente-oculto" role="status">Carregando o histórico…</p>
          <app-esqueleto forma="texto" [linhas]="4" />
        </div>
      } @else if (falha()) {
        <app-estado-vazio
          compacto
          variante="erro"
          titulo="Não deu para carregar o histórico"
          [falha]="falha()"
          [texto]="falha()?.mensagem ?? null"
        />
      } @else if (itens().length === 0) {
        <app-estado-vazio
          compacto
          titulo="Sem mudanças de responsável"
          texto="A conversa está com quem a recebeu primeiro."
        />
      } @else {
        <ol class="historico">
          @for (item of itens(); track item.id) {
            <li class="historico__item">
              <span class="historico__frase">{{ frase(item) }}</span>
              <span class="historico__quando">{{ quando(item.criadoEm) }}</span>
              @if (item.nota) {
                <span class="historico__nota">“{{ item.nota }}”</span>
              }
            </li>
          }
        </ol>
      }
    </app-modal>
  `,
  styles: `
    .historico {
      display: grid;
      gap: var(--esp-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .historico__item {
      display: grid;
      gap: 2px;
      padding-left: var(--esp-4);
      border-left: 2px solid var(--cor-borda-forte);
    }

    .historico__frase {
      font: var(--fonte-corpo);
    }

    .historico__quando {
      color: var(--cor-texto-fraco);
      font: var(--fonte-legenda);
    }

    .historico__nota {
      margin-top: var(--esp-1);
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoricoConversa {
  readonly aberto = model(false);
  readonly conversa = input.required<ConversaDetalhe>();

  private readonly api = inject(AtendimentoApi);

  protected readonly itens = signal<readonly Atribuicao[]>([]);
  protected readonly carregando = signal(false);
  protected readonly falha = signal<ErroApi | null>(null);

  constructor() {
    effect(() => {
      if (!this.aberto()) {
        return;
      }
      const id = this.conversa().id;
      untracked(() => {
        this.carregando.set(true);
        this.falha.set(null);
        this.api.atribuicoes(id).subscribe({
          next: (itens) => {
            this.itens.set(itens);
            this.carregando.set(false);
          },
          error: (falha: unknown) => {
            this.falha.set(erroDaApi(falha));
            this.carregando.set(false);
          },
        });
      });
    });
  }

  protected frase(item: Atribuicao): string {
    return fraseDaAtribuicao(item);
  }

  protected quando(iso: string): string {
    return formatarDataHora(iso);
  }
}
