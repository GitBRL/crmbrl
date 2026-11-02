import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  resource,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucidePhone } from '@lucide/angular';
import { map } from 'rxjs';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarData, formatarDataHora, formatarMoeda } from '../../nucleo/formatos';
import { aoReceber } from '../../nucleo/tempo-real/auxiliares';
import { Alternador } from '../../ui/alternador/alternador';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { CampoData } from '../../ui/campo-data/campo-data';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { Selo } from '../../ui/selo/selo';
import { FinanceiroApi } from './financeiro.api';
import {
  hojeIso,
  type LigacaoPendente,
  ROTULO_RESULTADO_LIGACAO,
  ROTULO_SITUACAO_ENVIO,
  type ResultadoLigacao,
  rotuloDoMarco,
  VARIANTE_SITUACAO_ENVIO,
} from './financeiro.tipos';
import { ModalBase, textoDoErro } from './modais-parcela';

const OPCOES_RESULTADO: readonly OpcaoGrupo<ResultadoLigacao>[] = [
  {
    valor: 'PROMESSA',
    rotulo: ROTULO_RESULTADO_LIGACAO.PROMESSA,
    dica: 'A cobrança fica em espera até a data combinada. Se não pagar, o CRM avisa.',
  },
  {
    valor: 'NAO_ATENDEU',
    rotulo: ROTULO_RESULTADO_LIGACAO.NAO_ATENDEU,
    dica: 'O cliente recebe a mensagem desta etapa por WhatsApp ou e-mail.',
  },
  {
    valor: 'SEM_ACORDO',
    rotulo: ROTULO_RESULTADO_LIGACAO.SEM_ACORDO,
    dica: 'Falou com o cliente, mas não combinaram nada. Ele recebe a mensagem da etapa.',
  },
  {
    valor: 'JA_PAGOU',
    rotulo: ROTULO_RESULTADO_LIGACAO.JA_PAGOU,
    dica: 'Dá baixa na parcela e encerra a cobrança.',
  },
];

