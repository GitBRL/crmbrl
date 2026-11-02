import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
  untracked,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucidePaperclip,
  LucideSend,
  LucideX,
} from '@lucide/angular';

import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { formatarDataHora, formatarEspera } from '../../nucleo/formatos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { AREAS, podeImportarContatos, ROTULO_AREA } from '../../nucleo/sessao/perfil';
import { Alternador } from '../../ui/alternador/alternador';
import { Botao } from '../../ui/botao/botao';
import { CaixaSelecao } from '../../ui/caixa-selecao/caixa-selecao';
import { Cartao } from '../../ui/cartao/cartao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { ConstrutorSegmento } from '../../ui/construtor-segmento/construtor-segmento';
import { SEGMENTO_VAZIO, type Segmento } from '../../ui/construtor-segmento/segmento';
import { EditorModelo } from '../../ui/editor-modelo/editor-modelo';
import { VARIAVEIS_PADRAO, type VariavelModelo } from '../../ui/editor-modelo/modelo-mensagem';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { Modal } from '../../ui/modal/modal';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { agendaPadrao, type Agenda } from '../../ui/seletor-agenda/agenda';
import { SeletorAgenda } from '../../ui/seletor-agenda/seletor-agenda';
import { JANELA_COMERCIAL, type JanelaEnvio } from '../../ui/seletor-janela-envio/janela-envio';
import { SeletorJanelaEnvio } from '../../ui/seletor-janela-envio/seletor-janela-envio';
import { ContatosApi } from '../contatos/contatos.api';
import {
  agendaParaIso,
  erroDoPasso,
  type EstadoAssistente,
  isoParaAgenda,
  montarDados,
  PASSOS,
  presetDoRitmo,
  PRESETS_RITMO,
  type PresetRitmo,
} from './assistente';
import { camposDoSegmento, janelaDaApi, segmentoDaApi, segmentoParaApi } from './conversao';
import { DisparosApi } from './disparos.api';
import {
  type ArquivoCampanha,
  type Campanha,
  type CanalCampanha,
  type EstimativaEnvio,
  type PreviaPublico,
  type RevisaoCampanha,
  type TipoPublico,
} from './disparos.tipos';

const OPCOES_CANAL: readonly OpcaoGrupo<CanalCampanha>[] = [
  { valor: 'WHATSAPP', rotulo: 'WhatsApp', dica: 'Mensagem no WhatsApp dos contatos.' },
  { valor: 'EMAIL', rotulo: 'E-mail', dica: 'E-mail para o endereço dos contatos.' },
];

const OPCOES_PUBLICO: readonly OpcaoGrupo<TipoPublico>[] = [
  {
    valor: 'SEGMENTO',
    rotulo: 'Contatos que eu filtrar',
    dica: 'Por etiqueta, origem, responsável ou data.',
  },
  {
    valor: 'IMPORTACAO',
    rotulo: 'Uma lista importada',
    dica: 'Os contatos de uma planilha que você já importou.',
  },
];

const OPCOES_RITMO: readonly OpcaoGrupo<PresetRitmo>[] = [
  {
    valor: 'seguro',
    rotulo: 'Bem devagar',
    dica: 'Uma mensagem a cada 40 a 120 segundos. O mais seguro.',
  },
  { valor: 'padrao', rotulo: 'Recomendado', dica: 'Uma mensagem a cada 20 a 60 segundos.' },
  {
    valor: 'rapido',
    rotulo: 'Rápido',
    dica: 'Uma mensagem a cada 8 a 20 segundos. Maior risco de bloqueio.',
  },
  { valor: 'personalizado', rotulo: 'Personalizar', dica: 'Você define os tempos.' },
];

