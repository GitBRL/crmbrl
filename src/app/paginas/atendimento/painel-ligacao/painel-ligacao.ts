import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  LucideCheck,
  LucideDownload,
  LucideDynamicIcon,
  LucideFileAudio,
  LucideRefreshCw,
  LucideSparkles,
  LucideTriangleAlert,
} from '@lucide/angular';

import { erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../../nucleo/confirmacao.service';
import { formatarData } from '../../../nucleo/formatos';
import { GravacaoApi, ROTAS_GRAVACAO } from '../../../nucleo/ligacoes/gravacao.api';
import type {
  SugestaoDeAtividade,
  TrechoDaTranscricao,
} from '../../../nucleo/ligacoes/gravacao.tipos';
import { SessaoService } from '../../../nucleo/sessao/sessao.service';
import { LigacoesApi } from '../../../nucleo/ligacoes/ligacoes.api';
import { formatarDuracao } from '../../../nucleo/ligacoes/ligacoes.textos';
import type { Ligacao } from '../../../nucleo/ligacoes/ligacoes.tipos';
import { TempoRealService } from '../../../nucleo/tempo-real/tempo-real.service';
import { Botao } from '../../../ui/botao/botao';
import { CampoBusca } from '../../../ui/campo-busca/campo-busca';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { Selo, type VarianteSelo } from '../../../ui/selo/selo';
import { Carregamento } from '../../configuracoes/carregamento';
import {
  destacarBusca,
  emProcessamento,
  marcaDeTempo,
  marcaFalada,
  ROTULO_FALANTE,
  ROTULO_SENTIMENTO,
  ROTULO_TIPO_SUGESTAO,
  trechoAtual,
  trechosEncontrados,
} from './painel-ligacao.logica';

const VARIANTE_SENTIMENTO: Record<string, VarianteSelo> = {
  positivo: 'menta',
  neutro: 'neutro',
  negativo: 'coral',
  misto: 'ciano',
};

/**
 * Painel de uma ligação (Onda E, E3): ouvir a gravação, ler a transcrição ("Atendente" e
 * "Cliente", com o tempo de cada trecho), buscar no texto, clicar num trecho para ouvir aquele
 * ponto, ver o resumo e criar as atividades sugeridas (com confirmação). Acompanha o
 * processamento ao vivo (`ligacao.processada`). Usado na tela de ligações e na linha do tempo.
 */
@Component({
  selector: 'app-painel-ligacao',
  imports: [LucideDynamicIcon, Botao, CampoBusca, Esqueleto, EstadoVazio, Selo],
  templateUrl: './painel-ligacao.html',
  styleUrl: './painel-ligacao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PainelLigacao {
  readonly ligacaoId = input.required<string>();

  private readonly api = inject(LigacoesApi);
  private readonly gravacaoApi = inject(GravacaoApi);
  private readonly sessao = inject(SessaoService);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly tempoReal = inject(TempoRealService);
  private readonly audio = viewChild<ElementRef<HTMLAudioElement>>('audio');

  protected readonly icones = {
    baixar: LucideDownload,
    audio: LucideFileAudio,
    tentar: LucideRefreshCw,
    sugestao: LucideSparkles,
    criada: LucideCheck,
    aviso: LucideTriangleAlert,
  };
  protected readonly rotuloFalante = ROTULO_FALANTE;
  protected readonly rotuloSentimento = ROTULO_SENTIMENTO;
  protected readonly rotuloTipo = ROTULO_TIPO_SUGESTAO;
  protected readonly marcaDeTempo = marcaDeTempo;
  protected readonly marcaFalada = marcaFalada;
  protected readonly destacar = destacarBusca;

  protected readonly carga = new Carregamento<Ligacao>();
  protected readonly busca = signal('');
  protected readonly segundos = signal(0);
  protected readonly reprocessando = signal(false);
  protected readonly criando = signal<string | null>(null);
  protected readonly descartando = signal<string | null>(null);
  /** Os trechos (`GET /ligacoes/:id/transcricao`), lidos quando a transcrição está pronta. */
  protected readonly leitura = signal<readonly TrechoDaTranscricao[]>([]);
  protected readonly erroDaTranscricao = signal<string | null>(null);
  protected readonly erroDoAudio = signal(false);

  protected readonly ligacao = this.carga.dados;
  protected readonly gravacao = computed(() => this.ligacao()?.gravacao ?? null);
  protected readonly transcricao = computed(() => this.ligacao()?.transcricao ?? null);
  protected readonly resumoDaLigacao = computed(() => this.ligacao()?.resumo ?? null);
  protected readonly urlDoAudio = computed(() => ROTAS_GRAVACAO.audio(this.ligacaoId()));
  protected readonly urlParaBaixar = computed(() => ROTAS_GRAVACAO.baixar(this.ligacaoId()));
  protected readonly trechos = this.leitura.asReadonly();
  protected readonly encontrados = computed(() => trechosEncontrados(this.trechos(), this.busca()));
  protected readonly visiveis = computed(() => {
    const trechos = this.trechos();
    return this.encontrados().map((indice) => ({ indice, trecho: trechos[indice]! }));
  });
  protected readonly atual = computed(() => trechoAtual(this.trechos(), this.segundos()));
  protected readonly resumo = computed(() => this.resumoDaLigacao()?.conteudo ?? null);
  protected readonly removida = computed(() => this.gravacao()?.removidaEm != null);
  protected readonly processando = computed(
    () =>
      emProcessamento(this.gravacao()?.situacao) ||
      emProcessamento(this.transcricao()?.situacao) ||
      emProcessamento(this.resumoDaLigacao()?.situacao),
  );
  /** Atendente da ligação, Admin e líderes (a API confere de novo). */
  protected readonly podeReprocessar = computed(() => {
    const g = this.gravacao();
    const ligacao = this.ligacao();
    if (!g || !ligacao || !g.disponivel || this.processando()) {
      return false;
    }
    return (
      this.sessao.ehAdmin() ||
      this.sessao.ehLider() ||
      (ligacao.atendente !== null && ligacao.atendente.id === this.sessao.usuario()?.id)
    );
  });
  protected readonly duracao = computed(() => formatarDuracao(this.gravacao()?.duracaoSegundos));

  constructor() {
    effect(() => {
      this.ligacaoId();
      untracked(() => {
        this.busca.set('');
        this.segundos.set(0);
        this.leitura.set([]);
        this.erroDaTranscricao.set(null);
        this.erroDoAudio.set(false);
        void this.carregar();
      });
    });
    const parar = [
      this.tempoReal.ouvir('ligacao.processada', (evento) => {
        if (evento.ligacaoId === this.ligacaoId()) {
          void this.carregar(true);
        }
      }),
      this.tempoReal.aoReconectar(() => void this.carregar(true)),
    ];
    inject(DestroyRef).onDestroy(() => parar.forEach((fn) => fn()));
  }

  protected async carregar(silencioso = false): Promise<boolean> {
    const id = this.ligacaoId();
    let ok: boolean;
    if (silencioso && this.carga.dados()) {
      // Sem piscar o esqueleto: troca os dados quando a resposta chegar.
      try {
        const ligacao = await this.api.detalhar(id);
        if (id === this.ligacaoId()) {
          this.carga.definir(ligacao);
        }
        ok = true;
      } catch {
        ok = false;
      }
    } else {
      ok = await this.carga.executar(() => this.api.detalhar(id));
    }
    if (ok && id === this.ligacaoId()) {
      await this.lerTranscricao(id);
    }
    return ok;
  }

  /** Lê os trechos quando a transcrição está pronta e a gravação ainda existe. */
  private async lerTranscricao(id: string): Promise<void> {
    const ligacao = this.carga.dados();
    if (ligacao?.transcricao?.situacao !== 'pronta' || ligacao.gravacao?.removidaEm) {
      this.leitura.set([]);
      this.erroDaTranscricao.set(null);
      return;
    }
    try {
      const dados = await this.gravacaoApi.transcricao(id);
      if (id === this.ligacaoId()) {
        this.leitura.set(dados.trechos);
        this.erroDaTranscricao.set(null);
      }
    } catch (falha) {
      if (id === this.ligacaoId()) {
        this.erroDaTranscricao.set(erroDaApi(falha).mensagem);
      }
    }
  }

  protected aoTocar(): void {
    this.segundos.set(this.audio()?.nativeElement.currentTime ?? 0);
  }

  protected irPara(trecho: TrechoDaTranscricao): void {
    const elemento = this.audio()?.nativeElement;
    if (!elemento || !this.gravacao()?.disponivel) {
      return;
    }
    elemento.currentTime = trecho.inicio;
    this.segundos.set(trecho.inicio);
    void elemento.play().catch(() => undefined);
  }

  protected varianteDoSentimento(sentimento: string): VarianteSelo {
    return VARIANTE_SENTIMENTO[sentimento] ?? 'neutro';
  }

  protected async reprocessar(): Promise<void> {
    if (this.reprocessando()) {
      return;
    }
    this.reprocessando.set(true);
    try {
      await this.gravacaoApi.reprocessar(this.ligacaoId());
      this.avisos.sucesso('A transcrição e o resumo foram para a fila.');
      await this.carregar(true);
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.reprocessando.set(false);
    }
  }

  protected async criarAtividade(sugestao: SugestaoDeAtividade): Promise<void> {
    const ligacao = this.ligacao();
    if (!ligacao || this.criando() !== null) {
      return;
    }
    const id = this.ligacaoId();
    this.criando.set(sugestao.id);
    try {
      const ok = await this.confirmacao.confirmar({
        titulo: 'Criar esta atividade?',
        mensagem: `“${sugestao.titulo}” será criada para você, ligada a ${ligacao.contato.nome}.`,
        detalhes: [
          `Tipo: ${this.rotuloTipo[sugestao.tipo]}`,
          `Prazo: em ${sugestao.prazoEmDias} ${sugestao.prazoEmDias === 1 ? 'dia' : 'dias'}`,
        ],
        confirmar: 'Criar atividade',
        executar: () => this.gravacaoApi.confirmarSugestao(id, sugestao.id),
      });
      if (ok) {
        this.avisos.sucesso('Atividade criada.');
        await this.carregar(true);
      }
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.criando.set(null);
    }
  }

  protected async descartarSugestao(sugestao: SugestaoDeAtividade): Promise<void> {
    if (this.descartando() !== null) {
      return;
    }
    this.descartando.set(sugestao.id);
    try {
      await this.gravacaoApi.descartarSugestao(this.ligacaoId(), sugestao.id);
      await this.carregar(true);
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.descartando.set(null);
    }
  }
}
