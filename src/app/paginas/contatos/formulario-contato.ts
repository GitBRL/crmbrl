import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucidePlus, LucideX } from '@lucide/angular';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  map,
  type Observable,
  of,
  startWith,
} from 'rxjs';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { CaixaSelecao } from '../../ui/caixa-selecao/caixa-selecao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Modal } from '../../ui/modal/modal';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { gerarId } from '../../ui/tipos';
import { CampoEmpresa, type EmpresaEscolhida } from './campo-empresa';
import { CampoEtiquetas } from './campo-etiquetas';
import { ContatosApi } from './contatos.api';
import {
  type AlteracaoContato,
  CAMPOS_UTM,
  type Contato,
  type EtiquetaEmUso,
  formatarTelefone,
  normalizarEmail,
  normalizarTelefone,
  type NovoContato,
  ORIGENS_MANUAIS,
  type OrigemContato,
  ROTULO_ORIGEM,
  ROTULO_UTM,
  type Utm,
} from './contatos.tipos';
import { textoDoCampo } from './dados-personalizados';

/** E-mail, telefone e nome que a detecção de duplicados procura. */
interface ChavesDuplicado {
  readonly email: string | null;
  readonly telefone: string | null;
  readonly nome: string | null;
}

interface Duplicados {
  readonly porEmail: Contato | null;
  readonly porTelefone: Contato | null;
  /** Nome parecido (só na criação): talvez seja a mesma pessoa. */
  readonly parecidos: readonly Contato[];
}

const SEM_CHAVES: ChavesDuplicado = { email: null, telefone: null, nome: null };
const SEM_DUPLICADOS: Duplicados = { porEmail: null, porTelefone: null, parecidos: [] };
const PAUSA_DUPLICADOS_MS = 400;
const EMAIL_PROVAVEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MENSAGEM_MEIO = 'Informe o e-mail, o telefone ou os dois.';

/** R4.1: o contato precisa de e-mail ou telefone. */
function meioDeContato(grupo: AbstractControl): ValidationErrors | null {
  const email = String(grupo.get('email')?.value ?? '').trim();
  const telefone = String(grupo.get('telefone')?.value ?? '').trim();
  return email || telefone ? null : { meioDeContato: true };
}

/** Telefone com DDD: de 10 a 15 dígitos (o código do país é opcional). */
function telefoneValido(controle: AbstractControl): ValidationErrors | null {
  const digitos = String(controle.value ?? '').replace(/\D/g, '');
  if (!digitos) {
    return null;
  }
  return digitos.length >= 10 && digitos.length <= 15
    ? null
    : { telefone: 'Digite o telefone com DDD, como (11) 98765-4321.' };
}

/** Consentimento marcado precisa dizer de onde veio (R4.6). */
function consentimentoCompleto(grupo: AbstractControl): ValidationErrors | null {
  const marcado = grupo.get('temConsentimento')?.value === true;
  const origem = String(grupo.get('consentimentoOrigem')?.value ?? '').trim();
  return marcado && !origem ? { consentimentoSemOrigem: true } : null;
}

function mesmasChaves(a: ChavesDuplicado, b: ChavesDuplicado): boolean {
  return a.email === b.email && a.telefone === b.telefone && a.nome === b.nome;
}

type GrupoCampoPersonalizado = FormGroup<{
  chave: FormControl<string>;
  valor: FormControl<string>;
}>;

/**
 * Cadastro e edição de uma pessoa (TELAS-FASE1 §4), num modal. Na criação, procura em tempo
 * real um contato com o mesmo e-mail ou telefone (R4.2) — mostra o existente e oferece abrir —
 * e pessoas com nome parecido. Salvar com o e-mail ou o telefone de alguém não duplica: a API
 * completa o existente e registra a reconversão, e a tela avisa. Na edição, só o que mudou
 * vai para a API.
 */
