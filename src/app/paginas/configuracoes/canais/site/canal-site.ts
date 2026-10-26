import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  signal,
  untracked,
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
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import {
  LucideInfo,
  LucidePlay,
  LucideRefreshCw,
  LucideTrash,
  LucideTriangleAlert,
} from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../../../nucleo/api/erro-api';
import { AvisosService } from '../../../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../../../nucleo/confirmacao.service';
import { AreaTexto } from '../../../../ui/area-texto/area-texto';
import { Botao } from '../../../../ui/botao/botao';
import { CaixaSelecao } from '../../../../ui/caixa-selecao/caixa-selecao';
import { CampoTexto } from '../../../../ui/campo-texto/campo-texto';
import { Cartao } from '../../../../ui/cartao/cartao';
import { Esqueleto } from '../../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../../ui/estado-vazio/estado-vazio';
import { GrupoOpcoes, type OpcaoGrupo } from '../../../../ui/grupo-opcoes/grupo-opcoes';
import { type ItemMenuAcoes, MenuAcoes } from '../../../../ui/menu-acoes/menu-acoes';
import { Modal } from '../../../../ui/modal/modal';
import { Seletor } from '../../../../ui/seletor/seletor';
import { BlocoCodigo } from '../../../integracoes/comum/bloco-codigo';
import { Carregamento } from '../../carregamento';
import { linkDoCanal, situacaoDoCanal } from '../apresentacao';
import { CanaisApi } from '../canais.api';
import {
  APARENCIA_PADRAO,
  type AparenciaDoWidget,
  type CanalSite as Canal,
  type ContatoDoFormulario,
  type DadosCanalSite,
  type PosicaoDoWidget,
  type TemaDoWidget,
  TEXTO_CONSENTIMENTO_PADRAO,
} from '../canais.modelos';
import { CabecalhoCanal } from '../comum/cabecalho-canal';
import { AJUDA_FILA_PADRAO, FilasDisponiveis } from '../comum/filas';
import { CampoCor } from './campo-cor';
import { CampoDominios } from './campo-dominios';
import { PreviaWidget } from './previa-widget';
import { contraste, corDeTextoPara, ehCor } from './widget';

const COR_TEXTO_ESCURA = '#111827';
const COR_TEXTO_BRANCA = '#FFFFFF';

function validarCor(controle: AbstractControl<string>): ValidationErrors | null {
  return ehCor(controle.value) ? null : { cor: true };
}

function validarUrl(controle: AbstractControl<string>): ValidationErrors | null {
  const valor = controle.value?.trim();
  if (!valor) {
    return null;
  }
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' || url.protocol === 'http:' ? null : { url: true };
  } catch {
    return { url: true };
  }
}

