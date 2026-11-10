import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { LucideX } from '@lucide/angular';

import { Botao } from '../botao/botao';
import { BotaoIcone } from '../botao-icone/botao-icone';
import { CampoTexto } from '../campo-texto/campo-texto';
import { GrupoOpcoes, type OpcaoGrupo } from '../grupo-opcoes/grupo-opcoes';
import { type OpcaoSeletor, Seletor } from '../seletor/seletor';
import { Selo } from '../selo/selo';

/** Nível de um acesso extra (o `CONFIGURAR` nunca se concede por acesso). */
export type NivelDoAcesso = 'VER' | 'MEMBRO' | 'GESTOR';

export const NIVEIS_DE_ACESSO: readonly NivelDoAcesso[] = ['VER', 'MEMBRO', 'GESTOR'];

export const ROTULO_NIVEL_ACESSO: Readonly<Record<NivelDoAcesso, string>> = {
  VER: 'Só ver',
  MEMBRO: 'Como membro',
  GESTOR: 'Ver e editar todos',
};

/** O que cada nível de acesso extra faz. */
export const DICA_NIVEL: Readonly<Record<NivelDoAcesso, string>> = {
  VER: 'Vê todos os negócios, mas não cria, edita nem move nada.',
  MEMBRO: 'Vê os negócios dele e os sem responsável; cria, edita e move esses.',
  GESTOR: 'Vê, cria, edita e move todos os negócios e troca o responsável.',
};

export const OPCOES_NIVEL_ACESSO: readonly OpcaoSeletor<NivelDoAcesso>[] = NIVEIS_DE_ACESSO.map(
  (nivel) => ({ valor: nivel, rotulo: ROTULO_NIVEL_ACESSO[nivel] }),
);

/** Uma linha da lista que está sendo editada (ainda não salva). */
export interface LinhaEditavel {
  readonly chave: string;
  readonly alvo: 'SETOR' | 'PESSOA';
  /** Chave do setor (alvo `SETOR`) ou id da pessoa (alvo `PESSOA`). */
  readonly id: string;
  readonly nome: string;
  /** "Líder Comercial" para pessoas; vazio para setores. */
  readonly detalhe: string;
  readonly nivel: NivelDoAcesso;
  /** Setor desativado ou pessoa desligada (R5.11: pode ficar, mas não entra de novo). */
  readonly inativo: boolean;
}

/** Forma mínima de um acesso vindo da API (funil ou setor), sem depender de nenhuma tela. */
export interface AcessoDaApi {
  readonly alvo: 'SETOR' | 'PESSOA';
  readonly area: string | null;
  readonly nomeSetor: string | null;
  readonly setorAtivo: boolean | null;
  readonly nivel: NivelDoAcesso;
  readonly usuario: {
    readonly id: string;
    readonly nome: string;
    readonly rotuloPapel: string;
    readonly ativo: boolean;
  } | null;
}

/** A lista da API como linhas editáveis. */
export function linhasDeAcessos(acessos: readonly AcessoDaApi[]): readonly LinhaEditavel[] {
  return acessos.map((acesso) =>
    acesso.alvo === 'SETOR'
      ? {
          chave: `setor:${acesso.area}`,
          alvo: 'SETOR' as const,
          id: acesso.area ?? '',
          nome: acesso.nomeSetor ?? acesso.area ?? '',
          detalhe: '',
          nivel: acesso.nivel,
          inativo: acesso.setorAtivo === false,
        }
      : {
          chave: `pessoa:${acesso.usuario?.id}`,
          alvo: 'PESSOA' as const,
          id: acesso.usuario?.id ?? '',
          nome: acesso.usuario?.nome ?? 'Pessoa removida',
          detalhe: acesso.usuario?.rotuloPapel ?? '',
          nivel: acesso.nivel,
          inativo: acesso.usuario?.ativo === false,
        },
  );
}

/** Um setor que pode receber acesso. */
export interface SetorEscolhivel {
  readonly chave: string;
  readonly nome: string;
}

/** Uma pessoa que pode receber acesso. */
export interface PessoaEscolhivel {
  readonly id: string;
  readonly nome: string;
  /** "Customer Success", "Líder Comercial". */
  readonly rotulo: string;
  /** Chave do setor da pessoa, se tiver. */
  readonly area?: string | null;
}

