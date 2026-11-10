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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import type { CorDoSetor, Setor } from '../../nucleo/setores/setores';
import { SetoresService } from '../../nucleo/setores/setores.service';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { CaixaSelecao } from '../../ui/caixa-selecao/caixa-selecao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Modal } from '../../ui/modal/modal';
import { Selo } from '../../ui/selo/selo';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { gerarId } from '../../ui/tipos';
import { ConfiguracoesApi } from './configuracoes.api';
import type { Usuario } from './configuracoes.modelos';
import { SetoresApi, type AlteracaoSetor, type NovoSetor } from './setores.api';
import {
  DICA_NOVO_SETOR,
  OPCOES_DE_COR,
  pendenciasDeLideres,
  type PendenciaDeLider,
  varianteDoSetor,
} from './setores-regras';

/** Abrir o formulário: criar um setor ou editar o que já existe. */
export type PedidoFormularioSetor =
  { readonly modo: 'criar' } | { readonly modo: 'editar'; readonly setor: Setor };

/**
 * Criar e editar setor (R1.7 e R1.11; Admin e C-level). Criar pede nome, descrição, cor, líderes
 * (pessoas ativas) e o C-level responsável por eles (obrigatório quando há líderes); editar muda
 * nome, descrição, cor e ordem. Cada erro da API volta para o campo certo: nome em uso (R1.8),
 * líder com liderados (R1.3, com a lista de quem precisa de novo líder), C-level (R1.2) e líderes
 * inválidos (R1.7, R1.4).
 */
