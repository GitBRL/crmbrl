import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { Botao } from '../../ui/botao/botao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { FacebookApi } from './facebook.api';
import type { ConexaoFacebook, FormularioFacebook } from './facebook.tipos';

/**
 * Passo "Página e formulário" do assistente do Facebook Lead Ads: as páginas da conexão
 * escolhida e, da página escolhida, os formulários de lead. Os dois ids sobem nos `model`s e o
 * formulário inteiro (para o resumo) em `formularioEscolhido`.
 */
@Component({
  selector: 'app-passo-formulario-facebook',
  imports: [Botao, EstadoVazio, Esqueleto, Seletor],
  template: `
    @if (paginas().length === 0) {
      <app-estado-vazio
        compacto
        titulo="Esta conexão não tem páginas"
        texto="O Facebook não devolveu nenhuma página que você administra. Atualize as páginas da conexão, ou confira se a conta tem acesso a uma página."
      >
        <button
          appBotao
          type="button"
          variante="contorno"
          tamanho="sm"
          [carregando]="atualizandoPaginas()"
          (click)="atualizarPaginas()"
        >
          Atualizar as páginas
        </button>
      </app-estado-vazio>
    } @else {
      <app-seletor
        rotulo="Página do Facebook"
        placeholder="Escolha a página"
        [opcoes]="opcoesPagina()"
        [valor]="paginaId()"
        [erro]="erroDaPagina()"
        (valorChange)="escolherPagina($event)"
      />

      @if (paginaId()) {
        @if (carregando()) {
          <div aria-busy="true">
            <p class="visualmente-oculto" role="status">Carregando os formulários…</p>
            <app-esqueleto forma="pilula" />
          </div>
        } @else if (erro(); as falha) {
          <app-estado-vazio
            compacto
            variante="erro"
            [falha]="falha"
            titulo="Não conseguimos listar os formulários"
            [texto]="
              falha.resumo +
              ' Confira se o app tem a permissão leads_retrieval e se a conexão ainda vale.'
            "
            [codigo]="falha.requisicaoId"
          >
            <button appBotao type="button" variante="contorno" tamanho="sm" (click)="carregar()">
              Tentar de novo
            </button>
          </app-estado-vazio>
        } @else if (!formularios().length) {
          <app-estado-vazio
            compacto
            titulo="Nenhum formulário nesta página"
            texto="Crie um formulário de cadastro (Lead Ads) na página e volte aqui."
          >
            <button appBotao type="button" variante="contorno" tamanho="sm" (click)="carregar()">
              Atualizar a lista
            </button>
          </app-estado-vazio>
        } @else {
          <app-seletor
            rotulo="Formulário de leads"
            placeholder="Escolha o formulário"
            [opcoes]="opcoesFormulario()"
            [valor]="formularioId()"
            [erro]="erroDoFormulario()"
            dica="Cada formulário tem as suas perguntas: elas aparecem no mapeamento, no próximo passo."
            (valorChange)="escolherFormulario($event)"
          />
        }
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-4);
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PassoFormularioFacebook {
  private readonly api = inject(FacebookApi);
  private readonly avisos = inject(AvisosService);

  readonly conexao = input.required<ConexaoFacebook>();
  readonly paginaId = model<string | null>(null);
  readonly formularioId = model<string | null>(null);
  /** Mostra o aviso de "escolha" nos seletores vazios (depois de tentar avançar). */
  readonly mostrarErros = input(false);
  readonly formularioEscolhido = output<FormularioFacebook | null>();
  readonly paginasAtualizadas = output<ConexaoFacebook>();

  protected readonly formularios = signal<readonly FormularioFacebook[]>([]);
  protected readonly carregando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly atualizandoPaginas = signal(false);
  /** A conexão que as páginas pertencem, para recarregar ao trocar de conexão. */
  private ultima: string | null = null;

  protected readonly paginas = computed(() => this.conexao().paginas);
  protected readonly opcoesPagina = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.paginas().map((pagina) => ({
      valor: pagina.id,
      rotulo: pagina.categoria ? `${pagina.nome} · ${pagina.categoria}` : pagina.nome,
    })),
  );
  protected readonly opcoesFormulario = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.formularios().map((f) => ({ valor: f.id, rotulo: rotuloDoFormulario(f) })),
  );
  protected readonly erroDaPagina = computed(() =>
    this.mostrarErros() && !this.paginaId() ? 'Escolha a página.' : null,
  );
  protected readonly erroDoFormulario = computed(() =>
    this.mostrarErros() && !this.formularioId() ? 'Escolha o formulário.' : null,
  );

  constructor() {
    effect(() => {
      const conexao = this.conexao().id;
      const pagina = this.paginaId();
      const chave = `${conexao}/${pagina ?? ''}`;
      untracked(() => {
        if (chave !== this.ultima) {
          this.ultima = chave;
          void this.carregar();
        }
      });
    });
  }

  protected escolherPagina(id: string | null): void {
    if (id !== this.paginaId()) {
      this.formularioId.set(null);
      this.formularioEscolhido.emit(null);
    }
    this.paginaId.set(id);
  }

  protected escolherFormulario(id: string | null): void {
    this.formularioId.set(id);
    this.formularioEscolhido.emit(this.formularios().find((f) => f.id === id) ?? null);
  }

  protected async carregar(): Promise<void> {
    const pagina = this.paginaId();
    if (!pagina) {
      this.formularios.set([]);
      return;
    }
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const lista = await this.api.formularios(this.conexao().id, pagina);
      this.formularios.set(lista);
      const atual = this.formularioId();
      if (atual) {
        const encontrado = lista.find((f) => f.id === atual) ?? null;
        this.formularioEscolhido.emit(encontrado);
      }
    } catch (falha) {
      this.formularios.set([]);
      this.erro.set(erroDaApi(falha));
    } finally {
      this.carregando.set(false);
    }
  }

  protected async atualizarPaginas(): Promise<void> {
    this.atualizandoPaginas.set(true);
    try {
      this.paginasAtualizadas.emit(await this.api.atualizarPaginas(this.conexao().id));
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.atualizandoPaginas.set(false);
    }
  }
}

function rotuloDoFormulario(f: FormularioFacebook): string {
  const partes = [f.nome];
  if (f.status && f.status !== 'ACTIVE' && f.status !== 'ATIVO') {
    partes.push(f.status.toLocaleLowerCase('pt-BR'));
  }
  if (f.leads !== null && f.leads !== undefined) {
    partes.push(f.leads === 1 ? '1 lead' : `${f.leads} leads`);
  }
  return partes.join(' · ');
}
