import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideCheck,
  LucideDynamicIcon,
  LucideInfo,
  LucidePlugZap,
  LucideRefreshCw,
  LucideTrash,
  LucideX,
} from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../../../nucleo/api/erro-api';
import { AvisosService } from '../../../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../../../nucleo/confirmacao.service';
import { formatarTempoRelativo } from '../../../../nucleo/formatos';
import { AreaTexto } from '../../../../ui/area-texto/area-texto';
import { Botao } from '../../../../ui/botao/botao';
import { CaixaSelecao } from '../../../../ui/caixa-selecao/caixa-selecao';
import { CampoSenha } from '../../../../ui/campo-senha/campo-senha';
import { CampoTexto } from '../../../../ui/campo-texto/campo-texto';
import { Cartao } from '../../../../ui/cartao/cartao';
import { Esqueleto } from '../../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../../ui/estado-vazio/estado-vazio';
import { GrupoOpcoes, type OpcaoGrupo } from '../../../../ui/grupo-opcoes/grupo-opcoes';
import { type ItemMenuAcoes, MenuAcoes } from '../../../../ui/menu-acoes/menu-acoes';
import { Seletor } from '../../../../ui/seletor/seletor';
import { Carregamento } from '../../carregamento';
import { linkDoCanal, situacaoDoCanal } from '../apresentacao';
import { CanaisApi } from '../canais.api';
import type {
  CanalEmail as Canal,
  DadosCanalEmail,
  DadosConexaoEmail,
  SegurancaSmtp,
  TesteDeConexaoEmail,
} from '../canais.modelos';
import { CabecalhoCanal } from '../comum/cabecalho-canal';
import { AJUDA_FILA_PADRAO, FilasDisponiveis } from '../comum/filas';
import {
  DICA_OUTRO_PROVEDOR,
  ehPortaPadraoImap,
  ehPortaPadraoSmtp,
  portaImapPadrao,
  portaSmtpPadrao,
  type Provedor,
  PROVEDORES,
  provedorDoServidor,
} from './provedores';

const OPCOES_PROVEDOR: readonly OpcaoGrupo<Provedor>[] = [
  { valor: 'GMAIL', rotulo: 'Gmail' },
  { valor: 'MICROSOFT', rotulo: 'Outlook / Microsoft 365' },
  { valor: 'ZOHO', rotulo: 'Zoho' },
  { valor: 'OUTRO', rotulo: 'Outro' },
];

const OPCOES_SEGURANCA: readonly OpcaoGrupo<SegurancaSmtp>[] = [
  { valor: 'TLS', rotulo: 'SSL/TLS (465)' },
  { valor: 'STARTTLS', rotulo: 'STARTTLS (587)' },
  { valor: 'NENHUMA', rotulo: 'Nenhuma (25)' },
];

const porta = (valor: number) =>
  new FormControl<number | null>(valor, {
    validators: [Validators.required, Validators.min(1), Validators.max(65535)],
  });

/** Campos da API → caminho no formulário. */
const CAMPOS_DA_API: Readonly<Record<string, string>> = {
  nome: 'nome',
  endereco: 'endereco',
  nomeRemetente: 'nomeRemetente',
  senha: 'senha',
  senhaSmtp: 'senhaSmtp',
  assinatura: 'assinatura',
  filaPadraoId: 'filaPadraoId',
  'imap.host': 'imap.host',
  'imap.porta': 'imap.porta',
  'imap.usuario': 'imap.usuario',
  'imap.pasta': 'imap.pasta',
  'smtp.host': 'smtp.host',
  'smtp.porta': 'smtp.porta',
  'smtp.usuario': 'smtp.usuario',
};

/**
 * Caixa de e-mail (`/configuracoes/canais/email/novo` e `…/email/:id`, Admin) — §2.5 do contrato
 * e R14: endereço e senha (cifrada), atalhos para Gmail, Microsoft 365 e Zoho (com o que fazer
 * no provedor), IMAP e SMTP, assinatura e o teste de conexão (IMAP e SMTP, sem salvar), que na
 * edição usa as mudanças ainda não salvas.
 */
