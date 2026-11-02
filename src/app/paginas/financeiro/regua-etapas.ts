import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { LucidePlus } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { copiarTexto } from '../../nucleo/copiar';
import { Alternador } from '../../ui/alternador/alternador';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { CampoTexto, type ValorCampoTexto } from '../../ui/campo-texto/campo-texto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { DisparosApi } from '../disparos/disparos.api';
import { FinanceiroApi } from './financeiro.api';
import { type DadosEtapa, type EtapaRegua, rotuloDoMarco } from './financeiro.tipos';
import { ModalBase, numeroDoCampo, textoDoErro } from './modais-parcela';

const COLUNAS_GESTAO: readonly ColunaTabela[] = [
  { id: 'marco', rotulo: 'Quando', largura: '7rem' },
  { id: 'nome', rotulo: 'Etapa', noCartao: 'titulo' },
  { id: 'canais', rotulo: 'Canais' },
  { id: 'ativa', rotulo: 'Situação' },
  { id: 'acoes', rotulo: 'Ações', rotuloOculto: true, alinhar: 'fim' },
];

interface Formulario {
  nome: string;
  marco: ValorCampoTexto;
  ativa: boolean;
  whatsapp: boolean;
  email: boolean;
  ligacao: boolean;
  modeloWhatsappId: string | null;
  textoWhatsapp: string;
  modeloEmailId: string | null;
  assuntoEmail: string;
  textoEmail: string;
  roteiroLigacao: string;
}

const VAZIO: Formulario = {
  nome: '',
  marco: 0,
  ativa: true,
  whatsapp: true,
  email: false,
  ligacao: false,
  modeloWhatsappId: null,
  textoWhatsapp: '',
  modeloEmailId: null,
  assuntoEmail: '',
  textoEmail: '',
  roteiroLigacao: '',
};

