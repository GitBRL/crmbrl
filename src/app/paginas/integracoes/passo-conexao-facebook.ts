import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  InjectionToken,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { LucideTriangleAlert } from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarData } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { CampoTexto, type ValorCampoTexto } from '../../ui/campo-texto/campo-texto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { Selo, type VarianteSelo } from '../../ui/selo/selo';
import { ValorUnico } from './comum/valor-unico';
import { FacebookApi } from './facebook.api';
import {
  type CanalDoFacebook,
  type ConexaoFacebook,
  type ConfiguracaoFacebook,
  type ContextoDoLogin,
  guardarContextoDoLogin,
  motivoDoRetorno,
  type PedidoDeLogin,
  type PedidoDeTokenDePagina,
  type RetornoDoFacebook,
  ROTULO_TIPO_DE_CONEXAO,
} from './facebook.tipos';

/** Leva o navegador a outra página. Um token para os testes trocarem por um espião. */
export const IR_PARA_ENDERECO = new InjectionToken<(endereco: string) => void>('IR_PARA_ENDERECO', {
  providedIn: 'root',
  factory: () => (endereco) => globalThis.location.assign(endereco),
});

type FormaDeEntrar = 'LOGIN' | 'TOKEN';
type OrigemDoApp = 'DIGITAR' | 'CANAL';

