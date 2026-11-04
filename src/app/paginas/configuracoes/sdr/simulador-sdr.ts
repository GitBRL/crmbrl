import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { LucideRotateCcw, LucideSend } from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../../nucleo/api/erro-api';
import { AreaTexto } from '../../../ui/area-texto/area-texto';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { Selo, type VarianteSelo } from '../../../ui/selo/selo';
import { SdrConfigApi } from './sdr.api';
import {
  type AcaoSdr,
  ROTULO_ACAO,
  ROTULO_TEMPERATURA,
  type TemperaturaSdr,
  type TurnoSimulador,
  type ValorSimulador,
} from './sdr.tipos';

export interface LinhaSimulador {
  readonly id: number;
  readonly papel: 'lead' | 'ia';
  readonly texto: string;
  /** Só nas respostas da IA: o que ela descobriu e decidiu neste turno. */
  readonly turno?: TurnoSimulador;
}

const SUGESTOES: readonly string[] = [
  'Oi, quero saber dos cursos',
  'Quero fazer Administração, presencial, em São Paulo',
  'Quero me matricular',
  'Quero falar com um atendente',
];

export const VARIANTE_TEMPERATURA: Readonly<Record<TemperaturaSdr, VarianteSelo>> = {
  QUENTE: 'coral',
  MORNO: 'lima',
  FRIO: 'ciano',
};

export const VARIANTE_ACAO: Readonly<Record<AcaoSdr, VarianteSelo>> = {
  continuar: 'neutro',
  qualificado: 'menta',
  desqualificado: 'coral',
  passar_humano: 'ciano',
};

/** Explica, em linguagem simples, o que o SDR faria de verdade neste ponto. */
export function efeitoDaAcao(acao: AcaoSdr): string | null {
  switch (acao) {
    case 'qualificado':
      return 'Na conversa real, o negócio iria para o Comercial pelo rodízio, com o resumo.';
    case 'passar_humano':
      return 'Na conversa real, a conversa iria para a equipe, com o resumo.';
    case 'desqualificado':
      return 'Na conversa real, a IA encerraria o atendimento e registraria o motivo.';
    default:
      return null;
  }
}

/**
 * Configurações → SDR com IA → Simulador: conversa de teste com a configuração atual, sem canal
 * e sem gravar no contato. A cada resposta mostra os critérios descobertos, a nota, a temperatura
 * e a ação. Os tokens contam no orçamento do mês.
 */
