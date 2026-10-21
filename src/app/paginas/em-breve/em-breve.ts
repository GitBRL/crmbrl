import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideCheck,
  LucideCircleDashed,
  LucideDynamicIcon,
  LucideEye,
  LucideFlaskConical,
  LucideInfo,
  LucideLockKeyhole,
} from '@lucide/angular';

import { moduloPorId } from '../../nucleo/navegacao';
import { listarPapeis, ROTULO_PAPEL, TODOS_OS_PAPEIS, type Papel } from '../../nucleo/papeis';
import { PerfilDemoService } from '../../nucleo/perfil-demo.service';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { Chip } from '../../ui/chip/chip';
import { Dica } from '../../ui/dica/dica';
import { Indicador } from '../../ui/indicador/indicador';
import { Selo } from '../../ui/selo/selo';
import { termosNoTexto } from './glossario';
import { FASES_ROADMAP, numeroDaFase } from './roadmap';

/**
 * "Todos os papéis, menos Marketing" quando faltam só um ou dois papéis; senão, a lista
 * ("Admin, C-level e Líder Comercial").
 */
export function descreverQuemAcessa(papeis: readonly Papel[]): string {
  const ausentes = TODOS_OS_PAPEIS.filter((papel) => !papeis.includes(papel));
  if (ausentes.length === 0) {
    return 'todos os papéis';
  }
  if (ausentes.length <= 2) {
    return `todos os papéis, menos ${listarPapeis(ausentes)}`;
  }
  return listarPapeis(papeis);
}

/**
 * Página genérica de módulo "em breve". Lê o módulo de `nucleo/navegacao.ts` pelo id que vem
 * da rota (`data.modulo` → input `modulo`) e mostra, no palco: ícone grande, título em dois
 * tons, a descrição, a fase do roadmap e as funcionalidades planejadas (chips). Siglas e
 * termos que não se explicam sozinhos (UTM, MQL, kanban…) ganham uma dica ao lado do chip.
 *
 * Se a persona do modo demonstração não acessa o módulo, mostra o estado "sem acesso": qual
 * papel acessa e um atalho para ver o CRM como esse papel.
 */
@Component({
  selector: 'app-em-breve',
  imports: [
    RouterLink,
    LucideDynamicIcon,
    LucideCheck,
    LucideInfo,
    LucideFlaskConical,
    LucideLockKeyhole,
    Botao,
    Cartao,
    Chip,
    Dica,
    Indicador,
    Selo,
  ],
  templateUrl: './em-breve.html',
  styleUrl: './em-breve.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmBreve {
  /** Id do módulo (de `nucleo/navegacao.ts`), vindo de `data.modulo` da rota. */
  readonly modulo = input<string>();

  protected readonly perfil = inject(PerfilDemoService);
  private readonly injector = inject(Injector);
  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');

  protected readonly icones = {
    voltar: LucideArrowLeft,
    planejado: LucideCircleDashed,
    ver: LucideEye,
  };
  /** As fases do roadmap, com os termos do glossário de cada nome ("App mobile (PWA)"). */
  protected readonly fases = FASES_ROADMAP.map((fase) => ({
    ...fase,
    termos: termosNoTexto(fase.nome),
  }));
  protected readonly info = computed(() => moduloPorId(this.modulo()));
  /** As funcionalidades planejadas, cada uma com os termos do glossário que ela cita. */
  protected readonly funcionalidades = computed(() =>
    (this.info()?.funcionalidades ?? []).map((texto) => ({ texto, termos: termosNoTexto(texto) })),
  );
  protected readonly temAcesso = computed(() => {
    const modulo = this.info();
    return modulo ? this.perfil.pode(modulo) : false;
  });
  protected readonly fase = computed(() => numeroDaFase(this.info()?.fase));
  protected readonly quemAcessa = computed(() => descreverQuemAcessa(this.info()?.papeis ?? []));
  /** Papel sugerido no "sem acesso": o primeiro que acessa o módulo. */
  protected readonly papelSugerido = computed<Papel | null>(() => this.info()?.papeis[0] ?? null);
  protected readonly rotuloPapel = ROTULO_PAPEL;

  /** Troca a persona e leva o foco ao título (o botão some com o estado "sem acesso"). */
  protected verComo(papel: Papel): void {
    this.perfil.verComo(papel);
    afterNextRender(() => this.titulo()?.nativeElement.focus(), { injector: this.injector });
  }
}
