import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';

import { ehAtalho, rotuloDoAtalho, sistemaDeAtalhos } from '../../nucleo/atalhos/atalhos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { AbasAtendimento } from './abas-atendimento';
import { Dica } from '../../ui/dica/dica';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { EstadoAtendimento, type AlvoFoco } from './estado-atendimento';
import { ListaConversas } from './lista-conversas';

/**
 * Atalhos da página, pelo `code` (funcionam igual em qualquer layout de teclado). O modificador
 * é Alt no Windows e no Linux e Control+Shift no Mac (`nucleo/atalhos`).
 */
const ATALHOS_FOCO: Readonly<Record<string, AlvoFoco>> = {
  L: 'lista',
  B: 'busca',
  M: 'compositor',
  C: 'contato',
};

/** Texto da dica de atalhos, com o atalho certo para o sistema de quem usa. */
export function textoDosAtalhos(sistema = sistemaDeAtalhos()): string {
  const r = (tecla: string) => rotuloDoAtalho(tecla, sistema);
  return `${r('ArrowDown')} e ${r('ArrowUp')}: próxima e anterior conversa da lista. ${r('L')}: vai para a lista (lá dentro, as setas andam e Enter abre). ${r('B')}: busca. ${r('M')}: escrever a mensagem. ${r('C')}: dados do contato. Durante uma ligação, ${r('S')} silencia o microfone e ${r('E')} encerra. No campo de mensagem, Enter envia, Shift+Enter quebra a linha e "/" abre as respostas rápidas.`;
}

export const TEXTO_ATALHOS = textoDosAtalhos('outro');

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
  imports: [AbasAtendimento, Dica, EstadoVazio, ListaConversas, RouterOutlet],
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
  private readonly rota = inject(ActivatedRoute);
  private readonly sessao = inject(SessaoService);

  /** Há uma conversa aberta na rota filha (`/atendimento/:conversaId`). */
  protected readonly aberta = signal(false);
  protected readonly textoAtalhos = textoDosAtalhos();

  /** Como as conversas chegam e quem vê o quê (R12), pela posição de quem entrou. */
  protected readonly dicaFilas = computed(() => {
    const chegada =
      'Cada canal entrega as conversas novas numa fila (Comercial ou Customer Success). A fila escolhe quem atende: em rodízio, por quem tem menos conversas ou deixando sem responsável até alguém assumir. ';
    if (this.sessao.ehDiretoria()) {
      return `${chegada}Você vê todas as conversas de todos os canais.`;
    }
    if (this.sessao.ehLider()) {
      return `${chegada}Você vê as conversas das filas do seu setor (de toda a equipe) e as suas.`;
    }
    return `${chegada}Você vê as conversas que estão com você e as sem responsável das filas do seu setor, que qualquer pessoa do setor pode assumir.`;
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

  constructor() {
    // Links com filtro (`?canalId=` e `?filaId=`, os cliques do BI): aplica e limpa o endereço.
    this.rota.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const canalId = params.get('canalId');
      const filaId = params.get('filaId');
      if (!canalId && !filaId) {
        return;
      }
      this.estado.aplicarDoLink({ canalId, filaId });
      void this.router.navigate([], {
        queryParams: { canalId: null, filaId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  protected aoAtivar(): void {
    this.aberta.set(true);
  }

  protected aoDesativar(): void {
    this.aberta.set(false);
    this.estado.selecionadaId.set(null);
  }

  protected aoTeclar(evento: KeyboardEvent): void {
    if (evento.defaultPrevented) {
      return;
    }
    // Dentro de um diálogo (modal, painel) os atalhos da página não valem.
    if ((evento.target as Element | null)?.closest?.('dialog')) {
      return;
    }
    for (const seta of ['ArrowDown', 'ArrowUp']) {
      if (ehAtalho(evento, seta)) {
        const vizinha = this.estado.vizinha(seta === 'ArrowDown' ? 1 : -1);
        evento.preventDefault();
        if (vizinha) {
          void this.router.navigate(['/atendimento', vizinha.id]);
        }
        return;
      }
    }
    const tecla = Object.keys(ATALHOS_FOCO).find((letra) => ehAtalho(evento, letra));
    if (!tecla) {
      return;
    }
    const alvo = ATALHOS_FOCO[tecla];
    if ((alvo === 'compositor' || alvo === 'contato') && !this.aberta()) {
      return;
    }
    evento.preventDefault();
    this.estado.pedirFoco(alvo);
  }
}
