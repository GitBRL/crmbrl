import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { LucideRefreshCw } from '@lucide/angular';

import { AvisosService } from '../../nucleo/avisos.service';
import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { formatarDataHora } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Modal } from '../../ui/modal/modal';
import { Selo } from '../../ui/selo/selo';
import { ArvorePassos } from './arvore-passos';
import { ChatbotApi } from './chatbot.api';
import type { FluxoDetalhe, PassoDefinicao, VersaoCompleta, VersaoDoFluxo } from './chatbot.tipos';

/** Aba “Versões”: cada publicação é guardada; dá para ver os passos e trazer uma de volta ao rascunho. */
@Component({
  selector: 'app-versoes-fluxo',
  imports: [ArvorePassos, Botao, Esqueleto, EstadoVazio, Modal, Selo],
  template: `
    <p class="dica">
      Cada vez que você publica, nasce uma versão que não muda mais. Conversas em andamento terminam
      na versão em que começaram. Restaurar copia uma versão antiga para o rascunho, sem publicar.
    </p>
    @if (erro(); as falha) {
      <app-estado-vazio
        variante="erro"
        [falha]="falha"
        titulo="Não conseguimos carregar as versões"
        [texto]="falha.resumo"
      >
        <button
          appBotao
          type="button"
          variante="invertido"
          [icone]="iconeTentar"
          (click)="carregar()"
        >
          Tentar de novo
        </button>
      </app-estado-vazio>
    } @else if (versoes() === null) {
      <app-esqueleto forma="bloco" altura="64px" [linhas]="3" />
    } @else if (versoes()!.length === 0) {
      <app-estado-vazio
        titulo="Nenhuma versão publicada"
        texto="Quando você publicar o fluxo, a primeira versão aparece aqui."
      />
    } @else {
      <ul class="versoes">
        @for (v of versoes(); track v.id) {
          <li class="versao">
            <div class="versao__texto">
              <p class="versao__titulo">
                Versão {{ v.numero }}
                @if (v.numero === versaoAtual()) {
                  <app-selo variante="menta" tamanho="sm">Publicada agora</app-selo>
                }
              </p>
              <p class="versao__detalhe">
                {{ data(v.publicadaEm) }}
                @if (v.publicadaPor) {
                  · por {{ v.publicadaPor.nome }}
                }
                · {{ v.passos }} {{ v.passos === 1 ? 'passo' : 'passos' }}
                @if (v.emUso > 0) {
                  · {{ v.emUso }} {{ v.emUso === 1 ? 'conversa usando' : 'conversas usando' }}
                }
              </p>
            </div>
            <div class="versao__acoes">
              <button appBotao type="button" variante="contorno" tamanho="sm" (click)="ver(v)">
                Ver passos
              </button>
              @if (podeEditar()) {
                <button
                  appBotao
                  type="button"
                  variante="contorno"
                  tamanho="sm"
                  (click)="restaurar(v)"
                >
                  Restaurar no rascunho
                </button>
              }
            </div>
          </li>
        }
      </ul>
    }

    <app-modal
      [(aberto)]="verAberto"
      [titulo]="'Versão ' + (visualizada()?.numero ?? '')"
      largura="lg"
    >
      @if (visualizada(); as versao) {
        <app-arvore-passos
          [passos]="passosDe(versao)"
          [somenteLeitura]="true"
          [nome]="'Passos da versão ' + versao.numero"
        />
      }
    </app-modal>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-4);
      min-width: 0;
    }

    .dica {
      max-width: 70ch;
      margin: 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .versoes {
      display: grid;
      gap: var(--esp-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .versao {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--esp-3);
      padding: var(--esp-4);
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-lg);
    }

    .versao__titulo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-2);
      margin: 0;
      font: var(--fonte-rotulo);
    }

    .versao__detalhe {
      margin: 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .versao__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersoesFluxo {
  private readonly api = inject(ChatbotApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);

  readonly fluxoId = input.required<string>();
  readonly versaoAtual = input<number | null>(null);
  readonly podeEditar = input(false);
  /** Avisa o editor para recarregar o rascunho que acabou de ser trocado. */
  readonly restaurada = output<FluxoDetalhe>();

  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly versoes = signal<readonly VersaoDoFluxo[] | null>(null);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly verAberto = signal(false);
  protected readonly visualizada = signal<VersaoCompleta | null>(null);

  constructor() {
    queueMicrotask(() => void this.carregar());
  }

  protected async carregar(): Promise<void> {
    this.erro.set(null);
    try {
      this.versoes.set(await this.api.versoes(this.fluxoId()));
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    }
  }

  protected data(valor: string): string {
    return formatarDataHora(valor);
  }

  protected passosDe(versao: VersaoCompleta): readonly PassoDefinicao[] {
    return versao.definicao.passos;
  }

  protected async ver(v: VersaoDoFluxo): Promise<void> {
    try {
      this.visualizada.set(await this.api.versao(this.fluxoId(), v.numero));
      this.verAberto.set(true);
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    }
  }

  protected async restaurar(v: VersaoDoFluxo): Promise<void> {
    let detalhe: FluxoDetalhe | null = null;
    const ok = await this.confirmacao.confirmar({
      titulo: `Restaurar a versão ${v.numero} no rascunho?`,
      mensagem:
        'O rascunho atual será substituído pelos passos desta versão. Nada é publicado: você ainda confere e publica quando quiser.',
      confirmar: 'Restaurar no rascunho',
      executar: async () => {
        detalhe = await this.api.restaurarVersao(this.fluxoId(), v.numero);
      },
    });
    if (ok && detalhe) {
      this.avisos.sucesso(`Versão ${v.numero} copiada para o rascunho.`);
      this.restaurada.emit(detalhe);
    }
  }
}
