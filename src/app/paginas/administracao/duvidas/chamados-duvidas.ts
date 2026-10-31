import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { type Pagina, POR_PAGINA_PADRAO } from '../../../nucleo/api/api';
import { erroDaApi, type ErroApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { formatarDataHora } from '../../../nucleo/formatos';
import {
  ROTULO_CATEGORIA,
  type ChamadoAdmin,
  type StatusChamado,
} from '../../../layout/ajuda/ajuda.tipos';
import { linkSeguro } from '../../../layout/ajuda/ajuda';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { CampoData } from '../../../ui/campo-data/campo-data';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { Paginacao } from '../../../ui/paginacao/paginacao';
import { Seletor, type OpcaoSeletor } from '../../../ui/seletor/seletor';
import { Selo, type VarianteSelo } from '../../../ui/selo/selo';
import { CelulaTabela } from '../../../ui/tabela/celula-tabela';
import { Tabela, type ColunaTabela } from '../../../ui/tabela/tabela';
import { DuvidasApi } from './duvidas.api';

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'quando', rotulo: 'Aberto', largura: '9rem' },
  { id: 'usuario', rotulo: 'Pessoa', largura: '10rem' },
  { id: 'titulo', rotulo: 'Título' },
  { id: 'destino', rotulo: 'Destino', largura: '8rem' },
  { id: 'status', rotulo: 'Situação', largura: '9rem' },
  { id: 'detalhe', rotulo: 'Detalhe', largura: '13rem' },
  { id: 'acao', rotulo: '', largura: '8rem' },
];

const STATUS: readonly OpcaoSeletor<StatusChamado>[] = [
  { valor: 'PENDENTE', rotulo: 'Pendente' },
  { valor: 'ENVIADO', rotulo: 'Enviado' },
  { valor: 'FALHOU', rotulo: 'Falhou' },
];
const SELO: Readonly<Record<StatusChamado, VarianteSelo>> = {
  PENDENTE: 'neutro',
  ENVIADO: 'menta',
  FALHOU: 'coral',
};
const ROTULO_STATUS: Readonly<Record<StatusChamado, string>> = {
  PENDENTE: 'Pendente',
  ENVIADO: 'Enviado',
  FALHOU: 'Falhou',
};

