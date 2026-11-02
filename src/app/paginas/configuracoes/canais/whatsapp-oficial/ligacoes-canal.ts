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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideCircleCheck,
  LucideDynamicIcon,
  LucidePhone,
  LucidePhoneOff,
  LucideRefreshCw,
  LucideTriangleAlert,
} from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../../../nucleo/api/erro-api';
import { AvisosService } from '../../../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../../../nucleo/confirmacao.service';
import { formatarDataHora } from '../../../../nucleo/formatos';
import { LigacoesApi } from '../../../../nucleo/ligacoes/ligacoes.api';
import type {
  ConfiguracaoLigacoes,
  DadosConfiguracaoLigacoes,
  HorarioDeLigacoes,
} from '../../../../nucleo/ligacoes/ligacoes.tipos';
import { AreaTexto } from '../../../../ui/area-texto/area-texto';
import { Botao } from '../../../../ui/botao/botao';
import { CaixaSelecao } from '../../../../ui/caixa-selecao/caixa-selecao';
import { CampoTexto } from '../../../../ui/campo-texto/campo-texto';
import { Cartao } from '../../../../ui/cartao/cartao';
import { Esqueleto } from '../../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../../ui/estado-vazio/estado-vazio';
import { Selo } from '../../../../ui/selo/selo';
import { Seletor } from '../../../../ui/seletor/seletor';
import { horarioComercial, resumoDoHorario } from '../../atendimento/apresentacao';
import { EditorHorario } from '../../atendimento/editor-horario';
import { Carregamento } from '../../carregamento';
import { CanaisApi } from '../canais.api';
import type { HorarioDeAtendimento } from '../canais.modelos';
import { AJUDA_FILA_PADRAO, FilasDisponiveis } from '../comum/filas';

/** Tempo de toque aceito pela API (10 a 40 s, sempre abaixo do prazo da Meta para atender). */
export const TOQUE_MINIMO_SEGUNDOS = 10;
export const TOQUE_MAXIMO_SEGUNDOS = 40;

/**
 * Requisitos da Meta para ligar pelo WhatsApp, em linguagem simples (contrato da Onda E, §2.2).
 * Cada item diz o que fazer, não o nome técnico.
 */
export const REQUISITOS_DA_META: readonly { readonly titulo: string; readonly texto: string }[] = [
  {
    titulo: 'Número só na API oficial',
    texto:
      'O número que recebe as ligações não pode estar em uso no aplicativo WhatsApp Business do celular ao mesmo tempo (a Meta chama isso de coexistência e não leva ligações).',
  },
  {
    titulo: 'Limite de mensagens de 2.000 ou mais',
    texto:
      'No Meta Business, o número precisa ter o limite de conversas por dia em 2.000 ou mais. Para chegar lá, mande mensagens com boa qualidade e peça a verificação da empresa.',
  },
  {
    titulo: 'Forma de pagamento na conta',
    texto:
      'As ligações que a empresa faz são cobradas pela Meta por minuto. Cadastre uma forma de pagamento na conta do WhatsApp Business antes de ligar.',
  },
  {
    titulo: 'Campo “calls” no webhook',
    texto:
      'No painel do app da Meta, em Webhooks, assine também o campo “calls” (além de “messages”) no mesmo endereço deste canal. Sem isso o CRM não fica sabendo que o cliente está ligando.',
  },
  {
    titulo: 'Permissão do cliente para ligar',
    texto:
      'A empresa só liga para quem permitiu. O CRM pede a permissão por mensagem (no máximo 1 pedido por dia e 2 por semana para o mesmo cliente) e confere na Meta antes de cada ligação.',
  },
  {
    titulo: 'Áudio direto no navegador',
    texto:
      'A voz vai direto entre o navegador do atendente e a Meta. Use o CRM em endereço seguro (https), permita o microfone e evite redes que bloqueiam chamadas de voz pela internet.',
  },
];

