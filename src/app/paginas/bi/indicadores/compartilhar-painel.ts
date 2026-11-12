import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';

import { erroDaApi, type ErroApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { ROTULO_PAPEL, type Papel } from '../../../nucleo/papeis';
import { SetoresService } from '../../../nucleo/setores/setores.service';
import { Botao } from '../../../ui/botao/botao';
import { CaixaSelecao } from '../../../ui/caixa-selecao/caixa-selecao';
import { CampoBusca } from '../../../ui/campo-busca/campo-busca';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { Modal } from '../../../ui/modal/modal';
import { IndicadoresApi } from './indicadores.api';
import type { Compartilhamento, PainelDeIndicadores } from './indicadores.tipos';

const PAPEIS_COMPARTILHAVEIS: readonly Papel[] = ['LIDER', 'MEMBRO', 'C_LEVEL'];

/** Marca ou desmarca `item` numa lista sem repetir. */
export function alternarItem<T>(lista: readonly T[], item: T, marcado: boolean): readonly T[] {
  const sem = lista.filter((i) => i !== item);
  return marcado ? [...sem, item] : sem;
}

/**
 * Compartilhar um painel (R33.6): setores, pessoas e, só para Admin e C-level, papéis inteiros. O
 * líder compartilha só com o próprio setor e as pessoas dele. Quem recebe vê o painel com os números
 * que já podia ver: compartilhar não amplia dados (R33.4).
 */
@Component({
  selector: 'app-compartilhar-painel',
  imports: [Botao, CaixaSelecao, CampoBusca, EstadoVazio, Modal],
  template: `
    <app-modal
      [(aberto)]="aberto"
      titulo="Compartilhar painel"
      [complemento]="'· ' + (painel()?.nome ?? '')"
      largura="md"
    >
      <p class="texto">
        Quem recebe o painel vê só os números que já pode ver no CRM: o membro, o que é dele; o
        líder, o da área.
      </p>

      @if (diretoria() || setoresEscolhiveis().length > 0) {
        <fieldset class="grupo">
          <legend class="grupo__titulo">Setores inteiros</legend>
          @for (setor of setoresEscolhiveis(); track setor.valor) {
            <app-caixa-selecao
              [rotulo]="setor.rotulo"
              [valor]="setores().includes(setor.valor)"
              (valorChange)="setores.set(marcar(setores(), setor.valor, $event))"
            />
          }
        </fieldset>
      }

      @if (diretoria()) {
        <fieldset class="grupo">
          <legend class="grupo__titulo">Papéis inteiros</legend>
          @for (papel of papeisCompartilhaveis; track papel) {
            <app-caixa-selecao
              [rotulo]="rotuloPapel[papel]"
              [valor]="papeis().includes(papel)"
              (valorChange)="papeis.set(marcar(papeis(), papel, $event))"
            />
          }
        </fieldset>
      }

      <fieldset class="grupo">
        <legend class="grupo__titulo">Pessoas</legend>
        <app-campo-busca rotulo="Buscar pessoa" placeholder="Buscar pessoa…" [(valor)]="busca" />
        <div class="grupo__lista">
          @for (pessoa of pessoasFiltradas(); track pessoa.id) {
            <app-caixa-selecao
              [rotulo]="pessoa.nome"
              [valor]="pessoas().includes(pessoa.id)"
              (valorChange)="pessoas.set(marcar(pessoas(), pessoa.id, $event))"
            />
          } @empty {
            <p class="texto">Nenhuma pessoa encontrada.</p>
          }
        </div>
      </fieldset>

      @if (erro(); as e) {
        <app-estado-vazio
          compacto
          variante="erro"
          titulo="Não foi possível compartilhar"
          [falha]="e"
          [texto]="e.resumo"
          [codigo]="e.requisicaoId ?? null"
        />
      }

      <div modal-rodape class="rodape">
        <button appBotao type="button" variante="contorno" (click)="aberto.set(false)">
          Cancelar
        </button>
        <button
          appBotao
          type="button"
          variante="marca"
          [carregando]="salvando()"
          (click)="salvar()"
        >
          Compartilhar
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .texto {
      margin: 0 0 var(--esp-4);
      font: var(--fonte-legenda-lg);
      color: var(--cor-texto-suave);
    }
    .grupo {
      display: grid;
      gap: var(--esp-3);
      margin: 0 0 var(--esp-5);
      padding: 0;
      border: 0;
      min-width: 0;
    }
    .grupo__titulo {
      padding: 0;
      font: var(--fonte-corpo-forte, var(--fonte-corpo));
    }
    .grupo__lista {
      display: grid;
      gap: var(--esp-2);
      max-height: 14rem;
      overflow-y: auto;
    }
    .rodape {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--esp-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompartilharPainel {
  private readonly api = inject(IndicadoresApi);
  private readonly avisos = inject(AvisosService);
  private readonly setoresService = inject(SetoresService);

  readonly aberto = model(false);
  readonly painel = input<PainelDeIndicadores | null>(null);
  readonly pessoasDisponiveis = input<readonly { readonly id: string; readonly nome: string }[]>(
    [],
  );
  /** Setor do líder (só ele pode escolher); Admin e C-level escolhem qualquer. */
  readonly diretoria = input(false);
  readonly setorDoLider = input<string | null>(null);
  readonly salvo = output<PainelDeIndicadores>();

  protected readonly papeisCompartilhaveis = PAPEIS_COMPARTILHAVEIS;
  protected readonly rotuloPapel = ROTULO_PAPEL;
  protected readonly marcar = alternarItem;
  protected readonly setores = signal<readonly string[]>([]);
  protected readonly pessoas = signal<readonly string[]>([]);
  protected readonly papeis = signal<readonly Papel[]>([]);
  protected readonly busca = signal('');
  protected readonly salvando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);

  protected readonly setoresEscolhiveis = computed(() =>
    this.setoresService.opcoes().filter((s) => this.diretoria() || s.valor === this.setorDoLider()),
  );

  protected readonly pessoasFiltradas = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    return this.pessoasDisponiveis().filter((p) => !termo || p.nome.toLowerCase().includes(termo));
  });

  constructor() {
    void this.setoresService.carregar();
    // Ao abrir, parte do compartilhamento atual do painel.
    effect(() => {
      if (!this.aberto()) {
        return;
      }
      const atual: Compartilhamento | null = this.painel()?.compartilhamento ?? null;
      untracked(() => {
        this.setores.set(atual?.setores ?? []);
        this.pessoas.set(atual?.pessoas ?? []);
        this.papeis.set(atual?.papeis ?? []);
        this.busca.set('');
        this.erro.set(null);
      });
    });
  }

  protected async salvar(): Promise<void> {
    const painel = this.painel();
    if (!painel) {
      return;
    }
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const atualizado = await this.api.atualizar(painel.id, {
        compartilhamento: {
          setores: this.setores(),
          pessoas: this.pessoas(),
          papeis: this.papeis(),
        },
      });
      this.avisos.sucesso('Compartilhamento atualizado.');
      this.salvo.emit(atualizado);
      this.aberto.set(false);
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    } finally {
      this.salvando.set(false);
    }
  }
}
