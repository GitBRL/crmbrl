import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import {
  LucideCheck,
  LucideInfo,
  LucideLoaderCircle,
  LucideRefreshCw,
  LucideX,
} from '@lucide/angular';

import { formatarTempoRelativo } from '../../nucleo/formatos';
import { SaudeService } from '../../nucleo/saude.service';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { Selo } from '../../ui/selo/selo';
import { RELOGIO } from './relogio';

/** 42 → "menos de 1 min"; 3720 → "1 h 2 min"; 200000 → "2 d 7 h". */
export function formatarDuracao(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  if (total < 60) {
    return 'menos de 1 min';
  }
  const minutos = Math.floor(total / 60);
  if (minutos < 60) {
    return `${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    return minutos % 60 ? `${horas} h ${minutos % 60} min` : `${horas} h`;
  }
  const dias = Math.floor(horas / 24);
  return horas % 24 ? `${dias} d ${horas % 24} h` : `${dias} d`;
}

/** Ambiente da API em português ("production" → "produção"); outros nomes ficam como vêm. */
export function traduzirAmbiente(ambiente: string): string {
  switch (ambiente) {
    case 'production':
      return 'produção';
    case 'development':
      return 'desenvolvimento';
    case 'test':
      return 'teste';
    default:
      return ambiente;
  }
}

/** Latência do banco: "3 ms"; abaixo de 1 ms (arredondada para 0), "< 1 ms". */
export function formatarLatencia(ms: number): string {
  return ms < 1 ? '< 1 ms' : `${Math.round(ms)} ms`;
}

/**
 * "Status do sistema": o único bloco com dados reais. Lê `GET /api/saude` pelo SaudeService
 * e mostra o servidor (versão e ambiente), o banco (latência), as atualizações do banco
 * (migrations) e há quanto tempo o servidor está no ar. Fala com quem usa o CRM: sem
 * conexão, diz o que fazer; a explicação técnica (rodar a API ao lado do `ng serve`) só
 * aparece em desenvolvimento. O resto do painel continua com os dados de exemplo.
 */
@Component({
  selector: 'app-inicio-status',
  imports: [Botao, Cartao, LucideLoaderCircle, LucideX, Selo],
  template: `
    <app-cartao
      titulo="Status do sistema"
      regiao
      dica="Mostra, ao vivo, se o servidor do CRM e o banco de dados estão respondendo. Se algo ficar vermelho, avise o administrador."
    >
      <!-- Com o servidor respondendo, "ao vivo" com o ponto menta pulsando; sem, "sem conexão". -->
      <app-selo
        cartao-acoes
        variante="contorno"
        [class.status__ao-vivo]="conectado()"
        [ponto]="conectado()"
      >
        {{ conectado() ? 'ao vivo' : 'sem conexão' }}
      </app-selo>
      <p class="visualmente-oculto" aria-live="polite">{{ resumo() }}</p>

      @switch (saude.situacao()) {
        @case ('carregando') {
          <p class="status__consultando">
            <svg lucideLoaderCircle class="status__giro" [size]="18" />
            Verificando o sistema…
          </p>
        }
        @case ('indisponivel') {
          <div class="status__erro">
            <p class="status__erro-titulo">
              <span class="status__erro-icone" aria-hidden="true">
                <svg lucideX [size]="16" />
              </span>
              Sem conexão com o servidor
            </p>
            <p>
              Não conseguimos verificar o CRM agora. Os números desta tela são de exemplo e
              continuam aparecendo. Tente de novo em instantes; se continuar, avise o administrador.
            </p>
            @if (desenvolvimento) {
              <p class="status__dev">
                {{ saude.erro() }} Rodando só o front com o
                <code class="status__codigo">ng serve</code>? Suba a API (<code
                  class="status__codigo"
                  >crmbrl-api</code
                >, porta 3000) ou o Docker Compose completo.
              </p>
            }
          </div>
        }
        @default {
          @if (saude.dados(); as dados) {
            <dl class="status__lista">
              <div class="status__linha">
                <dt>API</dt>
                <dd>
                  @if (dados.status === 'ok') {
                    <app-selo variante="menta" [icone]="icones.ok">No ar</app-selo>
                  } @else {
                    <app-selo variante="lima" [icone]="icones.alerta">No ar, com falhas</app-selo>
                  }
                  <span class="status__extra"
                    >v{{ dados.versao }} · {{ ambiente(dados.ambiente) }}</span
                  >
                </dd>
              </div>
              <div class="status__linha">
                <dt>Banco de dados</dt>
                <dd>
                  @if (dados.banco.status === 'ok') {
                    <app-selo variante="menta" [icone]="icones.ok">Conectado</app-selo>
                    @if (dados.banco.latenciaMs !== undefined) {
                      <span class="status__extra">{{ latencia(dados.banco.latenciaMs) }}</span>
                    }
                  } @else {
                    <app-selo variante="coral" [icone]="icones.erro">Com erro</app-selo>
                    <span class="status__extra">{{
                      dados.banco.erro ?? 'O banco não respondeu.'
                    }}</span>
                  }
                </dd>
              </div>
              <div class="status__linha">
                <dt>Atualizações do banco</dt>
                <dd>
                  @if (dados.migrations; as migrations) {
                    <span>
                      {{ migrations.aplicadas }}
                      {{ migrations.aplicadas === 1 ? 'aplicada' : 'aplicadas' }}
                    </span>
                    @if (migrations.ultima) {
                      <code class="status__codigo" title="Última atualização aplicada">{{
                        migrations.ultima
                      }}</code>
                    }
                  } @else {
                    <span class="status__extra">Sem leitura enquanto o banco não responde</span>
                  }
                </dd>
              </div>
              <div class="status__linha">
                <dt>No ar há</dt>
                <dd>{{ noAr() }}</dd>
              </div>
            </dl>
          }
        }
      }

      <div class="status__rodape">
        <span class="status__atualizado">{{ atualizado() }}</span>
        <button
          appBotao
          type="button"
          tamanho="sm"
          variante="contorno"
          [icone]="icones.atualizar"
          [carregando]="saude.carregando()"
          (click)="recarregar()"
        >
          {{ saude.situacao() === 'indisponivel' ? 'Tentar de novo' : 'Atualizar' }}
        </button>
      </div>
    </app-cartao>
  `,
  styleUrl: './status-sistema.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusSistema {
  protected readonly saude = inject(SaudeService);
  private readonly agora = inject(RELOGIO);
  /** O resumo para leitores de tela só é anunciado depois que a pessoa pede para atualizar. */
  private readonly anunciar = signal(false);
  /** Ajuda técnica (subir a API ao lado do `ng serve`) só para quem desenvolve. */
  protected readonly desenvolvimento = isDevMode();
  protected readonly ambiente = traduzirAmbiente;
  protected readonly latencia = formatarLatencia;

  protected readonly icones = {
    ok: LucideCheck,
    erro: LucideX,
    alerta: LucideInfo,
    atualizar: LucideRefreshCw,
  };

  /** O servidor respondeu (ou ainda está sendo consultado pela primeira vez). */
  protected readonly conectado = computed(() => this.saude.situacao() !== 'indisponivel');

  /** Há quanto tempo a API está no ar, contando o tempo desde a última consulta. */
  protected readonly noAr = computed(() => {
    const dados = this.saude.dados();
    const consulta = this.saude.atualizadoEm();
    if (!dados) {
      return '';
    }
    const desde = consulta ? Math.max(0, this.agora().getTime() - consulta.getTime()) / 1000 : 0;
    return formatarDuracao(dados.uptimeSegundos + desde);
  });

  protected readonly atualizado = computed(() => {
    const consulta = this.saude.atualizadoEm();
    if (this.saude.carregando()) {
      return consulta ? 'Atualizando…' : 'Verificando…';
    }
    if (!consulta) {
      return '';
    }
    const quando = formatarTempoRelativo(consulta, this.agora());
    return this.saude.situacao() === 'indisponivel'
      ? `Última tentativa ${quando}`
      : `Atualizado ${quando}`;
  });

  protected readonly resumo = computed(() => {
    if (!this.anunciar()) {
      return '';
    }
    if (this.saude.carregando()) {
      return 'Verificando o status do sistema.';
    }
    switch (this.saude.situacao()) {
      case 'indisponivel':
        return 'Status do sistema: sem conexão com o servidor.';
      case 'degradado':
        return 'Status do sistema: o servidor está no ar, mas o banco de dados está com erro.';
      default:
        return 'Status do sistema: servidor no ar e banco de dados conectado.';
    }
  });

  protected recarregar(): void {
    this.anunciar.set(true);
    this.saude.recarregar();
  }
}