const OPCOES_FORMA: readonly OpcaoGrupo<FormaDeEntrar>[] = [
  {
    valor: 'LOGIN',
    rotulo: 'Entrar com o Facebook',
    dica: 'Abre o Facebook para você autorizar. Dá acesso às páginas que você administra.',
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
 * entrando com o Facebook (o navegador vai ao diálogo e volta a `/integracoes`) ou colando
 * um token de página. A escolha sobe em `escolhida`.
 */
@Component({
  selector: 'app-passo-conexao-facebook',
  imports: [
    Botao,
    CampoSenha,
    CampoTexto,
    EstadoVazio,
    Esqueleto,
    GrupoOpcoes,
    Seletor,
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
  private readonly irPara = inject(IR_PARA_ENDERECO);

  /** Conexão já usada pela integração (ou a que acabou de voltar do login). */
  readonly selecionadaId = input<string | null>(null);
  /** O que o assistente estava fazendo, para voltar depois do login. */
  readonly contexto = input<ContextoDoLogin>({ integracaoId: null, nome: '' });
  /** O resultado do login, quando a página voltou do Facebook. */
  readonly retorno = input<RetornoDoFacebook | null>(null);
  readonly escolhida = output<ConexaoFacebook | null>();

  protected readonly opcoesForma = OPCOES_FORMA;
  protected readonly rotuloTipo = ROTULO_TIPO_DE_CONEXAO;

  protected readonly conexoes = signal<readonly ConexaoFacebook[] | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly configuracao = signal<ConfiguracaoFacebook | null>(null);
  protected readonly canais = signal<readonly CanalDoFacebook[]>([]);
  protected readonly marcada = signal<string | null>(null);
  protected readonly ocupada = signal<string | null>(null);

  // Conexão nova
  protected readonly novaAberta = signal(false);
  protected readonly forma = signal<FormaDeEntrar>('LOGIN');
  protected readonly origemDoApp = signal<OrigemDoApp>('DIGITAR');
  protected readonly canalId = signal<string | null>(null);
  protected readonly appId = signal('');
  protected readonly appSecret = signal('');
  protected readonly nomeDaConexao = signal('');
  protected readonly tokenDaPagina = signal('');
  protected readonly paginaId = signal('');
  protected readonly enviando = signal(false);
  protected readonly erroDoForm = signal<string | null>(null);
  protected readonly tocou = signal(false);

  protected readonly usaCanal = computed(() => this.origemDoApp() === 'CANAL');
  protected readonly opcoesOrigem = computed<readonly OpcaoGrupo<OrigemDoApp>[]>(() => [
    { valor: 'DIGITAR', rotulo: 'Digitar o id e o segredo do app' },
    ...(this.canais().length
      ? [
          {
            valor: 'CANAL' as const,
            rotulo: 'Usar o app de um canal Messenger ou Instagram',
            dica: 'O segredo já está guardado no CRM e não aparece de novo.',
          },
        ]
      : []),
  ]);
  protected readonly opcoesCanal = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.canais().map((canal) => ({
      valor: canal.id,
      rotulo: `${canal.nome} (${canal.tipo === 'INSTAGRAM' ? 'Instagram' : 'Messenger'})`,
    })),
  );
  protected readonly mostraNova = computed(
    () => this.novaAberta() || (this.conexoes() ?? []).length === 0,
  );
  protected readonly erroDoRetorno = computed(() => {
    const retorno = this.retorno();
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
      const [conexoes, configuracao, canais] = await Promise.all([
        this.api.conexoes(),
        this.api.configuracao().catch(() => null),
        this.api.canais().catch(() => [] as readonly CanalDoFacebook[]),
      ]);
      this.conexoes.set(conexoes);
      this.configuracao.set(configuracao);
      this.canais.set(canais);
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

  protected async reconectar(conexao: ConexaoFacebook): Promise<void> {
    this.ocupada.set(conexao.id);
    this.erroDoForm.set(null);
    try {
      await this.abrirOLogin({ conexaoId: conexao.id });
    } catch (falha) {
      this.ocupada.set(null);
      this.avisos.erro(falha);
    }
  }

  protected async entrarComOFacebook(): Promise<void> {
    this.tocou.set(true);
    const pedido = this.pedidoDoApp();
    if (!pedido) {
      return;
    }
    this.enviando.set(true);
    this.erroDoForm.set(null);
    try {
      await this.abrirOLogin(pedido);
    } catch (falha) {
      this.enviando.set(false);
      this.erroDoForm.set(erroDaApi(falha).resumo);
    }
  }

  protected async colarToken(): Promise<void> {
    this.tocou.set(true);
    const app = this.pedidoDoApp();
    if (!app || !this.tokenDaPagina().trim()) {
      return;
    }
    const pedido: PedidoDeTokenDePagina = {
      tokenPagina: this.tokenDaPagina().trim(),
      ...(this.paginaId().trim() ? { paginaId: this.paginaId().trim() } : {}),
      ...(this.nomeDaConexao().trim() ? { nome: this.nomeDaConexao().trim() } : {}),
      ...('canalId' in app ? { canalId: app.canalId } : {}),
      ...('appId' in app ? { appId: app.appId, appSecret: app.appSecret } : {}),
    } as PedidoDeTokenDePagina;
    this.enviando.set(true);
    this.erroDoForm.set(null);
    try {
      const conexao = await this.api.conectarComTokenDePagina(pedido);
      this.tokenDaPagina.set('');
      this.appSecret.set('');
      this.tocou.set(false);
      this.novaAberta.set(false);
      this.avisos.sucesso(`Conexão “${conexao.nome}” criada.`);
      this.marcada.set(conexao.id);
      await this.carregar();
    } catch (falha) {
      this.erroDoForm.set(erroDaApi(falha).resumo);
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

  protected definirTexto(
    destino: 'appId' | 'appSecret' | 'nome' | 'token' | 'pagina',
    valor: ValorCampoTexto,
  ): void {
    const texto = String(valor ?? '');
    switch (destino) {
      case 'appId':
        this.appId.set(texto);
        break;
      case 'appSecret':
        this.appSecret.set(texto);
        break;
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

  protected erroDoCanal(): string | null {
    return this.tocou() && !this.canalId() ? 'Escolha o canal.' : null;
  }

  /** O app da conexão nova: id e segredo digitados, ou o canal escolhido; `null` se faltar algo. */
  private pedidoDoApp():
    | { appId: string; appSecret: string; nome?: string }
    | { canalId: string; nome?: string }
    | null {
    const nome = this.nomeDaConexao().trim();
    const comNome = nome ? { nome } : {};
    if (this.usaCanal()) {
      const canalId = this.canalId();
      return canalId ? { canalId, ...comNome } : null;
    }
    const appId = this.appId().trim();
    const appSecret = this.appSecret().trim();
    return appId && appSecret ? { appId, appSecret, ...comNome } : null;
  }

  private async abrirOLogin(pedido: PedidoDeLogin): Promise<void> {
    const login = await this.api.iniciarLogin(pedido);
    if (!/^https?:\/\//i.test(login.urlDialogo)) {
      throw new Error('O endereço do login do Facebook não é válido.');
    }
    guardarContextoDoLogin(this.contexto());
    this.irPara(login.urlDialogo);
  }
}
