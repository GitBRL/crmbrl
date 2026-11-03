import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  LucideCircleCheck,
  LucideCircleHelp,
  LucideClock,
  LucideDynamicIcon,
  LucidePhone,
  LucideRefreshCw,
  LucideSend,
  LucideTriangleAlert,
} from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { LigacaoService } from '../../nucleo/ligacoes/ligacao.service';
import { LigacoesApi } from '../../nucleo/ligacoes/ligacoes.api';
import { type TomPermissao, visaoDaPermissao } from '../../nucleo/ligacoes/ligacoes.textos';
import type { PermissaoDeLigacao } from '../../nucleo/ligacoes/ligacoes.tipos';
import { acompanharSala, aoReceber } from '../../nucleo/tempo-real/auxiliares';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao, type VarianteBotao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Modal } from '../../ui/modal/modal';
import { Seletor } from '../../ui/seletor/seletor';
import type { TamanhoControle } from '../../ui/tipos';

export interface ContatoParaLigar {
  readonly id: string;
  readonly nome: string;
  /** `null`: o contato não tem telefone. `undefined`: não se sabe (a API confere ao ligar). */
  readonly telefone?: string | null;
  readonly empresa?: string | null;
}

const ICONE_DO_TOM = {
  ok: LucideCircleCheck,
  aviso: LucideClock,
  neutro: LucideCircleHelp,
  erro: LucideTriangleAlert,
} as const;

/**
 * Botão **Ligar** (Onda E, E2): no contato, na conversa do Atendimento (canal oficial), na
 * atividade de ligação e na régua de cobrança. Some quando nenhum canal tem ligações com botão
 * visível ou quando o usuário não usa o Atendimento.
 *
 * - Com `verPermissao`, mostra o estado da permissão do cliente ao lado do botão (concedida até
 *   tal dia, pedida, negada…) e o atualiza quando o cliente responde (`ligacao.permissao`).
 * - Ao clicar, confere a permissão na Meta. Com permissão, liga; sem ela, abre a janela
 *   "Pedir permissão para ligar", que explica os limites da Meta (quantos pedidos restam e
 *   quando poderá pedir de novo) e envia o pedido.
 * - O andamento da chamada (chamando, tocando, recusada, sem resposta, falhou) aparece na barra
 *   de ligação, que fica fixa na tela.
 */
