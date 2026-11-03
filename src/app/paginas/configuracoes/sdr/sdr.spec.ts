import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessaoService } from '../../../nucleo/sessao/sessao.service';
import { entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import type { Automacao } from '../../automacoes/automacoes.tipos';
import { SECOES_CONFIGURACOES } from '../secoes';
import { CanaisSdr } from './canais-sdr';
import { erroDoArtigo } from './conhecimento-sdr';
import { erroDoCriterio, opcoesDoTexto } from './criterios-sdr';
import { erroDeFaixas, erroDeInteiro } from './regras-sdr';
import { chaveDoRotulo, inteiroDoCampo } from './rotulos';
import { automacoesQueAvisam, SdrConfigApi } from './sdr.api';
import type { CanalSdr, TurnoSimulador } from './sdr.tipos';
import { efeitoDaAcao, SimuladorSdr } from './simulador-sdr';

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

function automacao(ajustes: Partial<Automacao>): Automacao {
  return {
    id: 'a1',
    nome: 'Boas-vindas ao lead',
    ativa: true,
    tipoGatilho: 'EVENTO',
    evento: 'contato.criado',
    definicao: { passos: [{ id: 'p1', tipo: 'acao.whatsapp', config: {} }] },
    ...ajustes,
  } as Automacao;
}

describe('Aviso de automação que escreve ao lead novo', () => {
  it('lista só as ligadas, no evento de lead novo e com passo que escreve', () => {
    const lista = [
      automacao({}),
      automacao({ id: 'a2', ativa: false }),
      automacao({ id: 'a3', evento: 'negocio.ganho' }),
      automacao({ id: 'a4', definicao: { passos: [{ id: 'x', tipo: 'acao.etiquetar' }] } }),
      automacao({
        id: 'a5',
        evento: 'conversa.criada',
        definicao: {
          passos: [
            {
              id: 'se',
              tipo: 'condicao',
              ramos: [{ id: 'r', passos: [{ id: 'm', tipo: 'acao.chatbot' }] }],
            },
          ],
        },
      }),
    ];
    expect(automacoesQueAvisam(lista).map((a) => a.id)).toEqual(['a1', 'a5']);
  });
});

describe('Validações da configuração do SDR', () => {
  it('chaveDoRotulo tira acento e símbolos', () => {
    expect(chaveDoRotulo('Forma de pagamento')).toBe('forma_de_pagamento');
    expect(chaveDoRotulo('Início previsto?')).toBe('inicio_previsto');
    expect(chaveDoRotulo('2º curso')).toBe('c_2_curso');
    expect(chaveDoRotulo('')).toBe('');
  });

  it('inteiroDoCampo e erroDeInteiro', () => {
    expect(inteiroDoCampo('')).toBeNull();
    expect(inteiroDoCampo(' 8 ')).toBe(8);
    expect(inteiroDoCampo('1.5')).toBeNaN();
    expect(erroDeInteiro('', 0, 60)).toBe('Informe um número.');
    expect(erroDeInteiro('', 0, 60, true)).toBeNull();
    expect(erroDeInteiro('61', 0, 60)).toContain('0 a 60');
    expect(erroDeInteiro(8, 0, 60)).toBeNull();
  });

  it('faixas: morno precisa ficar abaixo de quente', () => {
    expect(erroDeFaixas(70, 40)).toBeNull();
    expect(erroDeFaixas(40, 40)).toContain('menor');
  });

  it('opcoesDoTexto ignora linhas vazias e repetidas', () => {
    expect(opcoesDoTexto(' Presencial \n\nEAD\nEAD\nHíbrido ')).toEqual([
      'Presencial',
      'EAD',
      'Híbrido',
    ]);
  });

  it('erroDoCriterio confere rótulo, chave, opções, campo e peso', () => {
    const base = {
      rotulo: 'Cidade',
      chave: 'cidade',
      instrucao: 'Descubra a cidade.',
      tipo: 'TEXTO' as const,
      opcoes: [],
      alvo: 'NENHUM' as const,
      campo: null,
      peso: 10,
      novo: true,
    };
    expect(erroDoCriterio(base)).toBeNull();
    expect(erroDoCriterio({ ...base, chave: 'Cidade 1' })).toContain('identificador');
    expect(erroDoCriterio({ ...base, novo: false, chave: 'Cidade 1' })).toBeNull();
    expect(erroDoCriterio({ ...base, tipo: 'OPCAO', opcoes: ['Só uma'] })).toContain('opções');
    expect(erroDoCriterio({ ...base, alvo: 'NEGOCIO' })).toContain('campo');
    expect(erroDoCriterio({ ...base, alvo: 'NEGOCIO', campo: 'campos.cidade' })).toBeNull();
    expect(erroDoCriterio({ ...base, peso: 0 })).toContain('peso');
  });

  it('erroDoArtigo exige título e texto', () => {
    expect(erroDoArtigo('A', 'x')).toContain('título');
    expect(erroDoArtigo('Valores', '  ')).toContain('texto');
    expect(erroDoArtigo('Valores', 'R$ 100')).toBeNull();
  });

  it('efeitoDaAcao explica o que aconteceria de verdade', () => {
    expect(efeitoDaAcao('continuar')).toBeNull();
    expect(efeitoDaAcao('qualificado')).toContain('Comercial');
    expect(efeitoDaAcao('passar_humano')).toContain('equipe');
  });

  it('só o Admin tem a seção', () => {
    const secao = SECOES_CONFIGURACOES.find((s) => s.caminho === 'sdr')!;
    entrarComo('ADMIN');
    const sessao = TestBed.inject(SessaoService);
    expect(sessao.permite(secao.permite)).toBe(true);
    entrarComo('C_LEVEL');
    expect(sessao.permite(secao.permite)).toBe(false);
    entrarComo('COMERCIAL');
    expect(sessao.permite(secao.permite)).toBe(false);
    TestBed.resetTestingModule();
  });
});

describe('Canais do SDR', () => {
  const CANAIS: CanalSdr[] = [
    { canalId: 'c1', nome: 'WhatsApp Vendas', tipo: 'WHATSAPP', ativo: true, modo: 'AUTOMATICO' },
    { canalId: 'c2', nome: 'Chat do site', tipo: 'WEBCHAT', ativo: true, modo: 'DESLIGADO' },
  ];
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let fixture: ComponentFixture<CanaisSdr>;
  let raiz: HTMLElement;
  const esperar = async () => {
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r));
      fixture.detectChanges();
    }
    await fixture.whenStable();
  };

  beforeEach(async () => {
    api = {
      canais: vi.fn(() => Promise.resolve(CANAIS)),
      geral: vi.fn(() => Promise.resolve({ iaConfigurada: true })),
      automacoesQueAvisam: vi.fn(() =>
        Promise.resolve([{ id: 'a1', nome: 'Boas-vindas ao lead' }]),
      ),
      definirModo: vi.fn(() => Promise.resolve({})),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SdrConfigApi, useValue: api }],
    });
    entrarComo('ADMIN');
    fixture = TestBed.createComponent(CanaisSdr);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    await esperar();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('lista os canais, explica os modos e avisa da automação com link', () => {
    const t = texto(raiz);
    expect(t).toContain('WhatsApp Vendas');
    expect(t).toContain('Chat do site');
    expect(t).toContain('só propõe a resposta');
    expect(t).toContain('manda mensagem a todo lead novo');
    expect(raiz.querySelector('a[href="/automacoes/a1"]')).not.toBeNull();
  });

  it('muda o modo do canal na hora', async () => {
    const selects = raiz.querySelectorAll('select');
    const select = selects[1] as HTMLSelectElement;
    const opcao = Array.from(select.options).find((o) => texto(o) === 'Sugestão')!;
    select.value = opcao.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await esperar();
    expect(api['definirModo']).toHaveBeenCalledWith('c2', 'SUGESTAO');
  });

  it('sem automação ou com todos os canais desligados, não avisa', async () => {
    api['automacoesQueAvisam'].mockResolvedValue([]);
    fixture = TestBed.createComponent(CanaisSdr);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    await esperar();
    expect(raiz.querySelector('[data-teste=aviso-automacao]')).toBeNull();
  });
});

