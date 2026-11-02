import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConfirmacaoService } from '../../../nucleo/confirmacao.service';
import { entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import { falhaDaApi, microtarefas } from '../canais/dados-de-teste';
import { resposta, VARIAVEIS } from './dados-de-teste';
import { RespostasRapidas } from './respostas-rapidas';

describe('Respostas rápidas (R12)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<RespostasRapidas>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(ConfirmacaoService), 'confirmar').mockImplementation(async (pedido) => {
      await pedido.executar?.();
      return true;
    });
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;
  const modal = () => document.querySelector('app-formulario-resposta') as HTMLElement;

  async function criar(
    respostas = [
      resposta(),
      resposta({
        id: 'r-2',
        atalho: 'proposta',
        titulo: 'Envio de proposta',
        texto: 'Segue a proposta, {{contato.primeiroNome}}.',
        area: 'COMERCIAL',
      }),
      resposta({
        id: 'r-3',
        atalho: 'horario',
        titulo: 'Horário de atendimento',
        texto: 'Atendemos das 8h às 18h.',
        area: 'CS',
        ativa: false,
      }),
    ],
    papel: Parameters<typeof entrarComo>[0] = 'ADMIN',
  ) {
    entrarComo(papel);
    fixture = TestBed.createComponent(RespostasRapidas);
    fixture.detectChanges();
    const gerencia = papel === 'ADMIN' || papel === 'C_LEVEL' || papel.startsWith('LIDER');
    http
      .expectOne(
        gerencia
          ? '/api/v1/atendimento/respostas-rapidas?incluirInativas=true'
          : '/api/v1/atendimento/respostas-rapidas',
      )
      .flush(respostas);
    http.expectOne('/api/v1/atendimento/respostas-rapidas/variaveis').flush(VARIAVEIS);
    await microtarefas();
    fixture.detectChanges();
  }

  function linhas(): string[] {
    return Array.from(raiz().querySelectorAll('.resposta__atalho')).map((item) =>
      item.textContent!.trim(),
    );
  }

  it('lista e filtra por busca (sem acento), área e desativadas', async () => {
    await criar();
    expect(linhas()).toEqual(['/boas-vindas', '/proposta', '/horario']);
    const busca = raiz().querySelector<HTMLInputElement>('app-campo-busca input')!;
    busca.value = 'horário';
    busca.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(linhas()).toEqual(['/horario']);
    busca.value = '';
    busca.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const comercial = Array.from(
      raiz().querySelectorAll<HTMLButtonElement>('app-filtros-pilula button'),
    ).find((b) => b.textContent?.includes('Comercial'))!;
    comercial.click();
    fixture.detectChanges();
    expect(linhas()).toEqual(['/proposta']);
  });

  it('cria com a variável inserida no cursor, prévia com exemplos e atalho normalizado', async () => {
    await criar([]);
    expect(raiz().textContent).toContain('Nenhuma resposta rápida ainda');
    (fixture.componentInstance as unknown as { abrirFormulario(r: null): void }).abrirFormulario(
      null,
    );
    fixture.detectChanges();
    const [atalho, titulo] = Array.from(
      modal().querySelectorAll<HTMLInputElement>('app-campo-texto input'),
    );
    atalho.value = '/Ola';
    atalho.dispatchEvent(new Event('input'));
    titulo.value = 'Olá';
    titulo.dispatchEvent(new Event('input'));
    const texto = modal().querySelector<HTMLTextAreaElement>('textarea')!;
    texto.value = 'Oi, !';
    texto.dispatchEvent(new Event('input'));
    texto.setSelectionRange(4, 4);
    const variavel = Array.from(modal().querySelectorAll<HTMLButtonElement>('.variavel')).find(
      (b) => b.textContent?.includes('Primeiro nome do contato'),
    )!;
    variavel.click();
    fixture.detectChanges();
    expect(texto.value).toBe('Oi, {{contato.primeiroNome}}!');
    expect(modal().querySelector('.previa__bolha')?.textContent).toBe('Oi, Maria!');
    modal().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    const pedido = http.expectOne('/api/v1/atendimento/respostas-rapidas');
    expect(pedido.request.body).toEqual({
      atalho: 'ola',
      titulo: 'Olá',
      texto: 'Oi, {{contato.primeiroNome}}!',
      area: null,
      ativa: true,
    });
    pedido.flush(resposta({ id: 'r-9', atalho: 'ola', titulo: 'Olá' }));
    await microtarefas();
    fixture.detectChanges();
    expect(linhas()).toEqual(['/ola']);
  });

  it('variável desconhecida e atalho repetido aparecem no campo', async () => {
    await criar([]);
    (fixture.componentInstance as unknown as { abrirFormulario(r: null): void }).abrirFormulario(
      null,
    );
    fixture.detectChanges();
    const [atalho, titulo] = Array.from(
      modal().querySelectorAll<HTMLInputElement>('app-campo-texto input'),
    );
    atalho.value = 'boas-vindas';
    atalho.dispatchEvent(new Event('input'));
    titulo.value = 'Boas-vindas';
    titulo.dispatchEvent(new Event('input'));
    const texto = modal().querySelector<HTMLTextAreaElement>('textarea')!;
    texto.value = 'Oi {{contato.cpf}}';
    texto.dispatchEvent(new Event('input'));
    modal().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    http.expectNone('/api/v1/atendimento/respostas-rapidas');
    expect(modal().textContent).toContain('Variável que não existe: {{contato.cpf}}');

    texto.value = 'Oi {{contato.primeiroNome}}';
    texto.dispatchEvent(new Event('input'));
    modal().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    const falha = falhaDaApi(409, 'conflito', 'Já existe uma resposta com o atalho /boas-vindas');
    http.expectOne('/api/v1/atendimento/respostas-rapidas').flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(modal().textContent).toContain('Já existe uma resposta com o atalho /boas-vindas.');
  });

  it('o líder cria só para a área dele; as globais ficam só para leitura', async () => {
    await criar([resposta({ podeEditar: false })], 'LIDER_CS');
    const tela = fixture.componentInstance as unknown as {
      acoesDa(r: unknown): { id: string; desabilitado?: boolean; motivo?: string }[];
      abrirFormulario(r: null): void;
    };
    const editar = tela.acoesDa(resposta({ podeEditar: false }))[0];
    expect(editar.desabilitado).toBe(true);
    expect(editar.motivo).toBe('Só Admin e C-level alteram as respostas de todas as áreas.');
    tela.abrirFormulario(null);
    fixture.detectChanges();
    expect(modal().textContent).toContain('Vale para Customer Success.');
  });

  it('desativar tem “Desfazer”; excluir pede confirmação', async () => {
    await criar();
    const tela = fixture.componentInstance as unknown as { agir(r: unknown, acao: string): void };
    tela.agir(resposta(), 'desativar');
    const desativar = http.expectOne('/api/v1/atendimento/respostas-rapidas/r-1');
    expect(desativar.request.body).toEqual({ ativa: false });
    desativar.flush(resposta({ ativa: false }));
    await microtarefas();
    tela.agir(resposta(), 'excluir');
    await microtarefas(2);
    http
      .expectOne('/api/v1/atendimento/respostas-rapidas/r-1')
      .flush(null, { status: 204, statusText: 'ok' });
    await microtarefas();
    fixture.detectChanges();
    // Depois de salvar, a lista fica em ordem de atalho.
    expect(linhas()).toEqual(['/horario', '/proposta']);
  });
});