/**
 * Aba "Ligações" do canal WhatsApp oficial (Configurações → Canais, só Admin; Onda E, E2). Ativa
 * ou desativa as chamadas no número (a Meta valida: se ela recusar, nada é gravado e o motivo
 * aparece), mostra ou esconde o botão Ligar, escolhe a fila e o horário, o tempo de toque, se grava
 * e a mensagem automática de ligação perdida.
 */
@Component({
  selector: 'app-ligacoes-canal',
  imports: [
    ReactiveFormsModule,
    LucideDynamicIcon,
    AreaTexto,
    Botao,
    CaixaSelecao,
    CampoTexto,
    Cartao,
    EditorHorario,
    Esqueleto,
    EstadoVazio,
    Selo,
    Seletor,
  ],
  templateUrl: './ligacoes-canal.html',
  styleUrl: './ligacoes-canal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LigacoesCanal {
  readonly canalId = input.required<string>();
  readonly nomeDoCanal = input('');

  private readonly api = inject(LigacoesApi);
  private readonly canaisApi = inject(CanaisApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);

  protected readonly icones = {
    telefone: LucidePhone,
    desligado: LucidePhoneOff,
    ok: LucideCircleCheck,
    aviso: LucideTriangleAlert,
    tentar: LucideRefreshCw,
  };
  protected readonly requisitos = REQUISITOS_DA_META;
  protected readonly ajudaFila = AJUDA_FILA_PADRAO;
  protected readonly toqueMinimo = TOQUE_MINIMO_SEGUNDOS;
  protected readonly toqueMaximo = TOQUE_MAXIMO_SEGUNDOS;

  protected readonly config = new Carregamento<ConfiguracaoLigacoes>();
  protected readonly filas = new FilasDisponiveis(this.canaisApi);
  protected readonly salvando = signal(false);
  protected readonly alterandoEstado = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  protected readonly erroDoEstado = signal<string | null>(null);
  /** Horário próprio das ligações (senão vale o da fila/do canal). */
  protected readonly horarioProprio = signal(false);
  protected readonly horario = signal<HorarioDeAtendimento>(horarioComercial());

  protected readonly formulario = new FormGroup({
    botaoVisivel: new FormControl(true, { nonNullable: true }),
    filaId: new FormControl<string | null>(null),
    gravar: new FormControl(true, { nonNullable: true }),
    tempoDeToqueSegundos: new FormControl(25, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(TOQUE_MINIMO_SEGUNDOS),
        Validators.max(TOQUE_MAXIMO_SEGUNDOS),
      ],
    }),
    mensagemPerdidaAtiva: new FormControl(false, { nonNullable: true }),
    mensagemPerdida: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
  });

  protected readonly resumoEfetivo = computed(() => {
    const efetivo = this.config.dados()?.horarioEfetivo;
    return resumoDoHorario((efetivo as HorarioDeAtendimento | null | undefined) ?? null);
  });

  constructor() {
    effect(() => {
      this.canalId();
      untracked(() => void this.abrir());
    });
  }

  protected dataHora(valor: string): string {
    return formatarDataHora(valor);
  }

  protected async abrir(): Promise<void> {
    void this.filas.carregar();
    const ok = await this.config.executar(() => this.api.configuracao(this.canalId()));
    if (ok) {
      this.preencher(this.config.dados()!);
    }
  }

  private preencher(config: ConfiguracaoLigacoes): void {
    this.formulario.reset({
      botaoVisivel: config.botaoVisivel,
      filaId: config.filaId,
      gravar: config.gravar,
      tempoDeToqueSegundos: config.tempoDeToqueSegundos,
      mensagemPerdidaAtiva: config.mensagemPerdidaAtiva,
      mensagemPerdida: config.mensagemPerdida ?? '',
    });
    this.horarioProprio.set(config.horario !== null);
    this.horario.set(
      (config.horario ?? config.horarioEfetivo ?? horarioComercial()) as HorarioDeAtendimento,
    );
    this.erroGeral.set(null);
  }

  /** Liga ou desliga as chamadas no número (a Meta confirma antes de gravar). */
  protected async alternarEstado(): Promise<void> {
    const atual = this.config.dados();
    if (!atual || this.alterandoEstado()) {
      return;
    }
    const ativar = !atual.ativa;
    if (!ativar) {
      const ok = await this.confirmacao.confirmar({
        titulo: 'Desativar as ligações neste número?',
        mensagem:
          'Os clientes deixam de poder ligar para o número e o botão Ligar some do CRM. As ligações em andamento não são derrubadas.',
        confirmar: 'Desativar ligações',
        perigo: true,
        executar: async () => undefined,
      });
      if (!ok) {
        return;
      }
    }
    this.alterandoEstado.set(true);
    this.erroDoEstado.set(null);
    try {
      this.config.definir(await this.api.salvarConfiguracao(this.canalId(), { ativa: ativar }));
      this.avisos.sucesso(ativar ? 'Ligações ativadas neste número.' : 'Ligações desativadas.');
    } catch (falha) {
      this.erroDoEstado.set(explicarRecusa(erroDaApi(falha)));
    } finally {
      this.alterandoEstado.set(false);
    }
  }

  protected async salvar(): Promise<void> {
    if (this.salvando()) {
      return;
    }
    this.erroGeral.set(null);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) {
      this.erroGeral.set('Confira os campos marcados.');
      return;
    }
    const v = this.formulario.getRawValue();
    const dados: DadosConfiguracaoLigacoes = {
      botaoVisivel: v.botaoVisivel,
      filaId: v.filaId,
      gravar: v.gravar,
      tempoDeToqueSegundos: Number(v.tempoDeToqueSegundos),
      mensagemPerdidaAtiva: v.mensagemPerdidaAtiva,
      mensagemPerdida: v.mensagemPerdida.trim() || null,
      horario: this.horarioProprio() ? (this.horario() as unknown as HorarioDeLigacoes) : null,
    };
    this.salvando.set(true);
    try {
      const salvo = await this.api.salvarConfiguracao(this.canalId(), dados);
      this.config.definir(salvo);
      this.preencher(salvo);
      this.avisos.sucesso('Configuração das ligações salva.');
    } catch (falha) {
      const erro = erroDaApi(falha);
      for (const campo of ['tempoDeToqueSegundos', 'mensagemPerdida'] as const) {
        const mensagem = erro.mensagemDoCampo(campo);
        if (mensagem) {
          this.formulario.controls[campo].setErrors({ api: mensagem });
          this.formulario.controls[campo].markAsTouched();
        }
      }
      this.erroGeral.set(erro.campos.length > 0 ? 'Confira os campos marcados.' : erro.mensagem);
    } finally {
      this.salvando.set(false);
    }
  }
}

/** A Meta recusou ativar/desativar: traduz o motivo em uma frase com o que fazer. */
export function explicarRecusa(erro: ErroApi): string {
  const motivo = erro.detalhes?.['motivo'];
  const codigo = erro.detalhes?.['codigoDaMeta'];
  if (motivo === 'limite_de_mensagens_baixo' || codigo === 138015) {
    return 'A Meta não ativou: o limite de mensagens do número está abaixo de 2.000 por dia. Aumente o limite no Meta Business e tente de novo.';
  }
  if (motivo === 'sip_ativo' || codigo === 131055 || codigo === 138018) {
    return 'A Meta não ativou: o número está configurado com SIP ou faltam pré-requisitos técnicos. Ajuste no painel da Meta.';
  }
  if (motivo === 'token_invalido') {
    return 'A Meta recusou o token do canal. Gere um novo token de acesso e salve na aba Conexão.';
  }
  if (motivo === 'sem_forma_de_pagamento') {
    return 'A conta não tem forma de pagamento válida. Cadastre uma no Meta Business e tente de novo.';
  }
  return erro.mensagem;
}
