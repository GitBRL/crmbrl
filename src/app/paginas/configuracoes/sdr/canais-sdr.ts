import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideRefreshCw } from '@lucide/angular';

import { erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { Selo } from '../../../ui/selo/selo';
import { type OpcaoSeletor, Seletor } from '../../../ui/seletor/seletor';
import { ROTULO_TIPO_CANAL_SDR } from './rotulos';
import { SdrConfigApi } from './sdr.api';
import {
  type AutomacaoQueAvisa,
  type CanalSdr,
  EXPLICACAO_MODO,
  type ModoSdr,
  ROTULO_MODO,
} from './sdr.tipos';

const MODOS: readonly ModoSdr[] = ['DESLIGADO', 'AUTOMATICO', 'SUGESTAO'];

/**
 * Configurações → SDR com IA → Canais: o modo do SDR em cada canal (desligado, automático ou
 * sugestão), mudado na hora, e o aviso das automações que escrevem ao lead novo antes da IA.
 */
@Component({
  selector: 'app-canais-sdr',
  imports: [Botao, Cartao, Esqueleto, EstadoVazio, RouterLink, Selo, Seletor],
  template: `
    <div class="parte">
      @if (erro(); as falha) {
        <app-estado-vazio
          variante="erro"
          titulo="Não conseguimos carregar os canais do SDR"
          [falha]="falha"
          [texto]="falha.resumo"
          [codigo]="falha.ehFalhaDoServidor ? falha.requisicaoId : null"
        >
          <button appBotao type="button" variante="invertido" (click)="carregar()">
            Tentar de novo
          </button>
        </app-estado-vazio>
      } @else if (canais() === null) {
        <app-cartao>
          <div class="esqueleto" aria-busy="true">
            <p class="visualmente-oculto" role="status">Carregando os canais…</p>
            <app-esqueleto largura="35%" />
            <app-esqueleto forma="bloco" altura="56px" />
            <app-esqueleto forma="bloco" altura="56px" />
          </div>
        </app-cartao>
      } @else {
        @if (!iaConfigurada()) {
          <p class="aviso" role="status">
            <strong>A chave da IA ainda não está configurada no servidor.</strong> Os modos abaixo
            ficam salvos, mas a IA só responde depois que a chave for definida.
          </p>
        }
        @if (avisoDeAutomacao() && automacoes().length > 0) {
          <div class="aviso" role="status" data-teste="aviso-automacao">
            <p>
              <strong>Atenção:</strong> há automação ligada que manda mensagem a todo lead novo. Ela
              chega antes da resposta da IA e pode confundir a conversa. Pause ou ajuste:
            </p>
            <ul>
              @for (a of automacoes(); track a.id) {
                <li>
                  <a [routerLink]="['/automacoes', a.id]">{{ a.nome }}</a>
                </li>
              }
            </ul>
          </div>
        }

        <app-cartao>
          <div class="bloco">
            <h3 class="titulo">Como a IA atua em cada canal</h3>
            <p class="texto">
              A IA assume todo lead novo até qualificar. Escolha o modo de cada canal; vale na hora.
            </p>
            <dl class="modos">
              @for (modo of modos; track modo) {
                <div>
                  <dt>{{ rotulo[modo] }}</dt>
                  <dd>{{ explicacao[modo] }}</dd>
                </div>
              }
            </dl>
          </div>
        </app-cartao>

        @if (canais()!.length === 0) {
          <app-estado-vazio
            titulo="Nenhum canal compatível"
            texto="O SDR atua em WhatsApp, WhatsApp oficial, chat do site, Instagram e Messenger. Conecte um canal em Configurações → Canais."
          />
        } @else {
          <ul class="lista" aria-label="Canais e modo do SDR">
            @for (canal of canais(); track canal.canalId) {
              <li class="item">
                <div class="item__textos">
                  <strong>{{ canal.nome }}</strong>
                  <span class="item__meta">
                    {{ tipo(canal.tipo) }}
                    @if (!canal.ativo) {
                      · canal inativo
                    }
                  </span>
                </div>
                <app-seletor
                  class="item__modo"
                  [rotulo]="'Modo no canal ' + canal.nome"
                  [rotuloOculto]="true"
                  [opcoes]="opcoes"
                  [valor]="canal.modo"
                  [desabilitado]="salvando() === canal.canalId"
                  (valorChange)="mudar(canal, $event)"
                />
                <app-selo [variante]="variante(canal.modo)" tamanho="sm" [ponto]="true">{{
                  rotulo[canal.modo]
                }}</app-selo>
              </li>
            }
          </ul>
        }
      }
    </div>
  `,
  styleUrl: './sdr-comum.scss',
  styles: `
    .modos {
      display: grid;
      gap: var(--esp-3);
      margin: 0;

      dt {
        font-weight: 600;
      }

      dd {
        margin: 0;
        color: var(--cor-texto-suave);
      }
    }

    .item__modo {
      flex: 0 1 12rem;
      min-width: 10rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanaisSdr {
  private readonly api = inject(SdrConfigApi);
  private readonly avisos = inject(AvisosService);

  protected readonly modos = MODOS;
  protected readonly rotulo = ROTULO_MODO;
  protected readonly explicacao = EXPLICACAO_MODO;
  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly opcoes: readonly OpcaoSeletor<ModoSdr>[] = MODOS.map((m) => ({
    valor: m,
    rotulo: ROTULO_MODO[m],
  }));

  protected readonly canais = signal<readonly CanalSdr[] | null>(null);
  protected readonly automacoes = signal<readonly AutomacaoQueAvisa[]>([]);
  protected readonly iaConfigurada = signal(true);
  protected readonly erro = signal<ReturnType<typeof erroDaApi> | null>(null);
  /** Id do canal cujo modo está sendo salvo. */
  protected readonly salvando = signal<string | null>(null);
  protected readonly avisoDeAutomacao = computed(() =>
    (this.canais() ?? []).some((c) => c.modo !== 'DESLIGADO'),
  );

  constructor() {
    void this.carregar();
  }

  protected tipo(tipo: string): string {
    return ROTULO_TIPO_CANAL_SDR[tipo] ?? tipo;
  }

  protected variante(modo: ModoSdr) {
    return modo === 'AUTOMATICO' ? 'menta' : modo === 'SUGESTAO' ? 'ciano' : 'neutro';
  }

  protected async carregar(): Promise<void> {
    this.erro.set(null);
    try {
      const [canais, geral, automacoes] = await Promise.all([
        this.api.canais(),
        this.api.geral(),
        this.api.automacoesQueAvisam(),
      ]);
      this.canais.set(canais);
      this.iaConfigurada.set(geral.iaConfigurada);
      this.automacoes.set(automacoes);
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    }
  }

  protected async mudar(canal: CanalSdr, modo: ModoSdr | null): Promise<void> {
    if (modo === null || modo === canal.modo) {
      return;
    }
    this.salvando.set(canal.canalId);
    try {
      await this.api.definirModo(canal.canalId, modo);
      this.canais.update((lista) =>
        (lista ?? []).map((c) => (c.canalId === canal.canalId ? { ...c, modo } : c)),
      );
      this.avisos.sucesso(`${canal.nome}: modo ${ROTULO_MODO[modo].toLowerCase()}.`);
    } catch (falha) {
      this.avisos.erro(falha);
      // Recria a lista para o seletor voltar ao modo que está salvo.
      this.canais.update((lista) => [...(lista ?? [])]);
    } finally {
      this.salvando.set(null);
    }
  }
}
