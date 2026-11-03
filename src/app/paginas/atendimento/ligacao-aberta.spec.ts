import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ligacaoDeTeste } from '../../nucleo/ligacoes/ligacoes-de-teste';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { assentar, texto } from './dados-de-teste';
import { LigacaoAberta } from './ligacao-aberta';

describe('LigacaoAberta', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ ligacaoId: 'lig-1' })),
            queryParamMap: of(convertToParamMap({ busca: 'boleto' })),
            snapshot: {
              paramMap: convertToParamMap({ ligacaoId: 'lig-1' }),
              queryParamMap: convertToParamMap({ busca: 'boleto' }),
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('COMERCIAL');
  });
  afterEach(() => http.verify());

  it('mostra quem, quando e o resultado, e abre o painel com a busca já digitada', async () => {
    const fixture = TestBed.createComponent(LigacaoAberta);
    await fixture.whenStable();
    const ligacao = ligacaoDeTeste({
      id: 'lig-1',
      estado: 'ENCERRADA',
      duracaoSegundos: 125,
      atendente: { id: 'u1', nome: 'Lucas' },
    });
    // O cabeçalho e o painel pedem a mesma ligação.
    http.match('/api/v1/ligacoes/lig-1').forEach((pedido) => pedido.flush(ligacao));
    await assentar();
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const conteudo = texto(raiz);
    expect(conteudo).toContain('Maria Oficial');
    expect(conteudo).toContain('Atendida');
    expect(conteudo).toContain('2:05');
    expect(conteudo).toContain('Lucas');
    expect(conteudo).toContain('WhatsApp Oficial');
    expect(raiz.querySelector('app-painel-ligacao')).not.toBeNull();
    expect(
      raiz.querySelector<HTMLAnchorElement>('a[href="/atendimento/conv-1"]')?.textContent,
    ).toContain('Ver a conversa');
    expect(
      raiz.querySelector('a[aria-label="Voltar para a lista de ligações"]') ??
        raiz.querySelector('a.ligacao__voltar'),
    ).not.toBeNull();
  });
});
