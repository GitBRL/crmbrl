import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LucideBan,
  LucideCheck,
  LucideForward,
  LucidePencil,
  LucideRotateCcw,
} from '@lucide/angular';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { CampoData, isoParaLocal, localParaIso } from '../../ui/campo-data/campo-data';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Dica } from '../../ui/dica/dica';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { MenuAcoes, type ItemMenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { PainelLateral } from '../../ui/painel-lateral/painel-lateral';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { Selo } from '../../ui/selo/selo';
import {
  dataHora,
  linkDoNegocio,
  quandoDaAtividade,
  quandoPorExtenso,
  ROTULO_PRIORIDADE,
  TIPOS,
  TIPOS_DA_AGENDA,
} from './apresentacao';
import {
  AtividadesApi,
  vinculoDaAtividade,
  vinculoParaAlterar,
  type AlteracaoAtividade,
  type Atividade,
  type PrioridadeAtividade,
  type Responsavel,
  type TipoAtividade,
  type Vinculo,
} from './atividades.api';
import { horaDoFim } from './criacao-rapida';
import { SeletorVinculo } from './seletor-vinculo';

type Estado = 'carregando' | 'pronto' | 'erro';

/** O que mudou numa atividade, para a lista se atualizar. */
export interface MudancaAtividade {
  readonly atividade: Atividade;
  readonly acao: 'concluida' | 'reaberta' | 'cancelada' | 'alterada';
}

/**
 * Detalhe de uma atividade num painel lateral (`/atividades?atividade=<id>`, também o link das
 * notificações de lembrete): quando, responsável, quem criou, vínculos com links, o selo
 * "Encaminhada de" com a data (R7.3) e a descrição. Ações: concluir ou reabrir (rodapé),
 * editar (o formulário entra no lugar dos dados) e cancelar, com confirmação.
 */
@Component({
  selector: 'app-detalhe-atividade',
  imports: [
    AreaTexto,
    Avatar,
    Botao,
    CampoData,
    CampoTexto,
    Dica,
    EstadoVazio,
    Esqueleto,
    GrupoOpcoes,
    MenuAcoes,
    PainelLateral,
    ReactiveFormsModule,
    RouterLink,
    Seletor,
    Selo,
    SeletorVinculo,
  ],
  templateUrl: './detalhe-atividade.html',
  styleUrl: './detalhe-atividade.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalheAtividade {
  private readonly api = inject(AtividadesApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly sessao = inject(SessaoService);

  /** A atividade aberta (`null` = painel fechado). */
  readonly atividadeId = input<string | null>(null);
  /** Abre já na edição (ação "Editar" do menu da lista). */
  readonly editarAoAbrir = input(false);
  readonly fechado = output<void>();
  readonly mudou = output<MudancaAtividade>();

  protected readonly icones = {
    concluir: LucideCheck,
    reabrir: LucideRotateCcw,
    editar: LucidePencil,
    encaminhada: LucideForward,
  };

  protected readonly aberto = signal(false);
  protected readonly estado = signal<Estado>('carregando');
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly atividade = signal<Atividade | null>(null);
  protected readonly editando = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);

  protected readonly titulo = computed(() => {
    const atividade = this.atividade();
    if (atividade) {
      return atividade.titulo;
    }
    return this.estado() === 'erro' ? 'Atividade' : 'Carregando…';
  });
  protected readonly complemento = computed(() => {
    const atividade = this.atividade();
    return atividade ? `· ${TIPOS[atividade.tipo].rotulo}` : null;
  });
  /** A linha de status embaixo do título: "Atrasada · venceu ontem às 16:10". */
  protected readonly situacao = computed(() => {
    const atividade = this.atividade();
    if (!atividade) {
      return null;
    }
    switch (atividade.status) {
      case 'CONCLUIDA':
        return `Concluída${atividade.concluidaPor ? ` por ${atividade.concluidaPor.nome}` : ''} em ${dataHora(atividade.concluidaEm)}`;
      case 'CANCELADA':
        return `Cancelada em ${dataHora(atividade.canceladaEm)}`;
      default: {
        const quando = quandoDaAtividade(atividade).toLocaleLowerCase('pt-BR');
        return atividade.atrasada ? `Atrasada · ${quando}` : `Pendente · ${quando}`;
      }
    }
  });
  protected readonly quandoExtenso = computed(() => {
    const atividade = this.atividade();
    return atividade ? quandoPorExtenso(atividade) : null;
  });
  protected readonly rotuloPrioridade = ROTULO_PRIORIDADE;
  protected readonly linkNegocio = computed(() => {
    const negocio = this.atividade()?.negocio;
    return negocio ? linkDoNegocio(negocio) : null;
  });
  protected readonly criadaEm = computed(() => dataHora(this.atividade()?.criadoEm ?? null));
  protected readonly encaminhadaEm = computed(() =>
    dataHora(this.atividade()?.encaminhadaEm ?? null),
  );

  protected readonly acoes = computed<readonly ItemMenuAcoes[]>(() => {
    const atividade = this.atividade();
    if (!atividade) {
      return [];
    }
    if (atividade.status === 'PENDENTE') {
      return [
        { id: 'editar', rotulo: 'Editar', icone: LucidePencil },
        {
          id: 'cancelar',
          rotulo: 'Cancelar atividade',
          icone: LucideBan,
          perigo: true,
          separarAntes: true,
        },
      ];
    }
    return [
      { id: 'reabrir', rotulo: 'Reabrir', icone: LucideRotateCcw },
      ...(atividade.status === 'CONCLUIDA'
        ? [{ id: 'editar', rotulo: 'Editar', icone: LucidePencil }]
        : []),
    ];
  });

  // Edição ---------------------------------------------------------------------------------

  protected readonly opcoesTipo: readonly OpcaoGrupo<TipoAtividade>[] = TIPOS_DA_AGENDA.map(
    (tipo) => ({ valor: tipo, rotulo: TIPOS[tipo].rotulo, icone: TIPOS[tipo].icone }),
  );
  protected readonly opcoesPrioridade: readonly OpcaoGrupo<PrioridadeAtividade>[] = (
    ['BAIXA', 'MEDIA', 'ALTA'] as const
  ).map((prioridade) => ({ valor: prioridade, rotulo: ROTULO_PRIORIDADE[prioridade] }));

  protected readonly formulario = new FormGroup({
    tipo: new FormControl<TipoAtividade>('TAREFA', { nonNullable: true }),
    titulo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    quando: new FormControl<string | null>(null),
    fim: new FormControl<string | null>(null),
    prioridade: new FormControl<PrioridadeAtividade>('MEDIA', { nonNullable: true }),
    responsavelId: new FormControl<string | null>(null),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(10000)],
    }),
  });
  protected readonly tipoEditado = signal<TipoAtividade>('TAREFA');
  protected readonly vinculo = signal<Vinculo | null>(null);
  /** Só quem vê outras pessoas (líder, C-level, Admin) troca o responsável. */
  protected readonly podeTrocarResponsavel = computed(() =>
    this.sessao.permite((permissoes) => permissoes.verUsuarios !== 'PROPRIOS'),
  );
  protected readonly responsaveis = signal<readonly Responsavel[]>([]);
  protected readonly opcoesResponsavel = computed<readonly OpcaoSeletor<string>[]>(() => {
    const atual = this.atividade()?.responsavel;
    const lista = this.responsaveis().map((pessoa) => ({
      valor: pessoa.id,
      rotulo: `${pessoa.nome} · ${pessoa.rotuloPapel}`,
    }));
    return atual && !lista.some((opcao) => opcao.valor === atual.id)
      ? [{ valor: atual.id, rotulo: atual.nome }, ...lista]
      : lista;
  });

  private consulta = 0;

  constructor() {
    effect(() => {
      const id = this.atividadeId();
      untracked(() => {
        if (id) {
          this.aberto.set(true);
          void this.carregar(id);
        } else {
          this.aberto.set(false);
        }
      });
    });
    this.formulario.controls.tipo.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((tipo) => this.tipoEditado.set(tipo));
  }

  protected aoFechar(): void {
    this.editando.set(false);
    this.fechado.emit();
  }

  protected tentarDeNovo(): void {
    const id = this.atividadeId();
    if (id) {
      void this.carregar(id);
    }
  }

  protected agir(acao: string): void {
    switch (acao) {
      case 'editar':
        this.editar();
        break;
      case 'cancelar':
        void this.cancelar();
        break;
      case 'reabrir':
        void this.mudarStatus('reabrir');
        break;
    }
  }

  protected concluirOuReabrir(): void {
    void this.mudarStatus(this.atividade()?.status === 'PENDENTE' ? 'concluir' : 'reabrir');
  }

  /** Abre a edição já no modo de formulário (ação "Editar" da lista). */
  editar(): void {
    const atividade = this.atividade();
    if (!atividade) {
      return;
    }
    const reuniao = atividade.tipo === 'REUNIAO';
    this.formulario.reset({
      tipo: atividade.tipo === 'NOTA' ? 'TAREFA' : atividade.tipo,
      titulo: atividade.titulo,
      quando: isoParaLocal(reuniao ? atividade.inicioEm : atividade.venceEm, 'data-hora'),
      fim: reuniao ? isoParaLocal(atividade.fimEm, 'hora') : null,
      prioridade: atividade.prioridade,
      responsavelId: atividade.responsavel.id,
      descricao: atividade.descricao ?? '',
    });
    this.tipoEditado.set(this.formulario.controls.tipo.value);
    this.vinculo.set(vinculoDaAtividade(atividade));
    this.erroGeral.set(null);
    this.editando.set(true);
    if (this.podeTrocarResponsavel() && this.responsaveis().length === 0) {
      void this.api
        .responsaveis()
        .then((lista) => this.responsaveis.set(lista))
        .catch(() => this.responsaveis.set([]));
    }
  }

  protected desistirDeEditar(): void {
    this.editando.set(false);
    this.erroGeral.set(null);
  }

  protected async salvar(evento: Event): Promise<void> {
    evento.preventDefault();
    const atividade = this.atividade();
    if (!atividade || this.salvando()) {
      return;
    }
    this.formulario.markAllAsTouched();
    const alteracao = this.montarAlteracao(atividade);
    if (!alteracao) {
      return;
    }
    this.salvando.set(true);
    this.erroGeral.set(null);
    try {
      const salva = await this.api.atualizar(atividade.id, alteracao);
      this.atividade.set(salva);
      this.editando.set(false);
      this.avisos.sucesso('Atividade salva.');
      this.mudou.emit({ atividade: salva, acao: 'alterada' });
    } catch (falha) {
      this.mostrarErroDoFormulario(erroDaApi(falha));
    } finally {
      this.salvando.set(false);
    }
  }

  private montarAlteracao(atividade: Atividade): AlteracaoAtividade | null {
    const { tipo, titulo, quando, fim, prioridade, responsavelId, descricao } =
      this.formulario.getRawValue();
    const controles = this.formulario.controls;
    if (tipo === 'REUNIAO' && !quando) {
      controles.quando.setErrors({ api: 'Diga quando a reunião começa.' });
    }
    let inicioEm: string | null = null;
    let fimEm: string | null = null;
    if (tipo === 'REUNIAO' && quando) {
      inicioEm = localParaIso(quando, 'data-hora');
      const horaFim = fim ?? horaDoFim(quando);
      fimEm = horaFim ? localParaIso(`${quando.slice(0, 10)}T${horaFim}`, 'data-hora') : null;
      if (!fimEm || !inicioEm || fimEm < inicioEm) {
        controles.fim.setErrors({ api: 'O fim precisa ser no mesmo dia, depois do início.' });
      }
    }
    if (this.formulario.invalid) {
      return null;
    }
    const original = vinculoDaAtividade(atividade);
    const vinculo = this.vinculo();
    const vinculoMudou = (original?.id ?? null) !== (vinculo?.id ?? null);
    return {
      tipo,
      titulo: titulo.trim(),
      prioridade,
      descricao: descricao.trim() || null,
      ...(tipo === 'REUNIAO'
        ? { inicioEm, fimEm }
        : { venceEm: localParaIso(quando, 'data-hora') }),
      ...(responsavelId && responsavelId !== atividade.responsavel.id ? { responsavelId } : {}),
      ...(vinculoMudou ? vinculoParaAlterar(vinculo) : {}),
    };
  }

  private mostrarErroDoFormulario(erro: ErroApi): void {
    const campos: Readonly<Record<string, keyof typeof this.formulario.controls>> = {
      titulo: 'titulo',
      tipo: 'tipo',
      venceEm: 'quando',
      inicioEm: 'quando',
      fimEm: 'fim',
      prioridade: 'prioridade',
      responsavelId: 'responsavelId',
      descricao: 'descricao',
    };
    let algum = false;
    for (const [campo, controle] of Object.entries(campos)) {
      const mensagem = erro.mensagemDoCampo(campo);
      if (mensagem) {
        this.formulario.controls[controle].setErrors({ api: mensagem });
        algum = true;
      }
    }
    if (!algum) {
      this.erroGeral.set(erro.mensagem);
    }
  }

  private async carregar(id: string): Promise<void> {
    const consulta = ++this.consulta;
    const jaCarregada = this.atividade()?.id === id;
    if (!jaCarregada) {
      this.atividade.set(null);
      this.estado.set('carregando');
      this.editando.set(false);
    }
    this.erro.set(null);
    try {
      const atividade = await this.api.obter(id);
      if (consulta !== this.consulta) {
        return;
      }
      this.atividade.set(atividade);
      this.estado.set('pronto');
      if (this.editarAoAbrir() && !this.editando()) {
        this.editar();
      }
    } catch (falha) {
      if (consulta !== this.consulta) {
        return;
      }
      this.atividade.set(null);
      this.erro.set(erroDaApi(falha));
      this.estado.set('erro');
    }
  }

  private async mudarStatus(acao: 'concluir' | 'reabrir'): Promise<void> {
    const atividade = this.atividade();
    if (!atividade || this.ocupado()) {
      return;
    }
    this.ocupado.set(true);
    try {
      const nova =
        acao === 'concluir'
          ? await this.api.concluir(atividade.id)
          : await this.api.reabrir(atividade.id);
      this.aplicar(nova);
      if (acao === 'concluir') {
        this.avisos.sucesso('Atividade concluída.', {
          chave: `conclusao-${nova.id}`,
          acao: { rotulo: 'Desfazer', executar: () => void this.desfazer(nova.id) },
        });
        this.mudou.emit({ atividade: nova, acao: 'concluida' });
      } else {
        this.avisos.sucesso('Atividade reaberta.', { chave: `conclusao-${nova.id}` });
        this.mudou.emit({ atividade: nova, acao: 'reaberta' });
      }
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.ocupado.set(false);
    }
  }

  /** "Desfazer" do aviso: reabre aquela atividade, mesmo que o painel já mostre outra. */
  private async desfazer(id: string): Promise<void> {
    try {
      const reaberta = await this.api.reabrir(id);
      this.aplicar(reaberta);
      this.avisos.sucesso('Atividade reaberta.', { chave: `conclusao-${id}` });
      this.mudou.emit({ atividade: reaberta, acao: 'reaberta' });
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  /** Atualiza o painel se ele ainda mostra a mesma atividade. */
  private aplicar(atividade: Atividade): void {
    if (this.atividade()?.id === atividade.id) {
      this.atividade.set(atividade);
    }
  }

  private async cancelar(): Promise<void> {
    const atividade = this.atividade();
    if (!atividade) {
      return;
    }
    let cancelada: Atividade | null = null;
    const confirmou = await this.confirmacao.confirmar({
      titulo: `Cancelar “${atividade.titulo}”?`,
      mensagem:
        'A atividade sai da agenda e não gera mais lembretes. Ela continua na linha do tempo e pode ser reaberta depois.',
      confirmar: 'Cancelar atividade',
      cancelar: 'Manter',
      perigo: true,
      executar: async () => {
        cancelada = await this.api.cancelar(atividade.id);
      },
    });
    const resultado = cancelada as Atividade | null;
    if (confirmou && resultado) {
      this.aplicar(resultado);
      this.avisos.sucesso('Atividade cancelada.', {
        acao: { rotulo: 'Desfazer', executar: () => void this.desfazer(resultado.id) },
      });
      this.mudou.emit({ atividade: resultado, acao: 'cancelada' });
    }
  }
}
