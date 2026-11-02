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
  LucideSend,
  LucideTrash2,
  LucideTriangleAlert,
} from '@lucide/angular';

import type { Pagina } from '../../nucleo/api/api';
import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { formatarDataHora } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { MenuAcoes, type ItemMenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { PainelLateral } from '../../ui/painel-lateral/painel-lateral';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { registrarAcaoPrincipal } from './comum/acao-da-secao';
import { ComoValidarAssinatura } from './como-validar-assinatura';
import { DetalheSaida, saudeDoDestino } from './detalhe-saida';
import { resultadoDaEntrega } from './entregas';
import { FormularioSaida } from './formulario-saida';
import { IntegracoesApi } from './integracoes.api';
import { ResultadoUnico, type ResultadoUnicoDados } from './resultado-unico';
import {
  rotuloDoEvento,
  TOTAL_EVENTOS_ASSINAVEIS,
  type WebhookSaida,
  type WebhookSaidaComSegredo,
} from './tipos';

const POR_PAGINA = 20;

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'nome', rotulo: 'Nome', noCartao: 'titulo' },
  { id: 'eventos', rotulo: 'Eventos' },
  { id: 'saude', rotulo: 'Saúde' },
  { id: 'status', rotulo: 'Status' },
  { id: 'acoes', rotulo: 'Ações', rotuloOculto: true, alinhar: 'fim', largura: '4rem', fixa: true },
];

/**
 * Webhooks de saída (`/integracoes/saida`, Admin) — TELAS-FASE1 §7, R9: a lista (nome, URL,
 * eventos, saúde), os destinos desativados automaticamente em destaque com o motivo, o
 * cadastro (o segredo aparece uma vez), "Enviar teste", o painel de cada destino
 * (`?webhookSaida=<id>`, o link das notificações) com as entregas, e como validar a
 * assinatura.
 */
