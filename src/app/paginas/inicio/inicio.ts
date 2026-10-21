import { formatDate } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  LOCALE_ID,
  signal,
  viewChild,
} from '@angular/core';
import { LucideCheck, LucideShare2, LucideSparkles, LucideX } from '@lucide/angular';

import { PerfilDemoService } from '../../nucleo/perfil-demo.service';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Dica } from '../../ui/dica/dica';
import { PilhaAvatares } from '../../ui/pilha-avatares/pilha-avatares';
import { Selo } from '../../ui/selo/selo';
import { gerarId } from '../../ui/tipos';
import { AnaliseIa } from './analise-ia';
import { InicioAtendimento } from './atendimento';
import { AtividadesRecentes } from './atividades-recentes';
import { DADOS_POR_PERIODO, ehIdPeriodo, EQUIPE, PERIODO_PADRAO, PERIODOS } from './dados-exemplo';
import { InicioEquipe } from './equipe';
import { InicioIndicadores } from './indicadores';
import { InicioJornada } from './jornada';
import { fornecerRelogio, RELOGIO } from './relogio';
import { StatusSistema } from './status-sistema';

type Compartilhamento = 'copiado' | 'falhou';

/** Quanto tempo o retorno do "Compartilhar" fica na tela. */
export const DURACAO_RETORNO_MS: Readonly<Record<Compartilhamento, number>> = {
  copiado: 3000,
  falhou: 6000,
};

/**
 * "21/09 a 20/10/2026": os `dias` do período terminando em `fim` (hoje), contando os dois
 * extremos. O ano só aparece no início quando muda.
 */
export function formatarIntervalo(fim: Date, dias: number, locale: string): string {
  const inicio = new Date(fim);
  inicio.setDate(fim.getDate() - (dias - 1));
  const formatoInicio = inicio.getFullYear() === fim.getFullYear() ? 'dd/MM' : 'dd/MM/y';
  return `${formatDate(inicio, formatoInicio, locale)} a ${formatDate(fim, 'dd/MM/y', locale)}`;
}

/**
 * Visão geral (`/inicio`): o painel de exemplo do CRM. Todos os números são fictícios
 * (`dados-exemplo.ts`) e trocam com o período; só o "Status do sistema" lê a API de verdade.
 *
 * Estrutura: cabeçalho (título em dois tons à esquerda; à direita o período com as datas, a
 * equipe, compartilhar e a análise com IA, que só o Admin vê) → palco com abas entalhadas
 * (jornada, atendimento — para quem acessa o módulo —, equipe) → indicadores; à direita,
 * atividades recentes e status do sistema. A página fornece um relógio só para os blocos.
 */
@Component({
  selector: 'app-inicio',
  imports: [
    Abas,
    AnaliseIa,
    AtividadesRecentes,
    Botao,
    BotaoIcone,
    Dica,
    InicioAtendimento,
    InicioEquipe,
    InicioIndicadores,
    InicioJornada,
    PilhaAvatares,
    Selo,
    StatusSistema,
  ],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [fornecerRelogio()],
})
export class Inicio {
  protected readonly perfil = inject(PerfilDemoService);
  private readonly documento = inject(DOCUMENT);
  private readonly locale = inject(LOCALE_ID);
  private readonly agora = inject(RELOGIO);

  /** "outubro de 2026" — o segundo tom do título. */
  protected readonly mesAtual = formatDate(new Date(), "MMMM 'de' y", this.locale);
  protected readonly equipe = EQUIPE;
  protected readonly icones = { ia: LucideSparkles };

  protected readonly periodos: readonly ItemAba[] = PERIODOS.map(({ id, rotulo }) => ({
    id,
    rotulo,
  }));
  protected readonly periodo = signal<string | null>(PERIODO_PADRAO);
  protected readonly dados = computed(() => {
    const periodo = this.periodo();
    return DADOS_POR_PERIODO[ehIdPeriodo(periodo) ? periodo : PERIODO_PADRAO];
  });
  /** As datas que o período cobre ("21/09 a 20/10/2026"), ao lado do seletor. */
  protected readonly intervalo = computed(() =>
    formatarIntervalo(this.agora(), this.dados().periodo.dias, this.locale),
  );
  protected readonly idIntervalo = gerarId('periodo-intervalo');

