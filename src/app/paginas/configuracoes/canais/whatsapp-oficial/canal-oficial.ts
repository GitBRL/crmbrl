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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideCheck,
  LucideChevronDown,
  LucideClock,
  LucideDynamicIcon,
  LucideKeyRound,
  LucidePlugZap,
  LucideRefreshCw,
  LucideTrash,
  LucideX,
} from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../../../nucleo/api/erro-api';
import { AvisosService } from '../../../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../../../nucleo/confirmacao.service';
import { formatarDataHora, formatarTempoRelativo } from '../../../../nucleo/formatos';
import { Abas, type ItemAba } from '../../../../ui/abas/abas';
import { Botao } from '../../../../ui/botao/botao';
import { CaixaSelecao } from '../../../../ui/caixa-selecao/caixa-selecao';
import { CampoSenha } from '../../../../ui/campo-senha/campo-senha';
import { CampoTexto } from '../../../../ui/campo-texto/campo-texto';
import { Cartao } from '../../../../ui/cartao/cartao';
import { Esqueleto } from '../../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../../ui/estado-vazio/estado-vazio';
import { type ItemMenuAcoes, MenuAcoes } from '../../../../ui/menu-acoes/menu-acoes';
import { Selo } from '../../../../ui/selo/selo';
import { Seletor } from '../../../../ui/seletor/seletor';
import { BotaoCopiar } from '../../../integracoes/comum/botao-copiar';
import { Carregamento } from '../../carregamento';
import {
  linkDoCanal,
  ROTULO_CATEGORIA_TEMPLATE,
  rotuloDaQualidade,
  rotuloDoStatusDoTemplate,
  situacaoDoOficial,
  TIPO_DE_CANAL,
} from '../apresentacao';
import { CanaisApi } from '../canais.api';
import type {
  CanalOficial as Canal,
  DadosCanalOficial,
  TemplateDoCanal,
  TesteDoCanalOficial,
} from '../canais.modelos';
import { CabecalhoCanal } from '../comum/cabecalho-canal';
import { AJUDA_FILA_PADRAO, FilasDisponiveis } from '../comum/filas';
import { LigacoesCanal } from './ligacoes-canal';

/** Ids da Meta: só dígitos, de 5 a 30 (crmbrl-api, `src/whatsapp-oficial`). */
const ID_DA_META = /^\d{5,30}$/;

const CAMPOS_DA_API = [
  'nome',
  'phoneNumberId',
  'wabaId',
  'numeroExibido',
  'token',
  'appSecret',
  'filaPadraoId',
] as const;

/**
 * WhatsApp pela API oficial da Meta (`/configuracoes/canais/whatsapp-oficial/novo` e `…/:id`,
 * Admin) — Onda E, §2.1: id do número e da conta (WABA), token e app secret (cifrados, mostrados
 * mascarados e trocados sem revelar o atual), o passo a passo do painel da Meta, o webhook (URL e
 * token de verificação para copiar), "Testar conexão" com o estado e o motivo do erro, e os
 * templates sincronizados da conta. O webhook é o mesmo do Instagram e do Messenger.
 */
