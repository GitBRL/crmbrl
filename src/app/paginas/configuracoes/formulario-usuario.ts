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
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideKeyRound, LucideSend } from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarDataHora } from '../../nucleo/formatos';
import { PAPEIS, papelExigeSetor, ROTULO_PAPEL, type Papel } from '../../nucleo/papeis';
import { SENHA_MAXIMO, SENHA_MINIMO } from '../../nucleo/sessao/perfil';
import { SetoresService } from '../../nucleo/setores/setores.service';
import { Botao } from '../../ui/botao/botao';
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { Modal } from '../../ui/modal/modal';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { gerarId } from '../../ui/tipos';
import { ConfiguracoesApi } from './configuracoes.api';
import type { DadosEdicaoUsuario, DadosNovoUsuario, Usuario } from './configuracoes.modelos';
import {
  aguardaNovoLider,
  AJUDA_LIDER,
  explicacaoDoLider,
  liderEsperado,
  semLiderDisponivel,
} from './hierarquia';
import { CandidatosALider } from './lideres';
import { formatarTelefone, gerarSenha } from './textos';

/** Abrir o formulário: convidar alguém novo ou editar um usuário. */
export type PedidoFormularioUsuario =
  { readonly modo: 'convidar' } | { readonly modo: 'editar'; readonly usuario: Usuario };

type Acesso = 'convite' | 'senha';

const OPCOES_ACESSO: readonly OpcaoGrupo<Acesso>[] = [
  {
    valor: 'convite',
    rotulo: 'Enviar convite por e-mail',
    dica: 'A pessoa recebe um link para criar a própria senha. O link vale 24 horas.',
    icone: LucideSend,
  },
  {
    valor: 'senha',
    rotulo: 'Definir uma senha temporária',
    dica: 'Você passa a senha para a pessoa, que troca por uma só dela no primeiro acesso.',
    icone: LucideKeyRound,
  },
];

/** Os papéis no seletor: Admin, C-level, Líder e Membro (o setor vai em outro campo). */
export const OPCOES_PAPEL: readonly OpcaoSeletor<Papel>[] = PAPEIS.map((papel) => ({
  valor: papel,
  rotulo: ROTULO_PAPEL[papel],
}));

/**
 * Convidar e editar usuário (TELAS-FASE1 §6, Admin): nome, e-mail, papel, setor (obrigatório para
 * Líder e Membro) e líder. O seletor de líder só oferece quem a regra R1.2 permite — líderes
 * ativos do mesmo setor para o membro, C-levels para o líder — e diz por quê. Os erros da API (e-mail repetido, hierarquia, liderados que
 * ficariam sem líder) voltam para o campo certo.
 */
