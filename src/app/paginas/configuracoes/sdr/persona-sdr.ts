import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideRefreshCw, LucideSave } from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { AreaTexto } from '../../../ui/area-texto/area-texto';
import { Botao } from '../../../ui/botao/botao';
import { CampoTexto } from '../../../ui/campo-texto/campo-texto';
import { Cartao } from '../../../ui/cartao/cartao';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { textoOuNulo } from './rotulos';
import { SdrConfigApi } from './sdr.api';
import type { ConfiguracaoSdr } from './sdr.tipos';

export const LIMITES_PERSONA = {
  nome: { min: 2, max: 40 },
  tom: { min: 3, max: 400 },
  apresentacao: { min: 5, max: 300 },
  passagem: { min: 5, max: 500 },
} as const;

/** Por que o texto não serve (ou `null`), com o limite de tamanho da API. */
export function erroDeTexto(valor: string, limite: { min: number; max: number }): string | null {
  const tamanho = valor.trim().length;
  if (tamanho < limite.min) {
    return `Escreva pelo menos ${limite.min} caracteres.`;
  }
  return tamanho > limite.max ? `Use no máximo ${limite.max} caracteres.` : null;
}

/** Configurações → SDR com IA → Persona: nome, tom, apresentação e mensagem de passagem. */
@Component({
  selector: 'app-persona-sdr',
  imports: [AreaTexto, Botao, CampoTexto, Cartao, Esqueleto, EstadoVazio],
  template: `
    <div class="parte">
      @if (erro(); as falha) {
        <app-estado-vazio
          variante="erro"
          titulo="Não conseguimos carregar a persona"
          [falha]="falha"
          [texto]="falha.resumo"
          [codigo]="falha.ehFalhaDoServidor ? falha.requisicaoId : null"
        >
          <button appBotao type="button" variante="invertido" (click)="carregar()">
            Tentar de novo
          </button>
        </app-estado-vazio>
      } @else if (config() === null) {
        <app-cartao>
          <div class="esqueleto" aria-busy="true">
            <p class="visualmente-oculto" role="status">Carregando a persona…</p>
            <app-esqueleto largura="35%" />
            <app-esqueleto forma="bloco" altura="44px" />
            <app-esqueleto forma="bloco" altura="96px" />
          </div>
        </app-cartao>
      } @else {
        <form class="formulario" (submit)="$event.preventDefault(); salvar()">
          <app-cartao>
            <div class="bloco">
              <h3 class="titulo">Quem conversa com o lead</h3>
              <p class="texto">
                A IA sempre se apresenta como assistente virtual, nunca como uma pessoa.
              </p>
              <app-campo-texto
                rotulo="Nome da assistente"
                dica="Por exemplo: Bia."
                [maximoCaracteres]="limites.nome.max"
                [erro]="erroNome() ?? erroDoCampo('nomeAssistente')"
                [(valor)]="nome"
              />
              <app-area-texto
                rotulo="Tom da conversa"
                dica="Como ela fala: simpática, objetiva, formal…"
                [linhas]="3"
                [maximoCaracteres]="limites.tom.max"
                [erro]="erroTom() ?? erroDoCampo('tom')"
                [(valor)]="tom"
              />
              <app-area-texto
                rotulo="Apresentação"
                dica="A primeira frase do SDR. Exemplo: Sou a Bia, assistente virtual da BRL."
                [linhas]="2"
                [maximoCaracteres]="limites.apresentacao.max"
                [erro]="erroApresentacao() ?? erroDoCampo('apresentacao')"
                [(valor)]="apresentacao"
              />
              <app-area-texto
                rotulo="Mensagem ao passar para uma pessoa"
                dica="O que o lead lê quando a conversa vai para a equipe."
                [linhas]="3"
                [maximoCaracteres]="limites.passagem.max"
                [erro]="erroPassagem() ?? erroDoCampo('mensagemPassagem')"
                [(valor)]="passagem"
              />
            </div>
          </app-cartao>
          @if (erroSalvar(); as falha) {
            <p class="erro" role="alert">Não foi possível salvar. {{ falha.resumo }}</p>
          }
          <div class="rodape">
            <button
              appBotao
              type="submit"
              variante="invertido"
              [icone]="iconeSalvar"
              [carregando]="salvando()"
              [disabled]="!podeSalvar()"
            >
              Salvar persona
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styleUrl: './sdr-comum.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonaSdr {
  private readonly api = inject(SdrConfigApi);
  private readonly avisos = inject(AvisosService);

  protected readonly limites = LIMITES_PERSONA;
  protected readonly iconeSalvar = LucideSave;
  protected readonly iconeTentar = LucideRefreshCw;

  protected readonly config = signal<ConfiguracaoSdr | null>(null);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly erroSalvar = signal<ErroApi | null>(null);
  protected readonly salvando = signal(false);

  protected readonly nome = signal<string | number>('');
  protected readonly tom = signal('');
  protected readonly apresentacao = signal('');
  protected readonly passagem = signal('');

  protected readonly erroNome = computed(() =>
    erroDeTexto(textoOuNulo(this.nome()), this.limites.nome),
  );
  protected readonly erroTom = computed(() => erroDeTexto(this.tom(), this.limites.tom));
  protected readonly erroApresentacao = computed(() =>
    erroDeTexto(this.apresentacao(), this.limites.apresentacao),
  );
  protected readonly erroPassagem = computed(() =>
    erroDeTexto(this.passagem(), this.limites.passagem),
  );
  protected readonly podeSalvar = computed(
    () =>
      !this.salvando() &&
      !this.erroNome() &&
      !this.erroTom() &&
      !this.erroApresentacao() &&
      !this.erroPassagem(),
  );

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    this.erro.set(null);
    try {
      this.aplicar((await this.api.geral()).configuracao);
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    }
  }

  private aplicar(c: ConfiguracaoSdr): void {
    this.config.set(c);
    this.nome.set(c.nomeAssistente);
    this.tom.set(c.tom);
    this.apresentacao.set(c.apresentacao);
    this.passagem.set(c.mensagemPassagem);
    this.erroSalvar.set(null);
  }

  protected async salvar(): Promise<void> {
    if (!this.podeSalvar()) {
      return;
    }
    this.salvando.set(true);
    this.erroSalvar.set(null);
    try {
      this.aplicar(
        await this.api.salvarGeral({
          nomeAssistente: textoOuNulo(this.nome()),
          tom: this.tom().trim(),
          apresentacao: this.apresentacao().trim(),
          mensagemPassagem: this.passagem().trim(),
        }),
      );
      this.avisos.sucesso('Persona salva.');
    } catch (falha) {
      this.erroSalvar.set(erroDaApi(falha));
    } finally {
      this.salvando.set(false);
    }
  }

  protected erroDoCampo(caminho: string): string | null {
    return this.erroSalvar()?.mensagemDoCampo(caminho) ?? null;
  }
}
