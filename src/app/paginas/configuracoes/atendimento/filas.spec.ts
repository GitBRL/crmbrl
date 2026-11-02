import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AvisosService } from '../../../nucleo/avisos.service';
import { ConfirmacaoService, type PedidoConfirmacao } from '../../../nucleo/confirmacao.service';
import { entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import { microtarefas } from '../canais/dados-de-teste';
import { fila } from './dados-de-teste';
import { Filas } from './filas';

const LISTA = '/api/v1/atendimento/filas?incluirInativas=true';

describe('Filas e SLA (R12)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Filas>;
  let pedidos: PedidoConfirmacao[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    pedidos = [];
    vi.spyOn(TestBed.inject(ConfirmacaoService), 'confirmar').mockImplementation(async (pedido) => {
      pedidos.push(pedido);
      await pedido.executar?.();
      return true;
    });
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;

  async function criar(filas = [fila()], papel: Parameters<typeof entrarComo>[0] = 'ADMIN') {
    entrarComo(papel);
    fixture = TestBed.createComponent(Filas);
    fixture.detectChanges();
    http.expectOne(LISTA).flush(filas);
    await microtarefas();
    fixture.detectChanges();
  }

  it('mostra prazos, volume, canais, próximo da vez e quem recebe', async () => {
    await criar();
    const cartao = raiz().querySelector('.fila')!;
    expect(cartao.textContent).toContain('Comercial — WhatsApp');
    expect(cartao.textContent).toContain('Rodízio');
    expect(cartao.textContent).toContain('15 min');
    expect(cartao.textContent).toContain('1 dia');
    expect(cartao.textContent).toContain('1 sem responsável');
    expect(cartao.textContent).toContain('Comercial — principal');
    expect(cartao.querySelector('.fila__proximo')?.textContent).toContain('Juliana Alves');
    expect(cartao.querySelectorAll('.fila__pessoa')).toHaveLength(3);
    expect(cartao.textContent).toContain('O líder só recebe se estiver na lista da fila.');
  });

  it('desligar alguém vale na hora e o aviso tem “Desfazer”', async () => {
    await criar();
    const sucesso = vi.spyOn(TestBed.inject(AvisosService), 'sucesso');
    const lucas = raiz().querySelector<HTMLInputElement>('.fila__pessoa input[role=switch]')!;
    lucas.click();
    fixture.detectChanges();
    const pedido = http.expectOne('/api/v1/atendimento/filas/f-com/participantes/u-lucas');
    expect(pedido.request.method).toBe('PUT');
    expect(pedido.request.body).toEqual({ participa: false });
    const depois = fila();
    pedido.flush({
      ...depois,
      modoParticipantes: 'AREA',
      pessoas: depois.pessoas.map((p) =>
        p.id === 'u-lucas' ? { ...p, participa: false, motivo: 'RETIRADO' as const } : p,
      ),
    });
    await microtarefas();
    fixture.detectChanges();
    expect(sucesso).toHaveBeenCalledWith(
      'Lucas Pereira não recebe mais conversas de “Comercial — WhatsApp”.',
      expect.objectContaining({ acao: expect.objectContaining({ rotulo: 'Desfazer' }) }),
    );
    expect(raiz().textContent).toContain('Não recebe: foi tirada desta fila.');
  });

  it('cria uma fila com os prazos em horas e dias', async () => {
    await criar([]);
    expect(raiz().textContent).toContain('Nenhuma fila ainda');
    const nova = Array.from(raiz().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Nova fila'),
    )!;
    nova.click();
    fixture.detectChanges();
    const formulario = document.querySelector<HTMLFormElement>('app-formulario-fila form')!;
    const nome = formulario.querySelector<HTMLInputElement>('app-campo-texto input')!;
    nome.value = 'CS — Chat do site';
    nome.dispatchEvent(new Event('input'));
    const cs = Array.from(formulario.querySelectorAll<HTMLInputElement>('input[type=radio]')).find(
      (r) => r.closest('label')?.textContent?.includes('Customer Success'),
    )!;
    cs.click();
    const valores = formulario.querySelectorAll<HTMLInputElement>('input[type=number]');
    valores[0].value = '2';
    valores[0].dispatchEvent(new Event('input'));
    const unidades = formulario.querySelectorAll<HTMLSelectElement>('select');
    unidades[0].value = unidades[0].options[2].value; // horas
    unidades[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    formulario.dispatchEvent(new Event('submit'));
    const pedido = http.expectOne('/api/v1/atendimento/filas');
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({
      nome: 'CS — Chat do site',
      area: 'CS',
      descricao: null,
      estrategia: 'RODIZIO',
      slaPrimeiraRespostaMinutos: 120,
      slaResolucaoMinutos: 1440,
    });
    pedido.flush(fila({ id: 'f-cs', nome: 'CS — Chat do site', area: 'CS' }));
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('CS — Chat do site');
  });

  it('o líder cria só na área dele e não altera filas de outra área', async () => {
    await criar(
      [fila(), fila({ id: 'f-cs', nome: 'CS — Geral', area: 'CS', podeEditar: false })],
      'LIDER_COMERCIAL',
    );
    const cs = Array.from(raiz().querySelectorAll('.fila')).find((c) =>
      c.textContent?.includes('CS — Geral'),
    )!;
    expect(cs.querySelector('input[role=switch]')).toBeNull();
    expect(cs.textContent).toContain(
      'Só Admin, C-level e o líder de Customer Success alteram esta fila.',
    );
    (fixture.componentInstance as unknown as { abrirFormulario(f: null): void }).abrirFormulario(
      null,
    );
    fixture.detectChanges();
    const formulario = document.querySelector('app-formulario-fila form')!;
    expect(formulario.querySelectorAll('input[type=radio][name]').length).toBe(3); // só as estratégias
    expect(formulario.textContent).toContain('Comercial');
  });

  it('excluir pede confirmação e some da lista; com conversas em aberto fica bloqueado', async () => {
    await criar([
      fila({ conversasEmAberto: 0, conversasSemResponsavel: 0 }),
      fila({ id: 'f-2', nome: 'Com conversas' }),
    ]);
    const tela = fixture.componentInstance as unknown as {
      acoesDa(f: unknown): { id: string; desabilitado?: boolean; motivo?: string }[];
      agir(f: unknown, acao: string): void;
    };
    const bloqueada = tela.acoesDa(fila({ id: 'f-2' })).find((a) => a.id === 'excluir')!;
    expect(bloqueada.desabilitado).toBe(true);
    expect(bloqueada.motivo).toContain('3 conversas em aberto');
    tela.agir(fila({ conversasEmAberto: 0 }), 'excluir');
    await microtarefas(2);
    expect(pedidos[0].perigo).toBe(true);
    http
      .expectOne('/api/v1/atendimento/filas/f-com')
      .flush(null, { status: 204, statusText: 'ok' });
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelectorAll('.fila')).toHaveLength(1);
  });
});
