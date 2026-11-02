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
import { LucideUsers, LucideUserRound } from '@lucide/angular';

import { ROTULO_AREA } from '../../nucleo/sessao/perfil';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { Dica } from '../../ui/dica/dica';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { Modal } from '../../ui/modal/modal';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { AtendimentoApi } from './atendimento.api';
import type { Atendente, ConversaDetalhe, Transferencia } from './atendimento.tipos';
import { EstadoAtendimento } from './estado-atendimento';

type Destino = 'pessoa' | 'fila';

export const TAMANHO_MAXIMO_NOTA = 1000;

const OPCOES_DESTINO: readonly OpcaoGrupo<Destino>[] = [
  {
    valor: 'pessoa',
    rotulo: 'Para uma pessoa',
    dica: 'A conversa passa a ser dela na hora; ela recebe um aviso.',
    icone: LucideUserRound,
  },
  {
    valor: 'fila',
    rotulo: 'Para uma fila',
    dica: 'A fila escolhe quem atende (rodízio, menor carga ou quem assumir primeiro).',
    icone: LucideUsers,
  },
];

/**
 * Transferir a conversa (R12): para uma pessoa (e, se ela for de outra área, para uma fila
 * dessa área) ou só para uma fila, com uma nota para quem recebe. Tudo fica no histórico da
 * conversa e na auditoria.
 */
