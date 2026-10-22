import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import type { Papel } from '../../nucleo/papeis';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { DetalheNegocio } from './detalhe-negocio';
import { ETAPAS, FUNIL_ID, funilDeTeste, negocioDeTeste } from './funis-de-teste';
import type { Negocio } from './funis.tipos';

const [NOVO, PROPOSTA, GANHO, PERDIDO] = ETAPAS;

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('DetalheNegocio', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<DetalheNegocio>;
  let raiz: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.match(() => true);
  });

  async function abrir(
    negocio: Negocio,
    papel: Papel = 'LIDER_COMERCIAL',
    relacionados: Negocio[] = [],
  ) {
    entrarComo(papel);
    fixture = TestBed.createComponent(DetalheNegocio);
    fixture.componentRef.setInput('area', 'comercial');
    fixture.componentRef.setInput('negocioId', negocio.id);
    raiz = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    http.expectOne(`/api/v1/negocios/${negocio.id}`).flush(negocio);
    await microtarefas();
    http.expectOne(`/api/v1/funis/${FUNIL_ID}`).flush(funilDeTeste());
    http
      .expectOne(
        (req) =>
          req.url === '/api/v1/negocios' && req.params.get('contatoId') === negocio.contato.id,
      )
      .flush({
        itens: [negocio, ...relacionados],
        total: 1 + relacionados.length,
        pagina: 1,
        porPagina: 100,
      });
    http
      .expectOne((req) => req.url === '/api/v1/usuarios')
      .flush({
        itens: [
          {
            id: 'u-juliana',
            nome: 'Juliana Alves',
            papel: 'COMERCIAL',
            rotuloPapel: 'Comercial',
            area: 'COMERCIAL',
            ativo: true,
            nivel: 'MEMBRO',
          },
          {
            id: 'u-mariana',
            nome: 'Mariana Costa',
            papel: 'MARKETING',
            rotuloPapel: 'Marketing',
            area: 'MARKETING',
            ativo: true,
            nivel: 'MEMBRO',
          },
        ],
        total: 2,
        pagina: 1,
        porPagina: 100,
      });
    await microtarefas();
    fixture.detectChanges();
    // A linha do tempo (aba padrão).
    for (const pedido of http.match((req) => req.url.endsWith('/linha-do-tempo'))) {
      pedido.flush({ itens: [], total: 0, pagina: 1, porPagina: 20 });
    }
    await microtarefas();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function seletor(rotulo: string): HTMLSelectElement {
    const campos = [...raiz.querySelectorAll('app-seletor')];
    const campo = campos.find((el) => el.querySelector('label')?.textContent?.includes(rotulo))!;
    return campo.querySelector('select')!;
  }

  function escolher(select: HTMLSelectElement, texto: string) {
    const opcao = [...select.options].find((item) => item.textContent?.includes(texto))!;
    select.value = opcao.value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('mostra o painel com título, etapa, contato, empresa e as etiquetas', async () => {
    await abrir(
      negocioDeTeste('n1', PROPOSTA, {
        titulo: 'Grupo Castro — piloto',
        empresa: { id: 'e1', nome: 'Grupo Castro' },
        contato: {
          id: 'c1',
          nome: 'Leandro Castro',
          email: 'l@castro.com',
          telefone: '5511987654321',
          etiquetas: ['Estratégico'],
        },
      }),
    );
    const titulo = raiz.querySelector('h2')!.textContent!;
    expect(titulo).toContain('Grupo Castro — piloto');
    expect(titulo).toContain('Proposta');
    expect(raiz.querySelector('a[href="/contatos/c1"]')?.textContent).toContain('Leandro Castro');
    expect(raiz.querySelector('a[href="/empresas/e1"]')?.textContent).toContain('Grupo Castro');
    expect(raiz.textContent).toContain('(11) 98765-4321');
    expect(raiz.textContent).toContain('Estratégico');
  });

  it('o responsável só oferece quem é da área (R5.9)', async () => {
    await abrir(negocioDeTeste('n1', NOVO));
    const opcoes = [...seletor('Responsável').options].map((opcao) => opcao.textContent!.trim());
    expect(opcoes.some((texto) => texto.includes('Juliana Alves'))).toBe(true);
    expect(opcoes.some((texto) => texto.includes('Mariana Costa'))).toBe(false);
  });

  it('mudar a etapa move o negócio e avisa', async () => {
    await abrir(negocioDeTeste('n1', NOVO));
    escolher(seletor('Etapa'), 'Proposta');
    const pedido = http.expectOne('/api/v1/negocios/n1/mover');
    expect(pedido.request.body).toEqual({ etapaId: 'proposta' });
    pedido.flush({ negocio: negocioDeTeste('n1', PROPOSTA), passagens: [] });
    await microtarefas();
    expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toBe(
      '“Negócio n1” movido para Proposta.',
    );
  });

  it('escolher a etapa de perda pede o motivo antes de mover', async () => {
    await abrir(negocioDeTeste('n1', NOVO));
    escolher(seletor('Etapa'), 'Perdido');
    expect(http.match('/api/v1/negocios/n1/mover')).toHaveLength(0);
    const modal = raiz.querySelector('app-motivo-perda dialog')!;
    expect(modal.hasAttribute('open')).toBe(true);
    const campo = modal.querySelector('textarea')!;
    campo.value = 'Sem orçamento este ano';
    campo.dispatchEvent(new Event('input'));
    modal.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    const pedido = http.expectOne('/api/v1/negocios/n1/mover');
    expect(pedido.request.body).toEqual({
      etapaId: 'perdido',
      motivoPerda: 'Sem orçamento este ano',
    });
    pedido.flush({ negocio: negocioDeTeste('n1', PERDIDO), passagens: [] });
  });

  it('negócio ganho: membro não muda a etapa (R5.5) e vê o motivo no menu', async () => {
    await abrir(negocioDeTeste('n1', GANHO), 'COMERCIAL');
    expect(seletor('Etapa').disabled).toBe(true);
    expect(raiz.textContent).toContain('só a liderança da área, C-level e Admin reabrem');
  });

  it('jornada: "Gerou" com link para o negócio do outro funil', async () => {
    const origem = negocioDeTeste('n1', GANHO);
    const gerado = negocioDeTeste('cs1', NOVO, {
      titulo: 'Padaria — boas-vindas',
      negocioOrigemId: 'n1',
      funil: { id: 'f-cs', nome: 'Customer Success', area: 'CS' },
    });
    await abrir(origem, 'C_LEVEL', [gerado]);
    const jornada = raiz.querySelector('.jornada')!;
    expect(jornada.textContent).toContain('Gerou');
    expect(jornada.textContent).toContain('Customer Success');
    expect(jornada.querySelector('a')?.getAttribute('href')).toBe('/funis/cs/cs1?funil=f-cs');
  });

  it('jornada: "Veio de" sem acesso ao funil de origem fica sem link', async () => {
    await abrir(negocioDeTeste('n1', NOVO, { negocioOrigemId: 'mkt-1' }));
    const jornada = raiz.querySelector('.jornada')!;
    expect(jornada.textContent).toContain('Veio de');
    expect(jornada.textContent).toContain('você não tem acesso');
    expect(jornada.querySelector('a')).toBeNull();
  });

  it('aba Dados salva só o que mudou', async () => {
    await abrir(negocioDeTeste('n1', NOVO, { valor: '1000.00' }));
    const aba = [...raiz.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((botao) =>
      botao.textContent?.includes('Dados'),
    )!;
    aba.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const valor = raiz.querySelector<HTMLInputElement>('input[type="number"]')!;
    valor.value = '2500';
    valor.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    raiz.querySelector('#form-negocio')!.dispatchEvent(new Event('submit', { cancelable: true }));
    const pedido = http.expectOne(
      (req) => req.method === 'PATCH' && req.url === '/api/v1/negocios/n1',
    );
    expect(pedido.request.body).toEqual({ valor: '2500.00' });
    pedido.flush(negocioDeTeste('n1', NOVO, { valor: '2500.00' }));
    await microtarefas();
    expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toBe('Alterações salvas.');
  });

  it('negócio que não existe (ou fora do alcance) mostra o aviso e volta ao quadro', async () => {
    entrarComo('COMERCIAL');
    fixture = TestBed.createComponent(DetalheNegocio);
    fixture.componentRef.setInput('area', 'comercial');
    fixture.componentRef.setInput('negocioId', 'nao-existe');
    raiz = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    http
      .expectOne('/api/v1/negocios/nao-existe')
      .flush(
        { statusCode: 404, erro: 'nao_encontrado', mensagem: 'Não encontrado.', requisicaoId: 'r' },
        { status: 404, statusText: 'Not Found' },
      );
    await microtarefas();
    fixture.detectChanges();
    expect(raiz.textContent).toContain('Não encontramos este negócio');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    [...raiz.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.includes('Voltar ao quadro'))!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(navegar).toHaveBeenCalledWith(['/funis', 'comercial'], {
      queryParamsHandling: 'preserve',
    });
  });
});
