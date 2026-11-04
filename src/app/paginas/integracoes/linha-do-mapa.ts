import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideX } from '@lucide/angular';

import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';

/** Valores do seletor de destino que abrem o campo da chave do campo personalizado. */
export const DESTINO_DO_CONTATO = '__contato_personalizado';
export const DESTINO_DO_NEGOCIO = '__negocio_personalizado';

/** Uma linha do mapeamento: o campo recebido (à esquerda) e o campo do CRM (à direita). */
export interface LinhaDoMapa {
  readonly id: number;
  /** Caminho no corpo recebido: `lead.email`, `fields[nome]`, `contact[email]`. */
  readonly caminho: string;
  /** Destino do CRM, `DESTINO_DO_CONTATO`/`DESTINO_DO_NEGOCIO` (com `chave`) ou `null` (não usar). */
  readonly destino: string | null;
  readonly chave: string;
  readonly origem: 'modelo' | 'recebido' | 'buscado' | 'adicionado';
  /** Valor de exemplo (mascarado pela API) do último recebimento. */
  readonly exemplo: string | null;
  /** Nome legível do campo (perguntas do Typeform, campos do ActiveCampaign). */
  readonly rotulo: string | null;
}

const ORIGEM: Readonly<Record<LinhaDoMapa['origem'], string>> = {
  modelo: 'do modelo',
  recebido: 'recebido',
  buscado: 'da ferramenta',
  adicionado: 'adicionado',
};

/**
 * Uma linha do mapeamento do assistente: à esquerda o campo recebido (código, nome legível,
 * valor de exemplo e de onde veio; campo adicionado à mão tem o caminho editável) e, à
 * direita, o seletor do campo do CRM (com a chave, se for campo personalizado).
 */
@Component({
  selector: 'app-linha-do-mapa',
  imports: [BotaoIcone, CampoTexto, Seletor],
  template: `
    @let l = linha();
    <div
      class="linha-mapa"
      role="group"
      [attr.data-linha]="l.id"
      [attr.aria-label]="'Campo ' + nome()"
    >
      <div class="linha-mapa__recebido">
        @if (l.origem === 'adicionado') {
          <app-campo-texto
            rotuloOculto
            rotulo="Caminho do campo recebido"
            placeholder="lead.email ou contact[email]"
            [maximoCaracteres]="200"
            [valor]="l.caminho"
            (valorChange)="caminhoChange.emit('' + $event)"
          />
        } @else {
          <code class="linha-mapa__caminho">{{ l.caminho }}</code>
          @if (l.rotulo) {
            <span class="linha-mapa__rotulo">{{ l.rotulo }}</span>
          }
          @if (l.exemplo) {
            <span class="linha-mapa__exemplo" title="Valor de exemplo do último recebimento"
              >ex.: {{ l.exemplo }}</span
            >
          }
        }
        <span class="linha-mapa__origem">{{ origem[l.origem] }}</span>
      </div>
      <div class="linha-mapa__destino">
        <app-seletor
          rotuloOculto
          [rotulo]="'Campo do CRM para ' + nome()"
          placeholder="Não usar este campo"
          permitirVazio
          [opcoes]="opcoesDestino()"
          [valor]="l.destino"
          (valorChange)="destinoChange.emit($event)"
        />
        @if (l.destino === destinoContato || l.destino === destinoNegocio) {
          <app-campo-texto
            rotuloOculto
            [rotulo]="'Nome do campo personalizado para ' + nome()"
            placeholder="Nome do campo personalizado"
            [maximoCaracteres]="100"
            [valor]="l.chave"
            (valorChange)="chaveChange.emit('' + $event)"
          />
        }
        @if (l.origem === 'adicionado' || l.origem === 'modelo') {
          <button
            appBotaoIcone
            type="button"
            variante="contorno"
            tamanho="sm"
            [icone]="iconeRemover"
            [rotulo]="'Remover o campo ' + nome()"
            (click)="remover.emit()"
          ></button>
        }
      </div>
    </div>
  `,
  styleUrl: './linha-do-mapa.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinhaDoMapaCampo {
  readonly linha = input.required<LinhaDoMapa>();
  readonly opcoesDestino = input.required<readonly OpcaoSeletor<string>[]>();
  readonly caminhoChange = output<string>();
  readonly destinoChange = output<string | null>();
  readonly chaveChange = output<string>();
  readonly remover = output<void>();

  protected readonly origem = ORIGEM;
  protected readonly destinoContato = DESTINO_DO_CONTATO;
  protected readonly destinoNegocio = DESTINO_DO_NEGOCIO;
  protected readonly iconeRemover = LucideX;

  protected nome(): string {
    return this.linha().caminho || 'novo campo';
  }
}
