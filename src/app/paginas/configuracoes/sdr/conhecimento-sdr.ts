import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucidePlus, LucideRefreshCw } from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { formatarDataHora } from '../../../nucleo/formatos';
import { AreaTexto } from '../../../ui/area-texto/area-texto';
import { Botao } from '../../../ui/botao/botao';
import { CampoTexto } from '../../../ui/campo-texto/campo-texto';
import { Cartao } from '../../../ui/cartao/cartao';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { Modal } from '../../../ui/modal/modal';
import { Selo } from '../../../ui/selo/selo';
import { textoOuNulo } from './rotulos';
import { SdrConfigApi } from './sdr.api';
import type { ArtigoSdr, VersaoArtigo } from './sdr.tipos';

const MAXIMO_CONTEUDO = 20_000;

/** Por que o artigo não pode ser salvo (ou `null`). */
export function erroDoArtigo(titulo: string, conteudo: string): string | null {
  if (titulo.trim().length < 2) {
    return 'Dê um título ao artigo (pelo menos 2 letras).';
  }
  if (titulo.trim().length > 120) {
    return 'O título aceita até 120 caracteres.';
  }
  if (conteudo.trim().length === 0) {
    return 'Escreva o texto do artigo.';
  }
  return conteudo.length > MAXIMO_CONTEUDO
    ? `O texto aceita até ${MAXIMO_CONTEUDO} caracteres.`
    : null;
}

/**
 * Configurações → SDR com IA → Base de conhecimento: os artigos que a IA pode citar (preços,
 * prazos, FAQ). Só os publicados vão para a IA; cada mudança de texto vira uma versão, que
 * dá para restaurar.
 */