@Component({
  selector: 'app-formulario-contato',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Botao,
    BotaoIcone,
    CaixaSelecao,
    CampoEmpresa,
    CampoEtiquetas,
    CampoTexto,
    Modal,
    Seletor,
  ],
  templateUrl: './formulario-contato.html',
  styleUrl: './formulario.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioContato {
  readonly aberto = model(false);
  /** Contato a editar; sem ele, o formulário cria um novo. */
  readonly contato = input<Contato | null>(null);
  /** Na criação: a empresa já escolhida (cadastro a partir do detalhe da empresa). */
  readonly empresaInicial = input<EmpresaEscolhida | null>(null);
  readonly salvo = output<Contato>();

  private readonly api = inject(ContatosApi);
  private readonly avisos = inject(AvisosService);
  private readonly sessao = inject(SessaoService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly icones = { adicionar: LucidePlus, remover: LucideX };
  protected readonly idFormulario = gerarId('formulario-contato');
  protected readonly camposUtm = CAMPOS_UTM;
  protected readonly rotuloUtm = ROTULO_UTM;
  protected readonly editando = computed(() => this.contato() !== null);
  protected readonly salvando = signal(false);
  protected readonly enviado = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  /** 409 na edição: o outro contato que já tem o e-mail ou o telefone. */
  protected readonly outroContatoId = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      nome: ['', [Validators.required, Validators.maxLength(200)]],
      email: ['', [Validators.email, Validators.maxLength(254)]],
      telefone: ['', [telefoneValido]],
      cargo: ['', [Validators.maxLength(200)]],
      empresa: this.fb.control<EmpresaEscolhida | null>(null),
      responsavelId: this.fb.control<string | null>(null),
      origem: this.fb.control<OrigemContato | null>('MANUAL'),
      origemDetalhe: ['', [Validators.maxLength(200)]],
      utm: this.fb.group({ source: '', medium: '', campaign: '', term: '', content: '' }),
      etiquetas: this.fb.control<readonly string[]>([]),
      optOutMarketing: false,
      temConsentimento: false,
      consentimentoOrigem: ['', [Validators.maxLength(200)]],
      campos: this.fb.array<GrupoCampoPersonalizado>([]),
    },
    { validators: [meioDeContato, consentimentoCompleto] },
  );

  /** Muda a cada evento do formulário (os computed das mensagens leem o estado dele). */
  private readonly versao = toSignal(this.form.events.pipe(map((_, indice) => indice + 1)), {
    initialValue: 0,
  });

  protected readonly opcoesOrigem: readonly OpcaoSeletor<OrigemContato>[] = ORIGENS_MANUAIS.map(
    (origem) => ({ valor: origem, rotulo: ROTULO_ORIGEM[origem] }),
  );

  // ----- Responsável ---------------------------------------------------------------------------

  private readonly usuarios = rxResource({
    params: () => (this.aberto() ? true : undefined),
    stream: () => this.api.usuariosAtivos(),
  });

  protected readonly opcoesResponsavel = computed<readonly OpcaoSeletor<string>[]>(() => {
    const eu = this.sessao.usuario();
    const usuarios = this.usuarios.hasValue() ? this.usuarios.value() : [];
    const opcoes = usuarios
      .map((usuario) => ({
        valor: usuario.id,
        rotulo: usuario.id === eu?.id ? `${usuario.nome} (você)` : usuario.nome,
      }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
    const atual = this.contato()?.responsavel;
    if (atual && !opcoes.some((opcao) => opcao.valor === atual.id)) {
      opcoes.unshift({ valor: atual.id, rotulo: atual.nome });
    }
    if (eu && !opcoes.some((opcao) => opcao.valor === eu.id)) {
      opcoes.unshift({ valor: eu.id, rotulo: `${eu.nome} (você)` });
    }
    return opcoes;
  });

  /** O membro só atribui a si mesmo (§12): o seletor só aparece com mais de uma escolha. */
  protected readonly mostrarResponsavel = computed(() => this.opcoesResponsavel().length > 1);

  private readonly etiquetasEmUso = rxResource({
    params: () => (this.aberto() ? true : undefined),
    stream: () =>
      this.api.etiquetasDeContatos().pipe(catchError(() => of([] as readonly EtiquetaEmUso[]))),
  });

  protected readonly sugestoesEtiquetas = computed(() =>
    this.etiquetasEmUso.hasValue() ? this.etiquetasEmUso.value().map((item) => item.etiqueta) : [],
  );

  // ----- Duplicados (R4.2) ---------------------------------------------------------------------

  private readonly chaves = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.chavesAtuais()),
      debounceTime(PAUSA_DUPLICADOS_MS),
      distinctUntilChanged(mesmasChaves),
    ),
    { initialValue: SEM_CHAVES },
  );

  private readonly duplicados = rxResource({
    params: () => {
      const chaves = this.chaves();
      return this.aberto() && (chaves.email || chaves.telefone || chaves.nome) ? chaves : undefined;
    },
    stream: ({ params }) => this.procurarDuplicados(params),
  });

  protected readonly encontrados = computed<Duplicados>(() =>
    this.duplicados.hasValue() ? this.duplicados.value() : SEM_DUPLICADOS,
  );

  /** O mesmo contato pelo e-mail e pelo telefone aparece uma vez só. */
  protected readonly existentes = computed(() => {
    const { porEmail, porTelefone } = this.encontrados();
    const lista: { contato: Contato; motivo: string }[] = [];
    if (porEmail && porTelefone && porEmail.id === porTelefone.id) {
      lista.push({ contato: porEmail, motivo: 'o mesmo e-mail e o mesmo telefone' });
      return lista;
    }
    if (porEmail) {
      lista.push({ contato: porEmail, motivo: 'o mesmo e-mail' });
    }
    if (porTelefone) {
      lista.push({ contato: porTelefone, motivo: 'o mesmo telefone' });
    }
    return lista;
  });

  protected readonly parecidos = computed(() => {
    const existentes = new Set(this.existentes().map((item) => item.contato.id));
    return this.encontrados().parecidos.filter((contato) => !existentes.has(contato.id));
  });

  // ----- Mensagens dos campos ------------------------------------------------------------------

  protected readonly erroMeio = computed(() => {
    this.versao();
    return this.enviado() && this.form.hasError('meioDeContato') ? MENSAGEM_MEIO : null;
  });

  protected readonly erroConsentimento = computed(() => {
    this.versao();
    return this.enviado() && this.form.hasError('consentimentoSemOrigem')
      ? 'Diga de onde veio o consentimento (ex.: formulário do site).'
      : null;
  });

  protected readonly temConsentimento = computed(() => {
    this.versao();
    return this.form.controls.temConsentimento.value;
  });

  protected get campos(): FormArray<GrupoCampoPersonalizado> {
    return this.form.controls.campos;
  }

  constructor() {
    effect(() => {
      if (this.aberto()) {
        untracked(() => this.preencher());
      }
    });
  }

  protected fechar(): void {
    this.aberto.set(false);
  }

  protected adicionarCampo(): void {
    this.campos.push(this.novoCampo('', ''));
  }

  protected removerCampo(indice: number): void {
    this.campos.removeAt(indice);
  }

  protected async salvar(): Promise<void> {
    this.enviado.set(true);
    this.erroGeral.set(null);
    this.outroContatoId.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focarPrimeiroErro();
      return;
    }
    this.salvando.set(true);
    try {
      const contato = this.contato();
      if (contato) {
        await this.salvarEdicao(contato);
      } else {
        await this.salvarCriacao();
      }
    } catch (falha) {
      this.aplicarErro(erroDaApi(falha));
    } finally {
      this.salvando.set(false);
    }
  }

  // ----- Internos ------------------------------------------------------------------------------

  private preencher(): void {
    const contato = this.contato();
    this.enviado.set(false);
    this.erroGeral.set(null);
    this.outroContatoId.set(null);
    this.campos.clear();
    if (contato) {
      this.form.reset({
        nome: contato.nome,
        email: contato.email ?? '',
        telefone: contato.telefone ? formatarTelefone(contato.telefone) : '',
        cargo: contato.cargo ?? '',
        empresa: contato.empresa ? { id: contato.empresa.id, nome: contato.empresa.nome } : null,
        responsavelId: contato.responsavel?.id ?? null,
        etiquetas: contato.etiquetas,
      });
      for (const [chave, valor] of Object.entries(contato.camposPersonalizados)) {
        this.campos.push(this.novoCampo(chave, textoDoCampo(valor)));
      }
    } else {
      this.form.reset({
        responsavelId: this.sessao.usuario()?.id ?? null,
        origem: 'MANUAL',
        empresa: this.empresaInicial(),
      });
    }
  }

  private novoCampo(chave: string, valor: string): GrupoCampoPersonalizado {
    return this.fb.group({
      chave: [chave, [Validators.required, Validators.maxLength(100)]],
      valor: [valor, [Validators.maxLength(2000)]],
    });
  }

  private chavesAtuais(): ChavesDuplicado {
    const valores = this.form.getRawValue();
    const email = normalizarEmail(valores.email);
    const telefone = normalizarTelefone(valores.telefone);
    const nome = valores.nome.trim();
    return {
      email: email && EMAIL_PROVAVEL.test(email) ? email : null,
      telefone: telefone && telefone.length >= 12 ? telefone : null,
      // Nome parecido só ajuda na criação.
      nome: !this.editando() && nome.length >= 3 ? nome : null,
    };
  }

  private procurarDuplicados(chaves: ChavesDuplicado): Observable<Duplicados> {
    const atualId = this.contato()?.id ?? null;
    const buscar = (busca: string, porPagina: number) =>
      this.api
        .listarContatos({ busca, porPagina })
        .pipe(map((pagina) => pagina.itens.filter((contato) => contato.id !== atualId)));
    return forkJoin({
      porEmail: chaves.email
        ? buscar(chaves.email, 5).pipe(
            map((itens) => itens.find((contato) => contato.email === chaves.email) ?? null),
          )
        : of(null),
      porTelefone: chaves.telefone
        ? buscar(chaves.telefone, 5).pipe(
            map((itens) => itens.find((contato) => contato.telefone === chaves.telefone) ?? null),
          )
        : of(null),
      parecidos: chaves.nome
        ? buscar(chaves.nome, 4).pipe(map((itens) => itens.slice(0, 3)))
        : of([] as readonly Contato[]),
    }).pipe(
      // A detecção é ajuda: se a busca falhar, salvar continua possível (a API deduplica).
      catchError(() => of(SEM_DUPLICADOS)),
    );
  }

  private async salvarCriacao(): Promise<void> {
    const valores = this.form.getRawValue();
    const empresa = valores.empresa;
    const dados: NovoContato = {
      nome: valores.nome.trim(),
      email: valores.email.trim() || null,
      telefone: valores.telefone.trim() || null,
      cargo: valores.cargo.trim() || null,
      ...(empresa?.id
        ? { empresaId: empresa.id }
        : empresa?.nome.trim()
          ? { empresaNome: empresa.nome.trim() }
          : {}),
      ...(valores.responsavelId ? { responsavelId: valores.responsavelId } : {}),
      origem: valores.origem ?? 'MANUAL',
      origemDetalhe: valores.origemDetalhe.trim() || null,
      utm: utmPreenchida(valores.utm),
      etiquetas: valores.etiquetas,
      optOutMarketing: valores.optOutMarketing,
      consentimento: valores.temConsentimento
        ? { origem: valores.consentimentoOrigem.trim() }
        : null,
    };
    const resultado = await this.api.criarContato(dados);
    if (resultado.criado) {
      this.avisos.sucesso(`Contato ${resultado.contato.nome} criado.`);
    } else {
      this.avisos.info(
        `${resultado.contato.nome} já estava no CRM: completamos os dados que faltavam e registramos a nova entrada.`,
        { titulo: 'Contato já existia' },
      );
    }
    this.aberto.set(false);
    this.salvo.emit(resultado.contato);
  }

  private async salvarEdicao(contato: Contato): Promise<void> {
    const valores = this.form.getRawValue();
    const mudancas: { -readonly [K in keyof AlteracaoContato]: AlteracaoContato[K] } = {};
    const nome = valores.nome.trim();
    if (nome !== contato.nome) {
      mudancas.nome = nome;
    }
    const email = normalizarEmail(valores.email);
    if (email !== (contato.email ?? null)) {
      mudancas.email = email;
    }
    const telefone = normalizarTelefone(valores.telefone);
    if (telefone !== (contato.telefone ?? null)) {
      mudancas.telefone = valores.telefone.trim() || null;
    }
    const cargo = valores.cargo.trim() || null;
    if (cargo !== (contato.cargo ?? null)) {
      mudancas.cargo = cargo;
    }
    const empresaId = await this.idDaEmpresa(valores.empresa);
    if (empresaId !== (contato.empresa?.id ?? null)) {
      mudancas.empresaId = empresaId;
    }
    if (valores.responsavelId && valores.responsavelId !== contato.responsavel?.id) {
      mudancas.responsavelId = valores.responsavelId;
    }
    if (!mesmaLista(valores.etiquetas, contato.etiquetas)) {
      mudancas.etiquetas = valores.etiquetas;
    }
    const campos = diferencaDosCampos(contato.camposPersonalizados, valores.campos);
    if (campos) {
      mudancas.camposPersonalizados = campos;
    }
    if (Object.keys(mudancas).length === 0) {
      this.avisos.info('Nada mudou: não havia o que salvar.');
      this.aberto.set(false);
      return;
    }
    const atualizado = await this.api.atualizarContato(contato.id, mudancas);
    this.avisos.sucesso('Contato salvo.');
    this.aberto.set(false);
    this.salvo.emit(atualizado);
  }

  /** Empresa nova digitada na edição: cadastra antes (o PATCH só aceita o id). */
  private async idDaEmpresa(empresa: EmpresaEscolhida | null): Promise<string | null> {
    if (!empresa?.nome.trim()) {
      return null;
    }
    if (empresa.id) {
      return empresa.id;
    }
    const nova = await this.api.criarEmpresa({ nome: empresa.nome.trim() });
    this.form.controls.empresa.setValue({ id: nova.id, nome: nova.nome });
    this.avisos.info(`Empresa ${nova.nome} cadastrada.`);
    return nova.id;
  }

  private aplicarErro(erro: ErroApi): void {
    const controles: Readonly<Record<string, AbstractControl | undefined>> = {
      nome: this.form.controls.nome,
      email: this.form.controls.email,
      telefone: this.form.controls.telefone,
      cargo: this.form.controls.cargo,
      empresaId: this.form.controls.empresa,
      empresaNome: this.form.controls.empresa,
      responsavelId: this.form.controls.responsavelId,
      origem: this.form.controls.origem,
      origemDetalhe: this.form.controls.origemDetalhe,
      etiquetas: this.form.controls.etiquetas,
      'consentimento.origem': this.form.controls.consentimentoOrigem,
    };
    let noCampo = false;
    const marcar = (campo: string, mensagem: string) => {
      const controle =
        controles[campo] ?? (campo.startsWith('utm') ? this.form.controls.utm : undefined);
      if (controle) {
        controle.setErrors({ api: mensagem });
        controle.markAsTouched();
        noCampo = true;
      }
    };
    if (erro.regra === 'R4.1') {
      marcar('email', erro.resumo);
      marcar('telefone', erro.resumo);
    } else if (erro.ehDadosInvalidos) {
      for (const campo of erro.campos) {
        marcar(campo.campo, erro.mensagemDoCampo(campo.campo) ?? erro.resumo);
      }
    } else if (erro.ehConflito) {
      const campos = erro.detalhes?.['campos'];
      for (const campo of Array.isArray(campos) ? campos : []) {
        marcar(String(campo), erro.resumo);
      }
      const outro = erro.detalhes?.['contatoId'];
      this.outroContatoId.set(typeof outro === 'string' ? outro : null);
    } else if (
      erro.regra === 'R4.5' ||
      (erro.ehSemPermissao && erro.detalhes?.['responsavelId'] !== undefined)
    ) {
      marcar('responsavelId', erro.resumo);
    }
    if (noCampo) {
      this.focarPrimeiroErro();
    } else {
      this.erroGeral.set(erro.mensagem);
    }
  }

  private focarPrimeiroErro(): void {
    afterNextRender(
      () => {
        const invalido = this.elemento.nativeElement.querySelector<HTMLElement>(
          'dialog [aria-invalid="true"]',
        );
        invalido?.focus();
      },
      { injector: this.injector },
    );
  }
}

