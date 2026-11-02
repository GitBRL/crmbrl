import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { botaoComTexto, equipesDeTeste, erroDaApiFalso, microtarefas } from './dados-de-teste';
import { MinhaEquipe } from './minha-equipe';

describe('MinhaEquipe (árvore)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<MinhaEquipe>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;

  async function criar(corpo: object = equipesDeTeste()) {
    entrarComo('C_LEVEL', { usuario: { id: 'u-helena', nome: 'Helena Duarte' } });
    fixture = TestBed.createComponent(MinhaEquipe);
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Carregando a sua equipe');
    http.expectOne('/api/v1/usuarios/equipes').flush(corpo);
    await microtarefas();
    fixture.detectChanges();
  }

  it('desenha quem responde a quem como listas aninhadas', async () => {
    await criar();
    const raizDaArvore = raiz().querySelector('ul.arvore > li')!;
    expect(raizDaArvore.querySelector('.arvore__nome')?.textContent).toContain('Helena Duarte');
    expect(raizDaArvore.querySelector('.arvore__nome')?.textContent).toContain('você');
    const lideres = raizDaArvore.querySelectorAll(':scope > ul.arvore__filhos > li');
    expect(lideres).toHaveLength(2);
    const rafael = lideres[0];
    expect(rafael.querySelector('.arvore__papel')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Líder Comercial · 2 pessoas',
    );
    const membros = Array.from(
      rafael.querySelectorAll(':scope > ul.arvore__filhos .arvore__nome'),
    ).map((no) => no.textContent?.trim());
    expect(membros).toEqual(['Lucas Pereira', 'Juliana Alves']);
  });

  it('mostra o que cada pessoa tem em mãos, com as atrasadas em destaque', async () => {
    await criar();
    const lucas = Array.from(raiz().querySelectorAll<HTMLElement>('.arvore__no')).find((no) =>
      no.textContent?.includes('Lucas Pereira'),
    )!;
    expect(lucas.textContent).toContain('3 atividades pendentes');
    expect(lucas.querySelector('.arvore__atrasadas')?.textContent?.trim()).toBe('1 atrasada');
    expect(lucas.textContent?.replace(/\s+/g, ' ')).toContain('4 negócios abertos · R$ 43,2 mil');
    // O valor nunca quebra no meio ("R$ / 43,2 mil") quando a árvore fica estreita.
    expect(lucas.querySelector('.arvore__numeros .sem-quebra')?.textContent).toMatch(
      /^R\$\s43,2\smil$/,
    );
  });

  it('resume a equipe e avisa de quem está com líder provisório', async () => {
    await criar();
    const resumo = raiz().querySelector('.equipe__resumo')!.textContent ?? '';
    expect(resumo).toContain('Pessoas na equipe');
    expect(resumo).toContain('R$');
    expect(raiz().textContent).toContain('Uma pessoa responde provisoriamente');
  });

  it('vazio e erro com "Tentar de novo"', async () => {
    await criar([]);
    expect(raiz().textContent).toContain('Ninguém responde a você ainda');

    fixture.componentInstance['carregar']();
    const falha = erroDaApiFalso(500, 'erro_interno', 'Falhou.');
    http.expectOne('/api/v1/usuarios/equipes').flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Não conseguimos carregar a sua equipe');
    botaoComTexto(raiz(), 'Tentar de novo').click();
    http.expectOne('/api/v1/usuarios/equipes').flush(equipesDeTeste());
    await microtarefas();
  });
});
