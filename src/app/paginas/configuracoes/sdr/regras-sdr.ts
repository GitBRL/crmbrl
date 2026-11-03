import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideRefreshCw, LucideSave } from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { formatarNumero } from '../../../nucleo/formatos';
import { Alternador } from '../../../ui/alternador/alternador';
import { Botao } from '../../../ui/botao/botao';
import { CampoTexto } from '../../../ui/campo-texto/campo-texto';
import { Cartao } from '../../../ui/cartao/cartao';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { type OpcaoSeletor, Seletor } from '../../../ui/seletor/seletor';
import { inteiroDoCampo, textoOuNulo } from './rotulos';
import { SdrConfigApi } from './sdr.api';
import type { ConfiguracaoSdr, RegrasPassagem, UsoSdr } from './sdr.tipos';

/** Confere um inteiro entre `min` e `max`; `null` se serve. */
export function erroDeInteiro(
  valor: string | number | null,
  min: number,
  max: number,
  opcional = false,
): string | null {
  const n = inteiroDoCampo(valor);
  if (n === null) {
    return opcional ? null : 'Informe um número.';
  }
  if (Number.isNaN(n)) {
    return 'Use um número inteiro.';
  }
  return n < min || n > max
    ? `Use um valor de ${formatarNumero(min)} a ${formatarNumero(max)}.`
    : null;
}

/** Temperatura: quente acima de morno; a nota mínima de qualificado vale de 0 a 100. */
export function erroDeFaixas(quente: number, morno: number): string | null {
  return morno >= quente ? 'A nota de lead morno precisa ser menor que a de lead quente.' : null;
}

/**
 * Configurações → SDR com IA → Temperatura e limites: faixas de nota, regras de passagem para
 * humano e limites (orçamento do mês com o consumo, mensagens, espera de agrupamento e modelo).
 */
