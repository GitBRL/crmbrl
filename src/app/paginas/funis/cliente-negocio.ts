import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { formatarData, formatarDataHora } from '../../nucleo/formatos';
import { BotaoLigarTresc } from '../../layout/tresc-plus/botao-ligar-tresc';
import { Botao } from '../../ui/botao/botao';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Selo } from '../../ui/selo/selo';
import { ContatosApi } from '../contatos/contatos.api';
import {
  type Contato,
  descreverUtm,
  type Empresa,
  type Origem,
  ROTULO_ORIGEM,
} from '../contatos/contatos.tipos';
import { listarCampos, rotuloDoCampo } from '../contatos/dados-personalizados';
import { formatarTelefone } from './novo-negocio';

/**
 * Aba "Cliente" do detalhe do negócio: o cadastro do contato (meios de contato, empresa,
 * responsável, etiquetas, origens, LGPD) com os campos personalizados dele e, quando o contato
 * tem empresa, os dados e os campos personalizados da empresa. Só leitura: editar é na página do
 * contato. Carrega ao abrir a aba (todo papel lê contatos, §12); a empresa que falhar não
 * esconde o contato.
 */
@Component({
  selector: 'app-cliente-negocio',
  imports: [Botao, BotaoLigarTresc, Esqueleto, EstadoVazio, RouterLink, Selo],
  template: `
    @if (carregando() && !contato()) {
      <div aria-busy="true">
        <p class="visualmente-oculto" role="status">Carregando os dados do cliente…</p>
        <app-esqueleto [linhas]="6" />
      </div>
    } @else if (erro(); as falha) {
      <app-estado-vazio
        compacto
        variante="erro"
        [falha]="falha"
        titulo="Não conseguimos carregar os dados do cliente"
        [texto]="falha.resumo"
        [codigo]="falha.requisicaoId"
      >
        <button appBotao type="button" variante="contorno" (click)="carregar()">
          Tentar de novo
        </button>
      </app-estado-vazio>
    } @else if (contato(); as c) {
      <section class="bloco" aria-labelledby="cliente-contato">
        <div class="bloco__topo">
          <h3 id="cliente-contato" class="bloco__titulo">Contato</h3>
          <a appBotao tamanho="sm" variante="contorno" [routerLink]="['/contatos', c.id]">
            {{ c.podeEditar ? 'Abrir e editar' : 'Abrir o contato' }}
          </a>
        </div>
        <dl class="ficha">
          <div class="ficha__linha">
            <dt>Nome</dt>
            <dd>{{ c.nome }}</dd>
          </div>
          <div class="ficha__linha">
            <dt>Cargo</dt>
            <dd>{{ c.cargo || '—' }}</dd>
          </div>
          <div class="ficha__linha">
            <dt>E-mail</dt>
            <dd>
              @if (c.email) {
                <a class="link" [href]="'mailto:' + c.email">{{ c.email }}</a>
              } @else {
                —
              }
            </dd>
          </div>
          <div class="ficha__linha">
            <dt>Telefone</dt>
            <dd class="numeros ficha__telefone">
              {{ telefone() || '—' }}
              @if (c.telefone) {
                <app-botao-ligar-tresc
                  [contatoId]="c.id"
                  [negocioId]="negocioId()"
                  [nome]="c.nome"
                />
              }
            </dd>
          </div>
          <div class="ficha__linha">
            <dt>Empresa</dt>
            <dd>
              @if (c.empresa; as empresa) {
                <a class="link" [routerLink]="['/empresas', empresa.id]">{{ empresa.nome }}</a>
              } @else {
                —
              }
            </dd>
          </div>
          <div class="ficha__linha">
            <dt>Responsável</dt>
            <dd>
              @if (c.responsavel; as responsavel) {
                {{ responsavel.nome }}
                @if (!responsavel.ativo) {
                  <span class="tom-fraco">(desligado)</span>
                }
              } @else {
                Sem responsável
              }
            </dd>
          </div>
          @if (c.etiquetas.length) {
            <div class="ficha__linha">
              <dt>Etiquetas</dt>
              <dd>
                @for (etiqueta of c.etiquetas; track etiqueta) {
                  <app-selo tamanho="sm" variante="contorno">{{ etiqueta }}</app-selo>
                }
              </dd>
            </div>
          }
          <div class="ficha__linha">
            <dt>Primeira origem</dt>
            <dd>{{ origem(c.primeiraOrigem) }}</dd>
          </div>
          @if (c.conversoes > 1) {
            <div class="ficha__linha">
              <dt>Última origem</dt>
              <dd>{{ origem(c.ultimaOrigem) }} · {{ dataHora(c.ultimaOrigem.em) }}</dd>
            </div>
            <div class="ficha__linha">
              <dt>Conversões</dt>
              <dd>{{ c.conversoes }} vezes</dd>
            </div>
          }
          @if (utm(); as campanha) {
            <div class="ficha__linha">
              <dt>Campanha</dt>
              <dd>{{ campanha }}</dd>
            </div>
          }
          @if (c.optOutMarketing) {
            <div class="ficha__linha">
              <dt>Marketing</dt>
              <dd>Não quer receber disparos{{ c.optOutEm ? ' desde ' + data(c.optOutEm) : '' }}</dd>
            </div>
          }
          @if (c.consentimento; as consentimento) {
            <div class="ficha__linha">
              <dt>Consentimento</dt>
              <dd>
                {{ consentimento.em ? dataHora(consentimento.em) : 'Registrado' }}
                @if (consentimento.origem) {
                  · {{ consentimento.origem }}
                }
              </dd>
            </div>
          }
          <div class="ficha__linha">
            <dt>Cadastrado em</dt>
            <dd>
              {{ dataHora(c.criadoEm) }}
              @if (c.criadoPor; as autor) {
                <span class="tom-fraco">por {{ autor.nome }}</span>
              }
            </dd>
          </div>
        </dl>

        <h4 class="bloco__subtitulo">Campos personalizados</h4>
        @if (camposDoContato().length) {
          <dl class="ficha">
            @for (campo of camposDoContato(); track campo.chave) {
              <div class="ficha__linha">
                <dt [attr.title]="campo.chave">{{ rotuloDoCampo(campo.chave) }}</dt>
                <dd>{{ campo.valor || '—' }}</dd>
              </div>
            }
          </dl>
        } @else {
          <p class="vazio">Este contato não tem campos personalizados.</p>
        }
      </section>

      @if (c.empresa; as vinculada) {
        <section class="bloco" aria-labelledby="cliente-empresa">
          <h3 id="cliente-empresa" class="bloco__titulo">Empresa</h3>
          @if (empresa(); as e) {
            <dl class="ficha">
              <div class="ficha__linha">
                <dt>Nome</dt>
                <dd>
                  <a class="link" [routerLink]="['/empresas', e.id]">{{ e.nome }}</a>
                </dd>
              </div>
              @if (e.cnpjFormatado) {
                <div class="ficha__linha">
                  <dt>CNPJ</dt>
                  <dd class="numeros">{{ e.cnpjFormatado }}</dd>
                </div>
              }
              @if (e.segmento) {
                <div class="ficha__linha">
                  <dt>Segmento</dt>
                  <dd>{{ e.segmento }}</dd>
                </div>
              }
              @if (localDaEmpresa(); as local) {
                <div class="ficha__linha">
                  <dt>Cidade</dt>
                  <dd>{{ local }}</dd>
                </div>
              }
              @if (e.site) {
                <div class="ficha__linha">
                  <dt>Site</dt>
                  <dd>{{ e.site }}</dd>
                </div>
              }
              @if (e.email) {
                <div class="ficha__linha">
                  <dt>E-mail</dt>
                  <dd>
                    <a class="link" [href]="'mailto:' + e.email">{{ e.email }}</a>
                  </dd>
                </div>
              }
              @if (e.telefone) {
                <div class="ficha__linha">
                  <dt>Telefone</dt>
                  <dd class="numeros">{{ telefoneDa(e.telefone) }}</dd>
                </div>
              }
            </dl>
            @if (camposDaEmpresa().length) {
              <h4 class="bloco__subtitulo">Campos personalizados da empresa</h4>
              <dl class="ficha">
                @for (campo of camposDaEmpresa(); track campo.chave) {
                  <div class="ficha__linha">
                    <dt [attr.title]="campo.chave">{{ rotuloDoCampo(campo.chave) }}</dt>
                    <dd>{{ campo.valor || '—' }}</dd>
                  </div>
                }
              </dl>
            }
          } @else if (carregando()) {
            <app-esqueleto [linhas]="3" />
          } @else {
            <p class="vazio">
              {{ vinculada.nome }}: não conseguimos carregar os dados da empresa agora.
              <a class="link" [routerLink]="['/empresas', vinculada.id]">Abrir a empresa</a>
            </p>
          }
        </section>
      }
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: grid;
      gap: var(--esp-6);
    }

    .bloco {
      display: grid;
      gap: var(--esp-4);
    }

    .bloco + .bloco {
      padding-top: var(--esp-5);
      border-top: 1px solid var(--cor-borda);
    }

    .bloco__topo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--esp-2) var(--esp-3);
    }

    .bloco__titulo {
      margin: 0;
      color: var(--cor-texto);
      font: var(--fonte-h3);
    }

    .bloco__subtitulo {
      margin: var(--esp-2) 0 0;
      color: var(--cor-texto);
      font: var(--fonte-corpo-sm);
      font-weight: 600;
    }

    .ficha {
      display: grid;
      gap: var(--esp-3);
      margin: 0;
    }

    .ficha__linha {
      display: grid;
      grid-template-columns: 8rem minmax(0, 1fr);
      gap: var(--esp-3);
      align-items: baseline;

      dt {
        color: var(--cor-texto-fraco);
        font: var(--fonte-legenda-lg);
        overflow-wrap: anywhere;
      }

      dd {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--esp-1) var(--esp-2);
        min-width: 0;
        margin: 0;
        color: var(--cor-texto);
        font: var(--fonte-corpo-sm);
        overflow-wrap: anywhere;
      }
    }

    .link {
      color: var(--cor-texto);
      font-weight: 500;
      text-decoration: underline;
      text-decoration-color: var(--cor-borda-forte);
      text-underline-offset: 3px;
      overflow-wrap: anywhere;

      &:hover {
        text-decoration-color: currentColor;
      }
    }

    .vazio {
      margin: 0;
      color: var(--cor-texto-fraco);
      font: var(--fonte-corpo-sm);
    }

    @include m.abaixo(m.$sm) {
      .ficha__linha {
        grid-template-columns: minmax(0, 1fr);
        gap: 2px;
      }
    }
    .ficha__telefone {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-2) var(--esp-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClienteNegocio {
  readonly contatoId = input.required<string>();
  /** Negócio da ligação pelo 3C+ (a ligação entra nele). */
  readonly negocioId = input<string | null>(null);

  private readonly api = inject(ContatosApi);
  protected readonly contato = signal<Contato | null>(null);
  protected readonly empresa = signal<Empresa | null>(null);
  protected readonly carregando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly rotuloDoCampo = rotuloDoCampo;

  protected readonly telefone = computed(() => formatarTelefone(this.contato()?.telefone ?? null));
  protected readonly utm = computed(() => descreverUtm(this.contato()?.ultimaOrigem.utm));
  protected readonly camposDoContato = computed(() =>
    listarCampos(this.contato()?.camposPersonalizados ?? {}),
  );
  protected readonly camposDaEmpresa = computed(() =>
    listarCampos(this.empresa()?.camposPersonalizados ?? {}),
  );
  protected readonly localDaEmpresa = computed(() => {
    const empresa = this.empresa();
    return [empresa?.cidade, empresa?.uf].filter(Boolean).join(' / ') || null;
  });

  private pedido = 0;

  constructor() {
    effect(() => {
      this.contatoId();
      untracked(() => void this.carregar());
    });
  }

  async carregar(): Promise<void> {
    const pedido = ++this.pedido;
    const id = this.contatoId();
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const contato = await firstValueFrom(this.api.contato(id));
      if (pedido !== this.pedido) {
        return;
      }
      this.contato.set(contato);
      this.empresa.set(null);
      if (contato.empresa) {
        // A empresa é um extra: se falhar, o contato continua na tela.
        const empresa = await firstValueFrom(this.api.empresa(contato.empresa.id)).catch(
          () => null,
        );
        if (pedido === this.pedido) {
          this.empresa.set(empresa);
        }
      }
    } catch (falha) {
      if (pedido === this.pedido) {
        this.erro.set(erroDaApi(falha));
      }
    } finally {
      if (pedido === this.pedido) {
        this.carregando.set(false);
      }
    }
  }

  protected origem(origem: Origem): string {
    const rotulo = ROTULO_ORIGEM[origem.tipo] ?? origem.tipo;
    return origem.detalhe ? `${rotulo} · ${origem.detalhe}` : rotulo;
  }

  protected data(valor: string): string {
    return formatarData(valor);
  }

  protected dataHora(valor: string): string {
    return formatarDataHora(valor);
  }

  protected telefoneDa(valor: string): string {
    return formatarTelefone(valor) || valor;
  }
}
