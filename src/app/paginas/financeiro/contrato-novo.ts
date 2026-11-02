import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideArrowLeft } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { paraDecimal, paraNumero } from '../../nucleo/formatos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Alternador } from '../../ui/alternador/alternador';
import { Botao } from '../../ui/botao/botao';
import { CampoData } from '../../ui/campo-data/campo-data';
import { CampoTexto, type ValorCampoTexto } from '../../ui/campo-texto/campo-texto';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { AtividadesApi, type Vinculo } from '../atividades/atividades.api';
import { SeletorVinculo } from '../atividades/seletor-vinculo';
import { FinanceiroApi } from './financeiro.api';
import {
  hojeIso,
  PERIODICIDADES,
  type Periodicidade,
  ROTULO_PERIODICIDADE,
} from './financeiro.tipos';
import { numeroDoCampo, textoDoErro } from './modais-parcela';

const OPCOES_PERIODICIDADE: readonly OpcaoSeletor<Periodicidade>[] = PERIODICIDADES.map(
  (valor) => ({ valor, rotulo: ROTULO_PERIODICIDADE[valor] }),
);

/**
 * Novo contrato (`/financeiro/contratos/novo`). Com `?negocio=<id>` (link da notificação “negócio
 * ganho”), o formulário já vem preenchido pela sugestão da API.
 */
