import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideBriefcase,
  LucideBuilding2,
  LucideDynamicIcon,
  LucideMail,
  LucidePanelRightClose,
  LucidePhone,
  LucideUserRound,
} from '@lucide/angular';
import { Subscription } from 'rxjs';

import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
  formatarTempoRelativo,
} from '../../nucleo/formatos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Dica } from '../../ui/dica/dica';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Selo } from '../../ui/selo/selo';
import { AtendimentoApi } from './atendimento.api';
import type {
  AtividadeDoContato,
  ContatoDoPainel,
  ConversaDetalhe,
  ConversaResumo,
  NegocioDoContato,
} from './atendimento.tipos';
import {
  CANAL,
  formatarTelefone,
  nomeDoContato,
  previaDaConversa,
  rotaDoNegocio,
  ROTULO_STATUS_CONVERSA,
} from './apresentacao';
import { EstadoAtendimento } from './estado-atendimento';

type Carga<T> =
  | { readonly situacao: 'carregando' }
  | { readonly situacao: 'pronta'; readonly dados: T }
  | { readonly situacao: 'erro' };

const CARREGANDO = { situacao: 'carregando' } as const;

/** Rótulos curtos dos tipos de atividade da Fase 1. */
const ROTULO_ATIVIDADE: Readonly<Record<string, string>> = {
  LIGACAO: 'Ligação',
  REUNIAO: 'Reunião',
  EMAIL: 'E-mail',
  TAREFA: 'Tarefa',
  WHATSAPP: 'WhatsApp',
  NOTA: 'Nota',
};

/**
 * Painel do contato (coluna da direita do Atendimento): dados e meios de contato, negócios de
 * todos os funis que a pessoa vê, atividades pendentes, conversas anteriores e os prazos desta
 * conversa (SLA). Ao lado da conversa no desktop; dentro do painel lateral (`sobreposto`) quando
 * falta largura.
 */
@Component({
  selector: 'app-painel-contato',
  imports: [Avatar, Botao, BotaoIcone, Dica, Esqueleto, LucideDynamicIcon, RouterLink, Selo],
  templateUrl: './painel-contato.html',
  styleUrl: './painel-contato.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.painel-contato--sobreposto]': 'sobreposto()',
  },
})
export class PainelContato {
  readonly conversa = input.required<ConversaDetalhe>();
  readonly sobreposto = input(false, { transform: booleanAttribute });

  /** O nome da empresa do contato (para a variável `{{contato.empresa}}` das respostas). */
  readonly empresa = output<string | null>();
  readonly criarNegocio = output<void>();
  readonly fechar = output<void>();

  private readonly api = inject(AtendimentoApi);
  private readonly sessao = inject(SessaoService);
  protected readonly estado = inject(EstadoAtendimento);

  protected readonly icones = {
    telefone: LucidePhone,
    email: LucideMail,
    empresa: LucideBuilding2,
    pessoa: LucideUserRound,
    negocio: LucideBriefcase,
    fechar: LucidePanelRightClose,
  };
  protected readonly ROTULO_STATUS = ROTULO_STATUS_CONVERSA;
  protected readonly CANAL = CANAL;

  protected readonly contato = signal<Carga<ContatoDoPainel>>(CARREGANDO);
  protected readonly negocios = signal<Carga<readonly NegocioDoContato[]>>(CARREGANDO);
  protected readonly atividades = signal<Carga<readonly AtividadeDoContato[]>>(CARREGANDO);
  protected readonly anteriores = signal<Carga<readonly ConversaResumo[]>>(CARREGANDO);

  protected readonly contatoId = computed(() => this.conversa().contato.id);
  /** Só a troca de conversa recarrega o painel (o detalhe muda a cada evento do tempo real). */
  private readonly conversaId = computed(() => this.conversa().id);
  protected readonly nome = computed(() => nomeDoContato(this.conversa().contato));
  protected readonly telefone = computed(() => formatarTelefone(this.conversa().contato.telefone));

