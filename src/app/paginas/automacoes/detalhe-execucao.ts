import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { formatarDataHora } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { Selo } from '../../ui/selo/selo';
import {
  type ExecucaoDetalhe,
  type PassoExecutado,
  ROTULO_STATUS_EXECUCAO,
  ROTULO_STATUS_PASSO,
  ROTULO_TIPO_PASSO,
  VARIANTE_STATUS_EXECUCAO,
} from './automacoes.tipos';

/**
 * Passo a passo de uma execução (histórico e modo teste): o que a automação fez, em que ordem,
 * e o erro quando algo falhou. Reexecutar só aparece para execução que falhou; cancelar, para
 * a que ainda está rodando ou esperando.
 */
@Component({
  selector: 'app-detalhe-execucao',
  imports: [Botao, Selo],
  template: `
    @let e = execucao();
    <div class="resumo">
      <app-selo [variante]="variante()" ponto>{{ rotuloStatus() }}</app-selo>
      @if (e.teste) {
        <app-selo variante="contorno">Teste</app-selo>
      }
      <span class="resumo__texto">
        {{ e.automacaoNome }} · versão {{ e.automacaoVersao }}
        @if (e.contato) {
          · {{ e.contato.nome }}
        }
      </span>
    </div>
    <p class="datas">
      Começou em {{ data(e.iniciadaEm) }}
      @if (e.concluidaEm) {
        · terminou em {{ data(e.concluidaEm) }}
      }
      @if (e.status === 'AGUARDANDO' && e.aguardandoAte) {
        · volta a rodar em {{ data(e.aguardandoAte) }}
      }
    </p>
    @if (e.erro) {
      <p class="erro" role="alert">{{ e.erro }}</p>
    }
    @if (e.motivoFim && e.status !== 'FALHOU') {
      <p class="datas">Motivo do fim: {{ motivo(e.motivoFim) }}</p>
    }

    @if (e.passos.length) {
      <ol class="passos" aria-label="Passos executados">
        @for (p of e.passos; track p.ordem) {
          <li class="passo" [class.passo--erro]="p.status === 'ERRO'">
            <div class="passo__topo">
              <strong>{{ nomeDoPasso(p.tipo, p.rotulo) }}</strong>
              <app-selo
                tamanho="sm"
                [variante]="
                  p.status === 'ERRO' ? 'coral' : p.status === 'CONCLUIDO' ? 'menta' : 'lima'
                "
                >{{ rotuloPasso[p.status] }}</app-selo
              >
            </div>
            @for (linha of linhasDoPasso(p); track linha) {
              <p class="passo__linha">{{ linha }}</p>
            }
            @if (p.tentativas > 1 && p.tipo !== 'aguardar') {
              <p class="passo__linha">{{ p.tentativas }} tentativas</p>
            }
            @if (p.erro) {
              <p class="passo__linha passo__linha--erro">{{ p.erro }}</p>
            }
            @if (p.concluidoEm || p.iniciadoEm) {
              <p class="passo__linha">{{ data(p.concluidoEm ?? p.iniciadoEm) }}</p>
            }
          </li>
        }
      </ol>
    } @else {
      <p class="datas">Nenhum passo foi executado ainda.</p>
    }

    @if (podeReexecutar() || podeCancelar()) {
      <div class="acoes">
        @if (podeReexecutar()) {
          <button
            appBotao
            type="button"
            variante="marca"
            [carregando]="ocupado()"
            (click)="reexecutar.emit(e)"
          >
            Tentar de novo
          </button>
        }
        @if (podeCancelar()) {
          <button
            appBotao
            type="button"
            variante="contorno"
            [carregando]="ocupado()"
            (click)="cancelar.emit(e)"
          >
            Cancelar execução
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-4);
      min-width: 0;
    }
    .resumo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-2);
    }
    .resumo__texto {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .datas {
      margin: 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }
    .erro {
      margin: 0;
      padding: var(--esp-3);
      border-radius: var(--raio-md);
      background: var(--cor-erro-fundo, var(--cor-superficie-2));
      color: var(--cor-erro);
      font: var(--fonte-corpo-sm);
      overflow-wrap: anywhere;
    }
    .passos {
      display: grid;
      gap: var(--esp-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .passo {
      display: grid;
      gap: var(--esp-1);
      padding: var(--esp-3);
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-md);
      min-width: 0;
    }
    .passo--erro {
      border-color: var(--cor-erro);
    }
    .passo__topo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--esp-2);
    }
    .passo__linha {
      margin: 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
      overflow-wrap: anywhere;
    }
    .passo__linha--erro {
      color: var(--cor-erro);
    }
    .acoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalheExecucao {
  readonly execucao = input.required<ExecucaoDetalhe>();
  readonly ocupado = input(false);
  readonly reexecutar = output<ExecucaoDetalhe>();
  readonly cancelar = output<ExecucaoDetalhe>();

  protected readonly rotuloPasso = ROTULO_STATUS_PASSO;
  protected readonly variante = computed(() => VARIANTE_STATUS_EXECUCAO[this.execucao().status]);
  protected readonly rotuloStatus = computed(() => ROTULO_STATUS_EXECUCAO[this.execucao().status]);
  protected readonly podeReexecutar = computed(() => this.execucao().status === 'FALHOU');
  protected readonly podeCancelar = computed(() =>
    ['AGUARDANDO', 'EM_ANDAMENTO'].includes(this.execucao().status),
  );

  protected data(valor: string | null | undefined): string {
    return valor ? formatarDataHora(valor) : '';
  }

  /** Frases curtas sobre o que o passo fez (a saída do passo vem da API em formato livre). */
  protected linhasDoPasso(p: PassoExecutado): string[] {
    const linhas: string[] = [];
    const saida = p.resultado?.saida ?? {};
    const decisao = p.resultado?.decisao;
    const simulado = saida['simulado'] === true ? ' (simulado)' : '';
    if (typeof saida['texto'] === 'string') {
      const para = typeof saida['para'] === 'string' ? ` para ${saida['para']}` : '';
      linhas.push(`Mensagem${para}${simulado}: ${saida['texto']}`);
    } else if (typeof saida['titulo'] === 'string') {
      linhas.push(`Criou “${saida['titulo']}”${simulado}`);
    } else if (simulado) {
      linhas.push('Simulado no teste.');
    }
    if (decisao?.acao === 'ramo') {
      linhas.push(
        `Seguiu pelo caminho “${decisao.ramoId === 'sim' ? 'Se sim' : decisao.ramoId === 'nao' ? 'Se não' : decisao.ramoId}”.`,
      );
    } else if (decisao?.acao === 'encerrar') {
      linhas.push(`Encerrou${decisao.motivo ? `: ${decisao.motivo}` : '.'}`);
    }
    return linhas;
  }

  protected motivo(chave: string): string {
    return chave.replace(/_/g, ' ');
  }

  protected nomeDoPasso(tipo: string, rotulo: string | null): string {
    const base = ROTULO_TIPO_PASSO[tipo] ?? tipo;
    return rotulo && rotulo !== base ? `${base} — ${rotulo}` : base;
  }
}
