import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideCheck,
  LucideCircleDashed,
  LucideDynamicIcon,
  LucideInfo,
  LucideLockKeyhole,
} from '@lucide/angular';

import { moduloPorId } from '../../nucleo/navegacao';
import { listarPapeis, TODOS_OS_PAPEIS, type Papel } from '../../nucleo/papeis';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { Chip } from '../../ui/chip/chip';
import { Dica } from '../../ui/dica/dica';
import { Indicador } from '../../ui/indicador/indicador';
import { Selo } from '../../ui/selo/selo';
import { termosNoTexto } from './glossario';
import { FASES_ROADMAP, frasesNoAr, numeroDaFase } from './roadmap';

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
 * Se o papel do usuário não acessa o módulo, mostra o estado "sem acesso" e qual papel
 * acessa (a guarda da casca já leva quem não acessa para `/sem-acesso`; o estado fica de
 * reserva).
 */
@Component({
  selector: 'app-em-breve',
  imports: [
    RouterLink,
    LucideDynamicIcon,
    LucideCheck,
    LucideInfo,
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

  protected readonly perfil = inject(SessaoService);

  protected readonly icones = {
    voltar: LucideArrowLeft,
    planejado: LucideCircleDashed,
  };
  /** As fases do roadmap, com os termos do glossário de cada nome ("App mobile (PWA)"). */
  protected readonly fases = FASES_ROADMAP.map((fase) => ({
    ...fase,
    termos: termosNoTexto(fase.nome),
  }));
  protected readonly dicaRoadmap = `O CRM chega em fases. Cada fase libera um conjunto de módulos; ${frasesNoAr()}.`;
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
  protected readonly quemAcessa = computed(
    () => this.info()?.quemAcessa ?? descreverQuemAcessa(this.info()?.papeis ?? []),
  );
}
