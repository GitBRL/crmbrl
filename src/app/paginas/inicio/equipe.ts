import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { ErroApi } from '../../nucleo/api/erro-api';
import { formatarMoedaAbreviada } from '../../nucleo/formatos';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { Dica } from '../../ui/dica/dica';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Selo } from '../../ui/selo/selo';
import type { RespostaPainel } from '../bi/bi.tipos';
import type { Periodo } from './dados-exemplo';
import type { EstadoJornada } from './jornada';

interface PessoaDoRanking {
  readonly posicao: number;
  readonly nome: string;
  readonly ganhos: number;
  readonly valorGanho: string;
  readonly atividades: number;
  /** Taxa de ganho, de 0 a 100. */
  readonly taxa: number;
  /** Progresso da barra, de 0 a 1. */
  readonly progresso: number;
}

/**
 * Aba "Equipe" do palco: o ranking do painel Comercial do BI (`GET /bi/comercial`) por negócios
 * ganhos no período, com o valor ganho, as atividades feitas e a taxa de ganho em barra. É uma
 * lista ordenada com os números em `<dl>`: no desktop, as linhas se alinham como uma tabela sob
 * um cabeçalho visual; no celular, cada pessoa vira um cartão com os rótulos visíveis. O nome
 * da aba já titula o painel: o título fica só para leitores de tela.
 */
@Component({
  selector: 'app-inicio-equipe',
  imports: [Avatar, Botao, DecimalPipe, Dica, Esqueleto, EstadoVazio, RouterLink, Selo],
  template: `
    <h2 class="visualmente-oculto">Equipe comercial · {{ periodo().complemento }}</h2>
    @switch (estado()) {
      @case ('carregando') {
        <div class="palco__bloco" aria-busy="true">
          <span class="visualmente-oculto" role="status">Carregando a equipe…</span>
          <app-esqueleto forma="bloco" altura="3.5rem" [linhas]="4" />
        </div>
      }
      @case ('erro') {
        <app-estado-vazio
          compacto
          variante="erro"
          [falha]="erro()"
          titulo="Não conseguimos carregar a equipe"
          [texto]="erro()?.resumo ?? null"
          [codigo]="erro()?.requisicaoId ?? null"
        >
          <button appBotao variante="invertido" type="button" (click)="recarregar.emit()">
            Tentar de novo
          </button>
        </app-estado-vazio>
      }
      @default {
        <header class="palco__topo">
          <div class="palco__titulo-linha">
            <app-selo>{{ ganhos() | number }} negócios ganhos</app-selo>
            <app-dica
              rotulo="Como o ranking funciona"
              texto="A ordem é por negócios ganhos no período; no empate, vem antes quem ganhou mais valor. A taxa de ganho é a parte dos negócios fechados (ganhos mais perdidos) que foi ganha. Quem tem só os próprios negócios vê só a si mesmo."
            />
          </div>
        </header>

        @if (linhas().length === 0) {
          <app-estado-vazio
            compacto
            titulo="Ninguém com negócios no período"
            texto="Quando houver negócios na equipe comercial, o ranking aparece aqui."
          />
        } @else {
          <div class="ranking">
            <div class="ranking__linha ranking__cabecalho" aria-hidden="true">
              <span>Pessoa</span>
              <span>Ganhos</span>
              <span>Atividades</span>
              <span>Taxa de ganho</span>
            </div>
            <ol
              class="ranking__lista"
              role="list"
              [attr.aria-label]="'Ranking da equipe comercial, ' + periodo().descricao"
            >
              @for (pessoa of linhas(); track pessoa.nome) {
                <li class="ranking__linha ranking__item">
                  <span class="ranking__posicao" aria-hidden="true">{{ pessoa.posicao }}</span>
                  <div class="ranking__pessoa">
                    <app-avatar [nome]="pessoa.nome" tamanho="sm" decorativo />
                    <div class="ranking__nome-papel">
                      <span class="ranking__nome">
                        <span class="visualmente-oculto">{{ pessoa.posicao }}º lugar:</span>
                        {{ pessoa.nome }}
                      </span>
                      <app-selo>{{ pessoa.valorGanho }}</app-selo>
                    </div>
                  </div>
                  <dl class="ranking__dados">
                    <div class="ranking__dado">
                      <dt>Negócios ganhos</dt>
                      <dd class="ranking__numero">{{ pessoa.ganhos | number }}</dd>
                    </div>
                    <div class="ranking__dado">
                      <dt>Atividades feitas</dt>
                      <dd class="ranking__numero">{{ pessoa.atividades | number }}</dd>
                    </div>
                    <div class="ranking__dado">
                      <dt>Taxa de ganho</dt>
                      <dd class="meta" [class.meta--batida]="pessoa.taxa >= 50">
                        <span class="meta__trilho" aria-hidden="true">
                          <span class="meta__cheio" [style.--progresso]="pessoa.progresso"></span>
                        </span>
                        <span class="meta__texto">{{ pessoa.taxa | number: '1.0-0' }}%</span>
                      </dd>
                    </div>
                  </dl>
                </li>
              }
            </ol>
          </div>
        }

        <p class="palco__nota">
          <a appBotao tamanho="sm" routerLink="/bi/comercial">Ver o painel completo no BI</a>
        </p>
      }
    }
  `,
  styleUrl: './equipe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioEquipe {
  /** O painel Comercial do BI; `null` quando o papel não o vê. */
  readonly resposta = input.required<RespostaPainel | null>();
  readonly estado = input<EstadoJornada>('carregando');
  readonly erro = input<ErroApi | null>(null);
  readonly periodo = input.required<Periodo>();
  readonly recarregar = output<void>();

  /** Quem tem negócio no período ou na carteira, por ganhos e, no empate, por valor ganho. */
  protected readonly linhas = computed<readonly PessoaDoRanking[]>(() => {
    const linhas = this.resposta()?.tabelas['ranking']?.linhas ?? [];
    return linhas
      .map((linha) => ({
        nome: String(linha['nome'] ?? ''),
        ganhos: Number(linha['ganhos']) || 0,
        valor: Number(linha['valorGanho']) || 0,
        atividades: Number(linha['atividadesFeitas']) || 0,
        taxa: Number(linha['taxaGanho']) || 0,
      }))
      .sort((a, b) => b.ganhos - a.ganhos || b.valor - a.valor)
      .map((pessoa, indice) => ({
        posicao: indice + 1,
        nome: pessoa.nome,
        ganhos: pessoa.ganhos,
        valorGanho: formatarMoedaAbreviada(pessoa.valor, 'pt-BR'),
        atividades: pessoa.atividades,
        taxa: pessoa.taxa,
        progresso: Math.max(0.02, Math.min(pessoa.taxa, 100) / 100),
      }));
  });

  protected readonly ganhos = computed(() =>
    this.linhas().reduce((total, pessoa) => total + pessoa.ganhos, 0),
  );
}
