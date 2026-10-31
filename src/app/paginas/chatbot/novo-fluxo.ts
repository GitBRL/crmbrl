import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { ChatbotApi } from './chatbot.api';
import { ContextoEditor } from './contexto-editor';
import { textoParaLista } from './definicao';
import { DADOS_PADRAO, type DadosDoFluxo, FormularioFluxo } from './formulario-fluxo';

/** `/chatbot/novo`: dados do fluxo; ao criar, abre o editor para montar os passos. */
@Component({
  selector: 'app-novo-fluxo',
  imports: [Botao, Cartao, EstadoVazio, FormularioFluxo, RouterLink],
  providers: [ContextoEditor],
  template: `
    <header class="cabecalho">
      <h1 class="texto-display">Novo fluxo</h1>
      <p class="cabecalho__frase">
        Comece pelo básico. Os passos da conversa você monta na próxima tela, e o fluxo só atende
        clientes depois de publicado.
      </p>
    </header>
    <app-cartao>
      @if (falhaGeral(); as falha) {
        <app-estado-vazio
          variante="erro"
          [falha]="falha"
          titulo="Não conseguimos criar o fluxo"
          [texto]="falha.resumo"
          [manterAcoes]="true"
        >
          <button appBotao type="button" variante="invertido" (click)="falhaGeral.set(null)">
            Voltar ao formulário
          </button>
        </app-estado-vazio>
      } @else {
        <form (submit)="criar($event)" novalidate>
          <app-formulario-fluxo [(dados)]="dados" [erros]="erros()" />
          <div class="acoes">
            <button appBotao type="submit" variante="destaque" [carregando]="salvando()">
              Criar e montar os passos
            </button>
            <a appBotao variante="contorno" routerLink="/chatbot">Cancelar</a>
          </div>
        </form>
      }
    </app-cartao>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-6);
      max-width: var(--largura-pagina, 1600px);
    }

    .cabecalho {
      display: grid;
      gap: var(--esp-3);
    }

    .cabecalho__frase {
      max-width: 60ch;
      margin: 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-lead);
    }

    .acoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-3);
      margin-top: var(--esp-6);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NovoFluxo {
  private readonly api = inject(ChatbotApi);
  private readonly avisos = inject(AvisosService);
  private readonly router = inject(Router);
  private readonly contexto = inject(ContextoEditor);

  protected readonly dados = signal<DadosDoFluxo>(DADOS_PADRAO);
  protected readonly erros = signal<Record<string, string>>({});
  protected readonly salvando = signal(false);
  protected readonly falhaGeral = signal<ErroApi | null>(null);

  constructor() {
    void this.contexto.carregarApoio();
  }

  protected async criar(evento: Event): Promise<void> {
    evento.preventDefault();
    const d = this.dados();
    const palavras = textoParaLista(d.palavrasChave);
    const erros: Record<string, string> = {};
    if (!d.nome.trim()) {
      erros['nome'] = 'Dê um nome ao fluxo.';
    }
    if (d.gatilho === 'PALAVRA_CHAVE' && palavras.length === 0) {
      erros['palavrasChave'] = 'Informe ao menos uma palavra.';
    }
    this.erros.set(erros);
    if (Object.keys(erros).length > 0) {
      return;
    }
    this.salvando.set(true);
    try {
      const fluxo = await this.api.criar({
        nome: d.nome.trim(),
        ...(d.descricao.trim() ? { descricao: d.descricao.trim() } : {}),
        gatilho: d.gatilho,
        ...(d.gatilho === 'PALAVRA_CHAVE' ? { palavrasChave: palavras } : {}),
        prioridade: d.prioridade,
        canalIds: [...d.canalIds],
      });
      this.avisos.sucesso('Fluxo criado. Agora monte os passos.');
      await this.router.navigate(['/chatbot', fluxo.id]);
    } catch (falha) {
      const erro = erroDaApi(falha);
      if (erro.status === 400 && erro.campos.length > 0) {
        this.erros.set(Object.fromEntries(erro.campos.map((c) => [c.campo, c.mensagens[0]])));
      } else {
        this.falhaGeral.set(erro);
      }
    } finally {
      this.salvando.set(false);
    }
  }
}