/** UTM só com as partes preenchidas (ou `null`). */
export function utmPreenchida(utm: Readonly<Record<keyof Utm, string>>): Utm | null {
  const preenchida: Record<string, string> = {};
  for (const campo of CAMPOS_UTM) {
    const valor = utm[campo]?.trim();
    if (valor) {
      preenchida[campo] = valor;
    }
  }
  return Object.keys(preenchida).length ? (preenchida as Utm) : null;
}

function mesmaLista(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, indice) => item === b[indice]);
}

/**
 * O que mudou nos campos personalizados, no formato do PATCH (R4.7): chaves novas ou com outro
 * valor vão com o texto; chaves tiradas vão com `null`. Nada mudou: `null`.
 */
export function diferencaDosCampos(
  originais: Readonly<Record<string, unknown>>,
  linhas: readonly { readonly chave: string; readonly valor: string }[],
): Record<string, string | null> | null {
  const atuais = new Map(
    linhas
      .map((linha) => [linha.chave.trim(), linha.valor] as const)
      .filter(([chave]) => chave !== ''),
  );
  const mudancas: Record<string, string | null> = {};
  for (const chave of Object.keys(originais)) {
    if (!atuais.has(chave)) {
      mudancas[chave] = null;
    }
  }
  for (const [chave, valor] of atuais) {
    const antes = chave in originais ? textoDoCampo(originais[chave]) : null;
    if (antes !== valor) {
      mudancas[chave] = valor;
    }
  }
  return Object.keys(mudancas).length ? mudancas : null;
}
