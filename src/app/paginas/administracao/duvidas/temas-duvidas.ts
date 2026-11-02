import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';

import { erroDaApi, type ErroApi } from '../../../nucleo/api/erro-api';
import { formatarTempoRelativo } from '../../../nucleo/formatos';
import { ROTULO_CATEGORIA, type TemaSemResposta } from '../../../layout/ajuda/ajuda.tipos';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { CampoData } from '../../../ui/campo-data/campo-data';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { CelulaTabela } from '../../../ui/tabela/celula-tabela';
import { Tabela, type ColunaTabela } from '../../../ui/tabela/tabela';
import { DuvidasApi } from './duvidas.api';

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'resumo', rotulo: 'Tema' },
  { id: 'modulo', rotulo: 'Módulo', largura: '9rem' },
  { id: 'categoria', rotulo: 'Tipo', largura: '11rem' },
  { id: 'total', rotulo: 'Pedidos', alinhar: 'fim', largura: '6rem' },
  { id: 'pessoas', rotulo: 'Pessoas', alinhar: 'fim', largura: '6rem' },
  { id: 'ultima', rotulo: 'Último', largura: '8rem' },
  { id: 'acao', rotulo: '', largura: '9rem', noCartao: 'mostrar' },
];

/**
 * Temas mais pedidos sem resposta: perguntas não resolvidas (pedidos fora do escopo não
 * contam) ou avaliadas como não úteis, agrupadas pelo resumo do pedido. Mostra o que falta
 * na ajuda ou no CRM.
 */
@Component({
  selector: 'app-temas-duvidas',
  imports: [Botao, Cartao, CampoData, CelulaTabela, EstadoVazio, Tabela],
  template: `
    <app-cartao
      titulo="Temas sem resposta"
      dica="Perguntas que o assistente não conseguiu resolver, ou que foram marcadas como não úteis, agrupadas pelo assunto. Os mais pedidos aparecem primeiro."
    >
      <div class="filtros__grade filtros__grade--curta">
        <app-campo-data rotulo="De" [(valor)]="de" (valorChange)="carregar()" />
        <app-campo-data rotulo="Até" [(valor)]="ate" (valorChange)="carregar()" />
      </div>
      @if (erro(); as falha) {
        <app-estado-vazio
          compacto
          variante="erro"
          titulo="Não conseguimos carregar os temas"
          [falha]="falha"
          [texto]="falha.resumo"
          [codigo]="falha.requisicaoId"
        >
          <button appBotao variante="invertido" type="button" (click)="carregar()">
            Tentar de novo
          </button>
        </app-estado-vazio>
      } @else if (!carregando() && temas().length === 0) {
        <app-estado-vazio
          compacto
          titulo="Nenhum tema pendente"
          texto="Todas as perguntas do período foram resolvidas ou avaliadas como úteis."
        />
      } @else {
        <app-tabela
          rotulo="Temas mais pedidos sem resposta"
          densa
          colunaPrincipal="resumo"
          [colunas]="colunas"
          [linhas]="temas()"
          [carregando]="carregando()"
        >
          <ng-template appCelula="resumo" [appCelulaDe]="temas()" let-t>{{ t.resumo }}</ng-template>
          <ng-template appCelula="modulo" [appCelulaDe]="temas()" let-t>{{
            t.modulo ?? '—'
          }}</ng-template>
          <ng-template appCelula="categoria" [appCelulaDe]="temas()" let-t>{{
            t.categoria ? rotuloCategoria[t.categoria] : '—'
          }}</ng-template>
          <ng-template appCelula="total" [appCelulaDe]="temas()" let-t>{{ t.total }}</ng-template>
          <ng-template appCelula="pessoas" [appCelulaDe]="temas()" let-t>{{
            t.pessoas
          }}</ng-template>
          <ng-template appCelula="ultima" [appCelulaDe]="temas()" let-t>{{
            quando(t.ultimaEm)
          }}</ng-template>
          <ng-template appCelula="acao" [appCelulaDe]="temas()" let-t>
            <button appBotao tamanho="sm" variante="contorno" type="button" (click)="ver.emit(t)">
              Ver perguntas
            </button>
          </ng-template>
        </app-tabela>
      }
    </app-cartao>
  `,
  styleUrl: './duvidas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemasDuvidas {
  private readonly api = inject(DuvidasApi);

  /** Pede ao histórico as perguntas não resolvidas do tema. */
  readonly ver = output<TemaSemResposta>();

  protected readonly colunas = COLUNAS;
  protected readonly rotuloCategoria = ROTULO_CATEGORIA;
  protected readonly de = signal<string | null>(null);
  protected readonly ate = signal<string | null>(null);
  protected readonly temas = signal<readonly TemaSemResposta[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  private consulta = 0;

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    const consulta = ++this.consulta;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const temas = await this.api.temas(this.de(), this.ate());
      if (consulta === this.consulta) {
        this.temas.set(temas);
      }
    } catch (falha) {
      if (consulta === this.consulta) {
        this.erro.set(erroDaApi(falha));
      }
    } finally {
      if (consulta === this.consulta) {
        this.carregando.set(false);
      }
    }
  }

  protected quando(valor: string): string {
    return formatarTempoRelativo(valor);
  }
}