/** Etapas da régua: marco a partir do vencimento, canais, textos com variáveis e roteiro de ligação. */
@Component({
  selector: 'app-regua-etapas',
  imports: [
    Alternador,
    AreaTexto,
    Botao,
    CampoTexto,
    CelulaTabela,
    EstadoVazio,
    ModalBase,
    Seletor,
    Selo,
    Tabela,
  ],
  template: `
    <div class="cabecalho__linha">
      <p class="nota frase">
        Cada etapa fala com o cliente num dia a partir do vencimento: “D-3” é três dias antes, “D0”
        é no dia e “D+5” é cinco dias depois.
      </p>
      @if (podeGerenciar()) {
        <button appBotao type="button" variante="destaque" [icone]="icones.novo" (click)="nova()">
          Nova etapa
        </button>
      }
    </div>

    @if (dados.error()) {
      <app-estado-vazio
        variante="erro"
        titulo="Não conseguimos carregar as etapas"
        [texto]="erroLista()?.resumo ?? null"
      >
        <button appBotao type="button" variante="invertido" (click)="dados.reload()">
          Tentar de novo
        </button>
      </app-estado-vazio>
    } @else if (dados.hasValue() && itens().length === 0) {
      <app-estado-vazio
        titulo="Nenhuma etapa criada"
        texto="Sem etapas, a régua não cobra ninguém."
      >
        @if (podeGerenciar()) {
          <button appBotao type="button" variante="invertido" (click)="nova()">Criar etapa</button>
        }
      </app-estado-vazio>
    } @else {
      <app-tabela
        rotulo="Etapas da régua"
        [colunas]="colunas()"
        [linhas]="itens()"
        [carregando]="dados.isLoading() && !dados.hasValue()"
        [linhasEsqueleto]="6"
        [clicavel]="podeGerenciar()"
        (abrir)="editar($event)"
      >
        <ng-template appCelula="marco" [appCelulaDe]="itens()" let-e>
          <strong>{{ e.rotuloDoMarco }}</strong>
        </ng-template>
        <ng-template appCelula="nome" [appCelulaDe]="itens()" let-e>
          <span class="nome__titulo">{{ e.nome }}</span>
        </ng-template>
        <ng-template appCelula="canais" [appCelulaDe]="itens()" let-e>
          <span class="canais">
            @if (e.whatsapp) {
              <app-selo tamanho="sm">WhatsApp</app-selo>
            }
            @if (e.email) {
              <app-selo tamanho="sm">E-mail</app-selo>
            }
            @if (e.ligacao) {
              <app-selo tamanho="sm">Ligação</app-selo>
            }
          </span>
        </ng-template>
        <ng-template appCelula="ativa" [appCelulaDe]="itens()" let-e>
          <app-selo [variante]="e.ativa ? 'menta' : 'neutro'">
            {{ e.ativa ? 'Ativa' : 'Desligada' }}
          </app-selo>
        </ng-template>
        <ng-template appCelula="acoes" [appCelulaDe]="itens()" let-e>
          @if (podeGerenciar()) {
            <button
              appBotao
              type="button"
              variante="contorno"
              tamanho="sm"
              [attr.aria-label]="'Excluir a etapa ' + e.nome"
              (click)="$event.stopPropagation(); excluir(e)"
            >
              Excluir
            </button>
          }
        </ng-template>
      </app-tabela>
    }

    <app-modal-base
      [titulo]="editandoId() ? 'Editar etapa' : 'Nova etapa'"
      largura="lg"
      formId="form-etapa"
      rotuloAcao="Salvar etapa"
      [(aberto)]="modalAberto"
      [salvando]="salvando()"
      [erro]="erroForm()"
      (confirmar)="salvar()"
    >
      <div class="grade-campos">
        <app-campo-texto
          rotulo="Nome da etapa"
          [maximoCaracteres]="80"
          [valor]="f().nome"
          (valorChange)="mudar({ nome: '' + ($event ?? '') })"
        />
        <app-campo-texto
          rotulo="Dias a partir do vencimento"
          tipo="number"
          [passo]="1"
          [minimo]="-60"
          [maximo]="365"
          ajuda="Negativo é antes do vencimento (-3), zero é no dia e positivo é depois (5)."
          [dica]="'Esta etapa será ' + rotuloDoMarco(marcoNumero())"
          [valor]="f().marco"
          (valorChange)="mudar({ marco: $event })"
        />
      </div>
      <app-alternador
        rotulo="Etapa ativa"
        [valor]="f().ativa"
        (valorChange)="mudar({ ativa: $event })"
      />
      <div class="grade-campos">
        <app-alternador
          rotulo="WhatsApp"
          [valor]="f().whatsapp"
          (valorChange)="mudar({ whatsapp: $event })"
        />
        <app-alternador
          rotulo="E-mail"
          [valor]="f().email"
          (valorChange)="mudar({ email: $event })"
        />
        <app-alternador
          rotulo="Ligação"
          [valor]="f().ligacao"
          (valorChange)="mudar({ ligacao: $event })"
        />
      </div>

      <div class="variaveis">
        <p class="nota">
          Variáveis que você pode usar nos textos (clique para copiar). Sem valor, use
          <code>{{ '{{contato.primeiro_nome|cliente}}' }}</code>. Para variar a frase,
          <code>{{ '{Olá|Oi}' }}</code
          >.
        </p>
        <p class="chips">
          @for (v of variaveis(); track v) {
            <button type="button" class="chip-var" (click)="copiar(v)">
              {{ '{{' + v + '}}' }}
            </button>
          }
        </p>
      </div>

      @if (f().whatsapp) {
        <fieldset class="bloco-canal">
          <legend>Mensagem de WhatsApp</legend>
          <app-seletor
            rotulo="Começar de um modelo salvo"
            placeholder="Escrever do zero"
            permitirVazio
            [opcoes]="opcoesModeloWhatsapp()"
            [valor]="f().modeloWhatsappId"
            (valorChange)="usarModelo('WHATSAPP', $event)"
          />
          <app-area-texto
            rotulo="Texto do WhatsApp"
            [linhas]="4"
            [maximoCaracteres]="1500"
            [valor]="f().textoWhatsapp"
            (valorChange)="mudar({ textoWhatsapp: $event })"
          />
          <button
            appBotao
            type="button"
            variante="contorno"
            tamanho="sm"
            (click)="previa(f().textoWhatsapp)"
          >
            Ver como o cliente recebe
          </button>
        </fieldset>
      }
      @if (f().email) {
        <fieldset class="bloco-canal">
          <legend>E-mail</legend>
          <app-seletor
            rotulo="Começar de um modelo salvo"
            placeholder="Escrever do zero"
            permitirVazio
            [opcoes]="opcoesModeloEmail()"
            [valor]="f().modeloEmailId"
            (valorChange)="usarModelo('EMAIL', $event)"
          />
          <app-campo-texto
            rotulo="Assunto"
            [maximoCaracteres]="200"
            [valor]="f().assuntoEmail"
            (valorChange)="mudar({ assuntoEmail: '' + ($event ?? '') })"
          />
          <app-area-texto
            rotulo="Texto do e-mail"
            [linhas]="5"
            [maximoCaracteres]="5000"
            [valor]="f().textoEmail"
            (valorChange)="mudar({ textoEmail: $event })"
          />
          <button
            appBotao
            type="button"
            variante="contorno"
            tamanho="sm"
            (click)="previa(f().textoEmail)"
          >
            Ver como o cliente recebe
          </button>
        </fieldset>
      }
      @if (f().ligacao) {
        <fieldset class="bloco-canal">
          <legend>Ligação</legend>
          <app-area-texto
            rotulo="Roteiro da ligação"
            [linhas]="3"
            [maximoCaracteres]="1500"
            dica="Aparece para quem vai ligar, junto com o telefone do cliente."
            [valor]="f().roteiroLigacao"
            (valorChange)="mudar({ roteiroLigacao: $event })"
          />
        </fieldset>
      }
      @if (textoPrevia(); as t) {
        <div class="previa" role="status">
          <strong>Prévia com dados de exemplo</strong>
          <p>{{ t }}</p>
        </div>
      }
    </app-modal-base>
  `,
  styleUrl: './financeiro-comum.scss',
  styles: `
    .canais {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-1);
    }

    .bloco-canal {
      display: grid;
      gap: var(--esp-3);
      min-width: 0;
      margin: 0;
      padding: var(--esp-4);
      border: 1px solid var(--cor-contorno-controle);
      border-radius: var(--raio-md);
    }

    .bloco-canal legend {
      padding: 0 var(--esp-2);
      font: var(--fonte-rotulo);
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
      margin: 0;
    }

    .chip-var {
      padding: 2px var(--esp-3);
      border: 1px solid var(--cor-contorno-controle);
      border-radius: var(--raio-pilula);
      background: var(--cor-superficie-2);
      color: var(--cor-texto);
      font: var(--fonte-corpo-sm);
      cursor: pointer;
      overflow-wrap: anywhere;
    }

    .previa {
      display: grid;
      gap: var(--esp-2);
      padding: var(--esp-3);
      border-radius: var(--raio-sm);
      background: var(--cor-superficie-3);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    code {
      font-family: var(--fonte-mono, monospace);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReguaEtapas {
  private readonly api = inject(FinanceiroApi);
  private readonly disparos = inject(DisparosApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);

  readonly podeGerenciar = input(false);

  protected readonly icones = { novo: LucidePlus };
  protected readonly rotuloDoMarco = rotuloDoMarco;
  protected readonly colunas = computed(() =>
    this.podeGerenciar() ? COLUNAS_GESTAO : COLUNAS_GESTAO.filter((c) => c.id !== 'acoes'),
  );

  protected readonly dados = resource({ loader: () => this.api.etapas() });
  protected readonly itens = computed<readonly EtapaRegua[]>(() =>
    this.dados.hasValue() ? [...this.dados.value()].sort((a, b) => a.marco - b.marco) : [],
  );
  protected readonly erroLista = computed(() => {
    const falha = this.dados.error();
    return falha ? erroDaApi(falha) : null;
  });

  private readonly configuracao = resource({ loader: () => this.api.configuracaoRegua() });
  protected readonly variaveis = computed(() =>
    this.configuracao.hasValue()
      ? ['contato.primeiro_nome|cliente', ...this.configuracao.value().variaveis]
      : ['contato.primeiro_nome|cliente'],
  );

  private readonly modelosWhatsapp = resource({
    loader: () => this.disparos.modelos('WHATSAPP').catch(() => null),
  });
  private readonly modelosEmail = resource({
    loader: () => this.disparos.modelos('EMAIL').catch(() => null),
  });
  protected readonly opcoesModeloWhatsapp = computed<readonly OpcaoSeletor<string>[]>(() =>
    (this.modelosWhatsapp.hasValue() ? (this.modelosWhatsapp.value()?.itens ?? []) : []).map(
      (m) => ({
        valor: m.id,
        rotulo: m.nome,
      }),
    ),
  );
  protected readonly opcoesModeloEmail = computed<readonly OpcaoSeletor<string>[]>(() =>
    (this.modelosEmail.hasValue() ? (this.modelosEmail.value()?.itens ?? []) : []).map((m) => ({
      valor: m.id,
      rotulo: m.nome,
    })),
  );

  protected readonly modalAberto = signal(false);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly f = signal<Formulario>(VAZIO);
  protected readonly salvando = signal(false);
  protected readonly erroForm = signal<string | null>(null);
  protected readonly textoPrevia = signal<string | null>(null);
  protected readonly marcoNumero = computed(() => numeroDoCampo(this.f().marco) ?? 0);

  protected mudar(parcial: Partial<Formulario>): void {
    this.f.update((atual) => ({ ...atual, ...parcial }));
  }

  protected nova(): void {
    this.editandoId.set(null);
    this.f.set(VAZIO);
    this.abrirModal();
  }

  protected editar(e: EtapaRegua): void {
    if (!this.podeGerenciar()) {
      return;
    }
    this.editandoId.set(e.id);
    this.f.set({
      nome: e.nome,
      marco: e.marco,
      ativa: e.ativa,
      whatsapp: e.whatsapp,
      email: e.email,
      ligacao: e.ligacao,
      modeloWhatsappId: e.modeloWhatsappId,
      textoWhatsapp: e.textoWhatsapp ?? '',
      modeloEmailId: e.modeloEmailId,
      assuntoEmail: e.assuntoEmail ?? '',
      textoEmail: e.textoEmail ?? '',
      roteiroLigacao: e.roteiroLigacao ?? '',
    });
    this.abrirModal();
  }

  private abrirModal(): void {
    this.erroForm.set(null);
    this.textoPrevia.set(null);
    this.modalAberto.set(true);
  }

  protected usarModelo(canal: 'WHATSAPP' | 'EMAIL', id: string | null): void {
    if (canal === 'WHATSAPP') {
      const m = this.modelosWhatsapp.hasValue()
        ? this.modelosWhatsapp.value()?.itens.find((x) => x.id === id)
        : undefined;
      this.mudar({ modeloWhatsappId: id, ...(m ? { textoWhatsapp: m.texto } : {}) });
    } else {
      const m = this.modelosEmail.hasValue()
        ? this.modelosEmail.value()?.itens.find((x) => x.id === id)
        : undefined;
      this.mudar({
        modeloEmailId: id,
        ...(m ? { textoEmail: m.texto, assuntoEmail: m.assunto ?? this.f().assuntoEmail } : {}),
      });
    }
  }

  protected async copiar(variavel: string): Promise<void> {
    if (await copiarTexto('{{' + variavel + '}}')) {
      this.avisos.info('Variável copiada. Cole no texto.');
    }
  }

  protected async previa(texto: string): Promise<void> {
    try {
      const r = await this.api.previa(texto);
      this.textoPrevia.set(
        r.erros.length > 0 ? `Corrija antes de salvar: ${r.erros.join('; ')}` : r.texto,
      );
    } catch (falha) {
      this.textoPrevia.set(erroDaApi(falha).resumo);
    }
  }

  protected async salvar(): Promise<void> {
    if (this.salvando()) {
      return;
    }
    const f = this.f();
    const marco = numeroDoCampo(f.marco);
    if (f.nome.trim() === '' || marco === null) {
      this.erroForm.set('Dê um nome à etapa e informe os dias a partir do vencimento.');
      return;
    }
    if (!f.whatsapp && !f.email && !f.ligacao) {
      this.erroForm.set('Escolha pelo menos um canal: WhatsApp, e-mail ou ligação.');
      return;
    }
    const dados: DadosEtapa = {
      nome: f.nome.trim(),
      marco: Math.trunc(marco),
      ativa: f.ativa,
      whatsapp: f.whatsapp,
      email: f.email,
      ligacao: f.ligacao,
      modeloWhatsappId: f.whatsapp ? f.modeloWhatsappId : null,
      textoWhatsapp: f.whatsapp ? f.textoWhatsapp || null : null,
      modeloEmailId: f.email ? f.modeloEmailId : null,
      assuntoEmail: f.email ? f.assuntoEmail || null : null,
      textoEmail: f.email ? f.textoEmail || null : null,
      roteiroLigacao: f.ligacao ? f.roteiroLigacao || null : null,
    };
    this.salvando.set(true);
    this.erroForm.set(null);
    try {
      const id = this.editandoId();
      if (id) {
        await this.api.salvarEtapa(id, dados);
      } else {
        await this.api.criarEtapa(dados);
      }
      this.avisos.sucesso('Etapa salva.');
      this.modalAberto.set(false);
      this.dados.reload();
    } catch (falha) {
      this.erroForm.set(
        erroDaApi(falha).status === 409
          ? 'Já existe uma etapa neste dia. Escolha outro dia a partir do vencimento.'
          : textoDoErro(falha),
      );
    } finally {
      this.salvando.set(false);
    }
  }

  protected async excluir(e: EtapaRegua): Promise<void> {
    await this.confirmacao.confirmar({
      titulo: `Excluir a etapa ${e.rotuloDoMarco}?`,
      mensagem: `“${e.nome}” deixa de existir e a régua não envia mais nada neste dia. O que já foi enviado continua no histórico.`,
      confirmar: 'Excluir etapa',
      cancelar: 'Voltar',
      perigo: true,
      executar: async () => {
        await this.api.excluirEtapa(e.id);
        this.avisos.sucesso('Etapa excluída.');
        this.dados.reload();
      },
    });
  }
}
