import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideInfo, LucideSearchCheck, LucideTriangleAlert } from '@lucide/angular';

import { formatarMoeda } from '../../nucleo/formatos';
import { Selo, type VarianteSelo } from '../../ui/selo/selo';
import { type ResultadoDaPrevia, rotuloDoDestino } from './tipos';

interface Linha {
  readonly rotulo: string;
  readonly valor: string;
  readonly vazio?: boolean;
}

const ROTULO_UTM: Readonly<Record<string, string>> = {
  source: 'UTM source',
  medium: 'UTM medium',
  campaign: 'UTM campaign',
  term: 'UTM term',
  content: 'UTM content',
};

/** "5511987654321" → "+55 11 98765-4321" (E.164 do Brasil); outros como vieram, com "+". */
export function formatarTelefoneE164(telefone: string | null): string | null {
  if (!telefone) {
    return null;
  }
  const brasil = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(telefone);
  return brasil ? `+55 ${brasil[1]} ${brasil[2]}-${brasil[3]}` : `+${telefone}`;
}

/**
 * Resultado da prévia do mapeamento (`POST /webhooks/entradas/previa`): se o lead seria criado,
 * ignorado ou daria erro, os problemas e avisos, e o contato, o negócio e as UTMs como o CRM
 * os gravaria. Só mostra; quem chama a API é o assistente (ou o recebimento).
 */
