import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Dica } from '../../ui/dica/dica';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { EstadoAtendimento, type AlvoFoco } from './estado-atendimento';
import { ListaConversas } from './lista-conversas';

/** Atalhos da página (Alt + tecla, pelo `code`: funciona igual em qualquer layout de teclado). */
const ATALHOS_FOCO: Readonly<Record<string, AlvoFoco>> = {
  KeyL: 'lista',
  KeyB: 'busca',
  KeyM: 'compositor',
  KeyC: 'contato',
};

export const TEXTO_ATALHOS =
  'Alt+↓ e Alt+↑: próxima e anterior conversa da lista. Alt+L: vai para a lista (lá dentro, as setas andam e Enter abre). Alt+B: busca. Alt+M: escrever a mensagem. Alt+C: dados do contato. No campo de mensagem, Enter envia, Shift+Enter quebra a linha e "/" abre as respostas rápidas.';

/**
 * Atendimento (`/atendimento`, contrato da Onda A §7): a caixa de entrada omnichannel. No
 * desktop, três colunas — a lista de conversas (`app-lista-conversas`), a conversa aberta
 * (rota filha `:conversaId`, `Conversa`) e o painel do contato (dentro da conversa); no
 * celular, uma coluna por vez. O estado da lista e do tempo real fica em `EstadoAtendimento`,
 * fornecido aqui para a lista e para a conversa. Teclado: Alt+↓/↑ trocam de conversa e Alt+L,
 * B, M e C levam o foco à lista, à busca, ao campo de mensagem e aos dados do contato.
 */
@Component({
  selector: 'app-atendimento',
  imports: [Dica, EstadoVazio, ListaConversas, RouterOutlet],
  providers: [EstadoAtendimento],
  templateUrl: './atendimento.html',
  styleUrl: './atendimento.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.atendimento--aberta]': 'aberta()',
    '(document:keydown)': 'aoTeclar($event)',
  },
})
export class Atendimento {
  protected readonly estado = inject(EstadoAtendimento);
  private readonly router = inject(Router);
  private readonly sessao = inject(SessaoService);

  /** Há uma conversa aberta na rota filha (`/atendimento/:conversaId`). */
  protected readonly aberta = signal(false);
  protected readonly textoAtalhos = TEXTO_ATALHOS;

  /** Como as conversas chegam e quem vê o quê (R12), pela posição de quem entrou. */
  protected readonly dicaFilas = computed(() => {
    const chegada =
      'Cada canal entrega as conversas novas numa fila (Comercial ou Customer Success). A fila escolhe quem atende: em rodízio, por quem tem menos conversas ou deixando sem responsável até alguém assumir. ';
    if (this.sessao.ehDiretoria()) {
      return `${chegada}Você vê todas as conversas de todos os canais.`;
    }
    if (this.sessao.ehLider()) {
      return `${chegada}Você vê as conversas das filas da sua área (de toda a equipe) e as suas.`;
    }
    return `${chegada}Você vê as conversas que estão com você e as sem responsável das filas da sua área, que qualquer pessoa da área pode assumir.`;
  });

  /** "Atendimento · 7 em aberto" (o complemento só depois de carregar a lista). */
  protected readonly titulo = computed(() => {
    const contadores = this.estado.contadores();
    if (!contadores || this.estado.semAcesso()) {
      return { principal: 'Atendimento', ponto: '', complemento: '' };
    }
    const quantas = contadores.todas === 1 ? '1 em aberto' : `${contadores.todas} em aberto`;
    return { principal: 'Atendimento', ponto: '\u00a0· ', complemento: quantas };
  });

  protected aoAtivar(): void {
    this.aberta.set(true);
  }

  protected aoDesativar(): void {
    this.aberta.set(false);
    this.estado.selecionadaId.set(null);
  }

  protected aoTeclar(evento: KeyboardEvent): void {
    if (!evento.altKey || evento.ctrlKey || evento.metaKey || evento.defaultPrevented) {
      return;
    }
    // Dentro de um diálogo (modal, painel) os atalhos da página não valem.
    if ((evento.target as Element | null)?.closest?.('dialog')) {
      return;
    }
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      const vizinha = this.estado.vizinha(evento.key === 'ArrowDown' ? 1 : -1);
      evento.preventDefault();
      if (vizinha) {
        void this.router.navigate(['/atendimento', vizinha.id]);
      }
      return;
    }
    const alvo = ATALHOS_FOCO[evento.code];
    if (!alvo || evento.shiftKey) {
      return;
    }
    if ((alvo === 'compositor' || alvo === 'contato') && !this.aberta()) {
      return;
    }
    evento.preventDefault();
    this.estado.pedirFoco(alvo);
  }
}
