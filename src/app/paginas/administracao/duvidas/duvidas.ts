import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import type { CategoriaAssistente, TemaSemResposta } from '../../../layout/ajuda/ajuda.tipos';
import { Abas, type ItemAba } from '../../../ui/abas/abas';
import { Dica } from '../../../ui/dica/dica';
import { ChamadosDuvidas } from './chamados-duvidas';
import { HistoricoDuvidas } from './historico-duvidas';
import { TemasDuvidas } from './temas-duvidas';

const ABAS: readonly ItemAba[] = [
  { id: 'historico', rotulo: 'Histórico' },
  { id: 'temas', rotulo: 'Temas sem resposta' },
  { id: 'chamados', rotulo: 'Chamados' },
];

/**
 * Dúvidas à IA (`/administracao/duvidas`, só Admin): o que as pessoas perguntam ao assistente
 * de ajuda. Histórico com filtros e exportação, temas mais pedidos sem resposta e os chamados
 * abertos. As perguntas ficam registradas e as pessoas são avisadas disso no painel.
 */
@Component({
  selector: 'app-duvidas',
  imports: [Abas, ChamadosDuvidas, Dica, HistoricoDuvidas, TemasDuvidas],
  template: `
    <p class="duvidas__nota">
      O que as pessoas perguntam no botão Ajuda.
      <app-dica
        rotulo="Privacidade"
        texto="As pessoas são avisadas de que as perguntas ficam registradas e de que não devem escrever dados de clientes. Só o Admin vê esta tela e as consultas ficam na auditoria."
      />
    </p>
    <app-abas rotulo="Seções das dúvidas" [abas]="abas" [(selecionada)]="aba">
      @switch (aba()) {
        @case ('temas') {
          <app-temas-duvidas (ver)="verTema($event)" />
        }
        @case ('chamados') {
          <app-chamados-duvidas />
        }
        @default {
          @for (filtro of [filtroDoTema()]; track filtro.chave) {
            <app-historico-duvidas
              [modulo]="filtro.modulo"
              [categoria]="filtro.categoria"
              [resolvido]="filtro.resolvido"
            />
          }
        }
      }
    </app-abas>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-4);
      min-width: 0;
    }
    .duvidas__nota {
      font: var(--fonte-corpo-sm);
      color: var(--cor-texto-fraco);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Duvidas {
  protected readonly abas = ABAS;
  protected readonly aba = signal<string | null>('historico');
  protected readonly filtroDoTema = signal<{
    chave: number;
    modulo: string | null;
    categoria: CategoriaAssistente | null;
    resolvido: boolean | null;
  }>({ chave: 0, modulo: null, categoria: null, resolvido: null });

  protected verTema(tema: TemaSemResposta): void {
    this.filtroDoTema.update((f) => ({
      chave: f.chave + 1,
      modulo: tema.modulo,
      categoria: tema.categoria,
      resolvido: false,
    }));
    this.aba.set('historico');
  }
}
