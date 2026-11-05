import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
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
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { CampoTexto, type ValorCampoTexto } from '../../ui/campo-texto/campo-texto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { Selo, type VarianteSelo } from '../../ui/selo/selo';
import { ValorUnico } from './comum/valor-unico';
import { FacebookApi } from './facebook.api';
import {
  type ConexaoFacebook,
  type ConfiguracaoFacebook,
  type ContextoDoLogin,
  motivoDoRetorno,
  type PedidoDeTokenDePagina,
  type RetornoDoFacebook,
  ROTULO_TIPO_DE_CONEXAO,
} from './facebook.tipos';
import { EsperaDoLogin } from './login/espera-do-login';
import { IR_PARA_ENDERECO, type ResultadoDaJanela, LoginJanela } from './login/login-janela';
import { type RetornoDoLogin } from './login/login.tipos';

export { IR_PARA_ENDERECO };

type FormaDeEntrar = 'LOGIN' | 'TOKEN';

const OPCOES_FORMA: readonly OpcaoGrupo<FormaDeEntrar>[] = [
  {
    valor: 'LOGIN',
    rotulo: 'Entrar com o Facebook',
    dica: 'Abre o Facebook em outra janela para você autorizar e volta para cá. Dá acesso às páginas que você administra.',
  },
  {
    valor: 'TOKEN',
    rotulo: 'Colar um token de página',
    dica: 'Para quem já tem o token de acesso da página. Dá acesso a uma só página.',
  },
];

/**
 * Passo "Conexão" do assistente do Facebook Lead Ads: a lista das conexões (com situação e
 * "Conectar de novo"), o aviso das permissões da Meta e o jeito de criar uma conexão nova,
 * entrando com o Facebook (numa outra janela, que volta sozinha; R32.23) ou colando um token de
 * página. O app é o cadastrado em Configurações > Apps de login (R32.24): ninguém digita ID nem
 * segredo aqui. A escolha sobe em `escolhida`.
 */
