import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideClock, LucideDynamicIcon, LucideSlidersHorizontal, LucideX } from '@lucide/angular';

import { descricaoDoSeloIa, iaAtendendo } from '../../nucleo/sdr/sdr.apresentacao';
import { SeloIa } from '../../nucleo/sdr/selo-ia';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { Dica } from '../../ui/dica/dica';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { Selo } from '../../ui/selo/selo';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import type { ConversaResumo, EscopoConversas, TipoCanal } from './atendimento.tipos';
import { TIPOS_CANAL } from './atendimento.tipos';
import {
  CANAL,
  esperaDaConversa,
  horaCurta,
  nomeDoContato,
  previaDaConversa,
  primeiroNome,
  ROTULO_ESCOPO,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS_CONVERSA,
} from './apresentacao';
import { EstadoAtendimento, filtrosLigados, type SituacaoLista } from './estado-atendimento';

/** A busca espera a pessoa parar de digitar. */
export const ESPERA_BUSCA_MS = 350;

/** Uma linha da lista, já com tudo o que o modelo mostra. */
interface LinhaConversa {
  readonly conversa: ConversaResumo;
  readonly nome: string;
  readonly canal: (typeof CANAL)[TipoCanal];
  readonly hora: string;
  readonly previa: string;
  readonly espera: ReturnType<typeof esperaDaConversa>;
  readonly responsavel: string | null;
  readonly etiquetas: readonly string[];
  readonly prioridade: string | null;
  readonly rotulo: string;
}

const OPCOES_SITUACAO: readonly OpcaoFiltro[] = [
  { id: 'EM_ABERTO', rotulo: 'Em aberto' },
  { id: 'PENDENTE', rotulo: 'Aguardando o contato' },
  { id: 'RESOLVIDA', rotulo: 'Resolvidas' },
];

/**
 * Coluna da esquerda do Atendimento: filtros em pílula (minhas · sem responsável · todas,
 * com os contadores), busca, filtros extras (situação, canal, fila, etiqueta, não lidas, prazo
 * estourado) e as conversas — ícone do canal, prévia da última mensagem, hora, não lidas e o
 * tempo de espera (selo coral quando passa do prazo da fila). Teclado: setas, Home e End andam
 * pela lista (um só ponto de Tab), Enter abre.
 */
@Component({
  selector: 'app-lista-conversas',
  imports: [
    Avatar,
    Botao,
    BotaoIcone,
    CampoBusca,
    Dica,
    EstadoVazio,
    Esqueleto,
    FiltrosPilula,
    LucideDynamicIcon,
    RouterLink,
    Selo,
    SeloIa,
    Seletor,
  ],
  templateUrl: './lista-conversas.html',
  styleUrl: './lista-conversas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lista-conversas' },
})
export class ListaConversas {
  protected readonly estado = inject(EstadoAtendimento);
  private readonly sessao = inject(SessaoService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly busca = viewChild(CampoBusca);

  protected readonly icones = {
    filtros: LucideSlidersHorizontal,
    relogio: LucideClock,
    limpar: LucideX,
  };
  protected readonly opcoesSituacao = OPCOES_SITUACAO;
  protected readonly filtros = this.estado.filtros;
  protected readonly filtrosAbertos = signal(false);
  protected readonly ligados = computed(() => filtrosLigados(this.filtros()));
  protected readonly idFiltros = 'atendimento-filtros';

  /** O que está no campo de busca (vai para os filtros depois da pausa). */
  protected readonly termo = signal(this.estado.filtros().busca);
  private esperaBusca: ReturnType<typeof setTimeout> | undefined;

  /** O item da lista que recebe o Tab (os outros, só pelas setas). */
  protected readonly focavel = signal<string | null>(null);

  /** Minhas · Sem responsável · Todas, com o número de cada uma (o controle do topo). */
  protected readonly escopos = computed(() => {
    const contadores = this.estado.contadores();
    const contagem: Readonly<Record<EscopoConversas, number | null>> = {
      MINHAS: contadores?.minhas ?? null,
      SEM_RESPONSAVEL: contadores?.semResponsavel ?? null,
      TODAS: contadores?.todas ?? null,
    };
    return (['MINHAS', 'SEM_RESPONSAVEL', 'TODAS'] as const).map((id) => {
      const numero = contagem[id];
      return {
        id,
        rotulo: ROTULO_ESCOPO[id],
        contagem: numero,
        rotuloFalado:
          numero === null
            ? ROTULO_ESCOPO[id]
            : `${ROTULO_ESCOPO[id]}: ${numero === 1 ? '1 conversa em aberto' : `${numero} conversas em aberto`}`,
      };
    });
  });

  protected readonly opcoesCanal = computed<readonly OpcaoFiltro[]>(() => {
    const existentes = new Set(this.estado.canais().map((canal) => canal.tipo));
    const tipos = existentes.size
      ? TIPOS_CANAL.filter((tipo) => existentes.has(tipo))
      : TIPOS_CANAL;
    return tipos.map((tipo) => ({
      id: tipo,
      rotulo: CANAL[tipo].rotulo,
      icone: CANAL[tipo].icone,
    }));
  });

  protected readonly opcoesFila = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.estado.filas().map((fila) => ({ valor: fila.id, rotulo: fila.nome })),
  );