@Component({
  selector: 'app-canal-oficial',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    LucideChevronDown,
    LucideClock,
    LucideDynamicIcon,
    Abas,
    Botao,
    BotaoCopiar,
    CabecalhoCanal,
    CaixaSelecao,
    CampoSenha,
    CampoTexto,
    Cartao,
    Esqueleto,
    EstadoVazio,
    LigacoesCanal,
    MenuAcoes,
    Selo,
    Seletor,
  ],
  templateUrl: './canal-oficial.html',
  styleUrl: './canal-oficial.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanalOficial {
  /** `:id` da rota (ausente ao criar). */
  readonly id = input<string | undefined>(undefined);

  private readonly api = inject(CanaisApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  protected readonly icones = {
    tentar: LucideRefreshCw,
    testar: LucidePlugZap,
    ok: LucideCheck,
    falha: LucideX,
  };
  protected readonly ajudaFila = AJUDA_FILA_PADRAO;
  protected readonly frase = TIPO_DE_CANAL.WHATSAPP_OFICIAL.descricao;
  protected readonly categorias = ROTULO_CATEGORIA_TEMPLATE;
  protected readonly rotuloStatus = rotuloDoStatusDoTemplate;
  protected readonly acoes: readonly ItemMenuAcoes[] = [
    { id: 'token', rotulo: 'Gerar outro token de verificação', icone: LucideKeyRound },
    {
      id: 'excluir',
      rotulo: 'Excluir canal',
      icone: LucideTrash,
      perigo: true,
      separarAntes: true,
    },
  ];

  protected readonly abas: readonly ItemAba[] = [
    { id: 'conexao', rotulo: 'Conexão' },
    { id: 'ligacoes', rotulo: 'Ligações' },
  ];
  /** `?aba=ligacoes` abre direto nas ligações. */
  protected readonly aba = signal<'conexao' | 'ligacoes'>(
    this.rota.snapshot.queryParamMap.get('aba') === 'ligacoes' ? 'ligacoes' : 'conexao',
  );

  protected readonly canal = new Carregamento<Canal>();
  protected readonly filas = new FilasDisponiveis(this.api);
  protected readonly salvando = signal(false);
  protected readonly testando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  protected readonly resultado = signal<TesteDoCanalOficial | null>(null);

  // Templates da conta (lista própria: falhar não derruba a tela).
  protected readonly templates = signal<readonly TemplateDoCanal[] | null>(null);
  protected readonly templatesErro = signal<ErroApi | null>(null);
  protected readonly sincronizando = signal(false);
  protected readonly erroSincronia = signal<string | null>(null);

  private readonly campoNome = viewChild<CampoTexto>('campoNome');

  protected readonly formulario = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    phoneNumberId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(ID_DA_META)],
    }),
    wabaId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(ID_DA_META)],
    }),
    numeroExibido: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(40)],
    }),
    token: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    appSecret: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    filaPadraoId: new FormControl<string | null>(null),
    ativo: new FormControl(true, { nonNullable: true }),
  });

  protected readonly pronto = computed(
    () => this.id() === undefined || this.canal.dados() !== null,
  );
  protected readonly situacao = computed(() => {
    const canal = this.canal.dados();
    return canal ? situacaoDoOficial(canal) : null;
  });
  protected readonly qualidade = computed(() =>
    rotuloDaQualidade(this.canal.dados()?.estado.qualidade ?? null),
  );

  constructor() {
    effect(() => {
      this.id();
      untracked(() => this.abrir());
    });
  }

  protected mudarAba(aba: string | null): void {
    const nova = aba === 'ligacoes' ? 'ligacoes' : 'conexao';
    this.aba.set(nova);
    void this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: { aba: nova === 'conexao' ? null : nova },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected relativo(valor: string): string {
    return formatarTempoRelativo(valor);
  }

  protected dataHora(valor: string): string {
    return formatarDataHora(valor);
  }

  protected abrir(): void {
    void this.filas.carregar();
    this.resultado.set(null);
    this.templates.set(null);
    this.templatesErro.set(null);
    this.erroSincronia.set(null);
    const id = this.id();
    const segredos = [this.formulario.controls.token, this.formulario.controls.appSecret];
    if (id === undefined) {
      this.canal.limpar();
      for (const controle of segredos) {
        controle.addValidators(Validators.required);
        controle.updateValueAndValidity({ emitEvent: false });
      }
      return;
    }
    for (const controle of segredos) {
      controle.removeValidators(Validators.required);
      controle.updateValueAndValidity({ emitEvent: false });
    }
    void this.canal
      .executar(() => this.api.detalharOficial(id))
      .then((ok) => {
        if (ok) {
          this.preencher(this.canal.dados()!);
          void this.carregarTemplates(id);
        }
      });
  }

  private preencher(canal: Canal): void {
    this.filas.definirAtual(canal.filaPadrao);
    this.formulario.reset({
      nome: canal.nome,
      phoneNumberId: canal.phoneNumberId,
      wabaId: canal.wabaId,
      numeroExibido: canal.numeroExibido ?? '',
      token: '',
      appSecret: '',
      filaPadraoId: canal.filaPadrao?.id ?? null,
      ativo: canal.ativo,
    });
  }

  protected async carregarTemplates(id: string | undefined = this.id()): Promise<void> {
    if (id === undefined) {
      return;
    }
    this.templatesErro.set(null);
    try {
      this.templates.set(await this.api.templatesDoOficial(id));
    } catch (falha) {
      this.templatesErro.set(erroDaApi(falha));
    }
  }

  protected async salvar(): Promise<void> {
    if (this.salvando()) {
      return;
    }
    this.erroGeral.set(null);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) {
      if (this.formulario.controls.nome.invalid) {
        this.campoNome()?.focar();
      } else {
        this.erroGeral.set('Confira os campos marcados.');
      }
      return;
    }
    const v = this.formulario.getRawValue();
    const atual = this.canal.dados();
    const dados: DadosCanalOficial = {
      nome: v.nome.trim(),
      phoneNumberId: v.phoneNumberId.trim(),
      wabaId: v.wabaId.trim(),
      numeroExibido: v.numeroExibido.trim() || null,
      ...(v.token ? { token: v.token.trim() } : {}),
      ...(v.appSecret ? { appSecret: v.appSecret.trim() } : {}),
      filaPadraoId: v.filaPadraoId,
      ativo: v.ativo,
    };
    this.salvando.set(true);
    try {
      if (atual) {
        const salvo = await this.api.atualizarOficial(atual.id, dados);
        this.canal.definir(salvo);
        this.preencher(salvo);
        this.avisos.sucesso('Canal salvo.');
      } else {
        const criado = await this.api.criarOficial(dados);
        this.formulario.markAsPristine();
        this.avisos.sucesso(
          'Canal criado. Teste a conexão e cole o endereço e o token do webhook no painel da Meta.',
        );
        await this.router.navigate(linkDoCanal(criado.tipo, criado.id), { replaceUrl: true });
      }
    } catch (falha) {
      this.mostrarErro(erroDaApi(falha));
    } finally {
      this.salvando.set(false);
    }
  }

  private mostrarErro(erro: ErroApi): void {
    let noLugar = false;
    for (const campo of CAMPOS_DA_API) {
      const mensagem = erro.mensagemDoCampo(campo);
      if (mensagem) {
        const controle = this.formulario.controls[campo];
        controle.setErrors({ api: mensagem });
        controle.markAsTouched();
        noLugar = true;
      }
    }
    if (erro.status === 409) {
      this.formulario.controls.phoneNumberId.setErrors({
        api: 'Já existe um canal com este ID de número.',
      });
      this.formulario.controls.phoneNumberId.markAsTouched();
      noLugar = true;
    }
    this.erroGeral.set(noLugar ? 'Confira os campos marcados.' : erro.mensagem);
  }

  protected async testar(): Promise<void> {
    const canal = this.canal.dados();
    if (!canal || this.testando()) {
      return;
    }
    this.testando.set(true);
    this.resultado.set(null);
    try {
      this.resultado.set(await this.api.testarOficial(canal.id));
      // O teste grava o estado (conectado ou com erro) e o nome verificado.
      await this.canal.executar(() => this.api.detalharOficial(canal.id));
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.testando.set(false);
    }
  }

  protected async sincronizar(): Promise<void> {
    const canal = this.canal.dados();
    if (!canal || this.sincronizando()) {
      return;
    }
    this.sincronizando.set(true);
    this.erroSincronia.set(null);
    try {
      const resultado = await this.api.sincronizarTemplates(canal.id);
      this.templates.set(resultado.itens);
      this.templatesErro.set(null);
      this.canal.definir({
        ...canal,
        templates: {
          total: resultado.total,
          aprovados: resultado.aprovados,
          sincronizadoEm: resultado.sincronizadoEm,
        },
      });
      this.avisos.sucesso(
        resultado.total === 0
          ? 'Sincronizado: a conta ainda não tem templates.'
          : `Sincronizado: ${resultado.aprovados} de ${resultado.total} templates aprovados.`,
      );
    } catch (falha) {
      // 503 traz o motivo (a Meta falhou ou o token não vale).
      this.erroSincronia.set(erroDaApi(falha).mensagem);
    } finally {
      this.sincronizando.set(false);
    }
  }

  protected agir(acao: string): void {
    const canal = this.canal.dados();
    if (!canal) {
      return;
    }
    if (acao === 'token') {
      void this.confirmacao
        .confirmar({
          titulo: 'Gerar outro token de verificação?',
          mensagem:
            'O token atual deixa de valer. Cole o novo no painel da Meta (Webhooks) para a Meta voltar a confirmar o endereço.',
          confirmar: 'Gerar outro token',
          executar: async () => {
            const { tokenVerificacao } = await this.api.regenerarTokenOficial(canal.id);
            this.canal.definir({ ...canal, webhook: { ...canal.webhook, tokenVerificacao } });
          },
        })
        .then((ok) => {
          if (ok) {
            this.avisos.sucesso('Token novo gerado. Atualize no painel da Meta.');
          }
        });
      return;
    }
    void this.confirmacao
      .confirmar({
        titulo: `Excluir o canal “${canal.nome}”?`,
        mensagem:
          'As mensagens que a Meta mandar para este número passam a ser ignoradas e nada sai por ele. As conversas que já aconteceram continuam no Atendimento.',
        confirmar: 'Excluir canal',
        perigo: true,
        executar: () => this.api.excluirOficial(canal.id),
      })
      .then((ok) => {
        if (ok) {
          this.avisos.sucesso(`Canal “${canal.nome}” excluído.`);
          void this.router.navigate(['/configuracoes', 'canais']);
        }
      });
  }
}
