import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import { INTERVALO_DE_ATUALIZACAO_MS, Saude } from './saude';
import { SaudeApi } from './saude.api';
import { formatarBytes, formatarParada, type SaudeDoSistema } from './saude.tipos';

const SAUDAVEL: SaudeDoSistema = {
  geradoEm: new Date().toISOString(),
  situacao: 'ok',
  alertas: [],
  filas: {
    disponivel: true,
    itens: [
      {
        nome: 'whatsapp.envio.n1',
        pendentes: 0,
        ativas: 0,
        falhasRecentes: 0,
        maisAntigaParadaSegundos: null,
        travada: false,
      },
    ],
    totalPendentes: 0,
    totalAtivas: 0,
    totalFalhasRecentes: 0,
    maisAntigaParadaSegundos: null,
  },
  gateway: { status: 'ok', simulado: false },
  numeros: [
    {
      id: 'n1',
      nome: 'Comercial',
      telefone: '5511999990000',
      status: 'CONECTADO',
      motivo: null,
      canalAtivo: true,
      pausado: false,
      comProblema: false,
      desconectadoEm: null,
    },
  ],
  canais: [],
  erros: { total24h: 0, recentes: [] },
  disco: {
    caminho: '/backups',
    totalBytes: 100 * 1024 ** 3,
    livreBytes: 60 * 1024 ** 3,
    livrePercentual: 60,
    situacao: 'ok',
    bancoBytes: 300 * 1024 ** 2,
  },
  backup: {
    situacao: 'ok',
    idadeHoras: 2,
    ultimo: {
      inicio: new Date().toISOString(),
      fim: new Date().toISOString(),
      arquivo: 'crmbrl-2026-10-31.dump',
      tamanhoBytes: 5 * 1024 ** 2,
      ok: true,
      erro: null,
    },
  },
  emailConfigurado: true,
};

