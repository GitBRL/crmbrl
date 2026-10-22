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
  viewChild,
} from '@angular/core';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { paraDecimal, paraNumero } from '../../nucleo/formatos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Botao } from '../../ui/botao/botao';
import { CampoTexto, type ValorCampoTexto } from '../../ui/campo-texto/campo-texto';
import { Modal } from '../../ui/modal/modal';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { BuscaEntidade } from './busca-entidade';
import { EstadoQuadro } from './estado-quadro';
import { FunisApi } from './funis.api';
import type { Contato, Empresa, Funil, Negocio, ResumoEmpresa } from './funis.tipos';
import { podeSerResponsavel } from './regras-funis';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Empresa do negócio: uma existente, ou um nome novo (criada ao salvar). */
interface EmpresaEscolhida extends ResumoEmpresa {
  readonly detalhe?: string | null;
  readonly nova?: boolean;
}

function opcaoDaEmpresa(empresa: Empresa): EmpresaEscolhida {
  const local = [empresa.cidade, empresa.uf].filter(Boolean).join('/');
  return {
    id: empresa.id,
    nome: empresa.nome,
    detalhe: [empresa.cnpjFormatado, local].filter(Boolean).join(' · ') || null,
  };
}

/**
 * "Novo negócio" (TELAS-FASE1 §3.3): contato (busca com criação ali mesmo e aviso de
 * duplicado, R4.2), empresa opcional, título sugerido, valor, etapa (padrão: a primeira) e
 * responsável (padrão: quem cria). Emite o negócio criado.
 */
