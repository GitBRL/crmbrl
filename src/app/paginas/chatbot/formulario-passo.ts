import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LucidePlus, LucideTrash2 } from '@lucide/angular';

import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Alternador } from '../../ui/alternador/alternador';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Botao } from '../../ui/botao/botao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import type { PassoDefinicao } from './chatbot.tipos';
import { ContextoEditor } from './contexto-editor';
import {
  alternarRamoExtra,
  cabecalhosParaTexto,
  comConfig,
  contarPassos,
  corpoParaTexto,
  etiquetasAAdicionar,
  listaParaTexto,
  MAXIMO_DE_OPCOES,
  MINIMO_DE_OPCOES,
  novaOpcao,
  opcoesDaPergunta,
  RAMO_INVALIDA,
  RAMO_SEM_RESPOSTA,
  sincronizarRamosDaPergunta,
  temRamoExtra,
  texto,
  textoParaCabecalhos,
  textoParaCorpo,
  textoParaLista,
} from './definicao';

const VALIDACOES: readonly OpcaoSeletor<string>[] = [
  { valor: 'texto', rotulo: 'Qualquer texto' },
  { valor: 'email', rotulo: 'E-mail' },
  { valor: 'telefone', rotulo: 'Telefone' },
  { valor: 'numero', rotulo: 'Número' },
  { valor: 'data', rotulo: 'Data (dd/mm/aaaa)' },
];

const CAMPOS_DO_CONTATO: readonly OpcaoSeletor<string>[] = [
  { valor: 'nome', rotulo: 'Nome' },
  { valor: 'email', rotulo: 'E-mail' },
  { valor: 'telefone', rotulo: 'Telefone' },
  { valor: 'cargo', rotulo: 'Cargo' },
  { valor: 'campos', rotulo: 'Outro campo personalizado' },
];

const UNIDADES: readonly OpcaoSeletor<string>[] = [
  { valor: 'minutos', rotulo: 'minutos' },
  { valor: 'horas', rotulo: 'horas' },
  { valor: 'dias', rotulo: 'dias' },
];

const TIPOS_ATIVIDADE: readonly OpcaoSeletor<string>[] = [
  { valor: 'TAREFA', rotulo: 'Tarefa' },
  { valor: 'LIGACAO', rotulo: 'Ligação' },
  { valor: 'REUNIAO', rotulo: 'Reunião' },
  { valor: 'EMAIL', rotulo: 'E-mail' },
  { valor: 'WHATSAPP', rotulo: 'WhatsApp' },
];

const PRIORIDADES: readonly OpcaoSeletor<string>[] = [
  { valor: 'BAIXA', rotulo: 'Baixa' },
  { valor: 'MEDIA', rotulo: 'Média' },
  { valor: 'ALTA', rotulo: 'Alta' },
];

const DICA_VARIAVEIS =
  'Dá para usar {{contato.primeiro_nome}} e as respostas já dadas, como {{variaveis.assunto}}.';

/**
 * Campos de um passo do fluxo (a parte aberta do cartão), por tipo. Não guarda estado do passo:
 * recebe o passo e devolve o passo novo em `(mudou)`.
 */