const OPCOES_TEMA: readonly OpcaoGrupo<TemaDoWidget>[] = [
  { valor: 'automatico', rotulo: 'Automático' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
];

const OPCOES_POSICAO: readonly OpcaoGrupo<PosicaoDoWidget>[] = [
  { valor: 'direita', rotulo: 'Direita' },
  { valor: 'esquerda', rotulo: 'Esquerda' },
];

const OPCOES_CONTATO: readonly OpcaoGrupo<ContatoDoFormulario>[] = [
  {
    valor: 'EMAIL_OU_TELEFONE',
    rotulo: 'E-mail ou telefone',
    dica: 'O visitante escolhe o que preferir informar.',
  },
  { valor: 'EMAIL', rotulo: 'Só e-mail' },
  { valor: 'TELEFONE', rotulo: 'Só telefone', dica: 'Bom para continuar a conversa no WhatsApp.' },
];

/** Os campos da API que a tela sabe pôr no lugar certo. */
const CAMPOS_DA_API: Readonly<Record<string, string>> = {
  nome: 'nome',
  filaPadraoId: 'filaPadraoId',
  dominios: 'dominios',
  'aparencia.titulo': 'titulo',
  'aparencia.subtitulo': 'subtitulo',
  'aparencia.saudacao': 'saudacao',
  'aparencia.corPrimaria': 'corPrimaria',
  textoConsentimento: 'textoConsentimento',
  urlPrivacidade: 'urlPrivacidade',
};

/** Texto para dentro do atributo de um HTML montado à mão. */
function atributo(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Chat do site (`/configuracoes/canais/site/novo` e `/configuracoes/canais/site/:id`, Admin) —
 * §2.5/§6 do contrato e R14: nome, fila, sites autorizados, aparência (título, cores, tema,
 * posição), o formulário inicial com o consentimento (LGPD), a prévia ao vivo do widget e, depois
 * de criado, o trecho de instalação com "Testar o chat aqui" (o widget de verdade num quadro).
 */
@Component({
  selector: 'app-canal-site',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideInfo,
    LucideTriangleAlert,
    AreaTexto,
    BlocoCodigo,
    Botao,
    CabecalhoCanal,
    CaixaSelecao,
    CampoCor,
    CampoDominios,
    CampoTexto,
    Cartao,
    Esqueleto,
    EstadoVazio,
    GrupoOpcoes,
    MenuAcoes,
    Modal,
    PreviaWidget,
    Seletor,
  ],
  templateUrl: './canal-site.html',
  styleUrl: './canal-site.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanalSite {
  /** `:id` da rota (ausente em `site/novo`). */
  readonly id = input<string | undefined>(undefined);
  /** `?criado=1`: acabou de criar (a instalação ganha destaque). */
  readonly criado = input<string | undefined>(undefined);

  private readonly api = inject(CanaisApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly router = inject(Router);
  private readonly sanitizador = inject(DomSanitizer);
  private readonly injector = inject(Injector);

  protected readonly icones = { tentar: LucideRefreshCw, testar: LucidePlay };
  protected readonly ajudaFila = AJUDA_FILA_PADRAO;
  protected readonly consentimentoPadrao = TEXTO_CONSENTIMENTO_PADRAO;
  protected readonly opcoesTema = OPCOES_TEMA;
  protected readonly opcoesPosicao = OPCOES_POSICAO;
  protected readonly opcoesContato = OPCOES_CONTATO;
  protected readonly acoes: readonly ItemMenuAcoes[] = [
    { id: 'excluir', rotulo: 'Excluir chat do site', icone: LucideTrash, perigo: true },
  ];

  protected readonly canal = new Carregamento<Canal>();
  protected readonly filas = new FilasDisponiveis(this.api);
  protected readonly salvando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  protected readonly testando = signal(false);
  /** Cor de texto gravada que não é nenhuma das opções (veio de outro lugar). */
  private readonly corTextoPersonalizada = signal<string | null>(null);

  private readonly campoNome = viewChild<CampoTexto>('campoNome');

  protected readonly formulario = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    filaPadraoId: new FormControl<string | null>(null),
    ativo: new FormControl(true, { nonNullable: true }),
    dominios: new FormControl<readonly string[]>([], { nonNullable: true }),
    titulo: new FormControl(APARENCIA_PADRAO.titulo, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
    subtitulo: new FormControl(APARENCIA_PADRAO.subtitulo ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(120)],
    }),
    saudacao: new FormControl(APARENCIA_PADRAO.saudacao ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    corPrimaria: new FormControl(APARENCIA_PADRAO.corPrimaria, {
      nonNullable: true,
      validators: [validarCor],
    }),
    corTexto: new FormControl('auto', { nonNullable: true }),
    tema: new FormControl<TemaDoWidget>(APARENCIA_PADRAO.tema, { nonNullable: true }),
    posicao: new FormControl<PosicaoDoWidget>(APARENCIA_PADRAO.posicao, { nonNullable: true }),
    contato: new FormControl<ContatoDoFormulario>('EMAIL_OU_TELEFONE', { nonNullable: true }),
    textoConsentimento: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    urlPrivacidade: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500), validarUrl],
    }),
    permitirAnexos: new FormControl(true, { nonNullable: true }),
  });

  /** O valor do formulário como signal (prévia e "alterações não salvas"). */
  private readonly valores = signal(this.formulario.getRawValue());
  protected readonly alterado = signal(false);

  protected readonly pronto = computed(
    () => this.id() === undefined || this.canal.dados() !== null,
  );
  protected readonly recemCriado = computed(() => this.criado() === '1');
  protected readonly situacao = computed(() => {
    const canal = this.canal.dados();
    return canal ? situacaoDoCanal(canal) : null;
  });

  protected readonly opcoesCorTexto = computed<readonly OpcaoGrupo<string>[]>(() => {
    const opcoes: OpcaoGrupo<string>[] = [
      { valor: 'auto', rotulo: 'Automática' },
      { valor: COR_TEXTO_BRANCA, rotulo: 'Branco' },
      { valor: COR_TEXTO_ESCURA, rotulo: 'Escuro' },
    ];
    const outra = this.corTextoPersonalizada();
    if (outra) {
      opcoes.push({ valor: outra, rotulo: outra });
    }
    return opcoes;
  });

  protected readonly aparencia = computed<AparenciaDoWidget>(() => {
    const v = this.valores();
    const corPrimaria = ehCor(v.corPrimaria) ? v.corPrimaria : APARENCIA_PADRAO.corPrimaria;
    return {
      titulo: v.titulo.trim() || APARENCIA_PADRAO.titulo,
      subtitulo: v.subtitulo.trim() || null,
      saudacao: v.saudacao.trim() || null,
      corPrimaria,
      corTextoPrimaria: v.corTexto === 'auto' ? corDeTextoPara(corPrimaria) : v.corTexto,
      tema: v.tema,
      posicao: v.posicao,
    };
  });

  protected readonly contrasteBaixo = computed(() => {
    const a = this.aparencia();
    return contraste(a.corPrimaria, a.corTextoPrimaria) < 3;
  });

  protected readonly paginaDeTeste = computed<SafeHtml>(() => {
    const canal = this.canal.dados();
    if (!canal) {
      return '';
    }
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Teste do chat</title></head><body style="margin:0;min-height:100vh;font:14px system-ui,sans-serif;background:#f4f4f1"><script src="${atributo(canal.instalacao.urlDoWidget)}" data-chave="${atributo(canal.chavePublica)}" data-aberto="true" async></script></body></html>`;
    // O widget é o da própria API do CRM (o mesmo trecho que vai para o site do cliente).
    return this.sanitizador.bypassSecurityTrustHtml(html);
  });

  constructor() {
    this.formulario.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.valores.set(this.formulario.getRawValue());
      this.alterado.set(this.formulario.dirty);
    });
    effect(() => {
      this.id();
      untracked(() => this.abrir());
    });
  }

  protected abrir(): void {
    void this.filas.carregar();
    const id = this.id();
    if (id === undefined) {
      this.canal.limpar();
      return;
    }
    void this.canal
      .executar(() => this.api.detalharSite(id))
      .then((ok) => {
        if (ok) {
          this.preencher(this.canal.dados()!);
          if (this.recemCriado()) {
            afterNextRender(
              () => document.getElementById('instalacao')?.scrollIntoView({ block: 'center' }),
              { injector: this.injector },
            );
          }
        }
      });
  }

  private preencher(canal: Canal): void {
    this.filas.definirAtual(canal.filaPadrao);
    const a = canal.aparencia;
    const automatica = a.corTextoPrimaria.toUpperCase() === corDeTextoPara(a.corPrimaria);
    const corTexto = automatica ? 'auto' : a.corTextoPrimaria.toUpperCase();
    this.corTextoPersonalizada.set(
      corTexto === 'auto' || corTexto === COR_TEXTO_BRANCA || corTexto === COR_TEXTO_ESCURA
        ? null
        : corTexto,
    );
    this.formulario.reset({
      nome: canal.nome,
      filaPadraoId: canal.filaPadrao?.id ?? null,
      ativo: canal.ativo,
      dominios: canal.dominios,
      titulo: a.titulo,
      subtitulo: a.subtitulo ?? '',
      saudacao: a.saudacao ?? '',
      corPrimaria: a.corPrimaria.toUpperCase(),
      corTexto,
      tema: a.tema,
      posicao: a.posicao,
      contato: canal.contato,
      textoConsentimento:
        canal.textoConsentimento === TEXTO_CONSENTIMENTO_PADRAO ? '' : canal.textoConsentimento,
      urlPrivacidade: canal.urlPrivacidade ?? '',
      permitirAnexos: canal.permitirAnexos,
    });
    this.valores.set(this.formulario.getRawValue());
    this.alterado.set(false);
  }

  /** O que vai para a API: tudo na criação; na edição, só o que mudou. */
  private montarDados(atual: Canal | null): DadosCanalSite {
    const v = this.formulario.getRawValue();
    const aparencia = {
      titulo: v.titulo.trim(),
      subtitulo: v.subtitulo.trim() || null,
      saudacao: v.saudacao.trim() || null,
      corPrimaria: v.corPrimaria.toUpperCase(),
      corTextoPrimaria: v.corTexto === 'auto' ? null : v.corTexto,
      tema: v.tema,
      posicao: v.posicao,
    };
    const completo: DadosCanalSite & { nome: string } = {
      nome: v.nome.trim(),
      filaPadraoId: v.filaPadraoId,
      ativo: v.ativo,
      dominios: v.dominios,
      aparencia,
      contato: v.contato,
      textoConsentimento: v.textoConsentimento.trim() || null,
      urlPrivacidade: v.urlPrivacidade.trim() || null,
      permitirAnexos: v.permitirAnexos,
    };
    if (!atual) {
      return completo;
    }
    const a = atual.aparencia;
    const mudouAparencia =
      aparencia.titulo !== a.titulo ||
      aparencia.subtitulo !== a.subtitulo ||
      aparencia.saudacao !== a.saudacao ||
      aparencia.corPrimaria !== a.corPrimaria.toUpperCase() ||
      (aparencia.corTextoPrimaria ?? corDeTextoPara(aparencia.corPrimaria)) !==
        a.corTextoPrimaria.toUpperCase() ||
      aparencia.tema !== a.tema ||
      aparencia.posicao !== a.posicao;
    const consentimentoAtual =
      atual.textoConsentimento === TEXTO_CONSENTIMENTO_PADRAO ? null : atual.textoConsentimento;
    const mesmaLista =
      completo.dominios!.length === atual.dominios.length &&
      completo.dominios!.every((dominio, i) => dominio === atual.dominios[i]);
    return {
      ...(completo.nome !== atual.nome ? { nome: completo.nome } : {}),
      ...(completo.filaPadraoId !== (atual.filaPadrao?.id ?? null)
        ? { filaPadraoId: completo.filaPadraoId }
        : {}),
      ...(completo.ativo !== atual.ativo ? { ativo: completo.ativo } : {}),
      ...(!mesmaLista ? { dominios: completo.dominios } : {}),
      ...(mudouAparencia ? { aparencia } : {}),
      ...(completo.contato !== atual.contato ? { contato: completo.contato } : {}),
      ...(completo.textoConsentimento !== consentimentoAtual
        ? { textoConsentimento: completo.textoConsentimento }
        : {}),
      ...(completo.urlPrivacidade !== atual.urlPrivacidade
        ? { urlPrivacidade: completo.urlPrivacidade }
        : {}),
      ...(completo.permitirAnexos !== atual.permitirAnexos
        ? { permitirAnexos: completo.permitirAnexos }
        : {}),
    };
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
    const atual = this.canal.dados();
    const dados = this.montarDados(atual);
    if (atual && Object.keys(dados).length === 0) {
      this.avisos.info('Nada mudou: não havia o que salvar.');
      return;
    }
    this.salvando.set(true);
    try {
      if (atual) {
        const salvo = await this.api.atualizarSite(atual.id, dados);
        this.canal.definir(salvo);
        this.preencher(salvo);
        this.avisos.sucesso('Chat do site salvo. O site mostra as mudanças na próxima visita.');
      } else {
        const criado = await this.api.criarSite(dados as DadosCanalSite & { nome: string });
        this.formulario.markAsPristine();
        this.avisos.sucesso('Chat do site criado. Agora copie o trecho de instalação.');
        await this.router.navigate(linkDoCanal('WEBCHAT', criado.id), {
          queryParams: { criado: '1' },
          replaceUrl: true,
        });
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
      const nome = CAMPOS_DA_API[campo] ?? (campo.startsWith('dominios') ? 'dominios' : null);
      const controle = nome ? this.formulario.get(nome) : null;
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
      this.formulario.controls.nome.setErrors({ api: erro.mensagem });
      this.campoNome()?.focar();
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
      titulo: `Excluir o chat do site “${canal.nome}”?`,
      mensagem:
        'O botão do chat para de funcionar em todos os sites onde o trecho foi colado. As conversas que já aconteceram continuam no Atendimento.',
      confirmar: 'Excluir chat do site',
      perigo: true,
      executar: () => this.api.excluirSite(canal.id),
    });
    if (ok) {
      this.avisos.sucesso(`Chat do site “${canal.nome}” excluído.`);
      void this.router.navigate(['/configuracoes', 'canais']);
    }
  }
}