  /** A aba Atendimento só aparece para quem acessa o módulo (o Marketing, não). */
  protected readonly abas = computed<readonly ItemAba[]>(() => [
    { id: 'jornada', rotulo: 'Jornada do cliente' },
    ...(this.perfil.pode('atendimento') ? [{ id: 'atendimento', rotulo: 'Atendimento' }] : []),
    { id: 'equipe', rotulo: 'Equipe' },
  ]);
  protected readonly aba = signal<string | null>('jornada');
  /** A aba escolhida, ou a Jornada se ela sumiu com a troca de persona. */
  protected readonly abaVisivel = computed(() => {
    const aba = this.aba();
    return this.abas().some((item) => item.id === aba) ? aba : 'jornada';
  });

  protected readonly analiseAberta = signal(false);

  protected readonly compartilhamento = signal<Compartilhamento | null>(null);
  protected readonly iconeCompartilhar = computed(() => {
    switch (this.compartilhamento()) {
      case 'copiado':
        return LucideCheck;
      case 'falhou':
        return LucideX;
      default:
        return LucideShare2;
    }
  });
  protected readonly rotuloCompartilhar = computed(() => {
    switch (this.compartilhamento()) {
      case 'copiado':
        return 'Link copiado';
      case 'falhou':
        return 'Não deu para copiar';
      default:
        return 'Compartilhar';
    }
  });
  /** Retorno visível (e anunciado) do "Compartilhar", logo abaixo das ações. */
  protected readonly avisoCompartilhamento = computed(() => {
    switch (this.compartilhamento()) {
      case 'copiado':
        return 'Link copiado.';
      case 'falhou':
        return 'Não deu para copiar o link. Copie o endereço na barra do navegador.';
      default:
        return '';
    }
  });

  private readonly seletorPeriodo = viewChild.required('seletorPeriodo', { read: ElementRef });
  private esperaAviso: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.esperaAviso));
    // As datas descrevem o grupo de opções do período (o radiogroup fica dentro do app-abas).
    afterNextRender(() => {
      const grupo = (this.seletorPeriodo().nativeElement as HTMLElement).querySelector(
        '[role="radiogroup"]',
      );
      grupo?.setAttribute('aria-describedby', this.idIntervalo);
    });
  }

  /** Copia o link da página e mostra o resultado no botão e logo abaixo das ações. */
  protected async compartilhar(): Promise<void> {
    const copiou = await copiarTexto(this.documento.location.href, this.documento);
    const resultado: Compartilhamento = copiou ? 'copiado' : 'falhou';
    this.compartilhamento.set(resultado);
    clearTimeout(this.esperaAviso);
    this.esperaAviso = setTimeout(
      () => this.compartilhamento.set(null),
      DURACAO_RETORNO_MS[resultado],
    );
  }
}

/**
 * Copia um texto para a área de transferência. Usa a Clipboard API e, onde ela não existe
 * (página servida por http sem TLS, por exemplo), o modo antigo com um campo temporário —
 * devolvendo o foco a quem estava com ele.
 */
export async function copiarTexto(texto: string, documento: Document): Promise<boolean> {
  const area = documento.defaultView?.navigator.clipboard;
  if (area?.writeText) {
    try {
      await area.writeText(texto);
      return true;
    } catch {
      // Sem permissão: tenta o modo antigo.
    }
  }
  const focado = documento.activeElement as HTMLElement | null;
  const campo = documento.createElement('textarea');
  campo.value = texto;
  campo.setAttribute('readonly', '');
  campo.style.position = 'fixed';
  campo.style.opacity = '0';
  documento.body.append(campo);
  campo.select();
  try {
    return typeof documento.execCommand === 'function' && documento.execCommand('copy');
  } catch {
    return false;
  } finally {
    campo.remove();
    focado?.focus?.();
  }
}
