import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideUserMinus } from '@lucide/angular';

import { Avatar } from '../../ui/avatar/avatar';
import { Dica } from '../../ui/dica/dica';
import { Selo } from '../../ui/selo/selo';
import { DESLIGAMENTO, type DadosEquipe, type Periodo } from './dados-exemplo';

/**
 * Aba "Equipe" do palco: ranking da equipe comercial por negócios ganhos, com o papel, as
 * atividades concluídas e a meta em barra. É uma lista ordenada com os números em `<dl>`:
 * no desktop, as linhas se alinham como uma tabela sob um cabeçalho visual; no celular,
 * cada pessoa vira um cartão com os rótulos visíveis. O nome da aba já titula o painel: o
 * título fica só para leitores de tela.
 */
@Component({
  selector: 'app-inicio-equipe',
  imports: [Avatar, DecimalPipe, Dica, LucideUserMinus, Selo],
  template: `
    <h2 class="visualmente-oculto">Equipe comercial · {{ periodo().complemento }}</h2>
    <header class="palco__topo">
      <div class="palco__titulo-linha">
        <app-selo>{{ dados().ganhos | number }} negócios ganhos</app-selo>
        <app-dica
          rotulo="Como o ranking funciona"
          texto="Ordem por negócios ganhos no período; no empate, vem antes quem está mais perto da meta. A meta de cada pessoa é definida pelo líder dela."
        />
      </div>
    </header>

    <div class="ranking">
      <div class="ranking__linha ranking__cabecalho" aria-hidden="true">
        <span>Pessoa</span>
        <span>Ganhos</span>
        <span>Atividades</span>
        <span>Meta</span>
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
                <app-selo>{{ pessoa.rotuloPapel }}</app-selo>
              </div>
            </div>
            <dl class="ranking__dados">
              <div class="ranking__dado">
                <dt>Negócios ganhos</dt>
                <dd class="ranking__numero">{{ pessoa.ganhos | number }}</dd>
              </div>
              <div class="ranking__dado">
                <dt>Atividades concluídas</dt>
                <dd class="ranking__numero">{{ pessoa.atividades | number }}</dd>
              </div>
              <div class="ranking__dado">
                <dt>Meta</dt>
                <dd class="meta" [class.meta--batida]="pessoa.percentualMeta >= 100">
                  <span class="meta__trilho" aria-hidden="true">
                    <span class="meta__cheio" [style.--progresso]="pessoa.progresso"></span>
                  </span>
                  <span class="meta__texto">{{ pessoa.percentualMeta }}%</span>
                  <span class="visualmente-oculto">
                    ({{ pessoa.ganhos | number }} de {{ pessoa.meta | number }})
                  </span>
                </dd>
              </div>
            </dl>
          </li>
        }
      </ol>
    </div>

    <p class="palco__nota">
      <svg lucideUserMinus [size]="16" />
      <span>
        {{ desligamento.pessoa }} foi desligado hoje e saiu do ranking: as
        {{ desligamento.atividades }} atividades pendentes dele foram para
        {{ desligamento.destino }} ({{ desligamento.papelDestino }}), e ele deixou o rodízio de
        leads.
      </span>
    </p>
  `,
  styleUrl: './equipe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioEquipe {
  readonly dados = input.required<DadosEquipe>();
  readonly periodo = input.required<Periodo>();

  protected readonly desligamento = DESLIGAMENTO;
  /** Progresso da barra de meta, de 0 a 1 (quem passou da meta enche a barra). */
  protected readonly linhas = computed(() =>
    this.dados().pessoas.map((pessoa) => ({
      ...pessoa,
      progresso: Math.max(0.02, Math.min(pessoa.percentualMeta, 100) / 100),
    })),
  );
}
