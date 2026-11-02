import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErroApi } from '../../../nucleo/api/erro-api';
import { FILTROS_PADRAO } from '../bi.tipos';
import { AnaliseApi } from './analise.api';
import type { DetalheAnalise, EstadoAnalise, EventoAnalise } from './analise.tipos';
import { AnaliseIa, contarBlocos } from './analise-modal';

const ESTADO: EstadoAnalise = {
  configurada: true,
  comoConfigurar: null,
  disponivel: true,
  motivo: null,
  modelo: 'claude-opus-5-5',
  limiteDiario: 20,
  usadasHoje: 4,
  restantesHoje: 16,
  maxPerguntasPorAnalise: 5,
};

@Component({
  imports: [AnaliseIa],
  template: `<app-analise-ia
    [(aberto)]="aberto"
    [painel]="'comercial'"
    [filtros]="filtros"
    [analiseId]="analiseId()"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Anfitriao {
  readonly aberto = signal(false);
  readonly analiseId = signal<string | null>(null);
  readonly filtros = { ...FILTROS_PADRAO, de: '2026-10-01', ate: '2026-10-30' };
}

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

/** Fluxo controlado pelo teste: `empurrar` entrega o próximo evento. */
function fluxoManual() {
  const fila: EventoAnalise[] = [];
  let acordar: (() => void) | null = null;
  let fim = false;
  let abortado = false;
  return {
    empurrar(...eventos: EventoAnalise[]) {
      fila.push(...eventos);
      acordar?.();
    },
    terminar() {
      fim = true;
      acordar?.();
    },
    get abortado() {
      return abortado;
    },
    gerador(signal: AbortSignal): AsyncGenerator<EventoAnalise, void, undefined> {
      signal.addEventListener('abort', () => {
        abortado = true;
        acordar?.();
      });
      return (async function* () {
        for (;;) {
          while (fila.length) {
            yield fila.shift()!;
          }
          if (fim || signal.aborted) {
            return;
          }
          await new Promise<void>((r) => (acordar = r));
        }
      })();
    },
  };
}

const CONCLUIDO: EventoAnalise = {
  evento: 'concluido',
  tipo: 'analise',
  analiseId: 'a1',
  perguntaId: null,
  restantesHoje: 15,
  conteudo: {
    texto: 'A taxa de ganho caiu.',
    destaques: [{ titulo: 'Leads em alta', detalhe: 'Mais 12%.', tendencia: 'positiva' }],
    riscos: [{ titulo: 'Funil parado', detalhe: 'Negociação.', gravidade: 'alta' }],
    acoes: [
      {
        titulo: 'Rever propostas',
        detalhe: 'Ligar para os parados.',
        prioridade: 'alta',
        link: {
          caminho: '/funis/comercial',
          parametros: { etapaId: 'e1' },
          rotulo: 'Ver negócios parados',
          ajustado: false,
        },
      },
    ],
  },
};

describe('AnaliseIa (modal)', () => {
  let api: {
    estado: ReturnType<typeof vi.fn>;
    detalhe: ReturnType<typeof vi.fn>;
    analisar: ReturnType<typeof vi.fn>;
    perguntar: ReturnType<typeof vi.fn>;
  };
  let fixture: ComponentFixture<Anfitriao>;
  let raiz: HTMLElement;

  const esperar = async () => {
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r));
      fixture.detectChanges();
    }
    await fixture.whenStable();
  };
  const abrir = async () => {
    fixture.componentInstance.aberto.set(true);
    await esperar();
  };
  const botao = (rotulo: string) =>
    Array.from(raiz.querySelectorAll('button, a')).find((b) => texto(b) === rotulo) as
      HTMLElement | undefined;
  const anuncio = () => texto(raiz.querySelector('[role="status"]'));

  beforeEach(() => {
    api = {
      estado: vi.fn(() => Promise.resolve(ESTADO)),
      detalhe: vi.fn(),
      analisar: vi.fn(),
      perguntar: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AnaliseApi, useValue: api }],
    });
    fixture = TestBed.createComponent(Anfitriao);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('não consulta nada fechado; ao abrir, mostra o painel lido e o botão "Gerar análise"', async () => {
    expect(api.estado).not.toHaveBeenCalled();
    await abrir();
    expect(api.estado).toHaveBeenCalledOnce();
    expect(texto(raiz)).toContain('Comercial · 01/10/2026 a 30/10/2026');
    expect(texto(raiz)).toContain('Restam 16 análises hoje.');
    expect(botao('Gerar análise')).toBeTruthy();
  });

  it('sem chave: explica como configurar e não oferece o botão de gerar', async () => {
    api.estado.mockResolvedValue({
      ...ESTADO,
      configurada: false,
      disponivel: false,
      comoConfigurar: 'Defina ANTHROPIC_API_KEY no servidor.',
    });
    await abrir();
    expect(texto(raiz)).toContain('ainda não foi configurada');
    expect(texto(raiz)).toContain('Defina ANTHROPIC_API_KEY no servidor.');
    expect(botao('Gerar análise')).toBeUndefined();
  });

  it('limite atingido: mostra o motivo e o limite', async () => {
    api.estado.mockResolvedValue({
      ...ESTADO,
      disponivel: false,
      usadasHoje: 20,
      restantesHoje: 0,
      motivo: 'O limite de 20 análises por dia foi atingido.',
    });
    await abrir();
    expect(texto(raiz)).toContain('Análise indisponível agora');
    expect(texto(raiz)).toContain('O limite de 20 análises por dia foi atingido.');
    expect(texto(raiz)).toContain('20 usadas hoje');
    expect(botao('Gerar análise')).toBeUndefined();
  });

  it('falha ao verificar: mostra o erro e deixa tentar de novo', async () => {
    api.estado.mockRejectedValueOnce(new ErroApi({ status: 0, codigo: 'sem_conexao' }));
    await abrir();
    expect(texto(raiz)).toContain('Não conseguimos abrir a análise com IA');
    botao('Tentar de novo')!.click();
    await esperar();
    expect(botao('Gerar análise')).toBeTruthy();
  });

  it('streaming: progresso, texto parcial, conclusão anunciada e link da ação', async () => {
    const fluxo = fluxoManual();
    api.analisar.mockImplementation((_p, _f, signal) => fluxo.gerador(signal));
    await abrir();
    botao('Gerar análise')!.click();
    await esperar();
    expect(anuncio()).toContain('Gerando a análise');
    expect(texto(raiz.querySelector('.etapas'))).toContain('Enviando os números do painel');

    fluxo.empurrar(
      { evento: 'inicio', tipo: 'analise', analiseId: 'a1', perguntaId: null },
      { evento: 'fase', fase: 'pensando' },
    );
    await esperar();
    expect(raiz.querySelector('[aria-current="step"]')?.textContent).toContain('Pensando');

    fluxo.empurrar(
      { evento: 'fase', fase: 'escrevendo' },
      { evento: 'parcial', conteudo: { texto: 'A taxa de ga' } },
    );
    await esperar();
    expect(texto(raiz.querySelector('app-analise-resultado'))).toContain('A taxa de ga');
    expect(botao('Cancelar')).toBeTruthy();

    fluxo.empurrar(CONCLUIDO);
    await esperar();
    expect(anuncio()).toBe('Análise pronta: 1 destaque, 1 risco e 1 ação.');
    const resultado = texto(raiz.querySelector('app-analise-resultado'));
    expect(resultado).toContain('Leads em alta');
    expect(resultado).toContain('Gravidade alta');
    expect(resultado).toContain('Prioridade alta');
    const link = raiz.querySelector('a.item__ir') as HTMLAnchorElement;
    expect(texto(link)).toBe('Ver negócios parados');
    expect(link.getAttribute('href')).toBe('/funis/comercial?etapaId=e1');
    expect(raiz.querySelector('form.pergunta')).toBeTruthy();
  });

  it('nova tentativa descarta o parcial e avisa', async () => {
    const fluxo = fluxoManual();
    api.analisar.mockImplementation((_p, _f, signal) => fluxo.gerador(signal));
    await abrir();
    botao('Gerar análise')!.click();
    await esperar();
    fluxo.empurrar({ evento: 'parcial', conteudo: { texto: 'texto velho' } });
    await esperar();
    fluxo.empurrar({ evento: 'nova_tentativa', tentativa: 2, motivo: 'x' });
    await esperar();
    expect(texto(raiz)).toContain('Tentando de novo…');
    expect(texto(raiz)).not.toContain('texto velho');
    expect(anuncio()).toBe('Tentando de novo.');
  });

  it('erro do streaming mostra a mensagem pronta e "Tentar de novo" gera outra análise', async () => {
    const fluxo = fluxoManual();
    api.analisar.mockImplementation((_p, _f, signal) => fluxo.gerador(signal));
    await abrir();
    botao('Gerar análise')!.click();
    await esperar();
    fluxo.empurrar({
      evento: 'erro',
      codigo: 'tempo_esgotado',
      mensagem: 'A IA demorou demais para responder.',
      analiseId: 'a1',
      perguntaId: null,
    });
    await esperar();
    expect(texto(raiz.querySelector('[role="alert"]'))).toContain(
      'A IA demorou demais para responder.',
    );
    expect(api.analisar).toHaveBeenCalledTimes(1);
    botao('Tentar de novo')!.click();
    await esperar();
    expect(api.analisar).toHaveBeenCalledTimes(2);
  });

  it('429 antes do streaming vira o estado de limite diário', async () => {
    api.analisar.mockImplementation(() =>
      (async function* () {
        yield* [] as EventoAnalise[];
        throw new ErroApi({
          status: 429,
          codigo: 'muitas_tentativas',
          mensagemDaApi: 'Você atingiu o limite diário de análises.',
          detalhes: { regra: 'R21', limiteDiario: 20, usadasHoje: 20 },
        });
      })(),
    );
    await abrir();
    botao('Gerar análise')!.click();
    await esperar();
    expect(texto(raiz)).toContain('Análise indisponível agora');
    expect(texto(raiz)).toContain('Você atingiu o limite diário de análises.');
    expect(botao('Gerar análise')).toBeUndefined();
  });

  it('503 antes do streaming vira "não configurada" com o como configurar da API', async () => {
    api.analisar.mockImplementation(() =>
      (async function* () {
        yield* [] as EventoAnalise[];
        throw new ErroApi({
          status: 503,
          codigo: 'indisponivel',
          detalhes: { motivo: 'nao_configurada', comoConfigurar: 'Peça a chave à TI.' },
        });
      })(),
    );
    await abrir();
    botao('Gerar análise')!.click();
    await esperar();
    expect(texto(raiz)).toContain('Peça a chave à TI.');
  });

  it('fechar o modal aborta a chamada no servidor', async () => {
    const fluxo = fluxoManual();
    api.analisar.mockImplementation((_p, _f, signal) => fluxo.gerador(signal));
    await abrir();
    botao('Gerar análise')!.click();
    await esperar();
    fixture.componentInstance.aberto.set(false);
    await esperar();
    expect(fluxo.abortado).toBe(true);
  });

  it('pergunta de acompanhamento: valida o tamanho, envia e mostra a resposta', async () => {
    const analise = fluxoManual();
    const pergunta = fluxoManual();
    api.analisar.mockImplementation((_p, _f, signal) => analise.gerador(signal));
    api.perguntar.mockImplementation((_id, _t, signal) => pergunta.gerador(signal));
    await abrir();
    botao('Gerar análise')!.click();
    await esperar();
    analise.empurrar(
      { evento: 'inicio', tipo: 'analise', analiseId: 'a1', perguntaId: null },
      CONCLUIDO,
    );
    await esperar();

    const enviar = botao('Perguntar') as HTMLButtonElement;
    expect(enviar.disabled).toBe(true);
    const campo = raiz.querySelector('textarea') as HTMLTextAreaElement;
    campo.value = 'Por que caiu?';
    campo.dispatchEvent(new Event('input'));
    await esperar();
    expect((botao('Perguntar') as HTMLButtonElement).disabled).toBe(false);
    (botao('Perguntar') as HTMLButtonElement).click();
    await esperar();
    expect(api.perguntar).toHaveBeenCalledWith('a1', 'Por que caiu?', expect.anything());
    expect(texto(raiz.querySelector('.turno'))).toContain('Por que caiu?');
    expect(texto(raiz.querySelector('.turno'))).toContain('Pensando…');
    expect(raiz.querySelector('form.pergunta')).toBeNull();

    pergunta.empurrar({
      evento: 'concluido',
      tipo: 'pergunta',
      analiseId: 'a1',
      perguntaId: 'p1',
      restantesHoje: null,
      conteudo: { texto: 'Porque as propostas pararam.' },
    });
    await esperar();
    expect(texto(raiz.querySelector('.turno'))).toContain('Porque as propostas pararam.');
    expect(anuncio()).toBe('Resposta pronta.');
    expect(raiz.querySelector('form.pergunta')).toBeTruthy();
  });

  it('reabre uma análise do histórico com as perguntas e sem "Tentar de novo"', async () => {
    api.detalhe.mockResolvedValue({
      id: 'a9',
      usuario: { id: 'u1', nome: 'Administrador' },
      painel: 'atendimento',
      periodo: { de: '2026-09-01T03:00:00.000Z', ate: '2026-10-01T03:00:00.000Z' },
      filtros: {},
      status: 'CONCLUIDA',
      erro: null,
      resumo: 'Resumo salvo',
      modelo: 'claude-opus-5-5',
      tentativas: 1,
      totalPerguntas: 1,
      tokens: { entrada: 1000, saida: 200, cacheLeitura: 0, cacheEscrita: 0 },
      duracaoMs: 3100,
      criadoEm: '2026-10-20T12:00:00.000Z',
      concluidoEm: '2026-10-20T12:00:03.000Z',
      resultado: { texto: 'Resumo salvo' },
      entrada: { cartoes: [] },
      perguntas: [
        {
          id: 'p1',
          pergunta: 'E o SLA?',
          resposta: { texto: 'SLA ok.' },
          status: 'CONCLUIDA',
          erro: null,
          tentativas: 1,
          tokens: null,
          duracaoMs: 1000,
          criadoEm: '2026-10-20T12:05:00.000Z',
        },
      ],
    } satisfies DetalheAnalise);
    fixture.componentInstance.analiseId.set('a9');
    await abrir();
    expect(api.detalhe).toHaveBeenCalledWith('a9');
    expect(texto(raiz)).toContain('Resumo salvo');
    expect(texto(raiz)).toContain('E o SLA?');
    expect(texto(raiz)).toContain('SLA ok.');
    expect(texto(raiz)).toContain('Atendimento');
    expect(raiz.querySelector('form.pergunta')).toBeTruthy();
    expect(botao('Tentar de novo')).toBeUndefined();
  });

  it('contarBlocos usa o plural certo', () => {
    expect(contarBlocos(null)).toBe('0 destaques, 0 riscos e 0 ações');
    expect(contarBlocos({ destaques: [{}], riscos: [{}, {}], acoes: [{}] })).toBe(
      '1 destaque, 2 riscos e 1 ação',
    );
  });
});
