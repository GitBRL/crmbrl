import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideCalendarClock,
  LucideClock,
  LucideDynamicIcon,
  LucideEye,
  LucidePencil,
  LucideRefreshCw,
} from '@lucide/angular';

import { erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { SessaoService } from '../../../nucleo/sessao/sessao.service';
import { podeGerenciarCanais } from '../../../nucleo/sessao/perfil';
import { AreaTexto } from '../../../ui/area-texto/area-texto';
import { Botao } from '../../../ui/botao/botao';
import { CaixaSelecao } from '../../../ui/caixa-selecao/caixa-selecao';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { GrupoOpcoes, type OpcaoGrupo } from '../../../ui/grupo-opcoes/grupo-opcoes';
import { PainelLateral } from '../../../ui/painel-lateral/painel-lateral';
import type { VarianteSelo } from '../../../ui/selo/selo';
import { Selo } from '../../../ui/selo/selo';
import { Seletor } from '../../../ui/seletor/seletor';
import { TIPO_DE_CANAL } from '../canais/apresentacao';
import { CanaisApi } from '../canais/canais.api';
import type { HorarioDeAtendimento, TipoCanal } from '../canais/canais.modelos';
import { AJUDA_FILA_PADRAO, FilasDisponiveis } from '../canais/comum/filas';
import { ICONE_DO_CANAL } from '../canais/icones';
import { Carregamento } from '../carregamento';
import { horarioComercial, resumoDoHorario, situacaoDoHorario } from './apresentacao';
import { AtendimentoConfigApi } from './atendimento.api';
import {
  type CanalDoAtendimento,
  type DadosAtendimentoDoCanal,
  TAMANHO_MAXIMO_AUTOMATICA,
} from './atendimento.modelos';
import { EditorHorario } from './editor-horario';

type ModoHorario = '24h' | 'definido';

const OPCOES_MODO: readonly OpcaoGrupo<ModoHorario>[] = [
  { valor: '24h', rotulo: '24 horas' },
  { valor: 'definido', rotulo: 'Horário definido' },
];

/** Sugestão para quem liga a resposta fora do horário pela primeira vez. */
export const MENSAGEM_FORA_SUGERIDA =
  'Olá! Recebemos a sua mensagem. Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Assim que voltarmos, respondemos por aqui.';

interface ItemDaLista {
  readonly canal: CanalDoAtendimento;
  readonly tipo: string;
  readonly situacao: string;
  readonly selo: VarianteSelo;
  readonly horario: string;
}

/**
 * Horário e satisfação (`/configuracoes/atendimento/horarios`) — R12: cada canal com a situação
 * agora (aberto, fechado, 24 h), o horário resumido, a resposta automática fora do horário, a
 * pesquisa de satisfação e a fila. O painel lateral edita (Admin e C-level; os líderes veem).
 * `?canal=<id>` abre o canal direto (atalho das telas de Canais).
 */
@Component({
  selector: 'app-config-horarios',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideCalendarClock,
    LucideClock,
    LucideDynamicIcon,
    AreaTexto,
    Botao,
    CaixaSelecao,
    EditorHorario,
    Esqueleto,
    EstadoVazio,
    GrupoOpcoes,
    PainelLateral,
    Selo,
    Seletor,
  ],
  templateUrl: './horarios.html',
  styleUrl: './horarios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Horarios {
  /** `?canal=<id>`: abre o painel desse canal. */
  readonly canalDaUrl = input<string | undefined>(undefined, { alias: 'canal' });

  private readonly api = inject(AtendimentoConfigApi);
  private readonly avisos = inject(AvisosService);
  private readonly sessao = inject(SessaoService);
  private readonly router = inject(Router);

  protected readonly icones = { tentar: LucideRefreshCw, editar: LucidePencil, ver: LucideEye };
  protected readonly iconeDoCanal = ICONE_DO_CANAL;
  protected readonly ajudaFila = AJUDA_FILA_PADRAO;
  protected readonly opcoesModo = OPCOES_MODO;
  protected readonly tamanhoAutomatica = TAMANHO_MAXIMO_AUTOMATICA;

  protected readonly dados = new Carregamento<readonly CanalDoAtendimento[]>();
  protected readonly filas = new FilasDisponiveis(inject(CanaisApi));
  protected readonly aberto = signal<CanalDoAtendimento | null>(null);
  protected readonly horario = signal<HorarioDeAtendimento>(horarioComercial());
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);

  private readonly editor = viewChild<EditorHorario>('editor');

  protected readonly formulario = new FormGroup({
    filaPadraoId: new FormControl<string | null>(null),
    modo: new FormControl<ModoHorario>('24h', { nonNullable: true }),
    responderFora: new FormControl(false, { nonNullable: true }),
    mensagemForaHorario: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(TAMANHO_MAXIMO_AUTOMATICA)],
    }),
    pesquisaSatisfacao: new FormControl(false, { nonNullable: true }),
    mensagemSatisfacao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(TAMANHO_MAXIMO_AUTOMATICA)],
    }),
  });

  protected readonly podeEditarAlgum = computed(() => this.sessao.ehDiretoria());
  protected readonly podeCriarCanais = computed(() => this.sessao.permite(podeGerenciarCanais));

  protected readonly canais = computed<readonly ItemDaLista[]>(() =>
    (this.dados.dados() ?? []).map((canal) => {
      const temHorario = canal.horarioAtendimento !== null;
      return {
        canal,
        tipo: TIPO_DE_CANAL[canal.tipo].rotulo,
        situacao: situacaoDoHorario(canal.situacaoHorario, temHorario),
        selo: !temHorario ? 'ciano' : canal.situacaoHorario.aberto ? 'menta' : 'neutro',
        horario: resumoDoHorario(canal.horarioAtendimento),
      };
    }),
  );

  constructor() {
    this.carregar();
    // Ligar a resposta fora do horário pela primeira vez já traz uma sugestão.
    this.formulario.controls.responderFora.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((ligada) => {
        const mensagem = this.formulario.controls.mensagemForaHorario;
        if (ligada && !mensagem.value.trim()) {
          mensagem.setValue(MENSAGEM_FORA_SUGERIDA);
        }
      });
    // Escolher "Horário definido" num canal 24 horas começa pelo horário comercial.
    this.formulario.controls.modo.valueChanges.pipe(takeUntilDestroyed()).subscribe((modo) => {
      if (modo === 'definido' && !this.aberto()?.horarioAtendimento) {
        this.horario.set(horarioComercial());
      }
    });
    effect(() => {
      const id = this.canalDaUrl();
      const canais = this.dados.dados();
      if (id && canais) {
        untracked(() => {
          const canal = canais.find((item) => item.id === id);
          if (canal && this.aberto()?.id !== id) {
            this.abrir(canal);
          }
        });
      }
    });
  }

  protected carregar(): void {
    void this.dados.executar(() => this.api.listarCanais());
    void this.filas.carregar();
  }

  protected rotuloDoTipo(tipo: TipoCanal): string {
    return TIPO_DE_CANAL[tipo].rotulo;
  }

  protected abrir(canal: CanalDoAtendimento): void {
    this.erro.set(null);
    this.filas.definirAtual(
      canal.filaPadrao
        ? { id: canal.filaPadrao.id, nome: canal.filaPadrao.nome, area: canal.filaPadrao.area }
        : null,
    );
    this.horario.set(canal.horarioAtendimento ?? horarioComercial());
    this.formulario.reset(
      {
        filaPadraoId: canal.filaPadrao?.id ?? null,
        modo: canal.horarioAtendimento ? 'definido' : '24h',
        responderFora: canal.mensagemForaHorario !== null,
        mensagemForaHorario: canal.mensagemForaHorario ?? '',
        pesquisaSatisfacao: canal.pesquisaSatisfacao,
        mensagemSatisfacao: canal.mensagemSatisfacao ?? '',
      },
      { emitEvent: false },
    );
    if (canal.podeEditar) {
      this.formulario.enable({ emitEvent: false });
    } else {
      this.formulario.disable({ emitEvent: false });
    }
    this.aberto.set(canal);
  }

  protected fechar(): void {
    this.aberto.set(null);
    if (this.canalDaUrl()) {
      void this.router.navigate([], {
        queryParams: { canal: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  private montarDados(canal: CanalDoAtendimento): DadosAtendimentoDoCanal | string {
    const v = this.formulario.getRawValue();
    const horario = v.modo === 'definido' ? this.horario() : null;
    if (horario) {
      if (this.editor()?.invalido()) {
        return 'Confira os horários marcados.';
      }
      if (Object.values(horario.dias).every((intervalos) => !intervalos?.length)) {
        return 'Abra pelo menos um dia — ou escolha “24 horas”.';
      }
    }
    const fora = v.responderFora ? v.mensagemForaHorario.trim() || null : null;
    if (v.responderFora && !fora) {
      return 'Escreva a mensagem automática (ou desmarque a resposta fora do horário).';
    }
    const pergunta = v.pesquisaSatisfacao
      ? v.mensagemSatisfacao.trim() || null
      : canal.mensagemSatisfacao;
    const mesmoHorario = JSON.stringify(horario) === JSON.stringify(canal.horarioAtendimento);
    return {
      ...(v.filaPadraoId !== (canal.filaPadrao?.id ?? null)
        ? { filaPadraoId: v.filaPadraoId }
        : {}),
      ...(!mesmoHorario ? { horarioAtendimento: horario } : {}),
      ...(fora !== canal.mensagemForaHorario ? { mensagemForaHorario: fora } : {}),
      ...(v.pesquisaSatisfacao !== canal.pesquisaSatisfacao
        ? { pesquisaSatisfacao: v.pesquisaSatisfacao }
        : {}),
      ...(pergunta !== canal.mensagemSatisfacao ? { mensagemSatisfacao: pergunta } : {}),
    };
  }

  protected async salvar(): Promise<void> {
    const canal = this.aberto();
    if (!canal || !canal.podeEditar || this.salvando()) {
      return;
    }
    this.erro.set(null);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) {
      this.erro.set('Confira os campos marcados.');
      return;
    }
    const dados = this.montarDados(canal);
    if (typeof dados === 'string') {
      this.erro.set(dados);
      return;
    }
    if (Object.keys(dados).length === 0) {
      this.avisos.info('Nada mudou: não havia o que salvar.');
      this.fechar();
      return;
    }
    this.salvando.set(true);
    try {
      const salvo = await this.api.atualizarCanal(canal.id, dados);
      this.dados.definir(
        (this.dados.dados() ?? []).map((item) => (item.id === salvo.id ? salvo : item)),
      );
      this.avisos.sucesso(`Atendimento de “${salvo.nome}” salvo.`);
      this.fechar();
    } catch (falha) {
      this.erro.set(erroDaApi(falha).mensagem);
    } finally {
      this.salvando.set(false);
    }
  }
}