/** Ligações da régua: o roteiro, o telefone e o registro do resultado de cada uma. */
@Component({
  selector: 'app-regua-ligacoes',
  imports: [
    RouterLink,
    Alternador,
    AreaTexto,
    Botao,
    CampoData,
    Cartao,
    EstadoVazio,
    GrupoOpcoes,
    ModalBase,
    Selo,
  ],
  template: `
    <div class="barra">
      <p class="nota">
        Cada ligação vira também uma atividade na sua agenda. Depois de ligar, registre o que
        aconteceu.
      </p>
      <app-alternador rotulo="Mostrar as já registradas" [(valor)]="todas" />
    </div>

    @if (dados.error()) {
      <app-estado-vazio
        [variante]="erro()!.ehSemPermissao ? 'sem-acesso' : 'erro'"
        [falha]="erro()!"
        [titulo]="
          erro()!.ehSemPermissao
            ? 'Você não tem acesso às ligações'
            : 'Não conseguimos carregar as ligações'
        "
        [texto]="erro()!.resumo"
      >
        <button appBotao type="button" variante="invertido" (click)="dados.reload()">
          Tentar de novo
        </button>
      </app-estado-vazio>
    } @else if (dados.hasValue() && itens().length === 0) {
      <app-estado-vazio
        [titulo]="todas() ? 'Nenhuma ligação' : 'Nenhuma ligação pendente'"
        texto="Quando uma etapa da régua pedir ligação, ela aparece aqui com o roteiro."
      />
    } @else if (!dados.hasValue()) {
      <app-estado-vazio titulo="Carregando as ligações…" compacto />
    } @else {
      <ul class="lista-cartoes">
        @for (l of itens(); track l.id) {
          <li>
            <app-cartao
              [titulo]="(l.contato?.nome ?? l.empresa?.nome ?? 'Cliente') + ''"
              [complemento]="rotuloMarco(l.marco) + ' · ' + (l.etapa ?? '')"
              [class.destacada]="l.id === destaque()"
            >
              <div class="ligacao">
                <p class="ligacao__linha">
                  <app-selo [variante]="variante[l.situacao]">{{ rotulo[l.situacao] }}</app-selo>
                  @if (l.prazoEm && l.situacao === 'AGUARDANDO_LIGACAO') {
                    <span class="nota">Ligar até {{ dataHora(l.prazoEm) }}</span>
                  }
                </p>
                <p>
                  Parcela
                  <a
                    [routerLink]="['/financeiro/parcelas']"
                    [queryParams]="{ parcela: l.parcela.id }"
                  >
                    {{ l.parcela.numero }}
                  </a>
                  @if (l.parcela.valor) {
                    · {{ moeda(l.parcela.valor) }}
                  }
                  @if (l.parcela.vencimento) {
                    · venceu em {{ data(l.parcela.vencimento) }}
                  }
                  @if (l.empresa && l.contato) {
                    <span class="nota"> · {{ l.empresa.nome }}</span>
                  }
                </p>
                @if (l.telefone) {
                  <p>
                    <a
                      appBotao
                      variante="contorno"
                      tamanho="sm"
                      [href]="'tel:+' + soDigitos(l.telefone)"
                      [icone]="icones.telefone"
                    >
                      {{ l.telefone }}
                    </a>
                  </p>
                } @else {
                  <p class="nota">O contato não tem telefone cadastrado.</p>
                }
                @if (l.roteiro) {
                  <p class="roteiro"><strong>Roteiro:</strong> {{ l.roteiro }}</p>
                }
                @if (l.situacao === 'AGUARDANDO_LIGACAO') {
                  <div class="cabecalho__acoes">
                    <button appBotao type="button" variante="marca" (click)="registrar(l)">
                      Registrar resultado
                    </button>
                  </div>
                }
              </div>
            </app-cartao>
          </li>
        }
      </ul>
    }

    <app-modal-base
      titulo="Resultado da ligação"
      [complemento]="alvo()?.parcela?.numero ?? null"
      formId="form-ligacao"
      rotuloAcao="Registrar"
      [(aberto)]="modalAberto"
      [salvando]="salvando()"
      [erro]="erroForm()"
      (confirmar)="salvar()"
    >
      <app-grupo-opcoes rotulo="Como foi a ligação?" [opcoes]="opcoes" [(valor)]="resultado" />
      @if (resultado() === 'PROMESSA') {
        <app-campo-data
          rotulo="Prometeu pagar até"
          [minimo]="hoje"
          ajuda="Dia combinado com o cliente. A cobrança só volta se passar dessa data sem pagamento."
          [(valor)]="promessaAte"
        />
      }
      <app-area-texto
        rotulo="Observação"
        [linhas]="3"
        [maximoCaracteres]="500"
        [(valor)]="observacao"
      />
    </app-modal-base>
  `,
  styleUrl: './financeiro-comum.scss',
  styles: `
    .ligacao {
      display: grid;
      gap: var(--esp-3);
    }

    .ligacao__linha {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-2) var(--esp-3);
      margin: 0;
    }

    .roteiro {
      padding: var(--esp-3);
      border-radius: var(--raio-sm);
      background: var(--cor-superficie-3);
    }

    .destacada {
      outline: 2px solid var(--cor-foco, var(--cor-texto));
      outline-offset: 2px;
      border-radius: var(--raio-lg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReguaLigacoes {
  private readonly api = inject(FinanceiroApi);
  private readonly avisos = inject(AvisosService);
  private readonly rota = inject(ActivatedRoute);

  readonly alterada = output<void>();

  protected readonly icones = { telefone: LucidePhone };
  protected readonly opcoes = OPCOES_RESULTADO;
  protected readonly rotulo = ROTULO_SITUACAO_ENVIO;
  protected readonly variante = VARIANTE_SITUACAO_ENVIO;
  protected readonly rotuloMarco = rotuloDoMarco;
  protected readonly moeda = (v: string) => formatarMoeda(v);
  protected readonly data = (v: string) => formatarData(v);
  protected readonly dataHora = formatarDataHora;
  protected readonly hoje = hojeIso();
  protected readonly soDigitos = (t: string) => t.replace(/\D/g, '');

  /** `?envio=<id>` (link da notificação) destaca a ligação. */
  protected readonly destaque = toSignal(this.rota.queryParamMap.pipe(map((p) => p.get('envio'))), {
    initialValue: null,
  });
  protected readonly todas = signal(false);

  protected readonly dados = resource({
    params: () => this.todas(),
    loader: async ({ params }) => {
      const r = await this.api.ligacoes(!params);
      return Array.isArray(r)
        ? (r as readonly LigacaoPendente[])
        : (r as { itens: readonly LigacaoPendente[] }).itens;
    },
  });
  protected readonly itens = computed<readonly LigacaoPendente[]>(() =>
    this.dados.hasValue() ? this.dados.value() : [],
  );
  protected readonly erro = computed(() => {
    const falha = this.dados.error();
    return falha ? erroDaApi(falha) : null;
  });

  protected readonly alvo = signal<LigacaoPendente | null>(null);
  protected readonly modalAberto = signal(false);
  protected readonly resultado = signal<ResultadoLigacao | null>(null);
  protected readonly promessaAte = signal<string | null>(null);
  protected readonly observacao = signal('');
  protected readonly salvando = signal(false);
  protected readonly erroForm = signal<string | null>(null);

  constructor() {
    aoReceber('regua.progresso', () => this.dados.reload());
  }

  protected registrar(ligacao: LigacaoPendente): void {
    this.alvo.set(ligacao);
    this.resultado.set(null);
    this.promessaAte.set(null);
    this.observacao.set('');
    this.erroForm.set(null);
    this.modalAberto.set(true);
  }

  protected async salvar(): Promise<void> {
    const alvo = this.alvo();
    const resultado = this.resultado();
    if (!alvo || this.salvando()) {
      return;
    }
    if (!resultado) {
      this.erroForm.set('Escolha como foi a ligação.');
      return;
    }
    if (resultado === 'PROMESSA' && !this.promessaAte()) {
      this.erroForm.set('Informe até quando o cliente prometeu pagar.');
      return;
    }
    this.salvando.set(true);
    this.erroForm.set(null);
    try {
      await this.api.registrarLigacao(alvo.id, {
        resultado,
        ...(resultado === 'PROMESSA' ? { promessaAte: this.promessaAte()! } : {}),
        ...(this.observacao().trim() ? { observacao: this.observacao().trim() } : {}),
      });
      this.avisos.sucesso('Resultado registrado.');
      this.modalAberto.set(false);
      this.dados.reload();
      this.alterada.emit();
    } catch (falha) {
      this.erroForm.set(textoDoErro(falha));
    } finally {
      this.salvando.set(false);
    }
  }
}
