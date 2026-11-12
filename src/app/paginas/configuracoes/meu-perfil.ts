import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarDataHora } from '../../nucleo/formatos';
import { SENHA_MAXIMO, SENHA_MINIMO } from '../../nucleo/sessao/perfil';
import { nomeDoSetor } from '../../nucleo/setores/setores';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Cartao } from '../../ui/cartao/cartao';
import { Selo } from '../../ui/selo/selo';
import { CartaoDoisFatores } from './cartao-dois-fatores';
import { ConfiguracoesApi } from './configuracoes.api';
import { ConectarAo3c } from './conectar-3c';
import { CartaoPush } from './preferencias-push';
import { formatarTelefone } from './textos';

/**
 * Meu perfil (`/configuracoes/perfil`, todos) — TELAS-FASE1 §6: os seus dados e a troca de
 * senha. Nome e e-mail só o Admin muda (R1.5); o próprio Admin edita o nome aqui mesmo.
 */
/** Fotos aceitas (R2.10, R11): as mesmas que a API confere no contexto `AVATAR`. */
export const TIPOS_DE_FOTO: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];
export const FOTO_MAXIMO_BYTES = 5 * 1024 * 1024;

/** O que impede a foto de ser enviada (tipo, tamanho), ou `null` se ela serve. */
export function problemaDaFoto(arquivo: Pick<File, 'type' | 'size'>): string | null {
  if (!TIPOS_DE_FOTO.includes(arquivo.type)) {
    return 'A foto precisa ser uma imagem JPG, PNG, GIF ou WebP.';
  }
  if (arquivo.size === 0) {
    return 'Esse arquivo está vazio. Escolha outra imagem.';
  }
  if (arquivo.size > FOTO_MAXIMO_BYTES) {
    return 'A foto pode ter até 5 MB. Escolha uma imagem menor.';
  }
  return null;
}

