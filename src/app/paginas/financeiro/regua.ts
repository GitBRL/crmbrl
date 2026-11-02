import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { LucidePause, LucidePlay, LucideRefreshCw, LucideZap } from '@lucide/angular';
import { map } from 'rxjs';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { formatarDataHora } from '../../nucleo/formatos';
import { aoReceber } from '../../nucleo/tempo-real/auxiliares';
import { Botao } from '../../ui/botao/botao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Selo } from '../../ui/selo/selo';
import { FinanceiroApi } from './financeiro.api';
import { ReguaConfig } from './regua-config';
import { ReguaEtapas } from './regua-etapas';
import { ReguaHoje } from './regua-hoje';
import { ReguaLigacoes } from './regua-ligacoes';

const ABAS = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'ligacoes', rotulo: 'Ligações' },
  { id: 'etapas', rotulo: 'Etapas' },
  { id: 'configuracao', rotulo: 'Configuração' },
] as const;

/**
 * Régua de cobrança (`/financeiro/regua/:aba`): o acompanhamento do dia, as ligações pendentes, as
 * etapas editáveis e a configuração. Quem gerencia (Admin, C-level, Líder de CS) também pausa,
 * retoma e executa a régua na hora.
 */
@Component({
  selector: 'app-regua',
  imports: [
    RouterLink,
    RouterLinkActive,
    Botao,
    EstadoVazio,
    Esqueleto,
    ReguaConfig,
    ReguaEtapas,
    ReguaHoje,
    ReguaLigacoes,
    Selo,
  ],
  template: `
    <div class="cabecalho__linha">
      <p class="frase">
        A régua cobra sozinha: manda lembretes antes e depois do vencimento por WhatsApp e e-mail e
        cria ligações para a equipe fazer.
      </p>
      @if (resumo.hasValue() && resumo.value().podeGerenciar) {
        <div class="cabecalho__acoes">
          <button
            appBotao
            type="button"
            variante="contorno"
            [icone]="resumo.value().pausada ? icones.retomar : icones.pausar"
            [carregando]="agindo()"
            (click)="pausarOuRetomar()"
          >
            {{ resumo.value().pausada ? 'Retomar régua' : 'Pausar régua' }}
          </button>
          <button
            appBotao
            type="button"
            variante="destaque"
            [icone]="icones.executar"
            [carregando]="executando()"
            (click)="executar()"
          >
            Executar agora
          </button>
        </div>
      }
    </div>

    @if (resumo.hasValue()) {
      <p class="status">
        @if (!resumo.value().ativa) {
          <app-selo variante="neutro">Régua desligada</app-selo>
        } @else if (resumo.value().pausada) {
          <app-selo variante="lima">Régua pausada</app-selo>
        } @else {
          <app-selo ponto variante="menta">Régua ligada</app-selo>
        }
        <span class="nota">
          Roda todo dia às {{ resumo.value().horario }}.
          @if (resumo.value().ultimaExecucao; as ultima) {
            Última execução: {{ dataHora(ultima.iniciadaEm) }}.
          }
        </span>
      </p>
    }

    <nav class="pilulas" aria-label="Seções da régua">
      @for (aba of abas; track aba.id) {
        <a
          class="pilula"
          routerLinkActive="pilula--ativa"
          ariaCurrentWhenActive="page"
          [routerLink]="['/financeiro/regua', aba.id]"
          >{{ aba.rotulo }}</a
        >
      }
    </nav>

    @if (resumo.error(); as falha) {
      <app-estado-vazio
        [variante]="erro()!.ehSemPermissao ? 'sem-acesso' : 'erro'"
        [falha]="erro()!"
        [titulo]="
          erro()!.ehSemPermissao
            ? 'Você não tem acesso à régua'
            : 'Não conseguimos carregar a régua'
        "
        [texto]="erro()!.resumo"
        [codigo]="erro()!.requisicaoId"
      >
        <button appBotao type="button" variante="invertido" (click)="resumo.reload()">
          Tentar de novo
        </button>
      </app-estado-vazio>
    } @else if (!resumo.hasValue()) {
      <div class="carregando" aria-busy="true">
        <p class="visualmente-oculto" role="status">Carregando a régua…</p>
        <app-esqueleto altura="6rem" />
        <app-esqueleto altura="10rem" />
      </div>
    } @else {
      @switch (aba()) {
        @case ('ligacoes') {
          <app-regua-ligacoes (alterada)="resumo.reload()" />
        }
        @case ('etapas') {
          <app-regua-etapas [podeGerenciar]="resumo.value().podeGerenciar" />
        }
        @case ('configuracao') {
          <app-regua-config (alterada)="resumo.reload()" />
        }
        @default {
          <app-regua-hoje
            [resumo]="resumo.value()"
            [recarga]="recarga()"
            (alterada)="resumo.reload()"
          />
        }
      }
    }
  `,
  styleUrl: './financeiro-comum.scss',
  styles: `
    .status {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-2) var(--esp-3);
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Regua {
  private readonly api = inject(FinanceiroApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly rota = inject(ActivatedRoute);

  protected readonly abas = ABAS;
  protected readonly icones = {
    pausar: LucidePause,
    retomar: LucidePlay,
    executar: LucideZap,
    tentar: LucideRefreshCw,
  };
  protected readonly dataHora = (v: string | null | undefined) => (v ? formatarDataHora(v) : '');
  protected readonly aba = toSignal(this.rota.paramMap.pipe(map((p) => p.get('aba') ?? 'hoje')), {
    initialValue: 'hoje',
  });

  protected readonly resumo = resource({ loader: () => this.api.resumoRegua() });
  protected readonly erro = computed(() => {
    const falha = this.resumo.error();
    return falha ? erroDaApi(falha) : null;
  });
  protected readonly agindo = signal(false);
  protected readonly executando = signal(false);
  /** Muda a cada execução da régua: a aba "Hoje" busca os envios de novo. */
  protected readonly recarga = signal(0);

  constructor() {
    aoReceber('regua.progresso', () => {
      this.resumo.reload();
      this.recarga.update((n) => n + 1);
    });
  }

  protected async pausarOuRetomar(): Promise<void> {
    const pausada = this.resumo.hasValue() && this.resumo.value().pausada;
    this.agindo.set(true);
    try {
      await this.api.pausarOuRetomar(pausada ? 'retomar' : 'pausar');
      this.avisos.sucesso(
        pausada ? 'Régua retomada.' : 'Régua pausada: nada será enviado até retomar.',
      );
      this.resumo.reload();
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.agindo.set(false);
    }
  }

  protected async executar(): Promise<void> {
    const confirmou = await this.confirmacao.confirmar({
      titulo: 'Executar a régua agora?',
      mensagem:
        'Os clientes que estão em uma etapa da régua hoje recebem as mensagens já. O que já foi enviado hoje não é repetido.',
      confirmar: 'Executar agora',
      cancelar: 'Voltar',
    });
    if (!confirmou) {
      return;
    }
    this.executando.set(true);
    try {
      const r = await this.api.executarRegua();
      const resumo = r.resumo ?? {};
      this.avisos.sucesso(
        `Régua executada: ${resumo['mensagens'] ?? 0} mensagens e ${resumo['ligacoes'] ?? 0} ligações.`,
      );
      this.resumo.reload();
      this.recarga.update((n) => n + 1);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.executando.set(false);
    }
  }
}
