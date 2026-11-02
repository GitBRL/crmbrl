import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErroApi } from '../../nucleo/api/erro-api';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { AjudaApi } from './ajuda.api';
import type { ChamadoDto, EstadoAssistente, EventoPergunta } from './ajuda.tipos';
import { Ajuda, linkSeguro, mensagemDoErro, textoPuro } from './ajuda';

const ESTADO: EstadoAssistente = {
  disponivel: true,
  motivo: null,
  aviso: 'As perguntas ficam registradas. Não escreva dados de clientes.',
  modelo: 'm',
  perguntasPorDia: 20,
  usadasHoje: 1,
  restantesHoje: 19,
  maxCaracteresPergunta: 2000,
  maxPerguntasPorConversa: 30,
  chamadosDisponiveis: true,
  categoriasComChamado: ['funcionalidade_inexistente_no_escopo', 'erro_do_sistema'],
};

const CHAMADO: ChamadoDto = {
  id: 'ch1',
  conversaId: 'c1',
  perguntaId: 'p1',
  titulo: 'Integração',
  descricao: 'Quero integração',
  tela: '/inicio',
  categoria: 'funcionalidade_inexistente_no_escopo',
  destino: 'TICKETHUB',
  status: 'PENDENTE',
  tentativas: 0,
  proximaTentativaEm: null,
  ultimoErro: null,
  numero: null,
  link: null,
  criadoEm: '2026-10-31T10:00:00Z',
  enviadoEm: null,
};

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

async function* eventos(...lista: EventoPergunta[]): AsyncGenerator<EventoPergunta> {
  for (const e of lista) {
    yield e;
  }
}

const INICIO: EventoPergunta = {
  evento: 'inicio',
  conversaId: 'c1',
  perguntaId: 'p1',
  conversaNova: true,
  modelo: 'm',
};
const concluido = (
  extra: Partial<Extract<EventoPergunta, { evento: 'concluido' }>> = {},
): EventoPergunta => ({
  evento: 'concluido',
  conversaId: 'c1',
  perguntaId: 'p1',
  resposta: 'Abra **Funis** e clique em Novo.',
  resolvido: true,
  categoria: 'duvida_de_uso',
  resumoDoPedido: null,
  podeAbrirChamado: false,
  restantesHoje: 18,
  ...extra,
});

