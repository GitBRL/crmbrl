import { computed, signal } from '@angular/core';

import type { FimDeLigacao, LigacaoEmCurso, Toque } from '../../nucleo/ligacoes/ligacao.service';
import type { CanalDeLigacao } from '../../nucleo/ligacoes/ligacoes.tipos';

/**
 * **Só para testes (specs).** O `LigacaoService` com signals que o teste mexe à mão e métodos
 * espiões, para testar o aviso de toque, a barra e o botão Ligar sem WebRTC.
 */
export function ligacaoServiceFalso() {
  const toques = signal<readonly Toque[]>([]);
  const emCurso = signal<LigacaoEmCurso | null>(null);
  const fim = signal<FimDeLigacao | null>(null);
  const canais = signal<readonly CanalDeLigacao[] | null>(null);
  const alerta = signal<string | null>(null);
  const mudo = signal(false);
  return {
    toques,
    emCurso,
    fim,
    canais,
    alerta,
    mudo,
    destaque: signal<string | null>(null),
    somDesligado: signal(false),
    segundos: signal(0),
    gravando: signal(false),
    anotacao: signal(''),
    situacaoDaAnotacao: signal<'salvando' | 'salva' | 'erro' | null>(null),
    microfones: signal([{ id: 'mic-1', rotulo: 'Microfone USB' }]),
    altoFalantes: signal([{ id: 'alto-1', rotulo: 'Fone' }]),
    microfoneId: signal<string | null>(null),
    altoFalanteId: signal<string | null>(null),
    suportaAltoFalante: true,
    encerradas: signal(0),
    usaAtendimento: signal(true),
    ocupado: computed(() => emCurso() !== null),
    atender: vi.fn(),
    dispensar: vi.fn(),
    encerrar: vi.fn(() => Promise.resolve()),
    alternarMudo: vi.fn(() => mudo.update((m) => !m)),
    anotar: vi.fn(),
    fecharFim: vi.fn(),
    limparDestaque: vi.fn(),
    abrirPorLink: vi.fn(() => Promise.resolve()),
    carregarCanais: vi.fn(() => Promise.resolve()),
    escolherMicrofone: vi.fn(() => Promise.resolve()),
    escolherAltoFalante: vi.fn(() => Promise.resolve()),
    ligar: vi.fn(() => Promise.resolve({ ok: true })),
  };
}

export function toqueDeTeste(extra: Partial<Toque> = {}): Toque {
  return {
    ligacaoId: 'lig-1',
    contato: {
      id: 'ct-1',
      nome: 'Maria Oficial',
      telefone: '5511999990001',
      empresa: 'Maria Ltda',
    },
    canal: { id: 'canal-1', nome: 'WhatsApp Oficial' },
    ofertaSdp: 'v=0\r\n',
    expiraEm: new Date(Date.now() + 10_000).toISOString(),
    conversaId: 'conv-1',
    ...extra,
  };
}

export function cursoDeTeste(extra: Partial<LigacaoEmCurso> = {}): LigacaoEmCurso {
  return {
    id: 'lig-1',
    direcao: 'RECEBIDA',
    contato: { id: 'ct-1', nome: 'Maria Oficial', telefone: '5511999990001', empresa: null },
    canal: { id: 'canal-1', nome: 'WhatsApp Oficial' },
    conversaId: 'conv-1',
    atividadeId: null,
    fase: 'em-andamento',
    inicioEm: Date.now(),
    semAudioNestaAba: false,
    ...extra,
  };
}
