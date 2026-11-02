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
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Modal } from '../../ui/modal/modal';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { gerarId } from '../../ui/tipos';
import { CampoEtiquetas } from './campo-etiquetas';
import { ContatosApi } from './contatos.api';
import {
  type AlteracaoEmpresa,
  cnpjValido,
  type Empresa,
  type EtiquetaEmUso,
  formatarTelefone,
  limparCnpj,
  normalizarEmail,
  normalizarTelefone,
  type NovaEmpresa,
  UFS,
} from './contatos.tipos';
import { textoDoCampo } from './dados-personalizados';
import { diferencaDosCampos } from './formulario-contato';

interface ChavesEmpresa {
  readonly cnpj: string | null;
  readonly nome: string | null;
}

interface EmpresasParecidas {
  readonly porCnpj: Empresa | null;
  readonly mesmoNome: Empresa | null;
  readonly parecidas: readonly Empresa[];
}

const SEM_CHAVES: ChavesEmpresa = { cnpj: null, nome: null };
const NADA: EmpresasParecidas = { porCnpj: null, mesmoNome: null, parecidas: [] };

/** R4.4: o CNPJ é opcional, mas, se vier, precisa ter os dígitos verificadores certos. */
function cnpjCorreto(controle: AbstractControl): ValidationErrors | null {
  const valor = String(controle.value ?? '').trim();
  if (!valor || cnpjValido(valor)) {
    return null;
  }
  return {
    cnpj: 'Este CNPJ não é válido: confira os números (os dois últimos são de verificação).',
  };
}

function telefoneValido(controle: AbstractControl): ValidationErrors | null {
  const digitos = String(controle.value ?? '').replace(/\D/g, '');
  return !digitos || (digitos.length >= 10 && digitos.length <= 15)
    ? null
    : { telefone: 'Digite o telefone com DDD, como (11) 3333-4444.' };
}

function mesmoNome(a: string, b: string): boolean {
  return a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'base' }) === 0;
}

type GrupoCampoPersonalizado = FormGroup<{
  chave: FormControl<string>;
  valor: FormControl<string>;
}>;

/**
 * Cadastro e edição de uma empresa (TELAS-FASE1 §4), num modal. Procura em tempo real uma
 * empresa com o mesmo CNPJ (que é único, R4.4) ou o mesmo nome e mostra a existente, com
 * o link para abrir.
 */
