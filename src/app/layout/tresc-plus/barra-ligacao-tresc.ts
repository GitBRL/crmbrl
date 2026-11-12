import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon, LucidePhoneOff, LucideTriangleAlert } from '@lucide/angular';

import { LigacaoService } from '../../nucleo/ligacoes/ligacao.service';
import { formatarTelefone } from '../../nucleo/ligacoes/ligacoes.textos';
import { usarRelogio } from '../../nucleo/tresc-plus/relogio';
import { TrescPlusService } from '../../nucleo/tresc-plus/tresc-plus.service';
import {
  cronometroFalado,
  formatarCronometro,
  LIGACAO_TRESC_TERMINAL,
  ROTULO_LIGACAO_TRESC,
  segundosDesde,
} from '../../nucleo/tresc-plus/tresc-plus.textos';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { Selo } from '../../ui/selo/selo';

/**
 * Barra da ligação do 3C+ em curso (R34.8): fixa no pé da tela, em qualquer página. Mostra o
 * contato (ou o número), o estado, o tempo e o **Desligar**. "Entrando na campanha…" aparece
 * enquanto a API põe o vendedor na campanha para ligar. Depois que a ligação termina, o
 * resultado fica por alguns segundos (ou até a qualificação).
 */
@Component({
  selector: 'app-barra-ligacao-tresc',
  imports: [RouterLink, Avatar, Botao, LucideDynamicIcon, Selo],
  host: { '[class.com-ligacao-whatsapp]': 'whatsapp.emCurso() !== null' },
  template: `
    @if (tresc.entrando()) {
      <section class="barra" aria-label="Ligação pelo 3C+">
        <p class="barra__estado" role="status">Entrando na campanha…</p>
      </section>
    } @else if (tresc.ligacao(); as l) {
      <section class="barra" [class.barra--erro]="falhou()" aria-label="Ligação pelo 3C+">
        <div class="barra__linha">
          <app-avatar class="barra__avatar" [nome]="titulo()" decorativo />
          <div class="barra__quem">
            <p class="barra__nome">
              @if (l.contatoId) {
                <a [routerLink]="['/contatos', l.contatoId]">{{ titulo() }}</a>
              } @else {
                {{ titulo() }}
              }
              <app-selo tamanho="sm" variante="ciano">3C+</app-selo>
            </p>
            <p class="barra__estado" role="status">
              @if (falhou()) {
                <svg [lucideIcon]="icones.alerta" [size]="14" aria-hidden="true" />
              }
              <span>{{ estadoTexto() }}</span>
              @if (contando()) {
                <time class="numeros" [attr.aria-label]="tempoFalado()">{{ tempo() }}</time>
              }
            </p>
          </div>
          @if (!terminal()) {
            <button
              appBotao
              type="button"
              variante="invertido"
              [icone]="icones.desligar"
              [carregando]="tresc.agindo()"
              (click)="tresc.desligar()"
            >
              Desligar
            </button>
          } @else if (tresc.qualificacaoPendente() && !tresc.modalQualificacaoAberto()) {
            <button appBotao type="button" variante="invertido" (click)="qualificar()">
              Qualificar
            </button>
          }
        </div>
      </section>
    }
  `,
  styleUrl: './barra-ligacao-tresc.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarraLigacaoTresc {
  protected readonly tresc = inject(TrescPlusService);
  protected readonly whatsapp = inject(LigacaoService);
  protected readonly icones = { desligar: LucidePhoneOff, alerta: LucideTriangleAlert };

  private readonly relogio = usarRelogio(() => this.tresc.ligacao() !== null);
  protected readonly terminal = computed(() => {
    const l = this.tresc.ligacao();
    return l !== null && LIGACAO_TRESC_TERMINAL.includes(l.estado);
  });
  protected readonly falhou = computed(() => {
    const estado = this.tresc.ligacao()?.estado;
    return estado === 'FALHOU' || estado === 'PERDIDA' || estado === 'SEM_RESPOSTA';
  });
  protected readonly titulo = computed(() => {
    const l = this.tresc.ligacao();
    return l?.nome ?? (l?.telefone ? formatarTelefone(l.telefone) : 'Ligação pelo 3C+');
  });
  protected readonly estadoTexto = computed(() => {
    const l = this.tresc.ligacao();
    if (!l) {
      return '';
    }
    const base = ROTULO_LIGACAO_TRESC[l.estado];
    if (l.estado === 'ENCERRADA' && this.tresc.qualificacaoPendente()) {
      return 'Encerrada. Qualifique a ligação.';
    }
    return l.motivoTexto && this.falhou() ? `${base}: ${l.motivoTexto}` : base;
  });
  protected readonly segundos = computed(() => {
    const l = this.tresc.ligacao();
    if (!l) {
      return 0;
    }
    if (this.terminal() && l.duracaoSegundos !== null) {
      return l.duracaoSegundos;
    }
    return segundosDesde(l.atendidaEm, this.relogio());
  });
  protected readonly contando = computed(() => {
    const l = this.tresc.ligacao();
    return (
      l !== null && (l.estado === 'EM_ANDAMENTO' || (this.terminal() && l.atendidaEm !== null))
    );
  });
  protected readonly tempo = computed(() => formatarCronometro(this.segundos()));
  protected readonly tempoFalado = computed(() => cronometroFalado(this.segundos()));

  protected qualificar(): void {
    const pendente = this.tresc.qualificacaoPendente();
    if (pendente) {
      this.tresc.pedirQualificacao(pendente.ligacaoId, pendente.campanhaId);
    }
  }
}
