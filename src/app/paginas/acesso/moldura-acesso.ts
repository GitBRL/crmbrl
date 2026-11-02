import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { LucideDynamicIcon, type LucideIconInput } from '@lucide/angular';

import { AlternadorTema } from '../../ui/alternador-tema/alternador-tema';
import { Logo } from '../../ui/logo/logo';

/** Cor do círculo de ícone acima do título (estados de resultado: e-mail enviado, link vencido). */
export type TomIconeAcesso = 'sucesso' | 'atencao' | 'erro' | 'neutro';

/** As três barras da ilustração (decorativa): os três funis do CRM. */
const BARRAS = [
  { area: 'Marketing', selo: 'leads' },
  { area: 'Comercial', selo: 'negócios' },
  { area: 'Customer Success', selo: 'clientes' },
] as const;

/**
 * Moldura das telas de acesso (TELAS-FASE1 §1.1): duas colunas no desktop, uma no celular.
 *
 * - **Esquerda — palco da marca**: logo, o título em dois tons "Seu cliente, do primeiro
 *   contato" + "ao sucesso." e uma ilustração com barras de funil nas cores de dado
 *   (decorativa, `aria-hidden`).
 * - **Direita — o cartão**: ícone opcional, o `<h1>` da página (`titulo`), a `frase` e o
 *   conteúdo projetado (o formulário). Embaixo, o que vier com `acesso-rodape` (links) e uma
 *   linha de ajuda. O alternador de tema fica no canto, já que as telas de acesso não têm a
 *   barra superior da casca.
 *
 * No celular, o palco vira só a linha do logo; com `slogan` (Entrar), o título da marca
 * aparece num palco compacto acima do cartão.
 *
 * Os estilos não são encapsulados (prefixo `acesso-`), para o conteúdo projetado pelas telas
 * usar as mesmas classes (em `conteudo-acesso.scss`): `acesso-formulario`, `acesso-bloco`,
 * `acesso-acoes`, `acesso-links`, `acesso-link`, `acesso-nota`, `acesso-email` e `acesso-lista`.
 */
@Component({
  selector: 'app-moldura-acesso',
  imports: [AlternadorTema, Logo, LucideDynamicIcon],
  template: `
    <div class="acesso" [class.acesso--slogan]="slogan()">
      <div class="acesso__topo">
        <app-logo class="acesso__logo-topo" [tamanho]="26" />
        <app-alternador-tema />
      </div>

      <div class="acesso__palco">
        <app-logo class="acesso__logo-palco" [tamanho]="32" />
        <div class="acesso__chamada">
          <p class="acesso__slogan">
            Seu cliente, do primeiro contato
            <span class="tom-fraco sem-quebra">ao sucesso.</span>
          </p>
          <p class="acesso__frase-palco">
            Marketing, Comercial e Customer Success no mesmo lugar: cada passo da jornada à vista,
            sem perder ninguém pelo caminho.
          </p>
        </div>
        <div class="acesso__ilustracao" aria-hidden="true">
          @for (barra of barras; track barra.area) {
            <div class="ilustracao__linha">
              <div class="ilustracao__rotulos">
                <span>{{ barra.area }}</span>
                <span class="ilustracao__selo">{{ barra.selo }}</span>
              </div>
              <div class="ilustracao__barra">
                <span class="ilustracao__ciano"></span>
                <span class="ilustracao__menta"></span>
              </div>
            </div>
          }
        </div>
      </div>

      <div class="acesso__lado">
        <div class="acesso__cartao">
          @if (icone(); as simbolo) {
            <span class="acesso__icone" [class]="'acesso__icone--' + tomIcone()" aria-hidden="true">
              <svg [lucideIcon]="simbolo" [size]="24" [strokeWidth]="1.75" />
            </span>
          }
          <h1 #elementoTitulo class="acesso__titulo" tabindex="-1">{{ titulo() }}</h1>
          @if (frase(); as texto) {
            <p class="acesso__frase">{{ texto }}</p>
          }
          <ng-content />
        </div>
        <ng-content select="[acesso-rodape]" />
        <p class="acesso__ajuda">Precisa de ajuda? Fale com o administrador do CRM.</p>
      </div>
    </div>
  `,
  styleUrls: ['./moldura-acesso.scss', './conteudo-acesso.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MolduraAcesso {
  /** O `<h1>` da página. */
  readonly titulo = input.required<string>();
  /** Frase logo abaixo do título. */
  readonly frase = input<string | null>(null);
  /** Ícone num círculo acima do título (estados de resultado). */
  readonly icone = input<LucideIconInput | null>(null);
  readonly tomIcone = input<TomIconeAcesso>('neutro');
  /** Mostra o título da marca também no celular (Entrar). */
  readonly slogan = input(false, { transform: booleanAttribute });

  protected readonly barras = BARRAS;
  private readonly elementoTitulo = viewChild.required<ElementRef<HTMLElement>>('elementoTitulo');

  /**
   * Leva o foco ao título: depois de trocar o conteúdo do cartão na mesma página (formulário →
   * "Confira o seu e-mail"), o leitor de tela anuncia o novo estado.
   */
  focarTitulo(): void {
    this.elementoTitulo().nativeElement.focus({ preventScroll: false });
  }
}
