import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';

import { AreaTexto } from '../../ui/area-texto/area-texto';
import { CaixaSelecao } from '../../ui/caixa-selecao/caixa-selecao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { DICA_GATILHO, type GatilhoFluxo, ROTULO_GATILHO } from './chatbot.tipos';
import { ContextoEditor, ROTULO_TIPO_CANAL } from './contexto-editor';

export interface DadosDoFluxo {
  nome: string;
  descricao: string;
  gatilho: GatilhoFluxo;
  /** Palavras separadas por vírgula. */
  palavrasChave: string;
  prioridade: number;
  canalIds: readonly string[];
}

export const DADOS_PADRAO: DadosDoFluxo = {
  nome: '',
  descricao: '',
  gatilho: 'NOVA_CONVERSA',
  palavrasChave: '',
  prioridade: 0,
  canalIds: [],
};

/** Nome, quando começa, em quais canais e prioridade: usado ao criar e na aba “Configuração”. */
@Component({
  selector: 'app-formulario-fluxo',
  imports: [AreaTexto, CaixaSelecao, CampoTexto, Seletor],
  template: `
    <div class="form">
      <app-campo-texto
        rotulo="Nome do fluxo"
        [obrigatorio]="true"
        [maximoCaracteres]="120"
        placeholder="Boas-vindas do site"
        [erro]="erros()['nome'] ?? null"
        [desabilitado]="somenteLeitura()"
        [valor]="dados().nome"
        (valorChange)="mudar({ nome: '' + ($event ?? '') })"
      />
      <app-area-texto
        rotulo="Para que serve"
        opcional
        [linhas]="2"
        [maximoCaracteres]="500"
        [desabilitado]="somenteLeitura()"
        [valor]="dados().descricao"
        (valorChange)="mudar({ descricao: $event })"
      />
      <app-seletor
        rotulo="Quando o robô começa"
        [obrigatorio]="true"
        [opcoes]="gatilhos"
        [dica]="dicaDoGatilho()"
        [desabilitado]="somenteLeitura()"
        [valor]="dados().gatilho"
        (valorChange)="mudar({ gatilho: $event ?? 'NOVA_CONVERSA' })"
      />
      @if (dados().gatilho === 'PALAVRA_CHAVE') {
        <app-campo-texto
          rotulo="Palavras que ativam o fluxo"
          [obrigatorio]="true"
          placeholder="boleto, segunda via"
          dica="Separe por vírgula. Vale se a mensagem do cliente tiver qualquer uma delas."
          [erro]="erros()['palavrasChave'] ?? null"
          [desabilitado]="somenteLeitura()"
          [valor]="dados().palavrasChave"
          (valorChange)="mudar({ palavrasChave: '' + ($event ?? '') })"
        />
      }
      <app-campo-texto
        rotulo="Prioridade"
        tipo="number"
        [minimo]="-100"
        [maximo]="100"
        dica="Se mais de um fluxo servir para a mesma conversa, vence o de número maior."
        [desabilitado]="somenteLeitura()"
        [valor]="dados().prioridade"
        (valorChange)="mudar({ prioridade: Number($event) || 0 })"
      />
      <fieldset class="canais">
        <legend class="canais__titulo">Em quais canais</legend>
        <p class="canais__dica">
          {{
            dados().canalIds.length === 0
              ? 'Nenhum marcado: vale para todos os canais.'
              : 'Só as conversas dos canais marcados.'
          }}
        </p>
        @for (canal of contexto.canais(); track canal.id) {
          <app-caixa-selecao
            [rotulo]="canal.nome + ' · ' + tipoDoCanal(canal.tipo)"
            [desabilitado]="somenteLeitura()"
            [valor]="dados().canalIds.includes(canal.id)"
            (valorChange)="alternarCanal(canal.id, $event)"
          />
        } @empty {
          <p class="canais__dica">Nenhum canal cadastrado ainda.</p>
        }
      </fieldset>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .form {
      display: grid;
      gap: var(--esp-4);
      max-width: 40rem;
    }

    .canais {
      display: grid;
      gap: var(--esp-2);
      min-width: 0;
      margin: 0;
      padding: var(--esp-4);
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-lg);
    }

    .canais__titulo {
      padding: 0 var(--esp-2);
      font: var(--fonte-corpo-sm);
      font-weight: 600;
    }

    .canais__dica {
      margin: 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioFluxo {
  protected readonly contexto = inject(ContextoEditor);

  readonly dados = model<DadosDoFluxo>(DADOS_PADRAO);
  readonly somenteLeitura = input(false);
  readonly erros = input<Readonly<Record<string, string>>>({});

  protected readonly Number = Number;
  protected readonly gatilhos: readonly OpcaoSeletor<GatilhoFluxo>[] = (
    Object.keys(ROTULO_GATILHO) as GatilhoFluxo[]
  ).map((valor) => ({ valor, rotulo: ROTULO_GATILHO[valor] }));
  protected readonly dicaDoGatilho = computed(() => DICA_GATILHO[this.dados().gatilho]);

  protected tipoDoCanal(tipo: string): string {
    return ROTULO_TIPO_CANAL[tipo] ?? tipo;
  }

  protected mudar(mudancas: Partial<DadosDoFluxo>): void {
    this.dados.set({ ...this.dados(), ...mudancas });
  }

  protected alternarCanal(id: string, marcado: boolean): void {
    const atuais = this.dados().canalIds.filter((c) => c !== id);
    this.mudar({ canalIds: marcado ? [...atuais, id] : atuais });
  }
}
