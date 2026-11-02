import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideClock } from '@lucide/angular';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { Botao } from '../../ui/botao/botao';
import { CaixaSelecao } from '../../ui/caixa-selecao/caixa-selecao';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { GRUPOS_PENDENTES, quandoDaAtividade, TIPOS } from '../atividades/apresentacao';
import { AtividadesApi, type Atividade } from '../atividades/atividades.api';
import { RELOGIO } from './relogio';

type Estado = 'carregando' | 'pronto' | 'erro';

/** Quantas atividades o cartão mostra. */
export const ATIVIDADES_NO_CARTAO = 5;

/**
 * "Próximas atividades" da Visão geral: as pendentes da própria pessoa, das atrasadas para as
 * próximas (a mesma agenda de Atividades), com a caixa para concluir ali mesmo e "Desfazer"
 * no aviso. Embaixo, o atalho para a lista completa. Dados reais (`GET /atividades/agrupadas`).
 */
@Component({
  selector: 'app-inicio-atividades',
  imports: [Botao, CaixaSelecao, Cartao, EstadoVazio, Esqueleto, LucideClock, RouterLink],
  template: `
    <app-cartao
      titulo="Próximas atividades"
      regiao
      dica="As suas atividades pendentes, das atrasadas para as próximas. Conclua aqui mesmo ou abra Atividades para ver todas, inclusive as da equipe."
    >
      @switch (estado()) {
        @case ('carregando') {
          <div class="proximas__carregando" aria-busy="true">
            <span class="visualmente-oculto" role="status">Carregando as suas atividades…</span>
            @for (linha of [1, 2, 3]; track linha) {
              <div class="proximas__esqueleto">
                <app-esqueleto forma="circulo" largura="28px" altura="28px" />
                <app-esqueleto [linhas]="2" [largura]="linha % 2 ? '80%' : '62%'" />
              </div>
            }
          </div>
        }
        @case ('erro') {
          <app-estado-vazio
            compacto
            variante="erro"
            [falha]="erro()"
            titulo="Não conseguimos carregar"
            [texto]="erro()?.resumo ?? null"
            [codigo]="erro()?.requisicaoId ?? null"
          >
            <button appBotao variante="invertido" type="button" (click)="carregar()">
              Tentar de novo
            </button>
          </app-estado-vazio>
        }
        @default {
          @if (itens().length) {
            @if (resumo(); as texto) {
              <p class="proximas__resumo" [class.proximas__resumo--atrasadas]="atrasadas() > 0">
                {{ texto }}
              </p>
            }
            <ul class="proximas__lista" role="list">
              @for (atividade of itens(); track atividade.id) {
                <li class="proxima" [class.proxima--feita]="marcadas().has(atividade.id)">
                  <app-caixa-selecao
                    tamanho="lg"
                    forma="circulo"
                    rotuloOculto
                    [rotulo]="'Concluir “' + atividade.titulo + '”'"
                    [valor]="marcadas().has(atividade.id)"
                    [desabilitado]="marcadas().has(atividade.id)"
                    (valorChange)="$event && concluir(atividade)"
                  />
                  <div class="proxima__corpo">
                    <a
                      class="proxima__titulo"
                      routerLink="/atividades"
                      [queryParams]="{ atividade: atividade.id }"
                      >{{ atividade.titulo }}</a
                    >
                    <span
                      class="proxima__meta"
                      [class.proxima__meta--atrasada]="atividade.atrasada"
                    >
                      <svg lucideClock [size]="14" />
                      {{ quando(atividade) }} · {{ tipo(atividade) }}
                    </span>
                  </div>
                </li>
              }
            </ul>
          } @else {
            <app-estado-vazio
              compacto
              titulo="Tudo em dia"
              texto="Nenhuma atividade pendente com você."
            >
              <a appBotao variante="contorno" tamanho="sm" routerLink="/atividades">
                Nova atividade
              </a>
            </app-estado-vazio>
          }
          @if (total() > 0) {
            <div class="proximas__rodape">
              <a
                appBotao
                tamanho="sm"
                variante="contorno"
                routerLink="/atividades"
                [icone]="iconeVer"
              >
                Ver todas
              </a>
              <span class="proximas__total">
                {{ total() === 1 ? '1 pendente' : total() + ' pendentes' }}
              </span>
            </div>
          }
        }
      }
    </app-cartao>
  `,
  styleUrl: './proximas-atividades.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProximasAtividades {
  private readonly api = inject(AtividadesApi);
  private readonly avisos = inject(AvisosService);
  private readonly agora = inject(RELOGIO);

  protected readonly iconeVer = LucideArrowRight;
  protected readonly estado = signal<Estado>('carregando');
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly itens = signal<readonly Atividade[]>([]);
  protected readonly total = signal(0);
  protected readonly atrasadas = signal(0);
  protected readonly hoje = signal(0);
  /** Concluindo agora (a caixa fica marcada até a lista voltar). */
  protected readonly marcadas = signal<ReadonlySet<string>>(new Set());

  /** "3 atrasadas · 1 para hoje". */
  protected readonly resumo = computed(() => {
    const partes: string[] = [];
    const atrasadas = this.atrasadas();
    const hoje = this.hoje();
    if (atrasadas > 0) {
      partes.push(atrasadas === 1 ? '1 atrasada' : `${atrasadas} atrasadas`);
    }
    if (hoje > 0) {
      partes.push(`${hoje} para hoje`);
    }
    return partes.join(' · ');
  });

  constructor() {
    void this.carregar();
  }

  protected quando(atividade: Atividade): string {
    return quandoDaAtividade(atividade, this.agora());
  }

  protected tipo(atividade: Atividade): string {
    return TIPOS[atividade.tipo].rotulo;
  }

  async carregar(silencioso = false): Promise<void> {
    if (!silencioso) {
      this.estado.set('carregando');
    }
    try {
      const agenda = await this.api.agrupadas(
        { escopo: 'MINHAS', tipos: [] },
        ATIVIDADES_NO_CARTAO,
      );
      const pendentes = GRUPOS_PENDENTES.map((id) =>
        agenda.grupos.find((grupo) => grupo.grupo === id),
      );
      this.itens.set(
        pendentes.flatMap((grupo) => grupo?.itens ?? []).slice(0, ATIVIDADES_NO_CARTAO),
      );
      this.total.set(pendentes.reduce((soma, grupo) => soma + (grupo?.total ?? 0), 0));
      this.atrasadas.set(pendentes[0]?.total ?? 0);
      this.hoje.set(pendentes[1]?.total ?? 0);
      this.estado.set('pronto');
    } catch (falha) {
      if (silencioso) {
        this.avisos.erro(falha);
        return;
      }
      this.erro.set(erroDaApi(falha));
      this.estado.set('erro');
    }
  }

  protected async concluir(atividade: Atividade): Promise<void> {
    this.marcadas.update((ids) => new Set(ids).add(atividade.id));
    try {
      await this.api.concluir(atividade.id);
      this.avisos.sucesso('Atividade concluída.', {
        chave: `conclusao-${atividade.id}`,
        acao: { rotulo: 'Desfazer', executar: () => void this.desfazer(atividade) },
      });
      await this.carregar(true);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.marcadas.update((ids) => {
        const novos = new Set(ids);
        novos.delete(atividade.id);
        return novos;
      });
    }
  }

  private async desfazer(atividade: Atividade): Promise<void> {
    try {
      await this.api.reabrir(atividade.id);
      this.avisos.sucesso('Atividade reaberta.', { chave: `conclusao-${atividade.id}` });
      await this.carregar(true);
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }
}
