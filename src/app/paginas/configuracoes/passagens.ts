import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideArrowRight, LucideRefreshCw, LucideWorkflow } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarNumero } from '../../nucleo/formatos';
import { nomeDoSetor } from '../../nucleo/setores/setores';
import { Alternador } from '../../ui/alternador/alternador';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Selo } from '../../ui/selo/selo';
import { Carregamento } from './carregamento';
import { ConfiguracoesApi } from './configuracoes.api';
import type { Passagem } from './configuracoes.modelos';

/** Texto do balão de ajuda (R5.7). */
export const DICA_PASSAGENS =
  'Quando um negócio entra na etapa-gatilho, o CRM cria na mesma hora um negócio no funil de destino, levando contato, empresa, valores e origem. Roda uma única vez por negócio (reabrir e ganhar de novo não duplica) e o responsável recebe uma notificação.';

/** Quem recebe o negócio criado. */
export function quemRecebe(passagem: Passagem): string {
  const area = nomeDoSetor(passagem.funilDestino.area);
  switch (passagem.estrategia) {
    case 'RODIZIO':
      return `Rodízio de ${area}: a próxima pessoa da fila`;
    case 'RESPONSAVEL_FIXO':
      return passagem.responsavelFixo
        ? `Sempre ${passagem.responsavelFixo.nome} (responsável fixo)`
        : 'Responsável fixo (não definido)';
    case 'LIDER_DA_AREA':
      return `O líder de ${area}`;
  }
}

/** "Já rodou 4 vezes" / "Ainda não rodou". */
export function execucoes(passagem: Passagem): string {
  if (passagem.execucoes === 0) {
    return 'Ainda não rodou';
  }
  return passagem.execucoes === 1
    ? 'Já rodou 1 vez'
    : `Já rodou ${formatarNumero(passagem.execucoes)} vezes`;
}

/**
 * O que o alternador faz, começando pela situação de agora (a que ele mostra) e depois o que
 * muda se a pessoa mexer nele.
 */
export function dicaDoAlternador(passagem: Passagem): string {
  const etapa = passagem.etapaGatilho.nome;
  const destino = passagem.funilDestino.nome;
  return passagem.ativa
    ? `Ligada: cada negócio que entra em ${etapa} gera um negócio em ${destino}. Se desligar, os próximos param de passar.`
    : `Desligada: os negócios que entram em ${etapa} não passam para ${destino}. Se ligar, cada um gera um negócio em ${destino}.`;
}

interface PassagemVisual {
  readonly passagem: Passagem;
  readonly quemRecebe: string;
  readonly execucoes: string;
  readonly dicaAtiva: string;
}

/**
 * Passagens entre funis (`/configuracoes/passagens`, Admin e C-level) — TELAS-FASE1 §6 e
 * R5.7: cada passagem com o gatilho (funil e etapa de origem), o destino e quem recebe, e o
 * alternador para ativar ou desativar na hora.
 */
@Component({
  selector: 'app-passagens',
  imports: [
    Alternador,
    Botao,
    Cartao,
    Esqueleto,
    EstadoVazio,
    LucideArrowRight,
    LucideWorkflow,
    Selo,
  ],
  templateUrl: './passagens.html',
  styleUrl: './passagens.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Passagens {
  private readonly api = inject(ConfiguracoesApi);
  private readonly avisos = inject(AvisosService);

  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly dica = DICA_PASSAGENS;
  protected readonly lista = new Carregamento<readonly Passagem[]>();
  protected readonly pendentes = signal<ReadonlySet<string>>(new Set());
  /** Muda quando uma alteração falha (os alternadores voltam ao valor real). */
  protected readonly revisao = signal(0);
  protected readonly passagens = computed<readonly PassagemVisual[]>(() =>
    (this.lista.dados() ?? []).map((passagem) => ({
      passagem,
      quemRecebe: quemRecebe(passagem),
      execucoes: execucoes(passagem),
      dicaAtiva: dicaDoAlternador(passagem),
    })),
  );

  constructor() {
    this.carregar();
  }

  protected carregar(): void {
    void this.lista.executar(() => this.api.passagens());
  }

  protected emAndamento(id: string): boolean {
    return this.pendentes().has(id);
  }

  protected async definirAtiva(
    passagem: Passagem,
    ativa: boolean,
    desfazendo = false,
  ): Promise<void> {
    if (this.emAndamento(passagem.id)) {
      return;
    }
    this.pendentes.update((atual) => new Set(atual).add(passagem.id));
    try {
      const atualizada = await this.api.definirPassagemAtiva(passagem.id, ativa);
      this.lista.definir(
        (this.lista.dados() ?? []).map((item) => (item.id === atualizada.id ? atualizada : item)),
      );
      this.avisos.sucesso(
        ativa
          ? `Passagem “${atualizada.nome}” ativada.`
          : `Passagem “${atualizada.nome}” desativada: nada passa até você ativar de novo.`,
        {
          chave: `passagem-${passagem.id}`,
          acao: desfazendo
            ? undefined
            : { rotulo: 'Desfazer', executar: () => this.desfazer(atualizada.id, !ativa) },
        },
      );
    } catch (falha) {
      this.revisao.update((valor) => valor + 1);
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.pendentes.update((atual) => {
        const proximo = new Set(atual);
        proximo.delete(passagem.id);
        return proximo;
      });
    }
  }

  private desfazer(id: string, ativa: boolean): void {
    const passagem = this.lista.dados()?.find((item) => item.id === id);
    if (passagem && passagem.ativa !== ativa) {
      void this.definirAtiva(passagem, ativa, true);
    }
  }
}
