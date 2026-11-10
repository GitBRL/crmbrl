import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import { LucideRefreshCw, LucideWorkflow } from '@lucide/angular';

import { type Area } from '../../nucleo/sessao/perfil';
import { nomeDoSetor } from '../../nucleo/setores/setores';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Dica } from '../../ui/dica/dica';
import { FunisApi } from './funis.api';
import type { PassagemDoFunil, RegraDoRodizio } from './funis.tipos';
import { dicasDoFunil, dicaDasPassagens, dicaDoRodizio } from './regras-funis';

/**
 * Dicas do cabeçalho do quadro (TELAS-FASE1 §3.1): como funcionam as passagens e o rodízio
 * daquele funil, em pílulas de contorno com o ícone num círculo e o balão de ajuda. A pílula
 * inteira abre o balão (o "?" continua sendo o caminho pelo teclado).
 *
 * Quem lê a configuração vê as dicas montadas dos dados: Admin e C-level leem as passagens;
 * Admin, C-level e a liderança, o rodízio. Os outros (e se a leitura falhar) veem a
 * configuração padrão em frases condicionais, com o lugar onde conferir.
 */
@Component({
  selector: 'app-regras-funil',
  imports: [Dica, LucideRefreshCw, LucideWorkflow],
  template: `
    <ul class="regras" aria-label="Regras automáticas deste funil">
      <li class="regra" (pointerdown)="lembrar(0)" (click)="abrirPelaPilula($event, 0)">
        <span class="regra__circulo" aria-hidden="true"><svg lucideWorkflow [size]="16" /></span>
        Passagens
        <app-dica
          [rotulo]="'Como funcionam as passagens do funil ' + nomeDaArea()"
          titulo="Passagens entre funis"
          [texto]="dicas().passagens"
        />
      </li>
      <li class="regra" (pointerdown)="lembrar(1)" (click)="abrirPelaPilula($event, 1)">
        <span class="regra__circulo" aria-hidden="true"><svg lucideRefreshCw [size]="16" /></span>
        Rodízio
        <app-dica
          [rotulo]="'Como funciona o rodízio do funil ' + nomeDaArea()"
          titulo="Distribuição por rodízio"
          [texto]="dicas().rodizio"
        />
      </li>
    </ul>
  `,
  styles: `
    .regras {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .regra {
      display: inline-flex;
      align-items: center;
      gap: var(--esp-2);
      min-height: var(--altura-sm);
      padding: 2px var(--esp-1) 2px 2px;
      border: 1px solid var(--cor-borda-forte);
      border-radius: var(--raio-pilula);
      color: var(--cor-texto-suave);
      font: var(--fonte-rotulo);
      cursor: pointer;
      transition:
        background-color var(--duracao) var(--curva),
        color var(--duracao) var(--curva);

      &:hover {
        background: var(--cor-vidro);
        color: var(--cor-texto);
      }
    }

    .regra__circulo {
      display: inline-grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--cor-superficie-3);
      color: var(--cor-texto);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegrasFunil {
  readonly area = input.required<Area>();
  /** O funil do quadro (a área pode ter mais de um). */
  readonly funilId = input<string | null>(null);

  private readonly sessao = inject(SessaoService);
  private readonly api = inject(FunisApi);
  private readonly balioes = viewChildren(Dica);
  private readonly passagens = signal<readonly PassagemDoFunil[] | null>(null);
  private readonly regras = signal<readonly RegraDoRodizio[] | null>(null);
  /** A dica estava aberta quando o clique começou (o clique fora a fecha antes do "click"). */
  private estavaAberta = false;

  protected readonly nomeDaArea = computed(() => nomeDoSetor(this.area()));
  protected readonly dicas = computed(() => {
    const area = this.area();
    const padrao = dicasDoFunil(area);
    const passagens = this.passagens();
    const regra = this.regras()?.find((item) => item.area === area);
    return {
      passagens: passagens ? dicaDasPassagens(area, this.funilId(), passagens) : padrao.passagens,
      rodizio: regra ? dicaDoRodizio(area, regra) : padrao.rodizio,
    };
  });

  constructor() {
    const permissoes = this.sessao.permissoes();
    if (permissoes?.configurarPassagens) {
      this.api.passagens().then(
        (lista) => this.passagens.set(lista),
        () => undefined, // fica a dica padrão
      );
    }
    if (permissoes && permissoes.configurarRodizio !== 'NENHUM') {
      this.api.regrasDistribuicao().then(
        (lista) => this.regras.set(lista),
        () => undefined,
      );
    }
  }

  protected lembrar(indice: number): void {
    this.estavaAberta = this.balioes()[indice]?.estaAberta() ?? false;
  }

  /** Clique na pílula (fora do "?"): abre o balão; se ele já estava aberto, fica fechado. */
  protected abrirPelaPilula(evento: MouseEvent, indice: number): void {
    const dica = this.balioes()[indice];
    const noProprioBotao = (evento.target as Element | null)?.closest('app-dica');
    if (!dica || noProprioBotao || this.estavaAberta) {
      return;
    }
    dica.abrir();
  }
}
