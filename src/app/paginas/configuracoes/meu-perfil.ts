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
import { ConfiguracoesApi } from './configuracoes.api';
import { CartaoPush } from './preferencias-push';
import { formatarTelefone } from './textos';

/**
 * Meu perfil (`/configuracoes/perfil`, todos) — TELAS-FASE1 §6: os seus dados e a troca de
 * senha. Nome e e-mail só o Admin muda (R1.5); o próprio Admin edita o nome aqui mesmo.
 */
@Component({
  selector: 'app-meu-perfil',
  imports: [ReactiveFormsModule, Avatar, Botao, CampoSenha, CampoTexto, Cartao, CartaoPush, Selo],
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
