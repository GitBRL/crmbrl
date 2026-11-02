import { TestBed } from '@angular/core/testing';

import { EditorPassos } from './editor-passos';
import { DEFINICAO_AGUARDAR, type DefinicaoPasso, type Passo } from './passos';

const DEFINICOES: readonly DefinicaoPasso[] = [
  {
    tipo: 'contato-criado',
    fase: 'quando',
    rotulo: 'Um contato é criado',
    descricao: 'Dispara quando entra um contato novo.',
    campos: [],
  },
  {
    tipo: 'mensagem-recebida',
    fase: 'quando',
    rotulo: 'Chega uma mensagem',
    descricao: 'Dispara quando o contato escreve.',
    campos: [],
  },
  {
    tipo: 'tem-etiqueta',
    fase: 'se',
    rotulo: 'O contato tem a etiqueta',
    descricao: 'Segue por um caminho se tiver e por outro se não tiver.',
    ramos: ['Se tiver', 'Se não tiver'],
    campos: [{ id: 'etiqueta', rotulo: 'Etiqueta', tipo: 'texto', obrigatorio: true }],
  },
  {
    tipo: 'enviar-whatsapp',
    fase: 'entao',
    rotulo: 'Enviar WhatsApp',
    descricao: 'Manda uma mensagem de WhatsApp.',
    campos: [{ id: 'texto', rotulo: 'Mensagem', tipo: 'texto-longo', obrigatorio: true }],
  },
  {
    tipo: 'criar-tarefa',
    fase: 'entao',
    rotulo: 'Criar tarefa',
    descricao: 'Cria uma atividade para o responsável.',
    campos: [{ id: 'titulo', rotulo: 'Título', tipo: 'texto' }],
  },
  DEFINICAO_AGUARDAR,
];