describe('Simulador do SDR', () => {
  const TURNO = (acao: TurnoSimulador['acao']): TurnoSimulador => ({
    aviso: '',
    resposta: 'Oi! Qual curso você procura?',
    criterios: [
      {
        chave: 'curso',
        rotulo: 'Curso de interesse',
        valor: 'Direito',
        confianca: 0.9,
        aceito: true,
        motivoDaRecusa: null,
      },
    ],
    valores: [{ chave: 'curso', rotulo: 'Curso de interesse', valor: 'Direito', confianca: 0.9 }],
    nota: 30,
    temperatura: 'FRIO',
    faltamObrigatorios: ['modalidade'],
    acao,
    motivo: null,
    motivoDaTroca: null,
    resumo: null,
    tokens: { total: 10 },
  });
  let api: { turnoDoSimulador: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<SimuladorSdr>;
  let raiz: HTMLElement;
  const esperar = async () => {
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r));
      fixture.detectChanges();
    }
    await fixture.whenStable();
  };
  const botao = (rotulo: string) =>
    Array.from(raiz.querySelectorAll('button')).find((b) => texto(b) === rotulo) as HTMLElement;
  const escrever = async (valor: string) => {
    const area = raiz.querySelector('textarea') as HTMLTextAreaElement;
    area.value = valor;
    area.dispatchEvent(new Event('input', { bubbles: true }));
    await esperar();
  };

  beforeEach(async () => {
    api = { turnoDoSimulador: vi.fn(() => Promise.resolve(TURNO('continuar'))) };
    TestBed.configureTestingModule({ providers: [{ provide: SdrConfigApi, useValue: api }] });
    entrarComo('ADMIN');
    fixture = TestBed.createComponent(SimuladorSdr);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    await esperar();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('mostra critérios, nota, temperatura e ação a cada resposta e devolve os valores no turno seguinte', async () => {
    await escrever('Quero Direito');
    botao('Enviar').click();
    await esperar();
    const analise = texto(raiz.querySelector('[data-teste=analise]'));
    expect(analise).toContain('Nota 30/100');
    expect(analise).toContain('Frio');
    expect(analise).toContain('Curso de interesse: Direito');
    expect(analise).toContain('Continuar a conversa');
    expect(analise).toContain('Obrigatórios que faltam: modalidade');
    expect(api.turnoDoSimulador.mock.calls[0][0]).toEqual([
      { papel: 'lead', texto: 'Quero Direito' },
    ]);

    await escrever('Presencial');
    botao('Enviar').click();
    await esperar();
    const [mensagens, valores] = api.turnoDoSimulador.mock.calls[1];
    expect(mensagens.map((m: { papel: string }) => m.papel)).toEqual(['lead', 'ia', 'lead']);
    expect(valores).toHaveLength(1);
  });

  it('ao qualificar, esconde o campo e Recomeçar limpa tudo', async () => {
    api.turnoDoSimulador.mockResolvedValue(TURNO('qualificado'));
    await escrever('Quero me matricular');
    botao('Enviar').click();
    await esperar();
    expect(texto(raiz)).toContain('Na conversa real, o negócio iria para o Comercial');
    expect(raiz.querySelector('textarea')).toBeNull();
    botao('Recomeçar').click();
    await esperar();
    expect(raiz.querySelector('[data-teste=analise]')).toBeNull();
    expect(raiz.querySelector('textarea')).not.toBeNull();
  });

  it('se a API falha, mostra o erro e devolve o texto ao campo', async () => {
    api.turnoDoSimulador.mockRejectedValue(new Error('falhou'));
    await escrever('Oi');
    botao('Enviar').click();
    await esperar();
    expect(raiz.querySelector('[role=alert]')).not.toBeNull();
    expect((raiz.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Oi');
    expect(raiz.querySelector('[data-teste=analise]')).toBeNull();
  });
});
