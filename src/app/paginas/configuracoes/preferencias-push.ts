import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { InstalacaoService } from '../../nucleo/pwa/instalacao.service';
import { type PreferenciasPush, TIPOS_PUSH, type TipoPush } from '../../nucleo/pwa/push.api';
import { PushService } from '../../nucleo/pwa/push.service';
import { Botao } from '../../ui/botao/botao';
import { CaixaSelecao } from '../../ui/caixa-selecao/caixa-selecao';
import { Cartao } from '../../ui/cartao/cartao';

/** Texto de cada tipo de aviso por push. */
export const ROTULO_TIPO_PUSH: Readonly<Record<TipoPush, { rotulo: string; dica: string }>> = {
  conversa_atribuida: {
    rotulo: 'Conversa atribuída a mim',
    dica: 'Um cliente espera a sua resposta.',
  },
  mencao: { rotulo: 'Menção no chat da equipe', dica: 'Alguém citou você numa conversa.' },
  atividade_vencendo: { rotulo: 'Atividade vencendo', dica: 'Aviso antes do prazo.' },
  sla_estourado: { rotulo: 'SLA estourado', dica: 'Uma conversa passou do tempo de resposta.' },
  negocio_atribuido: { rotulo: 'Negócio atribuído a mim', dica: 'Um negócio novo é seu.' },
  parcela_atrasada: {
    rotulo: 'Parcela atrasada da carteira',
    dica: 'Um cliente seu está em atraso.',
  },
  ligacao_recebida: {
    rotulo: 'Ligação recebida',
    dica: 'Um cliente está ligando, ou uma ligação ficou perdida. Vale também com o CRM em segundo plano.',
  },
};

/**
 * Cartão "No celular" do Meu perfil: instalar o CRM como aplicativo (com a dica de Android e
 * iOS) e as notificações push deste aparelho. A permissão do navegador só é pedida quando a
 * pessoa clica em "Ativar avisos neste aparelho" — nunca ao abrir o app.
 */
@Component({
  selector: 'app-preferencias-push',
  imports: [Botao, CaixaSelecao, Cartao],
  templateUrl: './preferencias-push.html',
  styleUrl: './preferencias-push.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartaoPush {
  protected readonly push = inject(PushService);
  protected readonly instalacao = inject(InstalacaoService);
  private readonly avisos = inject(AvisosService);

  protected readonly tipos = TIPOS_PUSH;
  protected readonly textos = ROTULO_TIPO_PUSH;
  protected readonly erro = signal<string | null>(null);
  protected readonly testando = signal(false);
  protected readonly salvando = signal<TipoPush | null>(null);
  protected readonly ativo = computed(() => this.push.situacao() === 'ativo');

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    this.erro.set(null);
    try {
      await this.push.carregar();
    } catch (falha) {
      this.erro.set(erroDaApi(falha).mensagem);
    }
  }

  protected async ativar(): Promise<void> {
    this.erro.set(null);
    try {
      await this.push.ativar();
      this.avisos.sucesso('Avisos ativados neste aparelho.');
    } catch (falha) {
      if (this.push.situacao() === 'bloqueado') {
        this.erro.set(null);
      } else if (this.push.situacao() !== 'nao-configurado') {
        this.erro.set(erroDaApi(falha).mensagem);
      }
    }
  }

  protected async desativar(): Promise<void> {
    try {
      await this.push.desativar();
      this.avisos.sucesso('Avisos desativados neste aparelho.');
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  protected async alternar(tipo: TipoPush, ligado: boolean): Promise<void> {
    const atual = this.push.preferencias();
    if (!atual || atual[tipo] === ligado) {
      return;
    }
    const novas: PreferenciasPush = { ...atual, [tipo]: ligado };
    this.salvando.set(tipo);
    try {
      await this.push.salvarPreferencias(novas);
    } catch (falha) {
      this.avisos.erro(falha);
      await this.carregar();
    } finally {
      this.salvando.set(null);
    }
  }

  protected async testar(): Promise<void> {
    this.testando.set(true);
    try {
      await this.push.testar();
      this.avisos.info('Teste enviado. A notificação chega em instantes.');
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.testando.set(false);
    }
  }

  protected async instalar(): Promise<void> {
    await this.instalacao.instalar();
  }
}
