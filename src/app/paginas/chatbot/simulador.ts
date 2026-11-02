import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { LucideMessageSquare, LucideRotateCcw, LucideSend } from '@lucide/angular';

import { AvisosService } from '../../nucleo/avisos.service';
import { erroDaApi } from '../../nucleo/api/erro-api';
import { Alternador } from '../../ui/alternador/alternador';
import { Botao } from '../../ui/botao/botao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { Selo } from '../../ui/selo/selo';
import { ChatbotApi } from './chatbot.api';
import { type EstadoSimulacao, ROTULO_MOTIVO_FIM } from './chatbot.tipos';

const CANAIS: readonly OpcaoSeletor<string>[] = [
  { valor: 'WHATSAPP', rotulo: 'WhatsApp' },
  { valor: 'WEBCHAT', rotulo: 'Chat do site' },
  { valor: 'EMAIL', rotulo: 'E-mail' },
];

/**
 * Conversa de teste do editor: roda o rascunho (ou a versão publicada) sem tocar em contatos,
 * conversas nem negócios de verdade. As esperas por tempo viram o botão “Deixar o tempo passar”.
 */
@Component({
  selector: 'app-simulador-fluxo',
  imports: [Alternador, Botao, CampoTexto, Selo, Seletor],
  templateUrl: './simulador.html',
  styleUrl: './simulador.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimuladorFluxo {
  private readonly api = inject(ChatbotApi);
  private readonly avisos = inject(AvisosService);

  readonly fluxoId = input.required<string>();
  readonly temPublicada = input(false);
  /** Salva o rascunho antes de simular; devolve `false` se não deu (a simulação não começa). */
  readonly garantirSalvo = input<() => Promise<boolean>>(async () => true);

  protected readonly iconeEnviar = LucideSend;
  protected readonly iconeReiniciar = LucideRotateCcw;
  protected readonly iconeConversa = LucideMessageSquare;
  protected readonly canais = CANAIS;
  protected readonly origens = computed<readonly OpcaoSeletor<string>[]>(() => [
    { valor: 'rascunho', rotulo: 'Rascunho (o que você está editando)' },
    { valor: 'publicada', rotulo: 'Versão publicada', desabilitada: !this.temPublicada() },
  ]);

  protected readonly origem = signal<'rascunho' | 'publicada'>('rascunho');
  protected readonly canalTipo = signal('WHATSAPP');
  protected readonly nome = signal('Maria Teste');
  protected readonly primeiraMensagem = signal('Olá');
  protected readonly horarioAberto = signal(true);
  protected readonly resposta = signal('');

  protected readonly estado = signal<EstadoSimulacao | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly falha = signal<string | null>(null);

  private readonly fim = viewChild<ElementRef<HTMLElement>>('fimDaConversa');

  protected readonly terminou = computed(() => {
    const status = this.estado()?.status;
    return status === 'CONCLUIDA' || status === 'FALHOU' || status === 'CANCELADA';
  });
  protected readonly motivo = computed(() => {
    const motivo = this.estado()?.motivoFim;
    return motivo ? (ROTULO_MOTIVO_FIM[motivo] ?? motivo) : null;
  });
  protected readonly variaveis = computed(() =>
    Object.entries(this.estado()?.variaveis ?? {}).map(([chave, valor]) => ({
      chave,
      valor: typeof valor === 'string' ? valor : JSON.stringify(valor),
    })),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      const e = this.estado();
      if (e && !this.terminou()) {
        void this.api.encerrarSimulacao(this.fluxoId(), e.execucaoId).catch(() => undefined);
      }
    });
    effect(() => {
      this.estado();
      const fim = this.fim()?.nativeElement;
      // Depois de pintar, leva a conversa até a última mensagem.
      queueMicrotask(() => fim?.scrollIntoView?.({ block: 'nearest' }));
    });
  }

  protected async iniciar(): Promise<void> {
    this.ocupado.set(true);
    this.falha.set(null);
    try {
      if (!(await this.garantirSalvo()())) {
        return;
      }
      const anterior = this.estado();
      if (anterior && !this.terminou()) {
        await this.api
          .encerrarSimulacao(this.fluxoId(), anterior.execucaoId)
          .catch(() => undefined);
      }
      const estado = await this.api.iniciarSimulacao(this.fluxoId(), {
        origem: this.origem(),
        canalTipo: this.canalTipo(),
        contato: { nome: this.nome().trim() || 'Contato de teste' },
        ...(this.primeiraMensagem().trim() ? { mensagem: this.primeiraMensagem().trim() } : {}),
        horarioAberto: this.horarioAberto(),
      });
      this.estado.set(estado);
    } catch (falha) {
      const erro = erroDaApi(falha);
      const problemas = erro.detalhes?.['problemas'];
      const lista = Array.isArray(problemas)
        ? problemas.map((p: { mensagem?: string }) => p.mensagem).filter(Boolean)
        : [];
      this.falha.set(lista.length ? `${erro.resumo} ${lista.slice(0, 3).join(' ')}` : erro.resumo);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async enviar(texto: string): Promise<void> {
    const e = this.estado();
    const limpo = texto.trim();
    if (!e || !limpo || this.ocupado()) {
      return;
    }
    this.ocupado.set(true);
    try {
      this.estado.set(await this.api.responderSimulacao(this.fluxoId(), e.execucaoId, limpo));
      this.resposta.set('');
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async deixarPassar(): Promise<void> {
    const e = this.estado();
    if (!e || this.ocupado()) {
      return;
    }
    this.ocupado.set(true);
    try {
      this.estado.set(await this.api.silencioNaSimulacao(this.fluxoId(), e.execucaoId));
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.ocupado.set(false);
    }
  }

  protected recomecar(): void {
    const e = this.estado();
    if (e && !this.terminou()) {
      void this.api.encerrarSimulacao(this.fluxoId(), e.execucaoId).catch(() => undefined);
    }
    this.estado.set(null);
  }
}
