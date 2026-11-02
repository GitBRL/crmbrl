import { TestBed } from '@angular/core/testing';

import { ConstrutorSegmento, type ContagemSegmento } from './construtor-segmento';
import {
  type CampoSegmento,
  descreverCondicao,
  entradaDoValor,
  erroDaCondicao,
  novaCondicao,
  type Segmento,
  trocarCampo,
  trocarOperador,
} from './segmento';

const CAMPOS: readonly CampoSegmento[] = [
  {
    id: 'etiqueta',
    rotulo: 'Etiqueta',
    tipo: 'opcao',
    opcoes: [
      { valor: 'cliente', rotulo: 'Cliente' },
      { valor: 'lead', rotulo: 'Lead' },
    ],
  },
  { id: 'cidade', rotulo: 'Cidade', tipo: 'texto' },
  { id: 'ultima_interacao', rotulo: 'Última interação', tipo: 'data' },
  { id: 'funcionarios', rotulo: 'Funcionários', tipo: 'numero' },
];

describe('segmento (funções)', () => {
  it('cada tipo tem os seus operadores e a entrada certa do valor', () => {
    expect(entradaDoValor('texto', 'contem')).toBe('texto');
    expect(entradaDoValor('texto', 'vazio')).toBe('nenhuma');
    expect(entradaDoValor('data', 'ultimos-dias')).toBe('numero');
    expect(entradaDoValor('data', 'antes')).toBe('data');
    expect(entradaDoValor('opcao', 'e')).toBe('opcao');
    expect(entradaDoValor('booleano', 'sim')).toBe('nenhuma');
  });

  it('descreve a condição em linguagem simples', () => {
    const base = novaCondicao('c1', CAMPOS[0]);
    expect(descreverCondicao({ ...base, valor: 'cliente' }, CAMPOS)).toBe('Etiqueta é “Cliente”');
    expect(
      descreverCondicao(
        { ...novaCondicao('c2', CAMPOS[2]), operador: 'ha-mais-de-dias', valor: 30 },
        CAMPOS,
      ),
    ).toBe('Última interação há mais de 30 dias');
    expect(descreverCondicao({ ...novaCondicao('c3', CAMPOS[1]), operador: 'vazio' }, CAMPOS)).toBe(
      'Cidade está vazio',
    );
  });

  it('exige valor quando o operador pede', () => {
    const condicao = novaCondicao('c1', CAMPOS[1]);
    expect(erroDaCondicao(condicao, CAMPOS)).toBe('Informe o valor.');
    expect(erroDaCondicao({ ...condicao, valor: 'Recife' }, CAMPOS)).toBeNull();
    expect(erroDaCondicao({ ...condicao, operador: 'vazio' }, CAMPOS)).toBeNull();
    expect(erroDaCondicao({ ...condicao, campo: 'x' }, CAMPOS)).toBe('Escolha o campo.');
  });

  it('trocar de campo ajusta o operador e limpa o valor que não serve mais', () => {
    const texto = { ...novaCondicao('c1', CAMPOS[1]), operador: 'contem' as const, valor: 'Rec' };
    const data = trocarCampo(texto, CAMPOS[1], CAMPOS[2]);
    expect(data.operador).toBe('ultimos-dias');
    expect(data.valor).toBeNull();
    // Mesmo tipo e operador: o valor fica.
    expect(trocarCampo(texto, CAMPOS[1], { ...CAMPOS[1], id: 'estado' }).valor).toBe('Rec');
    // Operador com outro jeito de digitar limpa o valor.
    expect(trocarOperador(texto, CAMPOS[1], 'vazio').valor).toBeNull();
    expect(trocarOperador(texto, CAMPOS[1], 'nao-contem').valor).toBe('Rec');
  });
});

