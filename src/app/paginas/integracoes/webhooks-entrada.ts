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
import { Router } from '@angular/router';
import {
  LucideEye,
  LucideKeyRound,
  LucidePencil,
  LucidePlus,
  LucidePower,
  LucideRefreshCw,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';

import type { Pagina } from '../../nucleo/api/api';
import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { formatarDataHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { MenuAcoes, type ItemMenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { PainelLateral } from '../../ui/painel-lateral/painel-lateral';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { AssistenteEntrada } from './assistente-entrada';
import { registrarAcaoPrincipal } from './comum/acao-da-secao';
import { DetalheEntrada } from './detalhe-entrada';
import { exemploCurlEntrada } from './exemplos';
import { IntegracoesApi } from './integracoes.api';
import { ModalSegredoEntrada } from './modal-segredo-entrada';
import { ResultadoUnico, type ResultadoUnicoDados } from './resultado-unico';
import {
  fimDoEndereco,
  ROTULO_ESTRATEGIA,
  type WebhookEntrada,
  type WebhookEntradaCriado,
} from './tipos';

const POR_PAGINA = 20;

const FILTROS: readonly OpcaoFiltro[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'ativos', rotulo: 'Ativos' },
  { id: 'desativados', rotulo: 'Desativados' },
];

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'nome', rotulo: 'Nome', noCartao: 'titulo' },
  { id: 'destino', rotulo: 'Entra em' },
  { id: 'distribuicao', rotulo: 'Quem fica com o lead' },
  { id: 'ultimo', rotulo: 'Último recebimento' },
  { id: 'recebimentos', rotulo: 'Últimas 24 h' },
  { id: 'status', rotulo: 'Status' },
  { id: 'acoes', rotulo: 'Ações', rotuloOculto: true, alinhar: 'fim', largura: '4rem', fixa: true },
];

/**
 * Webhooks de entrada (`/integracoes/entrada`, Admin) — TELAS-FASE1 §7, R8: a lista (nome,
 * funil/etapa, último recebimento, status), o assistente de criação em passos, e o painel de
 * cada webhook (`?webhook=<id>`) com os recebimentos e a configuração. Ações: editar,
 * ativar/desativar, gerar novo endereço, exigir/trocar/remover a assinatura e excluir.
 */
