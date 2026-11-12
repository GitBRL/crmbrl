import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon, LucidePhoneIncoming, LucideX } from '@lucide/angular';

import { formatarTelefone } from '../../nucleo/ligacoes/ligacoes.textos';
import { TrescPlusService } from '../../nucleo/tresc-plus/tresc-plus.service';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Selo } from '../../ui/selo/selo';

/**
 * Aviso de ligação recebida pelo 3C+ (R34.7): quem ligou (nome e empresa), os negócios abertos
 * e o link para a ficha; número desconhecido vira "Novo contato" com o telefone já preenchido.
 */
@Component({
  selector: 'app-aviso-recebida',
  imports: [RouterLink, BotaoIcone, LucideDynamicIcon, Selo],
  template: `
    @if (tresc.recebida(); as r) {
      <section class="aviso" role="alert" aria-labelledby="aviso-recebida-titulo">
        <span class="aviso__icone" aria-hidden="true">
          <svg [lucideIcon]="icones.recebida" [size]="20" />
        </span>
        <div class="aviso__corpo">
          <p class="aviso__titulo" id="aviso-recebida-titulo">
            @if (r.contato) {
              Ligação recebida de {{ r.contato.nome }}
            } @else {
              Ligação recebida de {{ telefone() }}
            }
            <app-selo tamanho="sm" variante="ciano">3C+</app-selo>
          </p>
          @if (r.contato) {
            <p class="aviso__linha">
              {{ r.contato.empresa ?? 'Sem empresa' }} ·
              <span class="numeros">{{ telefone() }}</span>
            </p>
          } @else {
            <p class="aviso__linha">
              <strong>Novo contato</strong>: esse número ainda não está no CRM.
            </p>
          }
          @if (r.negocios.length) {
            <p class="aviso__linha">Negócios do contato (na ficha):</p>
            <ul class="aviso__negocios" aria-label="Negócios do contato">
              @for (n of r.negocios; track n.id) {
                <li>{{ n.titulo }}</li>
              }
            </ul>
          }
          <div class="aviso__acoes">
            @if (r.contato) {
              <a
                class="aviso__link"
                [routerLink]="['/contatos', r.contato.id]"
                (click)="tresc.dispensarRecebida()"
                >Abrir a ficha</a
              >
            } @else {
              <a
                class="aviso__link"
                routerLink="/contatos"
                [queryParams]="{ novo: 1, telefone: r.telefone }"
                (click)="tresc.dispensarRecebida()"
                >Cadastrar contato</a
              >
            }
          </div>
        </div>
        <button
          appBotaoIcone
          type="button"
          variante="contorno"
          tamanho="sm"
          rotulo="Dispensar o aviso"
          [icone]="icones.fechar"
          (click)="tresc.dispensarRecebida()"
        ></button>
      </section>
    }
  `,
  styleUrl: './aviso-recebida.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvisoRecebida {
  protected readonly tresc = inject(TrescPlusService);
  protected readonly icones = { recebida: LucidePhoneIncoming, fechar: LucideX };
  protected readonly telefone = computed(() => formatarTelefone(this.tresc.recebida()?.telefone));
}