@Component({
  selector: 'app-botao-ligar',
  imports: [LucideDynamicIcon, AreaTexto, Botao, BotaoIcone, Modal, Seletor],
  template: `
    @if (visivel()) {
      <div class="ligar" [class.ligar--coluna]="coluna()">
        @if (somenteIcone()) {
          <button
            appBotaoIcone
            type="button"
            [variante]="variante()"
            [tamanho]="tamanho()"
            [icone]="icones.telefone"
            [rotulo]="rotulo()"
            [disabled]="desabilitado() || conferindo()"
            (click)="clicar()"
          ></button>
        } @else {
          <button
            appBotao
            type="button"
            [variante]="variante()"
            [tamanho]="tamanho()"
            [icone]="icones.telefone"
            [carregando]="conferindo()"
            [disabled]="desabilitado()"
            [attr.aria-describedby]="verPermissao() ? idEstado : null"
            (click)="clicar()"
          >
            {{ rotulo() }}
          </button>
        }
        @if (verPermissao()) {
          <p class="ligar__estado" [id]="idEstado" [attr.data-tom]="tom()" aria-live="polite">
            @if (permissaoErro(); as falha) {
              <svg [lucideIcon]="icones.aviso" [size]="14" aria-hidden="true" />
              <span>Não foi possível conferir a permissão. {{ falha }}</span>
              <button type="button" class="ligar__link" (click)="carregar(true)">
                Tentar de novo
              </button>
            } @else if (visao(); as v) {
              <svg [lucideIcon]="icone()" [size]="14" aria-hidden="true" />
              <span>{{ resumoCurto() }}</span>
              @if (!v.podeLigar) {
                <button type="button" class="ligar__link" (click)="abrirPermissao()">
                  {{ v.podePedir ? 'Pedir permissão' : 'Ver detalhes' }}
                </button>
              }
            }
          </p>
        }
      </div>

      <app-modal
        [titulo]="'Ligar para ' + contato().nome"
        [aberto]="modal() !== null"
        (fechado)="modal.set(null)"
        largura="md"
      >
        @switch (modal()) {
          @case ('canal') {
            <p class="ligar__texto">
              Este WhatsApp oficial tem mais de um número com ligações. Escolha por qual deles
              ligar.
            </p>
            <app-seletor
              rotulo="Número da empresa"
              [opcoes]="opcoesDeCanal()"
              [(valor)]="canalEscolhido"
            />
          }
          @case ('permissao') {
            @if (visao(); as v) {
              <div class="ligar__bloco" [attr.data-tom]="v.tom">
                <p class="ligar__titulo">
                  <svg [lucideIcon]="icone()" [size]="18" aria-hidden="true" />
                  {{ v.titulo }}
                </p>
                <p class="ligar__texto">{{ v.texto }}</p>
              </div>
              @if (permissao(); as p) {
                @if (p.semRespostaSeguidas >= 2) {
                  <p class="ligar__texto ligar__texto--aviso">
                    {{ p.semRespostaSeguidas }} ligações seguidas sem resposta. Com 4, a Meta retira
                    a permissão do cliente.
                  </p>
                }
              }
              @if (v.podePedir) {
                <app-area-texto
                  rotulo="Mensagem do pedido (opcional)"
                  [linhas]="3"
                  [maximoCaracteres]="1024"
                  placeholder="Ex.: Podemos te ligar para combinar os detalhes?"
                  dica="Se ficar em branco, vai a mensagem padrão. Fora da janela de 24 horas o pedido vai por um template aprovado e este texto não é usado."
                  [(valor)]="textoDoPedido"
                />
              } @else if (v.motivoSemPedido) {
                <p class="ligar__texto ligar__texto--aviso" role="note">{{ v.motivoSemPedido }}</p>
              }
              <p class="ligar__limites">{{ v.limites }}</p>
            }
          }
        }
        <div modal-rodape class="ligar__rodape">
          @switch (modal()) {
            @case ('canal') {
              <button appBotao type="button" variante="contorno" (click)="modal.set(null)">
                Cancelar
              </button>
              <button
                appBotao
                type="button"
                variante="invertido"
                [disabled]="!canalEscolhido()"
                (click)="continuarComCanal()"
              >
                Continuar
              </button>
            }
            @case ('permissao') {
              <button
                appBotao
                type="button"
                variante="contorno"
                [icone]="icones.atualizar"
                [carregando]="conferindo()"
                (click)="carregar(true)"
              >
                Atualizar
              </button>
              @if (visao()?.podePedir) {
                <button
                  appBotao
                  type="button"
                  variante="invertido"
                  [icone]="icones.enviar"
                  [carregando]="pedindo()"
                  (click)="pedir()"
                >
                  Pedir permissão para ligar
                </button>
              } @else {
                <button appBotao type="button" variante="invertido" (click)="modal.set(null)">
                  Fechar
                </button>
              }
            }
          }
        </div>
      </app-modal>
    }
  `,
  styleUrl: './botao-ligar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BotaoLigar {
  readonly contato = input.required<ContatoParaLigar>();
  /** Canal da conversa (Atendimento). Sem ele: o único canal com ligações ou o escolhido no modal. */
  readonly canalId = input<string | null>(null);
  /** Atividade `LIGACAO` pendente que esta chamada cumpre. */
  readonly atividadeId = input<string | null>(null);
  /** Conversa aberta (acompanha a resposta do cliente ao pedido de permissão). */
  readonly conversaId = input<string | null>(null);
  readonly rotulo = input('Ligar');
  readonly variante = input<VarianteBotao>('invertido');
  readonly tamanho = input<TamanhoControle>('md');
  /** Mostra o estado da permissão do cliente ao lado do botão (consulta ao montar). */
  readonly verPermissao = input(false, { transform: booleanAttribute });
  /** Estado da permissão embaixo do botão, não ao lado. */
  readonly coluna = input(false, { transform: booleanAttribute });
  /** Só o ícone (cabeçalho apertado); o `rotulo` vira o nome acessível. */
  readonly somenteIcone = input(false, { transform: booleanAttribute });

  private readonly api = inject(LigacoesApi);
  private readonly avisos = inject(AvisosService);
  protected readonly ligacoes = inject(LigacaoService);

  protected readonly icones = {
    telefone: LucidePhone,
    aviso: LucideTriangleAlert,
    atualizar: LucideRefreshCw,
    enviar: LucideSend,
  };
  protected readonly idEstado = `ligar-estado-${Math.random().toString(36).slice(2, 8)}`;

  protected readonly permissao = signal<PermissaoDeLigacao | null>(null);
  protected readonly permissaoErro = signal<string | null>(null);
  protected readonly conferindo = signal(false);
  protected readonly pedindo = signal(false);
  protected readonly modal = signal<'canal' | 'permissao' | null>(null);
  protected readonly canalEscolhido = signal<string | null>(null);
  protected readonly textoDoPedido = signal('');

  private readonly canaisDisponiveis = computed(() => this.ligacoes.canais() ?? []);

  /** O canal desta ligação: o informado, ou o único com ligações. `null`: é preciso escolher. */
  protected readonly canalEfetivo = computed(() => {
    const canais = this.canaisDisponiveis();
    const informado = this.canalId();
    if (informado) {
      return canais.some((canal) => canal.id === informado) ? informado : null;
    }
    return canais.length === 1 ? canais[0].id : (this.canalEscolhido() ?? null);
  });

  protected readonly visivel = computed(() => {
    if (!this.ligacoes.usaAtendimento()) {
      return false;
    }
    const canais = this.canaisDisponiveis();
    const informado = this.canalId();
    return informado ? canais.some((canal) => canal.id === informado) : canais.length > 0;
  });

  protected readonly desabilitado = computed(
    () => this.ligacoes.ocupado() || this.contato().telefone === null || this.pedindo(),
  );

  protected readonly visao = computed(() => {
    const permissao = this.permissao();
    return permissao ? visaoDaPermissao(permissao) : null;
  });
  protected readonly tom = computed<TomPermissao>(() => this.visao()?.tom ?? 'neutro');
  protected readonly icone = computed(() => ICONE_DO_TOM[this.tom()]);
  protected readonly opcoesDeCanal = computed(() =>
    this.canaisDisponiveis().map((canal) => ({ valor: canal.id, rotulo: canal.nome })),
  );
  protected readonly resumoCurto = computed(() => {
    const visao = this.visao();
    if (!visao) {
      return '';
    }
    if (this.contato().telefone === null) {
      return 'O contato não tem telefone.';
    }
    return visao.podeLigar ? visao.texto : visao.titulo;
  });

  constructor() {
    acompanharSala(() => {
      const id = this.conversaId();
      return id && this.verPermissao() ? { tipo: 'conversa', id } : null;
    });
    aoReceber('ligacao.permissao', (permissao) => {
      if (
        permissao.contatoId === this.contato().id &&
        (!this.canalEfetivo() || permissao.canalId === this.canalEfetivo())
      ) {
        this.permissao.set(permissao);
        this.permissaoErro.set(null);
      }
    });
    // Consulta a permissão ao montar (e quando o contato ou o canal mudam).
    effect(() => {
      const ativo = this.visivel() && this.verPermissao() && this.contato().telefone !== null;
      const chave = `${this.contato().id}|${this.canalEfetivo()}`;
      if (ativo && this.canalEfetivo()) {
        untracked(() => {
          if (this.permissao()?.contatoId !== this.contato().id || chave !== this.ultimaChave) {
            this.ultimaChave = chave;
            void this.carregar(false);
          }
        });
      }
    });
    // Uma ligação terminou: a permissão pode ter mudado (4 sem resposta revogam).
    effect(() => {
      this.ligacoes.encerradas();
      untracked(() => {
        if (this.permissao() && this.visivel()) {
          void this.carregar(false);
        }
      });
    });
  }

  private ultimaChave = '';

  /** Lê a permissão (`atualizar`: confere na Meta, que não avisa quando ela vence). */
  protected async carregar(atualizar: boolean): Promise<void> {
    const canal = this.canalEfetivo();
    if (!canal) {
      return;
    }
    if (atualizar) {
      this.conferindo.set(true);
    }
    try {
      this.permissao.set(await this.api.permissao(this.contato().id, canal, atualizar));
      this.permissaoErro.set(null);
    } catch (falha) {
      this.permissaoErro.set(mensagemCurta(erroDaApi(falha)));
    } finally {
      this.conferindo.set(false);
    }
  }

  protected async clicar(): Promise<void> {
    if (this.desabilitado() || this.conferindo()) {
      return;
    }
    if (!this.canalEfetivo()) {
      this.modal.set('canal');
      return;
    }
    await this.conferirELigar();
  }

  protected abrirPermissao(): void {
    this.modal.set('permissao');
  }

  protected async continuarComCanal(): Promise<void> {
    this.modal.set(null);
    if (this.canalEfetivo()) {
      await this.conferirELigar();
    }
  }

  private async conferirELigar(): Promise<void> {
    const canal = this.canalEfetivo()!;
    this.conferindo.set(true);
    let permissao: PermissaoDeLigacao;
    try {
      permissao = await this.api.permissao(this.contato().id, canal, true);
      this.permissao.set(permissao);
      this.permissaoErro.set(null);
    } catch (falha) {
      this.conferindo.set(false);
      this.avisos.erro(falha, { chave: 'ligar-erro' });
      return;
    }
    this.conferindo.set(false);
    if (!permissao.podeLigar) {
      this.modal.set('permissao');
      return;
    }
    const contato = this.contato();
    const resultado = await this.ligacoes.ligar({
      contato,
      canalId: canal,
      atividadeId: this.atividadeId(),
      conversaId: this.conversaId(),
    });
    if (!resultado.ok) {
      if (resultado.motivo === 'sem_permissao') {
        await this.carregar(true);
        this.modal.set('permissao');
      } else {
        this.avisos.erro(resultado.mensagem, { chave: 'ligar-erro' });
      }
    }
  }

  protected async pedir(): Promise<void> {
    const canal = this.canalEfetivo();
    if (!canal || this.pedindo()) {
      return;
    }
    this.pedindo.set(true);
    try {
      const texto = this.textoDoPedido().trim();
      this.permissao.set(
        await this.api.pedirPermissao({
          contatoId: this.contato().id,
          canalId: canal,
          ...(texto ? { texto } : {}),
        }),
      );
      this.avisos.sucesso('Pedido enviado. O botão Ligar libera quando o cliente permitir.');
      this.textoDoPedido.set('');
    } catch (falha) {
      this.avisos.erro(falha, { chave: 'ligar-erro' });
      await this.carregar(true);
    } finally {
      this.pedindo.set(false);
    }
  }
}

function mensagemCurta(erro: ErroApi): string {
  return erro.status === 503 ? 'A Meta não respondeu.' : erro.resumo;
}
