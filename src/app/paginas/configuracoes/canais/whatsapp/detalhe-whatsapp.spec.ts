import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AvisosService } from '../../../../nucleo/avisos.service';
import { ConfirmacaoService, type PedidoConfirmacao } from '../../../../nucleo/confirmacao.service';
import { entrarComo } from '../../../../nucleo/sessao/sessao-de-teste';
import { provideSocketFalso } from '../../../../nucleo/tempo-real/tempo-real-de-teste';
import { envios, falhaDaApi, microtarefas, numero } from '../dados-de-teste';
import { DetalheWhatsapp, INTERVALO_STATUS_SEM_TEMPO_REAL_MS } from './detalhe-whatsapp';

const BASE = '/api/v1/whatsapp/numeros/n-1';
const QR = 'data:image/png;base64,iVBORw0KGgo=';

describe('DetalheWhatsapp (conexão com QR ao vivo, R13)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<DetalheWhatsapp>;
  let falso: ReturnType<typeof provideSocketFalso>;
  let pedidos: PedidoConfirmacao[];

  beforeEach(() => {
    falso = provideSocketFalso();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        falso.providers,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    pedidos = [];
    vi.spyOn(TestBed.inject(ConfirmacaoService), 'confirmar').mockImplementation(async (pedido) => {
      pedidos.push(pedido);
      await pedido.executar?.();
      return true;
    });
    entrarComo('ADMIN');
  });
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  const raiz = () => fixture.nativeElement as HTMLElement;

  async function abrir(
    dados = numero(),
    estado: Record<string, unknown> | ReturnType<typeof falhaDaApi> = {
      numeroId: 'n-1',
      canalId: 'c-wa-1',
      status: dados.status,
      telefone: dados.telefone,
      motivo: null,
      qr: null,
      qrExpiraEm: null,
    },
    conectar?: string,
  ) {
    fixture = TestBed.createComponent(DetalheWhatsapp);
    fixture.componentRef.setInput('id', 'n-1');
    if (conectar) {
      fixture.componentRef.setInput('conectar', conectar);
    }
    fixture.detectChanges();
    http.expectOne('/api/v1/atendimento/filas').flush([]);
    http.expectOne(BASE).flush(dados);
    await microtarefas();
    http.expectOne(`${BASE}/envios?dias=14`).flush(envios());
    const status = http.expectOne(`${BASE}/status`);
    if ('corpo' in estado) {
      status.flush(estado.corpo as object, estado.opcoes as { status: number; statusText: string });
    } else {
      status.flush(estado);
    }
    await microtarefas();
    fixture.detectChanges();
  }

  function botao(texto: string): HTMLButtonElement {
    const alvo = Array.from(raiz().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(texto),
    );
    if (!alvo) {
      throw new Error(`Botão "${texto}" não encontrado`);
    }
    return alvo;
  }

  it('conectado: telefone em destaque, envios de hoje, aquecimento e gráfico', async () => {
    await abrir();
    expect(raiz().querySelector('h2')?.textContent).toContain('Comercial — principal');
    expect(raiz().textContent).toContain('Número conectado');
    expect(raiz().querySelector('.conectado__telefone')?.textContent).toContain(
      '+55 (11) 98888-7777',
    );
    expect(raiz().textContent).toContain('de 214 permitidos hoje');
    expect(raiz().textContent).toContain('dia 3 de 14');
    expect(raiz().textContent).toContain('Hoje o limite é de 214 envios.');
    expect(raiz().querySelectorAll('.aquecimento__dia')).toHaveLength(14);
    expect(raiz().querySelectorAll('.aquecimento__dia--feito')).toHaveLength(2);
    expect(raiz().querySelector('.aquecimento__dia--hoje')).not.toBeNull();
    expect(raiz().querySelectorAll('app-grafico-envios .grafico__coluna')).toHaveLength(3);
    expect(raiz().querySelector('app-grafico-envios table caption')?.textContent).toContain(
      'Envios por dia',
    );
  });

  it('desconectado: explica e conecta; o QR chega pelo evento e muda sozinho', async () => {
    await abrir(numero({ status: 'DESCONECTADO', telefone: null }));
    expect(raiz().textContent).toContain('Este número não está conectado');
    botao('Conectar com QR').click();
    const conectar = http.expectOne(`${BASE}/conectar`);
    expect(conectar.request.method).toBe('POST');
    conectar.flush({
      numeroId: 'n-1',
      canalId: 'c-wa-1',
      status: 'AGUARDANDO_QR',
      telefone: null,
      motivo: null,
      qr: null,
      qrExpiraEm: null,
    });
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Gerando o código…');
    expect(raiz().textContent).toContain('Aparelhos conectados');

    falso.ultimo().simularConexao();
    const expira = new Date(Date.now() + 20_000).toISOString();
    falso.ultimo().receber('whatsapp.conexao', {
      numeroId: 'n-1',
      canalId: 'c-wa-1',
      status: 'AGUARDANDO_QR',
      qr: QR,
      qrExpiraEm: expira,
    });
    fixture.detectChanges();
    const imagem = raiz().querySelector<HTMLImageElement>('.qr__imagem');
    expect(imagem?.getAttribute('src')).toBe(QR);
    expect(raiz().querySelector('.qr__tempo')?.textContent).toMatch(/O código muda em (19|20) s/);

    // Evento de outro número não mexe nesta tela.
    falso
      .ultimo()
      .receber('whatsapp.conexao', { numeroId: 'outro', canalId: 'x', status: 'CONECTADO' });
    fixture.detectChanges();
    expect(raiz().querySelector('.qr__imagem')).not.toBeNull();
  });

  it('o QR lido vira "Conectado" com aviso e a tela recarrega o número', async () => {
    const avisos = TestBed.inject(AvisosService);
    const sucesso = vi.spyOn(avisos, 'sucesso');
    await abrir(numero({ status: 'AGUARDANDO_QR', telefone: null }), {
      numeroId: 'n-1',
      canalId: 'c-wa-1',
      status: 'AGUARDANDO_QR',
      telefone: null,
      motivo: null,
      qr: QR,
      qrExpiraEm: new Date(Date.now() + 15_000).toISOString(),
    });
    expect(raiz().querySelector('.qr__imagem')).not.toBeNull();
    falso.ultimo().simularConexao();
    falso.ultimo().receber('whatsapp.conexao', {
      numeroId: 'n-1',
      canalId: 'c-wa-1',
      status: 'CONECTADO',
      telefone: '5511988887777',
    });
    fixture.detectChanges();
    expect(sucesso).toHaveBeenCalledWith(
      'WhatsApp conectado: +55 (11) 98888-7777.',
      expect.anything(),
    );
    http.expectOne(BASE).flush(numero());
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('.qr__imagem')).toBeNull();
    expect(raiz().textContent).toContain('Número conectado');
  });

  it('com ?conectar=1 (número recém-criado) a conexão começa sozinha', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await abrir(numero({ status: 'DESCONECTADO', telefone: null }), undefined, '1');
    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { conectar: null } }),
    );
    http.expectOne(`${BASE}/conectar`).flush({
      numeroId: 'n-1',
      canalId: 'c-wa-1',
      status: 'AGUARDANDO_QR',
      telefone: null,
      motivo: null,
      qr: QR,
      qrExpiraEm: null,
    });
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('.qr__imagem')?.getAttribute('src')).toBe(QR);
  });

  it('sem o tempo real, busca o status de tempos em tempos enquanto espera o QR', async () => {
    vi.useFakeTimers();
    await abrir(numero({ status: 'AGUARDANDO_QR', telefone: null }));
    await vi.advanceTimersByTimeAsync(INTERVALO_STATUS_SEM_TEMPO_REAL_MS);
    http.expectOne(`${BASE}/status`).flush({
      numeroId: 'n-1',
      canalId: 'c-wa-1',
      status: 'AGUARDANDO_QR',
      telefone: null,
      motivo: null,
      qr: QR,
      qrExpiraEm: null,
    });
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('.qr__imagem')).not.toBeNull();
    fixture.destroy();
  });

  it('o serviço do WhatsApp fora do ar aparece no cartão da conexão', async () => {
    await abrir(
      numero({ status: 'DESCONECTADO', telefone: null }),
      falhaDaApi(503, 'indisponivel', 'O gateway do WhatsApp não respondeu'),
    );
    expect(raiz().querySelector('.parado__gateway')?.textContent).toContain('não respondeu');
  });

  it('pausa com motivo, mostra a faixa e retoma', async () => {
    await abrir();
    const menu = raiz().querySelector<HTMLButtonElement>('app-menu-acoes button')!;
    expect(menu).not.toBeNull();
    (fixture.componentInstance as unknown as { agir(id: string): void }).agir('pausar');
    fixture.detectChanges();
    const motivo = document.querySelector<HTMLTextAreaElement>('#pausar-numero textarea')!;
    motivo.value = 'Troca de chip';
    motivo.dispatchEvent(new Event('input'));
    document.querySelector<HTMLFormElement>('#pausar-numero')!.dispatchEvent(new Event('submit'));
    const pausar = http.expectOne(`${BASE}/pausar`);
    expect(pausar.request.body).toEqual({ motivo: 'Troca de chip' });
    pausar.flush(
      numero({
        pausa: { pausadoEm: '2026-10-26T12:00:00Z', motivo: 'Troca de chip', automatica: false },
      }),
    );
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('.faixa')?.textContent).toContain('Envios pausados');
    botao('Retomar envios').click();
    http.expectOne(`${BASE}/retomar`).flush(numero());
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).not.toContain('Envios pausados.');
  });

  it('salva só o que mudou nos dados e confere a espera máxima ≥ mínima nos limites', async () => {
    await abrir();
    const nome = raiz().querySelector<HTMLInputElement>(
      'form[aria-label="Atendimento do número"] input',
    )!;
    nome.value = 'Vendas';
    nome.dispatchEvent(new Event('input'));
    botao('Salvar').click();
    const salvar = http.expectOne(BASE);
    expect(salvar.request.method).toBe('PATCH');
    expect(salvar.request.body).toEqual({ nome: 'Vendas' });
    salvar.flush(numero({ nome: 'Vendas' }));
    await microtarefas();
    fixture.detectChanges();

    const limites = raiz().querySelector('form[aria-label="Limites e proteções do número"]')!;
    const campos = limites.querySelectorAll<HTMLInputElement>('input[type=number]');
    // limite, aquecimento, mínima, máxima…
    campos[2].value = '10';
    campos[2].dispatchEvent(new Event('input'));
    campos[3].value = '5';
    campos[3].dispatchEvent(new Event('input'));
    botao('Salvar limites').click();
    fixture.detectChanges();
    http.expectNone(BASE);
    expect(limites.textContent).toContain('Use um valor maior ou igual à espera mínima.');

    campos[3].value = '20';
    campos[3].dispatchEvent(new Event('input'));
    botao('Salvar limites').click();
    const pedido = http.expectOne(BASE);
    expect(pedido.request.body).toMatchObject({
      intervaloMinimoSegundos: 10,
      intervaloMaximoSegundos: 20,
      limiteDiario: 1000,
      protecoes: { digitando: true, verificarNumero: true },
    });
    pedido.flush(numero({ intervaloMinimoSegundos: 10, intervaloMaximoSegundos: 20 }));
    await microtarefas();
  });

  it('desconectar e excluir pedem confirmação dizendo o que acontece', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await abrir();
    const tela = fixture.componentInstance as unknown as { agir(id: string): void };
    tela.agir('desconectar');
    await microtarefas(2);
    expect(pedidos[0].titulo).toBe('Desconectar “Comercial — principal”?');
    const desconectar = http.expectOne(`${BASE}/desconectar`);
    expect(desconectar.request.body).toEqual({ sair: false });
    desconectar.flush({
      numeroId: 'n-1',
      canalId: 'c-wa-1',
      status: 'DESCONECTADO',
      telefone: null,
      motivo: null,
      qr: null,
      qrExpiraEm: null,
    });
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Este número não está conectado');

    tela.agir('excluir');
    await microtarefas(2);
    expect(pedidos[1].perigo).toBe(true);
    expect(pedidos[1].exigirTexto).toBe('excluir');
    http.expectOne(BASE).flush(null, { status: 204, statusText: 'Sem conteúdo' });
    await microtarefas();
    expect(navegar).toHaveBeenCalledWith(['/configuracoes', 'canais']);
  });
});
