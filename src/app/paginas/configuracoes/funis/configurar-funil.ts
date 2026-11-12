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
import { Router, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideRefreshCw, LucideSettings2 } from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../../nucleo/confirmacao.service';
import { slugDaArea } from '../../../nucleo/setores/setores';
import { SessaoService } from '../../../nucleo/sessao/sessao.service';
import { AreaTexto } from '../../../ui/area-texto/area-texto';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { CampoTexto, type ValorCampoTexto } from '../../../ui/campo-texto/campo-texto';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { GrupoOpcoes, type OpcaoGrupo } from '../../../ui/grupo-opcoes/grupo-opcoes';
import { Selo } from '../../../ui/selo/selo';
import { ConfigurarEtapas } from '../../funis/configurar-etapas';
import { FunisApi } from '../../funis/funis.api';
import type { Funil, VisibilidadeFunil } from '../../funis/funis.tipos';
import {
  DICA_VISIBILIDADE,
  nivelDoFunil,
  podeConfigurarPorNivel,
  ROTULO_VISIBILIDADE,
} from '../../funis/nivel-funil';
import { ordenarEtapas } from '../../funis/regras-funis';
import { DESCRICAO_MAXIMA, NOME_MAXIMO } from './novo-funil';
import { EditorDeAcessos } from './editor-de-acessos';

type Situacao = 'carregando' | 'pronto' | 'erro' | 'sem-acesso' | 'nao-encontrado';

const OPCOES_VISIBILIDADE: readonly OpcaoGrupo<VisibilidadeFunil>[] = (
  ['SETOR', 'RESTRITA'] as const
).map((valor) => ({ valor, rotulo: ROTULO_VISIBILIDADE[valor], dica: DICA_VISIBILIDADE[valor] }));

/** Erros do formulário Geral (`nome`, `descricao`), antes de enviar. */
export function validarGeral(
  nome: string,
  descricao: string,
): { nome: string | null; descricao: string | null } {
  const limpo = nome.trim();
  return {
    nome: !limpo
      ? 'Dê um nome ao funil.'
      : limpo.length > NOME_MAXIMO
        ? `Use no máximo ${NOME_MAXIMO} caracteres.`
        : null,
    descricao:
      descricao.trim().length > DESCRICAO_MAXIMA
        ? `Use no máximo ${DESCRICAO_MAXIMA} caracteres.`
        : null,
  };
}

/**
 * Configurar funil (`/configuracoes/funis/:id`), só para quem tem o nível `CONFIGURAR` (líder
 * do setor dono, C-level e Admin; R5.1, R5.12): Geral (nome e descrição), Etapas (o modal de
 * "Configurar etapas"), Visibilidade, Acessos e a Zona de perigo (arquivar e excluir, com a
 * mensagem da API quando ela recusa).
 */