@Component({
  selector: 'app-transferir-conversa',
  imports: [AreaTexto, Botao, Dica, GrupoOpcoes, Modal, Seletor],
  template: `
    <app-modal [(aberto)]="aberto" titulo="Transferir conversa" [complemento]="complemento()">
      <form class="transferir" id="form-transferir" (submit)="$event.preventDefault(); confirmar()">
        <app-grupo-opcoes
          rotulo="Para quem"
          [opcoes]="opcoesDestino"
          [valor]="destino()"
          (valorChange)="destino.set($event ?? 'pessoa')"
        />

        @if (destino() === 'pessoa') {
          <app-seletor
            rotulo="Pessoa"
            placeholder="Escolha quem vai atender"
            [opcoes]="opcoesPessoa()"
            [valor]="usuarioId()"
            (valorChange)="usuarioId.set($event)"
            [erro]="tentou() && !usuarioId() ? 'Escolha a pessoa.' : null"
            [dica]="
              carregandoPessoas()
                ? 'Carregando quem atende…'
                : 'Entre parênteses, quantas conversas em aberto cada um tem agora.'
            "
          />
        }

        @if (destino() === 'fila' || precisaFila()) {
          <div class="transferir__fila">
            <app-seletor
              [rotulo]="destino() === 'fila' ? 'Fila' : 'Fila da área ' + areaDaPessoa()"
              placeholder="Escolha a fila"
              [opcoes]="opcoesFila()"
              [valor]="filaId()"
              (valorChange)="filaId.set($event)"
              [erro]="tentou() && !filaId() ? 'Escolha a fila.' : null"
              [dica]="
                destino() === 'fila'
                  ? 'Sem pessoa, a conversa entra na distribuição da fila.'
                  : 'A pessoa é de outra área: a conversa vai também para uma fila dessa área.'
              "
            />
            <app-dica
              titulo="Filas"
              texto="As filas organizam as conversas por área (Comercial ou Customer Success), com os prazos de resposta (SLA) e o jeito de distribuir. Quem atende a área vê as conversas sem responsável das filas dela."
            />
          </div>
        }

        <app-area-texto
          rotulo="Nota para quem recebe"
          opcional
          placeholder="Ex.: ela quer a proposta do plano Rede até sexta."
          [linhas]="3"
          [maximoCaracteres]="tamanhoNota"
          [valor]="nota()"
          (valorChange)="nota.set($event)"
          dica="Aparece na conversa (só para a equipe) e no histórico."
        />
      </form>
      <div modal-rodape class="transferir__rodape">
        <button appBotao type="button" variante="contorno" (click)="aberto.set(false)">
          Cancelar
        </button>
        <button
          appBotao
          type="submit"
          form="form-transferir"
          variante="invertido"
          [carregando]="enviando()"
        >
          Transferir
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .transferir {
      display: grid;
      gap: var(--esp-5);
    }

    .transferir__fila {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--esp-1);
      align-items: start;

      app-dica {
        margin-top: 26px;
      }
    }

    .transferir__rodape {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--esp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferirConversa {
  readonly aberto = model(false);
  readonly conversa = input.required<ConversaDetalhe>();
  readonly enviando = input(false);
  readonly transferir = output<Transferencia>();

  private readonly api = inject(AtendimentoApi);
  private readonly estado = inject(EstadoAtendimento);

  protected readonly opcoesDestino = OPCOES_DESTINO;
  protected readonly tamanhoNota = TAMANHO_MAXIMO_NOTA;

  protected readonly destino = signal<Destino>('pessoa');
  protected readonly usuarioId = signal<string | null>(null);
  protected readonly filaId = signal<string | null>(null);
  protected readonly nota = signal('');
  protected readonly tentou = signal(false);
  protected readonly atendentes = signal<readonly Atendente[]>([]);
  protected readonly carregandoPessoas = signal(false);

  protected readonly complemento = computed(() => `· ${this.conversa().contato.nome}`);

  protected readonly opcoesPessoa = computed<readonly OpcaoSeletor<string>[]>(() => {
    const atual = this.conversa().responsavel?.id;
    return this.atendentes()
      .filter((pessoa) => pessoa.id !== atual)
      .map((pessoa) => ({
        valor: pessoa.id,
        rotulo: `${pessoa.nome} · ${pessoa.rotuloPapel} (${pessoa.emAberto})${pessoa.conectado ? ' · online' : ''}`,
      }));
  });

  private readonly pessoa = computed(
    () => this.atendentes().find((item) => item.id === this.usuarioId()) ?? null,
  );

  /** A pessoa escolhida é de outra área que a fila atual: precisa de uma fila da área dela. */
  protected readonly precisaFila = computed(() => {
    const pessoa = this.pessoa();
    const areaFila = this.conversa().fila?.area ?? null;
    return this.destino() === 'pessoa' && !!pessoa?.area && !!areaFila && pessoa.area !== areaFila;
  });

  protected readonly areaDaPessoa = computed(() => {
    const area = this.pessoa()?.area;
    return area ? ROTULO_AREA[area] : '';
  });

  protected readonly opcoesFila = computed<readonly OpcaoSeletor<string>[]>(() => {
    const area = this.precisaFila() ? this.pessoa()?.area : null;
    return this.estado
      .filas()
      .filter((fila) => fila.ativa && (!area || fila.area === area))
      .map((fila) => ({
        valor: fila.id,
        rotulo: fila.id === this.conversa().fila?.id ? `${fila.nome} (a atual)` : fila.nome,
      }));
  });

  constructor() {
    effect(() => {
      if (!this.aberto()) {
        return;
      }
      untracked(() => {
        this.destino.set('pessoa');
        this.usuarioId.set(null);
        this.filaId.set(null);
        this.nota.set('');
        this.tentou.set(false);
        this.carregandoPessoas.set(true);
        this.api.atendentes().subscribe({
          next: (atendentes) => {
            this.atendentes.set(atendentes);
            this.carregandoPessoas.set(false);
          },
          error: () => this.carregandoPessoas.set(false),
        });
      });
    });
  }

  protected confirmar(): void {
    this.tentou.set(true);
    const destino = this.destino();
    const usuarioId = destino === 'pessoa' ? this.usuarioId() : null;
    const filaId = destino === 'fila' || this.precisaFila() ? this.filaId() : null;
    if (
      (destino === 'pessoa' && !usuarioId) ||
      ((destino === 'fila' || this.precisaFila()) && !filaId)
    ) {
      return;
    }
    const nota = this.nota().trim();
    this.transferir.emit({
      ...(usuarioId ? { usuarioId } : {}),
      ...(filaId ? { filaId } : {}),
      ...(nota ? { nota } : {}),
    });
  }
}