@Component({
  selector: 'app-passo-conexao-facebook',
  imports: [
    Botao,
    CampoSenha,
    CampoTexto,
    EsperaDoLogin,
    EstadoVazio,
    Esqueleto,
    GrupoOpcoes,
    RouterLink,
    Selo,
    ValorUnico,
    LucideTriangleAlert,
  ],
  templateUrl: './passo-conexao-facebook.html',
  styleUrl: './passo-conexao-facebook.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PassoConexaoFacebook {
  private readonly api = inject(FacebookApi);
  private readonly avisos = inject(AvisosService);
  private readonly login = inject(LoginJanela);
  private readonly confirmacao = inject(ConfirmacaoService);

  /** Conexão já usada pela integração (ou a que acabou de voltar do login). */
  readonly selecionadaId = input<string | null>(null);
  /** O que o assistente estava fazendo, para voltar depois do login. */
  readonly contexto = input<ContextoDoLogin>({ integracaoId: null, nome: '' });
  /** O resultado do login, quando a página voltou do Facebook (pop-up bloqueado: mesma aba). */
  readonly retorno = input<RetornoDoFacebook | null>(null);
  readonly escolhida = output<ConexaoFacebook | null>();

  protected readonly opcoesForma = OPCOES_FORMA;
  protected readonly rotuloTipo = ROTULO_TIPO_DE_CONEXAO;

  protected readonly conexoes = signal<readonly ConexaoFacebook[] | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly configuracao = signal<ConfiguracaoFacebook | null>(null);
  protected readonly marcada = signal<string | null>(null);
  protected readonly ocupada = signal<string | null>(null);
  /** Por que a última remoção não aconteceu (conexão em uso, falha da API). */
  protected readonly erroDaRemocao = signal<string | null>(null);

  // Conexão nova
  protected readonly novaAberta = signal(false);
  protected readonly forma = signal<FormaDeEntrar>('LOGIN');
  protected readonly nomeDaConexao = signal('');
  protected readonly tokenDaPagina = signal('');
  protected readonly paginaId = signal('');
  protected readonly enviando = signal(false);
  protected readonly erroDoForm = signal<string | null>(null);
  protected readonly tocou = signal(false);
  /** O resultado do login numa outra janela (o da mesma aba vem em `retorno`). */
  private readonly retornoDaJanela = signal<RetornoDoLogin | null>(null);
  /** A API disse que o app da Meta ainda não foi cadastrado. */
  private readonly semApp = signal(false);

  protected readonly conexaoMarcada = computed(
    () => (this.conexoes() ?? []).find(({ id }) => id === this.marcada()) ?? null,
  );
  protected readonly appNaoCadastrado = computed(
    () => this.configuracao()?.appCadastrado === false || this.semApp(),
  );
  /** Há um login em andamento numa outra janela? */
  protected readonly aguardando = computed(() => this.login.espera()?.app === 'facebook');
  /** Conexão com app próprio (antiga): o quadro do webhook de páginas ainda vale aqui. */
  protected readonly comAppProprio = computed(
    () => this.conexaoMarcada()?.appDasConfiguracoes === false,
  );
  protected readonly mostraNova = computed(
    () => this.novaAberta() || (this.conexoes() ?? []).length === 0,
  );
  protected readonly retornoAtual = computed<RetornoDoFacebook | null>(
    () => this.retornoDaJanela() ?? this.retorno(),
  );
  protected readonly erroDoRetorno = computed(() => {
    const retorno = this.retornoAtual();
    return retorno?.resultado === 'erro' ? motivoDoRetorno(retorno.motivo) : null;
  });

  constructor() {
    void this.carregar();
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
      const [conexoes, configuracao] = await Promise.all([
        this.api.conexoes(),
        this.api.configuracao().catch(() => null),
      ]);
      this.conexoes.set(conexoes);
      this.configuracao.set(configuracao);
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

  protected situacao(conexao: ConexaoFacebook): { rotulo: string; variante: VarianteSelo } {
    if (conexao.precisaAtencao) {
      return { rotulo: 'Precisa de atenção', variante: 'coral' };
    }
    if (!conexao.conectada) {
      return { rotulo: 'Login não concluído', variante: 'neutro' };
    }
    return { rotulo: 'Conectada', variante: 'menta' };
  }

  protected usavel(conexao: ConexaoFacebook): boolean {
    return conexao.conectada && !conexao.precisaAtencao;
  }

  protected podeReconectar(conexao: ConexaoFacebook): boolean {
    return conexao.tipo === 'USUARIO';
  }

  protected detalhes(conexao: ConexaoFacebook): string {
    const partes = [ROTULO_TIPO_DE_CONEXAO[conexao.tipo]];
    if (conexao.usuarioFacebook) {
      partes.push(conexao.usuarioFacebook.nome);
    }
    const paginas = conexao.paginas.length;
    partes.push(paginas === 1 ? '1 página' : `${paginas} páginas`);
    if (conexao.expiraEm) {
      partes.push(`vale até ${formatarData(conexao.expiraEm)}`);
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

  // --- Login e token ---------------------------------------------------------------------------

  /** "Conectar de novo": o mesmo login, na conexão que já existe. */
  protected reconectar(conexao: ConexaoFacebook): void {
    this.ocupada.set(conexao.id);
    void this.fazerLogin(
      { conexaoId: conexao.id },
      { conectadaEm: conexao.conectadaEm, precisaAtencao: conexao.precisaAtencao },
    );
  }

  /** Chamado direto do clique: a janela do login abre antes de qualquer espera (R32.23). */
  protected entrarComOFacebook(): void {
    const nome = this.nomeDaConexao().trim();
    this.enviando.set(true);
    void this.fazerLogin(nome ? { nome } : {}, null);
  }

  private async fazerLogin(
    base: { readonly nome?: string; readonly conexaoId?: string },
    antes: { conectadaEm: string | null; precisaAtencao: boolean } | null,
  ): Promise<void> {
    this.erroDoForm.set(null);
    this.retornoDaJanela.set(null);
    try {
      const resultado = await this.login.entrar({
        app: 'facebook',
        iniciar: (modo) => this.api.iniciarLogin({ ...base, modo }),
        situacao: async (id) => {
          const { conectada, precisaAtencao, conectadaEm } = await this.api.conexao(id);
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

  protected async colarToken(): Promise<void> {
    this.tocou.set(true);
    if (!this.tokenDaPagina().trim()) {
      return;
    }
    const pedido: PedidoDeTokenDePagina = {
      tokenPagina: this.tokenDaPagina().trim(),
      ...(this.paginaId().trim() ? { paginaId: this.paginaId().trim() } : {}),
      ...(this.nomeDaConexao().trim() ? { nome: this.nomeDaConexao().trim() } : {}),
    };
    this.enviando.set(true);
    this.erroDoForm.set(null);
    try {
      const conexao = await this.api.conectarComTokenDePagina(pedido);
      this.tokenDaPagina.set('');
      this.tocou.set(false);
      this.novaAberta.set(false);
      this.avisos.sucesso(`Conexão “${conexao.nome}” criada.`);
      this.marcada.set(conexao.id);
      await this.carregar();
    } catch (falha) {
      const erro = erroDaApi(falha);
      if (erro.detalhes?.['appNaoCadastrado']) {
        this.semApp.set(true);
      } else {
        this.erroDoForm.set(erro.resumo);
      }
    } finally {
      this.enviando.set(false);
    }
  }

  protected async atualizarPaginas(conexao: ConexaoFacebook): Promise<void> {
    this.ocupada.set(conexao.id);
    try {
      const atualizada = await this.api.atualizarPaginas(conexao.id);
      this.conexoes.update((lista) =>
        (lista ?? []).map((outra) => (outra.id === atualizada.id ? atualizada : outra)),
      );
      if (this.marcada() === atualizada.id) {
        this.escolhida.emit(atualizada);
      }
      this.avisos.sucesso(`Páginas de “${atualizada.nome}” atualizadas.`);
    } catch (falha) {
      this.avisos.erro(falha);
      void this.carregar();
    } finally {
      this.ocupada.set(null);
    }
  }

  /** "Remover": confirma, exclui e recarrega a lista; a escolha some se era esta conexão. */
  protected async remover(conexao: ConexaoFacebook): Promise<void> {
    this.erroDaRemocao.set(null);
    const ok = await this.confirmacao.confirmar({
      titulo: `Remover a conexão “${conexao.nome}”?`,
      mensagem:
        'O CRM apaga os tokens guardados desta conexão. Isso não pode ser desfeito; para voltar a usá-la, é preciso entrar com o Facebook de novo.',
      confirmar: 'Remover conexão',
      perigo: true,
    });
    if (!ok) {
      return;
    }
    this.ocupada.set(conexao.id);
    try {
      await this.api.excluirConexao(conexao.id);
      this.avisos.sucesso(`Conexão “${conexao.nome}” removida.`);
      if (this.marcada() === conexao.id) {
        this.marcada.set(null);
        this.escolhida.emit(null);
      }
      await this.carregar();
    } catch (falha) {
      // 409: a conexão ainda é usada por integrações (a mensagem da API diz quantas).
      this.erroDaRemocao.set(erroDaApi(falha).resumo);
    } finally {
      this.ocupada.set(null);
    }
  }

  protected definirTexto(destino: 'nome' | 'token' | 'pagina', valor: ValorCampoTexto): void {
    const texto = String(valor ?? '');
    switch (destino) {
      case 'nome':
        this.nomeDaConexao.set(texto);
        break;
      case 'token':
        this.tokenDaPagina.set(texto);
        break;
      case 'pagina':
        this.paginaId.set(texto);
        break;
    }
  }

  protected erroDoCampo(valor: string, aviso: string): string | null {
    return this.tocou() && !valor.trim() ? aviso : null;
  }
}