@Component({
  selector: 'app-setores-formulario',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AreaTexto,
    Botao,
    CaixaSelecao,
    CampoTexto,
    Modal,
    Selo,
    Seletor,
  ],
  template: `
    <app-modal [titulo]="titulo()" [aberto]="aberto()" (fechado)="fechar()">
      <form
        class="formulario"
        novalidate
        [id]="idFormulario"
        [formGroup]="formulario"
        (ngSubmit)="salvar()"
      >
        @if (!editando()) {
          <p class="formulario__frase" role="note">{{ dicaNovo }}</p>
        }

        <app-campo-texto
          rotulo="Nome do setor"
          autocomplete="off"
          [maximoCaracteres]="100"
          formControlName="nome"
        />
        <app-area-texto
          rotulo="Descrição"
          [linhas]="2"
          [maximoCaracteres]="500"
          dica="Para que serve o setor (opcional)."
          formControlName="descricao"
        />
        <div class="formulario__cor">
          <app-seletor
            rotulo="Cor"
            ajuda="A cor do selo do setor nas listas e nos funis."
            [opcoes]="opcoesDeCor"
            formControlName="cor"
          />
          <app-selo [variante]="variante()">{{ nomeNoSelo() }}</app-selo>
        </div>

        @if (editando()) {
          <app-campo-texto
            rotulo="Ordem"
            tipo="number"
            [minimo]="0"
            dica="Quanto menor, mais acima o setor aparece nas listas."
            formControlName="ordem"
          />
        } @else {
          <fieldset class="formulario__lideres">
            <legend class="formulario__legenda">Líderes do setor</legend>
            <p class="formulario__dica" id="dica-lideres">
              Opcional. Escolha pessoas ativas; elas passam a ser líderes deste setor.
            </p>
            @if (pessoas() === null) {
              <p class="formulario__dica" role="status">
                {{
                  erroDePessoas()
                    ? 'Não conseguimos carregar as pessoas.'
                    : 'Carregando as pessoas…'
                }}
                @if (erroDePessoas()) {
                  <button
                    appBotao
                    type="button"
                    tamanho="sm"
                    variante="contorno"
                    (click)="carregarPessoas()"
                  >
                    Tentar de novo
                  </button>
                }
              </p>
            } @else if (candidatos().length === 0) {
              <p class="formulario__dica">Não há pessoas ativas para escolher como líder.</p>
            } @else {
              <ul class="formulario__lista" aria-describedby="dica-lideres">
                @for (pessoa of candidatos(); track pessoa.id) {
                  <li>
                    <app-caixa-selecao
                      [rotulo]="pessoa.nome + ' · ' + pessoa.rotuloPapel"
                      [valor]="lideres().has(pessoa.id)"
                      (valorChange)="alternarLider(pessoa.id, $event)"
                    />
                  </li>
                }
              </ul>
            }
            @if (erroDeLideres(); as mensagem) {
              <p class="formulario__erro" role="alert">{{ mensagem }}</p>
            }
            @if (pendencias().length > 0) {
              <div class="formulario__pendencias" role="alert">
                <p>
                  <strong>Estas pessoas lideram outras e não podem mudar de setor ainda.</strong>
                  Escolha um novo líder para os liderados em
                  <a routerLink="/configuracoes/usuarios" (click)="fechar()">Usuários</a> ou tire a
                  pessoa da lista.
                </p>
                <ul>
                  @for (pendencia of pendencias(); track pendencia.lider.id) {
                    <li>
                      <strong>{{ pendencia.lider.nome }}</strong> lidera
                      {{ nomesDosLiderados(pendencia) }}.
                    </li>
                  }
                </ul>
              </div>
            }
          </fieldset>

          @if (lideres().size > 0) {
            <app-seletor
              rotulo="C-level responsável"
              ajuda="Os líderes do novo setor passam a responder a esta pessoa."
              placeholder="Escolha o C-level"
              [opcoes]="opcoesDeCLevel()"
              formControlName="cLevel"
            />
          }
        }

        @if (erroGeral(); as erro) {
          <p class="formulario__erro" role="alert">{{ erro.mensagem }}</p>
        }
      </form>

      <div modal-rodape class="formulario__acoes">
        <button appBotao type="button" variante="contorno" (click)="fechar()">Cancelar</button>
        <button
          appBotao
          type="submit"
          variante="invertido"
          [attr.form]="idFormulario"
          [carregando]="enviando()"
        >
          {{ editando() ? 'Salvar alterações' : 'Criar setor' }}
        </button>
      </div>
    </app-modal>
  `,
  styleUrl: './setores-formulario.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetoresFormulario {
  /** `null` = fechado. */
  readonly pedido = input<PedidoFormularioSetor | null>(null);
  /** O setor criado ou alterado (a lista já foi recarregada). */
  readonly salvo = output<Setor>();
  readonly fechado = output<void>();

  private readonly api = inject(SetoresApi);
  private readonly usuarios = inject(ConfiguracoesApi);
  private readonly setores = inject(SetoresService);
  private readonly avisos = inject(AvisosService);

  protected readonly idFormulario = gerarId('formulario-setor');
  protected readonly dicaNovo = DICA_NOVO_SETOR;
  protected readonly opcoesDeCor = OPCOES_DE_COR;

  protected readonly formulario = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    cor: new FormControl<CorDoSetor | null>('neutro'),
    ordem: new FormControl('', { nonNullable: true }),
    cLevel: new FormControl<string | null>(null),
  });

  protected readonly pessoas = signal<readonly Usuario[] | null>(null);
  protected readonly erroDePessoas = signal(false);
  protected readonly lideres = signal<ReadonlySet<string>>(new Set());
  protected readonly erroDeLideres = signal<string | null>(null);
  protected readonly pendencias = signal<readonly PendenciaDeLider[]>([]);
  protected readonly enviando = signal(false);
  protected readonly erroGeral = signal<ErroApi | null>(null);

  private readonly cor = signal<CorDoSetor | null>('neutro');
  private readonly nome = signal('');
  protected readonly aberto = computed(() => this.pedido() !== null);
  protected readonly editando = computed(() => {
    const pedido = this.pedido();
    return pedido?.modo === 'editar' ? pedido.setor : null;
  });
  protected readonly titulo = computed(() => {
    const setor = this.editando();
    return setor ? `Editar ${setor.nome}` : 'Novo setor';
  });
  protected readonly variante = computed(() => varianteDoSetor(this.cor()));
  protected readonly nomeNoSelo = computed(() => this.nome().trim() || 'Nome do setor');

  /** Quem pode liderar um setor novo: pessoas ativas de setor (líderes e membros). */
  protected readonly candidatos = computed<readonly Usuario[]>(() =>
    (this.pessoas() ?? []).filter(
      (pessoa) => pessoa.ativo && (pessoa.papel === 'LIDER' || pessoa.papel === 'MEMBRO'),
    ),
  );
  protected readonly opcoesDeCLevel = computed<readonly OpcaoSeletor<string>[]>(() =>
    (this.pessoas() ?? [])
      .filter((pessoa) => pessoa.ativo && pessoa.papel === 'C_LEVEL')
      .map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome })),
  );

  constructor() {
    const controles = this.formulario.controls;
    controles.cor.valueChanges.subscribe((cor) => this.cor.set(cor));
    controles.nome.valueChanges.subscribe((nome) => this.nome.set(nome));
    effect(() => {
      const pedido = this.pedido();
      if (pedido) {
        untracked(() => this.preencher(pedido));
      }
    });
    // Uma só C-level possível: já vem escolhida.
    effect(() => {
      const opcoes = this.opcoesDeCLevel();
      const escolhida = controles.cLevel.value;
      if (this.lideres().size > 0 && !escolhida && opcoes.length === 1) {
        untracked(() => controles.cLevel.setValue(opcoes[0].valor));
      }
    });
  }

  protected fechar(): void {
    this.fechado.emit();
  }

  protected alternarLider(id: string, marcado: boolean): void {
    this.lideres.update((atual) => {
      const proximo = new Set(atual);
      if (marcado) {
        proximo.add(id);
      } else {
        proximo.delete(id);
      }
      return proximo;
    });
    this.erroDeLideres.set(null);
    this.pendencias.set([]);
  }

  protected nomesDosLiderados(pendencia: PendenciaDeLider): string {
    return pendencia.liderados.map((liderado) => liderado.nome).join(', ');
  }

  protected async carregarPessoas(): Promise<void> {
    this.erroDePessoas.set(false);
    try {
      this.pessoas.set(
        await this.usuarios.listarUsuarios({ ativo: true, porPagina: 100 }).then((p) => p.itens),
      );
    } catch {
      this.erroDePessoas.set(true);
    }
  }

  protected async salvar(): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.erroGeral.set(null);
    this.erroDeLideres.set(null);
    this.pendencias.set([]);
    const c = this.formulario.controls;
    // Esquece o erro da tentativa anterior (o `setErrors` da API fica até revalidar).
    Object.values(c).forEach((controle) => controle.updateValueAndValidity({ emitEvent: false }));
    this.formulario.markAllAsTouched();
    const cLevelFalta = !this.editando() && this.lideres().size > 0 && !c.cLevel.value;
    if (cLevelFalta) {
      c.cLevel.setErrors({ required: true });
    }
    if (this.formulario.invalid || cLevelFalta) {
      return;
    }
    const pedido = this.pedido();
    if (!pedido) {
      return;
    }
    this.enviando.set(true);
    try {
      const setor = pedido.modo === 'criar' ? await this.criar() : await this.editar(pedido.setor);
      if (setor) {
        this.salvo.emit(setor);
        this.fechado.emit();
      } else {
        this.avisos.info('Nada mudou: não havia o que salvar.');
        this.fechado.emit();
      }
    } catch (falha) {
      this.mostrarErro(erroDaApi(falha));
    } finally {
      this.enviando.set(false);
    }
  }

  private async criar(): Promise<Setor> {
    const valor = this.formulario.getRawValue();
    const lideres = [...this.lideres()];
    const descricao = valor.descricao.trim();
    const dados: NovoSetor = {
      nome: valor.nome.trim(),
      ...(descricao ? { descricao } : {}),
      ...(valor.cor ? { cor: valor.cor } : {}),
      ...(lideres.length > 0 ? { lideres, cLevelResponsavelId: valor.cLevel ?? undefined } : {}),
    };
    const criado = await this.api.criar(dados);
    await this.setores.recarregar();
    this.avisos.sucesso(`Setor “${criado.nome}” criado, com o funil e o rodízio.`);
    return criado;
  }

  private async editar(setor: Setor): Promise<Setor | null> {
    const valor = this.formulario.getRawValue();
    const descricao = valor.descricao.trim();
    const ordem = valor.ordem.trim() === '' ? setor.ordem : Number(valor.ordem);
    const alteracao: AlteracaoSetor = {
      ...(valor.nome.trim() !== setor.nome ? { nome: valor.nome.trim() } : {}),
      ...(descricao !== (setor.descricao ?? '') ? { descricao: descricao || null } : {}),
      ...(valor.cor && valor.cor !== setor.cor ? { cor: valor.cor } : {}),
      ...(ordem !== setor.ordem ? { ordem } : {}),
    };
    if (Object.keys(alteracao).length === 0) {
      return null;
    }
    const atualizado = await this.api.alterar(setor.chave, alteracao);
    await this.setores.recarregar();
    this.avisos.sucesso(`Alterações de “${atualizado.nome}” salvas.`);
    return atualizado;
  }

  /** Cada erro da API no campo certo; o resto numa mensagem dentro do modal. */
  private mostrarErro(erro: ErroApi): void {
    const c = this.formulario.controls;
    const noCampo = (controle: FormControl<unknown>, mensagem: string): void => {
      controle.setErrors({ api: mensagem });
      controle.markAsTouched();
    };
    const porCampo: Readonly<Record<string, FormControl<unknown>>> = {
      nome: c.nome as FormControl<unknown>,
      descricao: c.descricao as FormControl<unknown>,
      cor: c.cor as FormControl<unknown>,
      ordem: c.ordem as FormControl<unknown>,
      cLevelResponsavelId: c.cLevel as FormControl<unknown>,
    };
    let noLugar = false;
    if (erro.ehDadosInvalidos) {
      for (const { campo } of erro.campos) {
        const mensagem = erro.mensagemDoCampo(campo);
        if (porCampo[campo] && mensagem) {
          noCampo(porCampo[campo], mensagem);
          noLugar = true;
        } else if (campo.startsWith('lideres') && mensagem) {
          this.erroDeLideres.set(mensagem);
          noLugar = true;
        }
      }
    }
    if (!noLugar) {
      switch (erro.regra) {
        case 'R1.8':
          noCampo(c.nome as FormControl<unknown>, erro.resumo);
          noLugar = true;
          break;
        case 'R1.3': {
          const pendencias = pendenciasDeLideres(erro);
          if (pendencias.length > 0) {
            this.pendencias.set(pendencias);
            noLugar = true;
          }
          break;
        }
        case 'R1.2':
          if (this.lideres().size > 0) {
            noCampo(c.cLevel as FormControl<unknown>, erro.resumo);
            noLugar = true;
          }
          break;
        case 'R1.7':
        case 'R1.4':
          this.erroDeLideres.set(erro.resumo);
          noLugar = true;
          break;
      }
    }
    if (!noLugar) {
      this.erroGeral.set(erro);
    }
  }

  private preencher(pedido: PedidoFormularioSetor): void {
    this.erroGeral.set(null);
    this.erroDeLideres.set(null);
    this.pendencias.set([]);
    this.enviando.set(false);
    this.lideres.set(new Set());
    const setor = pedido.modo === 'editar' ? pedido.setor : null;
    const cor = (setor?.cor as CorDoSetor | null) ?? 'neutro';
    this.formulario.reset(
      {
        nome: setor?.nome ?? '',
        descricao: setor?.descricao ?? '',
        cor,
        ordem: setor ? String(setor.ordem) : '',
        cLevel: null,
      },
      { emitEvent: false },
    );
    this.cor.set(cor);
    this.nome.set(setor?.nome ?? '');
    if (!setor) {
      void this.carregarPessoas();
    }
  }
}
