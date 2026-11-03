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
} from '@angular/core';
import { LucideArrowLeft, LucideFilePlus2, LucideSend } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { Botao } from '../../ui/botao/botao';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { CampoTexto, type ValorCampoTexto } from '../../ui/campo-texto/campo-texto';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Selo } from '../../ui/selo/selo';
import { ROTULO_CATEGORIA_TEMPLATE } from '../configuracoes/canais/apresentacao';
import type { TemplateDoCanal } from '../configuracoes/canais/canais.modelos';
import { AtendimentoApi } from './atendimento.api';
import type { MensagemDaConversa, TemplatesDaConversa } from './atendimento.tipos';
import {
  aceitaDoCabecalho,
  exigeMidia,
  filtrarTemplates,
  previaDoTemplate,
  rascunhoVazio,
  type RascunhoDoTemplate,
  ROTULO_MIDIA,
  variaveisDoEnvio,
  variaveisFaltando,
} from './templates';

/**
 * Escolha e envio de um template aprovado (WhatsApp oficial, Onda E1): busca, lista, prévia do que
 * o contato verá, formulário das variáveis (cabeçalho, corpo e botão de URL), arquivo do cabeçalho
 * de mídia e o envio. Serve de compositor fora da janela de 24 h e, dentro dela, abre num modal.
 * Os erros da API aparecem aqui mesmo, ao lado do botão; a mensagem enviada sobe em `enviado`.
 */
@Component({
  selector: 'app-seletor-template',
  imports: [Botao, CampoBusca, CampoTexto, Esqueleto, EstadoVazio, Selo],
  templateUrl: './seletor-template.html',
  styleUrl: './seletor-template.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeletorTemplate {
  readonly conversaId = input.required<string>();
  /** Muda quando a conversa muda de estado (a lista é buscada de novo). */
  readonly versao = input<unknown>(null);

  readonly enviado = output<MensagemDaConversa>();
  /** A API recusou o envio com 422 (janela, opt-out…): a conversa deve ser relida. */
  readonly recusado = output<ErroApi>();

  private readonly api = inject(AtendimentoApi);

  protected readonly icones = {
    voltar: LucideArrowLeft,
    enviar: LucideSend,
    arquivo: LucideFilePlus2,
  };
  protected readonly categorias = ROTULO_CATEGORIA_TEMPLATE;
  protected readonly rotuloMidia = ROTULO_MIDIA;

  protected readonly dados = signal<TemplatesDaConversa | null>(null);
  protected readonly erroCarga = signal<ErroApi | null>(null);
  protected readonly busca = signal('');
  protected readonly escolhido = signal<TemplateDoCanal | null>(null);
  protected readonly rascunho = signal<RascunhoDoTemplate>({
    cabecalho: [],
    corpo: [],
    botoes: [],
  });
  protected readonly arquivo = signal<File | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erroEnvio = signal<string | null>(null);
  protected readonly tentou = signal(false);

  protected readonly filtrados = computed(() =>
    filtrarTemplates(this.dados()?.itens ?? [], this.busca()),
  );
  protected readonly previa = computed(() => {
    const template = this.escolhido();
    return template
      ? previaDoTemplate(template, {
          cabecalho: this.rascunho().cabecalho,
          corpo: this.rascunho().corpo,
        })
      : null;
  });
  protected readonly faltando = computed(() => {
    const template = this.escolhido();
    return template ? variaveisFaltando(template, this.rascunho()) : [];
  });
  protected readonly precisaMidia = computed(() => {
    const template = this.escolhido();
    return !!template && exigeMidia(template);
  });
  protected readonly aceita = computed(() => {
    const template = this.escolhido();
    return template ? aceitaDoCabecalho(template) : '';
  });

  constructor() {
    effect(() => {
      this.conversaId();
      this.versao();
      untracked(() => {
        this.escolhido.set(null);
        void this.carregar();
      });
    });
  }

  protected async carregar(): Promise<void> {
    this.erroCarga.set(null);
    this.dados.set(null);
    try {
      this.dados.set(await firstValueFrom(this.api.templates(this.conversaId())));
    } catch (falha) {
      this.erroCarga.set(erroDaApi(falha));
    }
  }

  protected escolher(template: TemplateDoCanal): void {
    this.escolhido.set(template);
    this.rascunho.set(rascunhoVazio(template));
    this.arquivo.set(null);
    this.erroEnvio.set(null);
    this.tentou.set(false);
  }

  protected voltar(): void {
    this.escolhido.set(null);
    this.erroEnvio.set(null);
  }

  protected mudar(parte: keyof RascunhoDoTemplate, indice: number, valor: ValorCampoTexto): void {
    this.rascunho.update((atual) => ({
      ...atual,
      [parte]: atual[parte].map((item, i) => (i === indice ? String(valor ?? '') : item)),
    }));
  }

  protected escolherArquivo(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    this.arquivo.set(campo.files?.[0] ?? null);
    campo.value = '';
  }

  protected async enviar(): Promise<void> {
    const template = this.escolhido();
    if (!template || this.enviando()) {
      return;
    }
    this.tentou.set(true);
    this.erroEnvio.set(null);
    if (this.faltando().length > 0 || (this.precisaMidia() && !this.arquivo())) {
      return;
    }
    this.enviando.set(true);
    try {
      let arquivoId: string | undefined;
      const arquivo = this.arquivo();
      if (arquivo && this.precisaMidia()) {
        arquivoId = (await this.api.enviarArquivo(arquivo)).id;
      }
      const variaveis = variaveisDoEnvio(template, this.rascunho());
      const mensagem = await this.api.enviar(this.conversaId(), {
        template: { templateId: template.id, variaveis },
        ...(arquivoId ? { arquivoId } : {}),
      });
      this.escolhido.set(null);
      this.arquivo.set(null);
      this.enviado.emit(mensagem);
    } catch (falha) {
      const erro = erroDaApi(falha);
      this.erroEnvio.set(erro.mensagem);
      if (erro.status === 422) {
        this.recusado.emit(erro);
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
