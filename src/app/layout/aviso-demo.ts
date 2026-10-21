import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { LucideFlaskConical } from '@lucide/angular';

import { PerfilDemoService } from '../nucleo/perfil-demo.service';
import { Botao } from '../ui/botao/botao';
import { Selo } from '../ui/selo/selo';

/**
 * Lembrete compacto do modo demonstração, fixo no pé da navegação (e da gaveta): quem é a
 * persona atual e o atalho "Ver como", que abre a troca de papel no menu da conta. Explica por
 * que alguns módulos não aparecem sem tirar espaço da lista (no máximo ~64px de altura).
 */
@Component({
  selector: 'app-aviso-demo',
  imports: [Botao, Selo],
  template: `
    <div class="aviso-demo__texto">
      <app-selo variante="lima" aria-hidden="true" [icone]="iconeDemo">Demonstração</app-selo>
      <p class="aviso-demo__quem" [title]="quem()">
        <span class="visualmente-oculto">Modo demonstração: você vê o CRM como</span>
        <strong>{{ perfil.persona().nome }}</strong> · {{ perfil.rotuloPapel() }}
      </p>
    </div>
    <button
      appBotao
      type="button"
      tamanho="sm"
      variante="contorno"
      aria-label="Ver como outro papel"
      (click)="trocar.emit()"
    >
      Ver como
    </button>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--esp-2);
      padding: var(--esp-2) var(--esp-2) var(--esp-2) var(--esp-3);
      border-radius: var(--raio-lg);
      background: var(--cor-superficie-2);
    }

    .aviso-demo__texto {
      display: grid;
      flex: 1;
      justify-items: start;
      gap: var(--esp-1);
      min-width: 0;
    }

    // Nome e papel numa linha; o que não couber vira reticências (o nome inteiro fica no
    // title e no texto para leitores de tela).
    .aviso-demo__quem {
      max-width: 100%;
      overflow: hidden;
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda-lg, 400 0.8125rem/1.35 var(--familia));
      text-overflow: ellipsis;
      white-space: nowrap;

      strong {
        color: var(--cor-texto);
        font-weight: 500;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'aviso-demo' },
})
export class AvisoDemo {
  protected readonly perfil = inject(PerfilDemoService);
  protected readonly iconeDemo = LucideFlaskConical;
  protected readonly quem = computed(
    () => `${this.perfil.persona().nome} · ${this.perfil.rotuloPapel()}`,
  );

  /** "Ver como": a casca abre a troca de papel no menu da conta. */
  readonly trocar = output<void>();
}
