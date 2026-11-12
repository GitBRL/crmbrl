import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideMenu, LucideSearch } from '@lucide/angular';
import { filter, map } from 'rxjs';

import type { ModuloBase } from '../nucleo/modulos';
import { moduloDaNavegacaoPorRota, modulosDaNavegacao } from '../nucleo/navegacao';
import { SessaoService } from '../nucleo/sessao/sessao.service';
import { AlternadorTema } from '../ui/alternador-tema/alternador-tema';
import { BotaoIcone } from '../ui/botao-icone/botao-icone';
import { CampoBusca } from '../ui/campo-busca/campo-busca';
import { Logo } from '../ui/logo/logo';
import { Ajuda } from './ajuda/ajuda';
import { EstadoCasca } from './estado-casca';
import { IndicadorConexao } from './indicador-conexao';
import { MenuConta } from './menu-conta';
import { Notificacoes } from './notificacoes';
import { PainelAgente } from './tresc-plus/painel-agente';

/** Tempo que o aviso da busca fica na tela. */
const DURACAO_AVISO_MS = 6000;

/** "Customer Success" → "customer success"; tira acentos para comparar. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

/**
 * Módulo que melhor responde a um termo de busca: nome que começa com o termo, depois nome
 * que contém o termo, depois descrição ou funcionalidades.
 */
export function buscarModulo<T extends ModuloBase>(
  termo: string,
  modulos: readonly T[],
): T | undefined {
  const alvo = normalizarBusca(termo);
  if (!alvo) {
    return undefined;
  }
  const nome = (modulo: T) => normalizarBusca(modulo.rotulo);
  return (
    modulos.find((modulo) => nome(modulo).startsWith(alvo)) ??
    modulos.find((modulo) => nome(modulo).includes(alvo)) ??
    modulos.find((modulo) =>
      [modulo.descricao, ...modulo.funcionalidades].some((texto) =>
        normalizarBusca(texto).includes(alvo),
      ),
    )
  );
}

/**
 * Barra superior da casca (DESIGN-SYSTEM.md §5), sobre o fundo da página e fixa no topo.
 * Desktop: logo, busca, alternador de tema, sino e menu da conta. Mobile: botão da gaveta,
 * símbolo, título da seção, busca num círculo (abre o campo numa linha própria), sino e conta.
 *
 * Antes dos botões da direita fica o indicador discreto do tempo real (`app-indicador-conexao`:
 * "Reconectando…" quando a conexão ao vivo cai; no mobile, ele flutua logo abaixo da barra).
 *
 * A busca leva ao módulo procurado ("disparos" → Disparos). Quando o termo não é nome de
 * módulo, procura em Contatos e empresas (`/contatos?busca=<termo>`), onde a tela de contatos
 * filtra pessoas por nome, e-mail ou telefone.
 */
@Component({
  selector: 'app-barra-superior',
  imports: [
    RouterLink,
    Logo,
    CampoBusca,
    BotaoIcone,
    AlternadorTema,
    Ajuda,
    IndicadorConexao,
    Notificacoes,
    MenuConta,
    PainelAgente,
  ],
  templateUrl: './barra-superior.html',
  styleUrl: './barra-superior.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarraSuperior {
  protected readonly estado = inject(EstadoCasca);
  private readonly sessao = inject(SessaoService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  protected readonly icones = { menu: LucideMenu, busca: LucideSearch };
  protected readonly aviso = signal<string | null>(null);
  /** Mobile: o campo de busca aparece numa linha própria quando aberto. */
  protected readonly buscaAberta = signal(false);
  /**
   * Recolhida, no tablet ou no mobile, a marca mostra só o símbolo. No tablet vale também
   * com a navegação aberta por cima do conteúdo: a coluna continua a do trilho e o logo
   * inteiro invadiria a busca.
   */
  protected readonly somenteSimbolo = computed(
    () => this.estado.recolhida() || this.estado.ehTablet() || this.estado.ehMobile(),
  );

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  private readonly areas = computed(() => this.sessao.permissoes()?.areasVisiveis ?? []);
  /** Título da seção no mobile (o nome do módulo da página atual). */
  protected readonly secao = computed(() => {
    const url = this.url();
    if (url.startsWith('/sem-acesso')) {
      return 'Sem acesso';
    }
    return moduloDaNavegacaoPorRota(url, this.areas())?.rotulo ?? 'Página não encontrada';
  });

  private readonly campo = viewChild.required(CampoBusca);
  private readonly botaoBusca = viewChild.required('botaoBusca', {
    read: ElementRef<HTMLButtonElement>,
  });
  private temporizadorAviso: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizadorAviso));
  }

  protected aoDigitar(): void {
    this.mostrarAviso(null);
  }

  protected buscar(texto: string): void {
    if (!texto) {
      return;
    }
    const modulo = buscarModulo(
      texto,
      modulosDaNavegacao(this.areas()).filter((item) => this.sessao.pode(item)),
    );
    if (!modulo && !this.sessao.pode('contatos')) {
      this.mostrarAviso(`Nenhum módulo encontrado para “${texto}”.`);
      return;
    }
    this.campo().valor.set('');
    this.mostrarAviso(null);
    this.buscaAberta.set(false);
    void (modulo
      ? this.router.navigateByUrl(modulo.rota)
      : this.router.navigate(['/contatos'], { queryParams: { busca: texto } }));
  }

  protected abrirBusca(): void {
    this.buscaAberta.set(true);
    afterNextRender(() => this.campo().focar(), { injector: this.injector });
  }

  /** Esc na busca do mobile: fecha a linha e devolve o foco ao círculo da busca. */
  protected fecharBusca(): void {
    if (!this.buscaAberta()) {
      return;
    }
    this.buscaAberta.set(false);
    this.mostrarAviso(null);
    this.botaoBusca().nativeElement.focus();
  }

  private mostrarAviso(texto: string | null): void {
    clearTimeout(this.temporizadorAviso);
    this.aviso.set(texto);
    if (texto) {
      this.temporizadorAviso = setTimeout(() => this.aviso.set(null), DURACAO_AVISO_MS);
    }
  }
}
