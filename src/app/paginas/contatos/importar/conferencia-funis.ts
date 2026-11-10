import { CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideGripVertical,
  LucidePlus,
  LucideTrash2,
} from '@lucide/angular';

import { erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { type Area, AREAS, ROTULO_AREA } from '../../../nucleo/sessao/perfil';
import { SessaoService } from '../../../nucleo/sessao/sessao.service';
import { Botao } from '../../../ui/botao/botao';
import { CampoTexto } from '../../../ui/campo-texto/campo-texto';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { Modal } from '../../../ui/modal/modal';
import { Selo } from '../../../ui/selo/selo';
import { Seletor, type OpcaoSeletor } from '../../../ui/seletor/seletor';
import type { Funil } from '../../funis/funis.tipos';
import { podeConfigurarFunil } from '../../funis/regras-funis';
import { ImportarApi } from './importar.api';
import {
  type EtapaDaPlanilha,
  type FunilDaPlanilha,
  type FunisDaPlanilha,
  linhasSemDestino,
  resumoPorStatus,
} from './importar.tipos';

interface EtapaNova {
  readonly chave: number;
  readonly nome: string;
}

const PROBLEMA_FUNIL: Readonly<Record<NonNullable<FunilDaPlanilha['problema']>, string>> = {
  NAO_ENCONTRADO: 'Não existe um funil com esse nome. Escolha um funil ou crie um novo.',
  ARQUIVADO: 'O funil com esse nome está arquivado e não recebe negócios. Escolha outro.',
  SEM_PERMISSAO: 'Você não tem acesso ao funil com esse nome. Escolha outro.',
};

/**
 * Conferência de funis e etapas de uma planilha de outro sistema (ex.: Clint): mostra onde
 * cada funil e etapa citados vão cair no CRM e deixa traduzir ou criar o que falta.
 */
@Component({
  selector: 'app-conferencia-funis',
  imports: [
    Botao,
    CampoTexto,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    Esqueleto,
    Modal,
    Selo,
    Seletor,
    LucideArrowDown,
    LucideArrowUp,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideGripVertical,
    LucidePlus,
    LucideTrash2,
  ],
  templateUrl: './conferencia-funis.html',
  styleUrl: './conferencia-funis.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConferenciaFunis {
  private readonly api = inject(ImportarApi);
  private readonly avisos = inject(AvisosService);
  private readonly sessao = inject(SessaoService);

  readonly dados = input<FunisDaPlanilha | null>(null);
  readonly carregando = input(false);
  readonly erro = input<string | null>(null);
  readonly funis = input<readonly Funil[]>([]);

  readonly usarFunil = output<{ valor: string; funilId: string | null }>();
  readonly usarEtapa = output<{ funilId: string; valor: string; etapaId: string | null }>();
  /** Funil criado (ou etapa criada em funil que já existia): a tela atualiza a lista e confere de novo. */
  readonly funilCriado = output<{ valor: string | null; funil: Funil }>();
  readonly tentarDeNovo = output<void>();

  protected readonly rotuloArea = ROTULO_AREA;
  protected readonly semDestino = computed(() => linhasSemDestino(this.dados()));
  protected readonly resumo = resumoPorStatus;
  protected readonly problemaDoFunil = PROBLEMA_FUNIL;

  /** Só funis ativos: é nos que a pessoa pode criar negócios. */
  protected readonly opcoesFunil = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.funis()
      .filter((f) => f.ativo)
      .map((f) => ({ valor: f.id, rotulo: f.nome })),
  );

  private readonly areasQuePodeConfigurar = computed<readonly Area[]>(() => {
    const perfil = this.sessao.perfil();
    return AREAS.filter((a) => podeConfigurarFunil(perfil, a));
  });
  protected readonly podeCriarFunil = computed(() => this.areasQuePodeConfigurar().length > 0);
  protected readonly opcoesArea = computed<readonly OpcaoSeletor<Area>[]>(() =>
    this.areasQuePodeConfigurar().map((valor) => ({ valor, rotulo: ROTULO_AREA[valor] })),
  );

  // Modal "Criar funil"
  protected readonly modalAberto = signal(false);
  protected readonly funilEmCriacao = signal<FunilDaPlanilha | null>(null);
  protected readonly nomeNovo = signal('');
  protected readonly areaNova = signal<Area | null>(null);
  protected readonly etapasNovas = signal<readonly EtapaNova[]>([]);
  protected readonly criando = signal(false);
  protected readonly erroModal = signal<string | null>(null);
  protected readonly criandoEtapa = signal<string | null>(null);
  private chave = 0;

  protected readonly modalOk = computed(
    () => this.nomeNovo().trim() !== '' && !!this.areaNova() && this.etapasNovas().length > 0,
  );

  protected podeConfigurar(area: string): boolean {
    return this.areasQuePodeConfigurar().includes(area as Area);
  }

  protected opcoesEtapa(funil: FunilDaPlanilha): readonly OpcaoSeletor<string>[] {
    const completo = this.funis().find((f) => f.id === funil.funil?.id);
    return (completo?.etapas ?? [])
      .filter((e) => e.tipo === 'ABERTA')
      .map((e) => ({ valor: e.id, rotulo: e.nome }));
  }

  protected textoEtapa(etapa: EtapaDaPlanilha): string {
    if (etapa.problema === 'ETAPA_DE_PERDA') {
      return 'Esta é uma etapa de perda: negócios abertos não entram nela. Escolha outra etapa.';
    }
    if (etapa.problema === 'NAO_ENCONTRADA') {
      return 'Não existe uma etapa com esse nome neste funil.';
    }
    return etapa.como === 'TRADUCAO'
      ? `Vai para a etapa “${etapa.etapa?.nome}” (escolhida por você).`
      : `Vai para a etapa “${etapa.etapa?.nome}”.`;
  }

  // ----- Criar funil --------------------------------------------------------------------------

  protected abrirCriarFunil(funil: FunilDaPlanilha): void {
    this.funilEmCriacao.set(funil);
    this.nomeNovo.set(funil.valor);
    const areas = this.areasQuePodeConfigurar();
    this.areaNova.set(areas.includes('COMERCIAL') ? 'COMERCIAL' : (areas[0] ?? null));
    const nomes = funil.etapas.map((e) => e.valor.trim()).filter((n) => n !== '');
    this.etapasNovas.set(
      (nomes.length > 0 ? nomes : ['Novo']).map((nome) => ({ chave: ++this.chave, nome })),
    );
    this.erroModal.set(null);
    this.modalAberto.set(true);
  }

  protected soltar(evento: CdkDragDrop<readonly EtapaNova[]>): void {
    this.mover(evento.previousIndex, evento.currentIndex);
  }

  protected mover(de: number, para: number): void {
    const lista = [...this.etapasNovas()];
    if (para < 0 || para >= lista.length || de === para) {
      return;
    }
    const [item] = lista.splice(de, 1);
    lista.splice(para, 0, item);
    this.etapasNovas.set(lista);
  }

  protected remover(chave: number): void {
    this.etapasNovas.update((l) => l.filter((e) => e.chave !== chave));
  }

  protected async confirmarCriarFunil(): Promise<void> {
    const origem = this.funilEmCriacao();
    const area = this.areaNova();
    if (!origem || !area || !this.modalOk() || this.criando()) {
      return;
    }
    this.criando.set(true);
    this.erroModal.set(null);
    try {
      const funil = await this.api.criarFunil({
        nome: this.nomeNovo().trim(),
        area,
        etapas: [
          ...this.etapasNovas().map((e) => ({ nome: e.nome.trim(), tipo: 'ABERTA' as const })),
          { nome: 'Ganho', tipo: 'GANHO' as const },
          { nome: 'Perdido', tipo: 'PERDIDO' as const },
        ],
      });
      this.modalAberto.set(false);
      this.funilCriado.emit({ valor: origem.valor, funil });
      this.avisos.sucesso(`Funil “${funil.nome}” criado.`);
    } catch (falha) {
      this.erroModal.set(erroDaApi(falha).resumo);
    } finally {
      this.criando.set(false);
    }
  }

  // ----- Criar etapa --------------------------------------------------------------------------

  protected async criarEtapa(funil: FunilDaPlanilha, etapa: EtapaDaPlanilha): Promise<void> {
    if (!funil.funil || this.criandoEtapa()) {
      return;
    }
    this.criandoEtapa.set(etapa.valor);
    try {
      const atualizado = await this.api.criarEtapa(funil.funil.id, etapa.valor.trim());
      this.funilCriado.emit({ valor: null, funil: atualizado });
      this.avisos.sucesso(`Etapa “${etapa.valor.trim()}” criada em ${atualizado.nome}.`);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.criandoEtapa.set(null);
    }
  }
}