function numero(valor: string | number | null): number {
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/**
 * Assistente de campanha (`/disparos/novo` e `/disparos/:id/editar`): público, mensagem,
 * números e ritmo, quando enviar e revisão com estimativa. O rascunho é salvo a cada passo;
 * campanhas já agendadas, em andamento ou pausadas só deixam ajustar nome, números, ritmo e horário.
 */
@Component({
  selector: 'app-disparo-novo',
  imports: [
    RouterLink,
    Alternador,
    Botao,
    CampoTexto,
    CaixaSelecao,
    Cartao,
    ConstrutorSegmento,
    EditorModelo,
    EstadoVazio,
    Esqueleto,
    GrupoOpcoes,
    LucideArrowLeft,
    LucidePaperclip,
    Modal,
    Seletor,
    SeletorAgenda,
    SeletorJanelaEnvio,
  ],
  template: `
    <a class="voltar" [routerLink]="campanhaId() ? ['/disparos', campanhaId()] : ['/disparos']">
      <svg lucideArrowLeft [size]="16" aria-hidden="true"></svg>
      {{ campanhaId() ? 'Voltar para a campanha' : 'Todas as campanhas' }}
    </a>

    <header class="cabecalho">
      <h1 class="texto-display">{{ campanhaId() ? 'Editar campanha' : 'Nova campanha' }}</h1>
      <p class="cabecalho__frase">
        @if (limitado()) {
          Esta campanha já foi iniciada ou agendada. Dá para ajustar o nome, os números, o ritmo e o
          horário; o público e a mensagem ficam como estão.
        } @else {
          Cinco passos rápidos. O rascunho é salvo a cada passo, então você pode sair e voltar
          depois.
        }
      </p>
    </header>

    @if (falhaCarga(); as falha) {
      <app-estado-vazio
        [variante]="falha.status === 404 ? 'vazio' : falha.ehSemPermissao ? 'sem-acesso' : 'erro'"
        [falha]="falha"
        titulo="Não deu para abrir esta campanha"
        [texto]="falha.resumo"
      >
        <a appBotao variante="invertido" routerLink="/disparos">Ver campanhas</a>
      </app-estado-vazio>
    } @else if (id() && !carregada()) {
      <app-esqueleto forma="bloco" altura="3rem" />
      <app-esqueleto forma="bloco" altura="14rem" />
    } @else {
      <nav aria-label="Passos da campanha">
        <ol class="passos">
          @for (p of passosVisiveis(); track p.id; let i = $index) {
            <li
              class="passos__item"
              [class.passos__item--atual]="p.id === passo()"
              [class.passos__item--feito]="p.id < passo()"
            >
              <button
                type="button"
                class="passos__botao"
                [attr.aria-current]="p.id === passo() ? 'step' : null"
                [disabled]="p.id > passo() || salvando()"
                (click)="irPara(p.id)"
              >
                <span class="passos__numero" aria-hidden="true">{{ i + 1 }}</span>
                <span class="passos__rotulo">{{ p.rotulo }}</span>
              </button>
            </li>
          }
        </ol>
      </nav>

      <section class="corpo" [attr.aria-label]="'Passo ' + passo() + ': ' + rotuloDoPasso()">
        @switch (passo()) {
          @case (1) {
            <app-cartao
              titulo="Quem vai receber"
              dica="Contatos que pediram para sair e contatos sem telefone (ou e-mail) ficam de fora sozinhos."
            >
              <div class="formulario">
                <app-campo-texto
                  rotulo="Nome da campanha"
                  dica="Só para você e sua equipe acharem depois. O contato não vê."
                  placeholder="Ex.: Convite para o webinar de março"
                  autocomplete="off"
                  [maximoCaracteres]="150"
                  [valor]="nome()"
                  (valorChange)="nome.set('' + ($event ?? ''))"
                />
                <app-grupo-opcoes
                  rotulo="Por onde enviar"
                  disposicao="pilulas"
                  [opcoes]="opcoesCanal()"
                  [valor]="canal()"
                  (valorChange)="mudarCanal($event)"
                />
                @if (ehDiretoria()) {
                  <app-seletor
                    rotulo="Área da campanha"
                    ajuda="De qual área é esta campanha. O líder dela acompanha e aprova."
                    [opcoes]="opcoesArea"
                    [desabilitado]="campanhaId() !== null"
                    [valor]="area()"
                    (valorChange)="area.set($event)"
                  />
                }
                <app-grupo-opcoes
                  rotulo="Quem recebe"
                  [opcoes]="opcoesPublico"
                  [valor]="tipoPublico()"
                  (valorChange)="mudarPublico($event)"
                />
                @if (tipoPublico() === 'SEGMENTO') {
                  @if (segmentoPerdeu()) {
                    <p class="nota nota--atencao" role="status">
                      Esta campanha tinha filtros que não aparecem aqui; eles foram deixados de
                      lado. Confira o público abaixo.
                    </p>
                  }
                  <app-construtor-segmento
                    [campos]="camposSegmento()"
                    [contagem]="contar"
                    [valor]="segmento()"
                    (valorChange)="segmento.set($event)"
                  />
                } @else {
                  <app-seletor
                    rotulo="Importação"
                    placeholder="Escolha uma lista importada"
                    [opcoes]="opcoesImportacao()"
                    [valor]="importacaoId()"
                    (valorChange)="importacaoId.set($event)"
                  />
                  @if (importacoes.hasValue() && opcoesImportacao().length === 0) {
                    <p class="nota">
                      Nenhuma importação concluída ainda.
                      @if (podeImportar()) {
                        <a routerLink="/contatos/importar">Importar contatos</a>
                      } @else {
                        Peça ao líder da sua área para importar a lista.
                      }
                    </p>
                  }
                }
                @if (previa(); as p) {
                  <div class="resumo" role="status" aria-live="polite">
                    <strong>{{ p.elegiveis.toLocaleString('pt-BR') }}</strong>
                    {{ p.elegiveis === 1 ? 'contato vai receber' : 'contatos vão receber' }}.
                    @if (p.semDestino > 0) {
                      {{ p.semDestino.toLocaleString('pt-BR') }} sem
                      {{ canal() === 'EMAIL' ? 'e-mail' : 'telefone' }}.
                    }
                    @if (p.optOutExcluidos > 0) {
                      {{ p.optOutExcluidos.toLocaleString('pt-BR') }} pediram para não receber.
                    }
                    @if (p.amostra.length > 0) {
                      <span class="resumo__amostra"> Por exemplo: {{ nomesDaAmostra() }}. </span>
                    }
                  </div>
                }
              </div>
            </app-cartao>
          }

          @case (2) {
            <app-cartao titulo="O que dizer">
              <div class="formulario">
                <div class="modelo">
                  <app-seletor
                    rotulo="Começar de um modelo salvo"
                    placeholder="Escolha um modelo (opcional)"
                    permitirVazio
                    [opcoes]="opcoesModelo()"
                    [valor]="modeloId()"
                    (valorChange)="usarModelo($event)"
                  />
                </div>
                @if (canal() === 'EMAIL') {
                  <app-campo-texto
                    rotulo="Assunto do e-mail"
                    autocomplete="off"
                    [maximoCaracteres]="200"
                    [valor]="assunto()"
                    (valorChange)="assunto.set('' + ($event ?? ''))"
                  />
                }
                <app-editor-modelo
                  [rotulo]="canal() === 'EMAIL' ? 'Texto do e-mail' : 'Mensagem'"
                  dica="Use os botões para personalizar com o nome do contato. Separe variações com barras, como {Olá|Oi}: cada contato recebe uma delas."
                  [variaveis]="variaveisEditor()"
                  [maximoCaracteres]="canal() === 'EMAIL' ? 5000 : 1000"
                  [valor]="texto()"
                  (valorChange)="texto.set($event)"
                />
                <div class="midia">
                  <span class="midia__rotulo">Imagem, vídeo ou documento (opcional)</span>
                  @if (arquivo(); as a) {
                    <span class="midia__arquivo">
                      <svg lucidePaperclip [size]="16" aria-hidden="true"></svg>
                      {{ a.nome }}
                      <button
                        appBotao
                        type="button"
                        variante="contorno"
                        tamanho="sm"
                        [icone]="icones.remover"
                        (click)="arquivo.set(null)"
                      >
                        Remover
                      </button>
                    </span>
                  } @else {
                    <button
                      appBotao
                      type="button"
                      variante="contorno"
                      tamanho="sm"
                      [carregando]="enviandoMidia()"
                      [icone]="icones.anexo"
                      (click)="escolherArquivo()"
                    >
                      Anexar arquivo
                    </button>
                  }
                  <input
                    #entradaArquivo
                    class="midia__entrada"
                    type="file"
                    tabindex="-1"
                    aria-hidden="true"
                    (change)="aoEscolherArquivo($event)"
                  />
                </div>
                <div class="modelo-salvar">
                  <button
                    appBotao
                    type="button"
                    variante="contorno"
                    tamanho="sm"
                    [disabled]="texto().trim() === ''"
                    (click)="modeloAberto.set(true)"
                  >
                    Salvar como modelo
                  </button>
                  <button
                    appBotao
                    type="button"
                    variante="contorno"
                    tamanho="sm"
                    (click)="gerenciarAberto.set(true)"
                  >
                    Gerenciar modelos
                  </button>
                  <span class="nota">Guarde esta mensagem para usar em outras campanhas.</span>
                </div>
              </div>
            </app-cartao>
          }

          @case (3) {
            <app-cartao
              [titulo]="canal() === 'EMAIL' ? 'E-mail de envio' : 'Números de envio'"
              [dica]="
                canal() === 'EMAIL'
                  ? 'De qual conta de e-mail a campanha sai.'
                  : 'Com mais de um número, as mensagens se alternam entre eles. Isso divide o volume e protege cada número.'
              "
            >
              @if (canais.isLoading()) {
                <app-esqueleto forma="bloco" altura="5rem" />
              } @else if (canaisDoTipo().length === 0) {
                <app-estado-vazio
                  compacto
                  [titulo]="
                    canal() === 'EMAIL'
                      ? 'Nenhum e-mail conectado'
                      : 'Nenhum número de WhatsApp conectado'
                  "
                  texto="Peça a quem administra o CRM para conectar um canal em Configurações."
                />
              } @else {
                <ul class="canais" aria-label="Canais disponíveis">
                  @for (c of canaisDoTipo(); track c.id) {
                    <li class="canais__item">
                      <app-caixa-selecao
                        [rotulo]="c.nome"
                        [desabilitado]="!c.disponivel && !canalIds().includes(c.id)"
                        [valor]="canalIds().includes(c.id)"
                        (valorChange)="alternarCanal(c.id, $event)"
                      />
                      @if (!c.disponivel) {
                        <span class="nota nota--atencao">Desconectado agora</span>
                      }
                      @if (canalIds().includes(c.id) && canalIds().length > 1) {
                        <span class="nota">Ordem {{ canalIds().indexOf(c.id) + 1 }}</span>
                      }
                    </li>
                  }
                </ul>
              }
            </app-cartao>

            <app-cartao
              titulo="Velocidade dos envios"
              dica="Enviar devagar parece mais natural e evita que o número seja bloqueado."
            >
              <div class="formulario">
                <app-grupo-opcoes
                  rotulo="Ritmo"
                  [opcoes]="opcoesRitmo"
                  [valor]="preset()"
                  (valorChange)="escolherRitmo($event)"
                />
                @if (preset() === 'rapido' && canal() === 'WHATSAPP') {
                  <p class="nota nota--atencao" role="status">
                    Cuidado: mandar rápido demais para muita gente pode fazer o WhatsApp bloquear o
                    número.
                  </p>
                }
                @if (preset() === 'personalizado') {
                  <div class="grade-campos">
                    <app-campo-texto
                      rotulo="Mínimo entre mensagens"
                      tipo="number"
                      sufixo="s"
                      [minimo]="1"
                      [valor]="intervaloMinimo()"
                      (valorChange)="intervaloMinimo.set(numero($event))"
                    />
                    <app-campo-texto
                      rotulo="Máximo entre mensagens"
                      tipo="number"
                      sufixo="s"
                      [minimo]="1"
                      [valor]="intervaloMaximo()"
                      (valorChange)="intervaloMaximo.set(numero($event))"
                    />
                  </div>
                }
                <div class="alternancias">
                  <app-alternador
                    rotulo="Fazer uma pausa a cada lote de mensagens"
                    [valor]="usarLote()"
                    (valorChange)="usarLote.set($event)"
                  />
                  @if (usarLote()) {
                    <div class="grade-campos">
                      <app-campo-texto
                        rotulo="Mensagens por lote"
                        tipo="number"
                        [minimo]="1"
                        [valor]="loteTamanho()"
                        (valorChange)="loteTamanho.set(numero($event))"
                      />
                      <app-campo-texto
                        rotulo="Pausa entre lotes"
                        tipo="number"
                        sufixo="s"
                        [minimo]="1"
                        [valor]="lotePausa()"
                        (valorChange)="lotePausa.set(numero($event))"
                      />
                    </div>
                  }
                  @if (canal() === 'WHATSAPP') {
                    <app-alternador
                      rotulo="Mostrar “digitando…” antes de enviar"
                      [valor]="simularDigitando()"
                      (valorChange)="simularDigitando.set($event)"
                    />
                  }
                </div>
                <app-campo-texto
                  rotulo="Pausar sozinha depois de quantas falhas seguidas"
                  tipo="number"
                  [minimo]="1"
                  dica="Se várias mensagens seguidas falharem, algo está errado: a campanha para para você olhar."
                  [valor]="pausarAposFalhas()"
                  (valorChange)="pausarAposFalhas.set(numero($event))"
                />
                @if (estimativa(); as est) {
                  <p class="resumo" role="status" aria-live="polite">
                    Com esse ritmo, leva cerca de <strong>{{ duracao(est) }}</strong>
                    @if (est.dias > 1) {
                      ({{ est.dias }} dias)
                    }
                    para enviar a todos.
                  </p>
                }
              </div>
            </app-cartao>
          }

          @case (4) {
            @if (!limitado()) {
              <app-cartao titulo="Quando começar">
                <app-seletor-agenda [valor]="agenda()" (valorChange)="agenda.set($event)" />
              </app-cartao>
            }
            <app-cartao
              titulo="Horário de envio"
              dica="Evita mandar mensagem de madrugada ou no fim de semana. Fora do horário, a campanha espera e continua depois."
            >
              <div class="formulario">
                <app-alternador
                  rotulo="Enviar só em certos dias e horários"
                  [valor]="janelaAtiva()"
                  (valorChange)="janelaAtiva.set($event)"
                />
                @if (janelaAtiva()) {
                  <app-seletor-janela-envio [valor]="janela()" (valorChange)="janela.set($event)" />
                } @else {
                  <p class="nota">A campanha envia a qualquer hora, inclusive de madrugada.</p>
                }
              </div>
            </app-cartao>
          }

          @case (5) {
            @if (revisao.isLoading() && !revisao.hasValue()) {
              <app-esqueleto forma="bloco" altura="12rem" />
            } @else if (erroRevisao(); as falha) {
              <app-estado-vazio
                variante="erro"
                [falha]="falha"
                titulo="Não conseguimos montar a revisão"
                [texto]="falha.resumo"
              >
                <button appBotao type="button" variante="invertido" (click)="revisao.reload()">
                  Tentar de novo
                </button>
              </app-estado-vazio>
            } @else if (revisao.hasValue()) {
              @let r = revisao.value();
              @if (r.problemas.length > 0) {
                <app-cartao titulo="Confira antes de enviar">
                  <ul class="problemas">
                    @for (p of r.problemas; track $index) {
                      <li [class.problemas__erro]="p.gravidade === 'erro'">
                        <strong>{{ p.gravidade === 'erro' ? 'Corrija: ' : 'Atenção: ' }}</strong
                        >{{ p.mensagem }}
                      </li>
                    }
                  </ul>
                </app-cartao>
              }
              <div class="revisao">
                <app-cartao titulo="Quem recebe">
                  <p class="grande">{{ r.publico.elegiveis.toLocaleString('pt-BR') }}</p>
                  <p class="nota">
                    de {{ r.publico.total.toLocaleString('pt-BR') }} no filtro.
                    @if (r.publico.semDestino > 0) {
                      {{ r.publico.semDestino }} sem
                      {{ canal() === 'EMAIL' ? 'e-mail' : 'telefone' }}.
                    }
                    @if (r.publico.optOutExcluidos > 0) {
                      {{ r.publico.optOutExcluidos }} pediram para sair.
                    }
                  </p>
                </app-cartao>
                <app-cartao titulo="Quanto tempo leva">
                  <p class="grande">{{ duracao(r.estimativa) }}</p>
                  <p class="nota">
                    @if (r.estimativa.terminoPrevisto) {
                      Termina por volta de {{ dataHora(r.estimativa.terminoPrevisto) }}.
                    }
                    Cerca de {{ r.estimativa.enviosPorHora }} por hora; limite de
                    {{ r.estimativa.limiteDiarioTotal.toLocaleString('pt-BR') }} por dia.
                  </p>
                </app-cartao>
                <app-cartao titulo="Por onde sai">
                  <ul class="lista-simples">
                    @for (c of r.canais; track c.id) {
                      <li>
                        {{ c.nome }}
                        @if (c.telefone) {
                          <span class="nota">({{ c.telefone }})</span>
                        }
                        @if (!c.disponivel) {
                          <span class="nota nota--atencao">{{ c.motivo || 'Indisponível' }}</span>
                        }
                      </li>
                    }
                  </ul>
                </app-cartao>
              </div>
              <app-cartao titulo="Como a mensagem vai chegar" complemento="Com dados de exemplo">
                @if (r.previa.assunto) {
                  <p class="campo"><span class="nota">Assunto</span>{{ r.previa.assunto }}</p>
                }
                <p class="mensagem">{{ r.previa.texto }}</p>
                <div class="teste">
                  <button
                    appBotao
                    type="button"
                    variante="contorno"
                    tamanho="sm"
                    [carregando]="enviandoTeste()"
                    (click)="enviarTeste()"
                  >
                    Enviar um teste para mim
                  </button>
                  <span class="nota">
                    {{
                      canal() === 'EMAIL'
                        ? 'Vai para o seu e-mail cadastrado.'
                        : 'Vai para o seu telefone cadastrado.'
                    }}
                  </span>
                </div>
                @if (resultadoTeste(); as t) {
                  <p class="nota" role="status">{{ t }}</p>
                }
              </app-cartao>
              @if (r.exigeAprovacao) {
                <p class="nota nota--atencao" role="status">
                  Esta campanha precisa da aprovação do líder da área antes de começar.
                </p>
              }
            }
          }
        }

        @if (erroPasso(); as erro) {
          <p class="erro" role="alert">{{ erro }}</p>
        }

        <div class="rodape">
          <button
            appBotao
            type="button"
            variante="contorno"
            [disabled]="salvando()"
            (click)="voltar()"
          >
            {{ passo() === primeiroPasso() ? 'Cancelar' : 'Voltar' }}
          </button>
          <span class="rodape__espaco"></span>
          @if (!limitado() && passo() < 5 && campanhaId()) {
            <button
              appBotao
              type="button"
              variante="contorno"
              [disabled]="salvando()"
              (click)="salvarESair()"
            >
              Salvar e sair
            </button>
          }
          @if (passo() < ultimoPasso()) {
            <button
              appBotao
              type="button"
              variante="destaque"
              [icone]="icones.avancar"
              [carregando]="salvando()"
              (click)="avancar()"
            >
              Continuar
            </button>
          } @else if (limitado()) {
            <button
              appBotao
              type="button"
              variante="destaque"
              [carregando]="salvando()"
              (click)="avancar()"
            >
              Salvar alterações
            </button>
          } @else {
            <button
              appBotao
              type="button"
              variante="destaque"
              [icone]="icones.enviar"
              [carregando]="salvando()"
              [disabled]="!revisao.hasValue() || !revisao.value().podeIniciar"
              (click)="iniciar()"
            >
              {{ rotuloIniciar() }}
            </button>
          }
        </div>
      </section>
    }

    <app-modal titulo="Modelos de mensagem" largura="md" [(aberto)]="gerenciarAberto">
      @if (modelos.hasValue() && modelos.value().itens.length > 0) {
        <ul class="modelos">
          @for (m of modelos.value().itens; track m.id) {
            <li class="modelos__item">
              <span class="modelos__texto">
                <strong>{{ m.nome }}</strong>
                <span class="nota">{{ m.texto }}</span>
              </span>
              @if (m.podeEditar) {
                <button
                  appBotao
                  type="button"
                  variante="contorno"
                  tamanho="sm"
                  (click)="excluirModelo(m.id, m.nome)"
                >
                  Excluir
                </button>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="nota">Você ainda não salvou nenhum modelo para este canal.</p>
      }
      <div modal-rodape>
        <button appBotao type="button" variante="invertido" (click)="gerenciarAberto.set(false)">
          Fechar
        </button>
      </div>
    </app-modal>

    <app-modal titulo="Salvar como modelo" largura="sm" [(aberto)]="modeloAberto">
      <form class="formulario" id="form-modelo" (submit)="$event.preventDefault(); salvarModelo()">
        <app-campo-texto
          rotulo="Nome do modelo"
          autocomplete="off"
          [maximoCaracteres]="120"
          [valor]="nomeModelo()"
          (valorChange)="nomeModelo.set('' + ($event ?? ''))"
        />
      </form>
      <div modal-rodape>
        <button appBotao type="button" variante="contorno" (click)="modeloAberto.set(false)">
          Cancelar
        </button>
        <button
          appBotao
          type="submit"
          variante="invertido"
          form="form-modelo"
          [carregando]="salvandoModelo()"
          [disabled]="nomeModelo().trim() === ''"
        >
          Salvar modelo
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-4);
      max-width: 60rem;
      min-width: 0;
    }

    .voltar {
      display: inline-flex;
      align-items: center;
      gap: var(--esp-2);
      width: fit-content;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
      text-decoration: none;
    }

    .cabecalho {
      display: grid;
      gap: var(--esp-2);
    }

    .cabecalho__frase {
      max-width: 60ch;
      color: var(--cor-texto-suave);
      font: var(--fonte-lead);
    }

    .passos {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .passos__botao {
      display: inline-flex;
      align-items: center;
      gap: var(--esp-2);
      min-height: var(--altura-md);
      padding: 0 var(--esp-3);
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-pilula);
      background: transparent;
      color: var(--cor-texto-suave);
      font: var(--fonte-rotulo);
      cursor: pointer;
    }

    .passos__botao:disabled {
      cursor: default;
      opacity: 0.7;
    }

    .passos__numero {
      display: inline-grid;
      place-items: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      background: var(--cor-superficie-3);
      font-size: 0.8rem;
    }

    .passos__item--atual .passos__botao {
      background: var(--cor-inverso);
      border-color: var(--cor-inverso);
      color: var(--cor-sobre-inverso);
    }

    .passos__item--atual .passos__numero {
      background: var(--cor-sobre-inverso);
      color: var(--cor-inverso);
    }

    .passos__item--feito .passos__botao {
      color: var(--cor-texto);
    }

    .corpo {
      display: grid;
      gap: var(--esp-4);
      min-width: 0;
    }

    .formulario {
      display: grid;
      gap: var(--esp-4);
      min-width: 0;
    }

    .grade-campos {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: var(--esp-3);
    }

    .alternancias {
      display: grid;
      gap: var(--esp-3);
    }

    .nota {
      margin: 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .nota--atencao {
      color: var(--cor-aviso);
    }

    .resumo {
      margin: 0;
      padding: var(--esp-3) var(--esp-4);
      border-radius: var(--raio-lg);
      background: var(--cor-superficie-2);
    }

    .resumo__amostra {
      display: block;
      margin-top: var(--esp-1);
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .erro {
      margin: 0;
      padding: var(--esp-3) var(--esp-4);
      border-radius: var(--raio-lg);
      border-inline-start: 4px solid var(--cor-erro);
      background: var(--cor-superficie-2);
    }

    .canais {
      display: grid;
      gap: var(--esp-2);
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .canais__item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-3);
    }

    .midia {
      display: grid;
      gap: var(--esp-2);
      justify-items: start;
    }

    .midia__rotulo {
      font: var(--fonte-rotulo);
    }

    .midia__arquivo {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-2);
      overflow-wrap: anywhere;
    }

    .midia__entrada {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }

    .modelo-salvar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-3);
    }

    .modelos {
      display: grid;
      gap: var(--esp-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .modelos__item {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--esp-3);
    }

    .modelos__texto {
      display: grid;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .revisao {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
      gap: var(--esp-4);
    }

    .grande {
      margin: 0;
      font: var(--fonte-numero);
    }

    .problemas {
      display: grid;
      gap: var(--esp-2);
      margin: 0;
      padding-inline-start: 1.1rem;
    }

    .problemas__erro {
      color: var(--cor-erro);
    }

    .lista-simples {
      display: grid;
      gap: var(--esp-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .mensagem {
      margin: 0 0 var(--esp-3);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .campo {
      display: grid;
      margin: 0 0 var(--esp-2);
    }

    .teste {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-3);
    }

    .rodape {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-2);
    }

    .rodape__espaco {
      flex: 1;
    }

    @media (max-width: 599px) {
      .passos__item:not(.passos__item--atual) .passos__rotulo {
        display: none;
      }

      .rodape button {
        flex: 1 1 auto;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisparoNovo {
  /** `:id` da rota quando é edição (vinculado por `withComponentInputBinding`). */
  readonly id = input<string>();

  private readonly api = inject(DisparosApi);
  private readonly contatos = inject(ContatosApi);
  private readonly sessao = inject(SessaoService);
  private readonly avisos = inject(AvisosService);
  private readonly roteador = inject(Router);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly endereco = inject(Location);

  protected readonly entradaArquivo = viewChild<ElementRef<HTMLInputElement>>('entradaArquivo');

  protected readonly icones = {
    avancar: LucideArrowRight,
    enviar: LucideSend,
    anexo: LucidePaperclip,
    remover: LucideX,
  };
  protected readonly opcoesPublico = OPCOES_PUBLICO;
  protected readonly opcoesRitmo = OPCOES_RITMO;
  protected readonly opcoesArea: readonly OpcaoSeletor<string>[] = AREAS.map((a) => ({
    valor: a,
    rotulo: ROTULO_AREA[a],
  }));
  protected readonly numero = numero;
  protected readonly ehDiretoria = this.sessao.ehDiretoria;
  protected readonly podeImportar = computed(() => this.sessao.permite(podeImportarContatos));

  // Estado do formulário -------------------------------------------------------------------
  protected readonly passo = signal(1);
  protected readonly campanhaId = signal<string | null>(null);
  protected readonly statusOriginal = signal<Campanha['status'] | null>(null);
  protected readonly carregada = signal(false);
  protected readonly falhaCarga = signal<ErroApi | null>(null);
  protected readonly salvando = signal(false);
  protected readonly erroPasso = signal<string | null>(null);

  protected readonly nome = signal('');
  protected readonly canal = signal<CanalCampanha>('WHATSAPP');
  protected readonly area = signal<string | null>(null);
  protected readonly tipoPublico = signal<TipoPublico>('SEGMENTO');
  protected readonly segmento = signal<Segmento>(SEGMENTO_VAZIO);
  protected readonly segmentoPerdeu = signal(false);
  protected readonly importacaoId = signal<string | null>(null);
  protected readonly previa = signal<PreviaPublico | null>(null);
  protected readonly assunto = signal('');
  protected readonly texto = signal('');
  protected readonly modeloId = signal<string | null>(null);
  protected readonly arquivo = signal<ArquivoCampanha | null>(null);
  protected readonly enviandoMidia = signal(false);
  protected readonly canalIds = signal<readonly string[]>([]);
  protected readonly preset = signal<PresetRitmo>('padrao');
  protected readonly intervaloMinimo = signal(PRESETS_RITMO.padrao.min);
  protected readonly intervaloMaximo = signal(PRESETS_RITMO.padrao.max);
  protected readonly usarLote = signal(false);
  protected readonly loteTamanho = signal(50);
  protected readonly lotePausa = signal(300);
  protected readonly simularDigitando = signal(true);
  protected readonly pausarAposFalhas = signal(5);
  protected readonly janelaAtiva = signal(true);
  protected readonly janela = signal<JanelaEnvio>(JANELA_COMERCIAL);
  protected readonly agenda = signal<Agenda>(agendaPadrao('agora'));
  protected readonly estimativa = signal<EstimativaEnvio | null>(null);

  /** Depois que o rascunho existe, o canal não muda (para trocar, crie outra campanha). */
  protected readonly opcoesCanal = computed<readonly OpcaoGrupo<CanalCampanha>[]>(() =>
    OPCOES_CANAL.map((o) => ({
      ...o,
      desabilitada: this.campanhaId() !== null && o.valor !== this.canal(),
      dica:
        this.campanhaId() !== null && o.valor !== this.canal()
          ? 'O canal não muda depois de criada.'
          : o.dica,
    })),
  );

  protected readonly modeloAberto = signal(false);
  protected readonly gerenciarAberto = signal(false);
  protected readonly nomeModelo = signal('');
  protected readonly salvandoModelo = signal(false);
  protected readonly enviandoTeste = signal(false);
  protected readonly resultadoTeste = signal<string | null>(null);

  /** Campanha já iniciada ou agendada: só ritmo, números e horário podem mudar. */
  protected readonly limitado = computed(() => {
    const status = this.statusOriginal();
    return status !== null && status !== 'RASCUNHO';
  });
  protected readonly passosVisiveis = computed(() =>
    this.limitado() ? PASSOS.filter((p) => p.id === 3 || p.id === 4) : PASSOS,
  );
  protected readonly primeiroPasso = computed(() => this.passosVisiveis()[0].id);
  protected readonly ultimoPasso = computed(() => this.passosVisiveis().at(-1)?.id ?? 5);
  protected readonly rotuloDoPasso = computed(
    () => PASSOS.find((p) => p.id === this.passo())?.rotulo ?? '',
  );

  protected readonly estado = computed<EstadoAssistente>(() => ({
    nome: this.nome(),
    canal: this.canal(),
    area: this.area(),
    tipoPublico: this.tipoPublico(),
    segmento: this.segmento(),
    importacaoId: this.importacaoId(),
    elegiveis: this.previa()?.elegiveis ?? null,
    assunto: this.assunto(),
    texto: this.texto(),
    modeloId: this.modeloId(),
    arquivoId: this.arquivo()?.id ?? null,
    canalIds: this.canalIds(),
    intervaloMinimo: this.intervaloMinimo(),
    intervaloMaximo: this.intervaloMaximo(),
    usarLote: this.usarLote(),
    loteTamanho: this.loteTamanho(),
    lotePausa: this.lotePausa(),
    simularDigitando: this.simularDigitando(),
    pausarAposFalhas: this.pausarAposFalhas(),
    janelaAtiva: this.janelaAtiva(),
    janela: this.janela(),
    agenda: this.agenda(),
  }));

  // Dados de apoio --------------------------------------------------------------------------
  protected readonly canais = resource({ loader: () => this.api.canais() });
  protected readonly etiquetas = resource({
    loader: () => firstValueFrom(this.contatos.etiquetasDeContatos()),
  });
  protected readonly usuarios = resource({
    loader: () => firstValueFrom(this.contatos.usuariosAtivos()),
  });
  protected readonly importacoes = resource({ loader: () => this.api.importacoesConcluidas() });
  protected readonly modelos = resource({
    params: () => this.canal(),
    loader: ({ params }) => this.api.modelos(params),
  });
  protected readonly variaveis = resource({ loader: () => this.api.variaveis() });

  protected readonly camposSegmento = computed(() =>
    camposDoSegmento(
      (this.etiquetas.hasValue() ? this.etiquetas.value() : []).map((e) => e.etiqueta),
      this.usuarios.hasValue() ? this.usuarios.value() : [],
    ),
  );
  protected readonly variaveisEditor = computed<readonly VariavelModelo[]>(() =>
    this.variaveis.hasValue() && this.variaveis.value().length > 0
      ? this.variaveis.value()
      : VARIAVEIS_PADRAO,
  );

  protected readonly canaisDoTipo = computed(() =>
    (this.canais.hasValue() ? this.canais.value() : []).filter(
      (c) => c.tipo === this.canal() && c.ativo,
    ),
  );
  protected readonly opcoesImportacao = computed<readonly OpcaoSeletor<string>[]>(() =>
    (this.importacoes.hasValue() ? this.importacoes.value().itens : []).map((i) => ({
      valor: i.id,
      rotulo: `${i.nome} (${i.criados + i.atualizados} contatos)`,
    })),
  );
  protected readonly opcoesModelo = computed<readonly OpcaoSeletor<string>[]>(() =>
    (this.modelos.hasValue() ? this.modelos.value().itens : []).map((m) => ({
      valor: m.id,
      rotulo: m.nome,
    })),
  );

  protected readonly nomesDaAmostra = computed(() =>
    (this.previa()?.amostra ?? [])
      .slice(0, 3)
      .map((c) => c.nome)
      .join(', '),
  );

  protected readonly revisao = resource({
    params: () => (this.passo() === 5 && this.campanhaId() ? this.campanhaId()! : undefined),
    loader: ({ params }) => this.api.revisao(params),
  });
  protected readonly erroRevisao = computed(() => {
    const falha = this.revisao.error();
    return falha ? erroDaApi(falha) : null;
  });
  protected readonly rotuloIniciar = computed(() => {
    const r = this.revisao.hasValue() ? this.revisao.value() : null;
    if (r?.exigeAprovacao) {
      return 'Pedir aprovação';
    }
    return this.agenda().modo === 'data' ? 'Agendar campanha' : 'Iniciar campanha';
  });

  /** Conta o público e guarda a prévia para o resumo (chamada pelo construtor de segmento). */
  protected readonly contar = async (segmento: Segmento): Promise<number> => {
    const p = await this.api.previaPublico({
      canal: this.canal(),
      tipoPublico: 'SEGMENTO',
      segmento: segmentoParaApi(segmento),
    });
    if (this.tipoPublico() === 'SEGMENTO') {
      this.previa.set(p);
    }
    return p.elegiveis;
  };

  constructor() {
    // Edição: carrega a campanha uma vez e preenche o formulário.
    effect(() => {
      const id = this.id();
      if (id) {
        untracked(() => void this.carregar(id));
      } else {
        this.carregada.set(true);
      }
    });

    // Lista importada: prévia do público quando a importação muda.
    effect((limpar) => {
      const importacao = this.importacaoId();
      const tipo = this.tipoPublico();
      const canal = this.canal();
      if (tipo !== 'IMPORTACAO' || !importacao) {
        return;
      }
      let valido = true;
      limpar(() => (valido = false));
      this.api
        .previaPublico({ canal, tipoPublico: 'IMPORTACAO', importacaoId: importacao })
        .then((p) => valido && this.previa.set(p))
        .catch(() => valido && this.previa.set(null));
    });

    // Estimativa de duração enquanto mexe no ritmo.
    effect((limpar) => {
      const e = this.estado();
      const total = this.previa()?.elegiveis;
      if (this.passo() !== 3 || !total || e.canalIds.length === 0) {
        return;
      }
      if (e.intervaloMinimo < 1 || e.intervaloMaximo < e.intervaloMinimo) {
        return;
      }
      let valido = true;
      const espera = setTimeout(() => {
        const dados = montarDados(e, true);
        this.api
          .estimar({
            total,
            canal: e.canal,
            canalIds: e.canalIds,
            ritmo: {
              intervaloMinimoSegundos: dados.intervaloMinimoSegundos,
              intervaloMaximoSegundos: dados.intervaloMaximoSegundos,
              loteTamanho: dados.loteTamanho,
              lotePausaSegundos: dados.lotePausaSegundos,
              simularDigitando: dados.simularDigitando,
            },
            janelaEnvio: dados.janelaEnvio,
          })
          .then((est) => valido && this.estimativa.set(est))
          .catch(() => valido && this.estimativa.set(null));
      }, 400);
      limpar(() => {
        valido = false;
        clearTimeout(espera);
      });
    });

    // Um só número/e-mail disponível: já vem marcado.
    effect(() => {
      const lista = this.canaisDoTipo();
      if (
        this.canalIds().length === 0 &&
        lista.length === 1 &&
        lista[0].disponivel &&
        this.carregada()
      ) {
        untracked(() => this.canalIds.set([lista[0].id]));
      }
    });
  }

  private async carregar(id: string): Promise<void> {
    try {
      const c = await this.api.detalhar(id);
      this.campanhaId.set(c.id);
      this.statusOriginal.set(c.status);
      if (c.status !== 'RASCUNHO' && !c.acoes.editar) {
        await this.roteador.navigate(['/disparos', c.id], { replaceUrl: true });
        return;
      }
      this.nome.set(c.nome);
      this.canal.set(c.canal);
      this.area.set(c.area);
      this.tipoPublico.set(c.tipoPublico);
      const lido = segmentoDaApi(c.segmento);
      this.segmento.set(lido.segmento);
      this.segmentoPerdeu.set(lido.perdeu);
      this.importacaoId.set(c.importacaoId);
      this.assunto.set(c.assunto ?? '');
      this.texto.set(c.texto);
      this.modeloId.set(c.modeloId);
      this.arquivo.set(c.arquivo);
      this.canalIds.set([...c.canais].sort((a, b) => a.ordem - b.ordem).map((x) => x.id));
      this.intervaloMinimo.set(c.ritmo.intervaloMinimoSegundos);
      this.intervaloMaximo.set(c.ritmo.intervaloMaximoSegundos);
      this.preset.set(
        presetDoRitmo(c.ritmo.intervaloMinimoSegundos, c.ritmo.intervaloMaximoSegundos),
      );
      this.usarLote.set(!!c.ritmo.loteTamanho && !!c.ritmo.lotePausaSegundos);
      this.loteTamanho.set(c.ritmo.loteTamanho ?? 50);
      this.lotePausa.set(c.ritmo.lotePausaSegundos ?? 300);
      this.simularDigitando.set(c.ritmo.simularDigitando);
      this.pausarAposFalhas.set(c.ritmo.pausarAposFalhas);
      const janela = janelaDaApi(c.janelaEnvio);
      this.janelaAtiva.set(janela !== null);
      if (janela) {
        this.janela.set(janela.janela);
      }
      const data = isoParaAgenda(c.agendadaPara);
      if (data) {
        this.agenda.set({ ...agendaPadrao('data'), dataHora: data });
      }
      this.passo.set(c.status === 'RASCUNHO' ? 1 : 3);
      this.carregada.set(true);
    } catch (falha) {
      this.falhaCarga.set(erroDaApi(falha));
    }
  }

  // Ações do formulário --------------------------------------------------------------------

  protected mudarCanal(canal: CanalCampanha | null): void {
    if (!canal || canal === this.canal()) {
      return;
    }
    this.canal.set(canal);
    this.canalIds.set([]);
    this.modeloId.set(null);
    this.previa.set(null);
    // O segmento é refeito pelo construtor ao contar de novo.
    this.segmento.update((s) => ({ ...s }));
  }

  protected mudarPublico(tipo: TipoPublico | null): void {
    if (tipo && tipo !== this.tipoPublico()) {
      this.tipoPublico.set(tipo);
      this.previa.set(null);
      if (tipo === 'SEGMENTO') {
        this.segmento.update((s) => ({ ...s }));
      }
    }
  }

  protected escolherRitmo(preset: PresetRitmo | null): void {
    if (!preset) {
      return;
    }
    this.preset.set(preset);
    if (preset !== 'personalizado') {
      this.intervaloMinimo.set(PRESETS_RITMO[preset].min);
      this.intervaloMaximo.set(PRESETS_RITMO[preset].max);
    }
  }

  protected alternarCanal(id: string, marcado: boolean): void {
    this.canalIds.update((lista) => {
      const sem = lista.filter((x) => x !== id);
      return marcado ? [...sem, id] : sem;
    });
  }

  protected usarModelo(id: string | null): void {
    this.modeloId.set(id);
    const modelo = this.modelos.hasValue()
      ? this.modelos.value().itens.find((m) => m.id === id)
      : undefined;
    if (!modelo) {
      return;
    }
    this.texto.set(modelo.texto);
    if (modelo.assunto) {
      this.assunto.set(modelo.assunto);
    }
    this.arquivo.set(modelo.arquivo);
  }

  protected escolherArquivo(): void {
    this.entradaArquivo()?.nativeElement.click();
  }

  protected async aoEscolherArquivo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const arquivo = entrada.files?.[0];
    entrada.value = '';
    if (!arquivo) {
      return;
    }
    this.enviandoMidia.set(true);
    try {
      this.arquivo.set(await this.api.enviarMidia(arquivo));
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.enviandoMidia.set(false);
    }
  }

  protected async salvarModelo(): Promise<void> {
    this.salvandoModelo.set(true);
    try {
      const modelo = await this.api.criarModelo({
        nome: this.nomeModelo().trim(),
        canal: this.canal(),
        assunto: this.canal() === 'EMAIL' ? this.assunto() : null,
        texto: this.texto(),
        arquivoId: this.arquivo()?.id ?? null,
      });
      this.modeloId.set(modelo.id);
      this.modeloAberto.set(false);
      this.nomeModelo.set('');
      this.modelos.reload();
      this.avisos.sucesso('Modelo salvo. Ele aparece na lista de modelos.');
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.salvandoModelo.set(false);
    }
  }

  protected async excluirModelo(id: string, nome: string): Promise<void> {
    const confirmou = await this.confirmacao.confirmar({
      titulo: `Excluir o modelo “${nome}”?`,
      mensagem: 'O modelo sai da lista. Campanhas que já usaram o texto não mudam.',
      confirmar: 'Excluir',
      perigo: true,
      executar: () => this.api.excluirModelo(id),
    });
    if (confirmou) {
      if (this.modeloId() === id) {
        this.modeloId.set(null);
      }
      this.modelos.reload();
      this.avisos.sucesso('Modelo excluído.');
    }
  }

  protected duracao(est: EstimativaEnvio): string {
    return est.duracaoSegundos <= 0 ? 'poucos instantes' : formatarEspera(est.duracaoSegundos);
  }

  protected dataHora(valor: string): string {
    return formatarDataHora(valor);
  }

  // Navegação entre passos -----------------------------------------------------------------

  protected irPara(passo: number): void {
    if (passo < this.passo()) {
      this.erroPasso.set(null);
      this.passo.set(passo);
    }
  }

  protected voltar(): void {
    this.erroPasso.set(null);
    if (this.passo() === this.primeiroPasso()) {
      void this.roteador.navigate(
        this.campanhaId() ? ['/disparos', this.campanhaId()] : ['/disparos'],
      );
      return;
    }
    this.passo.update((p) => p - 1);
  }

  /** Confere o passo, salva o rascunho e segue. */
  protected async avancar(): Promise<void> {
    this.erroPasso.set(null);
    const variaveis = this.variaveisEditor();
    const erro = erroDoPasso(this.passo(), this.estado(), variaveis);
    if (erro) {
      this.erroPasso.set(erro);
      return;
    }
    if (!(await this.salvar())) {
      return;
    }
    if (this.passo() >= this.ultimoPasso()) {
      this.avisos.sucesso('Alterações salvas.');
      await this.roteador.navigate(['/disparos', this.campanhaId()]);
      return;
    }
    this.resultadoTeste.set(null);
    this.passo.update((p) => p + 1);
  }

  protected async salvarESair(): Promise<void> {
    this.erroPasso.set(null);
    if (this.nome().trim() === '') {
      this.erroPasso.set('Dê um nome à campanha antes de sair.');
      return;
    }
    if (await this.salvar()) {
      this.avisos.sucesso('Rascunho salvo.');
      await this.roteador.navigate(['/disparos', this.campanhaId()]);
    }
  }

  /** Cria ou atualiza o rascunho; `false` quando a API recusou (o motivo aparece na tela). */
  private async salvar(): Promise<boolean> {
    this.salvando.set(true);
    try {
      const id = this.campanhaId();
      const dados = montarDados(this.estado(), this.limitado(), id !== null);
      const campanha = id ? await this.api.atualizar(id, dados) : await this.api.criar(dados);
      if (!id) {
        this.campanhaId.set(campanha.id);
        // A URL passa a ser a de edição, sem recarregar a tela: "voltar" do navegador não duplica.
        this.endereco.replaceState(`/disparos/${campanha.id}/editar`);
      }
      return true;
    } catch (falha) {
      this.erroPasso.set(erroDaApi(falha).mensagem);
      return false;
    } finally {
      this.salvando.set(false);
    }
  }

  protected async enviarTeste(): Promise<void> {
    const id = this.campanhaId();
    if (!id) {
      return;
    }
    this.enviandoTeste.set(true);
    this.resultadoTeste.set(null);
    try {
      await this.api.enviarTeste(id);
      this.resultadoTeste.set(
        'Teste enviado. Confira no seu ' + (this.canal() === 'EMAIL' ? 'e-mail.' : 'WhatsApp.'),
      );
    } catch (falha) {
      this.resultadoTeste.set(erroDaApi(falha).mensagem);
    } finally {
      this.enviandoTeste.set(false);
    }
  }

  protected async iniciar(): Promise<void> {
    const id = this.campanhaId();
    if (!id) {
      return;
    }
    this.erroPasso.set(null);
    this.salvando.set(true);
    try {
      const agendada = this.agenda().modo === 'data' ? agendaParaIso(this.agenda().dataHora) : null;
      const campanha = await this.api.iniciar(id, agendada);
      this.avisos.sucesso(
        campanha.status === 'AGUARDANDO_APROVACAO'
          ? 'Pedido enviado ao líder da área.'
          : campanha.status === 'AGENDADA'
            ? 'Campanha agendada.'
            : 'Campanha iniciada.',
      );
      await this.roteador.navigate(['/disparos', campanha.id]);
    } catch (falha) {
      const erro = erroDaApi(falha);
      const problemas = erro.detalhes?.['problemas'];
      this.erroPasso.set(
        Array.isArray(problemas) && problemas.length > 0
          ? problemas
              .map((p: { mensagem?: string }) => p.mensagem)
              .filter(Boolean)
              .join(' ')
          : erro.mensagem,
      );
      this.revisao.reload();
    } finally {
      this.salvando.set(false);
    }
  }
}
