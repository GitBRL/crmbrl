import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideLayers, LucidePlus, LucideRefreshCw } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import type { Setor } from '../../nucleo/setores/setores';
import { SetoresService } from '../../nucleo/setores/setores.service';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { CaixaSelecao } from '../../ui/caixa-selecao/caixa-selecao';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Modal } from '../../ui/modal/modal';
import { Selo } from '../../ui/selo/selo';
import { SetoresApi } from './setores.api';
import { SetoresAcessos } from './setores-acessos';
import { type PedidoFormularioSetor, SetoresFormulario } from './setores-formulario';
import {
  contar,
  pendenciasDoSetor,
  type PendenciasDoSetor,
  temPendencias,
  varianteDoSetor,
} from './setores-regras';

interface SetorVisual {
  readonly setor: Setor;
  readonly variante: ReturnType<typeof varianteDoSetor>;
  readonly lideres: string;
  readonly contagens: string | null;
}

/**
 * Setores (`/configuracoes/setores`) — R1.6 a R1.11. Admin e C-level veem todos (com filtro dos
 * desativados), criam, editam, desativam e reativam; o líder só abre o próprio setor, para gerir
 * "Quem mais vê". A lista vem do `SetoresService` (cache), recarregado a cada mudança.
 */
@Component({
  selector: 'app-setores-config',
  imports: [
    Botao,
    Cartao,
    CaixaSelecao,
    Esqueleto,
    EstadoVazio,
    Modal,
    RouterLink,
    Selo,
    SetoresAcessos,
    SetoresFormulario,
  ],
  templateUrl: './setores.html',
  styleUrl: './setores.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetoresConfig {
  private readonly api = inject(SetoresApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly sessao = inject(SessaoService);
  protected readonly setores = inject(SetoresService);

  protected readonly iconeNovo = LucidePlus;
  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly iconeSetores = LucideLayers;

  protected readonly gere = this.sessao.ehDiretoria;
  protected readonly mostrarDesativados = signal(false);
  protected readonly formulario = signal<PedidoFormularioSetor | null>(null);
  protected readonly acessos = signal<Setor | null>(null);
  protected readonly bloqueio = signal<{
    readonly setor: Setor;
    readonly pendencias: PendenciasDoSetor;
  } | null>(null);
  protected readonly emAndamento = signal<string | null>(null);

  protected readonly itens = computed<readonly SetorVisual[]>(() => {
    const diretoria = this.gere();
    const minha = this.sessao.area();
    return this.setores
      .todos()
      .filter((setor) =>
        diretoria ? this.mostrarDesativados() || setor.ativo : setor.chave === minha && setor.ativo,
      )
      .map((setor) => ({
        setor,
        variante: varianteDoSetor(setor.cor),
        lideres: setor.lideres?.length
          ? setor.lideres.map((lider) => lider.nome).join(', ')
          : 'Sem líderes',
        contagens: setor.contagens
          ? `${contar(setor.contagens.usuariosAtivos, 'pessoa', 'pessoas')} · ${contar(setor.contagens.funisAtivos, 'funil ativo', 'funis ativos')}`
          : null,
      }));
  });
  protected readonly temDesativados = computed(() => this.setores.todos().some((s) => !s.ativo));

  constructor() {
    void this.setores.carregar();
  }

  protected carregar(): void {
    void this.setores.recarregar();
  }

  protected novo(): void {
    this.formulario.set({ modo: 'criar' });
  }

  protected editar(setor: Setor): void {
    this.formulario.set({ modo: 'editar', setor });
  }

  protected verAcessos(setor: Setor): void {
    this.acessos.set(setor);
  }

  protected async desativar(setor: Setor): Promise<void> {
    if (this.emAndamento()) {
      return;
    }
    const confirmado = await this.confirmacao.confirmar({
      titulo: `Desativar “${setor.nome}”?`,
      mensagem:
        'O setor sai das listas de escolha e continua nos registros antigos. Só dá para desativar um setor sem pessoas ativas, funis ativos nem filas de atendimento ativas. Você pode reativá-lo depois.',
      confirmar: 'Desativar setor',
      perigo: true,
    });
    if (!confirmado) {
      return;
    }
    this.emAndamento.set(setor.chave);
    try {
      await this.api.desativar(setor.chave);
      await this.setores.recarregar();
      this.avisos.sucesso(`Setor “${setor.nome}” desativado.`);
    } catch (falha) {
      const erro = erroDaApi(falha);
      const pendencias = pendenciasDoSetor(erro);
      if (erro.status === 409 && erro.regra === 'R1.10' && temPendencias(pendencias)) {
        this.bloqueio.set({ setor, pendencias });
      } else {
        this.avisos.erro(erro);
        if (erro.status === 409) {
          await this.setores.recarregar();
        }
      }
    } finally {
      this.emAndamento.set(null);
    }
  }

  protected async reativar(setor: Setor): Promise<void> {
    if (this.emAndamento()) {
      return;
    }
    this.emAndamento.set(setor.chave);
    try {
      await this.api.reativar(setor.chave);
      await this.setores.recarregar();
      this.avisos.sucesso(`Setor “${setor.nome}” reativado.`);
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.emAndamento.set(null);
    }
  }

  protected fecharBloqueio(): void {
    this.bloqueio.set(null);
  }
}
