import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { TrescPlusApi } from '../../nucleo/tresc-plus/tresc-plus.api';
import { TrescPlusService } from '../../nucleo/tresc-plus/tresc-plus.service';
import type { QualificacaoTresc } from '../../nucleo/tresc-plus/tresc-plus.tipos';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { CampoData, localParaIso } from '../../ui/campo-data/campo-data';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Modal } from '../../ui/modal/modal';

/**
 * Qualificação da ligação do 3C+ (R34.5): abre quando chega `tresc.qualificar` (ou o agente
 * está no pós-atendimento). Lista as qualificações da campanha com a cor, a observação e, nas
 * que permitem, o agendamento do retorno. "Depois" fecha sem qualificar: a barra e o painel do
 * agente continuam oferecendo "Qualificar".
 */
@Component({
  selector: 'app-modal-qualificacao',
  imports: [AreaTexto, Botao, CampoData, Esqueleto, Modal],
  template: `
    <app-modal
      titulo="Qualificar a ligação"
      largura="md"
      [aberto]="tresc.modalQualificacaoAberto()"
      (abertoChange)="aoMudarAberto($event)"
    >
      <div class="qual">
        @if (erro() && !lista()) {
          <p class="qual__erro" role="alert">{{ erro()?.mensagem }}</p>
          <button appBotao type="button" tamanho="sm" (click)="carregar()">Tentar de novo</button>
        } @else if (!lista()) {
          <div aria-busy="true">
            <p class="visualmente-oculto" role="status">Carregando as qualificações…</p>
            <app-esqueleto forma="bloco" altura="9rem" />
          </div>
        } @else if (!lista()!.length) {
          <p class="qual__dica">
            Esta campanha não tem qualificações cadastradas no 3C+. Cadastre uma lá e tente de novo.
          </p>
        } @else {
          <fieldset class="qual__grupo">
            <legend class="qual__legenda">Como foi a ligação?</legend>
            @for (q of lista(); track q.id) {
              <label class="qual__opcao" [class.qual__opcao--marcada]="escolhida() === q.id">
                <input
                  type="radio"
                  name="qualificacao"
                  class="visualmente-oculto"
                  [value]="q.id"
                  [checked]="escolhida() === q.id"
                  (change)="escolher(q.id)"
                />
                <span
                  class="qual__cor"
                  [style.background]="q.cor ?? 'var(--cor-texto-fraco)'"
                ></span>
                <span class="qual__nome">{{ q.nome }}</span>
                @if (q.conversao) {
                  <span class="qual__marca">Conversão</span>
                }
              </label>
            }
          </fieldset>
          <app-area-texto
            rotulo="Observação"
            placeholder="O que ficou combinado? (opcional)"
            [linhas]="3"
            [maximoCaracteres]="1000"
            [(valor)]="observacao"
          />
          @if (permiteAgendar()) {
            <app-campo-data
              rotulo="Retorno agendado"
              tipo="data-hora"
              dica="Opcional: o 3C+ devolve o contato à fila nesse horário."
              [(valor)]="agendamento"
            />
          }
          @if (erro(); as falha) {
            <p class="qual__erro" role="alert">{{ falha.mensagem }}</p>
          }
        }
      </div>
      <div modal-rodape class="qual__rodape">
        <button
          appBotao
          type="button"
          variante="contorno"
          (click)="tresc.fecharModalQualificacao()"
        >
          Depois
        </button>
        <button
          appBotao
          type="button"
          variante="invertido"
          [carregando]="enviando()"
          [disabled]="escolhida() === null"
          (click)="enviar()"
        >
          Qualificar
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    :host {
      display: contents;
    }
    .qual {
      display: grid;
      gap: var(--esp-4);
    }
    .qual__grupo {
      display: grid;
      gap: var(--esp-2);
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }
    .qual__legenda {
      margin-bottom: var(--esp-2);
      font-weight: 600;
    }
    .qual__opcao {
      display: flex;
      align-items: center;
      gap: var(--esp-3);
      min-height: 44px;
      padding: var(--esp-2) var(--esp-3);
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-lg);
      cursor: pointer;

      &:has(:focus-visible) {
        outline: 2px solid var(--cor-foco, currentColor);
        outline-offset: 2px;
      }
    }
    .qual__opcao--marcada {
      border-color: var(--cor-texto);
      background: var(--cor-vidro-forte);
    }
    .qual__cor {
      flex: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .qual__nome {
      flex: 1;
      min-width: 0;
    }
    .qual__marca {
      color: var(--cor-texto-suave);
      font-size: 0.75rem;
    }
    .qual__erro {
      margin: 0;
      color: var(--cor-erro);
    }
    .qual__dica {
      margin: 0;
      color: var(--cor-texto-suave);
    }
    .qual__rodape {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--esp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalQualificacao {
  protected readonly tresc = inject(TrescPlusService);
  private readonly api = inject(TrescPlusApi);
  private readonly avisos = inject(AvisosService);

  protected readonly lista = signal<readonly QualificacaoTresc[] | null>(null);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly escolhida = signal<number | null>(null);
  protected readonly observacao = signal('');
  protected readonly agendamento = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly permiteAgendar = computed(
    () => this.lista()?.find((q) => q.id === this.escolhida())?.permiteAgendar ?? false,
  );
  private carregadaPara: string | null = null;

  constructor() {
    effect(() => {
      const aberto = this.tresc.modalQualificacaoAberto();
      const pendente = this.tresc.qualificacaoPendente();
      untracked(() => {
        if (aberto && pendente && this.carregadaPara !== pendente.ligacaoId) {
          this.carregadaPara = pendente.ligacaoId;
          this.limpar();
          void this.carregar();
        }
        if (!pendente) {
          this.carregadaPara = null;
        }
      });
    });
  }

  protected aoMudarAberto(aberto: boolean): void {
    if (!aberto) {
      this.tresc.fecharModalQualificacao();
    }
  }

  protected escolher(id: number): void {
    this.escolhida.set(id);
    if (!this.permiteAgendar()) {
      this.agendamento.set(null);
    }
  }

  protected async carregar(): Promise<void> {
    const pendente = this.tresc.qualificacaoPendente();
    if (!pendente) {
      return;
    }
    this.erro.set(null);
    try {
      this.lista.set(await this.api.qualificacoes(pendente.ligacaoId));
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    }
  }

  protected async enviar(): Promise<void> {
    const pendente = this.tresc.qualificacaoPendente();
    const qualificacaoId = this.escolhida();
    if (!pendente || qualificacaoId === null || this.enviando()) {
      return;
    }
    const agendarPara = this.permiteAgendar()
      ? localParaIso(this.agendamento(), 'data-hora')
      : null;
    this.enviando.set(true);
    this.erro.set(null);
    try {
      await this.api.qualificar(pendente.ligacaoId, {
        qualificacaoId,
        ...(this.observacao().trim() ? { observacao: this.observacao().trim() } : {}),
        ...(agendarPara ? { agendarPara } : {}),
      });
      this.tresc.qualificada();
      this.avisos.sucesso('Ligação qualificada.');
      void this.tresc.carregar();
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    } finally {
      this.enviando.set(false);
    }
  }

  private limpar(): void {
    this.lista.set(null);
    this.erro.set(null);
    this.escolhida.set(null);
    this.observacao.set('');
    this.agendamento.set(null);
  }
}