@Component({
  selector: 'app-canal-email',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideDynamicIcon,
    LucideInfo,
    AreaTexto,
    Botao,
    CabecalhoCanal,
    CaixaSelecao,
    CampoSenha,
    CampoTexto,
    Cartao,
    Esqueleto,
    EstadoVazio,
    GrupoOpcoes,
    MenuAcoes,
    Seletor,
  ],
  templateUrl: './canal-email.html',
  styleUrl: './canal-email.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanalEmail {
  /** `:id` da rota (ausente em `email/novo`). */
  readonly id = input<string | undefined>(undefined);

  private readonly api = inject(CanaisApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly router = inject(Router);

  protected readonly icones = {
    tentar: LucideRefreshCw,
    testar: LucidePlugZap,
    ok: LucideCheck,
    falha: LucideX,
  };
  protected readonly ajudaFila = AJUDA_FILA_PADRAO;
  protected readonly opcoesProvedor = OPCOES_PROVEDOR;
  protected readonly opcoesSeguranca = OPCOES_SEGURANCA;
  protected readonly acoes: readonly ItemMenuAcoes[] = [
    { id: 'excluir', rotulo: 'Excluir caixa de e-mail', icone: LucideTrash, perigo: true },
  ];

  protected readonly canal = new Carregamento<Canal>();
  protected readonly filas = new FilasDisponiveis(this.api);
  protected readonly provedor = signal<Provedor>('GMAIL');
  protected readonly salvando = signal(false);
  protected readonly testando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  protected readonly resultado = signal<TesteDeConexaoEmail | null>(null);
  protected readonly erroTeste = signal<string | null>(null);

  private readonly campoNome = viewChild<CampoTexto>('campoNome');
  private readonly campoEndereco = viewChild<CampoTexto>('campoEndereco');
  private readonly campoSenha = viewChild<CampoSenha>('campoSenha');

  protected readonly formulario = new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    endereco: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)],
    }),
    senha: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    nomeRemetente: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(120)],
    }),
    filaPadraoId: new FormControl<string | null>(null),
    ativo: new FormControl(true, { nonNullable: true }),
    imap: new FormGroup({
      host: new FormControl(PROVEDORES.GMAIL.imap.host, {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(253)],
      }),
      porta: porta(PROVEDORES.GMAIL.imap.porta),
      tls: new FormControl(true, { nonNullable: true }),
      usuario: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(254)] }),
      pasta: new FormControl('INBOX', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(200)],
      }),
    }),
    smtp: new FormGroup({
      host: new FormControl(PROVEDORES.GMAIL.smtp.host, {
        nonNullable: true,
        validators: [Validators.maxLength(253)],
      }),
      porta: porta(PROVEDORES.GMAIL.smtp.porta),
      seguranca: new FormControl<SegurancaSmtp>('TLS', { nonNullable: true }),
      usuario: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(254)] }),
    }),
    outraSenhaSmtp: new FormControl(false, { nonNullable: true }),
    senhaSmtp: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    assinatura: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
    ignorarCertificado: new FormControl(false, { nonNullable: true }),
  });

  protected readonly pronto = computed(
    () => this.id() === undefined || this.canal.dados() !== null,
  );
  protected readonly situacao = computed(() => {
    const canal = this.canal.dados();
    return canal ? situacaoDoCanal(canal) : null;
  });
  protected readonly dicaDoProvedor = computed(() => {
    const provedor = this.provedor();
    return provedor === 'OUTRO' ? DICA_OUTRO_PROVEDOR : PROVEDORES[provedor].dica;
  });

  constructor() {
    const imap = this.formulario.controls.imap.controls;
    const smtp = this.formulario.controls.smtp.controls;
    // Trocar o TLS ou a segurança troca a porta, se ela ainda for a padrão de outra opção.
    imap.tls.valueChanges.pipe(takeUntilDestroyed()).subscribe((tls) => {
      if (ehPortaPadraoImap(imap.porta.value)) {
        imap.porta.setValue(portaImapPadrao(tls));
      }
    });
    smtp.seguranca.valueChanges.pipe(takeUntilDestroyed()).subscribe((seguranca) => {
      if (ehPortaPadraoSmtp(smtp.porta.value)) {
        smtp.porta.setValue(portaSmtpPadrao(seguranca));
      }
    });
    // Outro teste vale para os dados novos.
    this.formulario.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.resultado() || this.erroTeste()) {
        this.resultado.set(null);
        this.erroTeste.set(null);
      }
    });
    effect(() => {
      this.id();
      untracked(() => this.abrir());
    });
  }

  protected relativo(valor: string): string {
    return formatarTempoRelativo(valor);
  }

  protected abrir(): void {
    void this.filas.carregar();
    const id = this.id();
    this.resultado.set(null);
    this.erroTeste.set(null);
    if (id === undefined) {
      this.canal.limpar();
      this.formulario.controls.senha.setValidators([
        Validators.required,
        Validators.maxLength(500),
      ]);
      this.formulario.controls.senha.updateValueAndValidity({ emitEvent: false });
      return;
    }
    this.formulario.controls.senha.setValidators([Validators.maxLength(500)]);
    void this.canal
      .executar(() => this.api.detalharEmail(id))
      .then((ok) => {
        if (ok) {
          this.preencher(this.canal.dados()!);
        }
      });
  }

  private preencher(canal: Canal): void {
    this.filas.definirAtual(canal.filaPadrao);
    this.provedor.set(provedorDoServidor(canal.imap.host));
    this.formulario.reset({
      nome: canal.nome,
      endereco: canal.endereco,
      senha: '',
      nomeRemetente: canal.nomeRemetente ?? '',
      filaPadraoId: canal.filaPadrao?.id ?? null,
      ativo: canal.ativo,
      imap: {
        host: canal.imap.host,
        porta: canal.imap.porta,
        tls: canal.imap.tls,
        usuario: canal.imap.usuario === canal.endereco ? '' : canal.imap.usuario,
        pasta: canal.imap.pasta,
      },
      smtp: {
        host: canal.smtp.host === canal.imap.host ? '' : canal.smtp.host,
        porta: canal.smtp.porta,
        seguranca: canal.smtp.seguranca,
        usuario: canal.smtp.usuario === canal.imap.usuario ? '' : canal.smtp.usuario,
      },
      outraSenhaSmtp: canal.senhaSmtp !== null,
      senhaSmtp: '',
      assinatura: canal.assinatura ?? '',
      ignorarCertificado: canal.ignorarCertificado,
    });
  }

  protected escolherProvedor(provedor: Provedor | null): void {
    if (!provedor) {
      return;
    }
    this.provedor.set(provedor);
    if (provedor === 'OUTRO') {
      return;
    }
    const dados = PROVEDORES[provedor];
    this.formulario.patchValue({
      imap: { host: dados.imap.host, porta: dados.imap.porta, tls: dados.imap.tls },
      smtp: { host: dados.smtp.host, porta: dados.smtp.porta, seguranca: dados.smtp.seguranca },
    });
    this.formulario.markAsDirty();
  }

  /** Os dados de conexão do formulário, no formato da API (o vazio fica de fora). */
  private conexao(): DadosConexaoEmail {
    const v = this.formulario.getRawValue();
    // Os campos vazios valem o padrão da tela (o endereço, os dados do IMAP), mandados por
    // extenso: na edição, um campo ausente manteria o valor antigo.
    const endereco = v.endereco.trim();
    const usuarioImap = v.imap.usuario.trim() || endereco;
    const hostImap = v.imap.host.trim();
    return {
      endereco,
      imap: {
        host: hostImap,
        porta: v.imap.porta!,
        tls: v.imap.tls,
        usuario: usuarioImap,
        pasta: v.imap.pasta.trim() || 'INBOX',
      },
      smtp: {
        host: v.smtp.host.trim() || hostImap,
        porta: v.smtp.porta!,
        seguranca: v.smtp.seguranca,
        usuario: v.smtp.usuario.trim() || usuarioImap,
      },
      ...(v.senha ? { senha: v.senha } : {}),
      ...(v.outraSenhaSmtp ? (v.senhaSmtp ? { senhaSmtp: v.senhaSmtp } : {}) : { senhaSmtp: null }),
      ignorarCertificado: v.ignorarCertificado,
    };
  }

  protected async testar(): Promise<void> {
    if (this.testando()) {
      return;
    }
    const c = this.formulario.controls;
    for (const controle of [
      c.endereco,
      c.imap.controls.host,
      c.imap.controls.porta,
      c.smtp.controls.porta,
    ]) {
      controle.markAsTouched();
    }
    if (c.endereco.invalid || c.imap.invalid || c.smtp.invalid) {
      this.erroTeste.set('Preencha o endereço e os servidores antes de testar.');
      return;
    }
    const atual = this.canal.dados();
    if (!atual && !c.senha.value) {
      c.senha.markAsTouched();
      this.erroTeste.set('Digite a senha da caixa para testar.');
      this.campoSenha()?.focar();
      return;
    }
    this.testando.set(true);
    this.erroTeste.set(null);
    this.resultado.set(null);
    try {
      const resultado = atual
        ? await this.api.testarEmail(atual.id, this.conexao())
        : await this.api.testarEmailNovo(this.conexao());
      this.resultado.set(resultado);
    } catch (falha) {
      this.erroTeste.set(erroDaApi(falha).mensagem);
    } finally {
      this.testando.set(false);
    }
  }

  protected async salvar(): Promise<void> {
    if (this.salvando()) {
      return;
    }
    this.erroGeral.set(null);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) {
      const c = this.formulario.controls;
      if (c.endereco.invalid) {
        this.campoEndereco()?.focar();
      } else if (c.senha.invalid) {
        this.campoSenha()?.focar();
      } else if (c.nome.invalid) {
        this.campoNome()?.focar();
      } else {
        this.erroGeral.set('Confira os campos marcados.');
      }
      return;
    }
    const v = this.formulario.getRawValue();
    const atual = this.canal.dados();
    const dados: DadosCanalEmail = {
      ...this.conexao(),
      nome: v.nome.trim() || v.endereco.trim(),
      nomeRemetente: v.nomeRemetente.trim() || null,
      filaPadraoId: v.filaPadraoId,
      ativo: v.ativo,
      assinatura: v.assinatura.trim() || null,
    };
    if (atual && !v.outraSenhaSmtp && atual.senhaSmtp === null) {
      // Já usava a senha da caixa: não precisa mandar.
      delete (dados as { senhaSmtp?: unknown }).senhaSmtp;
    }
    this.salvando.set(true);
    try {
      if (atual) {
        const salvo = await this.api.atualizarEmail(atual.id, dados);
        this.canal.definir(salvo);
        this.preencher(salvo);
        this.avisos.sucesso('Caixa de e-mail salva.');
      } else {
        const criado = await this.api.criarEmail(dados);
        this.formulario.markAsPristine();
        this.avisos.sucesso(
          'Caixa de e-mail criada. Os e-mails que chegarem a partir de agora entram no Atendimento.',
        );
        await this.router.navigate(linkDoCanal('EMAIL', criado.id), { replaceUrl: true });
      }
    } catch (falha) {
      this.mostrarErro(erroDaApi(falha));
    } finally {
      this.salvando.set(false);
    }
  }

  private mostrarErro(erro: ErroApi): void {
    let noLugar = false;
    for (const { campo } of erro.campos) {
      const caminho = CAMPOS_DA_API[campo];
      const controle = caminho ? this.formulario.get(caminho) : null;
      const mensagem = erro.mensagemDoCampo(campo);
      if (controle && mensagem) {
        controle.setErrors({ api: mensagem });
        controle.markAsTouched();
        noLugar = true;
      }
    }
    if (noLugar) {
      this.erroGeral.set('Confira os campos marcados.');
      return;
    }
    if (erro.ehConflito) {
      // O endereço é único entre os canais de e-mail.
      this.formulario.controls.endereco.setErrors({ api: erro.mensagem });
      this.campoEndereco()?.focar();
      return;
    }
    this.erroGeral.set(erro.mensagem);
  }

  protected async excluir(): Promise<void> {
    const canal = this.canal.dados();
    if (!canal) {
      return;
    }
    const ok = await this.confirmacao.confirmar({
      titulo: `Excluir a caixa “${canal.nome}”?`,
      mensagem: `O CRM para de ler ${canal.endereco} e não responde mais por ela. Os e-mails continuam na caixa, e as conversas que já aconteceram continuam no Atendimento.`,
      confirmar: 'Excluir caixa',
      perigo: true,
      executar: () => this.api.excluirEmail(canal.id),
    });
    if (ok) {
      this.avisos.sucesso(`Caixa “${canal.nome}” excluída.`);
      void this.router.navigate(['/configuracoes', 'canais']);
    }
  }
}