@Component({
  selector: 'app-webhooks-entrada',
  imports: [
    Botao,
    Cartao,
    EstadoVazio,
    Esqueleto,
    FiltrosPilula,
    MenuAcoes,
    Paginacao,
    PainelLateral,
    Selo,
    Tabela,
    CelulaTabela,
    AssistenteEntrada,
    DetalheEntrada,
    ModalSegredoEntrada,
    ResultadoUnico,
  ],
  templateUrl: './webhooks-entrada.html',
  styleUrl: './pagina-lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebhooksEntrada {
  private readonly api = inject(IntegracoesApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly router = inject(Router);

  /** Webhook aberto no painel (query `webhook`). */
  readonly webhook = input<string | null>(null);

  protected readonly colunas = COLUNAS;
  protected readonly fimDoEndereco = fimDoEndereco;
  protected readonly filtros = FILTROS;
  protected readonly porPagina = POR_PAGINA;
  protected readonly iconeNovo = LucidePlus;

  protected readonly filtro = signal<string | null>('todos');
  protected readonly pagina = signal(1);
  protected readonly resposta = signal<Pagina<WebhookEntrada> | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);

  protected readonly selecionado = signal<WebhookEntrada | null>(null);
  protected readonly erroSelecionado = signal<ErroApi | null>(null);
  protected readonly abaDoPainel = signal<string | null>('recebimentos');

  protected readonly assistenteAberto = signal(false);
  protected readonly emEdicao = signal<WebhookEntrada | null>(null);
  protected readonly alvoDoSegredo = signal<WebhookEntrada | null>(null);
  protected readonly resultadoUnico = signal<ResultadoUnicoDados | null>(null);

  protected readonly itens = computed(() => this.resposta()?.itens ?? []);
  protected readonly total = computed(() => this.resposta()?.total ?? 0);
  protected readonly filtrado = computed(() => (this.filtro() ?? 'todos') !== 'todos');
  protected readonly painelAberto = computed(() => !!this.webhook());
  protected readonly tituloPainel = computed(
    () => this.selecionado()?.nome ?? (this.erroSelecionado() ? 'Webhook' : 'Carregando…'),
  );
  protected readonly descricaoPainel = computed(() => {
    const w = this.selecionado();
    if (!w) {
      return null;
    }
    const quem =
      w.estrategia === 'RESPONSAVEL_FIXO' && w.responsavelFixo
        ? `responsável fixo: ${w.responsavelFixo.nome}`
        : w.estrategia === 'LIDER_DA_AREA'
          ? 'líder da área'
          : 'rodízio da área';
    return `${w.funil.nome} · ${w.etapa.nome} — ${quem}`;
  });

  private versao = 0;

  constructor() {
    registrarAcaoPrincipal({
      rotulo: 'Novo webhook de entrada',
      icone: LucidePlus,
      executar: () => this.novo(),
    });

    effect(() => {
      void [this.filtro(), this.pagina()];
      untracked(() => void this.carregar());
    });

    // Painel: abre com `?webhook=<id>` (link direto ou clique na linha).
    effect(() => {
      const id = this.webhook();
      untracked(() => void this.abrirSelecionado(id));
    });
  }

  // --- Lista ---------------------------------------------------------------------------------

  async carregar(): Promise<void> {
    const versao = ++this.versao;
    const filtro = this.filtro() ?? 'todos';
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const resposta = await this.api.listarEntradas({
        pagina: this.pagina(),
        porPagina: POR_PAGINA,
        ativo: filtro === 'todos' ? undefined : filtro === 'ativos',
      });
      if (versao === this.versao) {
        this.resposta.set(resposta);
      }
    } catch (falha) {
      if (versao === this.versao) {
        this.erro.set(erroDaApi(falha));
      }
    } finally {
      if (versao === this.versao) {
        this.carregando.set(false);
      }
    }
  }

  protected escolherFiltro(id: string | null): void {
    this.filtro.set(id ?? 'todos');
    this.pagina.set(1);
  }

  protected distribuicao(w: WebhookEntrada): string {
    return w.estrategia === 'RESPONSAVEL_FIXO' && w.responsavelFixo
      ? `Fixo: ${w.responsavelFixo.nome}`
      : ROTULO_ESTRATEGIA[w.estrategia];
  }

  protected ultimo(w: WebhookEntrada): string {
    return w.ultimoRecebimentoEm ? formatarTempoRelativo(w.ultimoRecebimentoEm) : 'Nunca';
  }

  protected ultimoCompleto(w: WebhookEntrada): string | null {
    return w.ultimoRecebimentoEm ? formatarDataHora(w.ultimoRecebimentoEm) : null;
  }

  protected acoesDe(w: WebhookEntrada): readonly ItemMenuAcoes[] {
    return [
      { id: 'abrir', rotulo: 'Ver recebimentos', icone: LucideEye },
      { id: 'editar', rotulo: 'Editar', icone: LucidePencil },
      {
        id: w.ativo ? 'desativar' : 'ativar',
        rotulo: w.ativo ? 'Desativar' : 'Ativar',
        icone: LucidePower,
      },
      { id: 'endereco', rotulo: 'Gerar novo endereço', icone: LucideRefreshCw, separarAntes: true },
      {
        id: 'segredo',
        rotulo: w.exigeAssinatura ? 'Trocar o segredo' : 'Exigir assinatura',
        icone: LucideKeyRound,
      },
      ...(w.exigeAssinatura
        ? [{ id: 'sem-segredo', rotulo: 'Deixar de exigir assinatura', icone: LucideX }]
        : []),
      { id: 'excluir', rotulo: 'Excluir', icone: LucideTrash2, perigo: true, separarAntes: true },
    ];
  }

  protected agir(acao: string, w: WebhookEntrada): void {
    switch (acao) {
      case 'abrir':
        this.abrir(w, 'recebimentos');
        break;
      case 'editar':
        this.editar(w);
        break;
      case 'ativar':
      case 'desativar':
        void this.alternarAtivo(w);
        break;
      case 'endereco':
        void this.gerarNovoEndereco(w);
        break;
      case 'segredo':
        this.alvoDoSegredo.set(w);
        break;
      case 'sem-segredo':
        void this.removerSegredo(w);
        break;
      case 'excluir':
        void this.excluir(w);
        break;
    }
  }

  // --- Painel --------------------------------------------------------------------------------

  protected abrir(w: WebhookEntrada, aba: 'recebimentos' | 'configuracao' = 'recebimentos'): void {
    this.abaDoPainel.set(aba);
    this.selecionado.set(w);
    void this.router.navigate([], {
      queryParams: { webhook: w.id },
      queryParamsHandling: 'merge',
    });
  }

  protected fecharPainel(): void {
    if (!this.webhook()) {
      return;
    }
    void this.router.navigate([], {
      queryParams: { webhook: null },
      queryParamsHandling: 'merge',
    });
  }

  private async abrirSelecionado(id: string | null): Promise<void> {
    this.erroSelecionado.set(null);
    if (!id) {
      this.selecionado.set(null);
      return;
    }
    if (this.selecionado()?.id !== id) {
      this.selecionado.set(this.itens().find((item) => item.id === id) ?? null);
    }
    try {
      const atual = await this.api.obterEntrada(id);
      if (this.webhook() === id) {
        this.selecionado.set(atual);
      }
    } catch (falha) {
      if (this.webhook() === id) {
        this.erroSelecionado.set(erroDaApi(falha));
        this.selecionado.set(null);
      }
    }
  }

  // --- Ações ---------------------------------------------------------------------------------

  protected novo(): void {
    this.emEdicao.set(null);
    this.assistenteAberto.set(true);
  }

  protected editar(w: WebhookEntrada): void {
    this.emEdicao.set(w);
    this.assistenteAberto.set(true);
  }

  protected aoCriar(criado: WebhookEntradaCriado): void {
    void this.carregar();
  }

  protected aoSalvar(salvo: WebhookEntrada): void {
    this.atualizarNaTela(salvo);
  }

  protected verRecebimentos(w: WebhookEntrada): void {
    this.abrir(w, 'recebimentos');
  }

  protected async alternarAtivo(w: WebhookEntrada): Promise<void> {
    if (w.ativo) {
      const ok = await this.confirmacao.confirmar({
        titulo: `Desativar “${w.nome}”?`,
        mensagem:
          'O endereço passa a responder 410 e nada do que chegar é registrado, até você ativar de novo.',
        confirmar: 'Desativar',
        perigo: true,
        executar: () => this.salvarAtivo(w, false),
      });
      if (ok) {
        this.avisos.sucesso(`“${w.nome}” desativado.`);
      }
      return;
    }
    try {
      await this.salvarAtivo(w, true);
      this.avisos.sucesso(`“${w.nome}” ativado: o endereço volta a receber leads.`);
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  protected async gerarNovoEndereco(w: WebhookEntrada): Promise<void> {
    const caixa: { novo?: { webhook: WebhookEntrada; url: string } } = {};
    const ok = await this.confirmacao.confirmar({
      titulo: `Gerar um novo endereço para “${w.nome}”?`,
      mensagem:
        'O endereço atual para de funcionar na hora (responde 404). Atualize o sistema que envia com o endereço novo.',
      confirmar: 'Gerar novo endereço',
      perigo: true,
      executar: async () => {
        caixa.novo = await this.api.regenerarToken(w.id);
      },
    });
    const gerado = caixa.novo;
    if (!ok || !gerado) {
      return;
    }
    this.atualizarNaTela(gerado.webhook);
    this.resultadoUnico.set({
      titulo: 'Endereço novo',
      texto:
        'Copie agora: é a única vez que o endereço completo aparece. O anterior já não funciona.',
      valores: [{ rotulo: 'Endereço do webhook', valor: gerado.url, oQue: 'Endereço' }],
      exemplo: {
        rotulo: 'Teste com curl',
        codigo: exemploCurlEntrada(gerado.url, undefined, {
          exige: gerado.webhook.exigeAssinatura,
        }),
      },
    });
  }

  protected aoDefinirSegredo(resposta: { webhook: WebhookEntrada; segredo?: string }): void {
    this.atualizarNaTela(resposta.webhook);
    if (resposta.segredo) {
      this.resultadoUnico.set({
        titulo: 'Segredo da assinatura',
        texto:
          'Copie agora e configure no sistema que envia: é a única vez que o segredo aparece. Toda chamada precisa do cabeçalho X-Assinatura com o HMAC-SHA256 do corpo.',
        valores: [{ rotulo: 'Segredo', valor: resposta.segredo, oQue: 'Segredo' }],
      });
    }
  }

  protected async removerSegredo(w: WebhookEntrada): Promise<void> {
    const caixa: { atualizado?: WebhookEntrada } = {};
    const ok = await this.confirmacao.confirmar({
      titulo: `Deixar de exigir assinatura em “${w.nome}”?`,
      mensagem:
        'O segredo é apagado e as chamadas passam a ser aceitas sem o cabeçalho X-Assinatura.',
      confirmar: 'Deixar de exigir',
      perigo: true,
      executar: async () => {
        caixa.atualizado = await this.api.removerSegredo(w.id);
      },
    });
    if (ok && caixa.atualizado) {
      this.atualizarNaTela(caixa.atualizado);
      this.avisos.sucesso(`“${w.nome}” não exige mais assinatura.`);
    }
  }

  protected async excluir(w: WebhookEntrada): Promise<void> {
    const ok = await this.confirmacao.confirmar({
      titulo: `Excluir “${w.nome}”?`,
      mensagem:
        'O endereço passa a responder 404 e o webhook sai da lista. Os contatos e negócios que ele criou continuam no CRM.',
      confirmar: 'Excluir webhook',
      perigo: true,
      exigirTexto: w.nome,
      rotuloTexto: 'Digite o nome do webhook para confirmar',
      executar: () => this.api.excluirEntrada(w.id),
    });
    if (!ok) {
      return;
    }
    this.avisos.sucesso(`Webhook “${w.nome}” excluído.`);
    if (this.webhook() === w.id) {
      this.fecharPainel();
    }
    void this.carregar();
  }

  private async salvarAtivo(w: WebhookEntrada, ativo: boolean): Promise<void> {
    const salvo = await this.api.atualizarEntrada(w.id, { ativo });
    this.atualizarNaTela(salvo);
  }

  /** Troca o webhook na lista e no painel, sem recarregar tudo. */
  private atualizarNaTela(w: WebhookEntrada): void {
    this.resposta.update((resposta) =>
      resposta
        ? { ...resposta, itens: resposta.itens.map((item) => (item.id === w.id ? w : item)) }
        : resposta,
    );
    if (this.selecionado()?.id === w.id) {
      this.selecionado.set(w);
    }
  }
}