@Component({
  selector: 'app-configurar-funil',
  imports: [
    AreaTexto,
    Botao,
    CampoTexto,
    Cartao,
    ConfigurarEtapas,
    EditorDeAcessos,
    Esqueleto,
    EstadoVazio,
    GrupoOpcoes,
    LucideArrowLeft,
    RouterLink,
    Selo,
  ],
  template: `
    <section class="secao" aria-labelledby="configurar-funil-titulo">
      <a class="voltar" routerLink="/configuracoes/funis"
        ><svg lucideArrowLeft [size]="16" /> Funis</a
      >

      @switch (situacao()) {
        @case ('carregando') {
          <div aria-busy="true">
            <p class="visualmente-oculto" role="status">Carregando o funil…</p>
            <app-esqueleto largura="40%" />
            <app-esqueleto forma="bloco" altura="160px" />
          </div>
        }
        @case ('erro') {
          <app-estado-vazio
            variante="erro"
            titulo="Não conseguimos carregar o funil"
            [texto]="erroDeLeitura()?.resumo ?? null"
          >
            <button
              appBotao
              type="button"
              variante="invertido"
              [icone]="iconeTentar"
              (click)="carregar()"
            >
              Tentar de novo
            </button>
          </app-estado-vazio>
        }
        @case ('nao-encontrado') {
          <app-estado-vazio
            titulo="Funil não encontrado"
            texto="Ele pode ter sido excluído, ou você não tem acesso a ele."
          />
        }
        @case ('sem-acesso') {
          <app-estado-vazio
            variante="sem-acesso"
            titulo="Você não configura este funil"
            texto="Só o líder do setor dono, o C-level e o Admin configuram um funil. Com o seu acesso você usa o quadro, mas não muda a configuração."
          />
        }
        @default {
          @let f = funil()!;
          <header class="secao__cabecalho">
            <div class="secao__textos">
              <h2 class="secao__titulo" id="configurar-funil-titulo">
                {{ f.nome }}
                @if (f.base) {
                  <app-selo variante="ciano" tamanho="sm">Funil-base</app-selo>
                }
                @if (!f.ativo) {
                  <app-selo variante="contorno" tamanho="sm">Arquivado</app-selo>
                }
              </h2>
              <p class="secao__frase">Configurar funil · setor {{ f.nomeSetor }}</p>
            </div>
            @if (f.ativo) {
              <a
                appBotao
                variante="contorno"
                [routerLink]="['/funis', slug(f.area)]"
                [queryParams]="f.base ? {} : { funil: f.id }"
                >Abrir quadro</a
              >
            }
          </header>

          <app-cartao regiao [nivel]="3" titulo="Geral">
            <form class="bloco" novalidate (submit)="$event.preventDefault(); salvarGeral()">
              <app-campo-texto
                rotulo="Nome"
                obrigatorio
                [maximoCaracteres]="nomeMaximo"
                [erro]="exibirGeral(errosGeral().nome, 'nome')"
                [valor]="nome()"
                (valorChange)="editarNome($event)"
              />
              <app-area-texto
                rotulo="Descrição"
                opcional
                [linhas]="3"
                [maximoCaracteres]="descricaoMaxima"
                [erro]="exibirGeral(errosGeral().descricao, 'descricao')"
                [valor]="descricao()"
                (valorChange)="descricao.set($event)"
              />
              <div class="bloco__acoes">
                <button
                  appBotao
                  type="submit"
                  variante="invertido"
                  [disabled]="!geralAlterado()"
                  [carregando]="salvandoGeral()"
                >
                  Salvar
                </button>
              </div>
            </form>
          </app-cartao>

          <app-cartao
            regiao
            [nivel]="3"
            titulo="Etapas"
            dica="Ganho e perda ficam sempre no fim e não saem do funil."
          >
            <div class="bloco">
              <ol class="etapas" aria-label="Etapas do funil, em ordem">
                @for (etapa of etapas(); track etapa.id; let i = $index) {
                  <li class="etapa">
                    <span class="etapa__ordem numeros" aria-hidden="true">{{ i + 1 }}</span>
                    <span class="etapa__nome">{{ etapa.nome }}</span>
                    @if (etapa.tipo === 'GANHO') {
                      <app-selo variante="menta" tamanho="sm">Ganho</app-selo>
                    } @else if (etapa.tipo === 'PERDIDO') {
                      <app-selo variante="coral" tamanho="sm">Perda</app-selo>
                    }
                    @if (prazo(etapa); as texto) {
                      <span class="etapa__detalhe">{{ texto }}</span>
                    }
                    @if (etapa.probabilidade !== null && etapa.probabilidade !== undefined) {
                      <span class="etapa__detalhe numeros">{{ etapa.probabilidade }}%</span>
                    }
                  </li>
                }
              </ol>
              <div class="bloco__acoes">
                <button
                  appBotao
                  type="button"
                  variante="contorno"
                  [icone]="iconeEtapas"
                  (click)="etapasAbertas.set(true)"
                >
                  Editar etapas
                </button>
              </div>
            </div>
          </app-cartao>
          <app-configurar-etapas
            [(aberto)]="etapasAbertas"
            [funil]="f"
            (alterado)="funil.set($event)"
          />

          <app-cartao regiao [nivel]="3" titulo="Visibilidade">
            <div class="bloco">
              <app-grupo-opcoes
                rotulo="Quem vê este funil"
                [opcoes]="opcoesVisibilidade"
                [valor]="visibilidade()"
                (valorChange)="escolherVisibilidade($event)"
              />
              @if (erroVisibilidade(); as mensagem) {
                <p class="erro" role="alert">{{ mensagem }}</p>
              }
              <div class="bloco__acoes">
                <button
                  appBotao
                  type="button"
                  variante="invertido"
                  [disabled]="visibilidade() === (f.visibilidade ?? 'SETOR')"
                  [carregando]="salvandoVisibilidade()"
                  (click)="salvarVisibilidade()"
                >
                  Salvar visibilidade
                </button>
              </div>
            </div>
          </app-cartao>

          <app-cartao
            regiao
            [nivel]="3"
            titulo="Acessos"
            dica="Dê acesso a um setor inteiro ou a uma pessoa de outro setor. A lista enviada substitui a atual."
          >
            <app-editor-de-acessos-do-funil
              [funilId]="f.id"
              [areaDona]="f.area"
              [visibilidadeDoFunil]="f.visibilidade ?? 'SETOR'"
            />
          </app-cartao>

          <app-cartao regiao [nivel]="3" titulo="Zona de perigo" class="perigo">
            <div class="bloco">
              <div class="perigo__linha">
                <div class="perigo__texto">
                  <p class="perigo__titulo">
                    {{ f.ativo ? 'Arquivar o funil' : 'Reativar o funil' }}
                  </p>
                  <p class="perigo__dica">
                    {{
                      f.ativo
                        ? 'Sai do quadro e não recebe negócios novos. Os negócios e o histórico ficam guardados e você pode reativá-lo quando quiser.'
                        : 'Volta ao quadro e passa a receber negócios de novo.'
                    }}
                  </p>
                </div>
                <button
                  appBotao
                  type="button"
                  variante="contorno"
                  [carregando]="arquivando()"
                  (click)="alternarArquivo()"
                >
                  {{ f.ativo ? 'Arquivar' : 'Reativar' }}
                </button>
              </div>
              <div class="perigo__linha">
                <div class="perigo__texto">
                  <p class="perigo__titulo">Excluir o funil</p>
                  <p class="perigo__dica">
                    @if (f.base) {
                      O funil-base de um setor não pode ser excluído, só arquivado.
                    } @else {
                      Só funis sem negócios abertos. A exclusão não se desfaz pela tela.
                    }
                  </p>
                </div>
                <button
                  appBotao
                  type="button"
                  variante="contorno"
                  [disabled]="f.base"
                  (click)="excluir()"
                >
                  Excluir
                </button>
              </div>
              @if (erroPerigo(); as mensagem) {
                <p class="erro" role="alert">{{ mensagem }}</p>
              }
            </div>
          </app-cartao>
        }
      }
    </section>
  `,
  styleUrl: './configurar-funil.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigurarFunilPagina {
  /** O id do funil (parâmetro da rota). */
  readonly id = input.required<string>();

  private readonly api = inject(FunisApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly router = inject(Router);
  private readonly sessao = inject(SessaoService);

  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly iconeEtapas = LucideSettings2;
  protected readonly nomeMaximo = NOME_MAXIMO;
  protected readonly descricaoMaxima = DESCRICAO_MAXIMA;
  protected readonly opcoesVisibilidade = OPCOES_VISIBILIDADE;
  protected readonly slug = slugDaArea;

  protected readonly situacao = signal<Situacao>('carregando');
  protected readonly erroDeLeitura = signal<ErroApi | null>(null);
  protected readonly funil = signal<Funil | null>(null);
  protected readonly etapasAbertas = signal(false);

  protected readonly nome = signal('');
  protected readonly descricao = signal('');
  protected readonly tentouGeral = signal(false);
  protected readonly salvandoGeral = signal(false);
  protected readonly errosDaApiGeral = signal<Readonly<Record<string, string>>>({});

  protected readonly visibilidade = signal<VisibilidadeFunil>('SETOR');
  protected readonly salvandoVisibilidade = signal(false);
  protected readonly erroVisibilidade = signal<string | null>(null);

  protected readonly arquivando = signal(false);
  protected readonly erroPerigo = signal<string | null>(null);

  protected readonly etapas = computed(() => ordenarEtapas(this.funil()?.etapas ?? []));
  protected readonly errosGeral = computed(() => validarGeral(this.nome(), this.descricao()));
  protected readonly geralAlterado = computed(() => {
    const funil = this.funil();
    return (
      !!funil &&
      (this.nome().trim() !== funil.nome || this.descricao().trim() !== (funil.descricao ?? ''))
    );
  });

  constructor() {
    effect(() => {
      this.id();
      untracked(() => void this.carregar());
    });
  }

  protected async carregar(): Promise<void> {
    this.situacao.set('carregando');
    try {
      const funil = await this.api.funil(this.id());
      if (!podeConfigurarPorNivel(nivelDoFunil(funil, this.sessao.perfil()))) {
        this.situacao.set('sem-acesso');
        return;
      }
      this.aplicar(funil);
      this.situacao.set('pronto');
    } catch (falha) {
      const erro = erroDaApi(falha);
      this.erroDeLeitura.set(erro);
      this.situacao.set(
        erro.ehNaoEncontrado ? 'nao-encontrado' : erro.ehSemPermissao ? 'sem-acesso' : 'erro',
      );
    }
  }

  /** Põe o funil que a API devolveu na tela (e nos campos). */
  private aplicar(funil: Funil): void {
    this.funil.set(funil);
    this.nome.set(funil.nome);
    this.descricao.set(funil.descricao ?? '');
    this.visibilidade.set(funil.visibilidade ?? 'SETOR');
  }

  protected prazo(etapa: Funil['etapas'][number]): string | null {
    return etapa.prazoDias
      ? `Prazo: ${etapa.prazoDias === 1 ? '1 dia' : etapa.prazoDias + ' dias'}`
      : null;
  }

  // Geral ----------------------------------------------------------------------------------

  protected exibirGeral(validacao: string | null, campo: string): string | null {
    return this.errosDaApiGeral()[campo] ?? (this.tentouGeral() ? validacao : null);
  }

  protected editarNome(valor: ValorCampoTexto): void {
    this.nome.set(String(valor ?? ''));
    this.errosDaApiGeral.update(({ nome: _, ...resto }) => resto);
  }

  protected async salvarGeral(): Promise<void> {
    const funil = this.funil();
    this.tentouGeral.set(true);
    const erros = this.errosGeral();
    if (!funil || erros.nome || erros.descricao || this.salvandoGeral() || !this.geralAlterado()) {
      return;
    }
    this.errosDaApiGeral.set({});
    this.salvandoGeral.set(true);
    try {
      const atualizado = await this.api.alterarFunil(funil.id, {
        nome: this.nome().trim(),
        descricao: this.descricao().trim() || null,
      });
      this.aplicar({ ...funil, ...atualizado });
      this.errosDaApiGeral.set({});
      this.tentouGeral.set(false);
      this.avisos.sucesso('Dados do funil salvos.');
    } catch (falha) {
      const erro = erroDaApi(falha);
      const porCampo: Record<string, string> = {};
      for (const { campo } of erro.campos) {
        const mensagem = erro.mensagemDoCampo(campo);
        if (mensagem) {
          porCampo[campo] = mensagem;
        }
      }
      if (erro.status === 409 && !Object.keys(porCampo).length) {
        porCampo['nome'] = erro.mensagem;
      }
      if (Object.keys(porCampo).length) {
        this.errosDaApiGeral.set(porCampo);
      } else {
        this.avisos.erro(erro);
      }
    } finally {
      this.salvandoGeral.set(false);
    }
  }

  // Visibilidade -----------------------------------------------------------------------------

  protected escolherVisibilidade(valor: VisibilidadeFunil | null): void {
    if (valor) {
      this.visibilidade.set(valor);
      this.erroVisibilidade.set(null);
    }
  }

  protected async salvarVisibilidade(): Promise<void> {
    const funil = this.funil();
    if (!funil || this.salvandoVisibilidade()) {
      return;
    }
    this.salvandoVisibilidade.set(true);
    this.erroVisibilidade.set(null);
    try {
      const atualizado = await this.api.alterarFunil(funil.id, {
        visibilidade: this.visibilidade(),
      });
      this.funil.set({ ...funil, ...atualizado });
      this.avisos.sucesso(
        this.visibilidade() === 'RESTRITA'
          ? 'Funil restrito: do setor, só os líderes (e os convidados) o veem.'
          : 'Funil visível para todo o setor.',
      );
    } catch (falha) {
      this.erroVisibilidade.set(erroDaApi(falha).mensagem);
    } finally {
      this.salvandoVisibilidade.set(false);
    }
  }

  // Zona de perigo ---------------------------------------------------------------------------

  protected async alternarArquivo(): Promise<void> {
    const funil = this.funil();
    if (!funil || this.arquivando()) {
      return;
    }
    this.erroPerigo.set(null);
    const arquivar = funil.ativo;
    const confirmado = await this.confirmacao.confirmar({
      titulo: arquivar ? `Arquivar “${funil.nome}”?` : `Reativar “${funil.nome}”?`,
      mensagem: arquivar
        ? 'O funil sai do quadro e não recebe negócios novos. Os negócios e o histórico continuam guardados e você pode reativá-lo depois.'
        : 'O funil volta ao quadro e passa a receber negócios de novo.',
      confirmar: arquivar ? 'Arquivar' : 'Reativar',
      perigo: arquivar,
      executar: async () => {
        const atualizado = await this.api.alterarFunil(funil.id, { ativo: !arquivar });
        this.funil.set({ ...funil, ...atualizado });
      },
    });
    if (confirmado) {
      this.avisos.sucesso(
        arquivar ? `Funil “${funil.nome}” arquivado.` : `Funil “${funil.nome}” reativado.`,
      );
    }
  }

  protected async excluir(): Promise<void> {
    const funil = this.funil();
    if (!funil || funil.base) {
      return;
    }
    this.erroPerigo.set(null);
    const confirmado = await this.confirmacao.confirmar({
      titulo: `Excluir “${funil.nome}”?`,
      mensagem:
        'O funil e a configuração dele (etapas e acessos) saem do CRM. Só dá para excluir um funil sem negócios abertos; se houver, feche-os ou mova-os antes, ou apenas arquive o funil.',
      confirmar: 'Excluir funil',
      perigo: true,
      exigirTexto: funil.nome,
      executar: () => this.api.excluirFunil(funil.id),
    });
    if (confirmado) {
      this.avisos.sucesso(`Funil “${funil.nome}” excluído.`);
      await this.router.navigate(['/configuracoes/funis']);
    }
  }
}
