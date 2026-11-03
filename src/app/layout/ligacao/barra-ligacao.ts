import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideChevronUp,
  LucideCircleDot,
  LucideDynamicIcon,
  LucideMic,
  LucideMicOff,
  LucidePhoneOff,
  LucideSlidersHorizontal,
  LucideTriangleAlert,
  LucideX,
} from '@lucide/angular';

import { atalhoAria, ehAtalho, rotuloDoAtalho } from '../../nucleo/atalhos/atalhos';
import { LigacaoService } from '../../nucleo/ligacoes/ligacao.service';
import {
  duracaoPorExtenso,
  formatarDuracao,
  formatarTelefone,
} from '../../nucleo/ligacoes/ligacoes.textos';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Seletor } from '../../ui/seletor/seletor';

/** Valor do seletor para "usar o padrão do sistema". */
const PADRAO = '__padrao__';

/**
 * Barra da ligação (Onda E, E2): fica fixa no pé da tela, em qualquer página, enquanto a
 * ligação existe (navegar não a derruba). Mostra quem é, o estado e o tempo, o mudo, o
 * **Encerrar**, o aviso de conexão ruim e, no painel que abre ("Ajustes"), a escolha de
 * microfone e alto-falante e a anotação rápida (gravada na atividade da ligação). No celular
 * vira uma faixa compacta que expande. Depois que a ligação termina, o resultado fica na barra
 * por alguns segundos.
 *
 * Atalhos: **Alt+E** encerra e **Alt+S** (silenciar) liga e desliga o mudo; no Mac são
 * **Control+Shift+E** e **Control+Shift+S** (ver `nucleo/atalhos`). O M ficou livre para a página
 * do Atendimento (Alt+M: escrever a mensagem). O lugar do indicador "Gravando"
 * (E3) já existe: o `LigacaoService.definirGravando()` o acende.
 */
