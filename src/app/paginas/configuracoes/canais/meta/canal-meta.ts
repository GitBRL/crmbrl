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
import { Router, RouterLink } from '@angular/router';
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
import { formatarTempoRelativo } from '../../../../nucleo/formatos';
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
import { BotaoCopiar } from '../../../integracoes/comum/botao-copiar';
import { Carregamento } from '../../carregamento';
import { linkDoCanal, situacaoDoCanal, TIPO_DE_CANAL } from '../apresentacao';
import { CanaisApi } from '../canais.api';
import type {
  CanalMeta as Canal,
  DadosCanalMeta,
  TesteDoCanalMeta,
  TipoCanalMeta,
} from '../canais.modelos';
import { CabecalhoCanal } from '../comum/cabecalho-canal';
import { AJUDA_FILA_PADRAO, FilasDisponiveis } from '../comum/filas';

/** Ids da Meta: só dígitos (crmbrl-api, `src/canais/meta/meta.dto.ts`). */
const ID_DA_META = /^\d{5,30}$/;

const OPCOES_TIPO: readonly OpcaoGrupo<TipoCanalMeta>[] = [
  { valor: 'INSTAGRAM', rotulo: 'Instagram' },
  { valor: 'MESSENGER', rotulo: 'Messenger' },
];

const CAMPOS_DA_API = [
  'nome',
  'appId',
  'appSecret',
  'pageId',
  'tokenPagina',
  'instagramId',
  'filaPadraoId',
] as const;

/**
 * Instagram e Messenger (`/configuracoes/canais/instagram/novo`, `…/messenger/novo` e
 * `…/meta/:id`, Admin) — §2.5 do contrato e R14: as credenciais do app da Meta (segredos
 * cifrados, mostrados mascarados), o passo a passo do painel da Meta para quem nunca fez, o
 * webhook (endereço e token de verificação para copiar, os campos para assinar, "Gerar outro
 * token"), o teste do token da página e a regra das 24 horas.
 */
@Component({
  selector: 'app-canal-meta',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideChevronDown,
    LucideClock,
    LucideDynamicIcon,
    Botao,
    BotaoCopiar,
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
  templateUrl: './canal-meta.html',
  styleUrl: './canal-meta.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanalMeta {
  /** `:id` da rota (ausente ao criar). */
  readonly id = input<string | undefined>(undefined);
  /** `data.tipo` da rota de criação (`instagram/novo` ou `messenger/novo`). */
  readonly tipoDaRota = input<TipoCanalMeta | undefined>(undefined, { alias: 'tipo' });

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
  protected readonly opcoesTipo = OPCOES_TIPO;
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

  protected readonly canal = new Carregamento<Canal>();
  protected readonly filas = new FilasDisponiveis(this.api);
  private readonly tipoEscolhido = signal<TipoCanalMeta>('INSTAGRAM');
  protected readonly salvando = signal(false);
  protected readonly testando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  protected readonly resultado = signal<TesteDoCanalMeta | null>(null);

  private readonly campoNome = viewChild<CampoTexto>('campoNome');

  protected readonly formulario = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    appId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(ID_DA_META)],
    }),
    appSecret: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    pageId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(ID_DA_META)],
    }),
    tokenPagina: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
    instagramId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(ID_DA_META)],
    }),
    filaPadraoId: new FormControl<string | null>(null),
    ativo: new FormControl(true, { nonNullable: true }),
  });

  protected readonly tipo = computed<TipoCanalMeta>(() => {
    const canal = this.canal.dados();
    return canal ? (canal.tipo as TipoCanalMeta) : this.tipoEscolhido();
  });
  protected readonly pronto = computed(
    () => this.id() === undefined || this.canal.dados() !== null,
  );
  protected readonly situacao = computed(() => {
    const canal = this.canal.dados();
    return canal ? situacaoDoCanal(canal) : null;
  });
  protected readonly fraseNovo = computed(() => TIPO_DE_CANAL[this.tipo()].descricao);

  constructor() {
    effect(() => {
      this.id();
      const tipo = this.tipoDaRota();
      untracked(() => {
        if (tipo) {
          this.tipoEscolhido.set(tipo);
        }
        this.abrir();
      });
    });
    // O id do Instagram é obrigatório só no Instagram.
    effect(() => {
      const instagram = this.tipo() === 'INSTAGRAM';
      untracked(() => {
        const controle = this.formulario.controls.instagramId;
        controle.setValidators(
          instagram
            ? [Validators.required, Validators.pattern(ID_DA_META)]
            : [Validators.pattern(ID_DA_META)],
        );
        controle.updateValueAndValidity({ emitEvent: false });
      });
    });
  }

  protected relativo(valor: string): string {
    return formatarTempoRelativo(valor);
  }

  protected trocarTipo(tipo: TipoCanalMeta | null): void {
    if (tipo && !this.canal.dados()) {
      this.tipoEscolhido.set(tipo);
    }
  }

  protected abrir(): void {
    void this.filas.carregar();
    this.resultado.set(null);
    const id = this.id();
    const segredos = [this.formulario.controls.appSecret, this.formulario.controls.tokenPagina];
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
      .executar(() => this.api.detalharMeta(id))
      .then((ok) => {
        if (ok) {
          this.preencher(this.canal.dados()!);
        }
      });
  }

  private preencher(canal: Canal): void {
    this.filas.definirAtual(canal.filaPadrao);
    this.formulario.reset({
      nome: canal.nome,
      appId: canal.appId,
      appSecret: '',
      pageId: canal.pageId,
      tokenPagina: '',
      instagramId: canal.instagramId ?? '',
      filaPadraoId: canal.filaPadrao?.id ?? null,
      ativo: canal.ativo,
    });
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
    const instagram = this.tipo() === 'INSTAGRAM';
    const dados: DadosCanalMeta = {
      ...(atual ? {} : { tipo: this.tipo() }),
      nome: v.nome.trim(),
      appId: v.appId.trim(),
      pageId: v.pageId.trim(),
      ...(v.appSecret ? { appSecret: v.appSecret } : {}),
      ...(v.tokenPagina ? { tokenPagina: v.tokenPagina.trim() } : {}),
      instagramId: instagram ? v.instagramId.trim() || null : null,
      filaPadraoId: v.filaPadraoId,
      ativo: v.ativo,
    };
    this.salvando.set(true);
    try {
      if (atual) {
        const salvo = await this.api.atualizarMeta(atual.id, dados);
        this.canal.definir(salvo);
        this.preencher(salvo);
        this.avisos.sucesso('Canal salvo.');
      } else {
        const criado = await this.api.criarMeta(dados);
        this.formulario.markAsPristine();
        this.avisos.sucesso(
          'Canal criado. Agora cole o endereço e o token do webhook no painel da Meta.',
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
      this.resultado.set(await this.api.testarMeta(canal.id));
      // O teste pode limpar (ou gravar) o último erro do canal.
      void this.canal.executar(() => this.api.detalharMeta(canal.id));
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.testando.set(false);
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
            const { tokenVerificacao } = await this.api.regenerarTokenMeta(canal.id);
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
          'As mensagens que a Meta mandar para este canal passam a ser ignoradas e nada sai por ele. As conversas que já aconteceram continuam no Atendimento.',
        confirmar: 'Excluir canal',
        perigo: true,
        executar: () => this.api.excluirMeta(canal.id),
      })
      .then((ok) => {
        if (ok) {
          this.avisos.sucesso(`Canal “${canal.nome}” excluído.`);
          void this.router.navigate(['/configuracoes', 'canais']);
        }
      });
  }
}
