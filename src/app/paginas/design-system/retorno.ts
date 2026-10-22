import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  LucideCheck,
  LucideEye,
  LucideLockKeyhole,
  LucideRefreshCw,
  LucideSettings,
  LucideUserMinus,
} from '@lucide/angular';

import { Avisos, type Aviso } from '../../ui/avisos/avisos';
import { Botao } from '../../ui/botao/botao';
import { MenuAcoes, type ItemMenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { PainelLateral } from '../../ui/painel-lateral/painel-lateral';
import { Selo } from '../../ui/selo/selo';
import { Exemplo } from './exemplo';
import { Secao } from './secao';

interface MudancaExemplo {
  readonly campo: string;
  readonly antes: string;
  readonly depois: string;
}

/**
 * Seção 14 do catálogo: avisos (toasts), menu de ações e painel lateral. Os avisos daqui usam
 * um host próprio; no app, o host fica na casca, ligado ao AvisosService. Uso interno de
 * paginas/design-system.
 */
@Component({
  selector: 'app-ds-retorno',
  imports: [Exemplo, Secao, Avisos, Botao, MenuAcoes, PainelLateral, Selo],
  templateUrl: './retorno.html',
  styleUrl: './retorno.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Retorno {
  protected readonly icones = {
    sucesso: LucideCheck,
    ver: LucideEye,
    atualizar: LucideRefreshCw,
    configurar: LucideSettings,
  };

  // Avisos
  protected readonly avisos = signal<readonly Aviso[]>([]);
  protected readonly ultimaAcaoAviso = signal('');
  private proximoId = 1;

  protected mostrar(tipo: 'sucesso' | 'acao' | 'erro' | 'atencao'): void {
    const id = this.proximoId++;
    const aviso: Aviso =
      tipo === 'sucesso'
        ? { id, tipo: 'sucesso', mensagem: 'Contato salvo.' }
        : tipo === 'acao'
          ? { id, tipo: 'sucesso', mensagem: 'Atividade concluída.', acao: 'Desfazer' }
          : tipo === 'atencao'
            ? {
                id,
                tipo: 'atencao',
                titulo: 'Muitas tentativas',
                mensagem: 'Tente de novo em 2 minutos.',
              }
            : {
                id,
                tipo: 'erro',
                mensagem: 'O servidor do CRM não respondeu.',
                codigo: 'req-01J9Z3X7',
              };
    this.avisos.update((lista) => [...lista, aviso]);
  }

  protected dispensar(id: Aviso['id']): void {
    this.avisos.update((lista) => lista.filter((aviso) => aviso.id !== id));
  }

  protected agir(id: Aviso['id']): void {
    this.ultimaAcaoAviso.set(`Desfeito (aviso ${id}).`);
  }

  // Menu de ações
  protected readonly acoesUsuario: readonly ItemMenuAcoes[] = [
    { id: 'ver', rotulo: 'Ver perfil', icone: LucideEye },
    { id: 'senha', rotulo: 'Gerar senha temporária', icone: LucideLockKeyhole },
    {
      id: 'reativar',
      rotulo: 'Reativar',
      icone: LucideRefreshCw,
      desabilitado: true,
      motivo: 'Escolha um líder antes de reativar.',
    },
    {
      id: 'desligar',
      rotulo: 'Desligar',
      icone: LucideUserMinus,
      perigo: true,
      separarAntes: true,
    },
  ];
  protected readonly escolhida = signal('');

  // Painel lateral (auditoria)
  protected readonly painelAberto = signal(false);
  protected readonly mudancas: readonly MudancaExemplo[] = [
    { campo: 'Etapa', antes: 'Qualificação', depois: 'Proposta' },
    { campo: 'Valor', antes: 'R$ 1.200,00', depois: 'R$ 1.500,00' },
    { campo: 'Responsável', antes: '—', depois: 'Ana Ribeiro' },
  ];
}
