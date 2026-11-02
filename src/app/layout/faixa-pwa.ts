import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideDynamicIcon, LucideRefreshCw, LucideWifiOff } from '@lucide/angular';

import { AtualizacaoService } from '../nucleo/pwa/atualizacao.service';
import { RedeService } from '../nucleo/pwa/rede.service';

/**
 * Avisos do aplicativo instalável, num canto da tela (acima da navegação inferior no celular):
 * - "Sem conexão": o app abre pelo cache do service worker, mas os dados vêm sempre da rede;
 * - "Nova versão": há uma versão baixada, que entra com o botão "Atualizar" (sem recarregar
 *   no meio de uma tarefa).
 * As regiões vivas (`role="status"`) existem sempre, para o leitor de tela anunciar as trocas.
 */
@Component({
  selector: 'app-faixa-pwa',
  imports: [LucideDynamicIcon],
  template: `
    <div class="faixa" [class.faixa--visivel]="!rede.online() || atualizacao.disponivel()">
      <p class="faixa__aviso faixa__aviso--offline" role="status" [hidden]="rede.online()">
        <svg [lucideIcon]="icones.semRede" [size]="18" aria-hidden="true" />
        <span>
          <strong>Sem conexão.</strong>
          O CRM abre, mas os dados só carregam quando a internet voltar.
        </span>
      </p>
      <p
        class="faixa__aviso faixa__aviso--versao"
        role="status"
        [hidden]="!atualizacao.disponivel()"
      >
        <svg [lucideIcon]="icones.atualizar" [size]="18" aria-hidden="true" />
        <span><strong>Nova versão do CRM.</strong> Atualize para usar as novidades.</span>
        <button
          type="button"
          class="faixa__botao"
          [disabled]="atualizacao.atualizando()"
          (click)="atualizacao.atualizar()"
        >
          {{ atualizacao.atualizando() ? 'Atualizando…' : 'Atualizar' }}
        </button>
      </p>
    </div>
  `,
  styleUrl: './faixa-pwa.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaixaPwa {
  protected readonly rede = inject(RedeService);
  protected readonly atualizacao = inject(AtualizacaoService);
  protected readonly icones = { semRede: LucideWifiOff, atualizar: LucideRefreshCw };
}
