import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { LucidePaperclip, LucideSend, LucideX } from '@lucide/angular';

import { Abas, type ItemAba } from '../../../../ui/abas/abas';
import type { AparenciaDoWidget, ContatoDoFormulario } from '../canais.modelos';
import { corDeTextoPara, ehCor } from './widget';

type Vista = 'inicio' | 'conversa';
type TemaVisto = 'claro' | 'escuro';

const VISTAS: readonly ItemAba[] = [
  { id: 'inicio', rotulo: 'Antes de conversar' },
  { id: 'conversa', rotulo: 'Conversa' },
];

const TEMAS: readonly ItemAba[] = [
  { id: 'claro', rotulo: 'Claro' },
  { id: 'escuro', rotulo: 'Escuro' },
];

/**
 * Prévia do chat do site enquanto a aparência é editada (nada é salvo nem enviado): uma página
 * de mentira com o botão do chat no canto escolhido e o painel aberto, nas cores, textos, tema e
 * posição do formulário. Mostra o formulário inicial (nome, contato, consentimento) ou uma
 * conversa de exemplo.
 *
 * As cores de dentro do painel são as do próprio widget (crmbrl-api,
 * `src/canais/webchat/widget/widget-do-site.ts`), que roda no site do cliente e não usa os
 * tokens do CRM — por isso ficam aqui como propriedades locais, e não nos tokens.
 */