@Component({
  selector: 'app-previa-mapeamento',
  imports: [Selo, LucideTriangleAlert, LucideInfo, LucideSearchCheck],
  template: `
    @let r = resultado();
    <div class="previa" role="group" [attr.aria-label]="'Resultado da prévia'">
      <p class="previa__veredito">
        <app-selo [variante]="veredito().variante">{{ veredito().selo }}</app-selo>
        <span>{{ veredito().texto }}</span>
      </p>

      @if (r.problemas.length) {
        <ul class="previa__mensagens previa__mensagens--erro" aria-label="Problemas">
          @for (problema of r.problemas; track $index) {
            <li><svg lucideTriangleAlert [size]="16" />{{ problema }}</li>
          }
        </ul>
      }
      @if (r.avisos.length) {
        <ul class="previa__mensagens previa__mensagens--aviso" aria-label="Avisos">
          @for (aviso of r.avisos; track $index) {
            <li><svg lucideInfo [size]="16" />{{ aviso }}</li>
          }
        </ul>
      }

      <div class="previa__grupos">
        <section class="previa__grupo" aria-labelledby="previa-contato">
          <h4 class="previa__titulo" id="previa-contato">Contato</h4>
          <dl class="previa__dados">
            @for (linha of contato(); track linha.rotulo) {
              <div>
                <dt>{{ linha.rotulo }}</dt>
                <dd [class.previa__vazio]="linha.vazio">{{ linha.valor }}</dd>
              </div>
            }
          </dl>
        </section>
        <section class="previa__grupo" aria-labelledby="previa-negocio">
          <h4 class="previa__titulo" id="previa-negocio">Negócio e origem</h4>
          <dl class="previa__dados">
            @for (linha of negocio(); track linha.rotulo) {
              <div>
                <dt>{{ linha.rotulo }}</dt>
                <dd [class.previa__vazio]="linha.vazio">{{ linha.valor }}</dd>
              </div>
            }
          </dl>
        </section>
      </div>

      @if (r.encontrados.length) {
        <p class="previa__encontrados">
          <svg lucideSearchCheck [size]="16" aria-hidden="true" />
          <span>
            Encontrados no corpo:
            @for (campo of r.encontrados; track $index) {
              <code>{{ campo.caminho }}</code> → {{ rotulo(campo.destino) }}{{ $last ? '.' : '; ' }}
            }
          </span>
        </p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .previa {
      display: grid;
      gap: var(--esp-4);
    }

    .previa__veredito {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-2) var(--esp-3);
      font: var(--fonte-corpo-sm);
      font-weight: 500;
    }

    .previa__mensagens {
      display: grid;
      gap: var(--esp-2);
      margin: 0;
      padding: 0;
      list-style: none;
      font: var(--fonte-corpo-sm);

      li {
        display: flex;
        gap: var(--esp-2);
        align-items: flex-start;
      }

      svg {
        flex: none;
        margin-top: 3px;
      }
    }

    .previa__mensagens--erro {
      color: var(--cor-erro);
    }

    .previa__mensagens--aviso {
      color: var(--cor-aviso);
    }

    .previa__grupos {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      gap: var(--esp-4);
    }

    .previa__grupo {
      display: grid;
      align-content: start;
      gap: var(--esp-2);
      min-width: 0;
      padding: var(--esp-4);
      border-radius: var(--raio-lg);
      background: var(--cor-superficie-2);
    }

    .previa__titulo {
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .previa__dados {
      display: grid;
      gap: var(--esp-2);
      margin: 0;

      div {
        display: grid;
        grid-template-columns: minmax(6.5rem, auto) minmax(0, 1fr);
        gap: var(--esp-3);
        font: var(--fonte-corpo-sm);
      }

      dt {
        color: var(--cor-texto-suave);
      }

      dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
    }

    .previa__vazio {
      color: var(--cor-texto-fraco);
    }

    .previa__encontrados {
      display: flex;
      gap: var(--esp-2);
      align-items: flex-start;
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda-lg);

      svg {
        flex: none;
        margin-top: 2px;
      }

      code {
        font-family: var(--familia-mono);
        font-size: 12px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviaMapeamento {
  readonly resultado = input.required<ResultadoDaPrevia>();

  protected readonly veredito = computed<{
    variante: VarianteSelo;
    selo: string;
    texto: string;
  }>(() => {
    const r = this.resultado();
    if (r.ignorado) {
      return { variante: 'neutro', selo: 'Seria ignorado', texto: r.ignorado };
    }
    if (r.valido) {
      return {
        variante: 'menta',
        selo: 'Funcionaria',
        texto: 'O CRM criaria (ou reconverteria) o contato e o negócio assim:',
      };
    }
    return {
      variante: 'coral',
      selo: 'Daria erro',
      texto: 'O recebimento ficaria com erro. Ajuste o mapeamento ou o exemplo:',
    };
  });

  protected readonly contato = computed<readonly Linha[]>(() => {
    const c = this.resultado().contato;
    const linhas: Linha[] = [
      linha('Nome', c.nome),
      linha('E-mail', c.email),
      linha('Telefone', formatarTelefoneE164(c.telefone)),
    ];
    if (c.empresa) {
      linhas.push(linha('Empresa', c.empresa));
    }
    if (c.cargo) {
      linhas.push(linha('Cargo', c.cargo));
    }
    if (c.etiquetas.length) {
      linhas.push(linha('Etiquetas', c.etiquetas.join(', ')));
    }
    for (const [chave, valor] of Object.entries(c.camposPersonalizados)) {
      linhas.push(linha(chave, typeof valor === 'string' ? valor : JSON.stringify(valor)));
    }
    return linhas;
  });

  protected readonly negocio = computed<readonly Linha[]>(() => {
    const { negocio, utm, atualizacoes } = this.resultado();
    const linhas: Linha[] = [
      negocio.titulo
        ? linha('Título', negocio.titulo)
        : { rotulo: 'Título', valor: 'o nome do contato', vazio: true },
    ];
    if (negocio.valor) {
      linhas.push(linha('Valor', formatarMoeda(negocio.valor)));
    }
    if (negocio.valorRecorrente) {
      linhas.push(linha('Recorrente', formatarMoeda(negocio.valorRecorrente)));
    }
    // Etapa, dono, status e motivo vindos do recebimento (modo atualizar).
    if (atualizacoes?.etapa) {
      linhas.push(linha('Etapa', atualizacoes.etapa));
    }
    if (atualizacoes?.dono) {
      linhas.push(linha('Dono', atualizacoes.dono));
    }
    if (atualizacoes?.status) {
      linhas.push(linha('Status', atualizacoes.status));
    }
    if (atualizacoes?.motivoPerda) {
      linhas.push(linha('Motivo da perda', atualizacoes.motivoPerda));
    }
    const utms = Object.entries(utm ?? {}).filter(([, valor]) => !!valor);
    for (const [chave, valor] of utms) {
      linhas.push(linha(ROTULO_UTM[chave] ?? `UTM ${chave}`, valor));
    }
    if (!utms.length) {
      linhas.push({ rotulo: 'UTMs', valor: 'nenhuma', vazio: true });
    }
    return linhas;
  });

  protected rotulo(destino: string): string {
    return rotuloDoDestino(destino);
  }
}

function linha(rotulo: string, valor: string | null): Linha {
  return valor ? { rotulo, valor } : { rotulo, valor: '—', vazio: true };
}
