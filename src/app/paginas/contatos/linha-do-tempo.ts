import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon, LucideRefreshCw } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { formatarData, formatarDataHora, formatarHora, paraData } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { Dica } from '../../ui/dica/dica';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { ContatosApi, type DonoDoHistorico } from './contatos.api';
import {
  type AlteracaoDeCampo,
  alteracoesDoEvento,
  type AtividadeDaLinhaDoTempo,
  type ConteudoDaLinhaDoTempo,
  type EventoDaLinhaDoTempo,
  type RegistroDaLinhaDoTempo,
  resumoDoEvento,
  ROTULO_TIPO_ATIVIDADE,
} from './contatos.tipos';
import { ICONE_TIPO_ATIVIDADE, iconeDoEvento } from './icones-atividade';

const POR_PAGINA = 20;

const OPCOES: readonly OpcaoFiltro[] = [
  { id: 'tudo', rotulo: 'Tudo' },
  { id: 'eventos', rotulo: 'Alterações' },
  { id: 'atividades', rotulo: 'Atividades' },
];

const ROTULO_ATOR: Readonly<Record<EventoDaLinhaDoTempo['tipoAtor'], string>> = {
  USUARIO: 'Alguém da equipe',
  SISTEMA: 'Sistema',
  WEBHOOK: 'Webhook',
  AUTOMACAO: 'Automação',
  IA: 'Assistente de IA',
};

/** Um registro já pronto para a tela. */
interface ItemDaLinha {
  readonly chave: string;
  readonly registro: RegistroDaLinhaDoTempo;
  readonly hora: string;
  readonly quando: string;
  /** Resumo do evento com rótulos no lugar dos nomes técnicos (vazio nas atividades). */
  readonly resumo: string;
  readonly alteracoes: readonly AlteracaoDeCampo[];
}

interface DiaDaLinha {
  readonly dia: string;
  readonly rotulo: string;
  readonly itens: readonly ItemDaLinha[];
}

function chaveDoDia(data: Date): string {
  return `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`;
}

/** "Hoje", "Ontem" ou "21 de outubro de 2026" (fuso do navegador). */
export function rotuloDoDia(iso: string, agora: Date = new Date()): string {
  const data = paraData(iso);
  if (!data) {
    return '—';
  }
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (chaveDoDia(data) === chaveDoDia(agora)) {
    return 'Hoje';
  }
  if (chaveDoDia(data) === chaveDoDia(ontem)) {
    return 'Ontem';
  }
  return formatarData(data, 'longa');
}

/** Agrupa os registros (já do mais recente ao mais antigo) por dia. */
export function agruparPorDia(
  registros: readonly RegistroDaLinhaDoTempo[],
  agora: Date = new Date(),
): readonly DiaDaLinha[] {
  const dias: { dia: string; rotulo: string; itens: ItemDaLinha[] }[] = [];
  for (const registro of registros) {
    const data = paraData(registro.ocorridoEm);
    const dia = data ? chaveDoDia(data) : '—';
    let grupo = dias[dias.length - 1];
    if (!grupo || grupo.dia !== dia) {
      grupo = { dia, rotulo: rotuloDoDia(registro.ocorridoEm, agora), itens: [] };
      dias.push(grupo);
    }
    grupo.itens.push({
      chave: registro.evento ? `e${registro.evento.id}` : `a${registro.atividade?.id ?? ''}`,
      registro,
      hora: formatarHora(registro.ocorridoEm),
      quando: formatarDataHora(registro.ocorridoEm),
      resumo: registro.evento ? resumoDoEvento(registro.evento) : '',
      alteracoes: registro.evento ? alteracoesDoEvento(registro.evento) : [],
    });
  }
  return dias;
}

/**
 * Linha do tempo de um contato ou de uma empresa (R3.5): as alterações registradas na
 * auditoria e as atividades (também as dos negócios dele), do mais recente ao mais antigo,
 * agrupadas por dia, com "Carregar mais". Filtro: tudo, só alterações ou só atividades.
 */
