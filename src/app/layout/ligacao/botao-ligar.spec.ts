import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { LigacaoService } from '../../nucleo/ligacoes/ligacao.service';
import { LigacoesApi } from '../../nucleo/ligacoes/ligacoes.api';
import type { PermissaoDeLigacao } from '../../nucleo/ligacoes/ligacoes.tipos';
import { BotaoLigar, type ContatoParaLigar } from './botao-ligar';
import { cursoDeTeste, ligacaoServiceFalso } from './ligacoes-stub';

const CONTATO: ContatoParaLigar = { id: 'ct-1', nome: 'Maria Oficial', telefone: '5511999990001' };

function permissao(extra: Partial<PermissaoDeLigacao> = {}): PermissaoDeLigacao {
  return {
    contatoId: 'ct-1',
    canalId: 'canal-1',
    situacao: 'CONCEDIDA',
    tipo: 'TEMPORARIA',
    validaAte: '2026-11-09T15:00:00.000Z',
    podeLigar: true,
    pedido: {
      pode: true,
      motivo: null,
      liberaEm: null,
      usoNas24h: 0,
      maximo24h: 1,
      usoNos7d: 0,
      maximo7d: 2,
    },
    ultimoPedidoEm: null,
    respondidaEm: null,
    semRespostaSeguidas: 0,
    janelaAberta: true,
    temTemplateDePermissao: true,
    consultadaEm: null,
    limiteDeLigacoes: null,
    ...extra,
  };
}

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('BotaoLigar', () => {
  let falso: ReturnType<typeof ligacaoServiceFalso>;
  let api: { permissao: ReturnType<typeof vi.fn>; pedirPermissao: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    falso = ligacaoServiceFalso();
    falso.canais.set([{ id: 'canal-1', nome: 'WhatsApp Oficial', botaoVisivel: true }]);
    api = {
      permissao: vi.fn(() => Promise.resolve(permissao())),
      pedirPermissao: vi.fn(() =>
        Promise.resolve(permissao({ situacao: 'PEDIDA', podeLigar: false })),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LigacaoService, useValue: falso },
        { provide: LigacoesApi, useValue: api },
      ],
    });
  });

  function criar(entradas: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(BotaoLigar);
    fixture.componentRef.setInput('contato', CONTATO);
    for (const [chave, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(chave, valor);
    }
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const botao = () => raiz.querySelector<HTMLButtonElement>('.ligar button');
    return { fixture, raiz, botao };
  }

  it('sem canal com ligações (ou canal da conversa fora da lista), o botão não existe', () => {
    falso.canais.set([]);
    expect(criar().raiz.querySelector('.ligar')).toBeNull();
    falso.canais.set([{ id: 'outro', nome: 'Outro', botaoVisivel: true }]);
    const { raiz } = criar({ canalId: 'canal-1' });
    expect(raiz.querySelector('.ligar')).toBeNull();
  });

  it('quem não usa o Atendimento (Marketing) não vê o botão', () => {
    falso.usaAtendimento.set(false);
    expect(criar().raiz.querySelector('.ligar')).toBeNull();
  });

  it('com permissão: confere na Meta e liga, levando a atividade e a conversa', async () => {
    const { botao, fixture } = criar({ atividadeId: 'at-1', conversaId: 'conv-1' });
    botao()!.click();
    await microtarefas();
    expect(api.permissao).toHaveBeenCalledWith('ct-1', 'canal-1', true);
    expect(falso.ligar).toHaveBeenCalledWith(
      expect.objectContaining({ canalId: 'canal-1', atividadeId: 'at-1', conversaId: 'conv-1' }),
    );
    fixture.detectChanges();
  });

  it('mostra o estado da permissão ao lado (verPermissao) e atualiza quando o cliente responde', async () => {
    const { fixture, raiz } = criar({ verPermissao: true });
    TestBed.tick();
    await microtarefas();
    fixture.detectChanges();
    expect(raiz.querySelector('.ligar__estado')?.textContent).toContain('permitiu ligações até');
    expect(api.permissao).toHaveBeenCalledWith('ct-1', 'canal-1', false);
  });

  it('sem permissão: não liga e abre a janela com os limites e o botão de pedir', async () => {
    api.permissao.mockResolvedValue(
      permissao({ situacao: 'NENHUMA', podeLigar: false, tipo: null, validaAte: null }),
    );
    const { fixture, botao } = criar();
    botao()!.click();
    await microtarefas();
    fixture.detectChanges();
    expect(falso.ligar).not.toHaveBeenCalled();
    const dialogo =
      document.querySelector('app-modal') ?? fixture.nativeElement.querySelector('app-modal');
    const texto = dialogo?.textContent ?? '';
    expect(texto).toContain('Sem permissão para ligar');
    expect(texto).toContain('restam 1 pedido hoje');
    expect(texto).toContain('Pedir permissão para ligar');
  });

  it('pedir permissão manda o pedido com o texto e avisa', async () => {
    api.permissao.mockResolvedValue(permissao({ situacao: 'NENHUMA', podeLigar: false }));
    const { fixture, botao } = criar();
    botao()!.click();
    await microtarefas();
    fixture.detectChanges();
    const pedir = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).find((b) => b.textContent?.includes('Pedir permissão para ligar'))!;
    pedir.click();
    await microtarefas();
    expect(api.pedirPermissao).toHaveBeenCalledWith({ contatoId: 'ct-1', canalId: 'canal-1' });
    expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toContain('Pedido enviado');
  });

  it('pedido barrado pelo limite de 24 h: explica quando poderá pedir de novo e não oferece o botão', async () => {
    api.permissao.mockResolvedValue(
      permissao({
        situacao: 'PEDIDA',
        podeLigar: false,
        pedido: {
          pode: false,
          motivo: 'limite_24h',
          liberaEm: '2026-11-03T12:00:00.000Z',
          usoNas24h: 1,
          maximo24h: 1,
          usoNos7d: 1,
          maximo7d: 2,
        },
      }),
    );
    const { fixture, botao } = criar();
    botao()!.click();
    await microtarefas();
    fixture.detectChanges();
    const texto =
      (fixture.nativeElement as HTMLElement).querySelector('app-modal')?.textContent ?? '';
    expect(texto).toContain('Aguardando o cliente');
    expect(texto).toContain('últimas 24 horas');
    expect(texto).not.toContain('Pedir permissão para ligar');
  });

  it('a API recusa por falta de permissão na hora de ligar: abre a janela de pedido', async () => {
    falso.ligar.mockResolvedValue({
      ok: false,
      mensagem: 'Sem permissão.',
      motivo: 'sem_permissao',
    } as never);
    const { fixture, botao } = criar();
    botao()!.click();
    await microtarefas();
    fixture.detectChanges();
    expect(api.permissao.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect((fixture.nativeElement as HTMLElement).querySelector('app-modal')).not.toBeNull();
  });

  it('contato sem telefone ou já em ligação: desabilitado', () => {
    const { fixture, botao } = criar({ contato: { ...CONTATO, telefone: null } });
    expect(botao()!.disabled).toBe(true);
    falso.emCurso.set(cursoDeTeste());
    fixture.componentRef.setInput('contato', CONTATO);
    fixture.detectChanges();
    expect(botao()!.disabled).toBe(true);
  });

  it('vários números com ligações e nenhum informado: pergunta por qual ligar', async () => {
    falso.canais.set([
      { id: 'canal-1', nome: 'Vendas', botaoVisivel: true },
      { id: 'canal-2', nome: 'Suporte', botaoVisivel: true },
    ]);
    const { fixture, botao } = criar();
    botao()!.click();
    await microtarefas();
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-modal')?.textContent,
    ).toContain('Escolha por qual deles ligar');
    expect(api.permissao).not.toHaveBeenCalled();
  });
});
