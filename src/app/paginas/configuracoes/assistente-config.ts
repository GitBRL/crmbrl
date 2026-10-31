import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucidePlus, LucideSave, LucideTrash2 } from '@lucide/angular';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarNumero } from '../../nucleo/formatos';
import type {
  AtualizacaoConfiguracao,
  ConfiguracaoAssistente,
  DestinoConfigurado,
  OrigemValor,
  PrioridadeChamado,
} from '../../layout/ajuda/ajuda.tipos';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { Selo } from '../../ui/selo/selo';
import { DuvidasApi } from '../administracao/duvidas/duvidas.api';

const DESTINOS: readonly OpcaoSeletor<DestinoConfigurado>[] = [
  { valor: 'NENHUM', rotulo: 'Nenhum (o botão Abrir chamado some)' },
  { valor: 'TICKETHUB', rotulo: 'TicketHub' },
  { valor: 'WEBHOOK', rotulo: 'Webhook' },
];
const PRIORIDADES: readonly OpcaoSeletor<PrioridadeChamado>[] = [
  { valor: 'baixa', rotulo: 'Baixa' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'critica', rotulo: 'Crítica' },
];

export const ROTULO_ORIGEM: Readonly<Record<'admin' | 'ambiente', string>> = {
  admin: 'definido aqui',
  ambiente: 'vem da configuração do servidor',
};

interface CabecalhoNovo {
  readonly id: number;
  nome: string;
  valor: string;
}

/** Texto de "0 = desligado" etc. a partir de um campo numérico; `null` quando em branco. */
export function inteiroOuNulo(valor: string | number | null): number | null | 'invalido' {
  const texto = String(valor ?? '').trim();
  if (texto === '') {
    return null;
  }
  const numero = Number(texto);
  return Number.isInteger(numero) && numero >= 0 ? numero : 'invalido';
}

/**
 * Configuração do assistente de ajuda (só Admin): perguntas por dia (0 desliga), orçamento mensal
 * de tokens, destino dos chamados (TicketHub ou webhook) e a base de conhecimento carregada.
 * Segredos nunca voltam da API: a senha e o segredo mostram só se estão definidos.
 */