@Component({
  selector: 'app-linha-do-tempo',
  imports: [Botao, Dica, Esqueleto, EstadoVazio, FiltrosPilula, LucideDynamicIcon, RouterLink],
  templateUrl: './linha-do-tempo.html',
  styleUrl: './linha-do-tempo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinhaDoTempo {
  readonly dono = input.required<DonoDoHistorico>();
  readonly id = input.required<string>();
  /** Mude para recarregar (depois de editar, concluir uma atividade…). */
  readonly versao = input(0);

  private readonly api = inject(ContatosApi);

  protected readonly opcoes = OPCOES;
  protected readonly icones = { tentar: LucideRefreshCw };
  protected readonly rotuloTipo = ROTULO_TIPO_ATIVIDADE;
  protected readonly iconeTipo = ICONE_TIPO_ATIVIDADE;
  protected readonly iconeDoEvento = iconeDoEvento;

  protected readonly filtro = signal<ConteudoDaLinhaDoTempo>('tudo');
  protected readonly registros = signal<readonly RegistroDaLinhaDoTempo[]>([]);
  protected readonly total = signal(0);
  protected readonly carregando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  private pagina = 0;
  /** Só a resposta do último pedido vale (trocar o filtro no meio de um carregamento). */
  private pedido = 0;

  protected readonly dias = computed(() => agruparPorDia(this.registros()));
  protected readonly temMais = computed(() => this.registros().length < this.total());

  protected readonly explicacao = computed(() =>
    this.dono() === 'empresa'
      ? 'Tudo o que aconteceu com a empresa: alterações registradas e atividades, inclusive as dos negócios dela. Você vê as atividades e os negócios que o seu papel permite.'
      : 'Tudo o que aconteceu com a pessoa: alterações registradas (inclusive quando ela voltou por outro canal) e atividades, inclusive as dos negócios dela. Você vê as atividades e os negócios que o seu papel permite.',
  );

  constructor() {
    effect(() => {
      this.dono();
      this.id();
      this.filtro();
      this.versao();
      untracked(() => void this.recomecar());
    });
  }

  protected escolher(filtro: string | null): void {
    if (filtro === 'tudo' || filtro === 'eventos' || filtro === 'atividades') {
      this.filtro.set(filtro);
    }
  }

  protected ator(evento: EventoDaLinhaDoTempo): string {
    const nome = evento.atorDescricao?.trim();
    if (evento.tipoAtor === 'USUARIO') {
      return nome || ROTULO_ATOR.USUARIO;
    }
    return nome ? `${ROTULO_ATOR[evento.tipoAtor]} · ${nome}` : ROTULO_ATOR[evento.tipoAtor];
  }

  protected situacao(atividade: AtividadeDaLinhaDoTempo): string {
    switch (atividade.status) {
      case 'CONCLUIDA':
        return atividade.tipo === 'NOTA' ? 'Nota' : 'Concluída';
      case 'CANCELADA':
        return 'Cancelada';
      default:
        return atividade.atrasada ? 'Atrasada' : 'Pendente';
    }
  }

  protected async recomecar(): Promise<void> {
    this.pagina = 0;
    this.registros.set([]);
    this.total.set(0);
    await this.carregarMais();
  }

  protected async carregarMais(): Promise<void> {
    const pedido = ++this.pedido;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const pagina = await firstValueFrom(
        this.api.linhaDoTempo(this.dono(), this.id(), this.filtro(), this.pagina + 1, POR_PAGINA),
      );
      if (pedido !== this.pedido) {
        return;
      }
      this.pagina = pagina.pagina;
      this.registros.update((atuais) => [...atuais, ...pagina.itens]);
      this.total.set(pagina.total);
    } catch (falha) {
      if (pedido === this.pedido) {
        this.erro.set(erroDaApi(falha));
      }
    } finally {
      if (pedido === this.pedido) {
        this.carregando.set(false);
      }
    }
  }
}
