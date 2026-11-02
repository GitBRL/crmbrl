import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  output,
  resource,
  signal,
  untracked,
} from '@angular/core';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { Alternador } from '../../ui/alternador/alternador';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { CampoData } from '../../ui/campo-data/campo-data';
import { CampoTexto, type ValorCampoTexto } from '../../ui/campo-texto/campo-texto';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { DisparosApi } from '../disparos/disparos.api';
import { FinanceiroApi } from './financeiro.api';
import { numeroDoCampo, textoDoErro } from './modais-parcela';

/** Configuração da régua: liga/desliga, horário, tolerância, número de WhatsApp e textos das promessas. */
@Component({
  selector: 'app-regua-config',
  imports: [Alternador, AreaTexto, Botao, CampoData, CampoTexto, Cartao, EstadoVazio, Seletor],
  template: `
    @if (dados.error()) {
      <app-estado-vazio
        variante="erro"
        titulo="Não conseguimos carregar a configuração"
        [texto]="erroCarga()?.resumo ?? null"
      >
        <button appBotao type="button" variante="invertido" (click)="dados.reload()">
          Tentar de novo
        </button>
      </app-estado-vazio>
    } @else if (!dados.hasValue()) {
      <app-estado-vazio titulo="Carregando a configuração…" compacto />
    } @else {
      <app-cartao titulo="Como a régua funciona">
        <form class="formulario" (submit)="$event.preventDefault(); salvar()">
          @if (!podeEditar()) {
            <p class="nota">Só Admin, C-level e Líder de CS alteram a configuração.</p>
          }
          <app-alternador
            rotulo="Régua ligada"
            [valor]="ativa()"
            (valorChange)="ativa.set($event)"
          />
          <div class="grade-campos">
            <app-campo-data
              rotulo="Horário da execução diária"
              tipo="hora"
              ajuda="A régua roda todo dia neste horário (Brasília)."
              [valor]="horario()"
              (valorChange)="horario.set($event)"
            />
            <app-campo-texto
              rotulo="Tolerância em dias"
              tipo="number"
              [minimo]="0"
              [maximo]="30"
              [passo]="1"
              ajuda="Etapas que já passaram há mais dias que isso não são enviadas a quem acabou de entrar em atraso."
              [valor]="tolerancia()"
              (valorChange)="tolerancia.set($event)"
            />
            <app-seletor
              rotulo="Número de WhatsApp da cobrança"
              placeholder="Qualquer número conectado"
              permitirVazio
              ajuda="Se tiver um número só do financeiro, escolha aqui."
              [opcoes]="opcoesCanais()"
              [valor]="canalId()"
              (valorChange)="canalId.set($event)"
            />
            <app-campo-texto
              rotulo="Intervalo entre mensagens"
              tipo="number"
              sufixo="s"
              [minimo]="5"
              [passo]="1"
              ajuda="Espera entre um WhatsApp e outro, para o número não ser bloqueado."
              [valor]="intervalo()"
              (valorChange)="intervalo.set($event)"
            />
            <app-campo-data
              rotulo="Limite para ligações do dia"
              tipo="hora"
              ajuda="Depois deste horário, as ligações ficam para o dia seguinte."
              [valor]="limite()"
              (valorChange)="limite.set($event)"
            />
          </div>
          <app-area-texto
            rotulo="Mensagem quando o cliente promete pagar"
            [linhas]="3"
            [maximoCaracteres]="1500"
            [somenteLeitura]="!podeEditar()"
            [valor]="textoConfirmada()"
            (valorChange)="textoConfirmada.set($event)"
          />
          <app-area-texto
            rotulo="Mensagem quando a promessa não é cumprida"
            [linhas]="3"
            [maximoCaracteres]="1500"
            [somenteLeitura]="!podeEditar()"
            [valor]="textoNaoCumprida()"
            (valorChange)="textoNaoCumprida.set($event)"
          />
          @if (erroForm(); as mensagem) {
            <p class="erro-inline" role="alert">{{ mensagem }}</p>
          }
          @if (podeEditar()) {
            <div class="cabecalho__acoes">
              <button appBotao type="submit" variante="marca" [carregando]="salvando()">
                Salvar configuração
              </button>
            </div>
          }
        </form>
      </app-cartao>
    }
  `,
  styleUrl: './financeiro-comum.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReguaConfig {
  private readonly api = inject(FinanceiroApi);
  private readonly disparos = inject(DisparosApi);
  private readonly avisos = inject(AvisosService);

  readonly alterada = output<void>();

  protected readonly dados = resource({ loader: () => this.api.configuracaoRegua() });
  private readonly canais = resource({ loader: () => this.disparos.canais().catch(() => []) });
  protected readonly opcoesCanais = computed<readonly OpcaoSeletor<string>[]>(() =>
    (this.canais.hasValue() ? this.canais.value() : [])
      .filter((c) => c.tipo.toUpperCase().includes('WHATSAPP'))
      .map((c) => ({ valor: c.id, rotulo: c.disponivel ? c.nome : `${c.nome} (desconectado)` })),
  );
  protected readonly erroCarga = computed(() => {
    const falha = this.dados.error();
    return falha ? erroDaApi(falha) : null;
  });
  protected readonly podeEditar = computed(() =>
    this.dados.hasValue() ? this.dados.value().podeEditar : false,
  );

  protected readonly ativa = signal(true);
  protected readonly horario = signal<string | null>('09:00');
  protected readonly tolerancia = signal<ValorCampoTexto>(3);
  protected readonly canalId = signal<string | null>(null);
  protected readonly intervalo = signal<ValorCampoTexto>(20);
  protected readonly limite = signal<string | null>('17:00');
  protected readonly textoConfirmada = signal('');
  protected readonly textoNaoCumprida = signal('');
  protected readonly salvando = signal(false);
  protected readonly erroForm = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.dados.hasValue()) {
        return;
      }
      const c = this.dados.value();
      untracked(() => {
        this.ativa.set(c.ativa);
        this.horario.set(c.horario);
        this.tolerancia.set(c.toleranciaDias);
        this.canalId.set(c.canalWhatsappId);
        this.intervalo.set(c.intervaloWhatsappSegundos);
        this.limite.set(c.horarioLimiteLigacoes);
        this.textoConfirmada.set(c.textoPromessaConfirmada ?? '');
        this.textoNaoCumprida.set(c.textoPromessaNaoCumprida ?? '');
      });
    });
  }

  protected async salvar(): Promise<void> {
    if (!this.podeEditar() || this.salvando()) {
      return;
    }
    const tolerancia = numeroDoCampo(this.tolerancia());
    const intervalo = numeroDoCampo(this.intervalo());
    if (!this.horario() || !this.limite() || tolerancia === null || intervalo === null) {
      this.erroForm.set('Preencha os horários, a tolerância e o intervalo.');
      return;
    }
    this.salvando.set(true);
    this.erroForm.set(null);
    try {
      await this.api.alterarConfiguracaoRegua({
        ativa: this.ativa(),
        horario: this.horario(),
        toleranciaDias: Math.trunc(tolerancia),
        canalWhatsappId: this.canalId(),
        intervaloWhatsappSegundos: Math.trunc(intervalo),
        horarioLimiteLigacoes: this.limite(),
        textoPromessaConfirmada: this.textoConfirmada().trim() || null,
        textoPromessaNaoCumprida: this.textoNaoCumprida().trim() || null,
      });
      this.avisos.sucesso('Configuração salva.');
      this.dados.reload();
      this.alterada.emit();
    } catch (falha) {
      this.erroForm.set(textoDoErro(falha));
    } finally {
      this.salvando.set(false);
    }
  }
}
