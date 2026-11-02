import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideRefreshCw } from '@lucide/angular';

import { abreviarNumero, formatarMoedaAbreviada, formatarNumero } from '../../nucleo/formatos';
import { ROTULO_AREA } from '../../nucleo/sessao/perfil';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Indicador } from '../../ui/indicador/indicador';
import { Selo } from '../../ui/selo/selo';
import { Carregamento } from './carregamento';
import { ConfiguracoesApi } from './configuracoes.api';
import type { Equipe } from './configuracoes.modelos';
import { montarArvore, type NoEquipe, resumirArvore } from './hierarquia';
import { pluralizar } from './textos';

/**
 * "·" preso à palavra anterior (espaço inseparável): quando a linha quebra, ele fica no fim da
 * linha de cima e o trecho seguinte desce inteiro (DESIGN-SYSTEM §2.10).
 */
const SEPARADOR = ' ·';

/** Um nó pronto para desenhar (os textos já calculados). */
interface NoVisual {
  readonly no: NoEquipe;
  readonly ehVoce: boolean;
  /** Papel e área ("Líder CS · Customer Success"), com o "·" final quando há equipe. */
  readonly descricao: string;
  /** "1 pessoa" / "8 pessoas": quem responde direto a esta pessoa. */
  readonly tamanhoEquipe: string | null;
  readonly atividades: string;
  readonly atrasadas: string | null;
  readonly negocios: string;
  /** Soma dos negócios abertos ("R$ 43,2 mil"), que nunca quebra no meio. */
  readonly valorAberto: string | null;
  readonly contatos: string | null;
  readonly filhos: readonly NoVisual[];
}

/**
 * Minha equipe (`/configuracoes/equipe`, líderes e C-level) — TELAS-FASE1 §6: a hierarquia em
 * árvore (quem responde a quem), com o que cada pessoa tem em mãos agora. Só leitura: quem muda
 * líderes é o Admin, em Usuários.
 */
@Component({
  selector: 'app-minha-equipe',
  imports: [NgTemplateOutlet, Avatar, Botao, Cartao, Esqueleto, EstadoVazio, Indicador, Selo],
  templateUrl: './minha-equipe.html',
  styleUrl: './minha-equipe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinhaEquipe {
  private readonly api = inject(ConfiguracoesApi);
  private readonly sessao = inject(SessaoService);

  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly equipes = new Carregamento<readonly Equipe[]>();
  protected readonly raizes = computed(() => montarArvore(this.equipes.dados() ?? []));
  protected readonly arvore = computed(() => this.raizes().map((raiz) => this.visual(raiz)));
  protected readonly resumo = computed(() => resumirArvore(this.raizes()));
  protected readonly valorAbreviado = computed(() =>
    abreviarNumero(this.resumo().valorEmAberto, 'pt-BR'),
  );
  protected readonly frase = computed(() =>
    this.sessao.papel() === 'C_LEVEL'
      ? 'Os líderes que respondem a você e as equipes de cada um, com o que cada pessoa tem em mãos agora.'
      : 'Quem responde a você e o que cada pessoa tem em mãos agora.',
  );

  constructor() {
    this.carregar();
  }

  protected carregar(): void {
    void this.equipes.executar(() => this.api.equipes());
  }

  private visual(no: NoEquipe): NoVisual {
    const i = no.indicadores;
    const valor = Number(i.valorEmAberto) || 0;
    const area = no.area ? ROTULO_AREA[no.area] : null;
    const papel =
      area && !no.pessoa.rotuloPapel.includes(area)
        ? `${no.pessoa.rotuloPapel}${SEPARADOR} ${area}`
        : no.pessoa.rotuloPapel;
    const valorAberto =
      i.negociosAbertos > 0 && valor > 0 ? formatarMoedaAbreviada(valor, 'pt-BR') : null;
    return {
      no,
      ehVoce: no.pessoa.id === this.sessao.usuario()?.id,
      descricao: no.filhos.length > 0 ? `${papel}${SEPARADOR}` : papel,
      tamanhoEquipe:
        no.filhos.length > 0 ? pluralizar(no.filhos.length, 'pessoa', 'pessoas') : null,
      atividades:
        i.atividadesPendentes > 0
          ? pluralizar(i.atividadesPendentes, 'atividade pendente', 'atividades pendentes')
          : 'Nenhuma atividade pendente',
      atrasadas:
        i.atividadesAtrasadas > 0
          ? pluralizar(i.atividadesAtrasadas, 'atrasada', 'atrasadas')
          : null,
      negocios:
        i.negociosAbertos > 0
          ? `${pluralizar(i.negociosAbertos, 'negócio aberto', 'negócios abertos')}${valorAberto ? SEPARADOR : ''}`
          : 'Nenhum negócio aberto',
      valorAberto,
      contatos: i.contatos > 0 ? pluralizar(i.contatos, 'contato', 'contatos') : null,
      filhos: no.filhos.map((filho) => this.visual(filho)),
    };
  }

  protected numero(valor: number): string {
    return formatarNumero(valor);
  }
}
