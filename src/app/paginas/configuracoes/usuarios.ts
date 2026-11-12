import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  LucideKeyRound,
  LucidePlus,
  LucideRefreshCw,
  LucideSend,
  LucideShieldCheck,
  LucideTriangleAlert,
  LucideUserMinus,
  LucideUserRound,
} from '@lucide/angular';

import { type Pagina, POR_PAGINA_PADRAO, totalDePaginas } from '../../nucleo/api/api';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarDataHora, formatarTempoRelativo, semCodigoDeRegra } from '../../nucleo/formatos';
import type { Papel } from '../../nucleo/papeis';
import { nomeDoSetor } from '../../nucleo/setores/setores';
import { SetoresService } from '../../nucleo/setores/setores.service';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { MenuAcoes, type ItemMenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { Seletor } from '../../ui/seletor/seletor';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { Tabela, type ColunaTabela } from '../../ui/tabela/tabela';
import { Carregamento } from './carregamento';
import { ConfiguracoesApi } from './configuracoes.api';
import type { FiltrosUsuarios, Usuario, UsuarioResumo } from './configuracoes.modelos';
import { DesligarUsuario } from './desligar-usuario';
import {
  FormularioUsuario,
  OPCOES_PAPEL,
  type PedidoFormularioUsuario,
} from './formulario-usuario';
import { aguardaNovoLider, juntarNomes, situacaoDoUsuario } from './hierarquia';
import { ReativarUsuario } from './reativar-usuario';
import { SenhaTemporaria } from './senha-temporaria';
import { pluralizar } from './textos';

type Situacao = 'ativos' | 'desligados' | 'todos';

const SITUACOES: readonly OpcaoFiltro[] = [
  { id: 'ativos', rotulo: 'Ativos' },
  { id: 'desligados', rotulo: 'Desligados' },
  { id: 'todos', rotulo: 'Todos' },
];

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'nome', rotulo: 'Nome' },
  { id: 'email', rotulo: 'E-mail' },
  { id: 'papel', rotulo: 'Papel' },
  { id: 'setor', rotulo: 'Setor' },
  { id: 'lider', rotulo: 'Líder' },
  { id: 'situacao', rotulo: 'Situação' },
  { id: 'ultimoAcesso', rotulo: 'Último acesso' },
  {
    id: 'acoes',
    rotulo: 'Ações',
    rotuloOculto: true,
    alinhar: 'fim',
    largura: '3.5rem',
    fixa: true,
  },
];

/** Uma linha da tabela: o usuário e o que a tela calcula dele. */
interface LinhaUsuario {
  readonly id: string;
  readonly usuario: Usuario;
  readonly situacao: ReturnType<typeof situacaoDoUsuario>;
  readonly aguardaLider: boolean;
  readonly ultimoAcesso: string;
  readonly ultimoAcessoCompleto: string | null;
  /** O e-mail em duas partes ("lider.cs@" e "demo.local"): só quebra depois da arroba. */
  readonly email: readonly [string, string];
  readonly ehVoce: boolean;
  readonly acoes: readonly ItemMenuAcoes[];
}

/**
 * Usuários (`/configuracoes/usuarios`, Admin) — TELAS-FASE1 §6: a tabela com nome, e-mail,
 * papel, líder, situação e último acesso; convidar, editar, desligar (com a prévia da R7.1),
 * reativar (exige líder, R7.5), senha temporária e reenviar convite (R2.8).
 */