@Component({
  selector: 'app-regras-sdr',
  imports: [Alternador, Botao, CampoTexto, Cartao, Esqueleto, EstadoVazio, Seletor],
  template: `
    <div class="parte">
      @if (erro(); as falha) {
        <app-estado-vazio
          variante="erro"
          titulo="Não conseguimos carregar as regras do SDR"
          [falha]="falha"
          [texto]="falha.resumo"
          [codigo]="falha.ehFalhaDoServidor ? falha.requisicaoId : null"
        >
          <button appBotao type="button" variante="invertido" (click)="carregar()">
            Tentar de novo
          </button>
        </app-estado-vazio>
      } @else if (config() === null) {
        <app-cartao>
          <div class="esqueleto" aria-busy="true">
            <p class="visualmente-oculto" role="status">Carregando as regras…</p>
            <app-esqueleto largura="35%" />
            <app-esqueleto forma="bloco" altura="44px" />
            <app-esqueleto forma="bloco" altura="96px" />
          </div>
        </app-cartao>
      } @else {
        <form class="formulario" (submit)="$event.preventDefault(); salvar()">
          <app-cartao>
            <div class="bloco">
              <h3 class="titulo">Temperatura do lead</h3>
              <p class="texto">
                Cada resposta do lead gera uma nota de 0 a 100 pelos critérios descobertos. A nota
                define a temperatura. O lead é qualificado quando todos os critérios obrigatórios
                foram descobertos e a nota chega ao mínimo.
              </p>
              <div class="grade">
                <app-campo-texto
                  rotulo="Nota para ser quente"
                  tipo="number"
                  [minimo]="0"
                  [maximo]="100"
                  [erro]="erroQuente() ?? erroDoCampo('faixaQuente')"
                  [(valor)]="quente"
                />
                <app-campo-texto
                  rotulo="Nota para ser morno"
                  tipo="number"
                  [minimo]="0"
                  [maximo]="100"
                  dica="Abaixo disso, o lead é frio."
                  [erro]="erroMorno() ?? erroDoCampo('faixaMorno')"
                  [(valor)]="morno"
                />
                <app-campo-texto
                  rotulo="Nota mínima para qualificar"
                  tipo="number"
                  [minimo]="0"
                  [maximo]="100"
                  [erro]="erroMinima() ?? erroDoCampo('notaMinimaQualificado')"
                  [(valor)]="minima"
                />
              </div>
              @if (erroFaixas(); as e) {
                <p class="erro" role="alert">{{ e }}</p>
              }
            </div>
          </app-cartao>

          <app-cartao>
            <div class="bloco">
              <h3 class="titulo">Quando passar para uma pessoa</h3>
              <p class="texto">
                Em qualquer um destes casos a IA para, avisa o lead e entrega a conversa com um
                resumo para quem assume.
              </p>
              <app-alternador
                rotulo="O lead pede para falar com uma pessoa"
                [valor]="regras().pedidoHumano"
                (valorChange)="mudarRegra('pedidoHumano', $event)"
              />
              <app-alternador
                rotulo="Assunto sensível ou fora do escopo"
                [valor]="regras().assuntoSensivel"
                (valorChange)="mudarRegra('assuntoSensivel', $event)"
              />
              <app-alternador
                rotulo="Reclamação"
                [valor]="regras().reclamacao"
                (valorChange)="mudarRegra('reclamacao', $event)"
              />
              <app-alternador
                rotulo="A IA sem confiança"
                dica="Quando ela mesma não tem certeza do que responder."
                [valor]="regras().baixaConfianca"
                (valorChange)="mudarRegra('baixaConfianca', $event)"
              />
              <app-campo-texto
                rotulo="Confiança mínima (0 a 1)"
                tipo="number"
                [minimo]="0"
                [maximo]="1"
                [passo]="0.05"
                dica="Um critério só é gravado se a IA tiver pelo menos esta confiança. Padrão 0,4."
                [erro]="erroConfianca() ?? erroDoCampo('regrasPassagem.confiancaMinima')"
                [(valor)]="confianca"
              />
              <app-alternador
                rotulo="Muitas mensagens sem avanço"
                dica="Passa quando a conversa não descobre nada novo por várias mensagens seguidas."
                [valor]="regras().semAvanco"
                (valorChange)="mudarRegra('semAvanco', $event)"
              />
            </div>
          </app-cartao>

          <app-cartao>
            <div class="bloco">
              <h3 class="titulo">Limites</h3>
              @if (uso(); as u) {
                <div role="status">
                  <p class="texto">
                    Consumo de {{ u.mes }}: {{ formatarNumero(u.tokens.total) }} tokens
                    @if (u.orcamento !== null) {
                      de {{ formatarNumero(u.orcamento) }} ({{
                        formatarNumero(u.percentual ?? 0)
                      }}%)
                    }
                    · {{ u.turnos }} respostas em {{ u.conversasAtendidas }} conversas.
                  </p>
                  @if (u.orcamento !== null) {
                    <div
                      class="medidor"
                      role="img"
                      [attr.aria-label]="'Orçamento do mês usado: ' + (u.percentual ?? 0) + '%'"
                    >
                      <span [style.width.%]="min100(u.percentual)"></span>
                    </div>
                  }
                  @if (u.esgotado) {
                    <p class="erro">
                      O orçamento do mês acabou: o SDR passa os leads novos para a equipe.
                    </p>
                  }
                </div>
              }
              <div class="grade">
                <app-campo-texto
                  rotulo="Orçamento mensal de tokens"
                  tipo="number"
                  [minimo]="100000"
                  dica="Em branco, sem limite. Ao esgotar, os leads vão para a equipe."
                  [erro]="erroOrcamento() ?? erroDoCampo('orcamentoMensalTokens')"
                  [(valor)]="orcamento"
                />
                <app-campo-texto
                  rotulo="Mensagens da IA por conversa"
                  tipo="number"
                  [minimo]="1"
                  [maximo]="200"
                  [erro]="erroMensagens() ?? erroDoCampo('maxMensagensPorConversa')"
                  [(valor)]="mensagens"
                />
                <app-campo-texto
                  rotulo="Mensagens sem avanço"
                  tipo="number"
                  [minimo]="1"
                  [maximo]="50"
                  dica="Quantas seguidas até passar para uma pessoa."
                  [erro]="erroSemAvanco() ?? erroDoCampo('maxMensagensSemAvanco')"
                  [(valor)]="semAvanco"
                />
                <app-campo-texto
                  rotulo="Espera para agrupar mensagens (segundos)"
                  tipo="number"
                  [minimo]="0"
                  [maximo]="60"
                  dica="Se o lead escreve várias mensagens seguidas, a IA espera e responde uma vez."
                  [erro]="erroEspera() ?? erroDoCampo('esperaAgrupamentoSegundos')"
                  [(valor)]="espera"
                />
              </div>
              <app-seletor
                rotulo="Modelo da IA"
                [opcoes]="modelos()"
                [(valor)]="modelo"
                dica="Modelos mais completos respondem melhor e custam mais tokens."
              />
            </div>
          </app-cartao>

          @if (erroSalvar(); as falha) {
            <p class="erro" role="alert">Não foi possível salvar. {{ falha.resumo }}</p>
          }
          <div class="rodape">
            <button
              appBotao
              type="submit"
              variante="invertido"
              [icone]="iconeSalvar"
              [carregando]="salvando()"
              [disabled]="!podeSalvar()"
            >
              Salvar
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styleUrl: './sdr-comum.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegrasSdr {
  private readonly api = inject(SdrConfigApi);
  private readonly avisos = inject(AvisosService);

  protected readonly iconeSalvar = LucideSave;
  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly formatarNumero = formatarNumero;

  protected readonly config = signal<ConfiguracaoSdr | null>(null);
  protected readonly uso = signal<UsoSdr | null>(null);
  protected readonly modelos = signal<readonly OpcaoSeletor<string>[]>([]);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly erroSalvar = signal<ErroApi | null>(null);
  protected readonly salvando = signal(false);

  protected readonly quente = signal<string | number>('');
  protected readonly morno = signal<string | number>('');
  protected readonly minima = signal<string | number>('');
  protected readonly regras = signal<RegrasPassagem>({
    pedidoHumano: true,
    assuntoSensivel: true,
    baixaConfianca: true,
    confiancaMinima: 0.4,
    semAvanco: true,
    reclamacao: true,
  });
  protected readonly confianca = signal<string | number>('');
  protected readonly orcamento = signal<string | number>('');
  protected readonly mensagens = signal<string | number>('');
  protected readonly semAvanco = signal<string | number>('');
  protected readonly espera = signal<string | number>('');
  protected readonly modelo = signal<string | null>(null);

  protected readonly erroQuente = computed(() => erroDeInteiro(this.quente(), 0, 100));
  protected readonly erroMorno = computed(() => erroDeInteiro(this.morno(), 0, 100));
  protected readonly erroMinima = computed(() => erroDeInteiro(this.minima(), 0, 100));
  protected readonly erroFaixas = computed(() =>
    this.erroQuente() || this.erroMorno()
      ? null
      : erroDeFaixas(Number(this.quente()), Number(this.morno())),
  );
  protected readonly erroConfianca = computed(() => {
    const n = Number(this.confianca());
    return textoOuNulo(this.confianca()) === '' || Number.isNaN(n) || n < 0 || n > 1
      ? 'Use um número de 0 a 1.'
      : null;
  });
  protected readonly erroOrcamento = computed(() =>
    erroDeInteiro(this.orcamento(), 100_000, 2_000_000_000, true),
  );
  protected readonly erroMensagens = computed(() => erroDeInteiro(this.mensagens(), 1, 200));
  protected readonly erroSemAvanco = computed(() => erroDeInteiro(this.semAvanco(), 1, 50));
  protected readonly erroEspera = computed(() => erroDeInteiro(this.espera(), 0, 60));
  protected readonly podeSalvar = computed(
    () =>
      !this.salvando() &&
      !this.erroQuente() &&
      !this.erroMorno() &&
      !this.erroMinima() &&
      !this.erroFaixas() &&
      !this.erroConfianca() &&
      !this.erroOrcamento() &&
      !this.erroMensagens() &&
      !this.erroSemAvanco() &&
      !this.erroEspera(),
  );

  constructor() {
    void this.carregar();
  }

  protected min100(valor: number | null): number {
    return Math.max(0, Math.min(100, valor ?? 0));
  }

  protected async carregar(): Promise<void> {
    this.erro.set(null);
    try {
      const [geral, uso] = await Promise.all([this.api.geral(), this.api.uso()]);
      this.modelos.set(geral.modelosDisponiveis.map((m) => ({ valor: m.id, rotulo: m.rotulo })));
      this.uso.set(uso);
      this.aplicar(geral.configuracao);
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    }
  }

  private aplicar(c: ConfiguracaoSdr): void {
    this.config.set(c);
    this.quente.set(c.faixaQuente);
    this.morno.set(c.faixaMorno);
    this.minima.set(c.notaMinimaQualificado);
    this.regras.set(c.regrasPassagem);
    this.confianca.set(c.regrasPassagem.confiancaMinima);
    this.orcamento.set(c.orcamentoMensalTokens ?? '');
    this.mensagens.set(c.maxMensagensPorConversa);
    this.semAvanco.set(c.maxMensagensSemAvanco);
    this.espera.set(c.esperaAgrupamentoSegundos);
    this.modelo.set(c.modelo);
    this.erroSalvar.set(null);
  }

  protected mudarRegra(
    regra: 'pedidoHumano' | 'assuntoSensivel' | 'baixaConfianca' | 'semAvanco' | 'reclamacao',
    valor: boolean,
  ): void {
    this.regras.update((r) => ({ ...r, [regra]: valor }));
  }

  protected async salvar(): Promise<void> {
    if (!this.podeSalvar()) {
      return;
    }
    this.salvando.set(true);
    this.erroSalvar.set(null);
    try {
      const orcamento = inteiroDoCampo(this.orcamento());
      this.aplicar(
        await this.api.salvarGeral({
          faixaQuente: Number(this.quente()),
          faixaMorno: Number(this.morno()),
          notaMinimaQualificado: Number(this.minima()),
          regrasPassagem: { ...this.regras(), confiancaMinima: Number(this.confianca()) },
          orcamentoMensalTokens: orcamento,
          maxMensagensPorConversa: Number(this.mensagens()),
          maxMensagensSemAvanco: Number(this.semAvanco()),
          esperaAgrupamentoSegundos: Number(this.espera()),
          modelo: this.modelo() ?? undefined,
        }),
      );
      this.uso.set(await this.api.uso().catch(() => this.uso()));
      this.avisos.sucesso('Regras do SDR salvas.');
    } catch (falha) {
      this.erroSalvar.set(erroDaApi(falha));
    } finally {
      this.salvando.set(false);
    }
  }

  protected erroDoCampo(caminho: string): string | null {
    return this.erroSalvar()?.mensagemDoCampo(caminho) ?? null;
  }
}
