import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideDynamicIcon,
  LucideHandshake,
  LucideHeartHandshake,
  LucideShieldCheck,
  LucideSparkles,
  LucideUserMinus,
  LucideWebhook,
  LucideWorkflow,
  type LucideIcon,
} from '@lucide/angular';

import { formatarTempoRelativo } from '../../nucleo/formatos';
import { PerfilDemoService } from '../../nucleo/perfil-demo.service';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { Selo } from '../../ui/selo/selo';
import type { CorDado } from '../../ui/tipos';
import { ATIVIDADES_RECENTES, type TipoEvento } from './dados-exemplo';
import { RELOGIO } from './relogio';

/**
 * Ícone e cor de cada tipo de evento, quando quem agiu foi o sistema (com uma pessoa, vai o
 * avatar dela). Os ícones repetem os dos módulos da navegação; o desligamento usa o de
 * "pessoa saindo" (o envio de Disparos significaria outra coisa).
 */
const VISUAL: Readonly<Record<TipoEvento, { icone: LucideIcon; cor: CorDado | null }>> = {
  webhook: { icone: LucideWebhook, cor: 'ciano' },
  movimento: { icone: LucideHandshake, cor: null },
  passagem: { icone: LucideWorkflow, cor: 'menta' },
  ganho: { icone: LucideHeartHandshake, cor: 'menta' },
  desligamento: { icone: LucideUserMinus, cor: 'coral' },
  ia: { icone: LucideSparkles, cor: 'lima' },
};

const DICA_ADMIN =
  'Tudo o que acontece no CRM fica na auditoria: quem fez, o quê e quando, inclusive o que o sistema faz sozinho. Estes eventos são exemplos.';
const DICA_AREA = 'Atividades recentes da sua área. Estes eventos são exemplos.';

/**
 * "Atividades recentes": linha do tempo de eventos de auditoria (fictícios) que mostram as
 * regras do produto — lead por webhook, passagens automáticas entre funis, desligamento com
 * encaminhamento ao líder e chamado aberto pela IA. Cada persona vê só os eventos do papel
 * dela. Os tempos relativos envelhecem com a página aberta (relógio do painel). Quem acessa a
 * Administração ganha, no rodapé, o atalho para a auditoria (módulo ainda em breve).
 */
@Component({
  selector: 'app-inicio-atividades',
  imports: [Avatar, Botao, Cartao, LucideDynamicIcon, RouterLink, Selo],
  template: `
    <app-cartao titulo="Atividades recentes" regiao [dica]="dica()">
      <ol class="linha-tempo" role="list">
        @for (evento of eventos(); track evento.id) {
          <li class="evento">
            @if (evento.ator; as ator) {
              <app-avatar class="evento__marca" [nome]="ator" tamanho="sm" decorativo />
            } @else {
              <span
                class="evento__marca evento__icone"
                [attr.data-cor]="evento.cor"
                aria-hidden="true"
              >
                <svg [lucideIcon]="evento.icone" [size]="16" />
              </span>
            }
            <div class="evento__corpo">
              <p class="evento__titulo">{{ evento.titulo }}</p>
              <p class="evento__detalhe">{{ evento.detalhe }}</p>
              <time class="evento__quando" [attr.datetime]="evento.iso">{{ evento.quando }}</time>
            </div>
          </li>
        }
      </ol>
      @if (podeVerAuditoria()) {
        <div class="atividades__rodape">
          <span class="atividades__nota">Registro completo de todos os usuários</span>
          <span class="atividades__acao">
            <a
              appBotao
              tamanho="sm"
              variante="contorno"
              routerLink="/administracao"
              aria-label="Ver auditoria (em breve)"
              [icone]="iconeAuditoria"
            >
              Ver auditoria
            </a>
            <app-selo aria-hidden="true">em breve</app-selo>
          </span>
        </div>
      }
    </app-cartao>
  `,
  styleUrl: './atividades-recentes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtividadesRecentes {
  private readonly perfil = inject(PerfilDemoService);
  private readonly agora = inject(RELOGIO);
  /** Os eventos de exemplo aconteceram "há N minutos" contados da abertura da página. */
  private readonly abertura = new Date();

  protected readonly iconeAuditoria = LucideShieldCheck;
  protected readonly podeVerAuditoria = computed(() => this.perfil.pode('administracao'));
  protected readonly dica = computed(() => (this.perfil.ehAdmin() ? DICA_ADMIN : DICA_AREA));

  protected readonly eventos = computed(() => {
    const agora = this.agora();
    const papel = this.perfil.papel();
    return ATIVIDADES_RECENTES.filter(
      (evento) => !evento.papeis || evento.papeis.includes(papel),
    ).map((evento) => {
      const data = new Date(this.abertura.getTime() - evento.minutosAtras * 60_000);
      return {
        ...evento,
        ...VISUAL[evento.tipo],
        iso: data.toISOString(),
        quando: formatarTempoRelativo(data, agora),
      };
    });
  });
}
