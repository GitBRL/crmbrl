import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { DisparosApi } from './disparos.api';
import type { Campanha, ResumoCampanha } from './disparos.tipos';

export type AcaoCampanha =
  'pausar' | 'retomar' | 'cancelar' | 'excluir' | 'duplicar' | 'reenviar-falhas' | 'aprovar';

/** Resultado de uma ação: a campanha atualizada, ou `excluida` quando ela saiu. */
export interface ResultadoAcao {
  readonly campanha?: Campanha;
  readonly excluida?: boolean;
}

/**
 * Ações do ciclo de vida que a lista e o detalhe compartilham: pedem confirmação quando não
 * têm volta, mostram o resultado em aviso e devolvem a campanha atualizada.
 */
@Injectable({ providedIn: 'root' })
export class AcoesCampanha {
  private readonly api = inject(DisparosApi);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly avisos = inject(AvisosService);
  private readonly router = inject(Router);

  /** Executa a ação; `null` quando a pessoa desistiu. Erros aparecem no modal ou em aviso. */
  async executar(acao: AcaoCampanha, campanha: ResumoCampanha): Promise<ResultadoAcao | null> {
    const nome = `“${campanha.nome}”`;
    const guardado: { valor: ResultadoAcao | null } = { valor: null };
    const guardar = async (feito: Promise<ResultadoAcao>) => {
      guardado.valor = await feito;
    };
    try {
      switch (acao) {
        case 'pausar': {
          const ok = await this.confirmacao.confirmar({
            titulo: `Pausar ${nome}?`,
            mensagem:
              'Os envios param agora. Quem ainda não recebeu continua na fila e você pode retomar quando quiser.',
            confirmar: 'Pausar',
            executar: () => guardar(this.api.pausar(campanha.id).then((c) => ({ campanha: c }))),
          });
          if (ok) {
            this.avisos.sucesso('Campanha pausada.');
          }
          return ok ? guardado.valor : null;
        }
        case 'cancelar': {
          const ok = await this.confirmacao.confirmar({
            titulo: `Cancelar ${nome}?`,
            mensagem: 'Quem ainda não recebeu não receberá mais. Isso não pode ser desfeito.',
            detalhes: ['O que já foi enviado continua nas conversas.'],
            confirmar: 'Cancelar campanha',
            cancelar: 'Voltar',
            perigo: true,
            executar: () => guardar(this.api.cancelar(campanha.id).then((c) => ({ campanha: c }))),
          });
          if (ok) {
            this.avisos.sucesso('Campanha cancelada.');
          }
          return ok ? guardado.valor : null;
        }
        case 'excluir': {
          const ok = await this.confirmacao.confirmar({
            titulo: `Excluir ${nome}?`,
            mensagem: 'A campanha e o relatório dela saem da lista. Isso não pode ser desfeito.',
            confirmar: 'Excluir',
            perigo: true,
            executar: () => guardar(this.api.excluir(campanha.id).then(() => ({ excluida: true }))),
          });
          if (ok) {
            this.avisos.sucesso('Campanha excluída.');
          }
          return ok ? guardado.valor : null;
        }
        case 'retomar': {
          const nova = await this.api.retomar(campanha.id);
          this.avisos.sucesso('Campanha retomada.');
          return { campanha: nova };
        }
        case 'aprovar': {
          const nova = await this.api.aprovar(campanha.id);
          this.avisos.sucesso('Campanha aprovada.');
          return { campanha: nova };
        }
        case 'duplicar': {
          const copia = await this.api.duplicar(campanha.id);
          this.avisos.sucesso('Criamos uma cópia em rascunho. Revise e inicie quando quiser.');
          await this.router.navigate(['/disparos', copia.id, 'editar']);
          return { campanha: copia };
        }
        case 'reenviar-falhas': {
          const ok = await this.confirmacao.confirmar({
            titulo: 'Reenviar para quem falhou?',
            mensagem: `Quem não recebeu ${nome} entra de novo na fila, no mesmo ritmo.`,
            confirmar: 'Reenviar',
            executar: () =>
              guardar(
                this.api.reenviarFalhas(campanha.id).then((r) => {
                  this.avisos.sucesso(
                    r.reenfileirados === 1
                      ? '1 envio voltou para a fila.'
                      : `${r.reenfileirados} envios voltaram para a fila.`,
                  );
                  return { campanha: r.campanha };
                }),
              ),
          });
          return ok ? guardado.valor : null;
        }
      }
    } catch (falha) {
      this.avisos.erro(falha);
      return null;
    }
  }
}
