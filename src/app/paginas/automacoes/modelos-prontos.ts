import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { nomeDoSetor } from '../../nucleo/setores/setores';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Modal } from '../../ui/modal/modal';
import { Selo } from '../../ui/selo/selo';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { AutomacoesApi } from './automacoes.api';
import type { ModeloPronto } from './automacoes.tipos';
import { SetoresService } from '../../nucleo/setores/setores.service';

/**
 * Modelos prontos: automações já montadas (boas-vindas ao lead, follow-up de proposta, lembrete
 * de renovação, reativação). "Usar" cria uma cópia pausada, pede só o que falta configurar e
 * abre o editor para a pessoa conferir antes de ativar.
 */
@Component({
  selector: 'app-modelos-prontos',
  imports: [Botao, Cartao, CampoTexto, EstadoVazio, Esqueleto, Modal, Selo, Seletor],
  template: `
    @if (carregando()) {
      <div class="grade">
        @for (n of [1, 2, 3, 4]; track n) {
          <app-cartao><app-esqueleto [linhas]="4" /></app-cartao>
        }
      </div>
    } @else if (erro(); as falha) {
      <app-estado-vazio
        variante="erro"
        titulo="Não foi possível carregar os modelos"
        [falha]="falha"
        texto="Tente de novo em instantes."
      />
    } @else if (modelos().length === 0) {
      <app-estado-vazio
        titulo="Nenhum modelo para o seu setor"
        texto="Crie uma automação do zero."
      />
    } @else {
      <p class="intro">
        Comece por um modelo: ele já vem com o gatilho e os passos. Você confere e ajusta antes de
        ligar.
      </p>
      <div class="grade">
        @for (m of modelos(); track m.chave) {
          <app-cartao [titulo]="m.nome">
            <div class="modelo">
              <p class="modelo__texto">{{ m.descricao }}</p>
              <div class="modelo__selos">
                @for (a of m.areas; track a) {
                  <app-selo tamanho="sm" variante="contorno">{{ rotuloArea(a) }}</app-selo>
                }
                @if (m.aConfigurar.length) {
                  <app-selo tamanho="sm" variante="lima"
                    >Pede: {{ m.aConfigurar.join(', ') }}</app-selo
                  >
                }
              </div>
              <button appBotao type="button" variante="marca" tamanho="sm" (click)="escolher(m)">
                Usar este modelo
              </button>
            </div>
          </app-cartao>
        }
      </div>
    }

    <app-modal
      [(aberto)]="modalAberto"
      [titulo]="escolhido()?.nome ?? 'Modelo'"
      complemento="Confirme os dados da nova automação."
    >
      @if (escolhido(); as m) {
        <form class="form" (submit)="$event.preventDefault(); criar()">
          <app-campo-texto rotulo="Nome da automação" [(valor)]="nome" />
          @if (sessao.ehDiretoria()) {
            <app-seletor
              rotulo="Setor"
              permitirVazio
              placeholder="Todos os setores"
              [opcoes]="opcoesArea()"
              [(valor)]="area"
            />
          }
          @if (m.chave === 'follow_up_proposta') {
            <app-seletor
              rotulo="Etapa da proposta"
              placeholder="Escolha a etapa"
              dica="A automação começa quando um negócio entra nesta etapa."
              [opcoes]="etapas()"
              [(valor)]="etapaId"
            />
          }
          @if (m.chave === 'lembrete_renovacao') {
            @if (camposData().length) {
              <app-seletor
                rotulo="Campo com a data de renovação"
                placeholder="Escolha o campo"
                dica="Um campo personalizado do contato, com a data no formato AAAA-MM-DD."
                [opcoes]="camposData()"
                [(valor)]="campoData"
              />
            } @else {
              <app-campo-texto
                rotulo="Chave do campo de data"
                dica="Chave do campo personalizado do contato que guarda a data (ex.: renovacao_em)."
                [(valor)]="chaveCampo"
              />
            }
          }
          @if (erroCriar(); as e) {
            <p class="erro" role="alert">{{ e }}</p>
          }
          <div class="acoes">
            <button appBotao type="button" variante="contorno" (click)="modalAberto.set(false)">
              Cancelar
            </button>
            <button appBotao type="submit" variante="marca" [carregando]="criando()">
              Criar e abrir
            </button>
          </div>
        </form>
      }
    </app-modal>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-4);
      min-width: 0;
    }
    .intro {
      margin: 0;
      color: var(--cor-texto-suave);
    }
    .grade {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
      gap: var(--esp-entre-cartoes, var(--esp-4));
    }
    .modelo {
      display: grid;
      gap: var(--esp-3);
      justify-items: start;
    }
    .modelo__texto {
      margin: 0;
    }
    .modelo__selos {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
    }
    .form {
      display: grid;
      gap: var(--esp-4);
    }
    .acoes {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--esp-2);
    }
    .erro {
      margin: 0;
      color: var(--cor-erro);
      font: var(--fonte-corpo-sm);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelosProntos {
  protected readonly setores = inject(SetoresService);
  private readonly api = inject(AutomacoesApi);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);
  protected readonly sessao = inject(SessaoService);

  protected readonly modelos = signal<readonly ModeloPronto[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly modalAberto = signal(false);
  protected readonly escolhido = signal<ModeloPronto | null>(null);
  protected readonly nome = signal<string | number | null>('');
  protected readonly area = signal<string | null>(null);
  protected readonly etapaId = signal<string | null>(null);
  protected readonly campoData = signal<string | null>(null);
  protected readonly chaveCampo = signal<string | number | null>('');
  protected readonly etapas = signal<readonly OpcaoSeletor<string>[]>([]);
  protected readonly camposData = signal<readonly OpcaoSeletor<string>[]>([]);
  protected readonly criando = signal(false);
  protected readonly erroCriar = signal<string | null>(null);

  protected readonly opcoesArea = computed(() => this.setores.opcoes());

  constructor() {
    void this.setores.carregar();
    void this.carregar();
  }

  protected rotuloArea(a: string): string {
    return nomeDoSetor(a);
  }

  private async carregar(): Promise<void> {
    try {
      this.modelos.set(await this.api.modelosProntos());
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    } finally {
      this.carregando.set(false);
    }
  }

  protected async escolher(m: ModeloPronto): Promise<void> {
    this.escolhido.set(m);
    this.nome.set(m.nome);
    this.area.set(null);
    this.etapaId.set(null);
    this.campoData.set(null);
    this.chaveCampo.set('');
    this.erroCriar.set(null);
    this.modalAberto.set(true);
    if (m.chave === 'follow_up_proposta' && this.etapas().length === 0) {
      const funis = await this.api.funis();
      this.etapas.set(
        funis.flatMap((f) =>
          f.etapas.map((e) => ({ valor: e.id, rotulo: `${f.nome} › ${e.nome}` })),
        ),
      );
    }
    if (m.chave === 'lembrete_renovacao' && this.camposData().length === 0) {
      const chaves = await this.api.camposPersonalizados();
      this.camposData.set(chaves.map((c) => ({ valor: `contato.campos.${c}`, rotulo: c })));
    }
  }

  protected async criar(): Promise<void> {
    const m = this.escolhido();
    if (!m) return;
    const gatilhoConfig: Record<string, unknown> = {};
    if (m.chave === 'follow_up_proposta') {
      if (!this.etapaId()) {
        this.erroCriar.set('Escolha a etapa da proposta.');
        return;
      }
      gatilhoConfig['etapaId'] = this.etapaId();
    }
    if (m.chave === 'lembrete_renovacao') {
      const campo =
        this.campoData() ??
        (String(this.chaveCampo() ?? '').trim()
          ? `contato.campos.${String(this.chaveCampo()).trim()}`
          : null);
      if (!campo) {
        this.erroCriar.set('Informe o campo que guarda a data de renovação.');
        return;
      }
      gatilhoConfig['campo'] = campo;
    }
    this.criando.set(true);
    this.erroCriar.set(null);
    try {
      const nome = String(this.nome() ?? '').trim();
      const criada = await this.api.usarModeloPronto(m.chave, {
        ...(nome ? { nome } : {}),
        ...(this.sessao.ehDiretoria() && this.area() ? { area: this.area() } : {}),
        ...(Object.keys(gatilhoConfig).length ? { gatilhoConfig } : {}),
      });
      this.modalAberto.set(false);
      this.avisos.sucesso('Automação criada, ainda desligada. Confira e ative quando quiser.');
      await this.router.navigate(['/automacoes', criada.id]);
    } catch (falha) {
      this.erroCriar.set(erroDaApi(falha).mensagem);
    } finally {
      this.criando.set(false);
    }
  }
}
