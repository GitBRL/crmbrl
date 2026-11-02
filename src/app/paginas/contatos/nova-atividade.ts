import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { map } from 'rxjs';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { CampoData, localParaIso } from '../../ui/campo-data/campo-data';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { Modal } from '../../ui/modal/modal';
import { gerarId } from '../../ui/tipos';
import { ContatosApi, type DonoDoHistorico } from './contatos.api';
import {
  type AtividadeRelacionada,
  primeiroNome,
  ROTULO_TIPO_ATIVIDADE,
  type TipoAtividade,
} from './contatos.tipos';
import { ICONE_TIPO_ATIVIDADE } from './icones-atividade';

const TIPOS: readonly TipoAtividade[] = [
  'TAREFA',
  'LIGACAO',
  'REUNIAO',
  'EMAIL',
  'WHATSAPP',
  'NOTA',
];

/** Título sugerido para cada tipo ("Ligar para Ana"). */
export function tituloSugerido(tipo: TipoAtividade, nome: string): string {
  const quem = primeiroNome(nome);
  switch (tipo) {
    case 'LIGACAO':
      return `Ligar para ${quem}`;
    case 'REUNIAO':
      return `Reunião com ${quem}`;
    case 'EMAIL':
      return `Enviar e-mail para ${quem}`;
    case 'WHATSAPP':
      return `Mandar WhatsApp para ${quem}`;
    default:
      return '';
  }
}

/** R6.1: reunião tem início e fim, e o fim não vem antes do início. */
function periodoDaReuniao(grupo: AbstractControl): ValidationErrors | null {
  if (grupo.get('tipo')?.value !== 'REUNIAO') {
    return null;
  }
  const inicio = grupo.get('inicio')?.value as string | null;
  const fim = grupo.get('fim')?.value as string | null;
  if (!inicio || !fim) {
    return { periodo: 'Reunião precisa de início e fim.' };
  }
  return fim < inicio ? { periodo: 'O fim precisa ser depois do início.' } : null;
}

/**
 * Nova atividade ligada ao contato ou à empresa (R6.1), num modal: tipo, título (sugerido
 * pelo tipo), quando (vencimento; início e fim na reunião) e descrição. A nota nasce
 * concluída e vai direto para a linha do tempo (R6.2).
 */
@Component({
  selector: 'app-nova-atividade',
  imports: [ReactiveFormsModule, AreaTexto, Botao, CampoData, CampoTexto, GrupoOpcoes, Modal],
  templateUrl: './nova-atividade.html',
  styleUrl: './formulario.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NovaAtividade {
  readonly aberto = model(false);
  readonly dono = input.required<DonoDoHistorico>();
  readonly id = input.required<string>();
  /** Nome do contato ou da empresa (título sugerido e complemento do título). */
  readonly nome = input.required<string>();
  readonly criada = output<AtividadeRelacionada>();

  private readonly api = inject(ContatosApi);
  private readonly avisos = inject(AvisosService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly idFormulario = gerarId('nova-atividade');
  protected readonly salvando = signal(false);
  protected readonly enviado = signal(false);
  protected readonly erroGeral = signal<string | null>(null);

  protected readonly tipos: readonly OpcaoGrupo<TipoAtividade>[] = TIPOS.map((tipo) => ({
    valor: tipo,
    rotulo: ROTULO_TIPO_ATIVIDADE[tipo],
    icone: ICONE_TIPO_ATIVIDADE[tipo],
  }));

  protected readonly form = this.fb.group(
    {
      tipo: this.fb.control<TipoAtividade>('TAREFA'),
      titulo: ['', [Validators.required, Validators.maxLength(200)]],
      vence: this.fb.control<string | null>(null),
      inicio: this.fb.control<string | null>(null),
      fim: this.fb.control<string | null>(null),
      descricao: ['', [Validators.maxLength(10000)]],
    },
    { validators: [periodoDaReuniao] },
  );

  private readonly versao = toSignal(this.form.events.pipe(map((_, indice) => indice + 1)), {
    initialValue: 0,
  });

  protected readonly tipo = computed(() => {
    this.versao();
    return this.form.controls.tipo.value;
  });

  protected readonly erroPeriodo = computed(() => {
    this.versao();
    const erro = this.form.errors?.['periodo'];
    return this.enviado() && typeof erro === 'string' ? erro : null;
  });

  private ultimaSugestao = '';

  constructor() {
    effect(() => {
      if (this.aberto()) {
        untracked(() => {
          this.enviado.set(false);
          this.erroGeral.set(null);
          this.ultimaSugestao = '';
          this.form.reset({ tipo: 'TAREFA' });
        });
      }
    });
    // Troca o título sugerido junto com o tipo, enquanto a pessoa não escreveu outro.
    this.form.controls.tipo.valueChanges.pipe(takeUntilDestroyed()).subscribe((tipo) => {
      const titulo = this.form.controls.titulo;
      if (!titulo.value.trim() || titulo.value === this.ultimaSugestao) {
        this.ultimaSugestao = tituloSugerido(tipo, this.nome());
        titulo.setValue(this.ultimaSugestao);
      }
    });
  }

  protected fechar(): void {
    this.aberto.set(false);
  }

  protected async salvar(): Promise<void> {
    this.enviado.set(true);
    this.erroGeral.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valores = this.form.getRawValue();
    const reuniao = valores.tipo === 'REUNIAO';
    const nota = valores.tipo === 'NOTA';
    this.salvando.set(true);
    try {
      const atividade = await this.api.criarAtividade({
        tipo: valores.tipo,
        titulo: valores.titulo.trim(),
        descricao: valores.descricao.trim() || null,
        venceEm: reuniao || nota ? null : localParaIso(valores.vence, 'data-hora'),
        inicioEm: reuniao ? localParaIso(valores.inicio, 'data-hora') : null,
        fimEm: reuniao ? localParaIso(valores.fim, 'data-hora') : null,
        ...(this.dono() === 'contato' ? { contatoId: this.id() } : { empresaId: this.id() }),
      });
      this.avisos.sucesso(nota ? 'Nota registrada na linha do tempo.' : 'Atividade criada.');
      this.aberto.set(false);
      this.criada.emit(atividade);
    } catch (falha) {
      const erro = erroDaApi(falha);
      const campo = erro.campos[0]?.campo;
      if (erro.ehDadosInvalidos && campo === 'titulo') {
        this.form.controls.titulo.setErrors({ api: erro.mensagemDoCampo('titulo') ?? erro.resumo });
      } else {
        this.erroGeral.set(erro.mensagem);
      }
    } finally {
      this.salvando.set(false);
    }
  }
}
