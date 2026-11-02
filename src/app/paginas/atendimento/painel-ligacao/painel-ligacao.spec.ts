import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfirmacaoService } from '../../../nucleo/confirmacao.service';
import type {
  GravacaoDaLigacao,
  ResumoDaLigacao,
  TranscricaoCompleta,
  TranscricaoDaLigacao,
} from '../../../nucleo/ligacoes/gravacao.tipos';
import { ligacaoDeTeste } from '../../../nucleo/ligacoes/ligacoes-de-teste';
import { entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import { assentar, texto } from '../dados-de-teste';
import { PainelLigacao } from './painel-ligacao';

interface Estados {
  gravacao: GravacaoDaLigacao | null;
  transcricao: TranscricaoDaLigacao | null;
  resumo: ResumoDaLigacao | null;
}

function estados(extra: Partial<Estados> = {}): Estados {
  return {
    gravacao: {
      situacao: 'pronta',
      erro: null,
      duracaoSegundos: 70,
      disponivel: true,
      removidaEm: null,
      podeBaixar: false,
    },
    transcricao: { situacao: 'pronta', erro: null, processadaEm: '2026-11-02T12:00:00.000Z' },
    resumo: {
      situacao: 'pronto',
      erro: null,
      processadoEm: '2026-11-02T12:00:10.000Z',
      conteudo: {
        assunto: 'Proposta comercial',
        pontosPrincipais: ['Cliente quer a proposta'],
        combinados: ['Enviar por e-mail'],
        proximosPassos: ['Ligar na sexta'],
        sentimento: 'positivo',
        sentimentoMotivo: 'Cliente animado',
        modelo: 'claude-sonnet-5-5',
        sugestoes: [
          {
            id: 'sug-1',
            titulo: 'Ligar na sexta',
            descricao: 'Retomar a proposta',
            tipo: 'LIGACAO',
            prazoEmDias: 3,
            atividadeId: null,
            descartadaEm: null,
          },
        ],
      },
    },
    ...extra,
  };
}

const TRANSCRICAO: TranscricaoCompleta = {
  situacao: 'pronta',
  erro: null,
  modelo: 'base',
  duracaoSegundos: 70,
  trechos: [
    { falante: 'atendente', inicio: 0, fim: 4, texto: 'Bom dia, tudo bem?' },
    { falante: 'cliente', inicio: 5, fim: 9, texto: 'Quero a proposta.' },
  ],
};

describe('PainelLigacao', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  async function criar(e: Estados, papel: 'COMERCIAL' | 'ADMIN' = 'COMERCIAL') {
    entrarComo(papel);
    const fixture = TestBed.createComponent(PainelLigacao);
    fixture.componentRef.setInput('ligacaoId', 'lig-1');
    await fixture.whenStable();
    http.expectOne('/api/v1/ligacoes/lig-1').flush(
      ligacaoDeTeste({
        gravacao: e.gravacao ?? undefined,
        transcricao: e.transcricao ?? undefined,
        resumo: e.resumo ?? undefined,
        gravar: true,
      }),
    );
    await assentar();
    if (e.transcricao?.situacao === 'pronta' && !e.gravacao?.removidaEm) {
      http.expectOne('/api/v1/ligacoes/lig-1/transcricao').flush(TRANSCRICAO);
      await assentar();
    }
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  it('mostra player, resumo, sugestões e a transcrição com Atendente e Cliente', async () => {
    const { raiz } = await criar(estados());
    const audio = raiz.querySelector('audio')!;
    expect(audio.getAttribute('src')).toBe('/api/v1/ligacoes/lig-1/audio');
    expect(texto(raiz)).toContain('Proposta comercial');
    expect(texto(raiz)).toContain('Positivo');
    expect(texto(raiz)).toContain('Ligar na sexta');
    const trechos = Array.from(raiz.querySelectorAll('.trecho'));
    expect(trechos).toHaveLength(2);
    expect(texto(trechos[0])).toContain('Atendente');
    expect(texto(trechos[1])).toContain('Cliente');
    expect(raiz.querySelector('.painel__baixar')).toBeNull();
  });

  it('baixar só aparece para quem pode', async () => {
    const base = estados();
    const { raiz } = await criar({
      ...base,
      gravacao: { ...base.gravacao!, podeBaixar: true },
    });
    expect(raiz.querySelector('.painel__baixar')?.getAttribute('href')).toContain('/audio/baixar');
  });

  it('a busca filtra os trechos e destaca o termo', async () => {
    const { fixture, raiz } = await criar(estados());
    const campo = raiz.querySelector('app-campo-busca input') as HTMLInputElement;
    campo.value = 'proposta';
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(raiz.querySelectorAll('.trecho')).toHaveLength(1);
    expect(raiz.querySelector('mark')?.textContent).toBe('proposta');
    expect(texto(raiz.querySelector('.painel__contagem'))).toBe('1 trecho encontrado');
  });

  it('clicar num trecho leva o player àquele ponto', async () => {
    const { fixture, raiz } = await criar(estados());
    const audio = raiz.querySelector('audio')!;
    vi.spyOn(audio, 'play').mockResolvedValue();
    (raiz.querySelectorAll('.trecho')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(audio.currentTime).toBe(5);
    expect(audio.play).toHaveBeenCalled();
  });

  it('estados de processamento: transcrição e resumo pendentes, sem trechos', async () => {
    const { raiz } = await criar(
      estados({
        transcricao: { situacao: 'processando', erro: null, processadaEm: null },
        resumo: { situacao: 'pendente', erro: null, processadoEm: null, conteudo: null },
      }),
    );
    expect(texto(raiz)).toContain('Transcrevendo a conversa');
    expect(texto(raiz)).toContain('O resumo vai começar');
    expect(raiz.querySelector('.trecho')).toBeNull();
    // Em processamento: sem botão Reprocessar.
    expect(texto(raiz)).not.toContain('Reprocessar');
  });

  it('Reprocessar (transcrição falhou): POST na fila e recarrega a ligação', async () => {
    const { fixture, raiz } = await criar(
      estados({
        transcricao: { situacao: 'falhou', erro: 'x', processadaEm: null },
        resumo: {
          situacao: 'desativado',
          erro: 'Sem transcrição.',
          processadoEm: null,
          conteudo: null,
        },
      }),
      'ADMIN',
    );
    const botao = Array.from(raiz.querySelectorAll('button')).find((b) =>
      texto(b).includes('Reprocessar'),
    )!;
    botao.click();
    const req = http.expectOne('/api/v1/ligacoes/lig-1/reprocessar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ etapa: 'completo' });
    req.flush({ aceita: true }, { status: 202, statusText: 'Accepted' });
    await assentar();
    const base = estados({
      transcricao: { situacao: 'pendente', erro: null, processadaEm: null },
    });
    http
      .expectOne('/api/v1/ligacoes/lig-1')
      .flush(
        ligacaoDeTeste({ gravacao: base.gravacao!, transcricao: base.transcricao!, gravar: true }),
      );
    await assentar();
    fixture.detectChanges();
    expect(texto(raiz)).toContain('Na fila para transcrever');
  });

  it('Criar pede confirmação e só então confirma a sugestão na API', async () => {
    const { fixture, raiz } = await criar(estados());
    const confirmacao = TestBed.inject(ConfirmacaoService);
    const botao = Array.from(raiz.querySelectorAll('.sugestao button')).find((b) =>
      texto(b).includes('Criar'),
    ) as HTMLButtonElement;
    botao.click();
    await fixture.whenStable();
    const aberta = confirmacao.aberta()!;
    expect(aberta.pedido.confirmar).toBe('Criar atividade');
    http.expectNone('/api/v1/ligacoes/lig-1/resumo/sugestoes/sug-1/confirmar');
    const resposta = aberta.pedido.executar!();
    const req = http.expectOne('/api/v1/ligacoes/lig-1/resumo/sugestoes/sug-1/confirmar');
    expect(req.request.method).toBe('POST');
    req.flush({ sugestaoId: 'sug-1', atividadeId: 'a1', resumo: estados().resumo });
    await resposta;
    aberta.responder(true);
    await assentar();
    // Recarrega a ligação: a sugestão volta com a atividade criada.
    const e = estados();
    const conteudo = e.resumo!.conteudo!;
    const comAtividade: ResumoDaLigacao = {
      ...e.resumo!,
      conteudo: { ...conteudo, sugestoes: [{ ...conteudo.sugestoes[0]!, atividadeId: 'a1' }] },
    };
    http.expectOne('/api/v1/ligacoes/lig-1').flush(
      ligacaoDeTeste({
        gravacao: e.gravacao!,
        transcricao: e.transcricao!,
        resumo: comAtividade,
        gravar: true,
      }),
    );
    await assentar();
    http.expectOne('/api/v1/ligacoes/lig-1/transcricao').flush(TRANSCRICAO);
    await assentar();
    fixture.detectChanges();
    expect(texto(raiz.querySelector('.sugestao'))).toContain('Criada');
  });

  it('sem gravação (ligação que não gravou), mostra o aviso', async () => {
    const { raiz } = await criar({ gravacao: null, transcricao: null, resumo: null });
    expect(texto(raiz)).toContain('não tem gravação');
  });

  it('gravação apagada pelo prazo de guarda: sem player e com o resumo', async () => {
    const base = estados();
    const { raiz } = await criar({
      ...base,
      gravacao: { ...base.gravacao!, disponivel: false, removidaEm: '2027-11-02T00:00:00.000Z' },
      transcricao: { situacao: 'desativada', erro: null, processadaEm: null },
    });
    expect(raiz.querySelector('audio')).toBeNull();
    expect(texto(raiz)).toContain('prazo de guarda');
    expect(texto(raiz)).toContain('Proposta comercial');
  });
});
