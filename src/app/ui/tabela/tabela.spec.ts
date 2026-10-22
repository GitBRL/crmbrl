import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CelulaTabela } from './celula-tabela';
import { Tabela, type ColunaTabela, type Ordenacao } from './tabela';

interface Contato {
  readonly id: number;
  readonly nome: string;
  readonly email: string | null;
  readonly valor: number;
}

@Component({
  imports: [Tabela, CelulaTabela],
  template: `
    <app-tabela
      rotulo="Contatos"
      [colunas]="colunas"
      [linhas]="linhas()"
      [carregando]="carregando()"
      [link]="comLink() ? linkDoContato : null"
      [clicavel]="!comLink()"
      [(ordenacao)]="ordem"
      (abrir)="abertos.push($event)"
    >
      <ng-template appCelula="valor" [appCelulaDe]="linhas()" let-contato>
        <strong class="valor">R$ {{ contato.valor }}</strong>
      </ng-template>
      <ng-template appCelula="acoes" let-contato>
        <button type="button" class="acao">Editar</button>
      </ng-template>
      <p tabela-vazio>Nenhum contato</p>
    </app-tabela>
  `,
})
class Hospedeiro {
  readonly colunas: ColunaTabela[] = [
    { id: 'nome', rotulo: 'Nome', ordenavel: true },
    { id: 'email', rotulo: 'E-mail', noCartao: 'ocultar' },
    { id: 'valor', rotulo: 'Valor', alinhar: 'fim', ordenavel: true },
    { id: 'acoes', rotulo: 'Ações', rotuloOculto: true },
  ];
  readonly linhas = signal<readonly Contato[]>([
    { id: 1, nome: 'Maria Souza', email: 'maria@escola.com.br', valor: 1500 },
    { id: 2, nome: 'João Lima', email: null, valor: 800 },
  ]);
  readonly carregando = signal(false);
  readonly comLink = signal(true);
  readonly ordem = signal<Ordenacao | null>(null);
  readonly abertos: Contato[] = [];
  readonly linkDoContato = (contato: Contato) => ['/contatos', contato.id];
}

describe('Tabela', () => {
  async function criar() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    return { fixture, raiz, hospedeiro: fixture.componentInstance };
  }

  it('tabela nomeada, com cabeçalhos, texto padrão e modelos de célula', async () => {
    const { raiz } = await criar();
    expect(raiz.querySelector('caption')?.textContent?.trim()).toBe('Contatos');
    const cabecalhos = [...raiz.querySelectorAll('th')].map((th) => th.textContent?.trim());
    expect(cabecalhos).toEqual(['Nome', 'E-mail', 'Valor', 'Ações']);
    expect(raiz.querySelector('th:last-child span')?.classList).toContain('visualmente-oculto');
    const linhas = raiz.querySelectorAll('tbody tr');
    expect(linhas.length).toBe(2);
    const celulas = linhas[1].querySelectorAll('td');
    expect(celulas[1].textContent?.trim()).toBe('—');
    expect(celulas[2].querySelector('.valor')?.textContent).toBe('R$ 800');
    expect(celulas[2].classList).toContain('tabela__celula--fim');
    expect(celulas[1].getAttribute('data-rotulo')).toBe('E-mail');
    expect(celulas[1].classList).toContain('tabela__celula--ocultar-cartao');
    expect(celulas[0].classList).toContain('tabela__celula--titulo');
  });

  it('a coluna principal vira o link da linha', async () => {
    const { raiz } = await criar();
    const link = raiz.querySelector('tbody tr td a.tabela__abrir') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/contatos/1');
    expect(link.textContent?.trim()).toBe('Maria Souza');
    expect(raiz.querySelector('tbody tr')?.classList).toContain('tabela__linha--clicavel');
  });

  it('sem link, a linha clicável emite (abrir)', async () => {
    const { fixture, raiz, hospedeiro } = await criar();
    hospedeiro.comLink.set(false);
    await fixture.whenStable();
    (raiz.querySelectorAll('button.tabela__abrir')[1] as HTMLButtonElement).click();
    expect(hospedeiro.abertos.map((contato) => contato.nome)).toEqual(['João Lima']);
  });

  it('ordenação: botão no cabeçalho, aria-sort e anúncio', async () => {
    const { fixture, raiz, hospedeiro } = await criar();
    const [nome] = raiz.querySelectorAll<HTMLButtonElement>('th .tabela__ordenar');
    nome.click();
    await fixture.whenStable();
    expect(hospedeiro.ordem()).toEqual({ coluna: 'nome', direcao: 'asc' });
    expect(raiz.querySelector('th')?.getAttribute('aria-sort')).toBe('ascending');
    expect(raiz.querySelector('[role="status"]')?.textContent).toContain(
      'Ordenado por Nome, crescente',
    );
    nome.click();
    await fixture.whenStable();
    expect(hospedeiro.ordem()?.direcao).toBe('desc');
    expect(raiz.querySelector('th')?.getAttribute('aria-sort')).toBe('descending');

    const seletor = raiz.querySelector('.tabela__ordem-seletor') as HTMLSelectElement;
    expect([...seletor.options].map((opcao) => opcao.textContent?.trim())).toContain(
      'Valor · decrescente',
    );
    seletor.value = 'valor:desc';
    seletor.dispatchEvent(new Event('change'));
    expect(hospedeiro.ordem()).toEqual({ coluna: 'valor', direcao: 'desc' });
  });

  it('carregando: esqueletos e aria-busy; vazia: o conteúdo projetado', async () => {
    const { fixture, raiz, hospedeiro } = await criar();
    hospedeiro.carregando.set(true);
    await fixture.whenStable();
    expect(raiz.querySelector('table')?.getAttribute('aria-busy')).toBe('true');
    expect(raiz.querySelectorAll('tbody app-esqueleto').length).toBe(5 * 4);
    expect(raiz.querySelector('[role="status"]')?.textContent).toContain('Carregando contatos');

    hospedeiro.carregando.set(false);
    hospedeiro.linhas.set([]);
    await fixture.whenStable();
    expect(raiz.querySelector('table')?.hasAttribute('aria-busy')).toBe(false);
    const vazia = raiz.querySelector('.tabela__linha-vazia td') as HTMLTableCellElement;
    expect(vazia.getAttribute('colspan')).toBe('4');
    expect(vazia.textContent).toContain('Nenhum contato');
  });
});
