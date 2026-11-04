import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { EVENTOS_HOTMART } from './dados-de-teste';
import { type TabelaDeEventos, tabelaInicial } from './eventos.tipos';
import { TabelaDeEventosPasso } from './tabela-de-eventos';

describe('TabelaDeEventosPasso', () => {
  let fixture: ComponentFixture<TabelaDeEventosPasso>;

  const elemento = () => fixture.nativeElement as HTMLElement;
  const tabela = () => fixture.componentRef.instance.tabela();

  function criar(inicial: TabelaDeEventos = tabelaInicial(EVENTOS_HOTMART, null)) {
    fixture = TestBed.createComponent(TabelaDeEventosPasso);
    fixture.componentRef.setInput('eventos', EVENTOS_HOTMART);
    fixture.componentRef.setInput('tabela', inicial);
    fixture.componentRef.setInput('etapas', [{ valor: 'c-novo', rotulo: 'Novo' }]);
    fixture.componentRef.setInput('funilNome', 'Comercial');
    fixture.detectChanges();
  }

  function linha(codigo: string): HTMLElement {
    return elemento().querySelector<HTMLElement>(`[data-evento="${codigo}"]`)!;
  }

  function escolher(selecao: HTMLSelectElement, texto: string): void {
    const opcao = Array.from(selecao.options).find((o) => o.textContent?.trim() === texto)!;
    selecao.value = opcao.value;
    selecao.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('lista os eventos por grupo, com o nome amigável, a ação e o modelo pronto escolhido', () => {
    criar();
    const texto = elemento().textContent ?? '';
    expect(texto).toContain('Compra aprovada');
    expect(texto).toContain('Boleto gerado');
    expect(texto).toContain('Compra reembolsada');
    expect(
      Array.from(elemento().querySelectorAll('.eventos__subtitulo')).map((e) =>
        e.textContent?.trim(),
      ),
    ).toEqual(expect.arrayContaining(['Compra', 'Pagamento pendente', 'Pós-venda']));
    expect(
      linha('PURCHASE_APPROVED').querySelector('select')?.selectedOptions[0].textContent?.trim(),
    ).toBe('Ganho, com valor');
    expect(elemento().querySelector('[data-teste=modelo-atual]')?.textContent).toContain(
      'Vendas completas',
    );
    expect(texto).toContain('Comercial');
  });

  it('cada ação mostra o que precisa: etapa em "Abrir", motivo em "Perdido"', () => {
    criar();
    const boleto = linha('PURCHASE_BILLET_PRINTED');
    expect(boleto.querySelectorAll('select')).toHaveLength(2);
    expect(boleto.textContent).toContain('Etapa de entrada');
    const reembolso = linha('PURCHASE_REFUNDED');
    expect(reembolso.querySelector<HTMLInputElement>('input[type=text]')?.value).toBe('Reembolso');
    expect(linha('PURCHASE_APPROVED').querySelectorAll('select')).toHaveLength(1);
  });

  it('mudar a ação torna a tabela personalizada e escolher um modelo a restaura', () => {
    criar();
    escolher(linha('PURCHASE_BILLET_PRINTED').querySelector('select')!, 'Ignorar');
    expect(tabela()['PURCHASE_BILLET_PRINTED'].acao).toBe('IGNORAR');
    expect(elemento().querySelector('[data-teste=modelo-atual]')?.textContent).toContain(
      'personalizada',
    );

    const soCompras = Array.from(
      elemento().querySelectorAll<HTMLInputElement>('app-grupo-opcoes input[type=radio]'),
    ).find((r) => r.closest('label')?.textContent?.includes('Só compras aprovadas'))!;
    soCompras.click();
    fixture.detectChanges();
    expect(tabela()['PURCHASE_REFUNDED'].acao).toBe('IGNORAR');
    expect(tabela()['PURCHASE_APPROVED'].acao).toBe('GANHO');
    expect(elemento().querySelector('[data-teste=modelo-atual]')?.textContent).toContain(
      'Só compras aprovadas',
    );
  });

  it('guarda a etapa escolhida em "Abrir" e as etiquetas, sem engolir a vírgula digitada', () => {
    criar();
    escolher(linha('PURCHASE_BILLET_PRINTED').querySelectorAll('select')[1], 'Novo');
    expect(tabela()['PURCHASE_BILLET_PRINTED'].etapaId).toBe('c-novo');

    const etiquetas = linha('PURCHASE_APPROVED').querySelector<HTMLInputElement>(
      'input[placeholder="Etiquetas"]',
    )!;
    etiquetas.value = 'aluno, h3, ';
    etiquetas.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(tabela()['PURCHASE_APPROVED'].etiquetas).toEqual(['aluno', 'h3']);
    expect(
      linha('PURCHASE_APPROVED').querySelector<HTMLInputElement>('input[placeholder="Etiquetas"]')
        ?.value,
    ).toBe('aluno, h3, ');
  });

  it('acrescenta e remove um código de evento que a plataforma não lista', () => {
    criar();
    const entrada = elemento().querySelector<HTMLInputElement>('.eventos__outro input')!;
    const adicionar = Array.from(elemento().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Acrescentar'),
    )!;
    adicionar.click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Digite o código do evento');

    entrada.value = 'PURCHASE_DELAYED';
    entrada.dispatchEvent(new Event('input'));
    adicionar.click();
    fixture.detectChanges();
    expect(tabela()['PURCHASE_DELAYED'].acao).toBe('IGNORAR');
    expect(elemento().textContent).toContain('Outros eventos');

    elemento()
      .querySelector<HTMLButtonElement>('[aria-label="Remover o evento PURCHASE_DELAYED"]')!
      .click();
    fixture.detectChanges();
    expect(tabela()['PURCHASE_DELAYED']).toBeUndefined();
  });

  it('o filtro de produto sobe em texto', () => {
    criar();
    const entrada = elemento().querySelector<HTMLInputElement>('.eventos__filtro input')!;
    entrada.value = 'Curso Online BRL';
    entrada.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.produtos()).toBe('Curso Online BRL');
  });
});
