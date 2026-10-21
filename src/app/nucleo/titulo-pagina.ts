import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';

export const NOME_PRODUTO = 'BRL CRM';

/** Título da aba: "Visão geral · BRL CRM" (o `title` de cada rota + o nome do produto). */
@Injectable({ providedIn: 'root' })
export class TituloPagina extends TitleStrategy {
  private readonly titulo = inject(Title);

  override updateTitle(estado: RouterStateSnapshot): void {
    const titulo = this.buildTitle(estado);
    this.titulo.setTitle(titulo ? `${titulo} · ${NOME_PRODUTO}` : NOME_PRODUTO);
  }
}
