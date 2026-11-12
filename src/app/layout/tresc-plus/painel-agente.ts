import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { LucideDynamicIcon, LucideHeadset, LucideRefreshCw } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { TrescPlusApi } from '../../nucleo/tresc-plus/tresc-plus.api';
import { TrescPlusService } from '../../nucleo/tresc-plus/tresc-plus.service';
import {
  cronometroFalado,
  formatarCronometro,
  segundosDesde,
  VISAO_DO_AGENTE,
} from '../../nucleo/tresc-plus/tresc-plus.textos';
import { usarRelogio } from '../../nucleo/tresc-plus/relogio';
import type {
  CampanhaTresc,
  ModoDoAgente,
  PausaTresc,
} from '../../nucleo/tresc-plus/tresc-plus.tipos';
import { Botao } from '../../ui/botao/botao';
import { Selo } from '../../ui/selo/selo';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { gerarId } from '../../ui/tipos';
import { fecharAoTocarFora } from '../suspenso';

const OPCOES_MODO: readonly OpcaoSeletor<ModoDoAgente>[] = [
  { valor: 'manual', rotulo: 'Manual (eu ligo)' },
  { valor: 'dialer', rotulo: 'Discador (o 3C+ liga)' },
];

/**
 * Painel do agente do 3C+ (R34.8), no canto da barra superior e só para quem está vinculado.
 * O botão mostra o estado com cor e texto (e o tempo nele); o painel traz a campanha, o modo,
 * a pausa com o retorno e o entrar/sair da campanha. Esc e clique fora fecham.
 */
@Component({
  selector: 'app-painel-agente',
  imports: [Botao, LucideDynamicIcon, Selo, Seletor],
  templateUrl: './painel-agente.html',
  styleUrl: './painel-agente.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'fechar(true)' },
})
export class PainelAgente {
  protected readonly tresc = inject(TrescPlusService);
  private readonly api = inject(TrescPlusApi);
  private readonly documento = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly botao = viewChild.required('botao', { read: ElementRef<HTMLButtonElement> });

  protected readonly icones = { agente: LucideHeadset, atualizar: LucideRefreshCw };
  protected readonly modos = OPCOES_MODO;
  protected readonly aberto = signal(false);
  protected readonly idPainel = gerarId('agente-painel');
  protected readonly idTitulo = gerarId('agente-titulo');

  protected readonly campanhas = signal<readonly CampanhaTresc[] | null>(null);
  protected readonly pausas = signal<readonly PausaTresc[] | null>(null);
  protected readonly erroListas = signal<string | null>(null);
  protected readonly carregandoListas = signal(false);
  protected readonly campanhaEscolhida = signal<number | null>(null);
  protected readonly modoEscolhido = signal<ModoDoAgente | null>('manual');
  protected readonly pausaEscolhida = signal<number | null>(null);

  protected readonly estado = computed(() => this.tresc.agente()?.estado ?? 'desconectado');
  protected readonly visao = computed(() => VISAO_DO_AGENTE[this.estado()]);
  protected readonly relogio = usarRelogio(
    () => this.tresc.vinculado() && this.estado() !== 'desconectado',
  );
  protected readonly segundos = computed(() =>
    segundosDesde(this.tresc.agente()?.desde ?? null, this.relogio()),
  );
  protected readonly tempo = computed(() => formatarCronometro(this.segundos()));
  protected readonly tempoFalado = computed(() => cronometroFalado(this.segundos()));
  protected readonly dentro = computed(() => this.estado() !== 'desconectado');
  protected readonly rotuloBotao = computed(() => {
    const visao = this.visao();
    const campanha = this.tresc.agente()?.campanha?.nome;
    return `Agente 3C+: ${visao.rotulo}${campanha ? `, ${campanha}` : ''}`;
  });
  protected readonly opcoesCampanha = computed<readonly OpcaoSeletor<number>[]>(() =>
    (this.campanhas() ?? []).map((c) => ({
      valor: c.id,
      rotulo: c.pausada ? `${c.nome} (pausada)` : c.nome,
    })),
  );
  protected readonly opcoesPausa = computed<readonly OpcaoSeletor<number>[]>(() =>
    (this.pausas() ?? []).map((p) => ({
      valor: p.id,
      rotulo: p.minutos ? `${p.nome} (${p.minutos} min)` : p.nome,
    })),
  );
  protected readonly podeSair = computed(
    () => !['em_ligacao', 'pos_atendimento'].includes(this.estado()),
  );
  protected readonly podePausar = computed(() => ['ocioso', 'manual'].includes(this.estado()));

  private pararDeOuvir: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pararDeOuvir?.());
    // A campanha padrão da empresa vem escolhida.
    effect(() => {
      const padrao = this.tresc.agente()?.campanhaPadrao?.id ?? null;
      untracked(() => {
        if (this.campanhaEscolhida() === null && padrao !== null) {
          this.campanhaEscolhida.set(padrao);
        }
      });
    });
  }

  protected alternar(): void {
    if (this.aberto()) {
      this.fechar(false);
      return;
    }
    this.aberto.set(true);
    this.pararDeOuvir = fecharAoTocarFora(this.documento, this.host, () => this.fechar(false));
    void this.tresc.carregar(true);
    void this.carregarListas();
  }

  protected fechar(devolverFoco: boolean): void {
    if (!this.aberto()) {
      return;
    }
    this.aberto.set(false);
    this.pararDeOuvir?.();
    this.pararDeOuvir = null;
    if (devolverFoco) {
      this.botao().nativeElement.focus();
    }
  }

  protected async carregarListas(): Promise<void> {
    this.carregandoListas.set(true);
    this.erroListas.set(null);
    try {
      const [campanhas, pausas] = await Promise.all([
        this.api.campanhasDoAgente(),
        this.api.pausas(),
      ]);
      this.campanhas.set(campanhas);
      this.pausas.set(pausas);
    } catch (falha) {
      this.erroListas.set(erroDaApi(falha).mensagem);
    } finally {
      this.carregandoListas.set(false);
    }
  }

  protected entrar(): void {
    void this.tresc.entrarNaCampanha(
      this.campanhaEscolhida() ?? undefined,
      this.modoEscolhido() ?? undefined,
    );
  }

  protected async entrarNaPausa(): Promise<void> {
    const id = this.pausaEscolhida();
    if (id !== null && (await this.tresc.entrarNaPausa(id))) {
      this.pausaEscolhida.set(null);
    }
  }

  protected qualificarAgora(): void {
    const pendente = this.tresc.qualificacaoPendente();
    if (pendente) {
      this.tresc.pedirQualificacao(pendente.ligacaoId, pendente.campanhaId);
      this.fechar(false);
    }
  }
}
