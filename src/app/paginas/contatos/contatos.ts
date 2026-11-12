import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideUpload, LucidePlus } from '@lucide/angular';

import { podeImportarContatos } from '../../nucleo/sessao/perfil';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { type AbaContatos, type ConsultaLista, lerConsulta, paraQueryParams } from './consulta';
import type { Contato, Empresa } from './contatos.tipos';
import { FormularioContato } from './formulario-contato';
import { FormularioEmpresa } from './formulario-empresa';
import { ListaEmpresas } from './lista-empresas';
import { ListaPessoas } from './lista-pessoas';

const ABAS: readonly ItemAba[] = [
  { id: 'pessoas', rotulo: 'Pessoas' },
  { id: 'empresas', rotulo: 'Empresas' },
];

/**
 * Lista de pessoas e empresas (`/contatos`, `?aba=empresas`, `?busca=`) — TELAS-FASE1 §4.
 *
 * Abas Pessoas e Empresas, cada uma com busca, filtros, tabela (cartões no celular) e
 * paginação. Busca, filtros, ordem e página ficam na URL: voltar do detalhe mantém tudo, e a
 * busca da barra superior (`/contatos?busca=…`) chega aqui. Ação principal "Novo contato" /
 * "Nova empresa" (no celular, o botão flutuante), com detecção de duplicado.
 */
@Component({
  selector: 'app-contatos',
  imports: [
    RouterLink,
    Abas,
    Botao,
    BotaoIcone,
    FormularioContato,
    FormularioEmpresa,
    ListaEmpresas,
    ListaPessoas,
  ],
  templateUrl: './contatos.html',
  styleUrl: './contatos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Contatos {
  /** Aba (query `aba`): `pessoas` (padrão) ou `empresas`. */
  readonly aba = input<string | null>(null);
  /** Busca vinda da barra superior (query `busca`). */
  readonly busca = input<string | null>(null);
  readonly responsavel = input<string | null>(null);
  readonly origem = input<string | null>(null);
  readonly etiqueta = input<string | null>(null);
  readonly marketing = input<string | null>(null);
  readonly uf = input<string | null>(null);
  readonly ordem = input<string | null>(null);
  readonly pagina = input<string | null>(null);
  readonly porPagina = input<string | null>(null);
  /** `?novo=1` abre o cadastro (atalho de outras telas). */
  readonly novo = input<string | null>(null);
  /** Com `?novo=1&telefone=…`, o cadastro abre com o telefone preenchido. */
  readonly telefone = input<string | null>(null);
  protected readonly telefoneDoCadastro = signal<string | null>(null);

  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  protected readonly abas = ABAS;
  protected readonly icones = { novo: LucidePlus, importar: LucideUpload };
  private readonly sessao = inject(SessaoService);
  /** Importar planilha (R16): Admin, C-level e líderes. */
  protected readonly podeImportar = computed(() => this.sessao.permite(podeImportarContatos));

  protected readonly abaAtual = computed<AbaContatos>(() =>
    this.aba() === 'empresas' ? 'empresas' : 'pessoas',
  );

  protected readonly consulta = computed<ConsultaLista>(() =>
    lerConsulta({
      busca: this.busca(),
      responsavel: this.responsavel(),
      origem: this.origem(),
      etiqueta: this.etiqueta(),
      marketing: this.marketing(),
      uf: this.uf(),
      ordem: this.ordem(),
      pagina: this.pagina(),
      porPagina: this.porPagina(),
    }),
  );

  protected readonly rotuloNovo = computed(() =>
    this.abaAtual() === 'empresas' ? 'Nova empresa' : 'Novo contato',
  );

  protected readonly cadastroDeContato = signal(false);
  protected readonly cadastroDeEmpresa = signal(false);

  constructor() {
    effect(() => {
      if (this.novo()) {
        untracked(() => {
          this.telefoneDoCadastro.set(this.telefone());
          this.abrirCadastro();
          void this.router.navigate([], {
            relativeTo: this.rota,
            queryParams: { novo: null, telefone: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        });
      }
    });
  }

  protected abrirCadastro(): void {
    if (this.abaAtual() === 'empresas') {
      this.cadastroDeEmpresa.set(true);
    } else {
      this.cadastroDeContato.set(true);
    }
  }

  /** Trocar de aba guarda só a busca (os filtros são de cada aba). */
  protected mudarAba(aba: string | null): void {
    if (aba === this.abaAtual()) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: {
        aba: aba === 'empresas' ? 'empresas' : null,
        busca: this.consulta().busca || null,
      },
    });
  }

  protected mudarConsulta(mudanca: Partial<ConsultaLista>): void {
    void this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: paraQueryParams(mudanca),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected aoCriarContato(contato: Contato): void {
    void this.router.navigate(['/contatos', contato.id]);
  }

  protected aoCriarEmpresa(empresa: Empresa): void {
    void this.router.navigate(['/empresas', empresa.id]);
  }
}
