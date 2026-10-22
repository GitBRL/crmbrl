import { TestBed } from '@angular/core/testing';

import { Dica } from './dica';

// O jsdom não tem a Popover API: estes testes cobrem o modo reserva (mesmos atalhos).
describe('Dica', () => {
  function criar() {
    const fixture = TestBed.createComponent(Dica);
    fixture.componentRef.setInput('texto', 'Receita recorrente mensal.');
    fixture.componentRef.setInput('rotulo', 'O que é MRR?');
    fixture.componentRef.setInput('titulo', 'MRR');
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
    const raiz = fixture.nativeElement as HTMLElement;
    const botao = raiz.querySelector('button') as HTMLButtonElement;
    const balao = raiz.querySelector('[role="tooltip"]') as HTMLElement;
    return { fixture, botao, balao };
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('botão com nome acessível, descrito pelo balão', () => {
    const { botao, balao } = criar();
    expect(botao.getAttribute('type')).toBe('button');
    expect(botao.getAttribute('aria-label')).toBe('O que é MRR?');
    expect(botao.getAttribute('aria-describedby')).toBe(balao.id);
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(balao.textContent).toContain('MRR');
    expect(balao.textContent).toContain('Receita recorrente mensal.');
  });

  it('abre no clique e fecha com Esc, devolvendo o foco', () => {
    const { fixture, botao, balao } = criar();
    botao.click();
    fixture.detectChanges();
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(balao.classList).toContain('dica__balao--aberto');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(botao);
  });

  it('fecha quando o foco vai para outro controle (Tab), sem fechar em clique no balão', () => {
    const { fixture, botao, balao } = criar();
    const proximo = document.createElement('button');
    proximo.textContent = '30 dias';
    document.body.appendChild(proximo);

    botao.focus();
    botao.click(); // Enter/Espaço num <button> disparam o clique
    fixture.detectChanges();
    expect(botao.getAttribute('aria-expanded')).toBe('true');

    // Clique no próprio balão: o foco vai para ele (tabindex -1), dentro da dica.
    expect(balao.getAttribute('tabindex')).toBe('-1');
    balao.focus();
    fixture.detectChanges();
    expect(balao.classList).toContain('dica__balao--aberto');

    // Foco sem destino (a janela perdeu o foco): continua aberta.
    balao.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    fixture.detectChanges();
    expect(balao.classList).toContain('dica__balao--aberto');

    proximo.focus(); // Tab: o foco sai da dica para o controle seguinte
    fixture.detectChanges();
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(balao.classList).not.toContain('dica__balao--aberto');
  });

  it('fecha com clique fora e alterna com novo clique', async () => {
    const { fixture, botao } = criar();
    botao.click();
    fixture.detectChanges();
    // O clique fora conta a partir do próximo clique (o que abriu ainda está subindo).
    await new Promise((resolver) => setTimeout(resolver));
    document.body.click();
    fixture.detectChanges();
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    botao.click();
    fixture.detectChanges();
    botao.click();
    fixture.detectChanges();
    expect(botao.getAttribute('aria-expanded')).toBe('false');
  });
});
