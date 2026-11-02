import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideCircleAlert,
  LucideCircleCheck,
  LucideRefreshCw,
  LucideTriangleAlert,
} from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../../nucleo/api/erro-api';
import { formatarDataHora, formatarTempoRelativo } from '../../../nucleo/formatos';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { Selo, type VarianteSelo } from '../../../ui/selo/selo';
import { CelulaTabela } from '../../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../../ui/tabela/tabela';
import { SaudeApi } from './saude.api';
import {
  type CanalDeSaude,
  type FilaDeSaude,
  formatarBytes,
  formatarParada,
  type NumeroDeSaude,
  ROTULO_BACKUP,
  ROTULO_GATEWAY,
  ROTULO_SITUACAO,
  ROTULO_STATUS_NUMERO,
  ROTULO_TIPO_CANAL,
  type SaudeDoSistema,
  type SituacaoDoBackup,
  type StatusDoGateway,
  type StatusDoNumero,
} from './saude.tipos';

/** De quanto em quanto tempo o painel se atualiza sozinho. */
export const INTERVALO_DE_ATUALIZACAO_MS = 30_000;
/** Relógio do "atualizado há…". */
const INTERVALO_DO_RELOGIO_MS = 10_000;

const COLUNAS_FILAS: readonly ColunaTabela[] = [
  { id: 'nome', rotulo: 'Fila', noCartao: 'titulo' },
  { id: 'pendentes', rotulo: 'Esperando', alinhar: 'fim', largura: '7rem' },
  { id: 'ativas', rotulo: 'Em andamento', alinhar: 'fim', largura: '8rem' },
  { id: 'falhas', rotulo: 'Falhas (24 h)', alinhar: 'fim', largura: '8rem' },
  { id: 'parada', rotulo: 'Mais antiga parada', alinhar: 'fim', largura: '10rem' },
];

const COLUNAS_NUMEROS: readonly ColunaTabela[] = [
  { id: 'nome', rotulo: 'Número', noCartao: 'titulo' },
  { id: 'telefone', rotulo: 'Telefone', largura: '10rem' },
  { id: 'status', rotulo: 'Situação', largura: '11rem' },
  { id: 'motivo', rotulo: 'Motivo' },
];

const COLUNAS_CANAIS: readonly ColunaTabela[] = [
  { id: 'nome', rotulo: 'Canal', noCartao: 'titulo' },
  { id: 'tipo', rotulo: 'Tipo', largura: '9rem' },
  { id: 'situacao', rotulo: 'Situação', largura: '9rem' },
  { id: 'erro', rotulo: 'Último erro' },
];

/**
 * Saúde do sistema (`/administracao/saude`, só Admin) — R27: filas, gateway e números de
 * WhatsApp, canais, erros recentes, disco e último backup num só painel. Atualiza sozinho a cada
 * 30 s (parado enquanto a aba está escondida) e cada alerta traz a dica do que fazer; os
 * críticos também chegam por e-mail ao Admin.
 */