  protected readonly opcoesConta = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.estado.canais().map((canal) => ({ valor: canal.id, rotulo: canal.nome })),
  );

  protected readonly opcoesEtiqueta = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.estado.etiquetasEmUso().map((etiqueta) => ({ valor: etiqueta, rotulo: etiqueta })),
  );

  protected readonly opcoesSomente = computed<readonly OpcaoFiltro[]>(() => [
    { id: 'naoLidas', rotulo: 'Não lidas' },
    { id: 'slaEstourado', rotulo: 'Prazo estourado' },
    { id: 'atendidasPelaIa', rotulo: 'Atendidas pela IA' },
  ]);

  protected readonly somente = computed(() => {
    const filtros = this.filtros();
    return [
      ...(filtros.naoLidas ? ['naoLidas'] : []),
      ...(filtros.slaEstourado ? ['slaEstourado'] : []),
      ...(filtros.atendidasPelaIa ? ['atendidasPelaIa'] : []),
    ];
  });

  protected readonly linhas = computed<readonly LinhaConversa[]>(() => {
    const agora = this.estado.agora();
    const usuario = this.sessao.usuario();
    const escopo = this.filtros().escopo;
    const soIa = this.filtros().atendidasPelaIa;
    const conversas = soIa
      ? this.estado.conversas().filter((conversa) => iaAtendendo(conversa.sdr))
      : this.estado.conversas();
    return conversas.map((conversa) => {
      const nome = nomeDoContato(conversa.contato);
      const canal = CANAL[conversa.canal.tipo];
      const espera = esperaDaConversa(conversa, agora);
      const previa = previaDaConversa(conversa, usuario?.nome ?? null);
      const hora = horaCurta(conversa.ultimaMensagemEm ?? conversa.criadoEm, agora);
      const responsavel =
        conversa.responsavel && escopo !== 'MINHAS'
          ? conversa.responsavel.id === usuario?.id
            ? 'Você'
            : primeiroNome(conversa.responsavel.nome)
          : null;
      const prioridade =
        conversa.prioridade === 'ALTA' || conversa.prioridade === 'URGENTE'
          ? ROTULO_PRIORIDADE[conversa.prioridade]
          : null;
      const partes = [
        nome,
        canal.rotulo,
        conversa.naoLidas
          ? conversa.naoLidas === 1
            ? '1 mensagem não lida'
            : `${conversa.naoLidas} mensagens não lidas`
          : null,
        espera?.frase ?? null,
        conversa.status !== 'ABERTA' ? ROTULO_STATUS_CONVERSA[conversa.status] : null,
        iaAtendendo(conversa.sdr) && conversa.sdr ? descricaoDoSeloIa(conversa.sdr) : null,
        prioridade ? `prioridade ${prioridade.toLowerCase()}` : null,
        conversa.responsavel
          ? `com ${conversa.responsavel.id === usuario?.id ? 'você' : conversa.responsavel.nome}`
          : 'sem responsável',
        `última mensagem ${hora}: ${previa}`,
      ];
      return {
        conversa,
        nome,
        canal,
        hora,
        previa,
        espera,
        responsavel,
        etiquetas: conversa.etiquetas.slice(0, 2),
        prioridade,
        rotulo: partes.filter(Boolean).join(', '),
      };
    });
  });

  protected readonly temFiltro = computed(
    () => this.ligados() > 0 || !!this.filtros().busca.trim(),
  );

  constructor() {
    // Link já filtrado (cliques do BI): o painel de filtros abre para mostrar o que vale.
    effect(() => {
      if (this.estado.abrirFiltros()) {
        untracked(() => {
          this.filtrosAbertos.set(true);
          this.estado.abrirFiltros.set(false);
        });
      }
    });
    // O item focável acompanha a conversa aberta (ou a primeira da lista).
    effect(() => {
      const selecionada = this.estado.selecionadaId();
      const ids = this.estado.conversas().map((conversa) => conversa.id);
      untracked(() => {
        const atual = this.focavel();
        if (selecionada && ids.includes(selecionada)) {
          this.focavel.set(selecionada);
        } else if (!atual || !ids.includes(atual)) {
          this.focavel.set(ids[0] ?? null);
        }
      });
    });
    effect(() => {
      const pedido = this.estado.foco();
      if (!pedido) {
        return;
      }
      untracked(() => {
        if (pedido.alvo === 'busca') {
          this.busca()?.focar();
          this.estado.foco.set(null);
        } else if (pedido.alvo === 'lista') {
          this.focarItem(this.focavel());
          this.estado.foco.set(null);
        }
      });
    });
    // "Atendidas pela IA" filtra as conversas já carregadas: busca mais páginas até aparecer o bastante.
    effect(() => {
      if (
        this.filtros().atendidasPelaIa &&
        this.estado.situacao() === 'pronta' &&
        this.linhas().length < 10 &&
        this.estado.temMais() &&
        !this.estado.carregandoMais()
      ) {
        untracked(() => this.estado.carregarMais());
      }
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.esperaBusca));
  }

  // Filtros ----------------------------------------------------------------------------------

  protected escolherEscopo(escopo: EscopoConversas): void {
    this.estado.mudarFiltros({ escopo });
  }

  protected escolherSituacao(situacao: string | null): void {
    if (situacao) {
      this.estado.mudarFiltros({ situacao: situacao as SituacaoLista });
    }
  }

  protected escolherCanais(canais: readonly string[]): void {
    this.estado.mudarFiltros({ canais: canais as TipoCanal[] });
  }

  protected escolherCanal(canalId: string | null): void {
    this.estado.mudarFiltros({ canalId });
  }

  protected escolherFila(filaId: string | null): void {
    this.estado.mudarFiltros({ filaId });
  }

  protected escolherEtiqueta(etiqueta: string | null): void {
    this.estado.mudarFiltros({ etiqueta });
  }

  protected escolherSomente(ids: readonly string[]): void {
    this.estado.mudarFiltros({
      naoLidas: ids.includes('naoLidas'),
      slaEstourado: ids.includes('slaEstourado'),
      atendidasPelaIa: ids.includes('atendidasPelaIa'),
    });
  }

  protected digitar(termo: string): void {
    this.termo.set(termo);
    clearTimeout(this.esperaBusca);
    this.esperaBusca = setTimeout(() => this.aplicarBusca(termo), ESPERA_BUSCA_MS);
  }

  protected aplicarBusca(termo: string): void {
    clearTimeout(this.esperaBusca);
    if (termo.trim() !== this.filtros().busca.trim()) {
      this.estado.mudarFiltros({ busca: termo });
    }
  }

  protected limparTudo(): void {
    clearTimeout(this.esperaBusca);
    this.termo.set('');
    this.estado.limparFiltros();
  }

  // Teclado ----------------------------------------------------------------------------------

  protected aoTeclar(evento: KeyboardEvent): void {
    if (evento.altKey || evento.ctrlKey || evento.metaKey) {
      return;
    }
    const ids = this.estado.conversas().map((conversa) => conversa.id);
    const alvo = (evento.target as HTMLElement).closest<HTMLElement>('[data-conversa]');
    const atual = alvo ? ids.indexOf(alvo.dataset['conversa'] ?? '') : -1;
    let proximo: number | null = null;
    switch (evento.key) {
      case 'ArrowDown':
        proximo = Math.min(ids.length - 1, atual + 1);
        break;
      case 'ArrowUp':
        proximo = Math.max(0, atual - 1);
        break;
      case 'Home':
        proximo = 0;
        break;
      case 'End':
        proximo = ids.length - 1;
        break;
    }
    if (proximo === null || !ids.length) {
      return;
    }
    evento.preventDefault();
    this.focavel.set(ids[proximo]);
    this.focarItem(ids[proximo]);
    if (proximo === ids.length - 1 && this.estado.temMais()) {
      this.estado.carregarMais();
    }
  }

  private focarItem(id: string | null): void {
    if (!id) {
      return;
    }
    this.host.nativeElement
      .querySelector<HTMLElement>(`[data-conversa="${CSS.escape(id)}"]`)
      ?.focus({ preventScroll: false });
  }

  protected aoFocar(id: string): void {
    this.focavel.set(id);
  }
}