@Component({
  selector: 'app-formulario-empresa',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Botao,
    BotaoIcone,
    CampoEtiquetas,
    CampoTexto,
    Modal,
    Seletor,
  ],
  templateUrl: './formulario-empresa.html',
  styleUrl: './formulario.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioEmpresa {
  readonly aberto = model(false);
  /** Empresa a editar; sem ela, cria uma nova. */
  readonly empresa = input<Empresa | null>(null);
  readonly salvo = output<Empresa>();

  private readonly api = inject(ContatosApi);
  private readonly avisos = inject(AvisosService);
  private readonly sessao = inject(SessaoService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly icones = { adicionar: LucidePlus, remover: LucideX };
  protected readonly idFormulario = gerarId('formulario-empresa');
  protected readonly editando = computed(() => this.empresa() !== null);
  protected readonly salvando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);

  protected readonly form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(200)]],
    cnpj: ['', [cnpjCorreto]],
    site: ['', [Validators.maxLength(300)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    telefone: ['', [telefoneValido]],
    segmento: ['', [Validators.maxLength(120)]],
    cidade: ['', [Validators.maxLength(120)]],
    uf: this.fb.control<string | null>(null),
    responsavelId: this.fb.control<string | null>(null),
    etiquetas: this.fb.control<readonly string[]>([]),
    campos: this.fb.array<GrupoCampoPersonalizado>([]),
  });

  protected readonly opcoesUf: readonly OpcaoSeletor<string>[] = UFS.map((uf) => ({
    valor: uf,
    rotulo: uf,
  }));

  private readonly usuarios = rxResource({
    params: () => (this.aberto() ? true : undefined),
    stream: () => this.api.usuariosAtivos(),
  });

  protected readonly opcoesResponsavel = computed<readonly OpcaoSeletor<string>[]>(() => {
    const eu = this.sessao.usuario();
    const opcoes = (this.usuarios.hasValue() ? this.usuarios.value() : [])
      .map((usuario) => ({
        valor: usuario.id,
        rotulo: usuario.id === eu?.id ? `${usuario.nome} (você)` : usuario.nome,
      }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
    const atual = this.empresa()?.responsavel;
    if (atual && !opcoes.some((opcao) => opcao.valor === atual.id)) {
      opcoes.unshift({ valor: atual.id, rotulo: atual.nome });
    }
    if (eu && !opcoes.some((opcao) => opcao.valor === eu.id)) {
      opcoes.unshift({ valor: eu.id, rotulo: `${eu.nome} (você)` });
    }
    return opcoes;
  });

  protected readonly mostrarResponsavel = computed(() => this.opcoesResponsavel().length > 1);

  private readonly etiquetasEmUso = rxResource({
    params: () => (this.aberto() ? true : undefined),
    stream: () =>
      this.api.etiquetasDeEmpresas().pipe(catchError(() => of([] as readonly EtiquetaEmUso[]))),
  });

  protected readonly sugestoesEtiquetas = computed(() =>
    this.etiquetasEmUso.hasValue() ? this.etiquetasEmUso.value().map((item) => item.etiqueta) : [],
  );

  // ----- Duplicados ----------------------------------------------------------------------------

  private readonly chaves = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.chavesAtuais()),
      debounceTime(400),
      distinctUntilChanged((a, b) => a.cnpj === b.cnpj && a.nome === b.nome),
    ),
    { initialValue: SEM_CHAVES },
  );

  private readonly procura = rxResource({
    params: () => {
      const chaves = this.chaves();
      return this.aberto() && (chaves.cnpj || chaves.nome) ? chaves : undefined;
    },
    stream: ({ params }) => this.procurar(params),
  });

  protected readonly encontradas = computed<EmpresasParecidas>(() =>
    this.procura.hasValue() ? this.procura.value() : NADA,
  );

  protected readonly parecidas = computed(() => {
    const { porCnpj, mesmoNome: igual, parecidas } = this.encontradas();
    const mostradas = new Set([porCnpj?.id, igual?.id]);
    return parecidas.filter((empresa) => !mostradas.has(empresa.id));
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
    this.erroGeral.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focarPrimeiroErro();
      return;
    }
    this.salvando.set(true);
    try {
      const empresa = this.empresa();
      if (empresa) {
        await this.salvarEdicao(empresa);
      } else {
        const criada = await this.api.criarEmpresa(this.dadosDoFormulario());
        this.avisos.sucesso(`Empresa ${criada.nome} criada.`);
        this.aberto.set(false);
        this.salvo.emit(criada);
      }
    } catch (falha) {
      this.aplicarErro(erroDaApi(falha));
    } finally {
      this.salvando.set(false);
    }
  }

  // ----- Internos ------------------------------------------------------------------------------

  private preencher(): void {
    const empresa = this.empresa();
    this.erroGeral.set(null);
    this.campos.clear();
    if (empresa) {
      this.form.reset({
        nome: empresa.nome,
        cnpj: empresa.cnpjFormatado ?? empresa.cnpj ?? '',
        site: empresa.site ?? '',
        email: empresa.email ?? '',
        telefone: empresa.telefone ? formatarTelefone(empresa.telefone) : '',
        segmento: empresa.segmento ?? '',
        cidade: empresa.cidade ?? '',
        uf: empresa.uf,
        responsavelId: empresa.responsavel?.id ?? null,
        etiquetas: empresa.etiquetas,
      });
      for (const [chave, valor] of Object.entries(empresa.camposPersonalizados)) {
        this.campos.push(this.novoCampo(chave, textoDoCampo(valor)));
      }
    } else {
      this.form.reset({ responsavelId: this.sessao.usuario()?.id ?? null });
    }
  }

  private novoCampo(chave: string, valor: string): GrupoCampoPersonalizado {
    return this.fb.group({
      chave: [chave, [Validators.required, Validators.maxLength(100)]],
      valor: [valor, [Validators.maxLength(2000)]],
    });
  }

  private dadosDoFormulario(): NovaEmpresa {
    const valores = this.form.getRawValue();
    return {
      nome: valores.nome.trim(),
      cnpj: valores.cnpj.trim() || null,
      site: valores.site.trim() || null,
      email: valores.email.trim() || null,
      telefone: valores.telefone.trim() || null,
      segmento: valores.segmento.trim() || null,
      cidade: valores.cidade.trim() || null,
      uf: valores.uf,
      ...(valores.responsavelId ? { responsavelId: valores.responsavelId } : {}),
      etiquetas: valores.etiquetas,
    };
  }

  private async salvarEdicao(empresa: Empresa): Promise<void> {
    const dados = this.dadosDoFormulario();
    const valores = this.form.getRawValue();
    const mudancas: { -readonly [K in keyof AlteracaoEmpresa]: AlteracaoEmpresa[K] } = {};
    if (dados.nome !== empresa.nome) {
      mudancas.nome = dados.nome;
    }
    if (limparCnpj(dados.cnpj) !== (empresa.cnpj ?? '')) {
      mudancas.cnpj = dados.cnpj;
    }
    if ((dados.site ?? null) !== empresa.site) {
      mudancas.site = dados.site;
    }
    if (normalizarEmail(dados.email) !== empresa.email) {
      mudancas.email = dados.email;
    }
    if (normalizarTelefone(dados.telefone) !== empresa.telefone) {
      mudancas.telefone = dados.telefone;
    }
    if ((dados.segmento ?? null) !== empresa.segmento) {
      mudancas.segmento = dados.segmento;
    }
    if ((dados.cidade ?? null) !== empresa.cidade) {
      mudancas.cidade = dados.cidade;
    }
    if ((dados.uf ?? null) !== empresa.uf) {
      mudancas.uf = dados.uf;
    }
    if (dados.responsavelId && dados.responsavelId !== empresa.responsavel?.id) {
      mudancas.responsavelId = dados.responsavelId;
    }
    const etiquetas = dados.etiquetas ?? [];
    if (
      etiquetas.length !== empresa.etiquetas.length ||
      etiquetas.some((etiqueta, indice) => etiqueta !== empresa.etiquetas[indice])
    ) {
      mudancas.etiquetas = etiquetas;
    }
    const campos = diferencaDosCampos(empresa.camposPersonalizados, valores.campos);
    const corpo = campos ? { ...mudancas, camposPersonalizados: campos } : mudancas;
    if (Object.keys(corpo).length === 0) {
      this.avisos.info('Nada mudou: não havia o que salvar.');
      this.aberto.set(false);
      return;
    }
    const atualizada = await this.api.atualizarEmpresa(empresa.id, corpo);
    this.avisos.sucesso('Empresa salva.');
    this.aberto.set(false);
    this.salvo.emit(atualizada);
  }

  private chavesAtuais(): ChavesEmpresa {
    const valores = this.form.getRawValue();
    const cnpj = limparCnpj(valores.cnpj);
    const nome = valores.nome.trim();
    return {
      cnpj: cnpjValido(cnpj) ? cnpj : null,
      nome: nome.length >= 3 ? nome : null,
    };
  }

  private procurar(chaves: ChavesEmpresa): Observable<EmpresasParecidas> {
    const atualId = this.empresa()?.id ?? null;
    const buscar = (busca: string, porPagina: number) =>
      this.api
        .listarEmpresas({ busca, porPagina })
        .pipe(map((pagina) => pagina.itens.filter((empresa) => empresa.id !== atualId)));
    return forkJoin({
      porCnpj: chaves.cnpj
        ? buscar(chaves.cnpj, 5).pipe(
            map((itens) => itens.find((empresa) => empresa.cnpj === chaves.cnpj) ?? null),
          )
        : of(null),
      porNome: chaves.nome ? buscar(chaves.nome, 5) : of([] as readonly Empresa[]),
    }).pipe(
      map(({ porCnpj, porNome }) => {
        const nome = chaves.nome ?? '';
        const igual = porNome.find((empresa) => mesmoNome(empresa.nome, nome)) ?? null;
        return {
          porCnpj,
          mesmoNome: igual,
          parecidas: this.editando() ? [] : porNome.slice(0, 3),
        };
      }),
      catchError(() => of(NADA)),
    );
  }

  private aplicarErro(erro: ErroApi): void {
    const controles: Readonly<Record<string, AbstractControl | undefined>> = {
      nome: this.form.controls.nome,
      cnpj: this.form.controls.cnpj,
      site: this.form.controls.site,
      email: this.form.controls.email,
      telefone: this.form.controls.telefone,
      segmento: this.form.controls.segmento,
      cidade: this.form.controls.cidade,
      uf: this.form.controls.uf,
      responsavelId: this.form.controls.responsavelId,
      etiquetas: this.form.controls.etiquetas,
    };
    let noCampo = false;
    const marcar = (campo: string, mensagem: string) => {
      const controle = controles[campo];
      if (controle) {
        controle.setErrors({ api: mensagem });
        controle.markAsTouched();
        noCampo = true;
      }
    };
    if (erro.ehDadosInvalidos) {
      for (const campo of erro.campos) {
        marcar(campo.campo, erro.mensagemDoCampo(campo.campo) ?? erro.resumo);
      }
      if (!noCampo && erro.regra === 'R4.4') {
        marcar('cnpj', erro.resumo);
      }
    } else if (erro.ehConflito) {
      marcar('cnpj', erro.resumo);
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
        this.elemento.nativeElement
          .querySelector<HTMLElement>('dialog [aria-invalid="true"]')
          ?.focus();
      },
      { injector: this.injector },
    );
  }
}
