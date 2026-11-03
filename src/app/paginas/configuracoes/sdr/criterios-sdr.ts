import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideGripVertical,
  LucidePlus,
  LucideRefreshCw,
  LucideRotateCcw,
} from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { Alternador } from '../../../ui/alternador/alternador';
import { AreaTexto } from '../../../ui/area-texto/area-texto';
import { BotaoIcone } from '../../../ui/botao-icone/botao-icone';
import { Botao } from '../../../ui/botao/botao';
import { CampoTexto } from '../../../ui/campo-texto/campo-texto';
import { Cartao } from '../../../ui/cartao/cartao';
import { moverItem } from '../../../ui/editor-passos/passos';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { Modal } from '../../../ui/modal/modal';
import { Selo } from '../../../ui/selo/selo';
import { type OpcaoSeletor, Seletor } from '../../../ui/seletor/seletor';
import { chaveDoRotulo, inteiroDoCampo, textoOuNulo } from './rotulos';
import { SdrConfigApi } from './sdr.api';
import {
  type AlvoCriterio,
  type CamposDisponiveis,
  type CorpoCriterio,
  type CriterioSdr,
  ROTULO_ALVO,
  ROTULO_TIPO_CRITERIO,
  type TipoCriterio,
} from './sdr.tipos';

const TIPOS: readonly OpcaoSeletor<TipoCriterio>[] = (
  Object.keys(ROTULO_TIPO_CRITERIO) as TipoCriterio[]
).map((valor) => ({ valor, rotulo: ROTULO_TIPO_CRITERIO[valor] }));

const ALVOS: readonly OpcaoSeletor<AlvoCriterio>[] = (
  Object.keys(ROTULO_ALVO) as AlvoCriterio[]
).map((valor) => ({ valor, rotulo: ROTULO_ALVO[valor] }));

/** Opções escritas uma por linha → lista sem linhas vazias nem repetidas. */
export function opcoesDoTexto(texto: string): readonly string[] {
  const vistas = new Set<string>();
  for (const linha of texto.split('\n')) {
    const opcao = linha.trim();
    if (opcao) {
      vistas.add(opcao);
    }
  }
  return [...vistas];
}

/** Por que o critério não pode ser salvo (ou `null`). */
export function erroDoCriterio(dados: {
  rotulo: string;
  chave: string;
  instrucao: string;
  tipo: TipoCriterio;
  opcoes: readonly string[];
  alvo: AlvoCriterio;
  campo: string | null;
  peso: number | null;
  novo: boolean;
}): string | null {
  if (dados.rotulo.length < 2) {
    return 'Dê um nome ao que a IA deve descobrir (pelo menos 2 letras).';
  }
  if (dados.novo && !/^[a-z][a-z0-9_]{1,39}$/.test(dados.chave)) {
    return 'O identificador usa letras minúsculas, números e _, e começa com letra.';
  }
  if (dados.instrucao.length < 3) {
    return 'Explique à IA como descobrir isso.';
  }
  if (dados.tipo === 'OPCAO' && (dados.opcoes.length < 2 || dados.opcoes.length > 20)) {
    return 'Informe de 2 a 20 opções, uma por linha.';
  }
  if (dados.alvo !== 'NENHUM' && !dados.campo) {
    return 'Escolha o campo onde gravar a resposta.';
  }
  if (dados.peso === null || Number.isNaN(dados.peso) || dados.peso < 1 || dados.peso > 100) {
    return 'O peso vai de 1 a 100.';
  }
  return null;
}

/**
 * Configurações → SDR com IA → Critérios: o que a IA descobre do lead. Lista que se reordena
 * (arrastar ou setas), edição em janela e o botão que restaura o modelo de captação de alunos.
 */
