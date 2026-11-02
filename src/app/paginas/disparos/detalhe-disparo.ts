import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideCheck,
  LucideCirclePause,
  LucideCirclePlay,
  LucidePencil,
  LucideRefreshCw,
  LucideX,
} from '@lucide/angular';

import { AvisosService } from '../../nucleo/avisos.service';
import { erroDaApi } from '../../nucleo/api/erro-api';
import { formatarDataHora, formatarEspera } from '../../nucleo/formatos';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Indicador } from '../../ui/indicador/indicador';
import { type ItemMenuAcoes, MenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { Modal } from '../../ui/modal/modal';
import { Selo } from '../../ui/selo/selo';
import { descreverJanela } from '../../ui/seletor-janela-envio/janela-envio';
import { type AcaoCampanha, AcoesCampanha } from './acoes-campanha';
import { BarraProgresso } from './barra-progresso';
import { descreverSegmento, janelaDaApi } from './conversao';
import { DestinatariosCampanha } from './destinatarios-campanha';
import { DisparosApi } from './disparos.api';
import {
  aplicarProgresso,
  assinaturaDosContadores,
  type Campanha,
  type EventoCampanhaProgresso,
  ROTULO_CANAL_CAMPANHA,
  ROTULO_STATUS_CAMPANHA,
  VARIANTE_STATUS_CAMPANHA,
} from './disparos.tipos';
import { aoReceberProgresso, aoVoltarConexao } from './progresso-ao-vivo';
import { RelatorioDaCampanha } from './relatorio-campanha';

const ABAS: readonly ItemAba[] = [
  { id: 'resumo', rotulo: 'Resumo' },
  { id: 'destinatarios', rotulo: 'Quem recebeu' },
  { id: 'resultados', rotulo: 'Resultados' },
];

/**
 * Detalhe da campanha (`/disparos/:id`): andamento ao vivo (evento `campanha.progresso`),
 * ações do ciclo de vida, destinatários e relatório.
 */
@Component({
  selector: 'app-detalhe-disparo',
  imports: [
    RouterLink,
    Abas,
    LucideArrowLeft,
    AreaTexto,
    BarraProgresso,
    Botao,
    Cartao,
    DestinatariosCampanha,
    EstadoVazio,
    Esqueleto,
    Indicador,
    MenuAcoes,
    Modal,
    RelatorioDaCampanha,
    Selo,
  ],
  template: `
    <a class="voltar" routerLink="/disparos">
      <svg lucideArrowLeft [size]="16" aria-hidden="true"></svg>
      Todas as campanhas
    </a>

    @if (erro(); as falha) {
      @if (falha.ehSemPermissao || falha.status === 404) {
        <app-estado-vazio
          [variante]="falha.status === 404 ? 'vazio' : 'sem-acesso'"
          [titulo]="
            falha.status === 404 ? 'Campanha não encontrada' : 'Você não tem acesso a esta campanha'
          "
          texto="Ela pode ter sido excluída, ou ser de outra área."
        >
          <a appBotao variante="invertido" routerLink="/disparos">Ver campanhas</a>
        </app-estado-vazio>
      } @else {
        <app-estado-vazio
          variante="erro"
          [falha]="falha"
          titulo="Não conseguimos carregar a campanha"
          [texto]="falha.resumo"
          [codigo]="falha.requisicaoId"
        >
          <button
            appBotao
            type="button"
            variante="invertido"
            [icone]="icones.tentar"
            (click)="dados.reload()"
          >
            Tentar de novo
          </button>
        </app-estado-vazio>
      }
    } @else if (campanha(); as c) {
      <header class="cabecalho">
        <div class="cabecalho__titulo">
          <h1 class="texto-h1">{{ c.nome }}</h1>
          <div class="cabecalho__selos">
            <app-selo ponto [variante]="variantes[c.status]">{{ rotulos[c.status] }}</app-selo>
            <app-selo variante="contorno">{{ rotuloCanal[c.canal] }}</app-selo>
          </div>
          @if (c.descricao) {
            <p class="cabecalho__frase">{{ c.descricao }}</p>
          }
        </div>
        <div class="acoes">
          @if (c.status === 'RASCUNHO' && c.acoes.editar) {
            <a
              appBotao
              variante="destaque"
              [icone]="icones.editar"
              [routerLink]="['/disparos', c.id, 'editar']"
            >
              Continuar editando
            </a>
          }
          @if (c.acoes.aprovar) {
            <button
              appBotao
              type="button"
              variante="destaque"
              [icone]="icones.aprovar"
              [carregando]="ocupado() === 'aprovar'"
              (click)="agir('aprovar')"
            >
              Aprovar
            </button>
          }
          @if (c.acoes.reprovar) {
            <button
              appBotao
              type="button"
              variante="contorno"
              [icone]="icones.reprovar"
              (click)="reprovarAberto.set(true)"
            >
              Reprovar
            </button>
          }
          @if (c.acoes.pausar) {
            <button
              appBotao
              type="button"
              variante="contorno"
              [icone]="icones.pausar"
              (click)="agir('pausar')"
            >
              Pausar
            </button>
          }
          @if (c.acoes.retomar) {
            <button
              appBotao
              type="button"
              variante="destaque"
              [icone]="icones.retomar"
              [carregando]="ocupado() === 'retomar'"
              (click)="agir('retomar')"
            >
              Retomar
            </button>
          }
          @if (c.status !== 'RASCUNHO' && c.acoes.editar) {
            <a
              appBotao
              variante="contorno"
              [icone]="icones.editar"
              [routerLink]="['/disparos', c.id, 'editar']"
            >
              Ajustar envio
            </a>
          }
          @if (menu().length > 0) {
            <app-menu-acoes
              rotulo="Mais ações da campanha"
              texto="Mais"
              [itens]="menu()"
              (escolher)="agir($event.id)"
            />
          }
        </div>
      </header>

      @if (aviso(); as a) {
        <p class="aviso" [class.aviso--atencao]="a.atencao" role="status">{{ a.texto }}</p>
      }

      @if (c.status !== 'RASCUNHO') {
        <app-abas
          rotulo="Seções da campanha"
          [abas]="abas"
          [selecionada]="aba()"
          (selecionadaChange)="aba.set($event ?? 'resumo')"
        />
      }

      @switch (c.status === 'RASCUNHO' ? 'resumo' : aba()) {
        @case ('destinatarios') {
          <app-destinatarios-campanha [campanhaId]="c.id" [versao]="assinatura()" />
        }
        @case ('resultados') {
          <app-relatorio-campanha [campanhaId]="c.id" [versao]="assinatura()" />
        }
        @default {
          @if (c.contadores.total > 0) {
            <app-cartao titulo="Andamento" [complemento]="c.progresso + '% concluído'">
              <app-barra-progresso [valor]="c.progresso" />
              <div class="numeros">
                <app-indicador tamanho="sm" [valor]="c.contadores.total" legenda="Na campanha" />
                <app-indicador
                  tamanho="sm"
                  [valor]="c.contadores.pendentes + c.contadores.enviando"
                  legenda="Na fila"
                />
                <app-indicador tamanho="sm" [valor]="c.contadores.enviados" legenda="Enviadas" />
                <app-indicador tamanho="sm" [valor]="c.contadores.entregues" legenda="Entregues" />
                <app-indicador tamanho="sm" [valor]="c.contadores.lidos" legenda="Lidas" />
                <app-indicador
                  tamanho="sm"
                  [valor]="c.contadores.respondidos"
                  legenda="Respostas"
                />
                <app-indicador
                  tamanho="sm"
                  [valor]="c.contadores.falhas"
                  legenda="Falhas"
                  [quedaEhBoa]="true"
                />
                <app-indicador
                  tamanho="sm"
                  [valor]="c.contadores.invalidos"
                  legenda="Sem WhatsApp"
                />
                <app-indicador
                  tamanho="sm"
                  [valor]="c.contadores.optOuts"
                  legenda="Pediram para sair"
                  [quedaEhBoa]="true"
                />
              </div>
            </app-cartao>
          } @else if (c.status === 'RASCUNHO') {
            <app-cartao>
              <p class="vazio">
                Esta campanha ainda é um rascunho. Continue editando para escolher o público,
                escrever a mensagem e conferir o ritmo antes de enviar.
              </p>
            </app-cartao>
          }

          <div class="grade">
            <app-cartao titulo="Mensagem">
              @if (c.assunto) {
                <p class="campo"><span class="campo__rotulo">Assunto</span>{{ c.assunto }}</p>
              }
              <p class="mensagem">{{ c.texto || 'Sem texto ainda.' }}</p>
              @if (c.arquivo; as arquivo) {
                <p class="campo">
                  <span class="campo__rotulo">Anexo</span>
                  <a [href]="arquivo.url" target="_blank" rel="noopener">{{ arquivo.nome }}</a>
                </p>
              }
            </app-cartao>

            <app-cartao titulo="Como será enviada">
              <dl class="detalhes">
                <dt>Quem recebe</dt>
                <dd>
                  @if (c.tipoPublico === 'IMPORTACAO') {
                    Contatos de uma planilha importada
                  } @else if (publico().length > 0) {
                    <ul>
                      @for (linha of publico(); track $index) {
                        <li>{{ linha }}</li>
                      }
                    </ul>
                  } @else {
                    Todos os contatos
                  }
                </dd>
                <dt>{{ c.canal === 'EMAIL' ? 'Enviada por' : 'Números' }}</dt>
                <dd>
                  @for (canal of c.canais; track canal.id) {
                    <span class="canal">
                      {{ canal.nome }}
                      @if (canal.telefone) {
                        <span class="suave">({{ canal.telefone }})</span>
                      }
                      @if (canal.numeroPausado) {
                        <app-selo variante="lima" tamanho="sm">Pausado</app-selo>
                      }
                    </span>
                  } @empty {
                    Nenhum escolhido
                  }
                </dd>
                <dt>Ritmo</dt>
                <dd>{{ ritmo() }}</dd>
                <dt>Horário de envio</dt>
                <dd>{{ janela() }}</dd>
                @if (c.agendadaPara) {
                  <dt>Começa em</dt>
                  <dd>{{ dataHora(c.agendadaPara) }}</dd>
                }
                @if (c.iniciadaEm) {
                  <dt>Iniciada em</dt>
                  <dd>{{ dataHora(c.iniciadaEm) }}</dd>
                }
                @if (c.concluidaEm) {
                  <dt>Concluída em</dt>
                  <dd>{{ dataHora(c.concluidaEm) }}</dd>
                }
                <dt>Criada por</dt>
                <dd>{{ c.criadoPor?.nome || '—' }} em {{ dataHora(c.criadoEm) }}</dd>
                @if (c.aprovacao.aprovadaPor) {
                  <dt>Aprovada por</dt>
                  <dd>{{ c.aprovacao.aprovadaPor.nome }}</dd>
                }
              </dl>
            </app-cartao>
          </div>
        }
      }

      <app-modal titulo="Reprovar campanha" largura="sm" [(aberto)]="reprovarAberto">
        <form class="formulario" id="form-reprovar" (submit)="$event.preventDefault(); reprovar()">
          <p>
            Conte o que precisa mudar. A pessoa que criou a campanha vê o motivo e pode corrigir.
          </p>
          <app-area-texto
            rotulo="Motivo"
            [linhas]="3"
            [maximoCaracteres]="500"
            [valor]="motivo()"
            (valorChange)="motivo.set($event)"
          />
        </form>
        <div modal-rodape>
          <button appBotao type="button" variante="contorno" (click)="reprovarAberto.set(false)">
            Voltar
          </button>
          <button
            appBotao
            type="submit"
            variante="invertido"
            form="form-reprovar"
            [carregando]="ocupado() === 'reprovar'"
            [disabled]="motivo().trim() === ''"
          >
            Reprovar
          </button>
        </div>
      </app-modal>
    } @else {
      <app-esqueleto forma="bloco" altura="3rem" largura="50%" />
      <app-esqueleto forma="bloco" altura="10rem" />
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-4);
      max-width: var(--largura-pagina, 1600px);
      min-width: 0;
    }

    .voltar {
      display: inline-flex;
      align-items: center;
      gap: var(--esp-2);
      width: fit-content;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
      text-decoration: none;
    }

    .voltar:hover {
      color: var(--cor-texto);
    }

    .cabecalho {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--esp-4);
    }

    .cabecalho__titulo {
      display: grid;
      gap: var(--esp-2);
      min-width: 0;
      flex: 1 1 20rem;
    }

    .cabecalho__titulo h1 {
      overflow-wrap: anywhere;
    }

    .cabecalho__selos {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
    }

    .cabecalho__frase {
      color: var(--cor-texto-suave);
    }

    .acoes {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-2);
    }

    .aviso {
      margin: 0;
      padding: var(--esp-3) var(--esp-4);
      border-radius: var(--raio-lg);
      background: var(--cor-superficie-2);
      color: var(--cor-texto);
      font: var(--fonte-corpo-sm);
    }

    .aviso--atencao {
      border-inline-start: 4px solid var(--cor-aviso);
    }

    .numeros {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
      gap: var(--esp-4);
      margin-top: var(--esp-4);
    }

    .grade {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
      gap: var(--esp-4);
      align-items: start;
    }

    .mensagem {
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .campo {
      display: grid;
      margin: 0 0 var(--esp-3);
    }

    .campo__rotulo,
    .suave {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .vazio {
      margin: 0;
      color: var(--cor-texto-suave);
    }

    .detalhes {
      display: grid;
      grid-template-columns: minmax(7rem, auto) 1fr;
      gap: var(--esp-3) var(--esp-4);
      margin: 0;
    }

    .detalhes dt {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .detalhes dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .detalhes ul {
      margin: 0;
      padding-inline-start: 1.1rem;
    }

    .canal {
      display: block;
    }

    .formulario {
      display: grid;
      gap: var(--esp-3);
    }

    @media (max-width: 599px) {
      .detalhes {
        grid-template-columns: 1fr;
        gap: var(--esp-1);
      }

      .detalhes dd {
        margin-bottom: var(--esp-3);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalheDisparo {
  /** `:id` da rota (vinculado por `withComponentInputBinding`). */
  readonly id = input.required<string>();

  private readonly api = inject(DisparosApi);
  private readonly acoes = inject(AcoesCampanha);
  private readonly avisos = inject(AvisosService);
  private readonly roteador = inject(Router);

  protected readonly icones = {
    tentar: LucideRefreshCw,
    editar: LucidePencil,
    aprovar: LucideCheck,
    reprovar: LucideX,
    pausar: LucideCirclePause,
    retomar: LucideCirclePlay,
  };
  protected readonly abas = ABAS;
  protected readonly rotulos = ROTULO_STATUS_CAMPANHA;
  protected readonly variantes = VARIANTE_STATUS_CAMPANHA;
  protected readonly rotuloCanal = ROTULO_CANAL_CAMPANHA;

  protected readonly aba = signal('resumo');
  protected readonly ocupado = signal<string | null>(null);
  protected readonly reprovarAberto = signal(false);
  protected readonly motivo = signal('');
  /** Relógio de 1 s para a contagem até o próximo envio. */
  private readonly agora = signal(Date.now());
  private readonly vivo = signal<EventoCampanhaProgresso | null>(null);

  protected readonly dados = resource({
    params: () => this.id(),
    loader: ({ params }) => this.api.detalhar(params),
  });

  protected readonly erro = computed(() => {
    const falha = this.dados.error();
    return falha && !this.dados.hasValue() ? erroDaApi(falha) : null;
  });

  protected readonly campanha = computed<Campanha | null>(() => {
    if (!this.dados.hasValue()) {
      return null;
    }
    const base = this.dados.value();
    const evento = this.vivo();
    return evento && evento.campanhaId === base.id ? aplicarProgresso(base, evento) : base;
  });

  protected readonly menu = computed<readonly ItemMenuAcoes[]>(() => {
    const a = this.campanha()?.acoes;
    if (!a) {
      return [];
    }
    const itens: ItemMenuAcoes[] = [];
    if (a.duplicar) {
      itens.push({ id: 'duplicar', rotulo: 'Duplicar' });
    }
    if (a.reenviarFalhas) {
      itens.push({ id: 'reenviar-falhas', rotulo: 'Reenviar para quem falhou' });
    }
    if (a.cancelar) {
      itens.push({ id: 'cancelar', rotulo: 'Cancelar campanha', perigo: true, separarAntes: true });
    }
    if (a.excluir) {
      itens.push({ id: 'excluir', rotulo: 'Excluir', perigo: true, separarAntes: !a.cancelar });
    }
    return itens;
  });

  /** Muda a cada contador que muda: as abas de destinatários e de resultados recarregam com ela. */
  protected readonly assinatura = computed(() => {
    const c = this.campanha();
    return c ? assinaturaDosContadores(c.contadores) : '';
  });

  protected readonly publico = computed(() => descreverSegmento(this.campanha()?.segmento));

  protected readonly ritmo = computed(() => {
    const r = this.campanha()?.ritmo;
    if (!r) {
      return '';
    }
    const partes = [
      `Uma mensagem a cada ${r.intervaloMinimoSegundos} a ${r.intervaloMaximoSegundos} segundos`,
    ];
    if (r.loteTamanho && r.lotePausaSegundos) {
      partes.push(
        `pausa de ${formatarEspera(r.lotePausaSegundos)} a cada ${r.loteTamanho} mensagens`,
      );
    }
    if (r.simularDigitando) {
      partes.push('mostra “digitando…” antes de enviar');
    }
    partes.push(`pausa sozinha após ${r.pausarAposFalhas} falhas seguidas`);
    return partes.join('; ') + '.';
  });

  protected readonly janela = computed(() => {
    const lida = janelaDaApi(this.campanha()?.janelaEnvio);
    return lida
      ? descreverJanela(lida.janela) + (lida.perdeu ? ' (com horários diferentes por dia)' : '')
      : 'A qualquer hora';
  });

  protected readonly aviso = computed<{ texto: string; atencao: boolean } | null>(() => {
    const c = this.campanha();
    if (!c) {
      return null;
    }
    if (c.status === 'AGUARDANDO_APROVACAO') {
      return {
        texto: 'Esta campanha espera a aprovação do líder da área antes de começar.',
        atencao: true,
      };
    }
    if (c.status === 'RASCUNHO' && c.aprovacao.reprovacaoMotivo) {
      return { texto: `Reprovada: ${c.aprovacao.reprovacaoMotivo}`, atencao: true };
    }
    if (c.status === 'PAUSADA') {
      return {
        texto: c.pausaMotivo
          ? `Pausada: ${c.pausaMotivo}. Retome quando estiver tudo certo.`
          : 'Pausada. Os envios continuam de onde pararam quando você retomar.',
        atencao: true,
      };
    }
    if (c.status === 'AGENDADA' && c.agendadaPara) {
      return { texto: `Começa em ${formatarDataHora(c.agendadaPara)}.`, atencao: false };
    }
    if (c.status === 'EM_ANDAMENTO') {
      if (c.aguardando?.motivo === 'janela_de_envio') {
        return {
          texto: c.aguardando.ate
            ? `Fora do horário de envio. Volta a enviar em ${formatarDataHora(c.aguardando.ate)}.`
            : 'Fora do horário de envio. Volta a enviar no próximo horário permitido.',
          atencao: false,
        };
      }
      if (c.aguardando?.motivo === 'confirmacoes') {
        return {
          texto: 'Esperando a confirmação de entrega das mensagens anteriores.',
          atencao: false,
        };
      }
      if (c.proximoEnvioEm) {
        const segundos = Math.round((new Date(c.proximoEnvioEm).getTime() - this.agora()) / 1000);
        return {
          texto:
            segundos > 0
              ? `Próxima mensagem em cerca de ${formatarEspera(segundos)}.`
              : 'Enviando a próxima mensagem…',
          atencao: false,
        };
      }
    }
    return null;
  });

  constructor() {
    aoReceberProgresso((evento) => {
      const atual = this.dados.hasValue() ? this.dados.value() : null;
      if (!atual || evento.campanhaId !== atual.id) {
        return;
      }
      this.vivo.set(evento);
      // Mudou de situação: os botões e os avisos dependem do detalhe inteiro.
      if (evento.status !== atual.status) {
        this.dados.reload();
      }
    });
    aoVoltarConexao(() => this.dados.reload());
    effect(() => {
      if (this.dados.hasValue() && !this.dados.isLoading()) {
        this.vivo.set(null);
      }
    });
    const relogio = setInterval(() => this.agora.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(relogio));
  }

  protected dataHora(valor: string): string {
    return formatarDataHora(valor);
  }

  protected async agir(acao: string): Promise<void> {
    const c = this.campanha();
    if (!c) {
      return;
    }
    this.ocupado.set(acao);
    try {
      const resultado = await this.acoes.executar(acao as AcaoCampanha, c);
      if (resultado?.excluida) {
        await this.roteador.navigate(['/disparos']);
      } else if (resultado?.campanha && acao !== 'duplicar') {
        this.dados.set(resultado.campanha);
      }
    } finally {
      this.ocupado.set(null);
    }
  }

  protected async reprovar(): Promise<void> {
    const c = this.campanha();
    if (!c || this.motivo().trim() === '') {
      return;
    }
    this.ocupado.set('reprovar');
    try {
      const nova = await this.api.reprovar(c.id, this.motivo().trim());
      this.dados.set(nova);
      this.reprovarAberto.set(false);
      this.motivo.set('');
      this.avisos.sucesso('Campanha reprovada. Ela voltou para rascunho.');
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.ocupado.set(null);
    }
  }
}