@Component({
  selector: 'app-webhooks-saida',
  imports: [
    Botao,
    BotaoIcone,
    Cartao,
    EstadoVazio,
    Esqueleto,
    MenuAcoes,
    Paginacao,
    PainelLateral,
    Selo,
    Tabela,
    CelulaTabela,
    ComoValidarAssinatura,
    DetalheSaida,
    FormularioSaida,
    ResultadoUnico,
    LucideTriangleAlert,
  ],
  templateUrl: './webhooks-saida.html',
  styleUrl: './pagina-lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebhooksSaida {
  private readonly api = inject(IntegracoesApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly router = inject(Router);

  /** Destino a abrir (query `webhookSaida`, vinda das notificações). */
  readonly webhookSaida = input<string | null>(null);

  protected readonly colunas = COLUNAS;
  protected readonly porPagina = POR_PAGINA;
  protected readonly icones = { novo: LucidePlus, ativar: LucidePower, ver: LucideEye };
  protected readonly iconeTeste = LucideSend;

  protected readonly pagina = signal(1);
  protected readonly resposta = signal<Pagina<WebhookSaida> | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);

  protected readonly selecionado = signal<WebhookSaida | null>(null);
  protected readonly erroSelecionado = signal<ErroApi | null>(null);
  protected readonly abaDoPainel = signal<string | null>('entregas');
  protected readonly versaoEntregas = signal(0);
  protected readonly testando = signal<string | null>(null);

  protected readonly formularioAberto = signal(false);
  protected readonly emEdicao = signal<WebhookSaida | null>(null);
  protected readonly resultadoUnico = signal<ResultadoUnicoDados | null>(null);

  protected readonly itens = computed(() => this.resposta()?.itens ?? []);
  protected readonly total = computed(() => this.resposta()?.total ?? 0);
  /** Destinos desativados automaticamente (R9.4): ficam em destaque acima da lista. */
  protected readonly desativadosAutomaticamente = computed(() =>
    this.itens().filter((item) => !item.ativo && item.desativadoAutomaticamenteEm),
  );
  protected readonly painelAberto = computed(() => !!this.webhookSaida());
  protected readonly tituloPainel = computed(
    () => this.selecionado()?.nome ?? (this.erroSelecionado() ? 'Destino' : 'Carregando…'),
  );

  private versao = 0;

  constructor() {
    registrarAcaoPrincipal({
      rotulo: 'Novo webhook de saída',
      icone: LucidePlus,
      executar: () => this.novo(),
    });

    effect(() => {
      void this.pagina();
      untracked(() => void this.carregar());
    });

    effect(() => {
      const id = this.webhookSaida();
      untracked(() => void this.abrirSelecionado(id));
    });
  }

  // --- Lista ---------------------------------------------------------------------------------

  async carregar(): Promise<void> {
    const versao = ++this.versao;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const resposta = await this.api.listarSaidas({
        pagina: this.pagina(),
        porPagina: POR_PAGINA,
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

  protected eventos(w: WebhookSaida): string {
    if (w.eventos.length >= TOTAL_EVENTOS_ASSINAVEIS) {
      return 'Todos os eventos';
    }
    const rotulos = w.eventos.map((evento) => rotuloDoEvento(evento));
    return rotulos.length <= 2
      ? rotulos.join(' e ')
      : `${rotulos.slice(0, 2).join(', ')} e mais ${rotulos.length - 2}`;
  }

  protected saude(w: WebhookSaida) {
    return saudeDoDestino(w);
  }

  protected desativadoEm(w: WebhookSaida): string {
    return w.desativadoAutomaticamenteEm ? formatarDataHora(w.desativadoAutomaticamenteEm) : '';
  }

  protected acoesDe(w: WebhookSaida): readonly ItemMenuAcoes[] {
    return [
      { id: 'abrir', rotulo: 'Ver entregas', icone: LucideEye },
      { id: 'editar', rotulo: 'Editar', icone: LucidePencil },
      {
        id: 'testar',
        rotulo: 'Enviar teste',
        icone: LucideSend,
      },
      {
        id: w.ativo ? 'desativar' : 'ativar',
        rotulo: w.ativo ? 'Desativar' : 'Reativar',
        icone: LucidePower,
      },
      { id: 'segredo', rotulo: 'Gerar novo segredo', icone: LucideKeyRound, separarAntes: true },
      { id: 'excluir', rotulo: 'Excluir', icone: LucideTrash2, perigo: true, separarAntes: true },
    ];
  }

  protected agir(acao: string, w: WebhookSaida): void {
    switch (acao) {
      case 'abrir':
        this.abrir(w);
        break;
      case 'editar':
        this.editar(w);
        break;
      case 'testar':
        void this.testar(w);
        break;
      case 'ativar':
      case 'desativar':
        void this.alternarAtivo(w);
        break;
      case 'segredo':
        void this.gerarNovoSegredo(w);
        break;
      case 'excluir':
        void this.excluir(w);
        break;
    }
  }

  // --- Painel --------------------------------------------------------------------------------

  protected abrir(w: WebhookSaida, aba: 'entregas' | 'configuracao' = 'entregas'): void {
    this.abaDoPainel.set(aba);
    this.selecionado.set(w);
    void this.router.navigate([], {
      queryParams: { webhookSaida: w.id },
      queryParamsHandling: 'merge',
    });
  }

  protected fecharPainel(): void {
    if (!this.webhookSaida()) {
      return;
    }
    void this.router.navigate([], {
      queryParams: { webhookSaida: null },
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
      this.abaDoPainel.set('entregas');
    }
    try {
      const atual = await this.api.obterSaida(id);
      if (this.webhookSaida() === id) {
        this.selecionado.set(atual);
      }
    } catch (falha) {
      if (this.webhookSaida() === id) {
        this.erroSelecionado.set(erroDaApi(falha));
        this.selecionado.set(null);
      }
    }
  }

  // --- Ações ---------------------------------------------------------------------------------

  protected novo(): void {
    this.emEdicao.set(null);
    this.formularioAberto.set(true);
  }

  protected editar(w: WebhookSaida): void {
    this.emEdicao.set(w);
    this.formularioAberto.set(true);
  }

  protected aoCriar(criado: WebhookSaidaComSegredo): void {
    void this.carregar();
  }

  protected aoSalvar(salvo: WebhookSaida): void {
    this.atualizarNaTela(salvo);
  }

  /** "Enviar teste" (R9.5): manda `webhook.teste` agora e diz o que o destino respondeu. */
  protected async testar(w: WebhookSaida): Promise<void> {
    this.testando.set(w.id);
    try {
      const entrega = await this.api.testar(w.id);
      const resultado = resultadoDaEntrega(entrega);
      if (entrega.status === 'ENTREGUE') {
        this.avisos.sucesso(`Teste entregue a “${w.nome}”: ${resultado}.`);
      } else {
        this.avisos.atencao(`“${w.nome}” não aceitou o teste: ${resultado}.`, {
          titulo: 'O destino respondeu com erro',
        });
      }
      this.versaoEntregas.update((versao) => versao + 1);
      void this.recarregarDestino(w.id);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.testando.set(null);
    }
  }

  protected async alternarAtivo(w: WebhookSaida): Promise<void> {
    if (w.ativo) {
      const ok = await this.confirmacao.confirmar({
        titulo: `Desativar “${w.nome}”?`,
        mensagem:
          'Nenhum evento é enviado a este destino até você reativá-lo. As entregas pendentes não saem enquanto isso.',
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
      this.avisos.sucesso(
        w.desativadoAutomaticamenteEm
          ? `“${w.nome}” reativado: as falhas seguidas voltaram a zero.`
          : `“${w.nome}” reativado.`,
      );
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  protected async gerarNovoSegredo(w: WebhookSaida): Promise<void> {
    const caixa: { novo?: WebhookSaidaComSegredo } = {};
    const ok = await this.confirmacao.confirmar({
      titulo: `Gerar um novo segredo para “${w.nome}”?`,
      mensagem:
        'As próximas entregas passam a ser assinadas com o segredo novo. Atualize o sistema de destino logo em seguida, ou ele vai recusar as entregas.',
      confirmar: 'Gerar novo segredo',
      perigo: true,
      executar: async () => {
        caixa.novo = await this.api.regenerarSegredo(w.id);
      },
    });
    if (!ok || !caixa.novo) {
      return;
    }
    this.atualizarNaTela(caixa.novo.webhook);
    this.resultadoUnico.set({
      titulo: 'Segredo novo',
      texto:
        'Copie agora e atualize o sistema de destino: é a única vez que o segredo aparece. Ele assina o cabeçalho X-CRM-Assinatura de cada entrega.',
      valores: [{ rotulo: 'Segredo das assinaturas', valor: caixa.novo.segredo, oQue: 'Segredo' }],
    });
  }

  protected async excluir(w: WebhookSaida): Promise<void> {
    const ok = await this.confirmacao.confirmar({
      titulo: `Excluir “${w.nome}”?`,
      mensagem:
        'O destino deixa de receber eventos e sai da lista. As entregas pendentes não serão enviadas.',
      confirmar: 'Excluir destino',
      perigo: true,
      exigirTexto: w.nome,
      rotuloTexto: 'Digite o nome do destino para confirmar',
      executar: () => this.api.excluirSaida(w.id),
    });
    if (!ok) {
      return;
    }
    this.avisos.sucesso(`Destino “${w.nome}” excluído.`);
    if (this.webhookSaida() === w.id) {
      this.fecharPainel();
    }
    void this.carregar();
  }

  private async salvarAtivo(w: WebhookSaida, ativo: boolean): Promise<void> {
    const salvo = await this.api.atualizarSaida(w.id, { ativo });
    this.atualizarNaTela(salvo);
  }

  private async recarregarDestino(id: string): Promise<void> {
    try {
      this.atualizarNaTela(await this.api.obterSaida(id));
    } catch {
      // A lista continua como estava; o próximo carregamento corrige.
    }
  }

  private atualizarNaTela(w: WebhookSaida): void {
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