/** Uma linha de `GET /usuarios/opcoes` (`OpcaoUsuarioDto`): pessoa ativa de qualquer setor. */
export interface OpcaoDePessoa {
  readonly id: string;
  readonly nome: string;
  readonly avatarUrl?: string | null;
  readonly papel: string;
  readonly rotuloPapel: string;
  readonly area?: string | null;
  readonly nomeSetor?: string | null;
}

/** A pessoa como escolha: "Líder Comercial" ou "Membro · Customer Success". */
export function pessoaEscolhivel(opcao: OpcaoDePessoa): PessoaEscolhivel {
  const setor = opcao.nomeSetor?.trim();
  const papel = opcao.rotuloPapel?.trim() ?? '';
  const rotulo =
    setor && !papel.toLowerCase().includes(setor.toLowerCase())
      ? [papel, setor].filter(Boolean).join(' · ')
      : papel;
  return { id: opcao.id, nome: opcao.nome, rotulo, area: opcao.area ?? null };
}

/** Espera depois da última tecla antes de buscar pessoas. */
export const ESPERA_BUSCA_PESSOA_MS = 250;

/** Corpo de uma linha do `PUT .../acessos`: um alvo e o nível. */
export interface LinhaParaApi {
  readonly area?: string;
  readonly usuarioId?: string;
  readonly nivel: NivelDoAcesso;
}

export function corpoDosAcessos(linhas: readonly LinhaEditavel[]): readonly LinhaParaApi[] {
  return linhas.map((linha) =>
    linha.alvo === 'SETOR'
      ? { area: linha.id, nivel: linha.nivel }
      : { usuarioId: linha.id, nivel: linha.nivel },
  );
}

/** Mudou algo (alvo ou nível)? A ordem não conta. */
export function acessosAlterados(
  atuais: readonly LinhaEditavel[],
  salvos: readonly LinhaEditavel[],
): boolean {
  const assinar = (linhas: readonly LinhaEditavel[]) =>
    linhas
      .map((linha) => `${linha.chave}=${linha.nivel}`)
      .sort()
      .join('|');
  return assinar(atuais) !== assinar(salvos);
}

/** Acrescenta (ou atualiza o nível, se o alvo já está na lista). */
export function comAcesso(
  linhas: readonly LinhaEditavel[],
  nova: LinhaEditavel,
): readonly LinhaEditavel[] {
  return linhas.some((linha) => linha.chave === nova.chave)
    ? linhas.map((linha) => (linha.chave === nova.chave ? { ...linha, nivel: nova.nivel } : linha))
    : [...linhas, nova];
}

type TipoDeAlvo = 'SETOR' | 'PESSOA';

const OPCOES_ALVO: readonly OpcaoGrupo<TipoDeAlvo>[] = [
  { valor: 'SETOR', rotulo: 'Um setor inteiro' },
  { valor: 'PESSOA', rotulo: 'Uma pessoa' },
];

/**
 * Editor de acessos extras (R5.11), sem falar com a API: o pai passa a lista (`[(linhas)]`), os
 * setores e as pessoas que dá para escolher, e cuida de carregar e salvar. Adicionar, trocar o
 * nível e remover mudam `linhas`; "Salvar acessos" emite `salvar` e "Descartar" emite `descartar`
 * (o pai devolve a lista salva). Alvo inativo aparece marcado. Os setores e pessoas já listados
 * somem das escolhas.
 *
 * ```html
 * <app-editor-de-acessos [(linhas)]="linhas" [setores]="setores" [pessoas]="pessoas"
 *   [alterado]="alterado()" [salvando]="salvando()" [erroGeral]="erro()"
 *   [errosDasLinhas]="errosPorChave()" aviso="..." (salvar)="salvar()" (descartar)="descartar()" />
 * ```
 */
