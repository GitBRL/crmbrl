import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowDown,
  LucideArrowLeft,
  LucideArrowUp,
  LucidePlus,
  LucideX,
} from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { ehDiretoria } from '../../../nucleo/papeis';
import { SessaoService } from '../../../nucleo/sessao/sessao.service';
import { slugDaArea } from '../../../nucleo/setores/setores';
import { SetoresService } from '../../../nucleo/setores/setores.service';
import { AreaTexto } from '../../../ui/area-texto/area-texto';
import { Botao } from '../../../ui/botao/botao';
import { BotaoIcone } from '../../../ui/botao-icone/botao-icone';
import { CampoTexto, type ValorCampoTexto } from '../../../ui/campo-texto/campo-texto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../../ui/grupo-opcoes/grupo-opcoes';
import { Seletor } from '../../../ui/seletor/seletor';
import { FunisApi } from '../../funis/funis.api';
import type { EtapaNovaDoFunil, VisibilidadeFunil } from '../../funis/funis.tipos';
import { DICA_VISIBILIDADE, ROTULO_VISIBILIDADE } from '../../funis/nivel-funil';

export const NOME_MAXIMO = 100;
export const DESCRICAO_MAXIMA = 500;
/** Limite da API (R5.2). */
export const ETAPAS_MAXIMO = 30;
/** Etapas iniciais: duas abertas, uma de ganho e uma de perda (o mesmo começo dos funis-base). */
export const ETAPAS_ABERTAS_INICIAIS: readonly string[] = ['Novo', 'Em andamento'];
export const NOME_GANHO_INICIAL = 'Ganho';
export const NOME_PERDA_INICIAL = 'Perdido';

/** O que a pessoa preencheu. */
export interface RascunhoDeFunil {
  readonly nome: string;
  readonly area: string | null;
  readonly descricao: string;
  /** Nomes das etapas abertas, em ordem (ao menos uma). */
  readonly abertas: readonly string[];
  readonly ganho: string;
  readonly perda: string;
}

export interface ErrosDeFunil {
  readonly nome: string | null;
  readonly area: string | null;
  readonly descricao: string | null;
  /** Um texto (ou `null`) por etapa aberta, na ordem; depois `ganho` e `perda`. */
  readonly abertas: readonly (string | null)[];
  readonly ganho: string | null;
  readonly perda: string | null;
  readonly etapas: string | null;
}

function nomeDeEtapa(nome: string, todos: readonly string[]): string | null {
  const limpo = nome.trim();
  if (!limpo) {
    return 'Dê um nome à etapa.';
  }
  if (limpo.length > NOME_MAXIMO) {
    return `Use no máximo ${NOME_MAXIMO} caracteres.`;
  }
  const igual = todos.filter((outro) => comparavel(outro) === comparavel(limpo)).length > 1;
  return igual ? 'Já existe uma etapa com este nome.' : null;
}

