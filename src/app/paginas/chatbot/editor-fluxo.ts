import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideCopy,
  LucideFlaskConical,
  LucidePause,
  LucidePlay,
  LucideRefreshCw,
  LucideRocket,
  LucideTrash2,
} from '@lucide/angular';

import { AvisosService } from '../../nucleo/avisos.service';
import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { formatarDataHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { Alternador } from '../../ui/alternador/alternador';
import { Botao } from '../../ui/botao/botao';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { type ItemMenuAcoes, MenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { Modal } from '../../ui/modal/modal';
import { PainelLateral } from '../../ui/painel-lateral/painel-lateral';
import { Selo } from '../../ui/selo/selo';
import { ArvorePassos } from './arvore-passos';
import { ChatbotApi } from './chatbot.api';
import {
  type FluxoDetalhe,
  type PassoDefinicao,
  type ProblemaDefinicao,
  ROTULO_GATILHO,
} from './chatbot.tipos';
import { ContextoEditor } from './contexto-editor';
import { contarPassos, problemasDaArvore, textoParaLista, variaveisDoFluxo } from './definicao';
import { DADOS_PADRAO, type DadosDoFluxo, FormularioFluxo } from './formulario-fluxo';
import { HistoricoFluxo } from './historico-fluxo';
import { SimuladorFluxo } from './simulador';
import { VersoesFluxo } from './versoes-fluxo';

type EstadoSalvamento = 'salvo' | 'pendente' | 'salvando' | 'erro';

const ABAS: readonly ItemAba[] = [
  { id: 'passos', rotulo: 'Passos' },
  { id: 'configuracao', rotulo: 'Configuração' },
  { id: 'versoes', rotulo: 'Versões' },
  { id: 'historico', rotulo: 'Histórico' },
];

const ESPERA_PARA_SALVAR_MS = 1500;

/**
 * Editor de um fluxo (`/chatbot/:id`): passos em lista, configuração, versões e histórico, com
 * o simulador num painel lateral. O rascunho é salvo sozinho; publicar cria uma versão nova e
 * só ela atende clientes.
 */
@Component({
  selector: 'app-editor-fluxo',
  imports: [
    Abas,
    Alternador,
    ArvorePassos,
    Botao,
    Esqueleto,
    EstadoVazio,
    FormularioFluxo,
    HistoricoFluxo,
    MenuAcoes,
    Modal,
    PainelLateral,
    RouterLink,
    Selo,
    SimuladorFluxo,
    VersoesFluxo,
  ],
  providers: [ContextoEditor],
  templateUrl: './editor-fluxo.html',
  styleUrl: './editor-fluxo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorFluxo {
  private readonly api = inject(ChatbotApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly contexto = inject(ContextoEditor);
  private readonly rota = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly id = this.rota.snapshot.paramMap.get('id') ?? '';
  protected readonly abas = ABAS;
  protected readonly iconeVoltar = LucideArrowLeft;
  protected readonly iconeTestar = LucideFlaskConical;
  protected readonly iconePublicar = LucideRocket;
  protected readonly iconeTentar = LucideRefreshCw;

  protected readonly fluxo = signal<FluxoDetalhe | null>(null);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly passos = signal<readonly PassoDefinicao[]>([]);
  protected readonly aba = signal<string | null>('passos');
  protected readonly estadoSalvamento = signal<EstadoSalvamento>('salvo');
  protected readonly salvoEm = signal<string | null>(null);
  protected readonly problemasDaApi = signal<readonly ProblemaDefinicao[]>([]);
  protected readonly validando = signal(false);
  protected readonly publicando = signal(false);
  protected readonly publicarAberto = signal(false);
  protected readonly ligarAoPublicar = signal(true);
  protected readonly testeAberto = signal(false);
  protected readonly dados = signal<DadosDoFluxo>(DADOS_PADRAO);
  protected readonly errosDaConfiguracao = signal<Record<string, string>>({});
  protected readonly salvandoConfiguracao = signal(false);

  private readonly arvore = viewChild(ArvorePassos);
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private fila: Promise<boolean> = Promise.resolve(true);
  private versaoLocal = 0;
  private versaoSalva = 0;

  protected readonly podeEditar = computed(() => this.fluxo()?.podeEditar === true);
  protected readonly gatilho = computed(() => {
    const f = this.fluxo();
    return f ? ROTULO_GATILHO[f.gatilho] : '';
  });
  protected readonly faltando = computed(() => problemasDaArvore(this.passos()));
  protected readonly totalFaltando = computed(() => this.faltando().size);
  protected readonly total = computed(() => contarPassos(this.passos()));
  protected readonly mapaDaApi = computed(() => {
    const mapa = new Map<string, string[]>();
    for (const p of this.problemasDaApi()) {
      if (p.passoId) {
        mapa.set(p.passoId, [...(mapa.get(p.passoId) ?? []), p.mensagem]);
      }
    }
    return mapa;
  });
  protected readonly textoSalvamento = computed(() => {
    switch (this.estadoSalvamento()) {
      case 'salvando':
        return 'Salvando…';
      case 'pendente':
        return 'Alterações ainda não salvas';
      case 'erro':
        return 'Não foi possível salvar';
      default:
        return this.salvoEm()
          ? `Rascunho salvo ${formatarTempoRelativo(this.salvoEm()!)}`
          : 'Rascunho salvo';
    }
  });
  protected readonly acoes = computed<readonly ItemMenuAcoes[]>(() => {
    const f = this.fluxo();
    if (!f) {
      return [];
    }
    const semEdicao = f.podeEditar ? undefined : 'Só quem cuida da área edita este fluxo.';
    return [
      f.ativo
        ? {
            id: 'desligar',
            rotulo: 'Desligar o fluxo',
            icone: LucidePause,
            desabilitado: !f.podeEditar,
            motivo: semEdicao,
          }
        : {
            id: 'ligar',
            rotulo: 'Ligar o fluxo',
            icone: LucidePlay,
            desabilitado: !f.podeEditar || !f.versaoPublicada,
            motivo: !f.podeEditar
              ? semEdicao
              : !f.versaoPublicada
                ? 'Publique o fluxo antes de ligar.'
                : undefined,
          },
      {
        id: 'duplicar',
        rotulo: 'Duplicar',
        icone: LucideCopy,
        desabilitado: !f.podeEditar,
        motivo: semEdicao,
      },
      {
        id: 'excluir',
        rotulo: 'Excluir',
        icone: LucideTrash2,
        perigo: true,
        desabilitado: !f.podeEditar,
        motivo: semEdicao,
      },
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.temporizador);
      if (this.versaoLocal !== this.versaoSalva) {
        void this.salvarAgora();
      }
    });
    void this.carregar();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected aoSair(evento: BeforeUnloadEvent): void {
    if (this.versaoLocal !== this.versaoSalva) {
      evento.preventDefault();
    }
  }

  protected async carregar(): Promise<void> {
    this.erro.set(null);
    try {
      const [fluxo, catalogo] = await Promise.all([this.api.obter(this.id), this.api.catalogo()]);
      this.contexto.catalogo.set(catalogo);
      this.aplicarFluxo(fluxo, true);
      void this.contexto.carregarApoio();
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    }
  }

  private aplicarFluxo(fluxo: FluxoDetalhe, trocarPassos: boolean): void {
    this.fluxo.set(fluxo);
    this.dados.set({
      nome: fluxo.nome,
      descricao: fluxo.descricao ?? '',
      gatilho: fluxo.gatilho,
      palavrasChave: fluxo.palavrasChave.join(', '),
      prioridade: fluxo.prioridade,
      canalIds: fluxo.canalIds,
    });
    this.ligarAoPublicar.set(fluxo.ativo || !fluxo.versaoPublicada);
    if (trocarPassos) {
      this.definirPassos(fluxo.rascunho.passos);
      this.versaoLocal = 0;
      this.versaoSalva = 0;
      this.estadoSalvamento.set('salvo');
      this.salvoEm.set(fluxo.rascunhoAlteradoEm);
      this.problemasDaApi.set([]);
    }
  }

  private definirPassos(lista: readonly PassoDefinicao[]): void {
    this.passos.set(lista);
    this.contexto.variaveis.set(variaveisDoFluxo(lista));
    this.contexto.totalDePassos.set(contarPassos(lista));
  }

  // ----- rascunho -----

  protected aoMudarPassos(lista: readonly PassoDefinicao[]): void {
    this.definirPassos(lista);
    this.versaoLocal++;
    this.estadoSalvamento.set('pendente');
    if (this.problemasDaApi().length > 0) {
      this.problemasDaApi.set([]);
    }
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.salvarAgora(), ESPERA_PARA_SALVAR_MS);
  }

  /** Salva o que estiver pendente (uma gravação por vez); `false` se não deu. */
  protected salvarAgora = (): Promise<boolean> => {
    clearTimeout(this.temporizador);
    this.fila = this.fila.then(() => this.enviar());
    return this.fila;
  };

  private async enviar(): Promise<boolean> {
    if (this.versaoLocal === this.versaoSalva) {
      return this.estadoSalvamento() !== 'erro';
    }
    const versao = this.versaoLocal;
    this.estadoSalvamento.set('salvando');
    try {
      const fluxo = await this.api.salvarRascunho(this.id, {
        passos: [...this.passos()] as PassoDefinicao[],
      });
      this.versaoSalva = versao;
      this.fluxo.set(fluxo);
      this.salvoEm.set(fluxo.rascunhoAlteradoEm);
      if (this.versaoLocal === versao) {
        this.estadoSalvamento.set('salvo');
      } else {
        this.estadoSalvamento.set('pendente');
        this.temporizador = setTimeout(() => void this.salvarAgora(), ESPERA_PARA_SALVAR_MS);
      }
      return true;
    } catch (falha) {
      this.estadoSalvamento.set('erro');
      this.avisos.erro(erroDaApi(falha));
      return false;
    }
  }

  // ----- validar e publicar -----

  protected async validar(): Promise<void> {
    this.validando.set(true);
    try {
      if (!(await this.salvarAgora())) {
        return;
      }
      const resultado = await this.api.validar(this.id);
      this.problemasDaApi.set(resultado.problemas);
      if (resultado.valido) {
        this.avisos.sucesso('Tudo certo: o fluxo pode ser publicado.');
      } else {
        this.aba.set('passos');
      }
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.validando.set(false);
    }
  }

  protected async abrirPublicar(): Promise<void> {
    if (!(await this.salvarAgora())) {
      return;
    }
    this.publicarAberto.set(true);
  }

  protected async publicar(): Promise<void> {
    this.publicando.set(true);
    try {
      const fluxo = await this.api.publicar(this.id, this.ligarAoPublicar());
      this.aplicarFluxo(fluxo, false);
      this.problemasDaApi.set([]);
      this.publicarAberto.set(false);
      this.avisos.sucesso(
        fluxo.ativo
          ? `Versão ${fluxo.versaoPublicada?.numero} publicada. O fluxo já atende as conversas novas.`
          : `Versão ${fluxo.versaoPublicada?.numero} publicada. O fluxo continua desligado.`,
      );
    } catch (falha) {
      const erro = erroDaApi(falha);
      const problemas = erro.detalhes?.['problemas'];
      this.publicarAberto.set(false);
      if (erro.status === 400 && Array.isArray(problemas)) {
        this.problemasDaApi.set(problemas as ProblemaDefinicao[]);
        this.aba.set('passos');
        this.avisos.erro(erro);
      } else {
        this.avisos.erro(erro);
      }
    } finally {
      this.publicando.set(false);
    }
  }

  protected irAoPasso(problema: ProblemaDefinicao): void {
    if (problema.passoId) {
      this.arvore()?.revelar(problema.passoId);
    }
  }

  // ----- configuração, versões, ações -----

  protected async salvarConfiguracao(evento: Event): Promise<void> {
    evento.preventDefault();
    const d = this.dados();
    const palavras = textoParaLista(d.palavrasChave);
    const erros: Record<string, string> = {};
    if (!d.nome.trim()) {
      erros['nome'] = 'Dê um nome ao fluxo.';
    }
    if (d.gatilho === 'PALAVRA_CHAVE' && palavras.length === 0) {
      erros['palavrasChave'] = 'Informe ao menos uma palavra.';
    }
    this.errosDaConfiguracao.set(erros);
    if (Object.keys(erros).length > 0) {
      return;
    }
    this.salvandoConfiguracao.set(true);
    try {
      const fluxo = await this.api.alterar(this.id, {
        nome: d.nome.trim(),
        descricao: d.descricao.trim(),
        gatilho: d.gatilho,
        palavrasChave: d.gatilho === 'PALAVRA_CHAVE' ? palavras : [],
        prioridade: d.prioridade,
        canalIds: [...d.canalIds],
      });
      this.aplicarFluxo(fluxo, false);
      this.avisos.sucesso('Configuração salva. Ela vale já para as conversas novas.');
    } catch (falha) {
      const erro = erroDaApi(falha);
      if (erro.status === 400 && erro.campos.length > 0) {
        this.errosDaConfiguracao.set(
          Object.fromEntries(erro.campos.map((c) => [c.campo, c.mensagens[0]])),
        );
      } else {
        this.avisos.erro(erro);
      }
    } finally {
      this.salvandoConfiguracao.set(false);
    }
  }

  protected aoRestaurar(fluxo: FluxoDetalhe): void {
    this.aplicarFluxo(fluxo, true);
    this.aba.set('passos');
  }

  protected async executarAcao(item: ItemMenuAcoes): Promise<void> {
    const f = this.fluxo();
    if (!f) {
      return;
    }
    try {
      switch (item.id) {
        case 'ligar':
          this.aplicarFluxo(await this.api.ativar(this.id), false);
          this.avisos.sucesso('Fluxo ligado: atende as conversas novas.');
          break;
        case 'desligar':
          this.aplicarFluxo(await this.api.desativar(this.id), false);
          this.avisos.sucesso('Fluxo desligado. As conversas em andamento terminam normalmente.');
          break;
        case 'duplicar': {
          await this.salvarAgora();
          const copia = await this.api.duplicar(this.id);
          this.avisos.sucesso('Cópia criada, desligada e só com o rascunho.');
          await this.router
            .navigate(['/chatbot'])
            .then(() => this.router.navigate(['/chatbot', copia.id]));
          break;
        }
        case 'excluir': {
          const ok = await this.confirmacao.confirmar({
            titulo: `Excluir “${f.nome}”?`,
            mensagem:
              'O fluxo some da lista e as conversas que ele ainda atende deixam de ser atendidas pelo robô.',
            confirmar: 'Excluir fluxo',
            perigo: true,
            executar: () => this.api.excluir(this.id),
          });
          if (ok) {
            clearTimeout(this.temporizador);
            this.versaoSalva = this.versaoLocal;
            this.avisos.sucesso('Fluxo excluído.');
            await this.router.navigate(['/chatbot']);
          }
          break;
        }
      }
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    }
  }

  protected data(valor: string): string {
    return formatarDataHora(valor);
  }
}