describe('EditorPassos', () => {
  function criar(passos: readonly Passo[] = []) {
    const fixture = TestBed.createComponent(EditorPassos);
    fixture.componentRef.setInput('definicoes', DEFINICOES);
    fixture.componentInstance.passos.set(passos);
    const raiz = fixture.nativeElement as HTMLElement;
    const botoes = () => [...raiz.querySelectorAll<HTMLButtonElement>('button')];
    const botao = (texto: string) => botoes().find((b) => b.textContent?.includes(texto));
    return { fixture, raiz, c: fixture.componentInstance, botao };
  }
  const passo = (id: string, tipo: string, config: Passo['config'] = {}): Passo => ({
    id,
    tipo,
    config,
  });

  it('sem gatilho mostra a escolha; escolher cria o cartão "Quando" fixo, sem alça nem setas', async () => {
    const { fixture, raiz, c } = criar();
    await fixture.whenStable();
    expect(raiz.querySelector('.editor__gatilho-vazio app-seletor')).not.toBeNull();
    const select = raiz.querySelector<HTMLSelectElement>('.editor__gatilho-vazio select')!;
    select.value = select.options[1].value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(c.gatilho()?.tipo).toBe('contato-criado');
    const cartao = raiz.querySelector('[aria-label="Gatilho"] .passo') as HTMLElement;
    expect(cartao.textContent).toContain('Quando');
    expect(cartao.querySelector('.passo__alca')).toBeNull();
    expect(cartao.querySelector('.passo__acoes')).toBeNull();
  });

  it('adiciona um passo pelo menu, abre o cartão e marca o campo obrigatório vazio', async () => {
    const { fixture, raiz, c, botao } = criar();
    await fixture.whenStable();
    botao('Adicionar passo')!.click();
    await fixture.whenStable();
    const grupos = [...raiz.querySelectorAll('.adicionar__titulo')].map((t) =>
      t.textContent?.trim(),
    );
    expect(grupos).toEqual(['Se…', 'Então…', 'Aguardar…']);
    botao('Enviar WhatsApp')!.click();
    await fixture.whenStable();
    expect(c.passos().map((p) => p.tipo)).toEqual(['enviar-whatsapp']);
    expect(raiz.querySelector('.passo__corpo textarea')).not.toBeNull();
    expect(raiz.querySelector('.passo__alerta')?.textContent).toContain('Falta preencher');
    expect(raiz.querySelector('.editor__problemas')?.textContent).toContain('1 campo obrigatório');

    const area = raiz.querySelector<HTMLTextAreaElement>('.passo__corpo textarea')!;
    area.value = 'Olá!';
    area.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(c.passos()[0].config['texto']).toBe('Olá!');
    expect(raiz.querySelector('.passo__alerta')).toBeNull();
    expect(raiz.querySelector('.passo__detalhe')?.textContent).toContain('Olá!');
  });

  it('reordena pelas setas, anuncia e mantém o foco; o primeiro não sobe', async () => {
    const { fixture, raiz, c } = criar([
      passo('a', 'criar-tarefa', { titulo: 'A' }),
      passo('b', 'criar-tarefa', { titulo: 'B' }),
      passo('c', 'criar-tarefa', { titulo: 'C' }),
    ]);
    await fixture.whenStable();
    raiz.querySelector<HTMLButtonElement>('[aria-label="Descer o passo 1"]')!.click();
    await fixture.whenStable();
    expect(c.passos().map((p) => p.id)).toEqual(['b', 'a', 'c']);
    raiz.querySelector<HTMLButtonElement>('[aria-label="Subir o passo 1"]')!.click();
    await fixture.whenStable();
    expect(c.passos().map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(
      raiz.querySelector('[aria-label="Subir o passo 1"]')?.getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('remove o passo e o foco vai para o vizinho', async () => {
    const { fixture, raiz, c } = criar([
      passo('a', 'aguardar', { quantidade: 1 }),
      passo('b', 'aguardar', { quantidade: 2 }),
    ]);
    await fixture.whenStable();
    raiz.querySelector<HTMLButtonElement>('[aria-label="Remover o passo 1"]')!.click();
    await fixture.whenStable();
    expect(c.passos().map((p) => p.id)).toEqual(['b']);
    expect(document.activeElement?.classList).toContain('passo__resumo');
  });

  it('passo "Se" mostra um bloco por ramo, cada um com a sua lista e o seu "Adicionar"', async () => {
    const condicao: Passo = {
      id: 'c',
      tipo: 'tem-etiqueta',
      config: { etiqueta: 'vip' },
      ramos: [
        { rotulo: 'Se tiver', passos: [] },
        { rotulo: 'Se não tiver', passos: [] },
      ],
    };
    const { fixture, raiz, c } = criar([condicao]);
    await fixture.whenStable();
    const ramos = [...raiz.querySelectorAll('.ramo')];
    expect(ramos.map((r) => r.querySelector('.ramo__titulo')?.textContent?.trim())).toEqual([
      'Se tiver',
      'Se não tiver',
    ]);
    const adicionar = [...ramos[1].querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Adicionar passo aqui'),
    )!;
    adicionar.click();
    await fixture.whenStable();
    // Dentro do ramo já não cabe outro "Se" (nível máximo 2: um "Se" com ramos simples).
    const menu = [...ramos[1].querySelectorAll('.adicionar__titulo')].map((t) =>
      t.textContent?.trim(),
    );
    expect(menu).toContain('Se…');
    const aguardar = [...ramos[1].querySelectorAll<HTMLButtonElement>('.adicionar__item')].find(
      (b) => b.textContent?.includes('Aguardar um tempo'),
    )!;
    aguardar.click();
    await fixture.whenStable();
    expect(c.passos()[0].ramos?.[1].passos.map((p) => p.tipo)).toEqual(['aguardar']);
    expect(c.passos()[0].ramos?.[0].passos).toEqual([]);
  });

  it('cada cartão é um botão com aria-expanded ligado ao corpo', async () => {
    const { fixture, raiz } = criar([passo('a', 'criar-tarefa')]);
    await fixture.whenStable();
    const resumo = raiz.querySelector<HTMLButtonElement>('.passo__resumo')!;
    expect(resumo.getAttribute('aria-expanded')).toBe('false');
    resumo.click();
    await fixture.whenStable();
    expect(resumo.getAttribute('aria-expanded')).toBe('true');
    expect(raiz.querySelector(`#${resumo.getAttribute('aria-controls')}`)).not.toBeNull();
  });

  it('somente leitura: sem alça, setas, remover nem adicionar', async () => {
    const { fixture, raiz } = criar([passo('a', 'criar-tarefa')]);
    fixture.componentRef.setInput('somenteLeitura', true);
    await fixture.whenStable();
    expect(raiz.querySelector('.passo__acoes')).toBeNull();
    expect(raiz.querySelector('.passo__alca')).toBeNull();
    expect(raiz.querySelector('.lista__adicionar')).toBeNull();
  });
});
