import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';

import { erroDaApi, type ErroApi } from '../../../nucleo/api/erro-api';
import { formatarDataHora } from '../../../nucleo/formatos';
import { rotuloDaPessoa } from '../../../nucleo/setores/setores';
import { AjudaApi } from '../../../layout/ajuda/ajuda.api';
import {
  ROTULO_CATEGORIA,
  type ChamadoDto,
  type DetalheConversa,
} from '../../../layout/ajuda/ajuda.tipos';
import { MarkdownSimples } from '../../../layout/ajuda/markdown';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { PainelLateral } from '../../../ui/painel-lateral/painel-lateral';
import { Selo } from '../../../ui/selo/selo';

/** Painel com a conversa inteira de uma pergunta do histórico (só leitura, só Admin). */
@Component({
  selector: 'app-detalhe-conversa-duvida',
  imports: [EstadoVazio, MarkdownSimples, PainelLateral, Selo],
  template: `
    <app-painel-lateral
      [(aberto)]="aberto"
      titulo="Conversa"
      complemento="· assistente"
      [descricao]="descricao()"
      largura="lg"
    >
      @if (erro(); as falha) {
        <app-estado-vazio
          compacto
          variante="erro"
          titulo="Não abriu a conversa"
          [texto]="falha.resumo"
        />
      } @else if (carregando()) {
        <p class="fraco" role="status">Carregando…</p>
      } @else if (detalhe(); as d) {
        <ol class="conversa" aria-label="Perguntas e respostas">
          @for (p of d.perguntas; track p.id) {
            <li class="item">
              <p class="fraco">
                {{ dataHora(p.criadoEm) }}
                @if (p.tela) {
                  · tela <code>{{ p.tela }}</code>
                }
              </p>
              <p class="pergunta">
                <span class="visualmente-oculto">Pergunta: </span>{{ p.pergunta }}
              </p>
              <div class="resposta">
                <p class="visualmente-oculto">Resposta:</p>
                @if (p.resposta) {
                  <app-markdown-simples [texto]="p.resposta" />
                } @else {
                  <p class="fraco">{{ p.erro ?? 'Sem resposta.' }}</p>
                }
              </div>
              <p class="selos">
                @if (p.categoria) {
                  <app-selo tamanho="sm" variante="contorno">{{
                    rotuloCategoria[p.categoria]
                  }}</app-selo>
                }
                @if (p.resolvido === false) {
                  <app-selo tamanho="sm" variante="lima">Não resolvida</app-selo>
                }
                @if (p.avaliacao === 'UTIL') {
                  <app-selo tamanho="sm" variante="menta">Útil</app-selo>
                } @else if (p.avaliacao === 'NAO_UTIL') {
                  <app-selo tamanho="sm" variante="coral">Não útil</app-selo>
                }
              </p>
              @if (p.chamado; as c) {
                <p class="chamado">{{ situacao(c) }}</p>
              }
            </li>
          }
        </ol>
      }
    </app-painel-lateral>
  `,
  styles: `
    .conversa {
      display: grid;
      gap: var(--esp-5);
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .item {
      display: grid;
      gap: var(--esp-2);
    }
    .fraco {
      font: var(--fonte-legenda);
      color: var(--cor-texto-fraco);
    }
    .pergunta {
      justify-self: end;
      max-width: 90%;
      padding: var(--esp-2) var(--esp-4);
      border-radius: var(--raio-xl);
      background: var(--cor-inverso);
      color: var(--cor-sobre-inverso);
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
    .resposta {
      padding: var(--esp-3) var(--esp-4);
      border-radius: var(--raio-xl);
      background: var(--cor-superficie-2);
    }
    .selos {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
    }
    .chamado {
      font: var(--fonte-corpo-sm);
      padding: var(--esp-2) var(--esp-3);
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-lg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalheConversaDuvida {
  private readonly api = inject(AjudaApi);

  readonly aberto = model(false);
  readonly conversaId = input<string | null>(null);

  protected readonly rotuloCategoria = ROTULO_CATEGORIA;
  protected readonly detalhe = signal<DetalheConversa | null>(null);
  protected readonly carregando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly descricao = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.conversaId();
      const aberto = this.aberto();
      if (id && aberto) {
        untracked(() => void this.carregar(id));
      }
    });
  }

  private async carregar(id: string): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    this.detalhe.set(null);
    try {
      const d = await this.api.conversa(id);
      this.detalhe.set(d);
      this.descricao.set(
        d.usuario
          ? `${d.usuario.nome}${d.usuario.papel ? ' · ' + rotuloDaPessoa({ papel: d.usuario.papel, area: d.usuario.area }) : ''}`
          : d.titulo,
      );
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    } finally {
      this.carregando.set(false);
    }
  }

  protected dataHora(valor: string): string {
    return formatarDataHora(valor);
  }

  protected situacao(c: ChamadoDto): string {
    const destino = c.destino === 'TICKETHUB' ? 'TicketHub' : 'webhook';
    return c.status === 'ENVIADO'
      ? `Chamado nº ${c.numero ?? ''} aberto (${destino}).`
      : c.status === 'FALHOU'
        ? `Chamado falhou (${destino}): ${c.ultimoErro ?? 'sem detalhe'}.`
        : `Chamado pendente (${destino}), ${c.tentativas} tentativas.`;
  }
}