  protected readonly prazos = computed(() => {
    const conversa = this.conversa();
    const agora = this.estado.agora();
    const passou = (iso: string | null) => !!iso && Date.parse(iso) < agora.getTime();
    return {
      primeira: conversa.primeiraRespostaEm
        ? `Respondida ${formatarTempoRelativo(conversa.primeiraRespostaEm, agora)}`
        : conversa.sla.primeiraRespostaAte
          ? passou(conversa.sla.primeiraRespostaAte)
            ? `Venceu ${formatarTempoRelativo(conversa.sla.primeiraRespostaAte, agora)}`
            : `Vence ${formatarTempoRelativo(conversa.sla.primeiraRespostaAte, agora)}`
          : 'Sem prazo nesta fila',
      primeiraEstourada:
        !conversa.primeiraRespostaEm &&
        conversa.status !== 'RESOLVIDA' &&
        (conversa.sla.primeiraRespostaEstourada || passou(conversa.sla.primeiraRespostaAte)),
      resolucao:
        conversa.status === 'RESOLVIDA'
          ? `Resolvida ${formatarTempoRelativo(conversa.resolvidaEm, agora)}`
          : conversa.sla.resolucaoAte
            ? passou(conversa.sla.resolucaoAte)
              ? `Venceu ${formatarTempoRelativo(conversa.sla.resolucaoAte, agora)}`
              : `Vence ${formatarTempoRelativo(conversa.sla.resolucaoAte, agora)}`
            : 'Sem prazo nesta fila',
      resolucaoEstourada:
        conversa.status !== 'RESOLVIDA' &&
        (conversa.sla.resolucaoEstourada || passou(conversa.sla.resolucaoAte)),
    };
  });

  private cargas = new Subscription();

  constructor() {
    effect(() => {
      const contatoId = this.contatoId();
      const conversaId = this.conversaId();
      untracked(() => this.carregar(contatoId, conversaId));
    });
    inject(DestroyRef).onDestroy(() => this.cargas.unsubscribe());
  }

  private carregar(contatoId: string, conversaId: string): void {
    this.cargas.unsubscribe();
    this.cargas = new Subscription();
    this.contato.set(CARREGANDO);
    this.negocios.set(CARREGANDO);
    this.atividades.set(CARREGANDO);
    this.anteriores.set(CARREGANDO);
    this.cargas.add(
      this.api.contato(contatoId).subscribe({
        next: (dados) => {
          this.contato.set({ situacao: 'pronta', dados });
          this.empresa.emit(dados.empresa?.nome ?? null);
        },
        error: () => this.contato.set({ situacao: 'erro' }),
      }),
    );
    this.cargas.add(
      this.api.negocios(contatoId).subscribe({
        next: (dados) => this.negocios.set({ situacao: 'pronta', dados }),
        error: () => this.negocios.set({ situacao: 'erro' }),
      }),
    );
    this.cargas.add(
      this.api.atividades(contatoId).subscribe({
        next: (dados) => this.atividades.set({ situacao: 'pronta', dados }),
        error: () => this.atividades.set({ situacao: 'erro' }),
      }),
    );
    this.cargas.add(
      this.api
        .conversas({
          escopo: 'TODAS',
          contatoId,
          status: ['ABERTA', 'PENDENTE', 'RESOLVIDA'],
          porPagina: 10,
        })
        .subscribe({
          next: (pagina) =>
            this.anteriores.set({
              situacao: 'pronta',
              dados: pagina.itens.filter((conversa) => conversa.id !== conversaId),
            }),
          error: () => this.anteriores.set({ situacao: 'erro' }),
        }),
    );
  }

  protected rotaNegocio(negocio: NegocioDoContato): readonly string[] {
    return rotaDoNegocio(negocio);
  }

  protected valor(negocio: NegocioDoContato): string {
    return formatarMoeda(negocio.valor, { centavos: false });
  }

  protected quando(atividade: AtividadeDoContato): string {
    const data = atividade.venceEm ?? atividade.inicioEm;
    return data ? formatarDataHora(data) : 'Sem data';
  }

  protected rotuloAtividade(tipo: string): string {
    return ROTULO_ATIVIDADE[tipo] ?? tipo;
  }

  protected dataConversa(conversa: ConversaResumo): string {
    return formatarData(conversa.ultimaMensagemEm ?? conversa.criadoEm);
  }

  protected previa(conversa: ConversaResumo): string {
    return previaDaConversa(conversa, this.sessao.usuario()?.nome ?? null);
  }

  protected criadaEm(): string {
    return formatarDataHora(this.conversa().criadoEm);
  }
}
