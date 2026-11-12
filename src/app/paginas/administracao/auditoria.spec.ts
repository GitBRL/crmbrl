import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { Auditoria } from './auditoria';
import {
  ETAPA_PROPOSTA,
  ETAPA_QUALIFICACAO,
  eventoAuditoria,
  eventoDetalhe,
  FILTROS,
  FUNIS,
  microtarefas,
  PESSOAS,
} from './dados-de-teste';

const LISTA = '/api/v1/auditoria?limite=50';

describe('Auditoria (Administração)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Auditoria>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: Auditoria }], withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function elemento(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botao(texto: string): HTMLButtonElement {
    return Array.from(elemento().querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.textContent?.replace(/\s+/g, ' ').trim() === texto,
    )!;
  }

  async function criar(
    itens = [
      eventoAuditoria(),
      eventoAuditoria({
        id: '362',
        tipoAtor: 'WEBHOOK',
        usuarioId: null,
        atorDescricao: 'Disparos BRL — WhatsApp',
        acao: 'contato.criado',
        resumo: 'Contato “Tatiane” criado pelo webhook',
        quantidadeAlteracoes: 0,
      }),
    ],
    proximoCursor: string | null = 'cursor-2',
    papel: 'ADMIN' | 'C_LEVEL' = 'ADMIN',
  ) {
    entrarComo(papel);
    fixture = TestBed.createComponent(Auditoria);
    fixture.detectChanges();
    http.expectOne('/api/v1/auditoria/filtros').flush(FILTROS);
    http
      .expectOne('/api/v1/usuarios?porPagina=100')
      .flush({ itens: PESSOAS, total: 2, pagina: 1, porPagina: 100 });
    http.expectOne('/api/v1/funis').flush(FUNIS);
    http.expectOne(LISTA).flush({ itens, proximoCursor });
    await microtarefas();
    fixture.detectChanges();
  }

  function selecionar(rotulo: string, valor: string): void {
    const id = Array.from(elemento().querySelectorAll('label'))
      .find((label) => label.textContent?.trim().startsWith(rotulo))
      ?.getAttribute('for');
    const seletor = elemento().querySelector<HTMLSelectElement>(`#${id}`)!;
    const indice = Array.from(seletor.options).findIndex(
      (opcao) => opcao.textContent?.trim() === valor,
    );
    seletor.selectedIndex = indice;
    seletor.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('mostra tempo, ator, ação legível, resumo e quantos campos mudaram', async () => {
    await criar();
    const [mover, webhook] = Array.from(elemento().querySelectorAll('tbody tr.tabela__linha')).map(
      (linha) => linha.textContent?.replace(/\s+/g, ' ') ?? '',
    );
    expect(mover).toContain('há 5 min');
    expect(mover).toContain('Rafael Mendes');
    expect(mover).toContain('Negócio movido');
    expect(mover).toContain('moveu “Escola Horizonte” para Proposta');
    expect(mover).toContain('2');
    expect(webhook).toContain('Disparos BRL — WhatsApp');
    expect(webhook).toContain('Webhook');
    expect(webhook).toContain('Contato criado');
  });

  it('os filtros vão para a API e "Limpar filtros" volta ao começo', async () => {
    await criar();
    selecionar('Ação', 'Negócio movido');
    http.expectOne(`${LISTA}&acao=negocio.movido`).flush({ itens: [], proximoCursor: null });
    await microtarefas();
    selecionar('Pessoa', 'Pedro Santos (desligado)');
    http
      .expectOne(`${LISTA}&usuarioId=u-pedro&acao=negocio.movido`)
      .flush({ itens: [], proximoCursor: null });
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Nenhum evento com esses filtros');
    botao('Limpar filtros').click();
    fixture.detectChanges();
    http.expectOne(LISTA).flush({ itens: [eventoAuditoria()], proximoCursor: null });
    await microtarefas();
  });

  it('o período vira de/até em ISO (até exclusivo) e recusa fim antes do início', async () => {
    await criar();
    const componente = fixture.componentInstance as unknown as {
      de: { set(v: string | null): void };
      ate: { set(v: string | null): void };
    };
    componente.de.set('2026-10-20');
    componente.ate.set('2026-10-19');
    fixture.detectChanges();
    expect(elemento().textContent).toContain(
      'A data final precisa ser igual ou depois da inicial.',
    );
    componente.ate.set('2026-10-20');
    fixture.detectChanges();
    const de = new Date(2026, 9, 20).toISOString();
    const ate = new Date(2026, 9, 21).toISOString();
    const pedido = http.expectOne((req) => req.url === '/api/v1/auditoria');
    expect(pedido.request.params.get('de')).toBe(de);
    expect(pedido.request.params.get('ate')).toBe(ate);
    pedido.flush({ itens: [], proximoCursor: null });
    await microtarefas();
  });

  it('"Carregar mais" usa o cursor e junta os eventos', async () => {
    await criar();
    expect(elemento().textContent).toContain('Mostrando 2 eventos · há mais');
    botao('Carregar mais').click();
    http.expectOne(`${LISTA}&cursor=cursor-2`).flush({
      itens: [eventoAuditoria({ id: '100', resumo: 'Mais antigo' })],
      proximoCursor: null,
    });
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().querySelectorAll('tbody tr.tabela__linha')).toHaveLength(3);
    expect(elemento().textContent).toContain('Mostrando 3 eventos');
    expect(botao('Carregar mais')).toBeUndefined();
  });

  it('o painel mostra o antes e depois, o ator e o id da requisição', async () => {
    await criar();
    fixture.componentRef.setInput('evento', '363');
    fixture.detectChanges();
    http.expectOne('/api/v1/auditoria/363').flush(eventoDetalhe());
    await microtarefas();
    fixture.detectChanges();
    const painel = elemento().querySelector('app-painel-lateral')!;
    const diff = painel.querySelector('table.diff')!;
    expect(diff.textContent).toContain('Etapa');
    expect(diff.querySelector('.diff__antes')?.textContent).toBe('Qualificação');
    expect(diff.querySelector('.diff__depois')?.textContent).toBe('Proposta');
    expect(diff.textContent).toContain('Valor');
    expect(painel.textContent).toContain('req-abc');
    expect(painel.textContent).toContain('"origem": "kanban"');
    expect(painel.querySelector('a[href^="/administracao/logs"]')?.getAttribute('href')).toBe(
      '/administracao/logs?requisicao=req-abc',
    );
  });

  it('no diff, ids viram nomes (etapas, pessoas e os { id, nome } do evento) e códigos viram texto', async () => {
    await criar();
    fixture.componentRef.setInput('evento', '363');
    fixture.detectChanges();
    const contato = '7c0a1b2c-3d4e-4f50-8a61-9b72c3d4e5f6';
    const desconhecido = '00000000-0000-4000-8000-000000000000';
    http.expectOne('/api/v1/auditoria/363').flush(
      eventoDetalhe({
        alteracoes: [
          { campo: 'etapaId', antes: ETAPA_QUALIFICACAO, depois: ETAPA_PROPOSTA },
          { campo: 'responsavelId', antes: null, depois: 'u-rafael-sem-uuid' },
          { campo: 'contatoId', antes: desconhecido, depois: contato },
          { campo: 'estrategia', antes: 'RESPONSAVEL_FIXO', depois: 'RODIZIO' },
        ],
        dados: { contato: { id: contato, nome: 'Tatiane Souza' } },
      }),
    );
    await microtarefas();
    fixture.detectChanges();
    const linhas = Array.from(elemento().querySelectorAll('table.diff tbody tr')).map((linha) => ({
      antes: linha.querySelector('.diff__antes'),
      depois: linha.querySelector('.diff__depois'),
    }));
    expect(linhas[0].antes?.textContent?.trim()).toBe('Qualificação');
    expect(linhas[0].depois?.textContent?.trim()).toBe('Proposta');
    expect(linhas[0].depois?.getAttribute('title')).toBe(ETAPA_PROPOSTA);
    expect(linhas[2].antes?.textContent?.trim()).toBe(desconhecido);
    expect(linhas[2].depois?.textContent?.trim()).toBe('Tatiane Souza');
    expect(linhas[3].depois?.textContent?.trim()).toBe('Rodízio do setor');
  });

  it('o negócio abre sobre o quadro do funil dele e "Ligado a" leva às telas', async () => {
    await criar();
    fixture.componentRef.setInput('evento', '363');
    fixture.detectChanges();
    const funil = FUNIS[0].id;
    const contato = '7c0a1b2c-3d4e-4f50-8a61-9b72c3d4e5f6';
    http.expectOne('/api/v1/auditoria/363').flush(
      eventoDetalhe({
        entidadeId: 'n1',
        relacionados: [
          { entidade: 'negocio', id: 'n1' },
          { entidade: 'contato', id: contato },
          { entidade: 'funil', id: funil },
        ],
      }),
    );
    await microtarefas();
    fixture.detectChanges();
    const links = Array.from(
      elemento().querySelectorAll<HTMLAnchorElement>('app-painel-lateral a.detalhe__link'),
    ).map((link) => `${link.textContent?.trim()} → ${link.getAttribute('href')}`);
    expect(links).toEqual([
      `Abrir o negócio → /funis/comercial/n1?funil=${funil}`,
      `Abrir o contato → /contatos/${contato}`,
      `Abrir o funil → /funis/comercial?funil=${funil}`,
    ]);
    const ligado = elemento().querySelector('.detalhe__relacionados')!.textContent ?? '';
    expect(ligado).toContain('Comercial');
  });

  it('evento que apagou o alvo não oferece abrir o que já não existe', async () => {
    await criar();
    fixture.componentRef.setInput('evento', '363');
    fixture.detectChanges();
    http.expectOne('/api/v1/auditoria/363').flush(
      eventoDetalhe({
        acao: 'webhook_entrada.excluido',
        entidade: 'webhook_entrada',
        entidadeId: 'we1',
        alteracoes: [],
        relacionados: [{ entidade: 'webhook_entrada', id: 'we1' }],
      }),
    );
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().querySelector('app-painel-lateral a.detalhe__link')).toBeNull();
    expect(elemento().querySelector('.detalhe__relacionados')?.textContent).toContain('we1');
  });

  it('C-level não vê o atalho para os logs técnicos', async () => {
    await criar(undefined, null, 'C_LEVEL');
    fixture.componentRef.setInput('evento', '363');
    fixture.detectChanges();
    http.expectOne('/api/v1/auditoria/363').flush(eventoDetalhe());
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().querySelector('a[href^="/administracao/logs"]')).toBeNull();
  });

  it('chega filtrada pela requisição (vindo dos logs) e o filtro sai com "Tirar"', async () => {
    entrarComo('ADMIN');
    fixture = TestBed.createComponent(Auditoria);
    fixture.componentRef.setInput('requisicao', 'req-xyz');
    fixture.detectChanges();
    http.expectOne('/api/v1/auditoria/filtros').flush(FILTROS);
    http
      .expectOne('/api/v1/usuarios?porPagina=100')
      .flush({ itens: [], total: 0, pagina: 1, porPagina: 100 });
    http.expectOne('/api/v1/funis').flush([]);
    http.expectOne(`${LISTA}&requisicaoId=req-xyz`).flush({ itens: [], proximoCursor: null });
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Só a requisição req-xyz');
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    botao('Tirar').click();
    fixture.detectChanges();
    http.expectOne(LISTA).flush({ itens: [], proximoCursor: null });
    await microtarefas();
  });

  it('abrir uma linha põe o evento na URL', async () => {
    await criar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    elemento().querySelector<HTMLButtonElement>('tbody .tabela__abrir')!.click();
    expect(navegar).toHaveBeenCalledWith([], {
      queryParams: { evento: '363' },
      queryParamsHandling: 'merge',
    });
  });
});
