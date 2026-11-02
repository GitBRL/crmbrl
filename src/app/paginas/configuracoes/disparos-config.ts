import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideRefreshCw, LucideX } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { Alternador } from '../../ui/alternador/alternador';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Cartao } from '../../ui/cartao/cartao';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { DisparosApi } from '../disparos/disparos.api';
import type { ConfiguracaoDisparos } from '../disparos/disparos.tipos';
import { Carregamento } from './carregamento';

export const MAXIMO_PALAVRAS = 30;
export const MAXIMO_LETRAS_PALAVRA = 40;
export const MAXIMO_LETRAS_MENSAGEM = 1000;

/** Palavra de saída como a pessoa digitou: sem espaços nas pontas, em maiúsculas. */
export function normalizarPalavra(texto: string): string {
  return texto.trim().toUpperCase();
}

/** Por que a palavra não entra na lista (ou `null` se pode entrar). */
export function motivoDaPalavra(texto: string, atuais: readonly string[]): string | null {
  const palavra = normalizarPalavra(texto);
  if (!palavra) return 'Digite a palavra.';
  if (palavra.length > MAXIMO_LETRAS_PALAVRA) {
    return `Use até ${MAXIMO_LETRAS_PALAVRA} letras.`;
  }
  if (atuais.includes(palavra)) return 'Essa palavra já está na lista.';
  if (atuais.length >= MAXIMO_PALAVRAS) return `A lista aceita até ${MAXIMO_PALAVRAS} palavras.`;
  return null;
}

/**
 * Disparos (`/configuracoes/disparos`, Admin e C-level): se a campanha de um membro precisa da
 * aprovação do líder, as palavras com que o contato pede para sair (opt-out) e o texto de
 * confirmação enviado a ele. Salva por `PUT /disparos/configuracao`.
 */
@Component({
  selector: 'app-disparos-config',
  imports: [Alternador, AreaTexto, Botao, CampoTexto, Cartao, Esqueleto, EstadoVazio, LucideX],
  templateUrl: './disparos-config.html',
  styleUrl: './disparos-config.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisparosConfig {
  private readonly api = inject(DisparosApi);
  private readonly avisos = inject(AvisosService);

  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly maximoMensagem = MAXIMO_LETRAS_MENSAGEM;
  protected readonly maximoPalavra = MAXIMO_LETRAS_PALAVRA;
  protected readonly dados = new Carregamento<ConfiguracaoDisparos>();

  protected readonly aprovacao = signal(false);
  protected readonly palavras = signal<readonly string[]>([]);
  protected readonly mensagem = signal('');
  protected readonly novaPalavra = signal<string | number | null>('');
  protected readonly erroPalavra = signal<string | null>(null);
  protected readonly salvando = signal(false);
  protected readonly erroSalvar = signal<string | null>(null);
  /** Muda ao carregar/falhar: o alternador é recriado e volta ao valor real. */
  protected readonly revisao = signal(0);

  private readonly mensagemTexto = computed(() => this.mensagem().trim());
  protected readonly erroMensagem = computed(() =>
    this.mensagemTexto() ? null : 'Informe o texto de confirmação.',
  );
  protected readonly alterado = computed(() => {
    const base = this.dados.dados();
    return (
      !!base &&
      (base.aprovacaoDoLider !== this.aprovacao() ||
        base.mensagemDeSaida !== this.mensagemTexto() ||
        base.palavrasDeSaida.join('\n') !== this.palavras().join('\n'))
    );
  });
  protected readonly podeSalvar = computed(
    () =>
      this.alterado() &&
      !this.salvando() &&
      this.palavras().length > 0 &&
      this.erroMensagem() === null,
  );

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    if (await this.dados.executar(() => this.api.configuracao())) {
      this.aplicar(this.dados.dados()!);
    }
  }

  private aplicar(config: ConfiguracaoDisparos): void {
    this.aprovacao.set(config.aprovacaoDoLider);
    this.palavras.set([...config.palavrasDeSaida]);
    this.mensagem.set(config.mensagemDeSaida);
    this.novaPalavra.set('');
    this.erroPalavra.set(null);
    this.erroSalvar.set(null);
    this.revisao.update((n) => n + 1);
  }

  protected adicionar(): void {
    const texto = String(this.novaPalavra() ?? '');
    const motivo = motivoDaPalavra(texto, this.palavras());
    this.erroPalavra.set(motivo);
    if (motivo) return;
    this.palavras.update((lista) => [...lista, normalizarPalavra(texto)]);
    this.novaPalavra.set('');
  }

  protected remover(palavra: string): void {
    this.palavras.update((lista) => lista.filter((item) => item !== palavra));
    this.erroPalavra.set(null);
  }

  protected descartar(): void {
    const base = this.dados.dados();
    if (base) this.aplicar(base);
  }

  protected async salvar(): Promise<void> {
    if (!this.podeSalvar()) return;
    this.salvando.set(true);
    this.erroSalvar.set(null);
    try {
      const salva = await this.api.salvarConfiguracao({
        aprovacaoDoLider: this.aprovacao(),
        palavrasDeSaida: [...this.palavras()],
        mensagemDeSaida: this.mensagemTexto(),
      });
      await this.dados.executar(() => Promise.resolve(salva));
      this.aplicar(salva);
      this.avisos.sucesso('Configuração dos disparos salva.');
    } catch (falha) {
      this.erroSalvar.set(erroDaApi(falha).resumo);
    } finally {
      this.salvando.set(false);
    }
  }
}
