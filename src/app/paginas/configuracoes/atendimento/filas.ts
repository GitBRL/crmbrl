import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  LucideDynamicIcon,
  LucideInfo,
  LucidePencil,
  LucidePlus,
  LucidePower,
  LucidePowerOff,
  LucideRefreshCw,
  LucideShuffle,
  LucideTrash,
} from '@lucide/angular';

import { erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../../nucleo/confirmacao.service';
import { SessaoService } from '../../../nucleo/sessao/sessao.service';
import { Alternador } from '../../../ui/alternador/alternador';
import { Avatar } from '../../../ui/avatar/avatar';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { Dica } from '../../../ui/dica/dica';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../../ui/filtros-pilula/filtros-pilula';
import { type ItemMenuAcoes, MenuAcoes } from '../../../ui/menu-acoes/menu-acoes';
import { Selo } from '../../../ui/selo/selo';
import { ICONE_DO_CANAL } from '../canais/icones';
import { Carregamento } from '../carregamento';
import {
  DICA_SLA,
  ESTRATEGIA,
  formatarMinutos,
  MOTIVO_NA_FILA,
  rotuloDaArea,
} from './apresentacao';
import { AtendimentoConfigApi } from './atendimento.api';
import {
  AREAS_DO_ATENDIMENTO,
  type AreaDoAtendimento,
  type Fila,
  type PessoaNaFila,
} from './atendimento.modelos';
import { FormularioFila, type PedidoFormularioFila } from './formulario-fila';

/** Área do papel de líder que atende (Comercial ou CS). */
const AREA_DO_LIDER: Readonly<Record<string, AreaDoAtendimento>> = {
  LIDER_COMERCIAL: 'COMERCIAL',
  LIDER_CS: 'CS',
};

/**
 * Filas e SLA (`/configuracoes/atendimento/filas`) — R12: um cartão por fila com a estratégia,
 * os prazos de primeira resposta e de resolução, as conversas em aberto, os canais que mandam
 * para ela, o próximo da vez e quem recebe (cada pessoa liga e desliga na hora, com "Desfazer").
 * Criar, editar, desativar e excluir: Admin, C-level e o líder da área; os outros só leem.
 */
@Component({
  selector: 'app-config-filas',
  imports: [
    LucideDynamicIcon,
    LucideInfo,
    Alternador,
    Avatar,
    Botao,
    Cartao,
    Dica,
    Esqueleto,
    EstadoVazio,
    FiltrosPilula,
    FormularioFila,
    MenuAcoes,
    Selo,
  ],
  templateUrl: './filas.html',
  styleUrl: './filas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Filas {
  private readonly api = inject(AtendimentoConfigApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly sessao = inject(SessaoService);

  protected readonly icones = {
    novo: LucidePlus,
    tentar: LucideRefreshCw,
    estrategia: LucideShuffle,
  };
  protected readonly estrategia = ESTRATEGIA;
  protected readonly dicaSla = DICA_SLA;
  protected readonly iconeDoCanal = ICONE_DO_CANAL;

  protected readonly dados = new Carregamento<readonly Fila[]>();
  protected readonly area = signal<string>('TODAS');
  protected readonly formulario = signal<PedidoFormularioFila | null>(null);
  /** Pessoas sendo salvas (`<fila>:<usuario>`). */
  private readonly pendentes = signal<ReadonlySet<string>>(new Set());
  /** Recria os alternadores quando uma alteração falha (o clique já tinha mudado o desenho). */
  protected readonly revisao = signal(0);

  /** Áreas em que a pessoa pode criar filas. */
  protected readonly areasPermitidas = computed<readonly AreaDoAtendimento[]>(() => {
    if (this.sessao.ehDiretoria()) {
      return AREAS_DO_ATENDIMENTO;
    }
    const area = AREA_DO_LIDER[this.sessao.papel() ?? ''];
    return area ? [area] : [];
  });
  protected readonly podeCriar = computed(() => this.areasPermitidas().length > 0);

  protected readonly filas = computed(() => this.dados.dados() ?? []);
  protected readonly opcoesArea = computed<readonly OpcaoFiltro[]>(() => {
    const filas = this.filas();
    const areas = AREAS_DO_ATENDIMENTO.filter((area) => filas.some((fila) => fila.area === area));
    if (areas.length < 2) {
      return [];
    }
    return [
      { id: 'TODAS', rotulo: 'Todas', contagem: filas.length },
      ...areas.map((area) => ({
        id: area,
        rotulo: rotuloDaArea(area),
        contagem: filas.filter((fila) => fila.area === area).length,
      })),
    ];
  });
  protected readonly filasVisiveis = computed(() => {
    const area = this.area();
    // Ativas primeiro; depois, pelo nome.
    return this.filas()
      .filter((fila) => area === 'TODAS' || fila.area === area)
      .slice()
      .sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.nome.localeCompare(b.nome, 'pt-BR'));
  });

  /**
   * As filas em duas colunas equilibradas pela altura estimada (cada pessoa é uma linha), para um
   * cartão curto não deixar buraco ao lado de um alto. Em tela estreita, as colunas empilham.
   */
  protected readonly colunas = computed<readonly (readonly Fila[])[]>(() => {
    const colunas: Fila[][] = [[], []];
    const alturas = [0, 0];
    for (const fila of this.filasVisiveis()) {
      const altura =
        6 + (fila.estrategia === 'MANUAL' ? 1 : fila.pessoas.length) + (fila.descricao ? 1 : 0);
      const destino = alturas[0] <= alturas[1] ? 0 : 1;
      colunas[destino].push(fila);
      alturas[destino] += altura;
    }
    return colunas.filter((coluna) => coluna.length > 0);
  });

  constructor() {
    this.carregar();
  }

  protected carregar(): void {
    void this.dados.executar(() => this.api.listarFilas(true));
  }

  protected rotuloDaArea(area: AreaDoAtendimento): string {
    return rotuloDaArea(area);
  }

  protected minutos(valor: number | null): string {
    return formatarMinutos(valor);
  }

  protected textoDaPessoa(pessoa: PessoaNaFila): string {
    const motivo = MOTIVO_NA_FILA[pessoa.motivo];
    return pessoa.emAberto > 0 ? `${motivo} ${pessoa.emAberto} em aberto agora.` : motivo;
  }

  protected motivoSemEdicao(fila: Fila): string {
    return `Só Admin, C-level e o líder de ${rotuloDaArea(fila.area)} alteram esta fila.`;
  }

  protected emAndamento(chave: string): boolean {
    return this.pendentes().has(chave);
  }

  protected acoesDa(fila: Fila): readonly ItemMenuAcoes[] {
    const semPermissao = fila.podeEditar ? undefined : this.motivoSemEdicao(fila);
    const comConversas =
      fila.conversasEmAberto > 0
        ? `Tem ${fila.conversasEmAberto} ${fila.conversasEmAberto === 1 ? 'conversa' : 'conversas'} em aberto: resolva ou transfira antes.`
        : undefined;
    return [
      {
        id: 'editar',
        rotulo: 'Editar',
        icone: LucidePencil,
        desabilitado: !fila.podeEditar,
        motivo: semPermissao,
      },
      fila.ativa
        ? {
            id: 'desativar',
            rotulo: 'Desativar',
            icone: LucidePowerOff,
            desabilitado: !fila.podeEditar,
            motivo: semPermissao,
          }
        : {
            id: 'ativar',
            rotulo: 'Ativar',
            icone: LucidePower,
            desabilitado: !fila.podeEditar,
            motivo: semPermissao,
          },
      {
        id: 'excluir',
        rotulo: 'Excluir',
        icone: LucideTrash,
        perigo: true,
        separarAntes: true,
        desabilitado: !fila.podeEditar || fila.conversasEmAberto > 0,
        motivo: semPermissao ?? comConversas,
      },
    ];
  }

  protected abrirFormulario(fila: Fila | null): void {
    this.formulario.set(fila ? { modo: 'editar', fila } : { modo: 'criar' });
  }

  protected filaSalva(fila: Fila): void {
    this.substituir(fila);
  }

  protected agir(fila: Fila, acao: string): void {
    switch (acao) {
      case 'editar':
        this.abrirFormulario(fila);
        return;
      case 'desativar':
      case 'ativar':
        void this.definirAtiva(fila, acao === 'ativar');
        return;
      case 'excluir':
        void this.excluir(fila);
        return;
    }
  }

  private async definirAtiva(fila: Fila, ativa: boolean, desfazendo = false): Promise<void> {
    if (!ativa && !desfazendo) {
      const ok = await this.confirmacao.confirmar({
        titulo: `Desativar a fila “${fila.nome}”?`,
        mensagem:
          fila.canais.length > 0
            ? 'A fila para de receber conversas novas. Os canais que mandam para ela precisam de outra fila; até lá, as conversas novas deles ficam sem fila (só Admin e C-level veem).'
            : 'A fila para de receber conversas novas. As conversas em aberto continuam com quem está atendendo.',
        detalhes: fila.canais.map((canal) => `Canal: ${canal.nome}`),
        confirmar: 'Desativar',
      });
      if (!ok) {
        return;
      }
    }
    try {
      const salva = await this.api.atualizarFila(fila.id, { ativa });
      this.substituir(salva);
      this.avisos.sucesso(
        ativa ? `Fila “${fila.nome}” ativada.` : `Fila “${fila.nome}” desativada.`,
        {
          acao: desfazendo
            ? undefined
            : { rotulo: 'Desfazer', executar: () => void this.definirAtiva(salva, !ativa, true) },
        },
      );
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    }
  }

  private async excluir(fila: Fila): Promise<void> {
    const ok = await this.confirmacao.confirmar({
      titulo: `Excluir a fila “${fila.nome}”?`,
      mensagem:
        'A fila some da configuração. Os canais que mandavam conversas para ela ficam sem fila padrão — escolha outra para eles.',
      detalhes: fila.canais.map((canal) => `Canal sem fila depois disso: ${canal.nome}`),
      confirmar: 'Excluir fila',
      perigo: true,
      executar: () => this.api.excluirFila(fila.id),
    });
    if (ok) {
      this.dados.definir(this.filas().filter((item) => item.id !== fila.id));
      this.avisos.sucesso(`Fila “${fila.nome}” excluída.`);
    }
  }

  protected async definirParticipacao(
    fila: Fila,
    pessoa: PessoaNaFila,
    participa: boolean,
    desfazendo = false,
  ): Promise<void> {
    const chave = `${fila.id}:${pessoa.id}`;
    if (this.emAndamento(chave)) {
      return;
    }
    this.pendentes.update((atual) => new Set(atual).add(chave));
    try {
      const salva = await this.api.definirParticipacao(fila.id, pessoa.id, participa);
      this.substituir(salva);
      const depois = salva.pessoas.find((item) => item.id === pessoa.id);
      const espera =
        participa &&
        depois &&
        (depois.motivo === 'CONVITE_PENDENTE' || depois.motivo === 'PRIMEIRO_ACESSO_PENDENTE');
      const mensagem = !participa
        ? `${pessoa.nome} não recebe mais conversas de “${fila.nome}”.`
        : espera
          ? `${pessoa.nome} vai receber conversas de “${fila.nome}” quando ativar o acesso.`
          : `${pessoa.nome} passa a receber conversas de “${fila.nome}”.`;
      this.avisos.sucesso(mensagem, {
        chave: `fila-${chave}`,
        acao: desfazendo
          ? undefined
          : {
              rotulo: 'Desfazer',
              executar: () => void this.desfazer(salva.id, pessoa.id, !participa),
            },
      });
    } catch (falha) {
      this.revisao.update((valor) => valor + 1);
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.pendentes.update((atual) => {
        const proximo = new Set(atual);
        proximo.delete(chave);
        return proximo;
      });
    }
  }

  private desfazer(filaId: string, pessoaId: string, participa: boolean): void {
    const fila = this.filas().find((item) => item.id === filaId);
    const pessoa = fila?.pessoas.find((item) => item.id === pessoaId);
    if (fila && pessoa && pessoa.participa !== participa) {
      void this.definirParticipacao(fila, pessoa, participa, true);
    }
  }

  private substituir(fila: Fila): void {
    const filas = this.filas();
    const existe = filas.some((item) => item.id === fila.id);
    this.dados.definir(
      existe ? filas.map((item) => (item.id === fila.id ? fila : item)) : [...filas, fila],
    );
  }
}