@Component({
  selector: 'app-formulario-passo',
  imports: [NgTemplateOutlet, Alternador, AreaTexto, Botao, BotaoIcone, CampoTexto, Seletor],
  templateUrl: './formulario-passo.html',
  styleUrl: './formulario-passo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioPasso {
  private readonly confirmacao = inject(ConfirmacaoService);
  protected readonly contexto = inject(ContextoEditor);

  readonly passo = input.required<PassoDefinicao>();
  readonly somenteLeitura = input(false);
  readonly mudou = output<PassoDefinicao>();

  protected readonly iconeMais = LucidePlus;
  protected readonly iconeLixeira = LucideTrash2;
  protected readonly dicaVariaveis = DICA_VARIAVEIS;
  protected readonly dicaNomeVariavel =
    'Um nome curto, sem espaços. Use depois como {{variaveis.nome}}.';
  protected readonly validacoes = VALIDACOES;
  protected readonly camposDoContato = CAMPOS_DO_CONTATO;
  protected readonly unidades = UNIDADES;
  protected readonly tiposAtividade = TIPOS_ATIVIDADE;
  protected readonly prioridades = PRIORIDADES;
  protected readonly maximoDeOpcoes = MAXIMO_DE_OPCOES;

  private readonly corpoBruto = signal<string | null>(null);
  protected readonly erroDoCorpo = signal<string | null>(null);

  protected readonly config = computed(() => this.passo().config ?? {});
  protected readonly opcoes = computed(() => opcoesDaPergunta(this.passo()));
  protected readonly tempo = computed(
    () => (this.config()['tempoSemResposta'] as Record<string, unknown> | undefined) ?? {},
  );
  protected readonly funis = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.contexto.funis().map((f) => ({ valor: f.id, rotulo: f.nome })),
  );
  protected readonly etapas = computed<readonly OpcaoSeletor<string>[]>(() => {
    const funil = this.contexto.funis().find((f) => f.id === this.config()['funilId']);
    return (funil?.etapas ?? []).map((e) => ({ valor: e.id, rotulo: e.nome }));
  });
  protected readonly variaveisSugeridas = computed(() => {
    const lista = this.contexto.variaveis();
    return lista.length > 0 ? `Já existem: ${lista.join(', ')}.` : null;
  });
  protected readonly textoCorpo = computed(
    () => this.corpoBruto() ?? corpoParaTexto(this.config()['corpo']),
  );
  protected readonly temSemResposta = computed(() => temRamoExtra(this.passo(), RAMO_SEM_RESPOSTA));
  protected readonly temInvalida = computed(() => temRamoExtra(this.passo(), RAMO_INVALIDA));
  protected readonly campoContatoAtual = computed(() => {
    const valor = texto(this.config()['campoContato']);
    return valor.startsWith('campos') ? 'campos' : valor || null;
  });
  protected readonly chaveDoCampoPersonalizado = computed(() =>
    texto(this.config()['campoContato']).replace(/^campos\.?/, ''),
  );

  protected texto(chave: string): string {
    const valor = this.config()[chave];
    return typeof valor === 'string'
      ? valor
      : valor === undefined || valor === null
        ? ''
        : String(valor);
  }

  protected valorDoTempo(chave: string): string | number {
    const valor = this.tempo()[chave];
    return typeof valor === 'number' || typeof valor === 'string' ? valor : '';
  }

  protected numero(chave: string): string | number {
    const valor = this.config()[chave];
    return typeof valor === 'number' ? valor : '';
  }

  protected lista(chave: string): string {
    return chave === 'adicionar'
      ? etiquetasAAdicionar(this.config()).join(', ')
      : listaParaTexto(this.config()[chave]);
  }

  protected cabecalhos(): string {
    return cabecalhosParaTexto(this.config()['cabecalhos']);
  }

  protected mudar(mudancas: Record<string, unknown>): void {
    this.mudou.emit(comConfig(this.passo(), mudancas));
  }

  protected mudarTexto(chave: string, valor: unknown): void {
    const texto = typeof valor === 'string' ? valor : valor === null ? '' : String(valor);
    this.mudar({ [chave]: texto === '' ? undefined : texto });
  }

  protected mudarNumero(chave: string, valor: unknown): void {
    const n = valor === '' || valor === null ? NaN : Number(valor);
    this.mudar({ [chave]: Number.isFinite(n) ? n : undefined });
  }

  protected mudarLista(chave: string, valor: unknown): void {
    this.mudar({
      [chave]: textoParaLista(String(valor ?? '')),
      ...(chave === 'adicionar' ? { etiquetas: undefined } : {}),
    });
  }

  protected mudarCabecalhos(valor: string): void {
    const cabecalhos = textoParaCabecalhos(valor);
    this.mudar({ cabecalhos: Object.keys(cabecalhos).length > 0 ? cabecalhos : undefined });
  }

  protected mudarCorpo(valor: string): void {
    this.corpoBruto.set(valor);
    const corpo = textoParaCorpo(valor);
    if (corpo === null) {
      this.erroDoCorpo.set('O conteúdo precisa ser um JSON válido, como {"campo": "valor"}.');
      return;
    }
    this.erroDoCorpo.set(null);
    this.mudar({ corpo });
  }

  protected mudarTempo(chave: string, valor: unknown, numerico: boolean): void {
    const atual: Record<string, unknown> = { ...this.tempo() };
    if (numerico) {
      const n = valor === '' || valor === null ? NaN : Number(valor);
      atual[chave] = Number.isFinite(n) && n > 0 ? n : undefined;
    } else {
      atual[chave] = String(valor ?? '').trim() === '' ? undefined : String(valor);
    }
    const limpo = Object.fromEntries(Object.entries(atual).filter(([, v]) => v !== undefined));
    this.mudar({ tempoSemResposta: Object.keys(limpo).length > 0 ? limpo : undefined });
  }

  protected mudarCampoContato(valor: string | null): void {
    this.mudar({ campoContato: valor === 'campos' ? 'campos.' : (valor ?? undefined) });
  }

  protected mudarChaveDoCampo(chave: string): void {
    this.mudar({ campoContato: `campos.${chave.trim()}` });
  }

  // ----- opções da pergunta -----

  private emitirOpcoes(opcoes: { id: string; rotulo: string }[]): void {
    this.mudou.emit(sincronizarRamosDaPergunta(comConfig(this.passo(), { opcoes })));
  }

  protected mudarOpcao(indice: number, rotulo: unknown): void {
    this.emitirOpcoes(
      this.opcoes().map((o, i) => (i === indice ? { ...o, rotulo: String(rotulo ?? '') } : o)),
    );
  }

  protected adicionarOpcao(): void {
    if (this.opcoes().length < MAXIMO_DE_OPCOES) {
      this.emitirOpcoes([...this.opcoes(), novaOpcao()]);
    }
  }

  protected async removerOpcao(indice: number): Promise<void> {
    if (this.opcoes().length <= MINIMO_DE_OPCOES) {
      return;
    }
    const opcao = this.opcoes()[indice];
    const ramo = this.passo().ramos?.find((r) => r.id === opcao.id);
    if (ramo && contarPassos(ramo.passos) > 0) {
      const ok = await this.confirmacao.confirmar({
        titulo: 'Remover esta opção?',
        mensagem: `Os ${contarPassos(ramo.passos)} passos do caminho “${opcao.rotulo || 'sem nome'}” também serão removidos.`,
        confirmar: 'Remover opção',
        perigo: true,
      });
      if (!ok) {
        return;
      }
    }
    this.emitirOpcoes(this.opcoes().filter((_, i) => i !== indice));
  }

  protected alternarExtra(
    id: typeof RAMO_SEM_RESPOSTA | typeof RAMO_INVALIDA,
    ligado: boolean,
  ): void {
    this.mudou.emit(alternarRamoExtra(this.passo(), id, ligado));
  }

  protected readonly RAMO_SEM_RESPOSTA = RAMO_SEM_RESPOSTA;
  protected readonly RAMO_INVALIDA = RAMO_INVALIDA;

  protected mudarFunil(funilId: string | null): void {
    this.mudar({ funilId: funilId ?? undefined, etapaId: undefined });
  }
}