@Component({
  selector: 'app-novo-negocio',
  imports: [BuscaEntidade, Botao, CampoTexto, Modal, Seletor],
  templateUrl: './novo-negocio.html',
  styleUrl: './novo-negocio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NovoNegocio {
  readonly aberto = model(false);
  readonly funil = input.required<Funil>();
  readonly criado = output<Negocio>();

  private readonly api = inject(FunisApi);
  private readonly avisos = inject(AvisosService);
  private readonly sessao = inject(SessaoService);
  private readonly estado = inject(EstadoQuadro, { optional: true });

  protected readonly contato = signal<Contato | null>(null);
  protected readonly empresa = signal<EmpresaEscolhida | null>(null);
  /** Criando um contato novo (o formulário curto aparece no lugar da busca). */
  protected readonly criandoContato = signal(false);
  protected readonly novoNome = signal<ValorCampoTexto>('');
  protected readonly novoEmail = signal<ValorCampoTexto>('');
  protected readonly novoTelefone = signal<ValorCampoTexto>('');
  /** Contato existente com o mesmo e-mail ou telefone (R4.2), achado enquanto digita. */
  protected readonly duplicado = signal<Contato | null>(null);
  protected readonly titulo = signal('');
  protected readonly tituloEditado = signal(false);
  protected readonly valor = signal<ValorCampoTexto>(null);
  protected readonly etapaId = signal<string | null>(null);
  protected readonly responsavelId = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly enviado = signal(false);
  protected readonly erroGeral = signal<ErroApi | null>(null);
  private readonly errosApi = signal<Readonly<Record<string, string>>>({});

  private readonly buscaContato = viewChild<BuscaEntidade<Contato>>('buscaContato');
  private readonly campoNome = viewChild<CampoTexto>('campoNome');
  private versaoDuplicado = 0;

  protected readonly etapasAbertas = computed(() =>
    this.funil().etapas.filter((etapa) => etapa.tipo === 'ABERTA'),
  );
  protected readonly opcoesEtapa = computed<OpcaoSeletor<string>[]>(() =>
    this.etapasAbertas().map((etapa) => ({ valor: etapa.id, rotulo: etapa.nome })),
  );
  protected readonly opcoesResponsavel = computed<OpcaoSeletor<string>[]>(() => {
    const area = this.funil().area;
    const eu = this.estado?.euComoUsuario() ?? null;
    const lista = [...(this.estado?.responsaveisPossiveis() ?? [])];
    if (eu && podeSerResponsavel(eu, area) && !lista.some((usuario) => usuario.id === eu.id)) {
      lista.unshift(eu);
    }
    return lista
      .sort((a, b) => (a.id === eu?.id ? -1 : b.id === eu?.id ? 1 : a.nome.localeCompare(b.nome)))
      .map((usuario) => ({
        valor: usuario.id,
        rotulo:
          usuario.id === eu?.id
            ? `${usuario.nome} (você)`
            : `${usuario.nome} · ${usuario.rotuloPapel}`,
      }));
  });
  protected readonly tituloSugerido = computed(() => {
    const nomeContato = this.contato()?.nome ?? texto(this.novoNome());
    const empresa = this.empresa()?.nome;
    if (empresa && nomeContato) {
      return `${empresa} — ${nomeContato}`;
    }
    return nomeContato || empresa || '';
  });

  // Mensagens de validação (aparecem depois de tentar salvar) ---------------------------------
  protected readonly erroContato = computed(() =>
    this.enviado() && !this.contato() && !this.criandoContato()
      ? 'Escolha um contato ou crie um novo.'
      : null,
  );
  protected readonly erroNome = computed(
    () =>
      this.errosApi()['nome'] ??
      (this.enviado() && this.criandoContato() && !texto(this.novoNome())
        ? 'Preencha o nome do contato.'
        : null),
  );
  protected readonly erroEmail = computed(() => {
    const api = this.errosApi()['email'];
    if (api) {
      return api;
    }
    const email = texto(this.novoEmail());
    if (!this.enviado() || !this.criandoContato()) {
      return null;
    }
    if (email && !EMAIL.test(email)) {
      return 'Digite um e-mail válido, como nome@empresa.com.br.';
    }
    if (!email && !texto(this.novoTelefone())) {
      return 'Informe o e-mail ou o telefone (pelo menos um).';
    }
    return null;
  });
  protected readonly erroTelefone = computed(() => this.errosApi()['telefone'] ?? null);
  protected readonly erroValor = computed(() => {
    const valor = paraNumero(this.valor());
    return this.enviado() && valor !== null && valor < 0 ? 'O valor não pode ser negativo.' : null;
  });

  protected readonly buscarContatos = async (termo: string) =>
    (await this.api.buscarContatos(termo)).itens;
  protected readonly buscarEmpresas = async (termo: string): Promise<EmpresaEscolhida[]> =>
    (await this.api.buscarEmpresas(termo)).itens.map(opcaoDaEmpresa);
  protected readonly nomeDoContato = (contato: Contato) => contato.nome;
  protected readonly detalheDoContato = (contato: Contato) =>
    [contato.email, formatarTelefone(contato.telefone), contato.empresa?.nome]
      .filter(Boolean)
      .join(' · ') || null;
  /** " (e-mail · telefone · empresa)" do contato que já existe, ou nada. */
  protected readonly detalheDoDuplicado = computed(() => {
    const existente = this.duplicado();
    const detalhe = existente ? this.detalheDoContato(existente) : null;
    return detalhe ? ` (${detalhe})` : '';
  });
  protected readonly nomeDaEmpresa = (empresa: EmpresaEscolhida) => empresa.nome;
  protected readonly detalheDaEmpresa = (empresa: EmpresaEscolhida) =>
    empresa.nova ? 'Nova empresa: criada ao salvar' : (empresa.detalhe ?? null);
  protected readonly textoCriarContato = (termo: string) => `Criar contato “${termo}”`;
  protected readonly textoCriarEmpresa = (termo: string) => `Usar “${termo}” como nova empresa`;

  constructor() {
    effect(() => {
      if (this.aberto()) {
        untracked(() => this.reiniciar());
      }
    });
    // Escolher um contato traz a empresa dele (se ainda não há uma escolhida).
    effect(() => {
      const contato = this.contato();
      if (contato?.empresa) {
        untracked(() => {
          if (!this.empresa()) {
            this.empresa.set(contato.empresa);
          }
        });
      }
    });
  }

  // Contato novo -------------------------------------------------------------------------------

  protected comecarContato(termo: string): void {
    this.criandoContato.set(true);
    this.duplicado.set(null);
    const digitado = termo.trim();
    if (EMAIL.test(digitado)) {
      this.novoEmail.set(digitado);
    } else if (digitado.replace(/\D/g, '').length >= 8 && !/[a-z]/i.test(digitado)) {
      this.novoTelefone.set(digitado);
    } else {
      this.novoNome.set(digitado);
    }
    queueMicrotask(() => this.campoNome()?.focar());
  }

  protected desistirDoContato(): void {
    this.criandoContato.set(false);
    this.novoNome.set('');
    this.novoEmail.set('');
    this.novoTelefone.set('');
    this.duplicado.set(null);
    this.errosApi.set({});
    queueMicrotask(() => this.buscaContato()?.focar());
  }

  /** Ao sair do e-mail ou do telefone: já existe alguém com ele? (R4.2) */
  protected async conferirDuplicado(): Promise<void> {
    const email = texto(this.novoEmail()).toLowerCase();
    const digitos = texto(this.novoTelefone()).replace(/\D/g, '');
    const termo = EMAIL.test(email) ? email : digitos.length >= 8 ? digitos : '';
    const versao = ++this.versaoDuplicado;
    if (!termo) {
      this.duplicado.set(null);
      return;
    }
    try {
      const { itens } = await this.api.buscarContatos(termo, 5);
      if (versao !== this.versaoDuplicado) {
        return;
      }
      const igual = itens.find(
        (contato) =>
          (!!email && contato.email?.toLowerCase() === email) ||
          (digitos.length >= 8 && !!contato.telefone && mesmoTelefone(contato.telefone, digitos)),
      );
      this.duplicado.set(igual ?? null);
    } catch {
      // Sem a conferência, a API ainda evita o duplicado ao salvar (R4.2).
    }
  }

  protected usarDuplicado(): void {
    const existente = this.duplicado();
    if (existente) {
      this.desistirDoContato();
      this.contato.set(existente);
    }
  }

  protected escolherEmpresaNova(nome: string): void {
    this.empresa.set({ id: '', nome, nova: true });
  }

  protected editarTitulo(valor: string | number | null): void {
    this.titulo.set(String(valor ?? ''));
    this.tituloEditado.set(true);
  }

  // Salvar ------------------------------------------------------------------------------------

  protected async salvar(): Promise<void> {
    this.enviado.set(true);
    this.erroGeral.set(null);
    this.errosApi.set({});
    if (this.erroContato() || this.erroNome() || this.erroEmail() || this.erroValor()) {
      if (this.erroContato()) {
        this.buscaContato()?.focar();
      } else if (this.erroNome()) {
        this.campoNome()?.focar();
      }
      return;
    }
    this.enviando.set(true);
    try {
      let contato = this.contato();
      let empresa = this.empresa();
      if (!contato) {
        const resultado = await this.api.criarContato({
          nome: texto(this.novoNome()),
          email: texto(this.novoEmail()) || null,
          telefone: texto(this.novoTelefone()) || null,
          ...(empresa?.nova
            ? { empresaNome: empresa.nome }
            : empresa
              ? { empresaId: empresa.id }
              : {}),
        });
        contato = resultado.contato;
        if (!resultado.criado) {
          this.avisos.atencao(
            `Já existia um contato com este e-mail ou telefone (${contato.nome}): o negócio fica com ele.`,
          );
        }
        // Se o negócio falhar daqui em diante, tentar de novo não cria o contato outra vez.
        this.criandoContato.set(false);
        this.contato.set(contato);
        if (empresa?.nova && contato.empresa) {
          empresa = contato.empresa;
          this.empresa.set(empresa);
        }
      }
      if (empresa?.nova) {
        const criada = await this.api.criarEmpresa(empresa.nome);
        empresa = { id: criada.id, nome: criada.nome };
        this.empresa.set(empresa);
      }
      const negocio = await this.api.criarNegocio({
        contatoId: contato.id,
        funilId: this.funil().id,
        titulo: (this.tituloEditado() ? this.titulo() : this.tituloSugerido()).trim() || undefined,
        empresaId: empresa?.id ?? null,
        etapaId: this.etapaId() ?? undefined,
        responsavelId: this.responsavelId(),
        valor: paraDecimal(paraNumero(this.valor()) ?? 0) ?? '0.00',
      });
      this.criado.emit(negocio);
      this.aberto.set(false);
    } catch (falha) {
      const erro = erroDaApi(falha);
      const porCampo: Record<string, string> = {};
      for (const campo of ['nome', 'email', 'telefone']) {
        const mensagem = erro.mensagemDoCampo(campo);
        if (mensagem) {
          porCampo[campo] = mensagem;
        }
      }
      if (erro.regra === 'R4.1' && this.criandoContato()) {
        porCampo['email'] = erro.mensagem;
      }
      this.errosApi.set(porCampo);
      if (!Object.keys(porCampo).length) {
        this.erroGeral.set(erro);
      }
    } finally {
      this.enviando.set(false);
    }
  }

  private reiniciar(): void {
    this.contato.set(null);
    this.empresa.set(null);
    this.criandoContato.set(false);
    this.novoNome.set('');
    this.novoEmail.set('');
    this.novoTelefone.set('');
    this.duplicado.set(null);
    this.titulo.set('');
    this.tituloEditado.set(false);
    this.valor.set(null);
    this.etapaId.set(this.etapasAbertas()[0]?.id ?? null);
    const eu = this.sessao.usuario();
    this.responsavelId.set(eu && podeSerResponsavel(eu, this.funil().area) ? eu.id : null);
    this.enviando.set(false);
    this.enviado.set(false);
    this.erroGeral.set(null);
    this.errosApi.set({});
    void this.estado?.carregarUsuarios().catch(() => undefined);
    queueMicrotask(() => this.buscaContato()?.focar());
  }
}

/** Valor de um campo de texto, aparado. */
function texto(valor: ValorCampoTexto): string {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

/** "5511987654321" → "(11) 98765-4321" (só para leitura nas sugestões). */
export function formatarTelefone(telefone: string | null | undefined): string | null {
  if (!telefone) {
    return null;
  }
  const local = telefone.startsWith('55') && telefone.length >= 12 ? telefone.slice(2) : telefone;
  const ddd = local.slice(0, 2);
  const numero = local.slice(2);
  if (local.length === 11) {
    return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
  }
  if (local.length === 10) {
    return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
  }
  return `+${telefone}`;
}

/** Mesmo número com ou sem o 55 do Brasil. */
function mesmoTelefone(gravado: string, digitado: string): boolean {
  const semPais = (numero: string) =>
    numero.startsWith('55') && numero.length >= 12 ? numero.slice(2) : numero;
  return semPais(gravado) === semPais(digitado);
}