function comparavel(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

/** Valida o rascunho com as mesmas regras da API (R5.1, R5.2): é o que o formulário mostra. */
export function validarRascunhoDeFunil(rascunho: RascunhoDeFunil): ErrosDeFunil {
  const nome = rascunho.nome.trim();
  const todos = [...rascunho.abertas, rascunho.ganho, rascunho.perda];
  const total = todos.length;
  return {
    nome: !nome
      ? 'Dê um nome ao funil.'
      : nome.length > NOME_MAXIMO
        ? `Use no máximo ${NOME_MAXIMO} caracteres.`
        : null,
    area: rascunho.area ? null : 'Escolha o setor do funil.',
    descricao:
      rascunho.descricao.trim().length > DESCRICAO_MAXIMA
        ? `Use no máximo ${DESCRICAO_MAXIMA} caracteres.`
        : null,
    abertas: rascunho.abertas.map((etapa) => nomeDeEtapa(etapa, todos)),
    ganho: nomeDeEtapa(rascunho.ganho, todos),
    perda: nomeDeEtapa(rascunho.perda, todos),
    etapas:
      rascunho.abertas.length < 1
        ? 'O funil precisa de ao menos uma etapa aberta.'
        : total > ETAPAS_MAXIMO
          ? `Um funil tem no máximo ${ETAPAS_MAXIMO} etapas.`
          : null,
  };
}

export function temErrosDeFunil(erros: ErrosDeFunil): boolean {
  return !!(
    erros.nome ||
    erros.area ||
    erros.descricao ||
    erros.ganho ||
    erros.perda ||
    erros.etapas ||
    erros.abertas.some(Boolean)
  );
}

/** Etapas no corpo do `POST /funis`: abertas na ordem, depois ganho e perda (R5.2). */
export function etapasDoRascunho(rascunho: RascunhoDeFunil): readonly EtapaNovaDoFunil[] {
  return [
    ...rascunho.abertas.map((nome) => ({ nome: nome.trim(), tipo: 'ABERTA' as const })),
    { nome: rascunho.ganho.trim(), tipo: 'GANHO' as const },
    { nome: rascunho.perda.trim(), tipo: 'PERDIDO' as const },
  ];
}

interface LinhaAberta {
  readonly chave: number;
  readonly nome: string;
}

const OPCOES_VISIBILIDADE: readonly OpcaoGrupo<VisibilidadeFunil>[] = (
  ['SETOR', 'RESTRITA'] as const
).map((valor) => ({
  valor,
  rotulo: ROTULO_VISIBILIDADE[valor],
  dica: DICA_VISIBILIDADE[valor],
}));

/**
 * Novo funil (`/configuracoes/funis/novo`): nome, setor, descrição, visibilidade e as etapas
 * iniciais (editáveis, com ao menos uma aberta e uma de ganho e uma de perda). Admin e C-level
 * escolhem o setor entre os ativos; o líder fica com o próprio. Ao salvar abre o quadro novo.
 */
@Component({
  selector: 'app-novo-funil',
  imports: [
    AreaTexto,
    Botao,
    BotaoIcone,
    CampoTexto,
    GrupoOpcoes,
    LucideArrowLeft,
    RouterLink,
    Seletor,
  ],
  template: `
    <section class="secao" aria-labelledby="novo-funil-titulo">
      <header class="secao__cabecalho">
        <div class="secao__textos">
          <a class="voltar" routerLink="/configuracoes/funis"
            ><svg lucideArrowLeft [size]="16" /> Funis</a
          >
          <h2 class="secao__titulo" id="novo-funil-titulo">Novo funil</h2>
          <p class="secao__frase">
            Defina quem vê o funil e por quais etapas o negócio passa. Prazo-alvo e probabilidade de
            cada etapa você ajusta depois, em “Configurar funil”.
          </p>
        </div>
      </header>

      <form class="formulario" novalidate (submit)="$event.preventDefault(); salvar()">
        <app-campo-texto
          rotulo="Nome do funil"
          obrigatorio
          [maximoCaracteres]="nomeMaximo"
          [erro]="exibir(erros().nome, 'nome')"
          [valor]="nome()"
          (valorChange)="editarNome($event)"
        />

        @if (escolheSetor()) {
          <app-seletor
            rotulo="Setor"
            obrigatorio
            placeholder="Escolha o setor"
            ajuda="O setor dono do funil: a liderança dele configura o funil e os negócios entram nele."
            [opcoes]="setores.opcoes()"
            [erro]="exibir(erros().area, 'area')"
            [valor]="area()"
            (valorChange)="escolherSetor($event)"
          />
        } @else {
          <div class="setor-fixo" role="note">
            <span class="setor-fixo__rotulo">Setor</span>
            <p>{{ nomeDoSetorFixo() }}</p>
            <p class="setor-fixo__dica">O líder cria funis só no próprio setor.</p>
          </div>
        }

        <app-area-texto
          rotulo="Descrição"
          opcional
          [linhas]="3"
          [maximoCaracteres]="descricaoMaxima"
          [erro]="exibir(erros().descricao, 'descricao')"
          [valor]="descricao()"
          (valorChange)="descricao.set($event)"
        />

        <app-grupo-opcoes
          rotulo="Quem vê este funil"
          [opcoes]="opcoesVisibilidade"
          [valor]="visibilidade()"
          (valorChange)="escolherVisibilidade($event)"
        />

        <fieldset class="etapas">
          <legend class="etapas__titulo">Etapas</legend>
          <p class="etapas__frase">
            O negócio anda da primeira etapa aberta até Ganho ou Perda, que ficam sempre no fim.
          </p>
          <ol class="etapas__lista" aria-label="Etapas abertas, em ordem">
            @for (
              linha of abertas();
              track linha.chave;
              let i = $index, primeira = $first, ultima = $last
            ) {
              <li class="etapa" [attr.data-etapa]="'aberta-' + i">
                <span class="etapa__ordem numeros" aria-hidden="true">{{ i + 1 }}</span>
                <app-campo-texto
                  class="etapa__nome"
                  [rotulo]="'Nome da etapa ' + (i + 1)"
                  rotuloOculto
                  [maximoCaracteres]="nomeMaximo"
                  [erro]="exibir(erros().abertas[i], 'abertas')"
                  [valor]="linha.nome"
                  (valorChange)="editarAberta(linha.chave, $event)"
                />
                <span class="etapa__botoes">
                  <button
                    appBotaoIcone
                    type="button"
                    variante="contorno"
                    tamanho="sm"
                    [icone]="icones.subir"
                    [rotulo]="'Subir a etapa ' + (i + 1)"
                    [disabled]="primeira"
                    (click)="mover(i, -1)"
                  ></button>
                  <button
                    appBotaoIcone
                    type="button"
                    variante="contorno"
                    tamanho="sm"
                    [icone]="icones.descer"
                    [rotulo]="'Descer a etapa ' + (i + 1)"
                    [disabled]="ultima"
                    (click)="mover(i, 1)"
                  ></button>
                  <button
                    appBotaoIcone
                    type="button"
                    variante="contorno"
                    tamanho="sm"
                    [icone]="icones.remover"
                    [rotulo]="'Remover a etapa ' + (i + 1)"
                    [disabled]="abertas().length <= 1"
                    (click)="remover(linha.chave)"
                  ></button>
                </span>
              </li>
            }
          </ol>
          <div>
            <button
              appBotao
              type="button"
              variante="contorno"
              tamanho="sm"
              [icone]="icones.adicionar"
              [disabled]="totalDeEtapas() >= etapasMaximo"
              (click)="adicionar()"
            >
              Adicionar etapa
            </button>
          </div>
          @if (erros().etapas; as mensagem) {
            <p class="erro" role="alert">{{ mensagem }}</p>
          }
          <div class="etapas__fim">
            <app-campo-texto
              rotulo="Etapa de ganho"
              ajuda="Todo funil tem exatamente uma etapa de ganho: o negócio que chega aqui é um negócio ganho."
              [maximoCaracteres]="nomeMaximo"
              [erro]="exibir(erros().ganho, 'ganho')"
              [valor]="ganho()"
              (valorChange)="ganho.set(texto($event))"
            />
            <app-campo-texto
              rotulo="Etapa de perda"
              ajuda="Todo funil tem exatamente uma etapa de perda: ao entrar nela o CRM pede o motivo."
              [maximoCaracteres]="nomeMaximo"
              [erro]="exibir(erros().perda, 'perda')"
              [valor]="perda()"
              (valorChange)="perda.set(texto($event))"
            />
          </div>
        </fieldset>

        @if (erroGeral(); as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
        }

        <div class="acoes">
          <button appBotao type="submit" variante="invertido" [carregando]="salvando()">
            Criar funil
          </button>
          <a appBotao variante="contorno" routerLink="/configuracoes/funis">Cancelar</a>
        </div>
      </form>
    </section>
  `,
  styleUrl: './novo-funil.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioNovoFunil {
  private readonly api = inject(FunisApi);
  private readonly avisos = inject(AvisosService);
  private readonly router = inject(Router);
  private readonly sessao = inject(SessaoService);
  protected readonly setores = inject(SetoresService);

  protected readonly icones = {
    subir: LucideArrowUp,
    descer: LucideArrowDown,
    remover: LucideX,
    adicionar: LucidePlus,
  };
  protected readonly nomeMaximo = NOME_MAXIMO;
  protected readonly descricaoMaxima = DESCRICAO_MAXIMA;
  protected readonly etapasMaximo = ETAPAS_MAXIMO;
  protected readonly opcoesVisibilidade = OPCOES_VISIBILIDADE;

  private proximaChave = 0;
  protected readonly nome = signal('');
  /** Admin e C-level escolhem; o líder fica com o próprio setor (fixo). */
  protected readonly escolheSetor = computed(() => ehDiretoria(this.sessao.usuario()));
  private readonly areaEscolhida = signal<string | null>(null);
  protected readonly area = computed(() =>
    this.escolheSetor() ? this.areaEscolhida() : this.sessao.area(),
  );
  protected readonly descricao = signal('');
  protected readonly visibilidade = signal<VisibilidadeFunil>('SETOR');
  protected readonly abertas = signal<readonly LinhaAberta[]>(
    ETAPAS_ABERTAS_INICIAIS.map((nome) => ({ chave: this.proximaChave++, nome })),
  );
  protected readonly ganho = signal(NOME_GANHO_INICIAL);
  protected readonly perda = signal(NOME_PERDA_INICIAL);

  protected readonly tentou = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  /** Mensagens da API por campo (`nome`, `area`, `descricao`, `etapas`). */
  protected readonly errosDaApi = signal<Readonly<Record<string, string>>>({});

  protected readonly rascunho = computed<RascunhoDeFunil>(() => ({
    nome: this.nome(),
    area: this.area(),
    descricao: this.descricao(),
    abertas: this.abertas().map((linha) => linha.nome),
    ganho: this.ganho(),
    perda: this.perda(),
  }));
  protected readonly erros = computed(() => validarRascunhoDeFunil(this.rascunho()));
  protected readonly totalDeEtapas = computed(() => this.abertas().length + 2);
  protected readonly nomeDoSetorFixo = computed(
    () => this.sessao.nomeSetor() ?? this.setores.nome(this.sessao.area()),
  );

  constructor() {
    void this.setores.carregar();
  }

  /** O erro de validação só aparece depois de tentar salvar; o da API sempre (por campo). */
  protected exibir(validacao: string | null | undefined, campo: string): string | null {
    return this.errosDaApi()[campo] ?? (this.tentou() ? (validacao ?? null) : null);
  }

  protected texto(valor: ValorCampoTexto): string {
    return String(valor ?? '');
  }

  private limparErroDaApi(campo: string): void {
    if (this.errosDaApi()[campo]) {
      this.errosDaApi.update(({ [campo]: _, ...resto }) => resto);
    }
    this.erroGeral.set(null);
  }

  protected editarNome(valor: ValorCampoTexto): void {
    this.nome.set(this.texto(valor));
    this.limparErroDaApi('nome');
  }

  protected escolherSetor(area: string | null): void {
    this.areaEscolhida.set(area);
    this.limparErroDaApi('area');
  }

  protected escolherVisibilidade(valor: VisibilidadeFunil | null): void {
    if (valor) {
      this.visibilidade.set(valor);
    }
  }

  protected editarAberta(chave: number, valor: ValorCampoTexto): void {
    this.abertas.update((linhas) =>
      linhas.map((linha) =>
        linha.chave === chave ? { ...linha, nome: this.texto(valor) } : linha,
      ),
    );
  }

  protected adicionar(): void {
    this.abertas.update((linhas) => [...linhas, { chave: this.proximaChave++, nome: '' }]);
  }

  protected remover(chave: number): void {
    this.abertas.update((linhas) =>
      linhas.length > 1 ? linhas.filter((linha) => linha.chave !== chave) : linhas,
    );
  }

  protected mover(indice: number, passo: -1 | 1): void {
    const destino = indice + passo;
    this.abertas.update((linhas) => {
      if (destino < 0 || destino >= linhas.length) {
        return linhas;
      }
      const nova = [...linhas];
      [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
      return nova;
    });
  }

  protected async salvar(): Promise<void> {
    this.tentou.set(true);
    this.erroGeral.set(null);
    this.errosDaApi.set({});
    if (temErrosDeFunil(this.erros()) || this.salvando()) {
      return;
    }
    const rascunho = this.rascunho();
    this.salvando.set(true);
    try {
      const descricao = rascunho.descricao.trim();
      const funil = await this.api.criarFunil({
        nome: rascunho.nome.trim(),
        area: rascunho.area!,
        descricao: descricao || null,
        visibilidade: this.visibilidade(),
        etapas: etapasDoRascunho(rascunho),
      });
      this.avisos.sucesso(`Funil “${funil.nome}” criado.`);
      await this.router.navigate(['/funis', slugDaArea(funil.area)], {
        queryParams: { funil: funil.id },
      });
    } catch (falha) {
      this.mostrarErro(erroDaApi(falha));
    } finally {
      this.salvando.set(false);
    }
  }

  /** Põe a mensagem da API no campo certo; o que não é de um campo vai embaixo do formulário. */
  private mostrarErro(erro: ErroApi): void {
    const porCampo: Record<string, string> = {};
    for (const { campo } of erro.campos) {
      const mensagem = erro.mensagemDoCampo(campo);
      if (mensagem) {
        porCampo[campo.startsWith('etapas') ? 'etapas' : campo] = mensagem;
      }
    }
    const campoDaRegra = erro.detalhes?.['campo'];
    if (erro.regra === 'R1.9' || campoDaRegra === 'area') {
      porCampo['area'] = erro.mensagem;
    } else if (erro.status === 409 && !Object.keys(porCampo).length) {
      porCampo['nome'] = erro.mensagem;
    }
    this.errosDaApi.set(porCampo);
    const etapas = porCampo['etapas'];
    if (etapas || !Object.keys(porCampo).filter((chave) => chave !== 'etapas').length) {
      this.erroGeral.set(etapas ?? erro.mensagem);
    }
  }
}