@Component({
  selector: 'app-contrato-novo',
  imports: [
    RouterLink,
    Alternador,
    Botao,
    CampoData,
    CampoTexto,
    Cartao,
    EstadoVazio,
    Esqueleto,
    Seletor,
    SeletorVinculo,
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
    <header class="cabecalho">
      <h2 class="texto-display">Novo contrato</h2>
      <p class="frase">
        Preencha o que foi vendido e quanto o cliente paga. O CRM cria as parcelas e a régua de
        cobrança cuida do resto.
      </p>
    </header>

    @if (!podeCriar()) {
      <app-estado-vazio
        variante="sem-acesso"
        titulo="Você não pode criar contratos"
        texto="Só Admin, C-level, Líder de CS e CS criam contratos."
      />
    } @else if (sugestao.isLoading()) {
      <div class="carregando" aria-busy="true">
        <p class="visualmente-oculto" role="status">Buscando os dados do negócio…</p>
        <app-esqueleto altura="3rem" />
        <app-esqueleto altura="12rem" />
      </div>
    } @else if (bloqueio(); as motivo) {
      <app-estado-vazio [titulo]="motivo.titulo" [texto]="motivo.texto">
        @if (motivo.contratoLink) {
          <a appBotao variante="invertido" routerLink="/financeiro/contratos">Ver contratos</a>
        }
      </app-estado-vazio>
    } @else {
      <app-cartao>
        <form class="formulario" (submit)="$event.preventDefault(); salvar()">
          @if (negocioId()) {
            <p class="nota">Este contrato nasce de um negócio ganho: cliente e negócio vêm dele.</p>
          } @else {
            <app-seletor-vinculo
              rotulo="Cliente"
              placeholder="Buscar contato, empresa ou negócio ganho"
              [opcional]="false"
              dica="Quem assina o contrato. Escolha o contato ou a empresa."
              [erro]="erros()['cliente'] ?? null"
              [(vinculo)]="vinculo"
            />
          }
          <div class="grade-campos">
            <app-campo-texto
              rotulo="Produto ou plano"
              [maximoCaracteres]="200"
              [erro]="erros()['produto'] ?? null"
              [valor]="produto()"
              (valorChange)="produto.set('' + ($event ?? ''))"
            />
            <app-campo-texto
              rotulo="Valor"
              tipo="number"
              prefixo="R$"
              [passo]="0.01"
              [minimo]="0.01"
              [erro]="erros()['valor'] ?? null"
              [valor]="valor()"
              (valorChange)="valor.set($event)"
            />
            <app-seletor
              rotulo="Periodicidade"
              ajuda="Com que frequência o cliente paga o valor informado."
              [opcoes]="opcoesPeriodicidade"
              [(valor)]="periodicidade"
            />
            <app-campo-data
              rotulo="Início"
              [erro]="erros()['inicio'] ?? null"
              [(valor)]="inicioEm"
            />
            <app-campo-data
              rotulo="Fim do contrato"
              opcional
              ajuda="Deixe em branco para um contrato sem data de término."
              [minimo]="inicioEm()"
              [(valor)]="fimEm"
            />
            <app-campo-data
              rotulo="Próxima renovação"
              opcional
              [minimo]="inicioEm()"
              [(valor)]="renovacaoEm"
            />
            <app-campo-texto
              rotulo="Dia de vencimento"
              tipo="number"
              opcional
              [minimo]="1"
              [maximo]="31"
              [passo]="1"
              dica="Dia do mês em que as parcelas vencem. Em branco: o dia do início."
              [valor]="diaVencimento()"
              (valorChange)="diaVencimento.set($event)"
            />
            @if (escolheResponsavel()) {
              <app-seletor
                rotulo="Responsável de CS"
                placeholder="Escolha a pessoa"
                permitirVazio
                [opcoes]="opcoesResponsaveis()"
                [(valor)]="responsavelId"
              />
            }
          </div>
          <app-alternador rotulo="Renova sozinho" [(valor)]="renovacaoAutomatica" />
          <app-alternador rotulo="Criar as parcelas agora" [(valor)]="gerarParcelas" />
          @if (gerarParcelas()) {
            <app-campo-texto
              rotulo="Quantidade de parcelas"
              tipo="number"
              opcional
              [minimo]="1"
              [maximo]="120"
              [passo]="1"
              dica="Em branco: o CRM usa o fim do contrato ou, sem fim, 12 parcelas."
              [valor]="quantidade()"
              (valorChange)="quantidade.set($event)"
            />
          }

          @if (erroGeral(); as mensagem) {
            <p class="erro-inline" role="alert">{{ mensagem }}</p>
          }
          <div class="cabecalho__acoes">
            <button appBotao type="submit" variante="marca" [carregando]="salvando()">
              Criar contrato
            </button>
            <a appBotao variante="contorno" routerLink="/financeiro/contratos">Cancelar</a>
          </div>
        </form>
      </app-cartao>
    }
  `,
  styleUrl: './financeiro-comum.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContratoNovo {
  private readonly api = inject(FinanceiroApi);
  private readonly atividades = inject(AtividadesApi);
  private readonly sessao = inject(SessaoService);
  private readonly avisos = inject(AvisosService);
  private readonly roteador = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  protected readonly icones = { voltar: LucideArrowLeft };
  protected readonly opcoesPeriodicidade = OPCOES_PERIODICIDADE;

  protected readonly negocioId = signal<string | null>(
    this.rota.snapshot.queryParamMap.get('negocio'),
  );
  protected readonly podeCriar = computed(() =>
    this.sessao.temPapel('ADMIN', 'C_LEVEL', 'LIDER_CS', 'CS'),
  );
  /** CS (membro) sempre fica como responsável: o campo nem aparece. */
  protected readonly escolheResponsavel = computed(() => !this.sessao.temPapel('CS'));

  protected readonly vinculo = signal<Vinculo | null>(null);
  protected readonly produto = signal('');
  protected readonly valor = signal<ValorCampoTexto>(null);
  protected readonly periodicidade = signal<Periodicidade | null>('MENSAL');
  protected readonly inicioEm = signal<string | null>(hojeIso());
  protected readonly fimEm = signal<string | null>(null);
  protected readonly renovacaoEm = signal<string | null>(null);
  protected readonly diaVencimento = signal<ValorCampoTexto>(null);
  protected readonly responsavelId = signal<string | null>(null);
  protected readonly renovacaoAutomatica = signal(false);
  protected readonly gerarParcelas = signal(true);
  protected readonly quantidade = signal<ValorCampoTexto>(null);
  protected readonly salvando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  protected readonly erros = signal<Readonly<Record<string, string>>>({});

  private empresaIdSugerida: string | null = null;
  private contatoIdSugerido: string | null = null;

  protected readonly sugestao = resource({
    params: () => this.negocioId(),
    loader: async ({ params }) => {
      if (!params) {
        return null;
      }
      const s = await this.api.sugestaoDeContrato(params);
      if (s.sugestao) {
        const x = s.sugestao;
        this.produto.set(x.produto);
        this.valor.set(paraNumero(x.valor));
        this.periodicidade.set(x.periodicidade);
        this.inicioEm.set(x.inicioEm);
        this.responsavelId.set(x.responsavelCsId);
        this.empresaIdSugerida = x.empresaId;
        this.contatoIdSugerido = x.contatoId;
      }
      return s;
    },
  });

  private readonly responsaveis = resource({
    loader: () => this.atividades.responsaveis(),
  });
  protected readonly opcoesResponsaveis = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.responsaveis.hasValue()
      ? this.responsaveis
          .value()
          .map((u) => ({ valor: u.id, rotulo: `${u.nome} · ${u.rotuloPapel}` }))
      : [],
  );

  protected readonly bloqueio = computed(() => {
    if (this.sugestao.error()) {
      const falha = erroDaApi(this.sugestao.error());
      return {
        titulo: 'Não conseguimos buscar este negócio',
        texto: falha.resumo,
        contratoLink: false,
      };
    }
    const s = this.sugestao.hasValue() ? this.sugestao.value() : null;
    if (!s) {
      return null;
    }
    if (!s.negocioGanho) {
      return {
        titulo: 'Este negócio ainda não foi ganho',
        texto:
          'O contrato só pode nascer de um negócio ganho. Marque o negócio como ganho primeiro.',
        contratoLink: false,
      };
    }
    if (s.jaTemContrato) {
      return {
        titulo: 'Este negócio já tem contrato',
        texto: 'Procure o contrato na lista para consultar ou alterar.',
        contratoLink: true,
      };
    }
    return null;
  });

  protected async salvar(): Promise<void> {
    if (this.salvando()) {
      return;
    }
    const erros: Record<string, string> = {};
    const valor = numeroDoCampo(this.valor());
    const vinculo = this.vinculo();
    if (!this.negocioId() && !vinculo) {
      erros['cliente'] = 'Escolha o cliente do contrato.';
    }
    if (this.produto().trim() === '') {
      erros['produto'] = 'Diga o produto ou plano.';
    }
    if (valor === null || valor <= 0) {
      erros['valor'] = 'Informe um valor maior que zero.';
    }
    if (!this.inicioEm()) {
      erros['inicio'] = 'Escolha a data de início.';
    }
    this.erros.set(erros);
    this.erroGeral.set(null);
    if (Object.keys(erros).length > 0) {
      return;
    }
    const dia = numeroDoCampo(this.diaVencimento());
    const qtd = numeroDoCampo(this.quantidade());
    this.salvando.set(true);
    try {
      const criado = await this.api.criarContrato({
        negocioId: this.negocioId() ?? (vinculo?.tipo === 'negocio' ? vinculo.id : null),
        empresaId: this.negocioId()
          ? this.empresaIdSugerida
          : vinculo
            ? vinculo.tipo === 'empresa'
              ? vinculo.id
              : vinculo.empresaId
            : null,
        contatoId: this.negocioId()
          ? this.contatoIdSugerido
          : vinculo
            ? vinculo.tipo === 'contato'
              ? vinculo.id
              : vinculo.contatoId
            : null,
        produto: this.produto().trim(),
        valor: paraDecimal(valor)!,
        periodicidade: this.periodicidade() ?? 'MENSAL',
        inicioEm: this.inicioEm()!,
        fimEm: this.fimEm(),
        renovacaoEm: this.renovacaoEm(),
        renovacaoAutomatica: this.renovacaoAutomatica(),
        diaVencimento: dia,
        responsavelCsId: this.escolheResponsavel() ? this.responsavelId() : null,
        gerarParcelas: this.gerarParcelas(),
        quantidadeParcelas: this.gerarParcelas() ? qtd : null,
      });
      this.avisos.sucesso(`Contrato ${criado.codigo} criado.`);
      await this.roteador.navigate(['/financeiro/contratos', criado.id]);
    } catch (falha) {
      this.erroGeral.set(textoDoErro(falha));
    } finally {
      this.salvando.set(false);
    }
  }
}