@Component({
  selector: 'app-previa-widget',
  imports: [Abas, LucidePaperclip, LucideSend, LucideX],
  template: `
    <div class="previa__controles">
      <app-abas
        rotulo="O que a prévia mostra"
        modo="opcoes"
        tamanho="sm"
        [abas]="vistas"
        [selecionada]="vista()"
        (selecionadaChange)="vista.set($any($event))"
      />
      @if (aparencia().tema === 'automatico') {
        <app-abas
          rotulo="Tema do visitante"
          modo="opcoes"
          tamanho="sm"
          [abas]="temas"
          [selecionada]="temaVisto()"
          (selecionadaChange)="temaVisto.set($any($event))"
        />
      }
    </div>

    <div
      class="site"
      [attr.data-widget]="tema()"
      [class.site--esquerda]="aparencia().posicao === 'esquerda'"
      [style.--w-cor]="cor()"
      [style.--w-cor-texto]="corTexto()"
      role="img"
      [attr.aria-label]="descricao()"
    >
      <div class="site__barra" aria-hidden="true">
        <span></span><span></span><span></span>
        <span class="site__endereco">www.seusite.com.br</span>
      </div>
      <div class="site__pagina" aria-hidden="true">
        <span class="site__bloco site__bloco--titulo"></span>
        <span class="site__bloco"></span>
        <span class="site__bloco site__bloco--curto"></span>
        <span class="site__bloco site__bloco--imagem"></span>
      </div>

      <div class="w" aria-hidden="true">
        <div class="w__cabecalho">
          <div class="w__textos">
            <strong>{{ aparencia().titulo || 'Fale com a gente' }}</strong>
            @if (aparencia().subtitulo) {
              <span>{{ aparencia().subtitulo }}</span>
            }
            <span class="w__situacao">Online agora</span>
          </div>
          <svg lucideX [size]="16" />
        </div>
        <div class="w__corpo">
          @if (vista() === 'inicio') {
            @if (aparencia().saudacao) {
              <p class="w__msg">{{ aparencia().saudacao }}</p>
            }
            <div class="w__form">
              <span class="w__rotulo">Seu nome</span>
              <span class="w__campo">Maria Souza</span>
              <span class="w__rotulo">{{ rotuloContato() }}</span>
              <span class="w__campo">{{ exemploContato() }}</span>
              <span class="w__consentimento">
                <span class="w__caixa"></span>
                <span>{{ consentimento() }}</span>
              </span>
              <span class="w__iniciar">Começar conversa</span>
            </div>
          } @else {
            @if (aparencia().saudacao) {
              <p class="w__msg">{{ aparencia().saudacao }}</p>
            }
            <p class="w__msg w__msg--visitante">Oi! Quero saber dos planos para a minha loja.</p>
            <p class="w__msg"><span class="w__autor">Ana</span>Claro! Quantas lojas você tem?</p>
            <p class="w__msg w__msg--visitante">Duas, por enquanto.</p>
          }
        </div>
        @if (vista() === 'conversa') {
          <div class="w__rodape">
            @if (permitirAnexos()) {
              <svg lucidePaperclip [size]="16" class="w__anexo" />
            }
            <span class="w__escrever">Escreva sua mensagem…</span>
            <span class="w__enviar"><svg lucideSend [size]="14" /></span>
          </div>
        }
      </div>
      <span class="w__lancador" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z" />
        </svg>
      </span>
    </div>
    <p class="previa__nota">Prévia: nada aqui é enviado. Salve para valer no site.</p>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: grid;
      gap: var(--esp-3);
    }

    .previa__controles {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2) var(--esp-3);
    }

    .previa__nota {
      color: var(--cor-texto-fraco);
      font: var(--fonte-legenda);
    }

    // A "página" do cliente: uma janela de navegador simplificada.
    .site {
      position: relative;
      height: 520px;
      overflow: hidden;
      border: 1px solid var(--cor-borda-forte);
      border-radius: var(--raio-lg);
      background: var(--cor-superficie-2);

      // Paleta do widget (a mesma do CSS dele): claro e escuro.
      --w-fundo: #ffffff;
      --w-texto: #1f2937;
      --w-suave: #6b7280;
      --w-bolha: #f3f4f6;
      --w-borda: #e5e7eb;
    }

    .site[data-widget='escuro'] {
      --w-fundo: #111827;
      --w-texto: #f3f4f6;
      --w-suave: #9ca3af;
      --w-bolha: #1f2937;
      --w-borda: #374151;
    }

    .site__barra {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 var(--esp-3);
      border-bottom: 1px solid var(--cor-borda);

      > span:not(.site__endereco) {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--cor-borda-forte);
      }
    }

    .site__endereco {
      margin-left: var(--esp-3);
      padding: 2px var(--esp-3);
      border-radius: var(--raio-pilula);
      background: var(--cor-superficie-3);
      color: var(--cor-texto-fraco);
      font: var(--fonte-legenda);
    }

    .site__pagina {
      display: grid;
      gap: var(--esp-3);
      padding: var(--esp-5);
    }

    .site__bloco {
      display: block;
      width: 60%;
      height: 10px;
      border-radius: var(--raio-pilula);
      background: var(--cor-superficie-3);
    }

    .site__bloco--titulo {
      width: 40%;
      height: 18px;
    }

    .site__bloco--curto {
      width: 35%;
    }

    .site__bloco--imagem {
      width: 70%;
      height: 120px;
      border-radius: var(--raio-md);
    }

    // O widget (proporções do original, um pouco menor: 300px de largura).
    .w {
      position: absolute;
      right: 16px;
      bottom: 80px;
      display: flex;
      flex-direction: column;
      width: min(300px, calc(100% - 32px));
      max-height: calc(100% - 128px);
      overflow: hidden;
      border: 1px solid var(--w-borda);
      border-radius: 16px;
      background: var(--w-fundo);
      color: var(--w-texto);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
      font:
        13px/1.45 system-ui,
        -apple-system,
        'Segoe UI',
        Roboto,
        sans-serif;
    }

    .site--esquerda .w {
      right: auto;
      left: 16px;
    }

    .w__cabecalho {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px 12px 12px 14px;
      background: var(--w-cor);
      color: var(--w-cor-texto);
    }

    .w__textos {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;

      strong {
        font-size: 15px;
        overflow-wrap: anywhere;
      }

      span {
        font-size: 11px;
        opacity: 0.9;
        overflow-wrap: anywhere;
      }
    }

    .w__situacao::before {
      content: '';
      display: inline-block;
      width: 7px;
      height: 7px;
      margin-right: 5px;
      border-radius: 50%;
      background: #22c55e;
    }

    .w__corpo {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 6px;
      min-height: 0;
      padding: 10px 12px;
      overflow: hidden;
    }

    .w__msg {
      align-self: flex-start;
      max-width: 82%;
      margin: 0;
      padding: 7px 10px;
      border-radius: 14px;
      background: var(--w-bolha);
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    .w__msg--visitante {
      align-self: flex-end;
      background: var(--w-cor);
      color: var(--w-cor-texto);
    }

    .w__autor {
      display: block;
      margin-bottom: 1px;
      color: var(--w-suave);
      font-size: 11px;
      font-weight: 600;
    }

    .w__form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 4px;
    }

    .w__rotulo {
      color: var(--w-suave);
      font-size: 12px;
    }

    .w__campo {
      margin-bottom: 4px;
      padding: 7px 10px;
      border: 1px solid var(--w-borda);
      border-radius: 10px;
      color: var(--w-texto);
    }

    .w__consentimento {
      display: flex;
      gap: 6px;
      color: var(--w-suave);
      font-size: 11px;
      overflow-wrap: anywhere;
    }

    .w__caixa {
      flex: none;
      width: 13px;
      height: 13px;
      margin-top: 2px;
      border: 1px solid var(--w-suave);
      border-radius: 3px;
    }

    .w__iniciar {
      margin-top: 6px;
      padding: 9px;
      border-radius: 10px;
      background: var(--w-cor);
      color: var(--w-cor-texto);
      font-weight: 600;
      text-align: center;
    }

    .w__rodape {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px;
      border-top: 1px solid var(--w-borda);
    }

    .w__anexo {
      flex: none;
      color: var(--w-suave);
    }

    .w__escrever {
      flex: 1;
      padding: 7px 10px;
      border: 1px solid var(--w-borda);
      border-radius: 12px;
      color: var(--w-suave);
    }

    .w__enviar,
    .w__lancador {
      display: grid;
      flex: none;
      place-items: center;
      border-radius: 50%;
      background: var(--w-cor);
      color: var(--w-cor-texto);
    }

    .w__enviar {
      width: 32px;
      height: 32px;
    }

    .w__lancador {
      position: absolute;
      right: 16px;
      bottom: 16px;
      width: 52px;
      height: 52px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);

      svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    }

    .site--esquerda .w__lancador {
      right: auto;
      left: 16px;
    }

    @include m.abaixo(m.$sm) {
      .site {
        height: 480px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviaWidget {
  readonly aparencia = input.required<AparenciaDoWidget>();
  /** `true`: a cor do texto é calculada (preto ou branco, o de mais contraste). */
  readonly corTextoAutomatica = input(true);
  readonly contato = input<ContatoDoFormulario>('EMAIL_OU_TELEFONE');
  readonly textoConsentimento = input<string | null>(null);
  readonly consentimentoPadrao = input('');
  readonly permitirAnexos = input(true);

  protected readonly vistas = VISTAS;
  protected readonly temas = TEMAS;
  protected readonly vista = signal<Vista>('inicio');
  protected readonly temaVisto = signal<TemaVisto>('claro');

  protected readonly tema = computed<TemaVisto>(() => {
    const tema = this.aparencia().tema;
    return tema === 'automatico' ? this.temaVisto() : tema;
  });
  protected readonly cor = computed(() =>
    ehCor(this.aparencia().corPrimaria) ? this.aparencia().corPrimaria : '#2563EB',
  );
  protected readonly corTexto = computed(() => {
    const escolhida = this.aparencia().corTextoPrimaria;
    return this.corTextoAutomatica() || !ehCor(escolhida) ? corDeTextoPara(this.cor()) : escolhida;
  });
  protected readonly rotuloContato = computed(() => {
    switch (this.contato()) {
      case 'EMAIL':
        return 'Seu e-mail';
      case 'TELEFONE':
        return 'Seu telefone (WhatsApp)';
      default:
        return 'E-mail ou telefone';
    }
  });
  protected readonly exemploContato = computed(() =>
    this.contato() === 'TELEFONE' ? '(11) 98765-4321' : 'maria@exemplo.com',
  );
  protected readonly consentimento = computed(
    () => this.textoConsentimento()?.trim() || this.consentimentoPadrao(),
  );
  protected readonly descricao = computed(() => {
    const a = this.aparencia();
    const lado = a.posicao === 'esquerda' ? 'à esquerda' : 'à direita';
    return `Prévia do chat “${a.titulo}”, no canto inferior ${lado}, tema ${this.tema()}, cor ${this.cor()}.`;
  });
}
