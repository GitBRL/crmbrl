import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { AvisosService } from '../../nucleo/avisos.service';
import { entrarComo, type PapelDeTeste } from '../../nucleo/sessao/sessao-de-teste';
import { BarraAcoesMassa, lerEtiquetas, resumoDoResultado } from './barra-acoes-massa';
import { EstadoQuadro } from './estado-quadro';
import { colunasDeTeste, ETAPAS, FUNIL_ID, funilDeTeste, negocioDeTeste } from './funis-de-teste';

const [NOVO, PROPOSTA] = ETAPAS;

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('resumoDoResultado', () => {
  it('diz quantos negócios foram atualizados', () => {
    expect(resumoDoResultado({ total: 1, sucesso: 1 })).toBe('1 negócio atualizado.');
    expect(resumoDoResultado({ total: 14, sucesso: 14 })).toBe('14 negócios atualizados.');
    expect(resumoDoResultado({ total: 14, sucesso: 12 })).toBe('12 de 14 negócios atualizados.');
    expect(resumoDoResultado({ total: 3, sucesso: 0 })).toBe('Nenhum negócio foi atualizado (3).');
  });
});

describe('lerEtiquetas', () => {
  it('separa por vírgula, apara e não repete (sem diferenciar caixa)', () => {
    expect(lerEtiquetas(' VIP, vip ,Quente,, ')).toEqual(['VIP', 'Quente']);
    expect(lerEtiquetas('')).toEqual([]);
  });
});