@Component({
  selector: 'app-simulador-sdr',
  imports: [AreaTexto, Botao, Cartao, Selo],
  template: `
    <div class="parte">
      <app-cartao>
        <div class="bloco">
          <h3 class="titulo">Teste o SDR sem risco</h3>
          <p class="texto">
            Escreva como o lead escreveria. A IA responde com a configuração que está salva agora.
            Nada é enviado a ninguém e nada é gravado em contato ou negócio; os tokens contam no
            orçamento do mês.
          </p>
        </div>
      </app-cartao>

      <app-cartao>
        <div class="bloco">
          <div class="cabecalho-lista">
            <h3 class="titulo" id="sdr-sim-conversa">Conversa de teste</h3>
            <button
              appBotao
              type="button"
              tamanho="sm"
              [icone]="iconeRecomecar"
              [disabled]="linhas().length === 0 || enviando()"
              (click)="recomecar()"
            >
              Recomeçar
            </button>
          </div>

          @if (linhas().length === 0) {
            <p class="texto">Ainda não há mensagens. Escreva abaixo ou use uma sugestão.</p>
          }
          <ol class="conversa" role="log" aria-labelledby="sdr-sim-conversa" aria-live="polite">
            @for (linha of linhas(); track linha.id) {
              <li class="msg" [class.msg--ia]="linha.papel === 'ia'">
                <span class="msg__autor">{{ linha.papel === 'ia' ? 'SDR (IA)' : 'Lead' }}</span>
                <p class="msg__texto">{{ linha.texto }}</p>
                @if (linha.turno; as t) {
                  <div class="analise" [attr.data-teste]="'analise'">
                    <div class="analise__linha">
                      <span class="analise__nota">
                        Nota <strong>{{ t.nota }}</strong
                        >/100
                      </span>
                      <app-selo [variante]="varianteTemperatura[t.temperatura]" tamanho="sm">{{
                        temperatura[t.temperatura]
                      }}</app-selo>
                      <app-selo [variante]="varianteAcao[t.acao]" tamanho="sm">{{
                        acao[t.acao]
                      }}</app-selo>
                    </div>
                    @if (t.criterios.length > 0) {
                      <div>
                        <p class="analise__titulo">Descobertos nesta resposta</p>
                        <ul class="chips">
                          @for (c of t.criterios; track c.chave) {
                            <li class="chip" [class.chip--recusado]="!c.aceito">
                              <strong>{{ c.rotulo }}:</strong> {{ c.valor }}
                              <span class="chip__confianca"
                                >{{ percentual(c.confianca) }}%
                                @if (!c.aceito) {
                                  · {{ c.motivoDaRecusa ?? 'não gravado' }}
                                }
                              </span>
                            </li>
                          }
                        </ul>
                      </div>
                    } @else {
                      <p class="analise__titulo">Nenhum critério novo nesta resposta.</p>
                    }
                    @if (t.faltamObrigatorios.length > 0) {
                      <p class="analise__titulo">
                        Obrigatórios que faltam: {{ t.faltamObrigatorios.join(', ') }}
                      </p>
                    }
                    @if (t.motivo) {
                      <p class="analise__titulo">Motivo: {{ t.motivo }}</p>
                    }
                    @if (t.motivoDaTroca) {
                      <p class="analise__titulo">{{ t.motivoDaTroca }}</p>
                    }
                    @if (efeito(t.acao); as e) {
                      <p class="analise__efeito">{{ e }}</p>
                    }
                  </div>
                }
              </li>
            }
          </ol>
          <span #fim></span>

          @if (enviando()) {
            <p class="texto" role="status">O SDR está respondendo…</p>
          }
          @if (erro(); as falha) {
            <p class="erro" role="alert">
              Não foi possível simular. {{ falha.resumo }}
              @if (falha.status === 503) {
                A chave da IA pode não estar configurada no servidor.
              }
            </p>
          }

          @if (encerrada(); as t) {
            <p class="aviso" role="status">
              A conversa chegou a um ponto final ({{ acao[t.acao].toLowerCase() }}). Toque em
              Recomeçar para testar de novo.
            </p>
          } @else {
            <div class="sugestoes" role="group" aria-label="Sugestões de mensagem">
              @for (s of sugestoes; track s) {
                <button
                  appBotao
                  type="button"
                  tamanho="sm"
                  [disabled]="enviando()"
                  (click)="texto.set(s)"
                >
                  {{ s }}
                </button>
              }
            </div>
            <form
              class="formulario"
              (submit)="$event.preventDefault(); enviar()"
              (keydown.control.enter)="enviar()"
            >
              <app-area-texto
                rotulo="Mensagem do lead"
                dica="Ctrl+Enter também envia."
                [linhas]="2"
                [maximoCaracteres]="2000"
                [(valor)]="texto"
              />
              <div class="rodape">
                <button
                  appBotao
                  type="submit"
                  variante="invertido"
                  [icone]="iconeEnviar"
                  [carregando]="enviando()"
                  [disabled]="!podeEnviar()"
                >
                  Enviar
                </button>
              </div>
            </form>
          }
        </div>
      </app-cartao>
    </div>
  `,
  styleUrl: './sdr-comum.scss',
  styles: `
    .conversa {
      display: grid;
      gap: var(--esp-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .msg {
      display: grid;
      gap: var(--esp-1, 4px);
      justify-self: start;
      max-width: min(100%, 38rem);
      padding: var(--esp-3) var(--esp-4);
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-md);
      background: var(--cor-superficie-2);
    }

    .msg--ia {
      justify-self: end;
      background: var(--cor-superficie);
    }

    .msg__autor {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .msg__texto {
      margin: 0;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    .analise {
      display: grid;
      gap: var(--esp-2);
      margin-block-start: var(--esp-2);
      padding-block-start: var(--esp-3);
      border-block-start: 1px dashed var(--cor-borda);
      font: var(--fonte-corpo-sm);

      p {
        margin: 0;
      }
    }

    .analise__linha {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-2) var(--esp-3);
    }

    .analise__titulo {
      color: var(--cor-texto-suave);
    }

    .analise__efeito {
      font-weight: 600;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
      margin: var(--esp-1, 4px) 0 0;
      padding: 0;
      list-style: none;
    }

    .chip {
      padding: 2px var(--esp-3);
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-pilula);
      overflow-wrap: anywhere;
    }

    .chip--recusado {
      border-style: dashed;
      color: var(--cor-texto-suave);
    }

    .chip__confianca {
      color: var(--cor-texto-suave);
    }

    .sugestoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimuladorSdr {
  private readonly api = inject(SdrConfigApi);
  private readonly fim = viewChild<ElementRef<HTMLElement>>('fim');
  private proximoId = 1;

  protected readonly iconeEnviar = LucideSend;
  protected readonly iconeRecomecar = LucideRotateCcw;
  protected readonly sugestoes = SUGESTOES;
  protected readonly temperatura = ROTULO_TEMPERATURA;
  protected readonly acao = ROTULO_ACAO;
  protected readonly varianteTemperatura = VARIANTE_TEMPERATURA;
  protected readonly varianteAcao = VARIANTE_ACAO;
  protected readonly efeito = efeitoDaAcao;

  protected readonly linhas = signal<readonly LinhaSimulador[]>([]);
  protected readonly texto = signal('');
  protected readonly enviando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  private readonly valores = signal<readonly ValorSimulador[]>([]);

  /** O último turno, quando a conversa já acabou (qualificado, desqualificado, passou). */
  protected readonly encerrada = computed(() => {
    const ultimo = [...this.linhas()].reverse().find((l) => l.turno);
    return ultimo?.turno && ultimo.turno.acao !== 'continuar' ? ultimo.turno : null;
  });
  protected readonly podeEnviar = computed(
    () => !this.enviando() && this.texto().trim().length > 0,
  );

  protected percentual(confianca: number): number {
    return Math.round(confianca * 100);
  }

  protected recomecar(): void {
    this.linhas.set([]);
    this.valores.set([]);
    this.texto.set('');
    this.erro.set(null);
  }

  protected async enviar(): Promise<void> {
    if (!this.podeEnviar()) {
      return;
    }
    const mensagem = this.texto().trim();
    const antes = this.linhas();
    const comLead: readonly LinhaSimulador[] = [
      ...antes,
      { id: this.proximoId++, papel: 'lead', texto: mensagem },
    ];
    this.linhas.set(comLead);
    this.texto.set('');
    this.erro.set(null);
    this.enviando.set(true);
    this.rolar();
    try {
      const turno = await this.api.turnoDoSimulador(
        comLead.map(({ papel, texto }) => ({ papel, texto })),
        this.valores(),
      );
      this.valores.set(turno.valores);
      this.linhas.set([
        ...comLead,
        { id: this.proximoId++, papel: 'ia', texto: turno.resposta, turno },
      ]);
      this.rolar();
    } catch (falha) {
      // A mensagem volta para o campo, para a pessoa tentar de novo sem digitar tudo.
      this.linhas.set(antes);
      this.texto.set(mensagem);
      this.erro.set(erroDaApi(falha));
    } finally {
      this.enviando.set(false);
    }
  }

  private rolar(): void {
    setTimeout(() => this.fim()?.nativeElement.scrollIntoView?.({ block: 'nearest' }));
  }
}