describe('ConstrutorSegmento', () => {
  function criar(contagem: ContagemSegmento | null, valor?: Segmento) {
    const fixture = TestBed.createComponent(ConstrutorSegmento);
    fixture.componentRef.setInput('campos', CAMPOS);
    fixture.componentRef.setInput('contagem', contagem);
    fixture.componentRef.setInput('atrasoMs', 0);
    if (valor) {
      fixture.componentInstance.valor.set(valor);
    }
    return { fixture, raiz: fixture.nativeElement as HTMLElement, c: fixture.componentInstance };
  }
  const esperar = () => new Promise<void>((resolver) => setTimeout(resolver, 5));

  it('começa sem condições, adiciona e remove linhas', async () => {
    const { fixture, raiz, c } = criar(null);
    await fixture.whenStable();
    expect(raiz.querySelector('.segmento__vazio')?.textContent).toContain('todos os contatos');
    const adicionar = [...raiz.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Adicionar condição'),
    )!;
    adicionar.click();
    adicionar.click();
    await fixture.whenStable();
    expect(c.valor().condicoes.length).toBe(2);
    expect(raiz.querySelectorAll('.segmento__linha').length).toBe(2);
    // Com duas linhas aparece a escolha "todas / qualquer uma".
    expect(raiz.querySelector('.segmento__combinacao')).not.toBeNull();
    raiz.querySelector<HTMLButtonElement>('button[aria-label="Remover condição 1"]')!.click();
    await fixture.whenStable();
    expect(c.valor().condicoes.length).toBe(1);
    expect(raiz.querySelector('.segmento__combinacao')).toBeNull();
  });

  it('conta ao vivo só com as condições completas e mostra o total', async () => {
    const chamadas: Segmento[] = [];
    const contar: ContagemSegmento = (segmento) => {
      chamadas.push(segmento);
      return Promise.resolve(1248);
    };
    const { fixture, raiz } = criar(contar, {
      combinacao: 'todos',
      condicoes: [
        { id: 'a', campo: 'cidade', operador: 'e', valor: 'Recife' },
        { id: 'b', campo: 'cidade', operador: 'e', valor: null },
      ],
    });
    await fixture.whenStable();
    await esperar();
    await fixture.whenStable();
    expect(chamadas.at(-1)?.condicoes.map((c) => c.id)).toEqual(['a']);
    expect(raiz.querySelector('.segmento__numero')?.textContent).toBe('1.248');
    expect(raiz.querySelector('.segmento__contagem')?.textContent).toContain(
      'contatos neste segmento',
    );
    expect(raiz.querySelector('.segmento__nota')?.textContent).toContain(
      '1 condição está incompleta',
    );
  });

  it('mostra carregando, depois o erro com "Tentar de novo" que conta outra vez', async () => {
    let falhar = true;
    const contar: ContagemSegmento = () =>
      falhar ? Promise.reject(new Error('x')) : Promise.resolve(3);
    const { fixture, raiz } = criar(contar);
    await fixture.whenStable();
    expect(raiz.querySelector('.segmento__contagem')?.getAttribute('aria-busy')).toBe('true');
    await esperar();
    await fixture.whenStable();
    expect(raiz.querySelector('.segmento__contagem')?.textContent).toContain('Não deu para contar');
    falhar = false;
    raiz.querySelector<HTMLButtonElement>('.segmento__tentar')!.click();
    await fixture.whenStable();
    await esperar();
    await fixture.whenStable();
    expect(raiz.querySelector('.segmento__numero')?.textContent).toBe('3');
  });

  it('ignora a resposta atrasada de uma contagem antiga', async () => {
    const respostas: ((n: number) => void)[] = [];
    const contar: ContagemSegmento = () =>
      new Promise<number>((resolver) => respostas.push(resolver));
    const { fixture, raiz, c } = criar(contar);
    await fixture.whenStable();
    await esperar();
    c.valor.set({
      combinacao: 'todos',
      condicoes: [{ id: 'a', campo: 'cidade', operador: 'vazio', valor: null }],
    });
    await fixture.whenStable();
    await esperar();
    expect(respostas.length).toBe(2);
    respostas[1](7);
    await esperar();
    respostas[0](999);
    await esperar();
    await fixture.whenStable();
    expect(raiz.querySelector('.segmento__numero')?.textContent).toBe('7');
  });
});