describe('BarraAcoesMassa', () => {
  let http: HttpTestingController;
  let estado: EstadoQuadro;
  let fixture: ComponentFixture<BarraAcoesMassa>;
  let raiz: HTMLElement;

  function montar(papel: PapelDeTeste = 'LIDER_COMERCIAL', marcados = ['a', 'b']): void {
    entrarComo(papel);
    estado = TestBed.inject(EstadoQuadro);
    estado.area.set('COMERCIAL');
    estado.funis.set([funilDeTeste()]);
    estado.funilId.set(FUNIL_ID);
    estado.colunas.set(
      colunasDeTeste({
        novo: [negocioDeTeste('a', NOVO), negocioDeTeste('b', NOVO)],
        proposta: [negocioDeTeste('c', PROPOSTA)],
      }),
    );
    estado.entrarNaSelecao();
    marcados.forEach((id) => estado.alternarSelecao(id));
    fixture = TestBed.createComponent(BarraAcoesMassa);
    raiz = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  const botao = (texto: string) =>
    [...raiz.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.replace(/\s+/g, ' ').trim() === texto,
    )!;

  /** O quadro recarregado depois da ação (A e B saem de Novo). */
  async function responderRecarga() {
    await microtarefas();
    http
      .expectOne((req) => req.url === `/api/v1/funis/${FUNIL_ID}/quadro`)
      .flush({
        funilId: FUNIL_ID,
        ativo: true,
        colunas: colunasDeTeste({ proposta: [negocioDeTeste('c', PROPOSTA)] }),
      });
    await microtarefas();
    http
      .match((req) => req.url === '/api/v1/atividades')
      .forEach((p) => p.flush({ itens: [], total: 0, pagina: 1, porPagina: 100 }));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EstadoQuadro, provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.match(() => true);
    http.verify();
  });

  it('anuncia a contagem e, sem seleção, deixa as ações indisponíveis com a dica', () => {
    montar('LIDER_COMERCIAL', []);
    expect(raiz.querySelector('.barra__contagem')?.textContent).toContain('Nenhum selecionado');
    const ganho = botao('Ganho');
    expect(ganho.disabled).toBe(true);
    expect(ganho.getAttribute('title')).toBe('Marque ao menos um negócio.');
    http.expectNone('/api/v1/negocios/em-massa');
  });

  it('R5.16 — acima de 500 marcados as ações ficam indisponíveis com a dica (a API recusaria tudo)', () => {
    montar('LIDER_COMERCIAL', []);
    estado.colunas.set(
      colunasDeTeste({
        novo: Array.from({ length: 501 }, (_, i) => negocioDeTeste(`n${i}`, NOVO)),
      }),
    );
    estado.selecao.set(new Set(Array.from({ length: 501 }, (_, i) => `n${i}`)));
    fixture.detectChanges();
    expect(botao('Ganho').disabled).toBe(true);
    expect(botao('Ganho').getAttribute('title')).toContain('até 500 negócios');
    expect(raiz.querySelector('.barra__dica')?.textContent).toContain('501 marcados');
    http.expectNone('/api/v1/negocios/em-massa');
  });

  it('Excluir fica desabilitado, com a dica visível, para quem não configura o funil', () => {
    montar('COMERCIAL');
    expect(botao('Excluir').disabled).toBe(true);
    expect(botao('Excluir').getAttribute('title')).toContain('Só quem configura');
    expect(raiz.querySelector('.barra__dica')?.textContent).toContain('Só quem configura');
    expect(botao('Ganho').disabled).toBe(false);
  });

  it('Enviar ao discador (3C+) não aparece para o membro', () => {
    montar('COMERCIAL');
    expect(botao('Enviar ao discador…')).toBeUndefined();
  });

  it('o líder vê Enviar ao discador e o modal recebe os negócios marcados', () => {
    montar('LIDER_COMERCIAL');
    expect(botao('Enviar ao discador…').disabled).toBe(false);
    botao('Enviar ao discador…').click();
    fixture.detectChanges();
    http.expectOne('/api/v1/tresc-plus/campanhas').flush([{ id: 1, nome: 'Prospecção Demo' }]);
    expect(raiz.querySelector('app-modal-discador dialog')).not.toBeNull();
    expect(raiz.querySelector('app-modal-discador')?.textContent).toContain('Envia 2 negócios');
  });

  it('Mover para etapa manda MOVER com a etapa escolhida', async () => {
    montar();
    fixture.componentInstance['moverPara']({ id: PROPOSTA.id, rotulo: PROPOSTA.nome });
    const pedido = http.expectOne('/api/v1/negocios/em-massa');
    expect(pedido.request.body).toEqual({
      negocioIds: ['a', 'b'],
      acao: 'MOVER',
      dados: { etapaId: PROPOSTA.id },
    });
    pedido.flush({ total: 2, sucesso: 2, falhas: [] });
    await responderRecarga();
    expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toBe('2 negócios atualizados.');
  });

  it('Mover para a etapa de perda pede o motivo antes de enviar', async () => {
    montar();
    const perdida = ETAPAS[3];
    fixture.componentInstance['moverPara']({ id: perdida.id, rotulo: perdida.nome });
    fixture.detectChanges();
    http.expectNone('/api/v1/negocios/em-massa');
    fixture.componentInstance['confirmarMotivo']('Sem orçamento');
    const pedido = http.expectOne('/api/v1/negocios/em-massa');
    expect(pedido.request.body).toEqual({
      negocioIds: ['a', 'b'],
      acao: 'MOVER',
      dados: { etapaId: perdida.id, motivoPerda: 'Sem orçamento' },
    });
    pedido.flush({ total: 2, sucesso: 2, falhas: [] });
    await responderRecarga();
  });

  it('Perdido pede o motivo (mesmo modal) e manda PERDER com ele', async () => {
    montar();
    botao('Perdido').click();
    fixture.detectChanges();
    http.expectNone('/api/v1/negocios/em-massa');
    fixture.componentInstance['confirmarMotivo']('Foi para o concorrente');
    const pedido = http.expectOne('/api/v1/negocios/em-massa');
    expect(pedido.request.body).toEqual({
      negocioIds: ['a', 'b'],
      acao: 'PERDER',
      dados: { motivoPerda: 'Foi para o concorrente' },
    });
    pedido.flush({ total: 2, sucesso: 2, falhas: [] });
    await responderRecarga();
  });

  it('Etiquetas: adicionar manda ETIQUETAR com a lista normalizada; sem etiqueta, erro no campo', async () => {
    montar();
    fixture.componentInstance['abrirEtiquetas']({ id: 'ETIQUETAR', rotulo: 'Adicionar' });
    fixture.componentInstance['confirmarEtiquetas']();
    http.expectNone('/api/v1/negocios/em-massa');
    expect(fixture.componentInstance['erroEtiquetas']()).toBe('Informe ao menos uma etiqueta.');
    fixture.componentInstance['textoEtiquetas'].set('VIP, vip, Quente');
    fixture.componentInstance['confirmarEtiquetas']();
    const pedido = http.expectOne('/api/v1/negocios/em-massa');
    expect(pedido.request.body).toEqual({
      negocioIds: ['a', 'b'],
      acao: 'ETIQUETAR',
      dados: { etiquetas: ['VIP', 'Quente'] },
    });
    pedido.flush({ total: 2, sucesso: 2, falhas: [] });
    await responderRecarga();
  });

  it('Criar atividade: exige o título; manda ATIVIDADE com tipo e título', async () => {
    montar();
    fixture.componentInstance['abrirAtividade']();
    fixture.componentInstance['confirmarAtividade']();
    http.expectNone('/api/v1/negocios/em-massa');
    fixture.componentInstance['tipoAtividade'].set('LIGACAO');
    fixture.componentInstance['tituloAtividade'].set('Ligar para confirmar');
    fixture.componentInstance['confirmarAtividade']();
    const pedido = http.expectOne('/api/v1/negocios/em-massa');
    expect(pedido.request.body).toEqual({
      negocioIds: ['a', 'b'],
      acao: 'ATIVIDADE',
      dados: { tipo: 'LIGACAO', titulo: 'Ligar para confirmar' },
    });
    pedido.flush({ total: 2, sucesso: 2, falhas: [] });
    await responderRecarga();
  });

  it('Trocar responsável: manda RESPONSAVEL com o id (ou null)', async () => {
    montar();
    fixture.componentInstance['trocarResponsavel']({
      id: 'u9',
      nome: 'Bia',
      detalhe: null,
      avatarUrl: null,
      voce: false,
    });
    const pedido = http.expectOne('/api/v1/negocios/em-massa');
    expect(pedido.request.body.dados).toEqual({ responsavelId: 'u9' });
    pedido.flush({ total: 2, sucesso: 2, falhas: [] });
    await responderRecarga();
  });

  it('erro 400 da API vira aviso de erro e a seleção continua', async () => {
    montar();
    botao('Ganho').click();
    http.expectOne('/api/v1/negocios/em-massa').flush(
      {
        statusCode: 400,
        erro: 'dados_invalidos',
        mensagem: 'Dados inválidos.',
        requisicaoId: 'r',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await microtarefas();
    expect(TestBed.inject(AvisosService).lista().at(-1)?.tipo).toBe('erro');
    expect(estado.selecionados().length).toBe(2);
  });
});
