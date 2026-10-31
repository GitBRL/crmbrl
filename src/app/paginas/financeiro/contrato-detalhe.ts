import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideArrowLeft, LucidePlus, LucideRefreshCw } from '@lucide/angular';
import { map } from 'rxjs';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { formatarData, formatarMoeda, paraDecimal, paraNumero } from '../../nucleo/formatos';
import { aoReceber } from '../../nucleo/tempo-real/auxiliares';
import { Alternador } from '../../ui/alternador/alternador';
import { Botao } from '../../ui/botao/botao';
import { CampoData } from '../../ui/campo-data/campo-data';
import { CampoTexto, type ValorCampoTexto } from '../../ui/campo-texto/campo-texto';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { MenuAcoes, type ItemMenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { FinanceiroApi } from './financeiro.api';
import {
  PERIODICIDADES,
  type Periodicidade,
  type Parcela,
  ROTULO_PERIODICIDADE,
  ROTULO_STATUS_CONTRATO,
  ROTULO_STATUS_PARCELA,
  VARIANTE_STATUS_CONTRATO,
  VARIANTE_STATUS_PARCELA,
} from './financeiro.tipos';
import { ModalBase, ModalParcela, numeroDoCampo, textoDoErro } from './modais-parcela';
import { PainelParcela } from './painel-parcela';
import { RiscoChurnCartao } from './risco-churn';

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'numero', rotulo: 'Parcela', noCartao: 'titulo' },
  { id: 'vencimento', rotulo: 'Vencimento' },
  { id: 'valor', rotulo: 'Valor', alinhar: 'fim' },
  { id: 'status', rotulo: 'Situação' },
  { id: 'pago', rotulo: 'Pago em' },
];

const OPCOES_PERIODICIDADE: readonly OpcaoSeletor<Periodicidade>[] = PERIODICIDADES.map(
  (valor) => ({ valor, rotulo: ROTULO_PERIODICIDADE[valor] }),
);

/**
 * Detalhe do contrato (`/financeiro/contratos/:id`): dados, resumo das parcelas, tabela de parcelas
 * (cada uma abre o painel com baixa e a linha do tempo da régua) e o risco de cancelamento.
 */