@Component({
  selector: 'app-assistente-config',
  imports: [AreaTexto, Botao, CampoSenha, CampoTexto, Cartao, EstadoVazio, Seletor, Selo],
  templateUrl: './assistente-config.html',
  styleUrl: './assistente-config.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistenteConfig {
  private readonly api = inject(DuvidasApi);
  private readonly avisos = inject(AvisosService);

  protected readonly icones = { salvar: LucideSave, mais: LucidePlus, lixo: LucideTrash2 };
  protected readonly destinos = DESTINOS;
  protected readonly prioridades = PRIORIDADES;
  protected readonly dicaModelo =
    'Marcadores: {{titulo}}, {{descricao}}, {{categoria}}, {{tela}}, {{usuario.nome}}, {{conversa}} (lista) e outros.';
  protected readonly rotuloOrigem = ROTULO_ORIGEM;
  protected readonly formatarNumero = formatarNumero;

  protected readonly config = signal<ConfiguracaoAssistente | null>(null);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly salvando = signal(false);
  protected readonly testando = signal(false);
  protected readonly resultadoTeste = signal<{ ok: boolean; mensagem: string } | null>(null);
  protected readonly erroSalvar = signal<ErroApi | null>(null);
  /** Muda a cada carga: os campos que guardam o próprio valor são recriados. */
  protected readonly revisao = signal(0);

  protected readonly porDia = signal<string | number>('');
  protected readonly orcamento = signal<string | number>('');
  protected readonly destino = signal<DestinoConfigurado | null>('NENHUM');
  // TicketHub
  protected readonly thUrl = signal<string | number>('');
  protected readonly thUrlPublica = signal<string | number>('');
  protected readonly thEmail = signal<string | number>('');
  protected readonly thSenha = signal('');
  protected readonly thSenhaDoServidor = signal(false);
  protected readonly thPrioridade = signal<PrioridadeChamado | null>('media');
  protected readonly thSistemaId = signal<string | number>('');
  // Webhook
  protected readonly whUrl = signal<string | number>('');
  protected readonly whSegredo = signal('');
  protected readonly whModelo = signal('');
  protected readonly whRemovidos = signal<ReadonlySet<string>>(new Set());
  protected readonly whNovos = signal<readonly CabecalhoNovo[]>([]);
  private proximoCabecalho = 1;

  protected readonly erroPorDia = computed(() => {
    const v = inteiroOuNulo(this.porDia());
    return v === null || v === 'invalido' || v > 1000
      ? 'Informe um número inteiro de 0 a 1000.'
      : null;
  });
  protected readonly erroOrcamento = computed(() =>
    inteiroOuNulo(this.orcamento()) === 'invalido'
      ? 'Use um número inteiro ou deixe em branco.'
      : null,
  );
  protected readonly erroSegredo = computed(() => {
    const s = this.whSegredo();
    return s !== '' && s.length < 16 ? 'O segredo precisa de pelo menos 16 caracteres.' : null;
  });
  protected readonly erroModelo = computed(() => {
    const m = this.whModelo().trim();
    if (!m) {
      return null;
    }
    // O modelo só vira JSON depois de trocar os marcadores; confere só o que dá para conferir aqui.
    return /\{\{\s*$/.test(m) ? 'Há um marcador {{ sem fechar.' : null;
  });
  protected readonly podeSalvar = computed(
    () =>
      !this.salvando() &&
      this.config() !== null &&
      !this.erroPorDia() &&
      !this.erroOrcamento() &&
      !this.erroSegredo() &&
      !this.erroModelo(),
  );
  protected readonly desligado = computed(() => Number(this.porDia()) === 0);
  protected readonly percentualDoMes = computed(() => {
    const uso = this.config()?.uso;
    return uso?.orcamentoMensalTokens
      ? Math.min(100, Math.round((uso.tokensNoMes / uso.orcamentoMensalTokens) * 100))
      : null;
  });

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    this.erro.set(null);
    try {
      this.aplicar(await this.api.configuracao());
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    }
  }

  private aplicar(c: ConfiguracaoAssistente): void {
    this.config.set(c);
    this.porDia.set(c.perguntasPorDia);
    this.orcamento.set(c.orcamentoMensalTokens ?? '');
    this.destino.set(c.destino);
    this.thUrl.set(c.ticketHub.url ?? '');
    this.thUrlPublica.set(c.ticketHub.urlPublica ?? '');
    this.thEmail.set(c.ticketHub.email ?? '');
    this.thSenha.set('');
    this.thSenhaDoServidor.set(false);
    this.thPrioridade.set(c.ticketHub.prioridade);
    this.thSistemaId.set(c.ticketHub.sistemaId ?? '');
    this.whUrl.set(c.webhook.url ?? '');
    this.whSegredo.set('');
    this.whModelo.set(c.webhook.modeloCorpo ?? '');
    this.whRemovidos.set(new Set());
    this.whNovos.set([]);
    this.erroSalvar.set(null);
    this.resultadoTeste.set(null);
    this.revisao.update((n) => n + 1);
  }

  protected origem(valor: OrigemValor): string | null {
    return valor ? ROTULO_ORIGEM[valor] : null;
  }

  // Cabeçalhos do webhook ------------------------------------------------------------------------

  protected alternarRemocao(nome: string): void {
    this.whRemovidos.update((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(nome)) {
        novo.add(nome);
      }
      return novo;
    });
  }

  protected adicionarCabecalho(): void {
    this.whNovos.update((l) => [...l, { id: this.proximoCabecalho++, nome: '', valor: '' }]);
  }

  protected mudarCabecalho(
    id: number,
    campo: 'nome' | 'valor',
    texto: string | number | null,
  ): void {
    this.whNovos.update((l) =>
      l.map((c) => (c.id === id ? { ...c, [campo]: String(texto ?? '') } : c)),
    );
  }

  protected removerCabecalhoNovo(id: number): void {
    this.whNovos.update((l) => l.filter((c) => c.id !== id));
  }

  protected usarModeloPadrao(): void {
    const padrao = this.config()?.webhook.modeloCorpoPadrao;
    if (padrao) {
      this.whModelo.set(padrao);
    }
  }

  // Salvar -----------------------------------------------------------------------------------------

  private texto(valor: string | number): string | null {
    const t = String(valor).trim();
    return t === '' ? null : t;
  }

  /** O corpo do PUT (parcial): só o que esta tela controla; segredos só quando digitados. */
  protected corpo(): AtualizacaoConfiguracao {
    const porDia = inteiroOuNulo(this.porDia());
    const orcamento = inteiroOuNulo(this.orcamento());
    const sistema = this.texto(this.thSistemaId());
    const ticketHub: NonNullable<AtualizacaoConfiguracao['ticketHub']> = {
      url: this.texto(this.thUrl()),
      urlPublica: this.texto(this.thUrlPublica()),
      email: this.texto(this.thEmail()),
      prioridade: this.thPrioridade() ?? 'media',
      sistemaId: sistema === null ? null : Number(sistema),
    };
    if (this.thSenhaDoServidor()) {
      ticketHub.senha = null;
    } else if (this.thSenha() !== '') {
      ticketHub.senha = this.thSenha();
    }
    const cabecalhos: Record<string, string | null> = {};
    for (const nome of this.whRemovidos()) {
      cabecalhos[nome] = null;
    }
    for (const novo of this.whNovos()) {
      if (novo.nome.trim() && novo.valor !== '') {
        cabecalhos[novo.nome.trim()] = novo.valor;
      }
    }
    const webhook: NonNullable<AtualizacaoConfiguracao['webhook']> = {
      url: this.texto(this.whUrl()),
      modeloCorpo: this.whModelo().trim() === '' ? null : this.whModelo(),
    };
    if (Object.keys(cabecalhos).length > 0) {
      webhook.cabecalhos = cabecalhos;
    }
    if (this.whSegredo() !== '') {
      webhook.segredo = this.whSegredo();
    }
    return {
      perguntasPorDia: typeof porDia === 'number' ? porDia : 0,
      orcamentoMensalTokens: typeof orcamento === 'number' ? orcamento : null,
      destino: this.destino() ?? 'NENHUM',
      ticketHub,
      webhook,
    };
  }

  protected async salvar(): Promise<void> {
    if (!this.podeSalvar()) {
      return;
    }
    this.salvando.set(true);
    this.erroSalvar.set(null);
    try {
      this.aplicar(await this.api.salvarConfiguracao(this.corpo()));
      this.avisos.sucesso('Configuração do assistente salva.');
    } catch (falha) {
      this.erroSalvar.set(erroDaApi(falha));
    } finally {
      this.salvando.set(false);
    }
  }

  protected async testar(): Promise<void> {
    this.testando.set(true);
    this.resultadoTeste.set(null);
    try {
      this.resultadoTeste.set(await this.api.testar());
    } catch (falha) {
      const erro = erroDaApi(falha);
      this.resultadoTeste.set({
        ok: false,
        mensagem:
          erro.status === 503
            ? 'O destino ainda não está pronto: salve a configuração completa antes de testar.'
            : erro.resumo,
      });
    } finally {
      this.testando.set(false);
    }
  }

  protected erroDoCampo(caminho: string): string | null {
    return this.erroSalvar()?.mensagemDoCampo(caminho) ?? null;
  }
}
