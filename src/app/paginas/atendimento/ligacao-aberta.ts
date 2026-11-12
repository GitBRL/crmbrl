import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideMessageSquare } from '@lucide/angular';
import { map } from 'rxjs';

import { formatarDataHora } from '../../nucleo/formatos';
import { LigacoesApi } from '../../nucleo/ligacoes/ligacoes.api';
import {
  duracaoPorExtenso,
  formatarDuracao,
  formatarTelefone,
} from '../../nucleo/ligacoes/ligacoes.textos';
import type { Ligacao } from '../../nucleo/ligacoes/ligacoes.tipos';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Botao } from '../../ui/botao/botao';
import { Selo } from '../../ui/selo/selo';
import { Carregamento } from '../configuracoes/carregamento';
import {
  resultadoDoEstado,
  ROTULO_DIRECAO,
  ROTULO_RESULTADO,
  VARIANTE_RESULTADO,
} from './ligacoes/historico.logica';
import { PainelLigacao } from './painel-ligacao/painel-ligacao';

/**
 * Uma ligação aberta no Atendimento (`/atendimento/ligacoes/:ligacaoId`, Onda E): quem, quando,
 * como terminou e, abaixo, o painel da E3 (gravação, transcrição, resumo e anotação). A busca do
 * histórico chega em `?busca=` e já vem digitada na transcrição. É a mesma tela que a linha do
 * tempo do contato abre.
 */
