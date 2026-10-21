import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AnaliseIa, DURACAO_ANALISE_MS } from './analise-ia';
import { DADOS_POR_PERIODO, type DadosPeriodo } from './dados-exemplo';

@Component({
  imports: [AnaliseIa],
  template: `<app-inicio-analise [(aberto)]="aberto" [dados]="dados()" />`,
})
class Hospedeiro {
  readonly aberto = signal(true);
  readonly dados = signal<DadosPeriodo>(DADOS_POR_PERIODO['30d']);
}

const texto = (elemento: Element | null | undefined) =>
  elemento?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

// O jsdom não implementa showModal(): o modal cai para o atributo `open`.
describe('AnaliseIa (modal "Análise com IA · beta")', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });
  afterEach(() => vi.useRealTimers());

  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const dialogo = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const botao = () => dialogo.querySelector<HTMLButtonElement>('.analise__rodape button');
    const anuncio = () => dialogo.querySelector('[role="status"]');
    const avancar = (ms: number) => {
      vi.advanceTimersByTime(ms);
      fixture.detectChanges();
    };
    return { fixture, hospedeiro: fixture.componentInstance, dialogo, botao, anuncio, avancar };
  }

  it('explica o que a IA faz, com a nota de exemplo ilustrativo no rodapé', () => {
    const { dialogo, botao } = criar();
    expect(dialogo.hasAttribute('open')).toBe(true);
    expect(texto(dialogo.querySelector('h2'))).toBe('Análise com IA · beta');
    expect(texto(dialogo.querySelector('.analise__intro'))).toContain(
      'funil, atendimento e equipe dos últimos 30 dias',
    );
    expect(texto(dialogo.querySelector('.analise__nota'))).toBe(
      'Exemplo ilustrativo — a IA será conectada na etapa de BI.',
    );
    expect(texto(botao())).toBe('Gerar análise');
    expect(dialogo.querySelectorAll('.sugestao').length).toBe(0);
  });

  it('o foco começa em "Gerar análise" (o showModal foca o primeiro [autofocus])', () => {
    const { dialogo, botao } = criar();
    const autofocos = dialogo.querySelectorAll('[autofocus]');
    expect(autofocos.length).toBe(1);
    expect(autofocos[0]).toBe(botao());
  });

  it('"Gerar análise" simula ~1,2 s e mostra três sugestões com métrica, hipótese e ação', () => {
    const { dialogo, botao, avancar } = criar();
    botao()?.click();
    avancar(0);
    expect(botao()?.getAttribute('aria-busy')).toBe('true');
    expect(texto(dialogo.querySelector('.analise__aguarde'))).toBe('Lendo as métricas do painel…');

    botao()?.click(); // clique repetido enquanto gera não reinicia a espera
    avancar(DURACAO_ANALISE_MS - 1);
    expect(dialogo.querySelectorAll('.sugestao').length).toBe(0);
    avancar(1);

    const sugestoes = [...dialogo.querySelectorAll('.sugestao')];
    expect(sugestoes.length).toBe(3);
    for (const sugestao of sugestoes) {
      expect([...sugestao.querySelectorAll('dt')].map(texto)).toEqual([
        'Métrica observada',
        'Hipótese',
        'Ação sugerida',
      ]);
    }
    expect(texto(sugestoes[0])).toContain('Queda de 51,4% entre Oportunidades e Negócios ganhos');
    expect(dialogo.querySelector('[role="list"]')?.getAttribute('aria-label')).toBe(
      'Sugestões da IA',
    );
    expect(botao()?.hasAttribute('aria-busy')).toBe(false);
  });

  it('uma região viva fixa anuncia a leitura e a conclusão', () => {
    const { anuncio, botao, avancar } = criar();
    // Já existe (vazia) antes do clique: o leitor de tela acompanha as mudanças.
    expect(anuncio()).not.toBeNull();
    expect(texto(anuncio())).toBe('');
    const regiao = anuncio();

    botao()?.click();
    avancar(0);
    expect(anuncio()).toBe(regiao);
    expect(texto(anuncio())).toBe('Lendo as métricas do painel…');

    avancar(DURACAO_ANALISE_MS);
    expect(anuncio()).toBe(regiao);
    expect(texto(anuncio())).toBe('Análise pronta: 3 sugestões na lista abaixo.');
  });

  it('cada sugestão leva ao módulo onde a ação vai ser feita', () => {
    const { dialogo, botao, avancar } = criar();
    botao()?.click();
    avancar(DURACAO_ANALISE_MS);
    const caminhos = [...dialogo.querySelectorAll<HTMLAnchorElement>('.sugestao a')].map((link) => [
      texto(link),
      link.getAttribute('href'),
    ]);
    expect(caminhos).toEqual([
      ['Automações · em breve', '/automacoes'],
      ['Disparos · em breve', '/disparos'],
      ['Atendimento · em breve', '/atendimento'],
    ]);
  });

  it('pronta, o botão do rodapé vira "Fechar" (gerar de novo daria o mesmo resultado)', () => {
    const { fixture, hospedeiro, botao, anuncio, avancar } = criar();
    const elemento = botao();
    elemento?.click();
    avancar(DURACAO_ANALISE_MS);
    expect(botao()).toBe(elemento); // o mesmo botão: o foco não se perde
    expect(texto(botao())).toBe('Fechar');
    expect(botao()?.classList).toContain('botao--invertido');

    botao()?.click();
    fixture.detectChanges();
    expect(hospedeiro.aberto()).toBe(false);
    expect(texto(anuncio())).toBe('');
  });

  it('fechar no meio cancela a análise; a próxima abertura começa do zero', () => {
    const { fixture, hospedeiro, dialogo, botao, avancar } = criar();
    botao()?.click();
    avancar(300);
    dialogo.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.click();
    fixture.detectChanges();
    expect(hospedeiro.aberto()).toBe(false);
    avancar(DURACAO_ANALISE_MS);

    hospedeiro.aberto.set(true);
    fixture.detectChanges();
    expect(dialogo.hasAttribute('open')).toBe(true);
    expect(dialogo.querySelectorAll('.sugestao').length).toBe(0);
    expect(texto(botao())).toBe('Gerar análise');
  });

  it('as sugestões acompanham o período do painel', () => {
    const { fixture, hospedeiro, dialogo, botao, avancar } = criar();
    hospedeiro.dados.set(DADOS_POR_PERIODO.trimestre);
    fixture.detectChanges();
    expect(texto(dialogo.querySelector('.analise__intro'))).toContain('último trimestre');
    botao()?.click();
    avancar(DURACAO_ANALISE_MS);
    expect(texto(dialogo.querySelector('.sugestao'))).toContain('(1.530 → 723)');
  });
});