/** Chamados abertos pelo assistente: situação, número no destino e reenvio dos que falharam. */
@Component({
  selector: 'app-chamados-duvidas',
  imports: [Botao, Cartao, CampoData, CelulaTabela, EstadoVazio, Paginacao, Seletor, Selo, Tabela],
  template: `
    <app-cartao
      titulo="Chamados abertos"
      dica="Pedidos que o assistente encaminhou para o TicketHub ou para o webhook configurado. Os que falharam podem ser reenviados."
    >
      <div class="filtros__grade">
        <app-seletor
          rotulo="Situação"
          permitirVazio
          placeholder="Todas"
          [opcoes]="opcoesStatus"
          [(valor)]="status"
          (valorChange)="mudou()"
        />
        <app-campo-data rotulo="De" [(valor)]="de" (valorChange)="mudou()" />
        <app-campo-data rotulo="Até" [(valor)]="ate" (valorChange)="mudou()" />
      </div>
      @if (erro(); as falha) {
        <app-estado-vazio
          compacto
          variante="erro"
          titulo="Não conseguimos carregar os chamados"
          [falha]="falha"
          [texto]="falha.resumo"
          [codigo]="falha.requisicaoId"
        >
          <button appBotao variante="invertido" type="button" (click)="carregar()">
            Tentar de novo
          </button>
        </app-estado-vazio>
      } @else if (!carregando() && itens().length === 0) {
        <app-estado-vazio
          compacto
          titulo="Nenhum chamado"
          texto="Quando uma pessoa confirmar um chamado pelo assistente, ele aparece aqui."
        />
      } @else {
        <app-tabela
          rotulo="Chamados do assistente"
          densa
          colunaPrincipal="titulo"
          [colunas]="colunas"
          [linhas]="itens()"
          [carregando]="carregando()"
        >
          <ng-template appCelula="quando" [appCelulaDe]="itens()" let-c>{{
            dataHora(c.criadoEm)
          }}</ng-template>
          <ng-template appCelula="usuario" [appCelulaDe]="itens()" let-c>{{
            c.usuario.nome
          }}</ng-template>
          <ng-template appCelula="titulo" [appCelulaDe]="itens()" let-c>
            {{ c.titulo }}
            @if (c.categoria) {
              <span class="consulta__fraco"> · {{ rotuloCategoria[c.categoria] }}</span>
            }
          </ng-template>
          <ng-template appCelula="destino" [appCelulaDe]="itens()" let-c>{{
            c.destino === 'TICKETHUB' ? 'TicketHub' : 'Webhook'
          }}</ng-template>
          <ng-template appCelula="status" [appCelulaDe]="itens()" let-c>
            <app-selo tamanho="sm" [variante]="selo[c.status]">{{
              rotuloStatus[c.status]
            }}</app-selo>
          </ng-template>
          <ng-template appCelula="detalhe" [appCelulaDe]="itens()" let-c>
            @if (c.status === 'ENVIADO') {
              Nº {{ c.numero ?? '—' }}
              @if (link(c); as endereco) {
                <a [href]="endereco" target="_blank" rel="noopener noreferrer">abrir</a>
              }
            } @else if (c.status === 'FALHOU') {
              <span class="consulta__fraco">{{ c.ultimoErro ?? 'Falha no envio' }}</span>
            } @else {
              <span class="consulta__fraco">{{ c.tentativas }} tentativas</span>
            }
          </ng-template>
          <ng-template appCelula="acao" [appCelulaDe]="itens()" let-c>
            @if (c.status === 'FALHOU') {
              <button
                appBotao
                tamanho="sm"
                variante="contorno"
                type="button"
                [carregando]="reenviando() === c.id"
                (click)="reenviar(c)"
              >
                Reenviar
              </button>
            }
          </ng-template>
        </app-tabela>
        @if (lista(); as l) {
          <app-paginacao
            rotulo="Paginação dos chamados"
            [total]="l.total"
            [porPagina]="porPagina()"
            [(pagina)]="pagina"
            (paginaChange)="carregar()"
          />
        }
      }
    </app-cartao>
  `,
  styleUrl: './duvidas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChamadosDuvidas {
  private readonly api = inject(DuvidasApi);
  private readonly avisos = inject(AvisosService);

  protected readonly colunas = COLUNAS;
  protected readonly opcoesStatus = STATUS;
  protected readonly selo = SELO;
  protected readonly rotuloStatus = ROTULO_STATUS;
  protected readonly rotuloCategoria = ROTULO_CATEGORIA;
  protected readonly status = signal<StatusChamado | null>(null);
  protected readonly de = signal<string | null>(null);
  protected readonly ate = signal<string | null>(null);
  protected readonly pagina = signal(1);
  protected readonly lista = signal<Pagina<ChamadoAdmin> | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly reenviando = signal<string | null>(null);
  protected readonly itens = computed(() => this.lista()?.itens ?? []);
  protected readonly porPagina = computed(() => this.lista()?.porPagina ?? POR_PAGINA_PADRAO);
  private consulta = 0;

  constructor() {
    void this.carregar();
  }

  protected mudou(): void {
    this.pagina.set(1);
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    const consulta = ++this.consulta;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const lista = await this.api.chamados({
        status: this.status(),
        de: this.de(),
        ate: this.ate(),
        pagina: this.pagina(),
      });
      if (consulta === this.consulta) {
        this.lista.set(lista);
      }
    } catch (falha) {
      if (consulta === this.consulta) {
        this.erro.set(erroDaApi(falha));
        this.lista.set(null);
      }
    } finally {
      if (consulta === this.consulta) {
        this.carregando.set(false);
      }
    }
  }

  protected async reenviar(chamado: ChamadoAdmin): Promise<void> {
    this.reenviando.set(chamado.id);
    try {
      await this.api.reenviar(chamado.id);
      this.avisos.sucesso('Chamado na fila para novo envio.');
      await this.carregar();
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.reenviando.set(null);
    }
  }

  protected dataHora(valor: string): string {
    return formatarDataHora(valor);
  }

  protected link(chamado: ChamadoAdmin): string | null {
    return linkSeguro(chamado.link);
  }
}