const COM_PROBLEMAS: SaudeDoSistema = {
  ...SAUDAVEL,
  situacao: 'critico',
  alertas: [
    {
      chave: 'numero:n1',
      codigo: 'numero_desconectado',
      gravidade: 'critico',
      titulo: 'Número Comercial desconectado',
      detalhe: 'O número saiu do ar: Desconectado pelo celular',
      dica: 'Abra Configurações > Canais e leia o QR de novo.',
      porEmail: true,
    },
    {
      chave: 'backup',
      codigo: 'backup_nenhum',
      gravidade: 'aviso',
      titulo: 'Nenhum backup registrado',
      detalhe: 'Sem registro.',
      dica: 'Ligue o serviço de backup.',
      porEmail: false,
    },
  ],
  numeros: [
    {
      ...SAUDAVEL.numeros[0],
      status: 'DESCONECTADO',
      motivo: 'Desconectado pelo celular',
      comProblema: true,
    } as SaudeDoSistema['numeros'][number],
  ],
  filas: {
    ...SAUDAVEL.filas,
    itens: [
      {
        nome: 'webhooks.entregar',
        pendentes: 4,
        ativas: 0,
        falhasRecentes: 2,
        maisAntigaParadaSegundos: 1500,
        travada: true,
      },
      ...SAUDAVEL.filas.itens,
    ],
    totalPendentes: 4,
    totalFalhasRecentes: 2,
    maisAntigaParadaSegundos: 1500,
  },
  backup: { situacao: 'nenhum', ultimo: null, idadeHoras: null },
  canais: [
    {
      id: 'c1',
      tipo: 'EMAIL',
      nome: 'Caixa suporte',
      ativo: true,
      ultimoErro: 'IMAP recusou o login',
      ultimoErroEm: new Date().toISOString(),
      comErroRecente: true,
    },
  ],
  erros: {
    total24h: 1,
    recentes: [
      { id: '9', criadoEm: new Date().toISOString(), contexto: 'HTTP', mensagem: 'Falha de teste' },
    ],
  },
};

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('Saúde do sistema (Admin)', () => {
  let api: { consultar: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<Saude>;
  let raiz: HTMLElement;
  const esperar = async () => {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const montar = async (resposta: () => Promise<SaudeDoSistema>) => {
    api = { consultar: vi.fn(resposta) };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SaudeApi, useValue: api }],
    });
    entrarComo('ADMIN');
    fixture = TestBed.createComponent(Saude);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    await esperar();
  };
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  describe('tudo certo', () => {
    beforeEach(() => montar(() => Promise.resolve(SAUDAVEL)));

    it('mostra a situação, "nenhum alerta", o gateway e o número conectado', () => {
      const t = texto(raiz);
      expect(t).toContain('Tudo funcionando');
      expect(t).toContain('Nenhum alerta');
      expect(t).toContain('No ar');
      expect(t).toContain('Comercial');
      expect(t).toContain('Conectado');
      expect(t).toContain('Todas as filas estão vazias');
      expect(t).toContain('Mais 1 fila sem movimento');
    });

    it('mostra o backup, o espaço livre e o tamanho do banco', () => {
      const t = texto(raiz);
      expect(t).toContain('Em dia');
      expect(t).toContain('crmbrl-2026-10-31.dump (5 MB)');
      expect(t).toContain('60 GB de 100 GB');
      expect(t).toContain('300 MB');
    });
  });

  describe('com problemas', () => {
    beforeEach(() => montar(() => Promise.resolve(COM_PROBLEMAS)));

    it('lista os alertas com a dica do que fazer e o aviso de e-mail', () => {
      const t = texto(raiz);
      expect(t).toContain('Precisa de ação agora');
      expect(t).toContain('Número Comercial desconectado');
      expect(t).toContain('O que fazer: Abra Configurações > Canais e leia o QR de novo.');
      expect(t).toContain('avisado por e-mail');
      expect(t).toContain('Nenhum backup registrado');
    });

    it('destaca a fila travada, o canal com erro e o erro recente', () => {
      const t = texto(raiz);
      expect(t).toContain('webhooks.entregar');
      expect(t).toContain('travada');
      expect(t).toContain('25 min');
      expect(t).toContain('IMAP recusou o login');
      expect(t).toContain('Falha de teste');
      expect(t).toContain('1 erro em 24 h');
    });

    it('número caído aparece como desconectado, com o motivo e o caminho para reconectar', () => {
      const t = texto(raiz);
      expect(t).toContain('Desconectado');
      expect(t).toContain('Desconectado pelo celular');
      expect(raiz.querySelector('a[href="/configuracoes/canais"]')).not.toBeNull();
    });
  });

  it('sem SMTP, avisa que os alertas ficam só na tela', async () => {
    await montar(() => Promise.resolve({ ...SAUDAVEL, emailConfigurado: false }));
    expect(texto(raiz)).toContain('não está configurado');
  });

  it('erro na primeira consulta mostra o estado de erro e "Tentar de novo" refaz', async () => {
    let falhar = true;
    await montar(() => (falhar ? Promise.reject(new Error('x')) : Promise.resolve(SAUDAVEL)));
    expect(texto(raiz)).toContain('Não conseguimos carregar a saúde do sistema');
    falhar = false;
    (
      Array.from(raiz.querySelectorAll('button')).find(
        (b) => texto(b) === 'Tentar de novo',
      ) as HTMLElement
    ).click();
    await esperar();
    expect(texto(raiz)).toContain('Tudo funcionando');
  });

  it('"Atualizar agora" consulta de novo', async () => {
    await montar(() => Promise.resolve(SAUDAVEL));
    api.consultar.mockClear();
    (
      Array.from(raiz.querySelectorAll('button')).find((b) =>
        texto(b).startsWith('Atualizar agora'),
      ) as HTMLElement
    ).click();
    await esperar();
    expect(api.consultar).toHaveBeenCalledTimes(1);
  });

  it('atualiza sozinho no intervalo e mantém o painel se a atualização falhar', async () => {
    vi.useFakeTimers();
    let falhar = false;
    await montar(() => (falhar ? Promise.reject(new Error('x')) : Promise.resolve(SAUDAVEL)));
    expect(api.consultar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(INTERVALO_DE_ATUALIZACAO_MS);
    expect(api.consultar).toHaveBeenCalledTimes(2);
    falhar = true;
    await vi.advanceTimersByTimeAsync(INTERVALO_DE_ATUALIZACAO_MS);
    fixture.detectChanges();
    expect(api.consultar).toHaveBeenCalledTimes(3);
    expect(texto(raiz)).toContain('Tudo funcionando');
    expect(texto(raiz)).not.toContain('Não conseguimos carregar');
  });

  it('para de atualizar quando a tela é destruída', async () => {
    vi.useFakeTimers();
    await montar(() => Promise.resolve(SAUDAVEL));
    fixture.destroy();
    api.consultar.mockClear();
    await vi.advanceTimersByTimeAsync(INTERVALO_DE_ATUALIZACAO_MS * 3);
    expect(api.consultar).not.toHaveBeenCalled();
  });
});

describe('formatos da saúde', () => {
  it('bytes e tempo parado em português', () => {
    expect(formatarBytes(0)).toBe('0 B');
    expect(formatarBytes(1536)).toBe('1,5 KB');
    expect(formatarBytes(null)).toBe('—');
    expect(formatarParada(null)).toBe('—');
    expect(formatarParada(30)).toBe('30 s');
    expect(formatarParada(1500)).toBe('25 min');
    expect(formatarParada(7500)).toBe('2 h 5 min');
    expect(formatarParada(100_000)).toBe('1 d 3 h');
  });
});