@Component({
  selector: 'app-contrato-detalhe',
  imports: [
    RouterLink,
    Alternador,
    AreaTexto,
    Botao,
    Cartao,
    CampoData,
    CampoTexto,
    CelulaTabela,
    EstadoVazio,
    Esqueleto,
    MenuAcoes,
    ModalBase,
    ModalParcela,
    PainelParcela,
    RiscoChurnCartao,
    Seletor,
    Selo,
    Tabela,
  ],
  template: `
    <a
      appBotao
      variante="contorno"
      tamanho="sm"
      routerLink="/financeiro/contratos"
      [icone]="icones.voltar"
    >
      Contratos
    </a>

    @if (dados.error(); as falha) {
      <app-estado-vazio
        [variante]="erro()!.ehSemPermissao || erro()!.ehNaoEncontrado ? 'sem-acesso' : 'erro'"
        [falha]="erro()!"
        [titulo]="
          erro()!.ehNaoEncontrado
            ? 'Contrato não encontrado'
            : 'Não conseguimos abrir este contrato'
        "
        [texto]="
          erro()!.ehNaoEncontrado ? 'Ele não existe ou não está na sua carteira.' : erro()!.resumo
        "
        [codigo]="erro()!.requisicaoId"
      >
        <button
          appBotao
          type="button"
          variante="invertido"
          [icone]="icones.tentar"
          (click)="recarregar()"
        >
          Tentar de novo
        </button>
      </app-estado-vazio>
    } @else if (contrato(); as c) {
      <header class="cabecalho">
        <div class="cabecalho__linha">
          <h2 class="texto-display">{{ c.produto }}</h2>
          <div class="cabecalho__acoes">
            <app-selo ponto [variante]="varianteStatus[c.status]">
              {{ rotuloStatus[c.status] }}
            </app-selo>
            @if (itensDoMenu().length > 0) {
              <app-menu-acoes
                rotulo="Ações do contrato"
                texto="Ações"
                [itens]="itensDoMenu()"
                (escolher)="agir($event.id)"
              />
            }
          </div>
        </div>
        <p class="frase">{{ c.codigo }} · {{ c.empresa?.nome ?? c.contato?.nome }}</p>
      </header>

      <div class="duas-colunas">
        <app-cartao titulo="Dados do contrato">
          <dl class="dados">
            <div>
              <dt>Cliente</dt>
              <dd>
                @if (c.empresa) {
                  <span>{{ c.empresa.nome }}</span>
                }
                @if (c.contato) {
                  <a [routerLink]="['/contatos', c.contato.id]">{{ c.contato.nome }}</a>
                }
              </dd>
            </div>
            @if (c.negocio) {
              <div>
                <dt>Negócio de origem</dt>
                <dd>{{ c.negocio.titulo }}</dd>
              </div>
            }
            <div>
              <dt>Valor</dt>
              <dd class="numero">{{ moeda(c.valor) }} · {{ periodicidade[c.periodicidade] }}</dd>
            </div>
            <div>
              <dt>Receita mensal (MRR)</dt>
              <dd class="numero">{{ moeda(c.mrr) }}</dd>
            </div>
            <div>
              <dt>Início</dt>
              <dd>{{ data(c.inicioEm) }}</dd>
            </div>
            <div>
              <dt>Fim</dt>
              <dd>{{ c.fimEm ? data(c.fimEm) : 'Sem data de término' }}</dd>
            </div>
            <div>
              <dt>Renovação</dt>
              <dd>
                {{ c.renovacaoEm ? data(c.renovacaoEm) : '—' }}
                @if (c.renovacaoAutomatica) {
                  <span class="nota">· renova sozinho</span>
                }
              </dd>
            </div>
            @if (c.diaVencimento) {
              <div>
                <dt>Dia de vencimento</dt>
                <dd>Todo dia {{ c.diaVencimento }}</dd>
              </div>
            }
            <div>
              <dt>Responsável de CS</dt>
              <dd>{{ c.responsavelCs?.nome ?? '—' }}</dd>
            </div>
            @if (c.canceladoEm) {
              <div>
                <dt>Cancelado em</dt>
                <dd>
                  {{ data(c.canceladoEm) }}
                  @if (c.motivoCancelamento) {
                    <span class="nota">· {{ c.motivoCancelamento }}</span>
                  }
                </dd>
              </div>
            }
            @if (c.descricao) {
              <div>
                <dt>Descrição</dt>
                <dd>{{ c.descricao }}</dd>
              </div>
            }
          </dl>
        </app-cartao>

        <div class="lateral">
          <app-cartao
            titulo="Parcelas"
            dica="Resumo das parcelas deste contrato. “Em atraso” são as já vencidas e não pagas."
          >
            <dl class="resumo-parcelas">
              <div>
                <dt>A receber</dt>
                <dd class="numero">{{ moeda(c.resumoParcelas.valorEmAberto) }}</dd>
                <dd class="nota">{{ c.resumoParcelas.abertas }} em aberto</dd>
              </div>
              <div>
                <dt>Em atraso</dt>
                <dd class="numero">{{ moeda(c.resumoParcelas.valorAtrasado) }}</dd>
                <dd class="nota">{{ c.resumoParcelas.atrasadas }} parcelas</dd>
              </div>
              <div>
                <dt>Recebido</dt>
                <dd class="numero">{{ moeda(c.resumoParcelas.valorPago) }}</dd>
                <dd class="nota">{{ c.resumoParcelas.pagas }} pagas</dd>
              </div>
            </dl>
          </app-cartao>
          @if (c.contato) {
            <app-risco-churn [contatoId]="c.contato.id" />
          }
        </div>
      </div>

      <section class="secao-parcelas" aria-label="Parcelas do contrato">
        <div class="cabecalho__linha">
          <h3 class="secao-parcelas__titulo">Parcelas do contrato</h3>
          @if (c.podeEditar && (c.status === 'ATIVO' || c.status === 'SUSPENSO')) {
            <button
              appBotao
              type="button"
              variante="contorno"
              tamanho="sm"
              [icone]="icones.novo"
              (click)="parcelaNovaAberta.set(true)"
            >
              Nova parcela
            </button>
          }
        </div>
        @if (parcelas.error()) {
          <app-estado-vazio
            variante="erro"
            titulo="Não conseguimos carregar as parcelas"
            [texto]="erroParcelas()?.resumo ?? null"
            compacto
          >
            <button appBotao type="button" variante="invertido" (click)="parcelas.reload()">
              Tentar de novo
            </button>
          </app-estado-vazio>
        } @else if (parcelas.hasValue() && itensParcelas().length === 0) {
          <app-estado-vazio
            titulo="Este contrato não tem parcelas"
            texto="Use “Gerar mais parcelas” no menu de ações para criar as próximas."
            compacto
          />
        } @else {
          <app-tabela
            rotulo="Parcelas do contrato"
            [colunas]="colunas"
            [linhas]="itensParcelas()"
            [carregando]="parcelas.isLoading() && !parcelas.hasValue()"
            clicavel
            (abrir)="parcelaAberta.set($event.id)"
          >
            <ng-template appCelula="numero" [appCelulaDe]="itensParcelas()" let-p>
              <span class="nome">
                <span class="nome__titulo">{{ p.numero }}</span>
                @if (p.promessaAte) {
                  <span class="nota">promessa até {{ data(p.promessaAte) }}</span>
                }
              </span>
            </ng-template>
            <ng-template appCelula="vencimento" [appCelulaDe]="itensParcelas()" let-p>
              {{ data(p.vencimento) }}
            </ng-template>
            <ng-template appCelula="valor" [appCelulaDe]="itensParcelas()" let-p>
              <span class="numero">{{ moeda(p.valor) }}</span>
            </ng-template>
            <ng-template appCelula="status" [appCelulaDe]="itensParcelas()" let-p>
              <app-selo ponto [variante]="varianteParcela[p.status]">
                {{ rotuloParcela[p.status] }}
              </app-selo>
            </ng-template>
            <ng-template appCelula="pago" [appCelulaDe]="itensParcelas()" let-p>
              @if (p.pagoEm) {
                {{ data(p.pagoEm) }}
              } @else {
                <span class="vazio">—</span>
              }
            </ng-template>
          </app-tabela>
        }
      </section>
    } @else {
      <div class="carregando" aria-busy="true">
        <p class="visualmente-oculto" role="status">Abrindo o contrato…</p>
        <app-esqueleto largura="40%" altura="2.5rem" />
        <app-esqueleto altura="14rem" />
      </div>
    }

    <app-painel-parcela
      [parcelaId]="parcelaAberta()"
      (parcelaIdChange)="parcelaAberta.set($event)"
      (alterada)="recarregar()"
    />
    <app-modal-parcela
      [(aberto)]="parcelaNovaAberta"
      [contratoId]="id()"
      (concluido)="recarregar()"
    />

    <app-modal-base
      titulo="Editar contrato"
      largura="md"
      formId="form-contrato"
      rotuloAcao="Salvar"
      [(aberto)]="edicaoAberta"
      [salvando]="salvando()"
      [erro]="erroForm()"
      (confirmar)="salvarEdicao()"
    >
      <app-campo-texto
        rotulo="Produto ou plano"
        [maximoCaracteres]="200"
        [valor]="fProduto()"
        (valorChange)="fProduto.set('' + ($event ?? ''))"
      />
      <div class="grade-campos">
        <app-campo-texto
          rotulo="Valor"
          tipo="number"
          prefixo="R$"
          [passo]="0.01"
          [minimo]="0.01"
          [valor]="fValor()"
          (valorChange)="fValor.set($event)"
        />
        <app-seletor
          rotulo="Periodicidade"
          [opcoes]="opcoesPeriodicidade"
          [(valor)]="fPeriodicidade"
        />
        <app-campo-data rotulo="Fim do contrato" opcional [(valor)]="fFim" />
        <app-campo-data rotulo="Próxima renovação" opcional [(valor)]="fRenovacao" />
        <app-campo-texto
          rotulo="Dia de vencimento"
          tipo="number"
          opcional
          [minimo]="1"
          [maximo]="31"
          [passo]="1"
          [valor]="fDia()"
          (valorChange)="fDia.set($event)"
        />
      </div>
      <app-alternador rotulo="Renova sozinho" [(valor)]="fAutomatica" />
      <app-alternador
        rotulo="Aplicar o novo valor às parcelas em aberto"
        [(valor)]="fAtualizarParcelas"
      />
      <p class="nota">
        Mudar o valor ou a periodicidade registra uma expansão ou contração na receita mensal.
      </p>
    </app-modal-base>

    <app-modal-base
      titulo="Cancelar contrato"
      largura="sm"
      formId="form-cancelar"
      rotuloAcao="Cancelar contrato"
      [(aberto)]="cancelamentoAberto"
      [salvando]="salvando()"
      [erro]="erroForm()"
      (confirmar)="cancelar()"
    >
      <p class="nota">
        O cancelamento entra como perda de receita (churn). As parcelas em aberto que ainda não
        venceram podem ser canceladas junto.
      </p>
      <app-area-texto
        rotulo="Motivo do cancelamento"
        [linhas]="3"
        [maximoCaracteres]="500"
        [(valor)]="motivo"
      />
      <app-alternador
        rotulo="Cancelar também as parcelas que ainda não venceram"
        [(valor)]="cancelarParcelas"
      />
    </app-modal-base>

    <app-modal-base
      titulo="Gerar mais parcelas"
      largura="sm"
      formId="form-mais"
      rotuloAcao="Gerar parcelas"
      [(aberto)]="maisAberto"
      [salvando]="salvando()"
      [erro]="erroForm()"
      (confirmar)="gerarMais()"
    >
      <p class="nota">As novas parcelas continuam depois da última que já existe.</p>
      <app-campo-texto
        rotulo="Quantidade"
        tipo="number"
        [minimo]="1"
        [maximo]="120"
        [passo]="1"
        [valor]="quantidade()"
        (valorChange)="quantidade.set($event)"
      />
    </app-modal-base>
  `,
  styleUrl: './financeiro-comum.scss',
  styles: `
    .duas-colunas {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      gap: var(--esp-4);
      align-items: start;
    }

    .lateral {
      display: grid;
      gap: var(--esp-4);
      min-width: 0;
    }

    @media (max-width: 899px) {
      .duas-colunas {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .dados,
    .resumo-parcelas {
      display: grid;
      gap: var(--esp-3);
      margin: 0;
    }

    .dados dt,
    .resumo-parcelas dt {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .dados dd,
    .resumo-parcelas dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .dados dd {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-1) var(--esp-2);
    }

    .resumo-parcelas {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .secao-parcelas {
      display: grid;
      gap: var(--esp-3);
      min-width: 0;
    }

    .secao-parcelas__titulo {
      font: var(--fonte-rotulo);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContratoDetalhePagina {
  private readonly api = inject(FinanceiroApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly rota = inject(ActivatedRoute);

  protected readonly id = toSignal(this.rota.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  protected readonly icones = {
    voltar: LucideArrowLeft,
    novo: LucidePlus,
    tentar: LucideRefreshCw,
  };
  protected readonly colunas = COLUNAS;
  protected readonly opcoesPeriodicidade = OPCOES_PERIODICIDADE;
  protected readonly rotuloStatus = ROTULO_STATUS_CONTRATO;
  protected readonly varianteStatus = VARIANTE_STATUS_CONTRATO;
  protected readonly rotuloParcela = ROTULO_STATUS_PARCELA;
  protected readonly varianteParcela = VARIANTE_STATUS_PARCELA;
  protected readonly periodicidade = ROTULO_PERIODICIDADE;
  protected readonly moeda = (v: string) => formatarMoeda(v);
  protected readonly data = (v: string) => formatarData(v);

  protected readonly dados = resource({
    params: () => this.id() || null,
    loader: ({ params }) => this.api.contrato(params!),
  });
  protected readonly parcelas = resource({
    params: () => this.id() || null,
    loader: ({ params }) =>
      this.api.parcelas({
        pagina: 1,
        porPagina: 100,
        status: [],
        faixa: null,
        contratoId: params,
        vencimentoDe: null,
        vencimentoAte: null,
        comPromessa: false,
        busca: '',
      }),
  });
  protected readonly contrato = computed(() => (this.dados.hasValue() ? this.dados.value() : null));
  protected readonly itensParcelas = computed<readonly Parcela[]>(() =>
    this.parcelas.hasValue() ? this.parcelas.value().itens : [],
  );
  protected readonly erro = computed(() => {
    const falha = this.dados.error();
    return falha ? erroDaApi(falha) : null;
  });
  protected readonly erroParcelas = computed(() => {
    const falha = this.parcelas.error();
    return falha ? erroDaApi(falha) : null;
  });

  protected readonly parcelaAberta = signal<string | null>(null);
  protected readonly parcelaNovaAberta = signal(false);
  protected readonly edicaoAberta = signal(false);
  protected readonly cancelamentoAberto = signal(false);
  protected readonly maisAberto = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erroForm = signal<string | null>(null);

  protected readonly fProduto = signal('');
  protected readonly fValor = signal<ValorCampoTexto>(null);
  protected readonly fPeriodicidade = signal<Periodicidade | null>(null);
  protected readonly fFim = signal<string | null>(null);
  protected readonly fRenovacao = signal<string | null>(null);
  protected readonly fDia = signal<ValorCampoTexto>(null);
  protected readonly fAutomatica = signal(false);
  protected readonly fAtualizarParcelas = signal(true);
  protected readonly motivo = signal('');
  protected readonly cancelarParcelas = signal(true);
  protected readonly quantidade = signal<ValorCampoTexto>(12);

  protected readonly itensDoMenu = computed<readonly ItemMenuAcoes[]>(() => {
    const c = this.contrato();
    if (!c || !c.podeEditar) {
      return [];
    }
    const itens: ItemMenuAcoes[] = [];
    if (c.status === 'ATIVO' || c.status === 'SUSPENSO') {
      itens.push({ id: 'editar', rotulo: 'Editar contrato' });
      itens.push({ id: 'mais', rotulo: 'Gerar mais parcelas' });
    }
    if (c.status === 'ATIVO') {
      itens.push({ id: 'suspender', rotulo: 'Suspender' });
    }
    if (c.status !== 'ATIVO') {
      itens.push({ id: 'reativar', rotulo: 'Reativar' });
    }
    if (c.status === 'ATIVO' || c.status === 'SUSPENSO') {
      itens.push({ id: 'cancelar', rotulo: 'Cancelar contrato', perigo: true, separarAntes: true });
    }
    return itens;
  });

  constructor() {
    aoReceber('parcela.atualizada', (e) => {
      if (e.contratoId === this.id()) {
        this.recarregar();
      }
    });
    // Parcela do contrato em link (?parcela=) não é usada aqui; limpa o painel ao trocar de contrato.
    effect(() => {
      this.id();
      untracked(() => this.parcelaAberta.set(null));
    });
  }

  protected recarregar(): void {
    this.dados.reload();
    this.parcelas.reload();
  }

  protected agir(id: string): void {
    const c = this.contrato();
    if (!c) {
      return;
    }
    this.erroForm.set(null);
    if (id === 'editar') {
      this.fProduto.set(c.produto);
      this.fValor.set(paraNumero(c.valor));
      this.fPeriodicidade.set(c.periodicidade);
      this.fFim.set(c.fimEm);
      this.fRenovacao.set(c.renovacaoEm);
      this.fDia.set(c.diaVencimento);
      this.fAutomatica.set(c.renovacaoAutomatica);
      this.fAtualizarParcelas.set(true);
      this.edicaoAberta.set(true);
    } else if (id === 'mais') {
      this.quantidade.set(12);
      this.maisAberto.set(true);
    } else if (id === 'cancelar') {
      this.motivo.set('');
      this.cancelarParcelas.set(true);
      this.cancelamentoAberto.set(true);
    } else if (id === 'suspender') {
      void this.confirmar(
        {
          titulo: `Suspender o contrato ${c.codigo}?`,
          mensagem:
            'A receita mensal deste contrato deixa de contar enquanto ele estiver suspenso. Você pode reativá-lo depois.',
          confirmar: 'Suspender',
        },
        'suspender',
        'Contrato suspenso.',
      );
    } else if (id === 'reativar') {
      void this.confirmar(
        {
          titulo: `Reativar o contrato ${c.codigo}?`,
          mensagem:
            c.status === 'SUSPENSO'
              ? 'O contrato volta a ser cobrado e a contar na receita mensal.'
              : 'O contrato volta como contrato novo na receita mensal.',
          confirmar: 'Reativar',
        },
        'reativar',
        'Contrato reativado.',
      );
    }
  }

  private async confirmar(
    pedido: { titulo: string; mensagem: string; confirmar: string },
    acao: 'suspender' | 'reativar',
    sucesso: string,
  ): Promise<void> {
    await this.confirmacao.confirmar({
      ...pedido,
      cancelar: 'Voltar',
      executar: async () => {
        await this.api.acaoContrato(this.id(), acao);
        this.avisos.sucesso(sucesso);
        this.recarregar();
      },
    });
  }

  protected async salvarEdicao(): Promise<void> {
    const c = this.contrato();
    const valor = numeroDoCampo(this.fValor());
    if (!c || valor === null || valor <= 0 || this.fProduto().trim() === '') {
      this.erroForm.set('Informe o produto e um valor maior que zero.');
      return;
    }
    const mudouValor = valor !== paraNumero(c.valor) || this.fPeriodicidade() !== c.periodicidade;
    await this.executar(
      () =>
        this.api.alterarContrato(this.id(), {
          produto: this.fProduto().trim(),
          valor: paraDecimal(valor),
          periodicidade: this.fPeriodicidade() ?? c.periodicidade,
          fimEm: this.fFim(),
          renovacaoEm: this.fRenovacao(),
          renovacaoAutomatica: this.fAutomatica(),
          diaVencimento: numeroDoCampo(this.fDia()),
          ...(mudouValor ? { atualizarParcelasAbertas: this.fAtualizarParcelas() } : {}),
        }),
      this.edicaoAberta,
      'Contrato atualizado.',
    );
  }

  protected async cancelar(): Promise<void> {
    if (this.motivo().trim().length < 3) {
      this.erroForm.set('Conte o motivo do cancelamento.');
      return;
    }
    await this.executar(
      () =>
        this.api.acaoContrato(this.id(), 'cancelar', {
          motivo: this.motivo().trim(),
          cancelarParcelas: this.cancelarParcelas(),
        }),
      this.cancelamentoAberto,
      'Contrato cancelado.',
    );
  }

  protected async gerarMais(): Promise<void> {
    const qtd = numeroDoCampo(this.quantidade());
    if (qtd === null || qtd < 1) {
      this.erroForm.set('Informe quantas parcelas criar.');
      return;
    }
    await this.executar(
      () => this.api.maisParcelas(this.id(), Math.floor(qtd)),
      this.maisAberto,
      'Parcelas criadas.',
    );
  }

  private async executar(
    acao: () => Promise<unknown>,
    modal: { set(v: boolean): void },
    sucesso: string,
  ): Promise<void> {
    if (this.salvando()) {
      return;
    }
    this.salvando.set(true);
    this.erroForm.set(null);
    try {
      await acao();
      this.avisos.sucesso(sucesso);
      modal.set(false);
      this.recarregar();
    } catch (falha) {
      this.erroForm.set(textoDoErro(falha));
    } finally {
      this.salvando.set(false);
    }
  }
}
