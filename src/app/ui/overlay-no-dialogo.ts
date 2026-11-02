import { OverlayContainer } from '@angular/cdk/overlay';
import { ElementRef, inject, Injectable, type Provider } from '@angular/core';

/**
 * Contêiner dos overlays do CDK (menu de ações) **dentro** do `<dialog>` do componente.
 *
 * Com um `<dialog>` aberto por `showModal()` (modal, painel lateral), tudo fora dele fica
 * inerte — inclusive o contêiner padrão do CDK, no fim do `<body>`: um menu aberto ali não
 * receberia clique nem foco. Com este provider no componente, os menus do conteúdo projetado
 * nele (que herdam o injetor do componente) abrem dentro do próprio diálogo.
 */
@Injectable()
export class ContainerOverlayNoDialogo extends OverlayContainer {
  private readonly hospedeiro = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected override _createContainer(): void {
    super._createContainer();
    const dialogo = this.hospedeiro.querySelector('dialog');
    if (dialogo && this._containerElement) {
      dialogo.appendChild(this._containerElement);
    }
  }
}

/** `providers: [provideOverlayNoDialogo()]` num componente que abre um `<dialog>` modal. */
export function provideOverlayNoDialogo(): Provider[] {
  return [{ provide: OverlayContainer, useClass: ContainerOverlayNoDialogo }];
}
