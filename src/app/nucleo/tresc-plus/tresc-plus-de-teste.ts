import { signal } from '@angular/core';

import type { LigacaoEmCursoTresc } from './tresc-plus.service';
import type { EstadoDoAgenteApi, EventoTrescRecebida } from './tresc-plus.tipos';

/**
 * **Só para testes (specs).** O `TrescPlusService` com signals que o teste mexe à mão e
 * métodos espiões, para testar o painel, a barra, o botão e o modal sem rede.
 */
export function trescServiceFalso() {
  return {
    vinculo: signal<{ vinculado: boolean; [campo: string]: unknown } | null>({ vinculado: true }),
    agente: signal<EstadoDoAgenteApi | null>(null),
    ligacao: signal<LigacaoEmCursoTresc | null>(null),
    qualificacaoPendente: signal<{ ligacaoId: string; campanhaId: number | null } | null>(null),
    recebida: signal<EventoTrescRecebida | null>(null),
    carregando: signal(false),
    erro: signal<string | null>(null),
    entrando: signal(false),
    ligando: signal(false),
    agindo: signal(false),
    modalQualificacaoAberto: signal(false),
    vinculado: signal(true),
    disponivel: signal(true),
    reconectando: signal(false),
    ocupado: signal(false),
    carregar: vi.fn(() => Promise.resolve()),
    aposMudarVinculo: vi.fn(() => Promise.resolve()),
    pedirQualificacao: vi.fn(),
    fecharModalQualificacao: vi.fn(),
    qualificada: vi.fn(),
    dispensarRecebida: vi.fn(),
    irParaConectar: vi.fn(),
    ligar: vi.fn(() => Promise.resolve(true)),
    desligar: vi.fn(() => Promise.resolve()),
    entrarNaCampanha: vi.fn(() => Promise.resolve(true)),
    sairDaCampanha: vi.fn(() => Promise.resolve(true)),
    entrarNaPausa: vi.fn(() => Promise.resolve(true)),
    voltarDaPausa: vi.fn(() => Promise.resolve(true)),
  };
}

export function agenteDeTeste(extra: Partial<EstadoDoAgenteApi> = {}): EstadoDoAgenteApi {
  return {
    vinculado: true,
    estado: 'manual',
    desde: new Date(Date.now() - 65_000).toISOString(),
    campanha: { id: 1, nome: 'Prospecção Demo' },
    modo: 'manual',
    pausa: null,
    ligacaoId: null,
    campanhaPadrao: { id: 1, nome: 'Prospecção Demo' },
    ...extra,
  };
}
