import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { LucideSend, LucideSparkles } from '@lucide/angular';

import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { Dica } from '../../ui/dica/dica';
import { gerarId } from '../../ui/tipos';
import type { AcaoSdr, SugestaoDoSdr } from './sdr.tipos';

const O_QUE_A_IA_PROPOE: Readonly<Partial<Record<AcaoSdr, string>>> = {
  QUALIFICADO: 'Ao enviar, o lead também é qualificado e o negócio vai para o Comercial.',
  DESQUALIFICADO: 'Ao enviar, o lead também é marcado como desqualificado.',
  PASSAR_HUMANO: 'Ao enviar, a conversa também passa para a equipe.',
};

/**
 * Painel da resposta sugerida pela IA (modo sugestão), acima do compositor: enviar como está,
 * editar e enviar ou descartar. Atualiza sozinho quando chega outra sugestão (`sugestao` muda) e
 * avisa o leitor de tela. A edição em andamento é descartada se a sugestão for trocada.
 */
@Component({
  selector: 'app-painel-sugestao',
  imports: [AreaTexto, Botao, Dica, LucideSparkles],
  template: `
    @if (sugestao(); as s) {
      <section class="sug" [attr.aria-labelledby]="idTitulo" role="region">
        <header class="sug__cabecalho">
          <span class="sug__icone" aria-hidden="true"><svg lucideSparkles [size]="16" /></span>
          <h3 class="sug__titulo" [id]="idTitulo">Resposta sugerida pela IA</h3>
          <app-dica
            rotulo="Sobre a resposta sugerida"
            titulo="Modo sugestão"
            texto="Neste canal a IA não responde sozinha: ela escreve a resposta e uma pessoa decide. Enviar manda o texto ao lead como se fosse você; Descartar não manda nada."
          />
        </header>

        <div aria-live="polite" aria-atomic="true">
          @if (editando()) {
            <app-area-texto
              rotulo="Edite a resposta antes de enviar"
              [(valor)]="rascunho"
              [linhas]="3"
              [maximoLinhas]="8"
              [maximoCaracteres]="4000"
            />
          } @else {
            <p class="sug__texto">{{ s.texto }}</p>
          }
        </div>

        @if (propoe(); as proposta) {
          <p class="sug__nota">{{ proposta }}</p>
        }
        @if (s.motivo) {
          <p class="sug__nota">Motivo da IA: {{ s.motivo }}</p>
        }

        <div class="sug__acoes">
          @if (editando()) {
            <button
              appBotao
              type="button"
              tamanho="sm"
              variante="invertido"
              [icone]="icones.enviar"
              [carregando]="ocupado() === 'enviar'"
              [disabled]="!podeEnviarEditada()"
              (click)="enviarEditada()"
            >
              Enviar editada
            </button>
            <button
              appBotao
              type="button"
              tamanho="sm"
              variante="contorno"
              [disabled]="!!ocupado()"
              (click)="editando.set(false)"
            >
              Cancelar edição
            </button>
          } @else {
            <button
              appBotao
              type="button"
              tamanho="sm"
              variante="invertido"
              [icone]="icones.enviar"
              [carregando]="ocupado() === 'enviar'"
              [disabled]="!!ocupado()"
              (click)="enviar.emit(undefined)"
            >
              Enviar
            </button>
            <button
              appBotao
              type="button"
              tamanho="sm"
              variante="contorno"
              [disabled]="!!ocupado()"
              (click)="comecarEdicao()"
            >
              Editar e enviar
            </button>
            <button
              appBotao
              type="button"
              tamanho="sm"
              variante="contorno"
              [carregando]="ocupado() === 'descartar'"
              [disabled]="!!ocupado()"
              (click)="descartar.emit()"
            >
              Descartar
            </button>
          }
        </div>
      </section>
    }
  `,
  styleUrl: './painel-sugestao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PainelSugestao {
  readonly sugestao = input<SugestaoDoSdr | null>(null);
  /** Qual ação está em andamento (desabilita os botões e mostra o giro). */
  readonly ocupado = input<string | null>(null);

  /** `undefined` = enviar o texto sugerido; com texto, a versão editada. */
  readonly enviar = output<string | undefined>();
  readonly descartar = output<void>();

  protected readonly idTitulo = gerarId('sugestao');
  protected readonly icones = { enviar: LucideSend };
  protected readonly editando = signal(false);
  protected readonly rascunho = signal('');
  protected readonly podeEnviarEditada = computed(
    () => !this.ocupado() && this.rascunho().trim().length > 0,
  );
  private readonly idDaSugestao = computed(() => this.sugestao()?.id ?? null);
  protected readonly propoe = computed(() => {
    const acao = this.sugestao()?.acao;
    return acao ? (O_QUE_A_IA_PROPOE[acao] ?? null) : null;
  });

  constructor() {
    // Outra sugestão chegou: sai da edição, que era da anterior.
    effect(() => {
      this.idDaSugestao();
      untracked(() => this.editando.set(false));
    });
  }

  protected comecarEdicao(): void {
    this.rascunho.set(this.sugestao()?.texto ?? '');
    this.editando.set(true);
  }

  protected enviarEditada(): void {
    const texto = this.rascunho().trim();
    if (texto) {
      this.enviar.emit(texto);
    }
  }
}