@Component({
  selector: 'app-meu-perfil',
  imports: [
    ReactiveFormsModule,
    Avatar,
    Botao,
    CampoSenha,
    CampoTexto,
    Cartao,
    CartaoDoisFatores,
    CartaoPush,
    ConectarAo3c,
    Selo,
  ],
  templateUrl: './meu-perfil.html',
  styleUrl: './meu-perfil.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeuPerfil {
  protected readonly sessao = inject(SessaoService);
  private readonly api = inject(ConfiguracoesApi);
  private readonly avisos = inject(AvisosService);

  protected readonly senhaMinimo = SENHA_MINIMO;
  protected readonly usuario = this.sessao.usuario;
  protected readonly podeEditarNome = this.sessao.ehAdmin;
  protected readonly area = computed(() => {
    const area = this.usuario()?.area;
    return this.usuario()?.nomeSetor ?? (area ? nomeDoSetor(area) : null);
  });
  protected readonly telefone = computed(() => formatarTelefone(this.usuario()?.telefone));
  protected readonly sessaoDesde = computed(() => {
    const criadaEm = this.sessao.perfil()?.sessao.criadaEm;
    return criadaEm ? formatarDataHora(criadaEm) : null;
  });

  // Foto (todos, R2.10) -----------------------------------------------------------------------
  protected readonly tiposDeFoto = TIPOS_DE_FOTO.join(',');
  protected readonly enviandoFoto = signal(false);
  protected readonly removendoFoto = signal(false);
  protected readonly erroFoto = signal<string | null>(null);

  // Nome (só o Admin) ------------------------------------------------------------------------
  protected readonly nome = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(200)],
  });
  protected readonly salvandoNome = signal(false);
  protected readonly nomeMudou = signal(false);
  private readonly campoNome = viewChild<CampoTexto>('campoNome');

  // Senha ------------------------------------------------------------------------------------
  protected readonly senha = new FormGroup({
    atual: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nova: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(SENHA_MINIMO),
        Validators.maxLength(SENHA_MAXIMO),
      ],
    }),
    confirmacao: new FormControl('', { nonNullable: true }),
  });
  protected readonly trocandoSenha = signal(false);
  protected readonly erroSenha = signal<ErroApi | null>(null);
  private readonly campoAtual = viewChild<CampoSenha>('campoAtual');
  private readonly campoNova = viewChild<CampoSenha>('campoNova');
  private readonly campoConfirmacao = viewChild<CampoSenha>('campoConfirmacao');

  constructor() {
    const { nova, confirmacao } = this.senha.controls;
    confirmacao.setValidators([Validators.required, (controle) => this.conferir(controle)]);
    nova.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (confirmacao.value) {
        confirmacao.updateValueAndValidity({ emitEvent: false });
      }
    });
    this.nome.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((valor) => this.nomeMudou.set(valor.trim() !== (this.usuario()?.nome ?? '')));
    // O nome do formulário acompanha o perfil (outra aba, ou depois de salvar).
    effect(() => {
      const nome = this.usuario()?.nome ?? '';
      this.nome.reset(nome, { emitEvent: false });
      this.nomeMudou.set(false);
    });
  }

  protected async aoEscolherFoto(evento: Event): Promise<void> {
    const campo = evento.target as HTMLInputElement;
    const arquivo = campo.files?.[0];
    // Limpa o campo: escolher a mesma imagem de novo também dispara a troca.
    campo.value = '';
    if (!arquivo || this.enviandoFoto()) {
      return;
    }
    const problema = problemaDaFoto(arquivo);
    this.erroFoto.set(problema);
    if (problema) {
      return;
    }
    this.enviandoFoto.set(true);
    try {
      await this.api.trocarMinhaFoto(arquivo);
      await this.sessao.carregar(true);
      this.avisos.sucesso('Foto atualizada.');
    } catch (falha) {
      this.erroFoto.set(erroDaApi(falha).mensagem);
    } finally {
      this.enviandoFoto.set(false);
    }
  }

  protected async removerFoto(): Promise<void> {
    if (this.removendoFoto()) {
      return;
    }
    this.erroFoto.set(null);
    this.removendoFoto.set(true);
    try {
      await this.api.removerMinhaFoto();
      await this.sessao.carregar(true);
      this.avisos.sucesso('Foto removida.');
    } catch (falha) {
      this.erroFoto.set(erroDaApi(falha).mensagem);
    } finally {
      this.removendoFoto.set(false);
    }
  }

  protected async salvarNome(): Promise<void> {
    const usuario = this.usuario();
    this.nome.markAsTouched();
    if (!usuario || this.salvandoNome()) {
      return;
    }
    if (this.nome.invalid) {
      this.campoNome()?.focar();
      return;
    }
    const nome = this.nome.value.trim();
    if (nome === usuario.nome) {
      return;
    }
    this.salvandoNome.set(true);
    try {
      await this.api.atualizarUsuario(usuario.id, { nome });
      await this.sessao.carregar(true);
      this.avisos.sucesso('Nome atualizado.');
    } catch (falha) {
      const erro = erroDaApi(falha);
      const mensagem = erro.mensagemDoCampo('nome');
      if (mensagem) {
        this.nome.setErrors({ api: mensagem });
        this.campoNome()?.focar();
      } else {
        this.avisos.erro(erro);
      }
    } finally {
      this.salvandoNome.set(false);
    }
  }

  protected async trocarSenha(): Promise<void> {
    if (this.trocandoSenha()) {
      return;
    }
    this.erroSenha.set(null);
    this.senha.markAllAsTouched();
    if (this.senha.invalid) {
      this.focarSenhaInvalida();
      return;
    }
    const { atual, nova } = this.senha.getRawValue();
    this.trocandoSenha.set(true);
    try {
      await this.sessao.trocarSenha(atual, nova);
      this.senha.reset();
      this.avisos.sucesso('Senha trocada. As suas sessões em outros aparelhos foram encerradas.');
    } catch (falha) {
      const erro = erroDaApi(falha);
      const doAtual = erro.mensagemDoCampo('senhaAtual');
      const daNova = erro.mensagemDoCampo('novaSenha');
      if (doAtual) {
        this.senha.controls.atual.setErrors({
          api: doAtual === 'Está incorreta.' ? 'A senha atual está incorreta.' : doAtual,
        });
      }
      if (daNova) {
        this.senha.controls.nova.setErrors({ api: daNova });
      }
      if (doAtual || daNova) {
        this.focarSenhaInvalida();
      } else {
        this.erroSenha.set(erro);
      }
    } finally {
      this.trocandoSenha.set(false);
    }
  }

  private conferir(controle: AbstractControl): ValidationErrors | null {
    const nova = this.senha?.controls.nova.value ?? '';
    return controle.value && controle.value !== nova
      ? { confere: 'As duas senhas não são iguais. Digite a nova senha de novo.' }
      : null;
  }

  private focarSenhaInvalida(): void {
    const c = this.senha.controls;
    if (c.atual.invalid) {
      this.campoAtual()?.focar();
    } else if (c.nova.invalid) {
      this.campoNova()?.focar();
    } else {
      this.campoConfirmacao()?.focar();
    }
  }
}
