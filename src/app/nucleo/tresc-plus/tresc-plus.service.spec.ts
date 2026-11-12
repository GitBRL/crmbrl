import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { entrarComo } from '../sessao/sessao-de-teste';
import { provideSocketFalso } from '../tempo-real/tempo-real-de-teste';
import { TempoRealService } from '../tempo-real/tempo-real.service';
import { TrescPlusApi } from './tresc-plus.api';
import { agenteDeTeste } from './tresc-plus-de-teste';
import { TrescPlusService } from './tresc-plus.service';
import { AvisosService } from '../avisos.service';
import { formatarCronometro, segundosDesde } from './tresc-plus.textos';

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
}

describe('TrescPlusService', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let falso: ReturnType<typeof provideSocketFalso>;
  let servico: TrescPlusService;

  async function iniciar(vinculado = true): Promise<void> {
    api['vinculo'].mockResolvedValue(
      vinculado ? { vinculado: true, ramal: '1002' } : { vinculado: false },
    );
    api['agente'].mockResolvedValue(
      agenteDeTeste(vinculado ? {} : { vinculado: false, estado: 'desconectado', campanha: null }),
    );
    entrarComo('COMERCIAL');
    servico = TestBed.inject(TrescPlusService);
    servico.iniciar();
    TestBed.inject(TempoRealService);
    TestBed.tick();
    await microtarefas();
  }

  beforeEach(() => {
    falso = provideSocketFalso();
    api = {
      vinculo: vi.fn(),
      agente: vi.fn(),
      ligar: vi.fn(),
      desligar: vi.fn(() => Promise.resolve({})),
      entrar: vi.fn(),
      sair: vi.fn(() => Promise.resolve({})),
      entrarNaPausa: vi.fn(() => Promise.resolve({})),
      sairDaPausa: vi.fn(() => Promise.resolve({})),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        falso.providers,
        { provide: TrescPlusApi, useValue: api },
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('carrega o vínculo e o estado do agente ao entrar', async () => {
    await iniciar();
    expect(servico.vinculado()).toBe(true);
    expect(servico.agente()?.estado).toBe('manual');
    expect(servico.disponivel()).toBe(true);
    expect(servico.erro()).toBeNull();
  });

  it('sem vínculo mas com campanha padrão, o botão fica disponível', async () => {
    await iniciar(false);
    expect(servico.vinculado()).toBe(false);
    expect(servico.disponivel()).toBe(true);
  });

  it('guarda a falha da consulta', async () => {
    api['vinculo'].mockRejectedValue(new Error('x'));
    entrarComo('COMERCIAL');
    servico = TestBed.inject(TrescPlusService);
    servico.iniciar();
    TestBed.tick();
    await microtarefas();
    expect(servico.erro()).toBeTruthy();
    expect(servico.vinculo()).toBeNull();
  });

  it('sem vínculo, ligar leva ao Meu perfil e não chama a API', async () => {
    await iniciar(false);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    expect(await servico.ligar({ contatoId: 'c1' })).toBe(false);
    expect(api['ligar']).not.toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith(['/configuracoes/perfil'], { fragment: 'conectar-3c' });
  });

  it('ligar fora da campanha mostra "entrando" e registra a ligação em curso', async () => {
    await iniciar();
    servico['_agente'].set(agenteDeTeste({ estado: 'desconectado', campanha: null }));
    let resolver!: (valor: unknown) => void;
    api['ligar'].mockReturnValue(new Promise((r) => (resolver = r)));
    const promessa = servico.ligar({ contatoId: 'c1' }, 'Maria');
    expect(servico.entrando()).toBe(true);
    resolver({ id: 'l1', estado: 'CHAMANDO', contato: { id: 'c1', nome: 'Maria' } });
    expect(await promessa).toBe(true);
    expect(servico.entrando()).toBe(false);
    expect(servico.ligacao()).toMatchObject({ id: 'l1', estado: 'CHAMANDO', nome: 'Maria' });
    expect(servico.ocupado()).toBe(true);
  });

  it('erro ao ligar vira aviso e não deixa ligação na barra', async () => {
    await iniciar();
    api['ligar'].mockRejectedValue(new Error('x'));
    const aviso = vi.spyOn(TestBed.inject(AvisosService), 'erro');
    expect(await servico.ligar({ contatoId: 'c1' })).toBe(false);
    expect(aviso).toHaveBeenCalled();
    expect(servico.ligacao()).toBeNull();
    expect(servico.ligando()).toBe(false);
  });

  it('acompanha tresc.ligacao e abre a qualificação com tresc.qualificar', async () => {
    await iniciar();
    api['ligar'].mockResolvedValue({
      id: 'l1',
      estado: 'CHAMANDO',
      contato: { id: 'c1', nome: 'Maria' },
    });
    await servico.ligar({ contatoId: 'c1' });
    const socket = falso.ultimo();
    socket.simularConexao();
    socket.receber('tresc.ligacao', {
      ligacaoId: 'l1',
      estado: 'EM_ANDAMENTO',
      direcao: 'FEITA',
      telefone: '5511999990001',
      contatoId: 'c1',
      negocioId: null,
      campanhaId: 1,
      motivo: null,
      motivoTexto: null,
      atendidaEm: new Date().toISOString(),
      encerradaEm: null,
      duracaoSegundos: null,
      qualificacao: null,
    });
    expect(servico.ligacao()?.estado).toBe('EM_ANDAMENTO');
    socket.receber('tresc.ligacao', {
      ligacaoId: 'l1',
      estado: 'ENCERRADA',
      direcao: 'FEITA',
      telefone: '5511999990001',
      contatoId: 'c1',
      negocioId: null,
      campanhaId: 1,
      motivo: null,
      motivoTexto: null,
      atendidaEm: null,
      encerradaEm: new Date().toISOString(),
      duracaoSegundos: 12,
      qualificacao: null,
    });
    socket.receber('tresc.qualificar', { ligacaoId: 'l1', campanhaId: 1 });
    expect(servico.ligacao()?.duracaoSegundos).toBe(12);
    expect(servico.modalQualificacaoAberto()).toBe(true);
    expect(servico.qualificacaoPendente()).toEqual({ ligacaoId: 'l1', campanhaId: 1 });
    servico.qualificada();
    expect(servico.ligacao()).toBeNull();
    expect(servico.modalQualificacaoAberto()).toBe(false);
  });

  it('tresc.agente atualiza o estado e tresc.recebida abre o aviso', async () => {
    await iniciar();
    const socket = falso.ultimo();
    socket.simularConexao();
    socket.receber('tresc.agente', {
      estado: 'pausa',
      desde: new Date().toISOString(),
      campanha: { id: 1, nome: 'Prospecção Demo' },
      modo: 'manual',
      pausa: { id: 1, nome: 'Almoço' },
      erro: null,
    });
    expect(servico.agente()?.estado).toBe('pausa');
    expect(servico.agente()?.pausa?.nome).toBe('Almoço');
    socket.receber('tresc.recebida', {
      ligacaoId: 'l9',
      telefone: '5511955554321',
      contato: null,
      negocios: [],
      novoContato: true,
    });
    expect(servico.recebida()?.novoContato).toBe(true);
    servico.dispensarRecebida();
    expect(servico.recebida()).toBeNull();
  });

  it('o erro do tresc.agente vira aviso para a pessoa', async () => {
    await iniciar();
    const atencao = vi.spyOn(TestBed.inject(AvisosService), 'atencao');
    const socket = falso.ultimo();
    socket.simularConexao();
    socket.receber('tresc.agente', {
      estado: 'desconectado',
      desde: new Date().toISOString(),
      campanha: null,
      modo: null,
      pausa: null,
      erro: 'O 3C+ recusou a entrada na campanha.',
    });
    expect(atencao).toHaveBeenCalledWith('O 3C+ recusou a entrada na campanha.');
  });

  it('depois de reconectar, pergunta de novo ao servidor', async () => {
    await iniciar();
    const socket = falso.ultimo();
    socket.simularConexao();
    api['agente'].mockClear();
    socket.simularQueda();
    socket.simularConexao();
    await microtarefas();
    expect(api['agente']).toHaveBeenCalledWith(true);
  });

  it('desligar chama a API com a ligação em curso', async () => {
    await iniciar();
    api['ligar'].mockResolvedValue({ id: 'l1', estado: 'CHAMANDO', contato: null });
    await servico.ligar({ telefone: '5511999990001' });
    await servico.desligar();
    expect(api['desligar']).toHaveBeenCalledWith('l1');
  });
});

describe('textos do 3C+', () => {
  it('formata o cronômetro', () => {
    expect(formatarCronometro(5)).toBe('0:05');
    expect(formatarCronometro(125)).toBe('2:05');
    expect(formatarCronometro(3725)).toBe('1:02:05');
  });

  it('conta segundos desde um instante', () => {
    const agora = Date.parse('2026-11-12T10:00:30.000Z');
    expect(segundosDesde('2026-11-12T10:00:00.000Z', agora)).toBe(30);
    expect(segundosDesde(null, agora)).toBe(0);
    expect(segundosDesde('2026-11-12T11:00:00.000Z', agora)).toBe(0);
  });
});