@Component({
  selector: 'app-saude',
  imports: [Botao, Cartao, CelulaTabela, EstadoVazio, Esqueleto, RouterLink, Selo, Tabela],
  templateUrl: './saude.html',
  styleUrl: './saude.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Saude {
  private readonly api = inject(SaudeApi);

  protected readonly colunasFilas = COLUNAS_FILAS;
  protected readonly colunasNumeros = COLUNAS_NUMEROS;
  protected readonly colunasCanais = COLUNAS_CANAIS;
  protected readonly iconeAtualizar = LucideRefreshCw;
  protected readonly iconeOk = LucideCircleCheck;
  protected readonly iconeAviso = LucideTriangleAlert;
  protected readonly iconeCritico = LucideCircleAlert;
  protected readonly bytes = formatarBytes;
  protected readonly parada = formatarParada;
  protected readonly rotuloSituacao = ROTULO_SITUACAO;
  protected readonly rotuloTipo = (tipo: string) => ROTULO_TIPO_CANAL[tipo] ?? tipo;

  protected readonly dados = signal<SaudeDoSistema | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  private readonly agora = signal(new Date());
  private consulta = 0;

  /** "Atualizado há 10 min" (muda com o relógio). */
  protected readonly atualizadoEm = computed(() => {
    const dados = this.dados();
    return dados ? formatarTempoRelativo(dados.geradoEm, this.agora()) : '';
  });
  protected readonly atualizadoEmCompleto = computed(() => {
    const dados = this.dados();
    return dados ? formatarDataHora(dados.geradoEm) : '';
  });

  /** Só as filas com alguma coisa a mostrar; as ociosas ficam num resumo. */
  protected readonly filasAtivas = computed<readonly FilaDeSaude[]>(
    () =>
      this.dados()?.filas.itens.filter(
        (f) => f.pendentes > 0 || f.ativas > 0 || f.falhasRecentes > 0 || f.travada,
      ) ?? [],
  );
  protected readonly filasOciosas = computed(
    () => (this.dados()?.filas.itens.length ?? 0) - this.filasAtivas().length,
  );
  protected readonly canaisDeOutrosTipos = computed<readonly CanalDeSaude[]>(
    () => this.dados()?.canais ?? [],
  );
  protected readonly numerosComProblema = computed(
    () => this.dados()?.numeros.filter((n) => n.comProblema).length ?? 0,
  );

  constructor() {
    const destruir = inject(DestroyRef);
    void this.carregar();
    const atualizar = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) {
        void this.carregar(true);
      }
    }, INTERVALO_DE_ATUALIZACAO_MS);
    const relogio = setInterval(() => this.agora.set(new Date()), INTERVALO_DO_RELOGIO_MS);
    destruir.onDestroy(() => {
      clearInterval(atualizar);
      clearInterval(relogio);
    });
  }

  /** `silencioso`: a atualização automática não troca o painel por esqueletos. */
  protected async carregar(silencioso = false): Promise<void> {
    const consulta = ++this.consulta;
    if (!silencioso || this.dados() === null) {
      this.carregando.set(true);
    }
    try {
      const dados = await this.api.consultar();
      if (consulta === this.consulta) {
        this.dados.set(dados);
        this.agora.set(new Date());
        this.erro.set(null);
      }
    } catch (falha) {
      // Falha numa atualização automática mantém o último painel (já mostra "atualizado há…").
      if (consulta === this.consulta && (this.dados() === null || !silencioso)) {
        this.erro.set(erroDaApi(falha));
      }
    } finally {
      if (consulta === this.consulta) {
        this.carregando.set(false);
      }
    }
  }

  protected varianteSituacao(situacao: SaudeDoSistema['situacao']): VarianteSelo {
    return situacao === 'ok' ? 'menta' : situacao === 'atencao' ? 'lima' : 'coral';
  }

  protected varianteNumero(numero: NumeroDeSaude): VarianteSelo {
    const status: StatusDoNumero = numero.status;
    if (numero.comProblema) {
      return 'coral';
    }
    return status === 'CONECTADO' ? 'menta' : 'neutro';
  }

  protected rotuloNumero(status: StatusDoNumero): string {
    return ROTULO_STATUS_NUMERO[status];
  }

  protected varianteGateway(status: StatusDoGateway): VarianteSelo {
    return status === 'ok' ? 'menta' : status === 'degradado' ? 'lima' : 'coral';
  }

  protected rotuloGateway(status: StatusDoGateway): string {
    return ROTULO_GATEWAY[status];
  }

  protected varianteBackup(situacao: SituacaoDoBackup): VarianteSelo {
    if (situacao === 'ok') {
      return 'menta';
    }
    return situacao === 'nenhum' || situacao === 'ilegivel' ? 'lima' : 'coral';
  }

  protected rotuloBackup(situacao: SituacaoDoBackup): string {
    return ROTULO_BACKUP[situacao];
  }

  protected varianteDisco(situacao: 'ok' | 'aviso' | 'critico'): VarianteSelo {
    return situacao === 'ok' ? 'menta' : situacao === 'aviso' ? 'lima' : 'coral';
  }

  protected quando(valor: string | null): string {
    return valor ? formatarTempoRelativo(valor, this.agora()) : '—';
  }

  protected dataHora(valor: string): string {
    return formatarDataHora(valor);
  }
}
