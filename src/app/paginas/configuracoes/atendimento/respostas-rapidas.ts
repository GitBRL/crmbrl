import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  LucideMessageSquareText,
  LucidePencil,
  LucidePlus,
  LucidePower,
  LucidePowerOff,
  LucideRefreshCw,
  LucideTrash,
} from '@lucide/angular';

import { erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../../nucleo/confirmacao.service';
import { SessaoService } from '../../../nucleo/sessao/sessao.service';
import type { Area } from '../../../nucleo/sessao/perfil';
import { Botao } from '../../../ui/botao/botao';
import { CaixaSelecao } from '../../../ui/caixa-selecao/caixa-selecao';
import { CampoBusca } from '../../../ui/campo-busca/campo-busca';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../../ui/filtros-pilula/filtros-pilula';
import { type ItemMenuAcoes, MenuAcoes } from '../../../ui/menu-acoes/menu-acoes';
import { Selo } from '../../../ui/selo/selo';
import { CelulaTabela } from '../../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../../ui/tabela/tabela';
import { Carregamento } from '../carregamento';
import { rotuloDaArea } from './apresentacao';
import { AtendimentoConfigApi } from './atendimento.api';
import type { AreaDoAtendimento, RespostaRapida, Variavel } from './atendimento.modelos';
import { FormularioResposta, type PedidoFormularioResposta } from './formulario-resposta';
import { SETOR_MARKETING } from '../../../nucleo/setores/setores';
import { SetoresService } from '../../../nucleo/setores/setores.service';

type FiltroArea = 'TODAS' | 'GLOBAL' | AreaDoAtendimento;

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'atalho', rotulo: 'Atalho', largura: '12rem' },
  { id: 'titulo', rotulo: 'Título', largura: '16rem' },
  { id: 'area', rotulo: 'Quem usa', largura: '10rem' },
  { id: 'texto', rotulo: 'Texto' },
  { id: 'acoes', rotulo: 'Ações', rotuloOculto: true, fixa: true, largura: '4rem', alinhar: 'fim' },
];

/** Sem acentos e em minúsculas, para a busca. */
function simplificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
}

/**
 * Respostas rápidas (`/configuracoes/atendimento/respostas`) — R12: a lista com busca (atalho,
 * título e texto, sem diferenciar acentos), filtro por setor e as desativadas; criar, editar,
 * ativar/desativar e excluir. Admin e C-level gerenciam todas; o líder, as do setor dele; os outros
 * só leem (e usam pelo "/" no Atendimento).
 */