@Component({
  selector: 'app-ligacao-aberta',
  imports: [RouterLink, Botao, BotaoIcone, PainelLigacao, Selo],
  template: `
    <article class="ligacao" aria-label="Ligação">
      <header class="ligacao__cabeca">
        <a
          class="ligacao__voltar"
          appBotaoIcone
          variante="contorno"
          routerLink="/atendimento/ligacoes"
          rotulo="Voltar para a lista de ligações"
          [icone]="icones.voltar"
        ></a>
        @if (ligacao(); as l) {
          <div class="ligacao__titulo">
            <h2>
              <a [routerLink]="['/contatos', l.contato.id]">{{ l.contato.nome }}</a>
            </h2>
            <p class="ligacao__sub">
              {{ telefone(l) }}
              @if (l.contato.empresa) {
                · {{ l.contato.empresa }}
              }
            </p>
          </div>
          @if (l.conversaId) {
            <a
              appBotao
              variante="contorno"
              tamanho="sm"
              [icone]="icones.conversa"
              [routerLink]="['/atendimento', l.conversaId]"
              >Ver a conversa</a
            >
          }
        } @else {
          <h2 class="ligacao__titulo-simples">Ligação</h2>
        }
      </header>
      @if (ligacao(); as l) {
        <dl class="ligacao__dados">
          <div>
            <dt>Resultado</dt>
            <dd>
              <app-selo [variante]="variante(l)">{{ resultado(l) }}</app-selo>
              {{ direcao(l) }}
            </dd>
          </div>
          <div>
            <dt>Começou em</dt>
            <dd class="numeros">{{ inicio(l) }}</dd>
          </div>
          @if (l.estado === 'ENCERRADA') {
            <div>
              <dt>Duração</dt>
              <dd class="numeros" [attr.aria-label]="duracaoFalada(l)">{{ duracao(l) }}</dd>
            </div>
          }
          <div>
            <dt>Atendente</dt>
            <dd>{{ l.atendente?.nome ?? 'Sem atendente' }}</dd>
          </div>
          @if (l.provedor === 'TRESC_PLUS') {
            <div>
              <dt>Origem</dt>
              <dd><app-selo tamanho="sm" variante="ciano">3C+</app-selo></dd>
            </div>
            @if (l.campanha?.nome; as campanha) {
              <div>
                <dt>Campanha</dt>
                <dd>{{ campanha }}</dd>
              </div>
            }
            @if (l.qualificacao; as q) {
              <div>
                <dt>Qualificação</dt>
                <dd>{{ q.nome }}{{ q.observacao ? ' · ' + q.observacao : '' }}</dd>
              </div>
            }
          } @else {
            <div>
              <dt>Canal</dt>
              <dd>{{ l.canal?.nome }}</dd>
            </div>
          }
          @if (l.motivoTexto && l.estado !== 'ENCERRADA') {
            <div class="ligacao__motivo">
              <dt>O que aconteceu</dt>
              <dd>{{ l.motivoTexto }}</dd>
            </div>
          }
        </dl>
      }
      @if (ligacaoId(); as id) {
        <app-painel-ligacao [ligacaoId]="id" [buscaInicial]="busca()" />
      }
    </article>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      min-height: 0;
      overflow: auto;
      border-radius: var(--raio-cartao);
      background: var(--gradiente-palco);
      box-shadow: var(--sombra-cartao);
    }
    .ligacao {
      display: grid;
      gap: var(--esp-4);
      padding: var(--esp-5);
    }
    .ligacao__cabeca {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-3);
      align-items: center;
    }
    .ligacao__voltar {
      display: none;
    }
    .ligacao__titulo {
      flex: 1 1 12rem;
      min-width: 0;
    }
    h2,
    .ligacao__titulo-simples {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: 1.125rem;
    }
    h2 a {
      color: inherit;
    }
    .ligacao__sub {
      margin: 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda);
    }
    .ligacao__dados {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: var(--esp-3) var(--esp-4);
      margin: 0;
      padding: var(--esp-4);
      border-radius: var(--raio-lg);
      background: var(--cor-superficie);
      box-shadow: inset 0 0 0 1px var(--cor-borda);

      div {
        display: grid;
        gap: 2px;
        min-width: 0;
      }
      dt {
        color: var(--cor-texto-suave);
        font: var(--fonte-legenda);
      }
      dd {
        margin: 0;
        overflow-wrap: anywhere;
        font: var(--fonte-corpo);
      }
    }
    .ligacao__motivo {
      grid-column: 1 / -1;
    }
    @media (max-width: 767px) {
      .ligacao {
        padding: var(--esp-3);
      }
      .ligacao__voltar {
        display: inline-flex;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LigacaoAberta {
  private readonly rota = inject(ActivatedRoute);
  private readonly api = inject(LigacoesApi);
  private readonly parametros = toSignal(this.rota.paramMap.pipe(map((p) => p.get('ligacaoId'))), {
    initialValue: this.rota.snapshot.paramMap.get('ligacaoId'),
  });
  private readonly consulta = toSignal(this.rota.queryParamMap.pipe(map((p) => p.get('busca'))), {
    initialValue: this.rota.snapshot.queryParamMap.get('busca'),
  });
  private readonly carga = new Carregamento<Ligacao>();

  protected readonly icones = { voltar: LucideArrowLeft, conversa: LucideMessageSquare };
  protected readonly ligacaoId = computed(() => this.parametros());
  protected readonly busca = computed(() => this.consulta() ?? '');
  protected readonly ligacao = computed(() => {
    const l = this.carga.dados();
    return l && l.id === this.ligacaoId() ? l : null;
  });

  constructor() {
    // O painel cuida do próprio erro; aqui só o cabeçalho, que não aparece se a leitura falhar.
    effect(() => {
      const id = this.ligacaoId();
      if (id) {
        untracked(() => void this.carga.executar(() => this.api.detalhar(id)));
      }
    });
  }

  protected telefone(l: Ligacao): string {
    return formatarTelefone(l.contato.telefone);
  }

  protected resultado(l: Ligacao): string {
    return ROTULO_RESULTADO[resultadoDoEstado(l.estado)];
  }

  protected variante(l: Ligacao) {
    return VARIANTE_RESULTADO[resultadoDoEstado(l.estado)];
  }

  protected direcao(l: Ligacao): string {
    return `· ${ROTULO_DIRECAO[l.direcao]}`;
  }

  protected inicio(l: Ligacao): string {
    return formatarDataHora(l.iniciadaEm);
  }

  protected duracao(l: Ligacao): string {
    return formatarDuracao(l.duracaoSegundos);
  }

  protected duracaoFalada(l: Ligacao): string {
    return duracaoPorExtenso(l.duracaoSegundos ?? 0);
  }
}