@Component({
  selector: 'app-usuarios',
  imports: [
    Avatar,
    Botao,
    CampoBusca,
    CelulaTabela,
    DesligarUsuario,
    EstadoVazio,
    FiltrosPilula,
    FormularioUsuario,
    LucideTriangleAlert,
    MenuAcoes,
    Paginacao,
    ReativarUsuario,
    Selo,
    Seletor,
    SenhaTemporaria,
    Tabela,
  ],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Usuarios {
  private readonly api = inject(ConfiguracoesApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly sessao = inject(SessaoService);

  protected readonly iconeConvidar = LucidePlus;
  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly nomeDoSetor = nomeDoSetor;
  protected readonly colunas = COLUNAS;
  protected readonly situacoes = SITUACOES;
  protected readonly opcoesPapel = OPCOES_PAPEL;
  protected readonly setores = inject(SetoresService);

  // Filtros ----------------------------------------------------------------------------------
  protected readonly busca = signal('');
  private readonly termo = signal('');
  protected readonly situacao = signal<string | null>('ativos');
  protected readonly papel = signal<Papel | null>(null);
  protected readonly setor = signal<string | null>(null);
  protected readonly pagina = signal(1);
  protected readonly porPagina = signal(POR_PAGINA_PADRAO);
  protected readonly temFiltro = computed(
    () =>
      this.termo() !== '' ||
      this.papel() !== null ||
      this.setor() !== null ||
      this.situacao() !== 'ativos',
  );
  /** O pedido à API (`GET /usuarios`) que os filtros e a página formam. */
  private readonly filtros = computed<FiltrosUsuarios>(() => {
    const situacao = this.situacao() as Situacao | null;
    return {
      busca: this.termo(),
      papel: this.papel(),
      area: this.setor(),
      ativo: situacao === 'ativos' ? true : situacao === 'desligados' ? false : null,
      pagina: this.pagina(),
      porPagina: this.porPagina(),
    };
  });

  // Dados ------------------------------------------------------------------------------------
  protected readonly lista = new Carregamento<Pagina<Usuario>>();
  /** Quem responde provisoriamente a quem recebeu a equipe de um líder desligado (R7.3). */
  protected readonly semLiderCerto = signal<readonly UsuarioResumo[]>([]);
  protected readonly linhas = computed<readonly LinhaUsuario[]>(() =>
    (this.lista.dados()?.itens ?? []).map((usuario) => this.linha(usuario)),
  );
  protected readonly total = computed(() => this.lista.dados()?.total ?? 0);
  protected readonly carregandoPrimeiraVez = computed(
    () => this.lista.carregando() && this.lista.dados() === null,
  );
  protected readonly fraseSemLider = computed(() => {
    const pessoas = this.semLiderCerto();
    if (pessoas.length === 0) {
      return '';
    }
    const nomes = juntarNomes(pessoas.map((pessoa) => pessoa.nome));
    return `${nomes} ${pessoas.length === 1 ? 'responde' : 'respondem'} provisoriamente a quem recebeu a equipe de um líder desligado. Edite e escolha o novo líder.`;
  });
  protected readonly tituloSemLider = computed(() =>
    pluralizar(
      this.semLiderCerto().length,
      'pessoa está sem o líder certo',
      'pessoas estão sem o líder certo',
    ),
  );

  // Modais -----------------------------------------------------------------------------------
  protected readonly formulario = signal<PedidoFormularioUsuario | null>(null);
  protected readonly desligando = signal<Usuario | null>(null);
  protected readonly reativando = signal<Usuario | null>(null);
  protected readonly definindoSenha = signal<Usuario | null>(null);

  constructor() {
    void this.setores.carregar();
    // Busca enquanto digita, com uma pausa curta (Enter busca na hora).
    effect((aoLimpar) => {
      const texto = this.busca().trim();
      const espera = setTimeout(() => this.aplicarBusca(texto), 350);
      aoLimpar(() => clearTimeout(espera));
    });

    effect(() => {
      const filtros = this.filtros();
      untracked(() => void this.lista.executar(() => this.api.listarUsuarios(filtros)));
    });

    void this.carregarSemLiderCerto();
  }

  protected aplicarBusca(texto: string): void {
    if (texto.trim() !== this.termo()) {
      this.termo.set(texto.trim());
      this.pagina.set(1);
    }
  }

  protected aoMudarFiltro(): void {
    this.pagina.set(1);
  }

  protected limparFiltros(): void {
    this.busca.set('');
    this.termo.set('');
    this.papel.set(null);
    this.setor.set(null);
    this.situacao.set('ativos');
    this.pagina.set(1);
  }

  protected async recarregar(): Promise<void> {
    void this.carregarSemLiderCerto();
    const filtros = this.filtros();
    const ok = await this.lista.executar(() => this.api.listarUsuarios(filtros));
    const dados = this.lista.dados();
    // A última pessoa da página saiu do filtro (ex.: desligada): volta para a última página.
    if (ok && dados && dados.itens.length === 0 && this.pagina() > 1) {
      this.pagina.set(Math.max(1, totalDePaginas(dados)));
    }
  }

  protected convidar(): void {
    this.formulario.set({ modo: 'convidar' });
  }

  protected abrir(linha: LinhaUsuario): void {
    this.formulario.set({ modo: 'editar', usuario: linha.usuario });
  }

  /** Abre a edição de quem está sem o líder certo (a faixa no topo). */
  protected async editarPorId(id: string): Promise<void> {
    const naPagina = this.lista.dados()?.itens.find((usuario) => usuario.id === id);
    try {
      const usuario = naPagina ?? (await this.api.detalharUsuario(id));
      this.formulario.set({ modo: 'editar', usuario });
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  protected agir(acao: string, linha: LinhaUsuario): void {
    const usuario = linha.usuario;
    switch (acao) {
      case 'editar':
        this.formulario.set({ modo: 'editar', usuario });
        break;
      case 'convite':
        void this.reenviarConvite(usuario);
        break;
      case 'senha':
        this.definindoSenha.set(usuario);
        break;
      case 'dois-fatores':
        void this.redefinirDoisFatores(usuario);
        break;
      case 'desligar':
        this.desligando.set(usuario);
        break;
      case 'reativar':
        this.reativando.set(usuario);
        break;
    }
  }

  private async redefinirDoisFatores(usuario: Usuario): Promise<void> {
    const ok = await this.confirmacao.confirmar({
      titulo: 'Redefinir a verificação em duas etapas?',
      mensagem: `${usuario.nome} poderá entrar só com a senha e será avisada(o) no CRM. A pessoa pode ativar a verificação de novo no Meu perfil. A ação fica na auditoria.`,
      confirmar: 'Redefinir',
      perigo: true,
    });
    if (!ok) {
      return;
    }
    try {
      await this.api.redefinirDoisFatores(usuario.id);
      this.avisos.sucesso(`Verificação em duas etapas de ${usuario.nome} redefinida.`);
      await this.recarregar();
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  private async reenviarConvite(usuario: Usuario): Promise<void> {
    try {
      const resposta = await this.api.reenviarConvite(usuario.id);
      this.avisos.sucesso(
        `${semCodigoDeRegra(resposta.mensagem)} O link vale até ${formatarDataHora(resposta.expiraEm)}.`,
      );
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  private async carregarSemLiderCerto(): Promise<void> {
    try {
      const equipes = await this.api.equipes();
      const vistos = new Map<string, UsuarioResumo>();
      for (const equipe of equipes) {
        for (const membro of [equipe.lider, ...equipe.membros]) {
          if (membro.aguardandoNovoLider && membro.usuario.ativo) {
            vistos.set(membro.usuario.id, membro.usuario);
          }
        }
      }
      this.semLiderCerto.set([...vistos.values()]);
    } catch {
      // A faixa é um atalho: sem ela, a coluna "Líder" da tabela continua avisando.
      this.semLiderCerto.set([]);
    }
  }

  private linha(usuario: Usuario): LinhaUsuario {
    const ehVoce = usuario.id === this.sessao.usuario()?.id;
    return {
      id: usuario.id,
      usuario,
      situacao: situacaoDoUsuario(usuario),
      aguardaLider: aguardaNovoLider(usuario),
      ultimoAcesso: usuario.ultimoAcessoEm
        ? formatarTempoRelativo(usuario.ultimoAcessoEm)
        : 'Nunca entrou',
      ultimoAcessoCompleto: usuario.ultimoAcessoEm
        ? formatarDataHora(usuario.ultimoAcessoEm)
        : null,
      email: partirEmail(usuario.email),
      ehVoce,
      acoes: this.acoesDe(usuario, ehVoce),
    };
  }

  private acoesDe(usuario: Usuario, ehVoce: boolean): readonly ItemMenuAcoes[] {
    if (!usuario.ativo) {
      return [
        { id: 'editar', rotulo: 'Editar dados', icone: LucideUserRound },
        { id: 'reativar', rotulo: 'Reativar', icone: LucideRefreshCw },
      ];
    }
    const itens: ItemMenuAcoes[] = [{ id: 'editar', rotulo: 'Editar', icone: LucideUserRound }];
    if (!usuario.senhaDefinida) {
      itens.push({ id: 'convite', rotulo: 'Reenviar convite', icone: LucideSend });
    }
    itens.push({
      id: 'senha',
      rotulo: 'Definir senha temporária',
      icone: LucideKeyRound,
      desabilitado: ehVoce,
      motivo: ehVoce ? 'Para a sua senha, use Meu perfil.' : undefined,
    });
    if (usuario.doisFatoresAtivo) {
      itens.push({
        id: 'dois-fatores',
        rotulo: 'Redefinir verificação em duas etapas',
        icone: LucideShieldCheck,
        desabilitado: ehVoce,
        motivo: ehVoce ? 'Para a sua, use Meu perfil.' : undefined,
      });
    }
    itens.push({
      id: 'desligar',
      rotulo: 'Desligar',
      icone: LucideUserMinus,
      perigo: true,
      separarAntes: true,
      desabilitado: ehVoce,
      motivo: ehVoce ? 'Você não pode desligar a si mesmo.' : undefined,
    });
    return itens;
  }
}

/** "lider.cs@demo.local" → ["lider.cs@", "demo.local"] (a quebra de linha fica na arroba). */
export function partirEmail(email: string): readonly [string, string] {
  const arroba = email.indexOf('@');
  return arroba < 0 ? [email, ''] : [email.slice(0, arroba + 1), email.slice(arroba + 1)];
}