describe('Ajuda (painel do assistente)', () => {
  let api: Record<
    'estado' | 'perguntar' | 'avaliar' | 'abrirChamado' | 'chamado' | 'conversas' | 'conversa',
    ReturnType<typeof vi.fn>
  >;
  let fixture: ComponentFixture<Ajuda>;
  let raiz: HTMLElement;

  const esperar = async () => {
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r));
      fixture.detectChanges();
    }
    await fixture.whenStable();
  };
  const botao = (rotulo: string) =>
    Array.from(raiz.querySelectorAll('button')).find((b) => texto(b).includes(rotulo));
  const abrir = async () => {
    (raiz.querySelector('.ajuda__botao') as HTMLElement).click();
    await esperar();
  };
  const perguntar = async (pergunta: string) => {
    const area = raiz.querySelector('textarea') as HTMLTextAreaElement;
    area.value = pergunta;
    area.dispatchEvent(new Event('input'));
    await esperar();
    botao('Enviar')!.click();
    await esperar();
  };

  beforeEach(() => {
    api = {
      estado: vi.fn(() => Promise.resolve(ESTADO)),
      perguntar: vi.fn(),
      avaliar: vi.fn(),
      abrirChamado: vi.fn(),
      chamado: vi.fn(),
      conversas: vi.fn(() => Promise.resolve([])),
      conversa: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AjudaApi, useValue: api }],
    });
    entrarComo('COMERCIAL');
    fixture = TestBed.createComponent(Ajuda);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('não consulta nada fechado; ao abrir mostra o aviso de registro', async () => {
    expect(api.estado).not.toHaveBeenCalled();
    await abrir();
    expect(api.estado).toHaveBeenCalledOnce();
    expect(texto(raiz.querySelector('[data-teste=aviso]'))).toBe(ESTADO.aviso);
  });

  it('envia a pergunta com a rota atual e mostra a resposta, com avaliação', async () => {
    api.perguntar.mockImplementation(() =>
      eventos(
        INICIO,
        { evento: 'fase', fase: 'pensando' },
        { evento: 'parcial', resposta: 'Abra' },
        concluido(),
      ),
    );
    await abrir();
    await perguntar('Como crio um negócio?');
    const [pergunta, tela, conversa] = api.perguntar.mock.calls[0];
    expect([pergunta, tela, conversa]).toEqual(['Como crio um negócio?', '/', null]);
    expect(texto(raiz.querySelector('.turno__resposta'))).toContain('Abra Funis e clique em Novo.');
    expect(raiz.querySelector('.turno__resposta strong')?.textContent).toBe('Funis');
    expect(texto(raiz.querySelector('[role=status][aria-live=polite]'))).toContain(
      'Resposta do assistente',
    );
    expect(botao('Abrir chamado')).toBeUndefined();

    api.avaliar.mockResolvedValue({ id: 'p1', avaliacao: 'UTIL' });
    (raiz.querySelector('button[aria-label="Resposta útil"]') as HTMLElement).click();
    await esperar();
    expect(api.avaliar).toHaveBeenCalledWith('p1', 'UTIL');
    expect(
      raiz.querySelector('button[aria-label="Resposta útil"]')?.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('a segunda pergunta continua a mesma conversa', async () => {
    api.perguntar.mockImplementation(() => eventos(INICIO, concluido()));
    await abrir();
    await perguntar('Primeira?');
    await perguntar('Segunda?');
    expect(api.perguntar.mock.calls[1][2]).toBe('c1');
  });

  it('descarta o parcial na nova tentativa', async () => {
    api.perguntar.mockImplementation(() =>
      eventos(
        INICIO,
        { evento: 'parcial', resposta: 'Texto velho' },
        { evento: 'nova_tentativa', tentativa: 2, motivo: 'x' },
        concluido({ resposta: 'Texto novo' }),
      ),
    );
    await abrir();
    await perguntar('Pergunta?');
    expect(texto(raiz)).not.toContain('Texto velho');
    expect(texto(raiz)).toContain('Texto novo');
  });

  it('erro do streaming: mostra a mensagem e deixa tentar de novo', async () => {
    api.perguntar.mockImplementationOnce(() =>
      eventos(INICIO, {
        evento: 'erro',
        codigo: 'tempo_esgotado',
        mensagem: 'Demorou demais.',
        conversaId: 'c1',
        perguntaId: 'p1',
      }),
    );
    api.perguntar.mockImplementation(() => eventos(INICIO, concluido()));
    await abrir();
    await perguntar('Pergunta?');
    expect(texto(raiz.querySelector('[data-teste=erro]'))).toContain('Demorou demais.');
    botao('Tentar de novo')!.click();
    await esperar();
    expect(api.perguntar).toHaveBeenCalledTimes(2);
    expect(raiz.querySelector('[data-teste=erro]')).toBeNull();
    expect(texto(raiz)).toContain('Abra Funis');
  });

  it('sem conexão: mensagem humana', async () => {
    api.perguntar.mockImplementation(() => {
      throw new ErroApi({ status: 0, codigo: 'desconhecido' });
    });
    await abrir();
    await perguntar('Pergunta?');
    expect(texto(raiz.querySelector('[data-teste=erro]'))).toContain('Sem conexão');
  });

  it('limite do dia: bloqueia o envio e explica', async () => {
    api.estado.mockResolvedValue({ ...ESTADO, restantesHoje: 0 });
    await abrir();
    expect(texto(raiz.querySelector('[data-teste=bloqueio]'))).toContain(
      'limite de perguntas de hoje',
    );
    expect((botao('Enviar') as HTMLButtonElement).disabled).toBe(true);
  });

  it('sem configuração: mostra o motivo e desabilita o envio', async () => {
    api.estado.mockResolvedValue({
      ...ESTADO,
      disponivel: false,
      motivo: 'A IA ainda não foi configurada.',
    });
    await abrir();
    expect(texto(raiz.querySelector('[data-teste=bloqueio]'))).toBe(
      'A IA ainda não foi configurada.',
    );
    expect((botao('Enviar') as HTMLButtonElement).disabled).toBe(true);
  });

  it('chamado: pede confirmação, abre e mostra o número quando enviado', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    try {
      api.perguntar.mockImplementation(() =>
        eventos(
          INICIO,
          concluido({
            categoria: 'funcionalidade_inexistente_no_escopo',
            resolvido: false,
            podeAbrirChamado: true,
            resumoDoPedido: 'Integração com o Pipedrive',
          }),
        ),
      );
      api.abrirChamado.mockResolvedValue(CHAMADO);
      api.chamado.mockResolvedValue({
        ...CHAMADO,
        status: 'ENVIADO',
        numero: '3f2a9c1e-7b4d-4e8a-9c15-0d6f2b8a41c7',
        link: 'https://t.exemplo/42',
      });
      await abrir();
      await perguntar('Quero integração com o Pipedrive');
      expect(api.abrirChamado).not.toHaveBeenCalled();
      botao('Abrir chamado')!.click();
      await esperar();
      expect(texto(raiz)).toContain('toda a conversa com o assistente');
      expect((raiz.querySelector('app-modal input') as HTMLInputElement).value).toBe(
        'Integração com o Pipedrive',
      );
      botao('Confirmar e abrir chamado')!.click();
      await esperar();
      expect(api.abrirChamado).toHaveBeenCalledWith('p1', {
        titulo: 'Integração com o Pipedrive',
        descricao: 'Quero integração com o Pipedrive',
      });
      expect(texto(raiz.querySelector('[data-teste=chamado]'))).toContain('Enviando o chamado');
      await vi.advanceTimersByTimeAsync(3000);
      await esperar();
      const chamado = raiz.querySelector('[data-teste=chamado]');
      expect(texto(chamado)).toContain('Chamado nº 3F2A9C1E aberto.');
      expect(chamado?.getAttribute('title')).toBe('Chamado 3f2a9c1e-7b4d-4e8a-9c15-0d6f2b8a41c7');
      expect(chamado?.querySelector('[data-teste=copiar-chamado]')).not.toBeNull();
      expect(chamado?.querySelector('a')?.getAttribute('href')).toBe('https://t.exemplo/42');
    } finally {
      vi.useRealTimers();
    }
  });

  it('funções de apoio', () => {
    expect(textoPuro('**Oi** [link](/x) `a`\n- item')).toBe('Oi link a item');
    expect(linkSeguro('javascript:alert(1)')).toBeNull();
    expect(linkSeguro('https://a.com')).toBe('https://a.com');
    expect(
      mensagemDoErro(
        new ErroApi({
          status: 429,
          codigo: 'desconhecido',
          detalhes: { motivo: 'orcamento_mensal' },
        }),
      ),
    ).toContain('orçamento');
  });
});