@Component({
  selector: 'app-barra-ligacao',
  imports: [RouterLink, LucideDynamicIcon, AreaTexto, Avatar, Botao, BotaoIcone, Seletor],
  host: { '(document:keydown)': 'aoTeclar($event)' },
  template: `
    @if (curso(); as c) {
      <section
        class="barra"
        [class.barra--aberta]="aberta()"
        [class.barra--alerta]="!!alerta()"
        aria-label="Ligação em andamento"
      >
        <div class="barra__linha">
          <app-avatar class="barra__avatar" [nome]="c.contato.nome" decorativo />
          <div class="barra__quem">
            <p class="barra__nome">
              <a [routerLink]="['/contatos', c.contato.id]">{{ c.contato.nome }}</a>
            </p>
            <p class="barra__estado">
              <span class="barra__texto">{{ estadoTexto() }}</span>
              @if (c.inicioEm !== null && c.fase !== 'encerrando') {
                <time class="barra__tempo" [attr.aria-label]="tempoFalado()">{{ tempo() }}</time>
              }
              @if (gravando()) {
                <span class="barra__gravando">
                  <svg [lucideIcon]="icones.gravando" [size]="12" aria-hidden="true" />
                  Gravando
                </span>
              }
            </p>
          </div>
          <div class="barra__acoes">
            <button
              appBotaoIcone
              type="button"
              [variante]="mudo() ? 'invertido' : 'contorno'"
              [icone]="mudo() ? icones.mudo : icones.microfone"
              [rotulo]="
                mudo()
                  ? 'Ligar o microfone (' + atalhoMudo + ')'
                  : 'Silenciar o microfone (' + atalhoMudo + ')'
              "
              [attr.aria-pressed]="mudo()"
              [attr.aria-keyshortcuts]="ariaMudo"
              [disabled]="!podeAgir()"
              (click)="ligacoes.alternarMudo()"
            ></button>
            <button
              appBotaoIcone
              type="button"
              variante="contorno"
              [icone]="icones.ajustes"
              rotulo="Ajustes: microfone, alto-falante e anotação"
              aria-controls="barra-ligacao-ajustes"
              [attr.aria-expanded]="aberta()"
              (click)="aberta.set(!aberta())"
            ></button>
            <button
              appBotao
              class="barra__encerrar"
              type="button"
              variante="destaque"
              [icone]="icones.encerrar"
              [attr.aria-keyshortcuts]="ariaEncerrar"
              [disabled]="c.fase === 'encerrando'"
              (click)="ligacoes.encerrar()"
            >
              <span class="barra__encerrar-texto">{{
                c.fase === 'preparando' ? 'Cancelar' : 'Encerrar'
              }}</span>
            </button>
          </div>
          <button
            type="button"
            class="barra__expandir"
            [attr.aria-expanded]="aberta()"
            aria-controls="barra-ligacao-ajustes"
            aria-label="Mostrar ou esconder os ajustes da ligação"
            (click)="aberta.set(!aberta())"
          >
            <svg [lucideIcon]="icones.expandir" [size]="18" aria-hidden="true" />
          </button>
        </div>

        <p class="visualmente-oculto" role="status">{{ anuncio() }}</p>

        @if (gravando()) {
          <p class="barra__lembrete">
            <svg [lucideIcon]="icones.aviso" [size]="16" aria-hidden="true" />
            <span>
              Esta ligação está sendo gravada. Avise o cliente no início da conversa.
              @if (gravacaoComFalha()) {
                <strong>O envio da gravação está falhando; seguimos tentando.</strong>
              }
            </span>
          </p>
        }

        @if (alerta(); as texto) {
          <p class="barra__alerta" role="alert">
            <svg [lucideIcon]="icones.aviso" [size]="16" aria-hidden="true" />
            {{ texto }}
          </p>
        }

        @if (aberta()) {
          <div id="barra-ligacao-ajustes" class="barra__ajustes">
            @if (c.semAudioNestaAba) {
              <p class="barra__nota">
                Esta ligação está aberta em outra aba ou perdeu o áudio ao recarregar a página. Só
                dá para encerrá-la daqui.
              </p>
            } @else {
              <div class="barra__dispositivos">
                <app-seletor
                  rotulo="Microfone"
                  [opcoes]="opcoesMicrofone()"
                  [valor]="ligacoes.microfoneId() ?? padrao"
                  (valorChange)="trocarMicrofone($event)"
                />
                @if (ligacoes.suportaAltoFalante) {
                  <app-seletor
                    rotulo="Alto-falante"
                    [opcoes]="opcoesAltoFalante()"
                    [valor]="ligacoes.altoFalanteId() ?? padrao"
                    (valorChange)="trocarAltoFalante($event)"
                  />
                }
              </div>
            }
            @if (c.id) {
              <div class="barra__anotacao">
                <app-area-texto
                  rotulo="Anotação rápida"
                  [linhas]="3"
                  [maximoCaracteres]="5000"
                  placeholder="O que o cliente pediu, combinados, próximos passos…"
                  [valor]="ligacoes.anotacao()"
                  (valorChange)="ligacoes.anotar($event)"
                />
                <p class="barra__dica" aria-live="polite">
                  @switch (ligacoes.situacaoDaAnotacao()) {
                    @case ('salvando') {
                      Salvando…
                    }
                    @case ('salva') {
                      Salva na atividade da ligação.
                    }
                    @case ('erro') {
                      Não foi possível salvar. Tentaremos de novo ao encerrar.
                    }
                    @default {
                      Vai para a descrição da atividade desta ligação.
                    }
                  }
                </p>
              </div>
            }
          </div>
        }
      </section>
    } @else if (fim(); as f) {
      <section
        class="barra barra--fim"
        [class.barra--erro]="f.tom === 'erro'"
        aria-label="Resultado da ligação"
      >
        <div class="barra__linha">
          <app-avatar class="barra__avatar" [nome]="f.contato.nome" decorativo />
          <div class="barra__quem">
            <p class="barra__nome">
              <a [routerLink]="['/contatos', f.contato.id]">{{ f.contato.nome }}</a>
            </p>
            <p class="barra__estado" role="status">{{ f.texto }}</p>
            @if (f.estado === 'ENCERRADA') {
              <p class="barra__lembrete">
                <a [routerLink]="['/atendimento', 'ligacoes', f.ligacaoId]">
                  Ver gravação, transcrição e resumo
                </a>
              </p>
            }
          </div>
          <div class="barra__acoes">
            <button
              appBotaoIcone
              type="button"
              variante="contorno"
              [icone]="icones.fechar"
              rotulo="Fechar o resultado da ligação"
              (click)="ligacoes.fecharFim()"
            ></button>
          </div>
        </div>
      </section>
    }
  `,
  styleUrl: './barra-ligacao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarraLigacao {
  protected readonly ligacoes = inject(LigacaoService);

  protected readonly icones = {
    microfone: LucideMic,
    mudo: LucideMicOff,
    encerrar: LucidePhoneOff,
    ajustes: LucideSlidersHorizontal,
    expandir: LucideChevronUp,
    aviso: LucideTriangleAlert,
    gravando: LucideCircleDot,
    fechar: LucideX,
  };
  protected readonly padrao = PADRAO;
  protected readonly aberta = signal(false);
  protected readonly curso = this.ligacoes.emCurso;
  protected readonly fim = this.ligacoes.fim;
  protected readonly mudo = this.ligacoes.mudo;
  protected readonly alerta = this.ligacoes.alerta;
  protected readonly gravando = this.ligacoes.gravando;
  protected readonly gravacaoComFalha = this.ligacoes.gravacaoComFalha;

  protected readonly podeAgir = computed(() => {
    const c = this.curso();
    return !!c && !c.semAudioNestaAba && c.fase !== 'encerrando';
  });
  protected readonly tempo = computed(() => formatarDuracao(this.ligacoes.segundos()));
  protected readonly tempoFalado = computed(() => duracaoPorExtenso(this.ligacoes.segundos()));
  protected readonly estadoTexto = computed(() => {
    const c = this.curso();
    if (!c) {
      return '';
    }
    switch (c.fase) {
      case 'preparando':
        return 'Preparando o microfone…';
      case 'conectando':
        return 'Conectando…';
      case 'chamando':
        return 'Chamando…';
      case 'tocando':
        return 'Tocando no WhatsApp do cliente…';
      case 'encerrando':
        return 'Encerrando…';
      default:
        return c.semAudioNestaAba ? 'Em andamento (sem áudio nesta aba)' : 'Em ligação';
    }
  });
  /** Só anuncia mudanças de fase (não os segundos do cronômetro). */
  protected readonly anuncio = computed(() => {
    const c = this.curso();
    if (!c) {
      return '';
    }
    const quem = formatarTelefone(c.contato.telefone);
    return `${this.estadoTexto()} ${c.contato.nome}, ${quem}.${this.mudo() ? ' Microfone silenciado.' : ''}`;
  });

  protected readonly opcoesMicrofone = computed(() => [
    { valor: PADRAO, rotulo: 'Padrão do sistema' },
    ...this.ligacoes.microfones().map((item) => ({ valor: item.id, rotulo: item.rotulo })),
  ]);
  protected readonly opcoesAltoFalante = computed(() => [
    { valor: PADRAO, rotulo: 'Padrão do sistema' },
    ...this.ligacoes.altoFalantes().map((item) => ({ valor: item.id, rotulo: item.rotulo })),
  ]);

  protected trocarMicrofone(valor: string | null): void {
    void this.ligacoes.escolherMicrofone(!valor || valor === PADRAO ? null : valor);
  }

  protected trocarAltoFalante(valor: string | null): void {
    void this.ligacoes.escolherAltoFalante(!valor || valor === PADRAO ? null : valor);
  }

  protected readonly atalhoMudo = rotuloDoAtalho('S');
  protected readonly ariaMudo = atalhoAria('S');
  protected readonly ariaEncerrar = atalhoAria('E');

  protected aoTeclar(evento: KeyboardEvent): void {
    if (!this.curso()) {
      return;
    }
    if (ehAtalho(evento, 'E')) {
      evento.preventDefault();
      void this.ligacoes.encerrar();
    } else if (ehAtalho(evento, 'S')) {
      evento.preventDefault();
      this.ligacoes.alternarMudo();
    }
  }
}
