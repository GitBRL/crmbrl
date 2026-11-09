import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideTriangleAlert } from '@lucide/angular';

import { ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { formatarData } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { CampoTexto, type ValorCampoTexto } from '../../ui/campo-texto/campo-texto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { Selo, type VarianteSelo } from '../../ui/selo/selo';
import { AppsDeLoginApi } from '../configuracoes/apps-de-login/apps-de-login.api';
import { type ContextoDoLogin } from './facebook.tipos';
import { EsperaDoLogin } from './login/espera-do-login';
import { LoginJanela, type ResultadoDaJanela } from './login/login-janela';
import { ConexoesAplicativoApi } from './login/conexoes-aplicativo.api';
import {
  type AplicativoDeConexao,
  type ConexaoAplicativo,
  motivoDoLogin,
  NOME_DO_SERVICO,
  type PendenciaDeRemocao,
  pendenciasDoErro,
  type RetornoDoLogin,
  SERVICO_DO_APLICATIVO,
} from './login/login.tipos';

/** Entrar com o serviço (login em outra janela) ou o jeito antigo (token pessoal / endereço colado no RD). */
export type ModoDeConta = 'LOGIN' | 'MANUAL';

const TEXTOS: Readonly<
  Record<
    AplicativoDeConexao,
    {
      readonly titulo: string;
      readonly frase: string;
      readonly entrar: string;
      readonly opcoes: readonly OpcaoGrupo<ModoDeConta>[];
    }
  >
> = {
  TYPEFORM: {
    titulo: 'Conta do Typeform',
    frase:
      'Entre com o Typeform uma vez e o CRM lista os seus formulários e registra o webhook sozinho. Quem já entrou pode reaproveitar a conexão.',
    entrar: 'Entrar com o Typeform',
    opcoes: [
      {
        valor: 'LOGIN',
        rotulo: 'Entrar com o Typeform',
        dica: 'Abre o Typeform em outra janela para você autorizar e volta para cá.',
      },
      {
        valor: 'MANUAL',
        rotulo: 'Colar um token pessoal',
        dica: 'Para quem já tem um token pessoal do Typeform. Você cola no próximo passo.',
      },
    ],
  },
  RD_STATION: {
    titulo: 'Conta do RD Station',
    frase:
      'Entre com o RD Station e o CRM cria o webhook lá, escolhe o gatilho e busca os campos de contato. Sem copiar nenhum endereço.',
    entrar: 'Entrar com o RD Station',
    opcoes: [
      {
        valor: 'LOGIN',
        rotulo: 'Entrar com o RD Station (o CRM cria o webhook sozinho)',
        dica: 'Abre o RD Station em outra janela para você autorizar e volta para cá.',
      },
      {
        valor: 'MANUAL',
        rotulo: 'Colar o endereço no RD (manual)',
        dica: 'Você copia o endereço da integração e cola na automação do RD Station, como antes.',
      },
    ],
  },
};

/**
 * Passo "Conta" do assistente do Typeform e do RD Station (R32.25 e R32.26): a lista das conexões
 * por login (para reaproveitar, com "Conectar de novo"), "Entrar com o …" numa outra janela
 * (`LoginJanela`) e a alternativa manual. O app é o cadastrado em Configurações > Apps de login.
 * A conexão escolhida sobe em `escolhida`; o modo, em `modo`.
 */
@Component({
  selector: 'app-passo-conta-login',
  imports: [
    Botao,
    CampoTexto,
    EsperaDoLogin,
    EstadoVazio,
    Esqueleto,
    GrupoOpcoes,
    RouterLink,
    Selo,
    LucideTriangleAlert,
  ],
  templateUrl: './passo-conta-login.html',
  styleUrl: './passo-conexao-facebook.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PassoContaLogin {
  private readonly api = inject(ConexoesAplicativoApi);
  private readonly apps = inject(AppsDeLoginApi);
  private readonly login = inject(LoginJanela);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly avisos = inject(AvisosService);

  readonly aplicativo = input.required<AplicativoDeConexao>();
  /** Conexão já usada pela integração (ou a que acabou de voltar do login). */
  readonly selecionadaId = input<string | null>(null);
  /** O que o assistente estava fazendo, para voltar depois do login (pop-up bloqueado). */
  readonly contexto = input<ContextoDoLogin>({ integracaoId: null, nome: '' });
  /** O resultado do login quando a página voltou do serviço (pop-up bloqueado: mesma aba). */
  readonly retorno = input<RetornoDoLogin | null>(null);
  readonly modo = model<ModoDeConta>('LOGIN');
  readonly escolhida = output<ConexaoAplicativo | null>();

  protected readonly formatarData = formatarData;
  protected readonly conexoes = signal<readonly ConexaoAplicativo[] | null>(null);
  protected readonly appCadastrado = signal<boolean | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly marcada = signal<string | null>(null);
  protected readonly ocupada = signal<string | null>(null);
  /** Por que a última remoção não aconteceu (conexão em uso, falha da API). */
  protected readonly erroDaRemocao = signal<string | null>(null);
  protected readonly novaAberta = signal(false);
  protected readonly nomeDaConexao = signal('');
  protected readonly enviando = signal(false);
  protected readonly erroDoForm = signal<string | null>(null);
  private readonly retornoDaJanela = signal<RetornoDoLogin | null>(null);
  private readonly semApp = signal(false);

  protected readonly textos = computed(() => TEXTOS[this.aplicativo()]);
  protected readonly servico = computed(
    () => NOME_DO_SERVICO[SERVICO_DO_APLICATIVO[this.aplicativo()]],
  );
  protected readonly nomeDoApp = computed(() => SERVICO_DO_APLICATIVO[this.aplicativo()]);
  protected readonly appNaoCadastrado = computed(
    () => this.appCadastrado() === false || this.semApp(),
  );
  protected readonly aguardando = computed(
    () => this.login.espera()?.app === SERVICO_DO_APLICATIVO[this.aplicativo()],
  );
  protected readonly mostraNova = computed(
    () => this.novaAberta() || (this.conexoes() ?? []).length === 0,
  );
  protected readonly retornoAtual = computed(() => this.retornoDaJanela() ?? this.retorno());
  protected readonly erroDoRetorno = computed(() => {
    const retorno = this.retornoAtual();
    return retorno?.resultado === 'erro' ? motivoDoLogin(retorno.motivo, retorno.app) : null;
  });

  constructor() {
    // O aplicativo só chega depois do construtor: carrega (de novo, se ele mudar) a partir daqui.
    effect(() => {
      this.aplicativo();
      untracked(() => void this.carregar());
    });
    effect(() => {
      const id = this.selecionadaId();
      untracked(() => {
        if (id && this.marcada() === null) {
          this.marcar(id);
        }
      });
    });
  }

  protected async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [conexoes, apps] = await Promise.all([
        this.api.listar(this.aplicativo()),
        this.apps.listar().catch(() => null),
      ]);
      this.conexoes.set(conexoes);
      this.appCadastrado.set(
        apps ? !!apps.find((a) => a.aplicativo === this.aplicativo())?.configurado : null,
      );
      const id = this.marcada() ?? this.selecionadaId();
      if (id) {
        this.marcar(id);
      }
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    } finally {
      this.carregando.set(false);
    }
  }

  // --- Escolha ---------------------------------------------------------------------------------

  protected situacao(conexao: ConexaoAplicativo): { rotulo: string; variante: VarianteSelo } {
    if (conexao.precisaAtencao) {
      return { rotulo: 'Precisa de atenção', variante: 'coral' };
    }
    if (!conexao.conectada) {
      return { rotulo: 'Login não concluído', variante: 'neutro' };
    }
    return { rotulo: 'Conectada', variante: 'menta' };
  }

  protected usavel(conexao: ConexaoAplicativo): boolean {
    return conexao.conectada && !conexao.precisaAtencao;
  }

  protected detalhes(conexao: ConexaoAplicativo): string {
    const partes: string[] = [];
    if (conexao.conta) {
      partes.push(conexao.conta);
    }
    const usos = conexao.integracoes;
    partes.push(
      usos === 0
        ? 'nenhuma integração usa'
        : usos === 1
          ? '1 integração usa'
          : `${usos} integrações usam`,
    );
    if (conexao.conectadaEm) {
      partes.push(`conectada em ${formatarData(conexao.conectadaEm)}`);
    }
    return partes.join(' · ');
  }

  protected marcar(id: string): void {
    const conexao = (this.conexoes() ?? []).find((c) => c.id === id);
    if (!conexao || !this.usavel(conexao)) {
      return;
    }
    this.marcada.set(conexao.id);
    this.escolhida.emit(conexao);
  }

  /** "Remover": confirma, exclui e recarrega a lista; a escolha some se era esta conexão. */
  protected async remover(conexao: ConexaoAplicativo): Promise<void> {
    this.erroDaRemocao.set(null);
    const servico = this.servico();
    const ok = await this.confirmacao.confirmar({
      titulo: `Remover a conexão “${conexao.nome}”?`,
      mensagem: `O CRM apaga os tokens guardados desta conexão com o ${servico}. Isso não pode ser desfeito; para voltar a usá-la, é preciso entrar de novo.`,
      confirmar: 'Remover conexão',
      perigo: true,
    });
    if (ok) {
      await this.excluir(conexao, false);
    }
  }

  private async excluir(conexao: ConexaoAplicativo, descartar: boolean): Promise<void> {
    this.ocupada.set(conexao.id);
    try {
      await this.api.excluir(conexao.id, descartar);
      this.avisos.sucesso(`Conexão “${conexao.nome}” removida.`);
      if (this.marcada() === conexao.id) {
        this.marcada.set(null);
        this.escolhida.emit(null);
      }
      await this.carregar();
    } catch (falha) {
      const erro = erroDaApi(falha);
      const pendencias = descartar ? [] : pendenciasDoErro(erro.detalhes);
      if (erro.status === 409 && pendencias.length > 0) {
        this.ocupada.set(null);
        await this.confirmarSemRemoverWebhooks(conexao, pendencias);
        return;
      }
      // 409 "em uso": a mensagem da API diz quantas integrações usam a conexão.
      this.erroDaRemocao.set(erro.resumo);
    } finally {
      this.ocupada.set(null);
    }
  }

  /** O CRM não apagou no serviço os webhooks de integrações já excluídas: segundo passo. */
  private async confirmarSemRemoverWebhooks(
    conexao: ConexaoAplicativo,
    pendencias: readonly PendenciaDeRemocao[],
  ): Promise<void> {
    const servico = this.servico();
    const ok = await this.confirmacao.confirmar({
      titulo: 'Há webhooks que o CRM não conseguiu apagar',
      mensagem: `O CRM não conseguiu remover estes webhooks no ${servico}. Se remover a conexão mesmo assim, eles continuam lá e precisam ser apagados à mão no ${servico}.`,
      detalhes: pendencias.map((p) => (p.webhookId ? `${p.nome} (id ${p.webhookId})` : p.nome)),
      confirmar: 'Remover mesmo assim',
      perigo: true,
    });
    if (ok) {
      await this.excluir(conexao, true);
    }
  }

  protected mudarModo(modo: ModoDeConta | null): void {
    this.modo.set(modo ?? 'LOGIN');
    this.erroDoForm.set(null);
  }

  // --- Login -----------------------------------------------------------------------------------

  /** "Conectar de novo": o mesmo login, na conexão que já existe. */
  protected reconectar(conexao: ConexaoAplicativo): void {
    this.ocupada.set(conexao.id);
    void this.fazerLogin(
      { conexaoId: conexao.id },
      { conectadaEm: conexao.conectadaEm, precisaAtencao: conexao.precisaAtencao },
    );
  }

  /** Chamado direto do clique: a janela do login abre antes de qualquer espera (R32.23). */
  protected entrar(): void {
    const nome = this.nomeDaConexao().trim();
    this.enviando.set(true);
    void this.fazerLogin(nome ? { nome } : {}, null);
  }

  protected definirNome(valor: ValorCampoTexto): void {
    this.nomeDaConexao.set(String(valor ?? ''));
  }

  private async fazerLogin(
    base: { readonly nome?: string; readonly conexaoId?: string },
    antes: { conectadaEm: string | null; precisaAtencao: boolean } | null,
  ): Promise<void> {
    const aplicativo = this.aplicativo();
    this.erroDoForm.set(null);
    this.retornoDaJanela.set(null);
    try {
      const resultado = await this.login.entrar({
        app: SERVICO_DO_APLICATIVO[aplicativo],
        iniciar: (modo) => this.api.iniciarLogin({ aplicativo, ...base, modo }),
        situacao: async (id) => {
          const { conectada, precisaAtencao, conectadaEm } = await this.api.obter(id);
          return { conectada, precisaAtencao, conectadaEm };
        },
        antes,
        contexto: this.contexto(),
      });
      await this.aoTerminarOLogin(resultado);
    } catch (falha) {
      const erro = erroDaApi(falha);
      if (erro.detalhes?.['appNaoCadastrado']) {
        this.semApp.set(true);
      } else {
        // Falha do próprio front (ex.: endereço de login inválido) traz a mensagem pronta.
        this.erroDoForm.set(
          falha instanceof Error && !(falha instanceof ErroApi) ? falha.message : erro.resumo,
        );
      }
    } finally {
      this.enviando.set(false);
      this.ocupada.set(null);
    }
  }

  private async aoTerminarOLogin(resultado: ResultadoDaJanela): Promise<void> {
    if (resultado.tipo === 'expirou') {
      this.erroDoForm.set('O login demorou mais de 10 minutos e venceu. Comece de novo.');
    } else if (resultado.tipo === 'concluido') {
      this.retornoDaJanela.set(resultado.retorno);
      if (resultado.retorno.resultado === 'conectado') {
        this.novaAberta.set(false);
        this.nomeDaConexao.set('');
        await this.carregar();
        if (resultado.retorno.conexaoId) {
          this.marcar(resultado.retorno.conexaoId);
        }
      }
    }
  }
}
