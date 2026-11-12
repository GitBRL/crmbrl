import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { TrescPlusApi } from '../../nucleo/tresc-plus/tresc-plus.api';
import type {
  CampanhaTresc,
  ListaTresc,
  RelatorioDoDiscador,
} from '../../nucleo/tresc-plus/tresc-plus.tipos';
import { Botao } from '../../ui/botao/botao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { Modal } from '../../ui/modal/modal';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';

type ModoDaLista = 'existente' | 'nova';

const MODOS: readonly OpcaoGrupo<ModoDaLista>[] = [
  { valor: 'existente', rotulo: 'Lista que já existe na campanha' },
  { valor: 'nova', rotulo: 'Criar uma lista nova' },
];

/**
 * "Enviar ao discador…" (R34.6): leva os negócios selecionados (ou contatos) para uma campanha
 * e uma lista do 3C+ e mostra o relatório de importados e filtrados, com o motivo. Só Admin,
 * C-level e líder veem a ação (a API confere de novo).
 */
@Component({
  selector: 'app-modal-discador',
  imports: [Botao, CampoTexto, Esqueleto, GrupoOpcoes, Modal, Seletor],
  template: `
    <app-modal [(aberto)]="aberto" titulo="Enviar ao discador" largura="md">
      @if (relatorio(); as r) {
        <div class="disc" role="status">
          <p class="disc__resumo">
            Lista <strong>{{ r.listaNome }}</strong
            >: <strong class="numeros">{{ r.importados }}</strong>
            {{ r.importados === 1 ? 'importado' : 'importados' }} de
            <span class="numeros">{{ r.enviados }}</span> enviados
            @if (r.filtrados > 0) {
              · <strong class="numeros">{{ r.filtrados }}</strong>
              {{ r.filtrados === 1 ? 'filtrado' : 'filtrados' }}
            }
          </p>
          @if (r.detalhes.length) {
            <p class="disc__dica">Estes números ficaram de fora:</p>
            <ul class="disc__lista" aria-label="Números filtrados e o motivo">
              @for (d of r.detalhes; track $index) {
                <li class="disc__item">
                  @if (d.telefone) {
                    <strong class="numeros">{{ d.telefone }}</strong>
                  }
                  <span>{{ d.motivo }}</span>
                </li>
              }
            </ul>
          } @else if (r.filtrados > 0) {
            <p class="disc__dica">O 3C+ filtrou {{ r.filtrados }} sem detalhar o motivo.</p>
          }
        </div>
      } @else {
        <div class="disc">
          <p class="disc__frase">
            Envia {{ textoTotal() }} para a fila de ligações do 3C+. O telefone, o nome, a empresa,
            o funil e a etapa vão junto.
          </p>
          @if (erroCampanhas(); as falha) {
            <p class="disc__erro" role="alert">{{ falha }}</p>
            <button appBotao type="button" tamanho="sm" (click)="carregarCampanhas()">
              Tentar de novo
            </button>
          } @else if (!campanhas()) {
            <div aria-busy="true">
              <p class="visualmente-oculto" role="status">Carregando as campanhas…</p>
              <app-esqueleto [linhas]="3" />
            </div>
          } @else if (!campanhas()!.length) {
            <p class="disc__dica">Não há campanhas no 3C+. Crie uma lá e volte aqui.</p>
          } @else {
            <app-seletor
              rotulo="Campanha"
              placeholder="Escolha a campanha"
              [opcoes]="opcoesCampanha()"
              [(valor)]="campanhaId"
            />
            @if (campanhaId() !== null) {
              <app-grupo-opcoes rotulo="Lista" [opcoes]="modos" [(valor)]="modo" />
              @if (modo() === 'existente') {
                @if (erroListas(); as falha) {
                  <p class="disc__erro" role="alert">{{ falha }}</p>
                } @else if (carregandoListas()) {
                  <p class="disc__dica" role="status">Carregando as listas…</p>
                } @else if (!opcoesLista().length) {
                  <p class="disc__dica">Esta campanha ainda não tem listas. Crie uma nova.</p>
                } @else {
                  <app-seletor
                    rotulo="Lista da campanha"
                    placeholder="Escolha a lista"
                    [opcoes]="opcoesLista()"
                    [(valor)]="listaId"
                  />
                }
              } @else {
                <app-campo-texto
                  rotulo="Nome da lista nova"
                  [maximoCaracteres]="120"
                  [(valor)]="nomeLista"
                />
              }
            }
          }
          @if (erro(); as falha) {
            <p class="disc__erro" role="alert">{{ falha.mensagem }}</p>
          }
        </div>
      }
      <div modal-rodape class="disc__acoes">
        @if (relatorio()) {
          <button appBotao type="button" variante="invertido" (click)="aberto.set(false)">
            Fechar
          </button>
        } @else {
          <button appBotao type="button" variante="contorno" (click)="aberto.set(false)">
            Cancelar
          </button>
          <button
            appBotao
            type="button"
            variante="invertido"
            [carregando]="enviando()"
            [disabled]="!podeEnviar()"
            (click)="enviar()"
          >
            Enviar {{ textoTotal() }}
          </button>
        }
      </div>
    </app-modal>
  `,
  styles: `
    :host {
      display: contents;
    }
    .disc {
      display: grid;
      gap: var(--esp-4);
    }
    .disc__frase,
    .disc__resumo,
    .disc__dica,
    .disc__erro {
      margin: 0;
    }
    .disc__dica,
    .disc__frase {
      color: var(--cor-texto-suave);
    }
    .disc__erro {
      color: var(--cor-erro);
    }
    .disc__lista {
      display: grid;
      gap: var(--esp-2);
      max-height: 16rem;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      list-style: none;
    }
    .disc__item {
      display: grid;
      gap: 2px;
      padding: var(--esp-2) var(--esp-3);
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-lg);
      font-size: 0.875rem;
      overflow-wrap: anywhere;
    }
    .disc__acoes {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--esp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalDiscador {
  readonly aberto = model(false);
  readonly negocioIds = input<readonly string[]>([]);
  readonly contatoIds = input<readonly string[]>([]);

  private readonly api = inject(TrescPlusApi);

  protected readonly modos = MODOS;
  protected readonly campanhas = signal<readonly CampanhaTresc[] | null>(null);
  protected readonly erroCampanhas = signal<string | null>(null);
  protected readonly listas = signal<readonly ListaTresc[]>([]);
  protected readonly erroListas = signal<string | null>(null);
  protected readonly carregandoListas = signal(false);
  protected readonly campanhaId = signal<number | null>(null);
  protected readonly modo = signal<ModoDaLista | null>('existente');
  protected readonly listaId = signal<number | null>(null);
  protected readonly nomeLista = signal<string | number | null>('');
  protected readonly enviando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly relatorio = signal<RelatorioDoDiscador | null>(null);

  protected readonly total = computed(() => this.negocioIds().length + this.contatoIds().length);
  protected readonly textoTotal = computed(() => {
    const n = this.negocioIds().length;
    const c = this.contatoIds().length;
    const partes: string[] = [];
    if (n) {
      partes.push(`${n} ${n === 1 ? 'negócio' : 'negócios'}`);
    }
    if (c) {
      partes.push(`${c} ${c === 1 ? 'contato' : 'contatos'}`);
    }
    return partes.join(' e ') || 'nenhum registro';
  });
  protected readonly opcoesCampanha = computed<readonly OpcaoSeletor<number>[]>(() =>
    (this.campanhas() ?? []).map((c) => ({
      valor: c.id,
      rotulo: c.pausada ? `${c.nome} (pausada)` : c.nome,
    })),
  );
  protected readonly opcoesLista = computed<readonly OpcaoSeletor<number>[]>(() =>
    this.listas().map((l) => ({ valor: l.id, rotulo: l.nome })),
  );
  protected readonly podeEnviar = computed(() => {
    if (this.total() === 0 || this.campanhaId() === null || this.enviando()) {
      return false;
    }
    return this.modo() === 'nova'
      ? String(this.nomeLista() ?? '').trim().length > 0
      : this.listaId() !== null;
  });

  constructor() {
    effect(() => {
      if (this.aberto()) {
        untracked(() => {
          this.relatorio.set(null);
          this.erro.set(null);
          if (!this.campanhas()) {
            void this.carregarCampanhas();
          }
        });
      }
    });
    effect(() => {
      const campanha = this.campanhaId();
      untracked(() => {
        this.listaId.set(null);
        this.listas.set([]);
        if (campanha !== null) {
          void this.carregarListas(campanha);
        }
      });
    });
  }

  protected async carregarCampanhas(): Promise<void> {
    this.erroCampanhas.set(null);
    try {
      this.campanhas.set(await this.api.campanhas());
    } catch (falha) {
      this.erroCampanhas.set(erroDaApi(falha).mensagem);
    }
  }

  private async carregarListas(campanha: number): Promise<void> {
    this.carregandoListas.set(true);
    this.erroListas.set(null);
    try {
      const listas = await this.api.listas(campanha);
      if (this.campanhaId() === campanha) {
        this.listas.set(listas);
        if (!listas.length) {
          this.modo.set('nova');
        }
      }
    } catch (falha) {
      this.erroListas.set(erroDaApi(falha).mensagem);
    } finally {
      this.carregandoListas.set(false);
    }
  }

  protected async enviar(): Promise<void> {
    const campanhaId = this.campanhaId();
    if (!this.podeEnviar() || campanhaId === null) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      this.relatorio.set(
        await this.api.enviarAoDiscador({
          campanhaId,
          ...(this.modo() === 'nova'
            ? { nomeLista: String(this.nomeLista()).trim() }
            : { listaId: this.listaId()! }),
          ...(this.negocioIds().length ? { negocioIds: this.negocioIds() } : {}),
          ...(this.contatoIds().length ? { contatoIds: this.contatoIds() } : {}),
        }),
      );
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    } finally {
      this.enviando.set(false);
    }
  }
}