@Component({
  selector: 'app-conhecimento-sdr',
  imports: [AreaTexto, Botao, CampoTexto, Cartao, Esqueleto, EstadoVazio, Modal, Selo],
  template: `
    <div class="parte">
      <app-cartao>
        <div class="bloco">
          <h3 class="titulo">O que a IA pode afirmar</h3>
          <p class="texto">
            A IA só informa preço, prazo ou condição que esteja num artigo
            <strong>publicado</strong>. Fora da base, ela diz que vai confirmar com a equipe.
            Escreva em texto simples: cursos, modalidades, valores, formas de pagamento, início das
            turmas, endereço e o que não oferecemos.
          </p>
        </div>
      </app-cartao>

      @if (erro(); as falha) {
        <app-estado-vazio
          variante="erro"
          titulo="Não conseguimos carregar os artigos"
          [falha]="falha"
          [texto]="falha.resumo"
          [codigo]="falha.ehFalhaDoServidor ? falha.requisicaoId : null"
        >
          <button appBotao type="button" variante="invertido" (click)="carregar()">
            Tentar de novo
          </button>
        </app-estado-vazio>
      } @else if (artigos() === null) {
        <app-cartao>
          <div class="esqueleto" aria-busy="true">
            <p class="visualmente-oculto" role="status">Carregando os artigos…</p>
            <app-esqueleto forma="bloco" altura="56px" />
            <app-esqueleto forma="bloco" altura="56px" />
          </div>
        </app-cartao>
      } @else {
        <div class="cabecalho-lista">
          <p class="texto" role="status">
            {{ publicados() }} de {{ artigos()!.length }} artigos publicados
          </p>
          <button appBotao type="button" variante="invertido" [icone]="iconeMais" (click)="novo()">
            Novo artigo
          </button>
        </div>
        @if (artigos()!.length === 0) {
          <app-estado-vazio
            titulo="Nenhum artigo ainda"
            texto="Crie o primeiro artigo, por exemplo com os cursos e os valores. Sem artigos publicados, a IA não afirma preços nem prazos."
          />
        } @else {
          <ul class="lista" aria-label="Artigos da base de conhecimento">
            @for (artigo of artigos(); track artigo.id) {
              <li class="item">
                <div class="item__textos">
                  <strong>{{ artigo.titulo }}</strong>
                  <span class="item__meta">
                    Versão {{ artigo.versao }} · atualizado em {{ data(artigo.atualizadoEm) }}
                  </span>
                </div>
                @if (artigo.ativo) {
                  <app-selo variante="menta" tamanho="sm" [ponto]="true">Publicado</app-selo>
                } @else {
                  <app-selo variante="neutro" tamanho="sm" [ponto]="true">Rascunho</app-selo>
                }
                <button
                  appBotao
                  type="button"
                  tamanho="sm"
                  [attr.aria-label]="'Editar ' + artigo.titulo"
                  (click)="editar(artigo)"
                >
                  Editar
                </button>
              </li>
            }
          </ul>
        }
      }
    </div>

    <app-modal
      [titulo]="editando() ? 'Editar artigo' : 'Novo artigo'"
      largura="lg"
      [aberto]="aberto()"
      (fechado)="fechar()"
    >
      <form class="formulario" (submit)="$event.preventDefault(); salvar(true)">
        <app-campo-texto
          rotulo="Título"
          [maximoCaracteres]="120"
          [erro]="erroDoCampo('titulo')"
          [(valor)]="titulo"
        />
        <app-area-texto
          rotulo="Texto do artigo"
          dica="Escreva como se explicasse a um colega novo. Inclua números exatos."
          [linhas]="10"
          [maximoLinhas]="24"
          [maximoCaracteres]="20000"
          [erro]="erroDoCampo('conteudo')"
          [(valor)]="conteudo"
        />
        @if (erroLocal(); as problema) {
          <p class="erro" role="alert">{{ problema }}</p>
        }
        @if (erroSalvar(); as falha) {
          <p class="erro" role="alert">Não foi possível salvar. {{ falha.resumo }}</p>
        }
        @if (editando(); as atual) {
          <details class="versoes">
            <summary (click)="carregarVersoes(atual)">Versões anteriores</summary>
            @if (versoes() === null) {
              <p class="texto" role="status">Carregando as versões…</p>
            } @else {
              <ul class="lista">
                @for (v of versoes(); track v.numero) {
                  <li class="item">
                    <div class="item__textos">
                      <strong>Versão {{ v.numero }}</strong>
                      <span class="item__meta">{{ data(v.criadoEm) }}</span>
                    </div>
                    @if (v.numero === atual.versao) {
                      <app-selo variante="contorno" tamanho="sm">atual</app-selo>
                    } @else {
                      <button
                        appBotao
                        type="button"
                        tamanho="sm"
                        [attr.aria-label]="'Restaurar a versão ' + v.numero"
                        (click)="restaurar(atual, v)"
                      >
                        Restaurar
                      </button>
                    }
                  </li>
                }
              </ul>
            }
          </details>
        }
      </form>
      <div modal-rodape class="rodape-modal">
        @if (editando(); as atual) {
          @if (confirmandoExclusao()) {
            <button
              appBotao
              type="button"
              variante="destaque"
              [carregando]="salvando()"
              (click)="excluir(atual)"
            >
              Confirmar exclusão
            </button>
          } @else {
            <button appBotao type="button" (click)="confirmandoExclusao.set(true)">Excluir</button>
          }
        }
        <span class="espaco"></span>
        <button appBotao type="button" [disabled]="salvando()" (click)="salvar(false)">
          Salvar como rascunho
        </button>
        <button
          appBotao
          type="button"
          variante="invertido"
          [carregando]="salvando()"
          (click)="salvar(true)"
        >
          Publicar
        </button>
      </div>
    </app-modal>
  `,
  styleUrl: './sdr-comum.scss',
  styles: `
    .rodape-modal {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-3);
      width: 100%;
    }

    .espaco {
      flex: 1 1 0;
    }

    .versoes {
      display: grid;
      gap: var(--esp-3);

      summary {
        cursor: pointer;
        font: var(--fonte-rotulo);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConhecimentoSdr {
  private readonly api = inject(SdrConfigApi);
  private readonly avisos = inject(AvisosService);

  protected readonly iconeMais = LucidePlus;
  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly data = formatarDataHora;

  protected readonly artigos = signal<readonly ArtigoSdr[] | null>(null);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly publicados = computed(
    () => (this.artigos() ?? []).filter((a) => a.ativo).length,
  );

  protected readonly aberto = signal(false);
  protected readonly editando = signal<ArtigoSdr | null>(null);
  protected readonly titulo = signal<string | number>('');
  protected readonly conteudo = signal('');
  protected readonly salvando = signal(false);
  protected readonly erroSalvar = signal<ErroApi | null>(null);
  protected readonly erroLocal = signal<string | null>(null);
  protected readonly versoes = signal<readonly VersaoArtigo[] | null>(null);
  protected readonly confirmandoExclusao = signal(false);

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    this.erro.set(null);
    try {
      this.artigos.set(await this.api.artigos());
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    }
  }

  protected novo(): void {
    this.editando.set(null);
    this.abrirModal('', '');
  }

  protected editar(artigo: ArtigoSdr): void {
    this.editando.set(artigo);
    this.abrirModal(artigo.titulo, artigo.conteudo);
  }

  private abrirModal(titulo: string, conteudo: string): void {
    this.titulo.set(titulo);
    this.conteudo.set(conteudo);
    this.erroSalvar.set(null);
    this.erroLocal.set(null);
    this.versoes.set(null);
    this.confirmandoExclusao.set(false);
    this.aberto.set(true);
  }

  protected fechar(): void {
    this.aberto.set(false);
  }

  protected async carregarVersoes(artigo: ArtigoSdr): Promise<void> {
    if (this.versoes() !== null) {
      return;
    }
    try {
      this.versoes.set(await this.api.versoes(artigo.id));
    } catch (falha) {
      this.avisos.erro(falha);
      this.versoes.set([]);
    }
  }

  /** Publica (`ativo`) ou guarda como rascunho. */
  protected async salvar(publicar: boolean): Promise<void> {
    const titulo = textoOuNulo(this.titulo());
    const impedimento = erroDoArtigo(titulo, this.conteudo());
    this.erroLocal.set(impedimento);
    if (impedimento) {
      return;
    }
    this.salvando.set(true);
    this.erroSalvar.set(null);
    try {
      const corpo = { titulo, conteudo: this.conteudo().trim(), ativo: publicar };
      const atual = this.editando();
      const salvo = atual
        ? await this.api.atualizarArtigo(atual.id, corpo)
        : await this.api.criarArtigo(corpo);
      this.artigos.update((lista) => {
        const itens = lista ?? [];
        return atual ? itens.map((a) => (a.id === salvo.id ? salvo : a)) : [...itens, salvo];
      });
      this.avisos.sucesso(publicar ? 'Artigo publicado.' : 'Rascunho salvo.');
      this.aberto.set(false);
    } catch (falha) {
      this.erroSalvar.set(erroDaApi(falha));
    } finally {
      this.salvando.set(false);
    }
  }

  protected async restaurar(artigo: ArtigoSdr, versao: VersaoArtigo): Promise<void> {
    this.salvando.set(true);
    try {
      const salvo = await this.api.restaurarVersao(artigo.id, versao.numero);
      this.artigos.update((lista) => (lista ?? []).map((a) => (a.id === salvo.id ? salvo : a)));
      this.avisos.sucesso(`Versão ${versao.numero} restaurada como versão ${salvo.versao}.`);
      this.aberto.set(false);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.salvando.set(false);
    }
  }

  protected async excluir(artigo: ArtigoSdr): Promise<void> {
    this.salvando.set(true);
    try {
      await this.api.excluirArtigo(artigo.id);
      this.artigos.update((lista) => (lista ?? []).filter((a) => a.id !== artigo.id));
      this.avisos.sucesso('Artigo excluído.');
      this.aberto.set(false);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.salvando.set(false);
    }
  }

  protected erroDoCampo(caminho: string): string | null {
    return this.erroSalvar()?.mensagemDoCampo(caminho) ?? null;
  }
}