@Component({
  selector: 'app-editor-de-acessos',
  imports: [Botao, BotaoIcone, CampoTexto, GrupoOpcoes, Selo, Seletor],
  template: `
    <div class="acessos">
      @if (aviso(); as textoAviso) {
        <p class="acessos__aviso" role="note">
          {{ textoAviso }}
        </p>
      }

      @if (linhas().length === 0) {
        <p class="acessos__vazio">
          Nenhum acesso extra. Só quem já vê pelo setor dono (e o C-level e o Admin) enxerga.
        </p>
      } @else {
        <ul class="acessos__lista" aria-label="Acessos extras">
          @for (linha of linhas(); track linha.chave) {
            <li class="acesso" [attr.data-acesso]="linha.chave">
              <div class="acesso__quem">
                <p class="acesso__nome">
                  {{ linha.nome }}
                  <app-selo variante="contorno" tamanho="sm">{{
                    linha.alvo === 'SETOR' ? 'Setor' : 'Pessoa'
                  }}</app-selo>
                  @if (linha.inativo) {
                    <app-selo variante="coral" tamanho="sm">{{
                      linha.alvo === 'SETOR' ? 'Setor desativado' : 'Pessoa desligada'
                    }}</app-selo>
                  }
                </p>
                @if (linha.detalhe) {
                  <p class="acesso__detalhe">{{ linha.detalhe }}</p>
                }
                @if (erroDaLinha(linha); as mensagem) {
                  <p class="acesso__erro" role="alert">{{ mensagem }}</p>
                }
              </div>
              <app-seletor
                class="acesso__nivel"
                [rotulo]="'Nível de ' + linha.nome"
                rotuloOculto
                [opcoes]="opcoesNivel"
                [valor]="linha.nivel"
                (valorChange)="trocarNivel(linha.chave, $event)"
              />
              <button
                appBotaoIcone
                type="button"
                variante="contorno"
                tamanho="sm"
                [icone]="iconeRemover"
                [rotulo]="'Remover o acesso de ' + linha.nome"
                (click)="remover(linha.chave)"
              ></button>
            </li>
          }
        </ul>
      }

      <fieldset class="novo">
        <legend class="novo__titulo">Dar acesso a…</legend>
        <app-grupo-opcoes
          rotulo="Quem recebe o acesso"
          disposicao="pilulas"
          [opcoes]="opcoesAlvo"
          [valor]="tipo()"
          (valorChange)="escolherTipo($event)"
        />
        <div class="novo__campos">
          @if (tipo() === 'SETOR') {
            <app-seletor
              rotulo="Setor"
              placeholder="Escolha o setor"
              [opcoes]="opcoesDeSetor()"
              [valor]="escolhido()"
              (valorChange)="escolhido.set($event)"
            />
          } @else {
            <app-campo-texto
              rotulo="Buscar pessoa"
              placeholder="Digite parte do nome"
              autocomplete="off"
              [valor]="busca()"
              (valorChange)="digitarBusca($event)"
            />
            <app-seletor
              rotulo="Pessoa"
              placeholder="Escolha a pessoa"
              [opcoes]="opcoesDePessoa()"
              [valor]="escolhido()"
              (valorChange)="escolherPessoa($event)"
            />
          }
          <app-seletor
            rotulo="Nível do acesso"
            [ajuda]="dicaDoNivel()"
            [opcoes]="opcoesNivel"
            [valor]="nivelNovo()"
            (valorChange)="nivelNovo.set($event ?? 'VER')"
          />
          <button
            appBotao
            type="button"
            variante="contorno"
            class="novo__botao"
            [disabled]="!escolhido()"
            (click)="adicionar()"
          >
            Adicionar
          </button>
        </div>
        <p class="novo__dica">{{ dicaDoNivel() }}</p>
      </fieldset>

      @if (erroGeral(); as mensagem) {
        <p class="acessos__erro" role="alert">{{ mensagem }}</p>
      }
      <div class="acessos__acoes">
        <button
          appBotao
          type="button"
          variante="invertido"
          [disabled]="!alterado()"
          [carregando]="salvando()"
          (click)="salvar.emit()"
        >
          Salvar acessos
        </button>
        @if (alterado()) {
          <button appBotao type="button" variante="contorno" (click)="descartar.emit()">
            Descartar
          </button>
        }
      </div>
    </div>
  `,
  styleUrl: './editor-de-acessos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorDeAcessos {
  /** A lista que está na tela (`[(linhas)]`). */
  readonly linhas = model<readonly LinhaEditavel[]>([]);
  /** Setores que dá para escolher (sem o dono, sem os inativos). */
  readonly setores = input<readonly SetorEscolhivel[]>([]);
  /** Pessoas que dá para escolher (o resultado da última busca). */
  readonly pessoas = input<readonly PessoaEscolhivel[]>([]);
  /** Há mudança a salvar (habilita "Salvar acessos" e mostra "Descartar"). */
  readonly alterado = input(false);
  readonly salvando = input(false);
  readonly erroGeral = input<string | null>(null);
  /** Mensagens por linha, pela `chave` da linha. */
  readonly errosDasLinhas = input<Readonly<Record<string, string>>>({});
  /** Aviso fixo acima da lista (ex.: funil restrito). */
  readonly aviso = input<string | null>(null);

  /** O texto da busca de pessoas mudou (já com a espera de 250 ms); o pai busca e atualiza `pessoas`. */
  readonly buscarPessoas = output<string>();
  readonly salvar = output<void>();
  readonly descartar = output<void>();

  protected readonly iconeRemover = LucideX;
  protected readonly opcoesNivel = OPCOES_NIVEL_ACESSO;
  protected readonly opcoesAlvo = OPCOES_ALVO;

  protected readonly tipo = signal<TipoDeAlvo>('SETOR');
  protected readonly escolhido = signal<string | null>(null);
  protected readonly busca = signal('');
  /** A pessoa escolhida fica guardada: nova busca pode tirá-la da lista de resultados. */
  private readonly pessoaEscolhida = signal<PessoaEscolhivel | null>(null);
  private espera: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.espera) {
        clearTimeout(this.espera);
      }
    });
  }
  protected readonly nivelNovo = signal<NivelDoAcesso>('VER');

  protected readonly dicaDoNivel = computed(() => DICA_NIVEL[this.nivelNovo()]);

  private readonly usados = computed(() => new Set(this.linhas().map((linha) => linha.chave)));

  protected readonly opcoesDeSetor = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.setores()
      .filter((setor) => !this.usados().has(`setor:${setor.chave}`))
      .map((setor) => ({ valor: setor.chave, rotulo: setor.nome })),
  );

  protected readonly opcoesDePessoa = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.listaDePessoas()
      .filter((pessoa) => !this.usados().has(`pessoa:${pessoa.id}`))
      .map((pessoa) => ({
        valor: pessoa.id,
        rotulo: pessoa.rotulo ? `${pessoa.nome} · ${pessoa.rotulo}` : pessoa.nome,
      })),
  );

  private readonly listaDePessoas = computed<readonly PessoaEscolhivel[]>(() => {
    const lista = this.pessoas();
    const escolhida = this.pessoaEscolhida();
    return escolhida && !lista.some((pessoa) => pessoa.id === escolhida.id)
      ? [escolhida, ...lista]
      : lista;
  });

  protected erroDaLinha(linha: LinhaEditavel): string | null {
    return this.errosDasLinhas()[linha.chave] ?? null;
  }

  protected escolherTipo(tipo: TipoDeAlvo | null): void {
    if (tipo) {
      this.tipo.set(tipo);
      this.escolhido.set(null);
      this.pessoaEscolhida.set(null);
    }
  }

  protected digitarBusca(valor: string | number | null): void {
    const texto = String(valor ?? '');
    this.busca.set(texto);
    if (this.espera) {
      clearTimeout(this.espera);
    }
    this.espera = setTimeout(() => {
      this.espera = null;
      this.buscarPessoas.emit(texto.trim());
    }, ESPERA_BUSCA_PESSOA_MS);
  }

  protected escolherPessoa(id: string | null): void {
    this.escolhido.set(id);
    this.pessoaEscolhida.set(id ? (this.pessoas().find((item) => item.id === id) ?? null) : null);
  }

  protected adicionar(): void {
    const id = this.escolhido();
    if (!id) {
      return;
    }
    const nivel = this.nivelNovo();
    let nova: LinhaEditavel | null = null;
    if (this.tipo() === 'SETOR') {
      const setor = this.setores().find((item) => item.chave === id);
      nova = setor
        ? {
            chave: `setor:${id}`,
            alvo: 'SETOR',
            id,
            nome: setor.nome,
            detalhe: '',
            nivel,
            inativo: false,
          }
        : null;
    } else {
      const pessoa = this.listaDePessoas().find((item) => item.id === id);
      nova = pessoa
        ? {
            chave: `pessoa:${id}`,
            alvo: 'PESSOA',
            id,
            nome: pessoa.nome,
            detalhe: pessoa.rotulo,
            nivel,
            inativo: false,
          }
        : null;
    }
    if (nova) {
      this.linhas.update((linhas) => comAcesso(linhas, nova));
      this.escolhido.set(null);
      this.pessoaEscolhida.set(null);
    }
  }

  protected trocarNivel(chave: string, nivel: NivelDoAcesso | null): void {
    if (nivel) {
      this.linhas.update((linhas) =>
        linhas.map((linha) => (linha.chave === chave ? { ...linha, nivel } : linha)),
      );
    }
  }

  protected remover(chave: string): void {
    this.linhas.update((linhas) => linhas.filter((linha) => linha.chave !== chave));
  }
}
