import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideLock, LucideRefreshCw } from '@lucide/angular';

import type { ErroApi } from '../../nucleo/api/erro-api';
import { formatarData, formatarMoeda, tempoNaEtapa } from '../../nucleo/formatos';
import { type Area } from '../../nucleo/sessao/perfil';
import {
  CHAVES_BASE,
  compararNaJornada,
  nomeDoSetor,
  slugDaArea,
} from '../../nucleo/setores/setores';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { Dica } from '../../ui/dica/dica';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Selo, type VarianteSelo } from '../../ui/selo/selo';
import {
  montarJornada,
  type NegocioRelacionado,
  ROTULO_STATUS_NEGOCIO,
  type StatusNegocio,
  type VinculoDaJornada,
} from './contatos.tipos';

const VARIANTE_STATUS: Readonly<Record<StatusNegocio, VarianteSelo>> = {
  ABERTO: 'neutro',
  GANHO: 'menta',
  PERDIDO: 'contorno',
};

/** Cor de cada setor na jornada, na ordem das séries de dado (ciano → menta → lima). */
const DADO_DA_AREA: Readonly<Record<Area, string>> = {
  MARKETING: 'var(--dado-1)',
  COMERCIAL: 'var(--dado-2)',
  CS: 'var(--dado-3)',
};

/**
 * Aba "Negócios" do detalhe (TELAS-FASE1 §4): os negócios do contato (ou da empresa) em todos
 * os funis que a pessoa vê, na ordem da jornada Marketing → Comercial → Customer Success, com
 * os vínculos das passagens ("Veio de" / "Gerou", R5.7) e o link para cada um no funil.
 */
@Component({
  selector: 'app-negocios-relacionados',
  imports: [Avatar, Botao, Dica, Esqueleto, EstadoVazio, LucideLock, RouterLink, Selo],
  templateUrl: './negocios-relacionados.html',
  styleUrl: './negocios-relacionados.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NegociosRelacionados {
  readonly negocios = input<readonly NegocioRelacionado[]>([]);
  readonly carregando = input(false);
  readonly erro = input<ErroApi | null>(null);
  /** De quem são: muda os textos ("a pessoa" / "a empresa"). */
  readonly dono = input<'contato' | 'empresa'>('contato');
  readonly tentarDeNovo = output<void>();

  private readonly sessao = inject(SessaoService);

  protected readonly icones = { tentar: LucideRefreshCw };
  protected readonly rotuloArea = nomeDoSetor;
  protected readonly rotuloStatus = ROTULO_STATUS_NEGOCIO;
  protected readonly varianteStatus = VARIANTE_STATUS;
  protected readonly dadoDaArea = DADO_DA_AREA;
  protected readonly formatarData = formatarData;
  protected readonly tempoNaEtapa = tempoNaEtapa;

  /** Sem centavos, como no quadro e no detalhe do negócio ("R$ 1.200"). */
  protected moeda(valor: string): string {
    return formatarMoeda(valor, { centavos: false });
  }

  /** "R$ 300" por mês; nada quando não há (ou é zero), como no cartão do quadro. */
  protected recorrente(negocio: NegocioRelacionado): string | null {
    const mensal = negocio.valorRecorrente;
    return mensal && Number(mensal) > 0 ? this.moeda(mensal) : null;
  }

  protected readonly jornada = computed(() => montarJornada(this.negocios()));

  /** Áreas cujos funis o papel vê (sem o perfil, todas). */
  private readonly areasVisiveis = computed(
    () => new Set<Area>(this.sessao.permissoes()?.areasVisiveis ?? CHAVES_BASE),
  );

  /** Membro: vê só os próprios negócios e os sem responsável (R5.9) — dito fora do balão. */
  protected readonly notaDoMembro = computed(() =>
    this.sessao.usuario()?.nivel === 'MEMBRO'
      ? 'Você vê só os seus negócios e os sem responsável.'
      : null,
  );

  /**
   * Quantos negócios em cada etapa da jornada (para a faixa do topo). Área que o papel não
   * vê fica "sem acesso" (e não "nenhum": pode haver negócios lá).
   */
  protected readonly etapas = computed(() => {
    // Os três setores de base sempre aparecem; os demais, quando têm negócios do contato.
    const areas = new Set<string>(CHAVES_BASE);
    this.negocios().forEach((negocio) => areas.add(negocio.funil.area));
    return [...areas].sort(compararNaJornada).map((area) => {
      const daArea = this.negocios().filter((negocio) => negocio.funil.area === area);
      return {
        area,
        semAcesso: !this.areasVisiveis().has(area) && daArea.length === 0,
        total: daArea.length,
        abertos: daArea.filter((negocio) => negocio.status === 'ABERTO').length,
        ganhos: daArea.filter((negocio) => negocio.status === 'GANHO').length,
      };
    });
  });

  protected readonly explicacao = computed(() =>
    this.dono() === 'empresa'
      ? 'Negócios da empresa em todos os funis que você acompanha. Pode haver outros em setores que o seu papel não vê.'
      : 'Negócios da pessoa em todos os funis que você acompanha, na ordem da jornada: Marketing, Comercial e Customer Success. Pode haver outros em setores que o seu papel não vê.',
  );

  protected link(vinculo: { readonly id: string; readonly area: Area; readonly funilId: string }) {
    return ['/funis', slugDaArea(vinculo.area), vinculo.id];
  }

  protected linkDoNegocio(negocio: NegocioRelacionado) {
    return this.link({ id: negocio.id, area: negocio.funil.area, funilId: negocio.funil.id });
  }

  /** "nenhum", "1 aberto", "1 aberto · 1 ganho", "2 perdidos". */
  protected resumoDaEtapa(total: number, abertos: number, ganhos: number): string {
    if (total === 0) {
      return 'nenhum';
    }
    const fechados = total - abertos - ganhos;
    const partes = [
      abertos ? `${abertos} ${abertos === 1 ? 'aberto' : 'abertos'}` : '',
      ganhos ? `${ganhos} ${ganhos === 1 ? 'ganho' : 'ganhos'}` : '',
      fechados ? `${fechados} ${fechados === 1 ? 'perdido' : 'perdidos'}` : '',
    ];
    return partes.filter(Boolean).join(' · ');
  }

  protected titulo(vinculo: VinculoDaJornada): string {
    return `${nomeDoSetor(vinculo.area)} — ${vinculo.titulo}`;
  }
}