@Component({
  selector: 'app-formulario-usuario',
  imports: [ReactiveFormsModule, Modal, Botao, CampoTexto, CampoSenha, Seletor, GrupoOpcoes],
  templateUrl: './formulario-usuario.html',
  styleUrl: './formulario-usuario.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioUsuario {
  /** `null` = fechado. */
  readonly pedido = input<PedidoFormularioUsuario | null>(null);
  /** O usuário criado ou alterado (a lista recarrega). */
  readonly salvo = output<Usuario>();
  readonly fechado = output<void>();

  private readonly api = inject(ConfiguracoesApi);
  private readonly avisos = inject(AvisosService);
  protected readonly setores = inject(SetoresService);

  protected readonly idFormulario = gerarId('formulario-usuario');
  protected readonly opcoesAcesso = OPCOES_ACESSO;
  protected readonly opcoesPapel = OPCOES_PAPEL;
  protected readonly ajudaLider = AJUDA_LIDER;
  protected readonly mensagensIdentificador = {
    pattern: 'Use só letras, números e . _ - @ + :',
  };
  protected readonly senhaMinimo = SENHA_MINIMO;

  protected readonly formulario = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    papel: new FormControl<Papel | null>(null, { validators: [Validators.required] }),
    area: new FormControl<string | null>(null),
    liderId: new FormControl<string | null>(null),
    telefone: new FormControl('', { nonNullable: true }),
    identificador: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100), Validators.pattern(/^[A-Za-z0-9._@+:-]*$/)],
    }),
    acesso: new FormControl<Acesso>('convite', { nonNullable: true }),
    senha: new FormControl('', { nonNullable: true }),
  });

  /** O papel escolhido, como signal (define as opções de líder). */
  protected readonly papel = signal<Papel | null>(null);
  /** O setor escolhido, como signal (define quem pode ser líder de um membro). */
  protected readonly area = signal<string | null>(null);
  protected readonly exigeSetor = computed(() => papelExigeSetor(this.papel()));
  /** Setores ativos; o setor atual de quem está sendo editado entra mesmo se estiver inativo. */
  protected readonly opcoesSetor = computed(() => this.setores.opcoesCom(this.editando()?.area));
  protected readonly acesso = signal<Acesso>('convite');
  private readonly liderIdAtual = signal<string | null>(null);

  protected readonly lideres = new CandidatosALider(this.api);
  protected readonly editando = computed(() => {
    const pedido = this.pedido();
    return pedido?.modo === 'editar' ? pedido.usuario : null;
  });
  protected readonly titulo = computed(() => {
    const usuario = this.editando();
    return usuario ? `Editar ${usuario.nome}` : 'Convidar usuário';
  });
  protected readonly liderNecessario = computed(() => {
    const papel = this.papel();
    return papel !== null && liderEsperado(papel) !== null;
  });
  protected readonly explicacaoLider = computed(() => explicacaoDoLider(this.papel(), this.area()));

  /** Quem pode liderar o papel escolhido (R1.2), já sem a própria pessoa. */
  protected readonly opcoesLider = computed<readonly OpcaoSeletor<string>[]>(() => {
    const usuario = this.editando();
    const opcoes = (this.lideres.candidatos() ?? [])
      .filter((candidato) => candidato.id !== usuario?.id)
      .map((candidato) => ({ valor: candidato.id, rotulo: candidato.nome }));
    // O líder atual fora da regra (provisório depois de um desligamento, R7.3) continua visível.
    const atual = usuario?.lider;
    if (
      atual &&
      usuario.papel === this.papel() &&
      usuario.area === this.area() &&
      !opcoes.some((o) => o.valor === atual.id)
    ) {
      opcoes.push({ valor: atual.id, rotulo: `${atual.nome} (provisório)` });
    }
    return opcoes;
  });
  protected readonly semCandidatos = computed(
    () =>
      this.liderNecessario() &&
      (this.papel() !== 'MEMBRO' || !!this.area()) &&
      this.lideres.candidatos() !== null &&
      !this.lideres.carregando() &&
      this.opcoesLider().length === 0,
  );
  protected readonly mensagemSemCandidatos = computed(() => {
    const papel = this.papel();
    return papel ? semLiderDisponivel(papel, this.area()) : '';
  });
  /** Editando alguém que responde provisoriamente a quem recebeu a equipe (R7.3). */
  protected readonly liderProvisorio = computed(() => {
    const usuario = this.editando();
    return (
      usuario !== null &&
      usuario.lider !== null &&
      usuario.papel === this.papel() &&
      usuario.area === this.area() &&
      this.liderIdAtual() === usuario.lider.id &&
      aguardaNovoLider(usuario)
    );
  });

  protected readonly enviando = signal(false);
  protected readonly erroGeral = signal<ErroApi | null>(null);
  protected readonly aberto = computed(() => this.pedido() !== null);

  private readonly campoNome = viewChild<CampoTexto>('campoNome');
  private readonly campoEmail = viewChild<CampoTexto>('campoEmail');
  private readonly campoPapel = viewChild<Seletor<Papel>>('campoPapel');
  private readonly campoSetor = viewChild<Seletor<string>>('campoSetor');
  private readonly campoLider = viewChild<Seletor<string>>('campoLider');
  private readonly campoSenha = viewChild<CampoSenha>('campoSenha');

  constructor() {
    const controles = this.formulario.controls;
    void this.setores.carregar();
    controles.papel.valueChanges.pipe(takeUntilDestroyed()).subscribe((papel) => {
      this.papel.set(papel);
      this.ajustarSetor(papel);
      void this.aoMudarPapel(papel);
    });
    controles.area.valueChanges.pipe(takeUntilDestroyed()).subscribe((area) => {
      this.area.set(area);
      void this.aoMudarPapel(this.papel());
    });
    controles.acesso.valueChanges.pipe(takeUntilDestroyed()).subscribe((acesso) => {
      this.acesso.set(acesso);
      this.ajustarSenha(acesso);
    });
    controles.liderId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.liderIdAtual.set(id));

    // Cada abertura começa do zero (ou com os dados do usuário editado).
    effect(() => {
      const pedido = this.pedido();
      if (pedido) {
        untracked(() => this.preencher(pedido));
      }
    });
  }

  protected fechar(): void {
    this.fechado.emit();
  }

  protected gerarSenha(): void {
    const campo = this.formulario.controls.senha;
    campo.setValue(gerarSenha());
    campo.markAsTouched();
    this.campoSenha()?.visivel.set(true);
  }

  protected recarregarLideres(): void {
    void this.aoMudarPapel(this.papel(), { recarregar: true });
  }

  protected async salvar(): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.erroGeral.set(null);
    // Esquece o erro da tentativa anterior (o `setErrors` da API fica até revalidar).
    Object.values(this.formulario.controls).forEach((controle) =>
      controle.updateValueAndValidity({ emitEvent: false }),
    );
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.semCandidatos()) {
      this.focarPrimeiroInvalido();
      return;
    }
    const pedido = this.pedido();
    if (!pedido) {
      return;
    }
    this.enviando.set(true);
    try {
      if (pedido.modo === 'convidar') {
        await this.convidar();
      } else {
        await this.editar(pedido.usuario);
      }
    } catch (falha) {
      this.mostrarErro(erroDaApi(falha));
    } finally {
      this.enviando.set(false);
    }
  }

  private async convidar(): Promise<void> {
    const valor = this.formulario.getRawValue();
    const papel = valor.papel!;
    const telefone = valor.telefone.trim();
    const dados: DadosNovoUsuario = {
      nome: valor.nome.trim(),
      email: valor.email.trim(),
      papel,
      ...(papelExigeSetor(papel) ? { area: valor.area } : {}),
      ...(liderEsperado(papel) ? { liderId: valor.liderId } : {}),
      ...(telefone ? { telefone } : {}),
      ...(valor.identificador.trim()
        ? { identificadorIntegracao: valor.identificador.trim() }
        : {}),
      ...(valor.acesso === 'senha' ? { senhaTemporaria: valor.senha } : {}),
    };
    const criado = await this.api.criarUsuario(dados);
    const nome = criado.usuario.nome;
    if (!criado.convite) {
      this.avisos.sucesso(
        `${nome} foi cadastrado(a). A troca da senha é pedida no primeiro acesso.`,
      );
    } else if (criado.convite.enviado) {
      const validade = criado.convite.expiraEm
        ? ` O link vale até ${formatarDataHora(criado.convite.expiraEm)}.`
        : '';
      this.avisos.sucesso(`Convite enviado para ${criado.usuario.email}.${validade}`);
    } else {
      this.avisos.atencao(
        `${nome} foi cadastrado(a), mas o e-mail do convite não saiu. Use “Reenviar convite” no menu da pessoa.`,
        { duracao: 0 },
      );
    }
    this.salvo.emit(criado.usuario);
    this.fechado.emit();
  }

  private async editar(usuario: Usuario): Promise<void> {
    const alteracoes = this.alteracoes(usuario);
    if (Object.keys(alteracoes).length === 0) {
      this.avisos.info('Nada mudou: não havia o que salvar.');
      this.fechado.emit();
      return;
    }
    const atualizado = await this.api.atualizarUsuario(usuario.id, alteracoes);
    this.avisos.sucesso(`Alterações de ${atualizado.nome} salvas.`);
    this.salvo.emit(atualizado);
    this.fechado.emit();
  }

  /** Só o que mudou vai para a API (o líder provisório não é revalidado à toa). */
  private alteracoes(usuario: Usuario): DadosEdicaoUsuario {
    const valor = this.formulario.getRawValue();
    const papel = valor.papel!;
    const liderId = liderEsperado(papel) ? valor.liderId : null;
    const telefone = valor.telefone.trim();
    const identificador = valor.identificador.trim();
    return {
      ...(valor.nome.trim() !== usuario.nome ? { nome: valor.nome.trim() } : {}),
      ...(valor.email.trim().toLowerCase() !== usuario.email ? { email: valor.email.trim() } : {}),
      ...(papel !== usuario.papel ? { papel } : {}),
      ...(papelExigeSetor(papel) && (papel !== usuario.papel || valor.area !== usuario.area)
        ? { area: valor.area }
        : {}),
      ...(liderId !== (usuario.lider?.id ?? null) ? { liderId } : {}),
      ...(telefone !== formatarTelefone(usuario.telefone) ? { telefone: telefone || null } : {}),
      ...(identificador !== (usuario.identificadorIntegracao ?? '')
        ? { identificadorIntegracao: identificador || null }
        : {}),
    };
  }

  /** Cada erro da API no campo certo; o resto numa mensagem dentro do modal. */
  private mostrarErro(erro: ErroApi): void {
    const c = this.formulario.controls;
    const noCampo = (controle: FormControl<unknown>, mensagem: string): void => {
      controle.setErrors({ api: mensagem });
      controle.markAsTouched();
    };
    const porCampo: Readonly<Record<string, FormControl<unknown>>> = {
      nome: c.nome as FormControl<unknown>,
      email: c.email as FormControl<unknown>,
      papel: c.papel as FormControl<unknown>,
      area: c.area as FormControl<unknown>,
      liderId: c.liderId as FormControl<unknown>,
      telefone: c.telefone as FormControl<unknown>,
      identificadorIntegracao: c.identificador as FormControl<unknown>,
      senhaTemporaria: c.senha as FormControl<unknown>,
    };
    let noLugar = false;
    if (erro.ehDadosInvalidos) {
      for (const { campo } of erro.campos) {
        const mensagem = erro.mensagemDoCampo(campo);
        if (porCampo[campo] && mensagem) {
          noCampo(porCampo[campo], mensagem);
          noLugar = true;
        }
      }
    }
    if (!noLugar) {
      const regra = erro.regra;
      const alvo =
        regra === 'R1.1' || (erro.ehConflito && /e-mail/i.test(erro.resumo))
          ? porCampo['email']
          : erro.ehConflito && /identificador/i.test(erro.resumo)
            ? porCampo['identificadorIntegracao']
            : regra === 'R1.9'
              ? porCampo['area']
              : regra === 'R1.2'
                ? this.liderNecessario()
                  ? porCampo['liderId']
                  : porCampo['papel']
                : regra === 'R1.3'
                  ? // Líder com liderados não muda de setor nem deixa de ser líder.
                    this.exigeSetor() && this.area() !== this.editando()?.area
                    ? porCampo['area']
                    : porCampo['papel']
                  : regra === 'R1.4'
                    ? porCampo['papel']
                    : regra === 'R2.8'
                      ? (c.acesso as FormControl<unknown>)
                      : null;
      if (alvo) {
        noCampo(alvo, erro.resumo);
        noLugar = true;
      }
    }
    if (noLugar) {
      this.focarPrimeiroInvalido();
    } else {
      this.erroGeral.set(erro);
    }
  }

  private preencher(pedido: PedidoFormularioUsuario): void {
    this.erroGeral.set(null);
    this.enviando.set(false);
    const usuario = pedido.modo === 'editar' ? pedido.usuario : null;
    this.formulario.reset(
      {
        nome: usuario?.nome ?? '',
        email: usuario?.email ?? '',
        papel: usuario?.papel ?? null,
        area: usuario?.area ?? null,
        liderId: usuario?.lider?.id ?? null,
        telefone: formatarTelefone(usuario?.telefone ?? null),
        identificador: usuario?.identificadorIntegracao ?? '',
        acesso: 'convite',
        senha: '',
      },
      { emitEvent: false },
    );
    // Sem eventos no reset: os signals e as opções de líder são sincronizados aqui.
    this.papel.set(usuario?.papel ?? null);
    this.area.set(usuario?.area ?? null);
    this.ajustarSetor(usuario?.papel ?? null);
    this.liderIdAtual.set(usuario?.lider?.id ?? null);
    this.acesso.set('convite');
    this.ajustarSenha('convite');
    this.lideres.esquecer();
    this.lideres.reiniciar();
    void this.aoMudarPapel(usuario?.papel ?? null);
  }

  /** Troca de papel: busca quem pode liderar (R1.2) e ajusta o líder escolhido. */
  private async aoMudarPapel(
    papel: Papel | null,
    opcoes: { recarregar?: boolean } = {},
  ): Promise<void> {
    const liderId = this.formulario.controls.liderId;
    if (!papel || !liderEsperado(papel)) {
      liderId.setValidators([]);
      liderId.setValue(null);
      liderId.disable();
      await this.lideres.carregar(papel, this.area());
      return;
    }
    liderId.setValidators([Validators.required]);
    liderId.enable();
    const candidatos = await this.lideres.carregar(papel, this.area(), opcoes.recarregar);
    if (candidatos === null) {
      return;
    }
    const disponiveis = this.opcoesLider();
    if (!disponiveis.some((opcao) => opcao.valor === liderId.value)) {
      // Com uma opção só, ela já vem escolhida.
      liderId.setValue(disponiveis.length === 1 ? disponiveis[0].valor : null);
    }
  }

  /** Setor é obrigatório para Líder e Membro; Admin e C-level não têm setor. */
  private ajustarSetor(papel: Papel | null): void {
    const area = this.formulario.controls.area;
    if (papelExigeSetor(papel)) {
      area.setValidators([Validators.required]);
      area.enable({ emitEvent: false });
    } else {
      area.setValidators([]);
      area.setValue(null, { emitEvent: false });
      this.area.set(null);
      area.disable({ emitEvent: false });
    }
    area.updateValueAndValidity({ emitEvent: false });
  }

  private ajustarSenha(acesso: Acesso): void {
    const senha = this.formulario.controls.senha;
    if (acesso === 'senha' && this.pedido()?.modo === 'convidar') {
      senha.setValidators([
        Validators.required,
        Validators.minLength(SENHA_MINIMO),
        Validators.maxLength(SENHA_MAXIMO),
      ]);
      senha.enable({ emitEvent: false });
    } else {
      senha.setValidators([]);
      senha.setValue('', { emitEvent: false });
      senha.disable({ emitEvent: false });
    }
  }

  private focarPrimeiroInvalido(): void {
    const c = this.formulario.controls;
    const ordem: readonly [boolean, { focar(): void } | undefined][] = [
      [c.nome.invalid, this.campoNome()],
      [c.email.invalid, this.campoEmail()],
      [c.papel.invalid, this.campoPapel()],
      [c.area.invalid, this.campoSetor()],
      [c.liderId.invalid || this.semCandidatos(), this.campoLider()],
      [c.senha.invalid, this.campoSenha()],
    ];
    ordem.find(([invalido, campo]) => invalido && campo)?.[1]?.focar();
  }
}
