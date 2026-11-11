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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideArchive,
  LucideArchiveRestore,
  LucideDynamicIcon,
  LucideLock,
  LucideLogOut,
  LucideShieldCheck,
  LucideUserMinus,
  LucideUserPlus,
} from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { formatarData } from '../../nucleo/formatos';
import { Alternador } from '../../ui/alternador/alternador';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { type ItemMenuAcoes, MenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { PainelLateral } from '../../ui/painel-lateral/painel-lateral';
import { Selo } from '../../ui/selo/selo';
import { ChatApi } from './chat.api';
import {
  type ChatCanal,
  type ChatMembro,
  type ChatPessoa,
  LIMITES_CHAT,
  rotuloDoTipo,
} from './chat.tipos';
import { SeletorPessoas } from './seletor-pessoas';

/**
 * Detalhes do canal (painel lateral): sobre (nome e descrição, editáveis por quem administra o
 * grupo), silenciar, as pessoas (com quem está online e quem administra) e as ações do grupo —
 * adicionar e tirar pessoas, dar ou tirar a administração, arquivar e sair. Na conversa direta,
 * a outra pessoa e o aviso de que é privada; no Geral e nos setores, que quem participa é
 * definido pelo papel.
 */
@Component({
  selector: 'app-chat-detalhes-canal',
  imports: [
    ReactiveFormsModule,
    LucideDynamicIcon,
    Alternador,
    AreaTexto,
    Avatar,
    Botao,
    CampoTexto,
    Esqueleto,
    MenuAcoes,
    PainelLateral,
    Selo,
    SeletorPessoas,
  ],
  templateUrl: './detalhes-canal.html',
  styleUrl: './detalhes-canal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalhesCanal {
  readonly aberto = model(false);
  readonly canal = input.required<ChatCanal>();
  readonly membros = input<readonly ChatMembro[] | null>(null);
  readonly eu = input<string | null>(null);

  /** O canal mudou (nome, silenciado, arquivado): a página guarda a versão nova. */
  readonly alterado = output<ChatCanal>();
  /** Pessoas entraram ou saíram: a página busca a lista de novo. */
  readonly membrosAlterados = output<void>();
  /** Você saiu do grupo. */
  readonly saiu = output<void>();

  private readonly api = inject(ChatApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);

  protected readonly icones = {
    adicionar: LucideUserPlus,
    sair: LucideLogOut,
    arquivar: LucideArchive,
    desarquivar: LucideArchiveRestore,
    privado: LucideLock,
  };
  protected readonly limites = LIMITES_CHAT;
  protected readonly salvando = signal(false);
  protected readonly silenciando = signal(false);
  protected readonly adicionando = signal(false);
  protected readonly escolhendo = signal(false);
  protected readonly novasPessoas = signal<readonly ChatPessoa[]>([]);
  protected readonly erroAdicionar = signal<string | null>(null);

  protected readonly grupo = computed(() => this.canal().tipo === 'GRUPO');
  protected readonly complemento = computed(() => `· ${rotuloDoTipo(this.canal())}`);
  protected readonly criadoEm = computed(() => formatarData(this.canal().criadoEm, 'longa'));
  protected readonly membrosOrdenados = computed(() => {
    const eu = this.eu();
    return [...(this.membros() ?? [])].sort(
      (a, b) =>
        Number(b.usuario.id === eu) - Number(a.usuario.id === eu) ||
        Number(b.administrador) - Number(a.administrador) ||
        Number(b.usuario.online) - Number(a.usuario.online) ||
        a.usuario.nome.localeCompare(b.usuario.nome, 'pt-BR'),
    );
  });
  protected readonly online = computed(
    () => (this.membros() ?? []).filter((membro) => membro.usuario.online).length,
  );
  protected readonly jaNoGrupo = computed(() =>
    (this.membros() ?? []).map((membro) => membro.usuario.id),
  );
  protected readonly dicaSilenciar = computed(() =>
    this.canal().silenciado
      ? 'Ligado: as mensagens deste canal não contam no menu. Menções a você continuam avisando.'
      : 'Desligado: as mensagens novas contam no menu. Ligue para acompanhar só quando quiser.',
  );

  protected readonly formulario = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LIMITES_CHAT.nome)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(LIMITES_CHAT.descricao)],
    }),
  });

  constructor() {
    // Ao abrir (ou quando o canal muda por fora), o formulário volta ao que está salvo.
    effect(() => {
      const aberto = this.aberto();
      const { nome, descricao } = this.canal();
      if (aberto) {
        untracked(() => {
          if (!this.formulario.dirty) {
            this.formulario.reset({ nome, descricao: descricao ?? '' });
          }
        });
      } else {
        untracked(() => {
          this.escolhendo.set(false);
          this.novasPessoas.set([]);
          this.erroAdicionar.set(null);
          this.formulario.reset({ nome, descricao: descricao ?? '' });
        });
      }
    });
  }

  protected acoesDoMembro(membro: ChatMembro): readonly ItemMenuAcoes[] {
    return [
      membro.administrador
        ? { id: 'tirar-admin', rotulo: 'Tirar a administração', icone: LucideShieldCheck }
        : { id: 'dar-admin', rotulo: 'Tornar administrador', icone: LucideShieldCheck },
      {
        id: 'remover',
        rotulo: 'Tirar do grupo',
        icone: LucideUserMinus,
        perigo: true,
        separarAntes: true,
      },
    ];
  }

  protected async salvarSobre(): Promise<void> {
    if (this.salvando()) {
      return;
    }
    this.formulario.markAllAsTouched();
    const nome = this.formulario.controls.nome.value.trim();
    if (!nome) {
      this.formulario.controls.nome.setErrors({ required: true });
    }
    if (this.formulario.invalid) {
      return;
    }
    this.salvando.set(true);
    try {
      const canal = await this.api.atualizarGrupo(this.canal().id, {
        nome,
        descricao: this.formulario.controls.descricao.value.trim() || null,
      });
      this.formulario.reset({ nome: canal.nome, descricao: canal.descricao ?? '' });
      this.alterado.emit(canal);
      this.avisos.sucesso('Grupo atualizado.');
    } catch (falha) {
      const erro = erroDaApi(falha);
      const doNome = erro.mensagemDoCampo('nome');
      if (doNome) {
        this.formulario.controls.nome.setErrors({ api: doNome });
      } else {
        this.avisos.erro(erro);
      }
    } finally {
      this.salvando.set(false);
    }
  }

  protected descartarSobre(): void {
    const { nome, descricao } = this.canal();
    this.formulario.reset({ nome, descricao: descricao ?? '' });
  }

  protected async silenciar(silenciado: boolean): Promise<void> {
    if (this.silenciando()) {
      return;
    }
    this.silenciando.set(true);
    try {
      this.alterado.emit(await this.api.silenciar(this.canal().id, silenciado));
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.silenciando.set(false);
    }
  }

  protected async adicionar(): Promise<void> {
    const pessoas = this.novasPessoas();
    if (!pessoas.length) {
      this.erroAdicionar.set('Escolha pelo menos uma pessoa.');
      return;
    }
    this.adicionando.set(true);
    this.erroAdicionar.set(null);
    try {
      await this.api.adicionarMembros(
        this.canal().id,
        pessoas.map((pessoa) => pessoa.id),
      );
      this.avisos.sucesso(
        pessoas.length === 1
          ? `${pessoas[0].nome} entrou no grupo.`
          : `${pessoas.length} pessoas entraram no grupo.`,
      );
      this.novasPessoas.set([]);
      this.escolhendo.set(false);
      this.membrosAlterados.emit();
    } catch (falha) {
      this.erroAdicionar.set(erroDaApi(falha).mensagem);
    } finally {
      this.adicionando.set(false);
    }
  }

  protected async agirNoMembro(membro: ChatMembro, item: ItemMenuAcoes): Promise<void> {
    const canal = this.canal();
    const nome = membro.usuario.nome;
    if (item.id === 'remover') {
      const ok = await this.confirmacao.confirmar({
        titulo: `Tirar ${nome} do grupo?`,
        mensagem: `${nome} deixa de ver as mensagens de “${canal.nome}”. Dá para adicionar de novo depois.`,
        confirmar: 'Tirar do grupo',
        perigo: true,
        executar: () => this.api.removerMembro(canal.id, membro.usuario.id),
      });
      if (ok) {
        this.avisos.sucesso(`${nome} saiu do grupo.`);
        this.membrosAlterados.emit();
      }
      return;
    }
    try {
      await this.api.definirAdministrador(canal.id, membro.usuario.id, item.id === 'dar-admin');
      this.avisos.sucesso(
        item.id === 'dar-admin'
          ? `${nome} agora administra o grupo.`
          : `${nome} não administra mais o grupo.`,
      );
      this.membrosAlterados.emit();
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  protected async arquivar(arquivar: boolean): Promise<void> {
    const canal = this.canal();
    const ok = await this.confirmacao.confirmar(
      arquivar
        ? {
            titulo: `Arquivar “${canal.nome}”?`,
            mensagem:
              'O grupo fica só para leitura: ninguém envia mensagens até alguém que administra desarquivar.',
            confirmar: 'Arquivar',
            executar: async () => this.alterado.emit(await this.api.arquivar(canal.id, true)),
          }
        : {
            titulo: `Desarquivar “${canal.nome}”?`,
            mensagem: 'As pessoas do grupo voltam a poder enviar mensagens.',
            confirmar: 'Desarquivar',
            executar: async () => this.alterado.emit(await this.api.arquivar(canal.id, false)),
          },
    );
    if (ok) {
      this.avisos.sucesso(arquivar ? 'Grupo arquivado.' : 'Grupo desarquivado.');
    }
  }

  protected async sair(): Promise<void> {
    const canal = this.canal();
    const ok = await this.confirmacao.confirmar({
      titulo: `Sair de “${canal.nome}”?`,
      mensagem:
        'Você deixa de ver as mensagens do grupo. Para voltar, alguém que administra precisa adicionar você de novo.',
      confirmar: 'Sair do grupo',
      perigo: true,
      executar: () => this.api.sair(canal.id),
    });
    if (ok) {
      this.aberto.set(false);
      this.avisos.sucesso(`Você saiu de “${canal.nome}”.`);
      this.saiu.emit();
    }
  }
}