@Component({
  selector: 'app-criterios-sdr',
  imports: [
    Alternador,
    AreaTexto,
    Botao,
    BotaoIcone,
    CampoTexto,
    Cartao,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    Esqueleto,
    EstadoVazio,
    Modal,
    Selo,
    Seletor,
    LucideGripVertical,
  ],
  template: `
    <div class="parte">
      <app-cartao>
        <div class="bloco">
          <h3 class="titulo">O que a IA descobre do lead</h3>
          <p class="texto">
            Cada critério é uma informação que a IA procura na conversa. A nota do lead soma os
            pesos dos critérios descobertos; os obrigatórios precisam estar descobertos para o lead
            ser qualificado. A ordem da lista é a ordem em que a IA pergunta.
          </p>
        </div>
      </app-cartao>

      @if (erro(); as falha) {
        <app-estado-vazio
          variante="erro"
          titulo="Não conseguimos carregar os critérios"
          [falha]="falha"
          [texto]="falha.resumo"
          [codigo]="falha.ehFalhaDoServidor ? falha.requisicaoId : null"
        >
          <button appBotao type="button" variante="invertido" (click)="carregar()">
            Tentar de novo
          </button>
        </app-estado-vazio>
      } @else if (criterios() === null) {
        <app-cartao>
          <div class="esqueleto" aria-busy="true">
            <p class="visualmente-oculto" role="status">Carregando os critérios…</p>
            <app-esqueleto forma="bloco" altura="56px" />
            <app-esqueleto forma="bloco" altura="56px" />
          </div>
        </app-cartao>
      } @else {
        <div class="cabecalho-lista">
          <p class="texto" role="status">
            {{ criterios()!.length }} critérios · peso total dos ativos: {{ pesoTotal() }}
          </p>
          <div class="item__acoes">
            <button
              appBotao
              type="button"
              [icone]="iconeModelo"
              (click)="confirmandoModelo.set(!confirmandoModelo())"
            >
              Restaurar modelo de captação de alunos
            </button>
            <button
              appBotao
              type="button"
              variante="invertido"
              [icone]="iconeMais"
              (click)="novo()"
            >
              Novo critério
            </button>
          </div>
        </div>
        @if (confirmandoModelo()) {
          <div class="aviso" role="group" aria-label="Confirmar o modelo de captação">
            <p>
              O modelo traz curso, modalidade, quando quer começar, cidade, forma de pagamento e
              quem decide. Só entram os que estiverem faltando; o que você já ajustou não muda.
            </p>
            <div class="item__acoes">
              <button
                appBotao
                type="button"
                variante="invertido"
                [carregando]="aplicandoModelo()"
                (click)="restaurarModelo()"
              >
                Restaurar o modelo
              </button>
              <button appBotao type="button" (click)="confirmandoModelo.set(false)">
                Cancelar
              </button>
            </div>
          </div>
        }

        @if (criterios()!.length === 0) {
          <app-estado-vazio
            titulo="Nenhum critério ainda"
            texto="Sem critérios, a IA conversa mas não qualifica ninguém. Restaure o modelo de captação de alunos ou crie o seu."
          />
        } @else {
          <ul
            class="lista"
            cdkDropList
            cdkDropListLockAxis="y"
            aria-label="Critérios de qualificação, na ordem em que a IA procura"
            [cdkDropListData]="criterios()"
            (cdkDropListDropped)="soltar($event)"
          >
            @for (c of criterios(); track c.id; let i = $index; let ultimo = $last) {
              <li class="item" cdkDrag cdkDragPreviewContainer="parent">
                <button
                  type="button"
                  class="alca"
                  cdkDragHandle
                  [attr.aria-label]="'Arrastar ' + c.rotulo"
                >
                  <svg lucideGripVertical [size]="16" aria-hidden="true" />
                </button>
                <div class="item__textos">
                  <strong>{{ c.rotulo }}</strong>
                  <span class="item__meta">
                    {{ tipo[c.tipo] }} · {{ destino(c) }} · peso {{ c.peso }}
                  </span>
                </div>
                @if (c.obrigatorio) {
                  <app-selo variante="coral" tamanho="sm">Obrigatório</app-selo>
                }
                @if (!c.ativo) {
                  <app-selo variante="neutro" tamanho="sm">Inativo</app-selo>
                }
                <div class="item__acoes">
                  <button
                    appBotaoIcone
                    type="button"
                    [icone]="iconeSobe"
                    [rotulo]="'Subir ' + c.rotulo"
                    tamanho="sm"
                    [disabled]="i === 0"
                    (click)="mover(i, i - 1)"
                  ></button>
                  <button
                    appBotaoIcone
                    type="button"
                    [icone]="iconeDesce"
                    [rotulo]="'Descer ' + c.rotulo"
                    tamanho="sm"
                    [disabled]="ultimo"
                    (click)="mover(i, i + 1)"
                  ></button>
                  <button
                    appBotao
                    type="button"
                    tamanho="sm"
                    [attr.aria-label]="'Editar ' + c.rotulo"
                    (click)="editar(c)"
                  >
                    Editar
                  </button>
                </div>
              </li>
            }
          </ul>
        }
      }
    </div>

    <app-modal
      [titulo]="editando() ? 'Editar critério' : 'Novo critério'"
      largura="lg"
      [aberto]="aberto()"
      (fechado)="fechar()"
    >
      <form class="formulario" (submit)="$event.preventDefault(); salvar()">
        <app-campo-texto
          rotulo="O que descobrir"
          dica="Por exemplo: Curso de interesse."
          [maximoCaracteres]="80"
          [erro]="erroDoCampo('rotulo')"
          [valor]="rotulo()"
          (valorChange)="mudarRotulo($event)"
        />
        @if (!editando()) {
          <app-campo-texto
            rotulo="Identificador"
            dica="Nome interno, sem acento. A IA e a API usam; não muda depois."
            [maximoCaracteres]="40"
            [erro]="erroDoCampo('chave')"
            [valor]="chave()"
            (valorChange)="mudarChave($event)"
          />
        }
        <app-area-texto
          rotulo="Instrução para a IA"
          dica="Como perceber e registrar essa informação na conversa."
          [linhas]="3"
          [maximoCaracteres]="600"
          [erro]="erroDoCampo('instrucao')"
          [(valor)]="instrucao"
        />
        <div class="grade">
          <app-seletor rotulo="Tipo da resposta" [opcoes]="tipos" [(valor)]="tipoEscolhido" />
          <app-campo-texto
            rotulo="Peso na nota (1 a 100)"
            tipo="number"
            [minimo]="1"
            [maximo]="100"
            [erro]="erroDoCampo('peso')"
            [(valor)]="peso"
          />
        </div>
        @if (tipoEscolhido() === 'OPCAO') {
          <app-area-texto
            rotulo="Opções"
            dica="Uma por linha, de 2 a 20."
            [linhas]="4"
            [erro]="erroDoCampo('opcoes')"
            [(valor)]="opcoes"
          />
        }
        <div class="grade">
          <app-seletor
            rotulo="Onde gravar a resposta"
            [opcoes]="alvos"
            [valor]="alvo()"
            (valorChange)="mudarAlvo($event)"
          />
          @if (alvo() !== 'NENHUM') {
            <app-seletor
              rotulo="Campo"
              [opcoes]="camposDoAlvo()"
              placeholder="Escolha o campo"
              dica="Inclui os campos personalizados que já existem."
              [erro]="erroDoCampo('campo')"
              [(valor)]="campo"
            />
          }
        </div>
        <app-alternador rotulo="Obrigatório para qualificar" [(valor)]="obrigatorio" />
        <app-alternador
          rotulo="Ativo"
          dica="Critério inativo não entra na conversa nem na nota."
          [(valor)]="ativo"
        />
        @if (erroLocal(); as problema) {
          <p class="erro" role="alert">{{ problema }}</p>
        }
        @if (erroSalvar(); as falha) {
          <p class="erro" role="alert">Não foi possível salvar. {{ falha.resumo }}</p>
        }
      </form>
      <div modal-rodape class="rodape-modal">
        @if (editando(); as atual) {
          @if (confirmandoExclusao()) {
            <button
              appBotao
              type="button"
              variante="destaque"
              [carregando]="salvando()"
              (click)="excluir(atual)"
            >
              Confirmar exclusão
            </button>
          } @else {
            <button appBotao type="button" (click)="confirmandoExclusao.set(true)">Excluir</button>
          }
        }
        <span class="espaco"></span>
        <button appBotao type="button" (click)="fechar()">Cancelar</button>
        <button
          appBotao
          type="button"
          variante="invertido"
          [carregando]="salvando()"
          (click)="salvar()"
        >
          Salvar critério
        </button>
      </div>
    </app-modal>
  `,
  styleUrl: './sdr-comum.scss',
  styles: `
    .alca {
      display: inline-grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: var(--raio-sm);
      background: transparent;
      color: var(--cor-texto-suave);
      cursor: grab;

      &:hover {
        background: var(--cor-superficie-3);
      }
    }

    .item.cdk-drag-preview {
      box-shadow: var(--sombra-2, 0 8px 24px rgb(0 0 0 / 0.2));
    }

    .item.cdk-drag-placeholder {
      opacity: 0.4;
    }

    .rodape-modal {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-3);
      width: 100%;
    }

    .espaco {
      flex: 1 1 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CriteriosSdr {
  private readonly api = inject(SdrConfigApi);
  private readonly avisos = inject(AvisosService);
  private readonly anunciador = inject(LiveAnnouncer);

  protected readonly iconeMais = LucidePlus;
  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly iconeModelo = LucideRotateCcw;
  protected readonly iconeSobe = LucideArrowUp;
  protected readonly iconeDesce = LucideArrowDown;
  protected readonly tipos = TIPOS;
  protected readonly alvos = ALVOS;
  protected readonly tipo = ROTULO_TIPO_CRITERIO;

  protected readonly criterios = signal<readonly CriterioSdr[] | null>(null);
  protected readonly campos = signal<CamposDisponiveis>({ contato: [], negocio: [] });
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly pesoTotal = computed(() =>
    (this.criterios() ?? []).filter((c) => c.ativo).reduce((soma, c) => soma + c.peso, 0),
  );
  protected readonly confirmandoModelo = signal(false);
  protected readonly aplicandoModelo = signal(false);

  // Formulário
  protected readonly aberto = signal(false);
  protected readonly editando = signal<CriterioSdr | null>(null);
  protected readonly rotulo = signal<string | number>('');
  protected readonly chave = signal<string | number>('');
  private chaveEditada = false;
  protected readonly instrucao = signal('');
  protected readonly tipoEscolhido = signal<TipoCriterio | null>('TEXTO');
  protected readonly opcoes = signal('');
  protected readonly alvo = signal<AlvoCriterio | null>('NENHUM');
  protected readonly campo = signal<string | null>(null);
  protected readonly peso = signal<string | number>(10);
  protected readonly obrigatorio = signal(false);
  protected readonly ativo = signal(true);
  protected readonly salvando = signal(false);
  protected readonly erroSalvar = signal<ErroApi | null>(null);
  protected readonly erroLocal = signal<string | null>(null);
  protected readonly confirmandoExclusao = signal(false);

  protected readonly camposDoAlvo = computed<readonly OpcaoSeletor<string>[]>(() => {
    const lista =
      this.alvo() === 'CONTATO'
        ? this.campos().contato
        : this.alvo() === 'NEGOCIO'
          ? this.campos().negocio
          : [];
    const itens = lista.map((c) => ({ valor: c.campo, rotulo: c.rotulo }));
    const atual = this.campo();
    return atual && !itens.some((i) => i.valor === atual)
      ? [...itens, { valor: atual, rotulo: atual }]
      : itens;
  });

  constructor() {
    void this.carregar();
  }

  protected destino(c: CriterioSdr): string {
    if (c.alvo === 'NENHUM' || !c.campo) {
      return ROTULO_ALVO.NENHUM.toLowerCase();
    }
    const lista = c.alvo === 'CONTATO' ? this.campos().contato : this.campos().negocio;
    const nome = lista.find((x) => x.campo === c.campo)?.rotulo ?? c.campo;
    return `${c.alvo === 'CONTATO' ? 'contato' : 'negócio'}: ${nome}`;
  }

  protected async carregar(): Promise<void> {
    this.erro.set(null);
    try {
      const [criterios, campos] = await Promise.all([
        this.api.criterios(),
        this.api.camposDisponiveis(),
      ]);
      this.criterios.set(criterios);
      this.campos.set(campos);
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    }
  }

  // Ordem ----------------------------------------------------------------------------------

  protected soltar(evento: CdkDragDrop<readonly CriterioSdr[] | null>): void {
    this.mover(evento.previousIndex, evento.currentIndex);
  }

  protected async mover(de: number, para: number): Promise<void> {
    const antes = this.criterios() ?? [];
    const depois = moverItem(antes, de, para);
    if (depois === antes) {
      return;
    }
    this.criterios.set(depois);
    this.anunciar(`${depois[para].rotulo} agora é o ${para + 1}º de ${depois.length}.`);
    try {
      await this.api.reordenarCriterios(depois.map((c) => c.id));
    } catch (falha) {
      this.criterios.set(antes);
      this.avisos.erro(falha);
    }
  }

  private anunciar(texto: string): void {
    void this.anunciador.announce(texto, 'polite');
  }

  // Modelo de captação -----------------------------------------------------------------------

  protected async restaurarModelo(): Promise<void> {
    this.aplicandoModelo.set(true);
    try {
      const { criados } = await this.api.aplicarModelo();
      await this.carregar();
      this.confirmandoModelo.set(false);
      this.avisos.sucesso(
        criados > 0
          ? `Modelo restaurado: ${criados} critério${criados > 1 ? 's' : ''} acrescentado${criados > 1 ? 's' : ''}.`
          : 'O modelo já estava completo: nada foi acrescentado.',
      );
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.aplicandoModelo.set(false);
    }
  }

  // Edição -----------------------------------------------------------------------------------

  protected novo(): void {
    this.editando.set(null);
    this.chaveEditada = false;
    this.preencher({
      rotulo: '',
      chave: '',
      instrucao: '',
      tipo: 'TEXTO',
      opcoes: [],
      alvo: 'NENHUM',
      campo: null,
      peso: 10,
      obrigatorio: false,
      ativo: true,
    });
  }

  protected editar(c: CriterioSdr): void {
    this.editando.set(c);
    this.preencher(c);
  }

  private preencher(c: {
    rotulo: string;
    chave: string;
    instrucao: string;
    tipo: TipoCriterio;
    opcoes: readonly string[];
    alvo: AlvoCriterio;
    campo: string | null;
    peso: number;
    obrigatorio: boolean;
    ativo: boolean;
  }): void {
    this.rotulo.set(c.rotulo);
    this.chave.set(c.chave);
    this.instrucao.set(c.instrucao);
    this.tipoEscolhido.set(c.tipo);
    this.opcoes.set(c.opcoes.join('\n'));
    this.alvo.set(c.alvo);
    this.campo.set(c.campo);
    this.peso.set(c.peso);
    this.obrigatorio.set(c.obrigatorio);
    this.ativo.set(c.ativo);
    this.erroSalvar.set(null);
    this.erroLocal.set(null);
    this.confirmandoExclusao.set(false);
    this.aberto.set(true);
  }

  protected fechar(): void {
    this.aberto.set(false);
  }

  protected mudarRotulo(valor: string | number | null): void {
    this.rotulo.set(valor ?? '');
    if (!this.editando() && !this.chaveEditada) {
      this.chave.set(chaveDoRotulo(textoOuNulo(valor)));
    }
  }

  protected mudarChave(valor: string | number | null): void {
    this.chaveEditada = true;
    this.chave.set(valor ?? '');
  }

  protected mudarAlvo(alvo: AlvoCriterio | null): void {
    if (alvo !== this.alvo()) {
      this.campo.set(null);
    }
    this.alvo.set(alvo);
  }

  protected async salvar(): Promise<void> {
    const alvo = this.alvo() ?? 'NENHUM';
    const tipo = this.tipoEscolhido() ?? 'TEXTO';
    const atual = this.editando();
    const dados = {
      rotulo: textoOuNulo(this.rotulo()),
      chave: textoOuNulo(this.chave()),
      instrucao: this.instrucao().trim(),
      tipo,
      opcoes: tipo === 'OPCAO' ? opcoesDoTexto(this.opcoes()) : [],
      alvo,
      campo: alvo === 'NENHUM' ? null : this.campo(),
      peso: inteiroDoCampo(this.peso()),
      novo: atual === null,
    };
    const impedimento = erroDoCriterio(dados);
    this.erroLocal.set(impedimento);
    if (impedimento) {
      return;
    }
    const corpo: CorpoCriterio = {
      rotulo: dados.rotulo,
      instrucao: dados.instrucao,
      tipo,
      opcoes: dados.opcoes,
      alvo,
      campo: dados.campo,
      peso: dados.peso ?? 10,
      obrigatorio: this.obrigatorio(),
      ativo: this.ativo(),
    };
    this.salvando.set(true);
    this.erroSalvar.set(null);
    try {
      const salvo = atual
        ? await this.api.atualizarCriterio(atual.id, corpo)
        : await this.api.criarCriterio({ ...corpo, chave: dados.chave });
      this.criterios.update((lista) => {
        const itens = lista ?? [];
        return atual ? itens.map((c) => (c.id === salvo.id ? salvo : c)) : [...itens, salvo];
      });
      this.avisos.sucesso('Critério salvo.');
      this.aberto.set(false);
    } catch (falha) {
      this.erroSalvar.set(erroDaApi(falha));
    } finally {
      this.salvando.set(false);
    }
  }

  protected async excluir(c: CriterioSdr): Promise<void> {
    this.salvando.set(true);
    try {
      await this.api.excluirCriterio(c.id);
      this.criterios.update((lista) => (lista ?? []).filter((x) => x.id !== c.id));
      this.avisos.sucesso('Critério excluído.');
      this.aberto.set(false);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.salvando.set(false);
    }
  }

  protected erroDoCampo(caminho: string): string | null {
    return this.erroSalvar()?.mensagemDoCampo(caminho) ?? null;
  }
}
