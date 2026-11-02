import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { InstalacaoService } from '../../nucleo/pwa/instalacao.service';
import type { PreferenciasPush } from '../../nucleo/pwa/push.api';
import { PushService, type SituacaoPush } from '../../nucleo/pwa/push.service';
import { CartaoPush } from './preferencias-push';

const TIPOS: PreferenciasPush = {
  conversa_atribuida: true,
  mencao: true,
  atividade_vencendo: true,
  sla_estourado: true,
  negocio_atribuido: true,
  parcela_atrasada: false,
};

describe('CartaoPush', () => {
  const situacao = signal<SituacaoPush>('desativado');
  const preferencias = signal<PreferenciasPush | null>(TIPOS);
  const push = {
    situacao,
    preferencias,
    ocupado: signal(false),
    carregar: vi.fn(),
    ativar: vi.fn(),
    desativar: vi.fn(),
    salvarPreferencias: vi.fn(),
    testar: vi.fn(),
  };
  const instalacao = {
    instalado: signal(false),
    podeInstalar: signal(false),
    plataforma: 'ios' as const,
    instalar: vi.fn(),
  };

  beforeEach(() => {
    situacao.set('desativado');
    preferencias.set(TIPOS);
    instalacao.instalado.set(false);
    instalacao.podeInstalar.set(false);
    for (const fn of [
      push.carregar,
      push.ativar,
      push.desativar,
      push.salvarPreferencias,
      push.testar,
    ]) {
      fn.mockReset().mockResolvedValue(undefined);
    }
    TestBed.configureTestingModule({
      providers: [
        { provide: PushService, useValue: push },
        { provide: InstalacaoService, useValue: instalacao },
      ],
    });
  });

  function criar() {
    const fixture = TestBed.createComponent(CartaoPush);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const botao = (texto: string) =>
      [...raiz.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        b.textContent?.includes(texto),
      );
    return { fixture, raiz, botao };
  }

  it('ao abrir só lê o estado: a permissão não é pedida sem clique', () => {
    criar();
    expect(push.carregar).toHaveBeenCalledOnce();
    expect(push.ativar).not.toHaveBeenCalled();
  });

  it('desativado: o clique em "Ativar avisos neste aparelho" ativa', () => {
    const { botao } = criar();
    botao('Ativar avisos neste aparelho')!.click();
    expect(push.ativar).toHaveBeenCalledOnce();
  });

  it('dica de instalação do iOS: Compartilhar e Tela de Início', () => {
    const { raiz } = criar();
    expect(raiz.querySelector('details')?.textContent).toContain('Adicionar à Tela de Início');
  });

  it('já instalado: diz que o app está instalado e esconde a dica', () => {
    instalacao.instalado.set(true);
    const { raiz } = criar();
    expect(raiz.textContent).toContain('O CRM está instalado neste aparelho');
    expect(raiz.querySelector('details')).toBeNull();
  });

  it('ativo: lista os seis tipos e salva a troca de um deles', () => {
    situacao.set('ativo');
    const { fixture, raiz } = criar();
    const caixas = raiz.querySelectorAll<HTMLInputElement>('.push__tipos input[type=checkbox]');
    expect(caixas).toHaveLength(6);
    expect([...caixas].map((c) => c.checked)).toEqual([true, true, true, true, true, false]);
    caixas[5].click();
    fixture.detectChanges();
    expect(push.salvarPreferencias).toHaveBeenCalledWith({ ...TIPOS, parcela_atrasada: true });
  });

  it('ativo: teste e desativar chamam o serviço', () => {
    situacao.set('ativo');
    const { botao } = criar();
    botao('aviso de teste')!.click();
    expect(push.testar).toHaveBeenCalledOnce();
    botao('Desativar neste aparelho')!.click();
    expect(push.desativar).toHaveBeenCalledOnce();
  });

  it.each([
    ['bloqueado', 'bloqueando os avisos'],
    ['nao-configurado', 'não foram configurados'],
    ['nao-suportado', 'não oferece avisos push'],
  ] as const)('%s: explica em português e não oferece o botão', (estado, trecho) => {
    situacao.set(estado);
    const { raiz, botao } = criar();
    expect(raiz.textContent).toContain(trecho);
    expect(botao('Ativar avisos neste aparelho')).toBeUndefined();
  });
});