@Component({
  selector: 'app-config-respostas-rapidas',
  imports: [
    LucideMessageSquareText,
    Botao,
    CaixaSelecao,
    CampoBusca,
    CelulaTabela,
    EstadoVazio,
    FiltrosPilula,
    FormularioResposta,
    MenuAcoes,
    Selo,
    Tabela,
  ],
  templateUrl: './respostas-rapidas.html',
  styleUrl: './respostas-rapidas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RespostasRapidas {
  protected readonly setores = inject(SetoresService);
  private readonly api = inject(AtendimentoConfigApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly sessao = inject(SessaoService);

  protected readonly icones = { novo: LucidePlus, tentar: LucideRefreshCw };
  protected readonly colunas = COLUNAS;
  protected readonly opcoesArea = computed<readonly OpcaoFiltro[]>(() => [
    { id: 'TODAS', rotulo: 'Todas' },
    { id: 'GLOBAL', rotulo: 'Todos os setores' },
    ...this.setores.atendem().map((setor) => ({ id: setor.chave, rotulo: setor.nome })),
  ]);

  protected readonly dados = new Carregamento<readonly RespostaRapida[]>();
  protected readonly variaveis = signal<readonly Variavel[]>([]);
  protected readonly busca = signal('');
  protected readonly area = signal<FiltroArea>('TODAS');
  protected readonly incluirInativas = signal(true);
  protected readonly formulario = signal<PedidoFormularioResposta | null>(null);

  /** Onde a pessoa cria respostas (`TODAS` = todos os setores, só Admin e C-level). */
  protected readonly areasPermitidas = computed<readonly ('TODAS' | AreaDoAtendimento)[]>(() => {
    if (this.sessao.ehDiretoria()) {
      return ['TODAS', ...this.setores.atendem().map((setor) => setor.chave)];
    }
    const area = this.sessao.area();
    return this.sessao.ehLider() && area && area !== SETOR_MARKETING ? [area] : [];
  });
  protected readonly podeCriar = computed(() => this.areasPermitidas().length > 0);

  protected readonly filtrando = computed(
    () => this.busca().trim() !== '' || this.area() !== 'TODAS',
  );

  protected readonly respostas = computed<readonly RespostaRapida[]>(() => {
    const termo = simplificar(this.busca().trim());
    const area = this.area();
    return (this.dados.dados() ?? []).filter((resposta) => {
      if (!this.incluirInativas() && !resposta.ativa) {
        return false;
      }
      if (area === 'GLOBAL' && resposta.area !== null) {
        return false;
      }
      if (area !== 'TODAS' && area !== 'GLOBAL' && resposta.area !== area) {
        return false;
      }
      if (!termo) {
        return true;
      }
      return [resposta.atalho, resposta.titulo, resposta.texto].some((campo) =>
        simplificar(campo).includes(termo),
      );
    });
  });

  constructor() {
    void this.setores.carregar();
    this.carregar();
    void this.api
      .variaveis()
      .then((variaveis) => this.variaveis.set(variaveis))
      .catch(() => this.variaveis.set([]));
  }

  protected carregar(): void {
    void this.dados.executar(() =>
      this.api.listarRespostas({ incluirInativas: this.podeCriar() || undefined }),
    );
  }

  protected buscar(termo: string): void {
    this.busca.set(termo);
  }

  protected mudarArea(area: string | null): void {
    this.area.set((area as FiltroArea | null) ?? 'TODAS');
  }

  protected mudarInativas(incluir: boolean): void {
    this.incluirInativas.set(incluir);
  }

  protected limparFiltros(): void {
    this.busca.set('');
    this.area.set('TODAS');
  }

  protected rotuloArea(area: Area | null): string {
    return area ? rotuloDaArea(area) : 'Todos os setores';
  }

  private motivoSemEdicao(resposta: RespostaRapida): string {
    return resposta.area
      ? `Só Admin, C-level e o líder de ${this.rotuloArea(resposta.area)} alteram.`
      : 'Só Admin e C-level alteram as respostas de todos os setores.';
  }

  protected acoesDa(resposta: RespostaRapida): readonly ItemMenuAcoes[] {
    const motivo = resposta.podeEditar ? undefined : this.motivoSemEdicao(resposta);
    return [
      {
        id: 'editar',
        rotulo: 'Editar',
        icone: LucidePencil,
        desabilitado: !resposta.podeEditar,
        motivo,
      },
      resposta.ativa
        ? {
            id: 'desativar',
            rotulo: 'Desativar',
            icone: LucidePowerOff,
            desabilitado: !resposta.podeEditar,
            motivo,
          }
        : {
            id: 'ativar',
            rotulo: 'Ativar',
            icone: LucidePower,
            desabilitado: !resposta.podeEditar,
            motivo,
          },
      {
        id: 'excluir',
        rotulo: 'Excluir',
        icone: LucideTrash,
        perigo: true,
        separarAntes: true,
        desabilitado: !resposta.podeEditar,
        motivo,
      },
    ];
  }

  protected abrirFormulario(resposta: RespostaRapida | null): void {
    if (resposta && !resposta.podeEditar) {
      this.avisos.info(this.motivoSemEdicao(resposta));
      return;
    }
    this.formulario.set(resposta ? { modo: 'editar', resposta } : { modo: 'criar' });
  }

  protected respostaSalva(resposta: RespostaRapida): void {
    this.substituir(resposta);
  }

  protected agir(resposta: RespostaRapida, acao: string): void {
    switch (acao) {
      case 'editar':
        this.abrirFormulario(resposta);
        return;
      case 'ativar':
      case 'desativar':
        void this.definirAtiva(resposta, acao === 'ativar');
        return;
      case 'excluir':
        void this.excluir(resposta);
        return;
    }
  }

  private async definirAtiva(
    resposta: RespostaRapida,
    ativa: boolean,
    desfazendo = false,
  ): Promise<void> {
    try {
      const salva = await this.api.atualizarResposta(resposta.id, { ativa });
      this.substituir(salva);
      this.avisos.sucesso(
        ativa
          ? `“/${salva.atalho}” ativada.`
          : `“/${salva.atalho}” desativada: some do “/” no Atendimento.`,
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

  private async excluir(resposta: RespostaRapida): Promise<void> {
    const ok = await this.confirmacao.confirmar({
      titulo: `Excluir a resposta “/${resposta.atalho}”?`,
      mensagem:
        'Ela sai do “/” no Atendimento para todo mundo. As mensagens já enviadas com ela não mudam. Para só esconder, use “Desativar”.',
      confirmar: 'Excluir resposta',
      perigo: true,
      executar: () => this.api.excluirResposta(resposta.id),
    });
    if (ok) {
      this.dados.definir((this.dados.dados() ?? []).filter((item) => item.id !== resposta.id));
      this.avisos.sucesso(`Resposta “/${resposta.atalho}” excluída.`);
    }
  }

  private substituir(resposta: RespostaRapida): void {
    const lista = this.dados.dados() ?? [];
    const existe = lista.some((item) => item.id === resposta.id);
    const nova = existe
      ? lista.map((item) => (item.id === resposta.id ? resposta : item))
      : [...lista, resposta];
    this.dados.definir([...nova].sort((a, b) => a.atalho.localeCompare(b.atalho, 'pt-BR')));
  }
}
