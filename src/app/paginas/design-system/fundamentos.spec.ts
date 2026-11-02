import { TIPOGRAFIA, TOKENS_COR } from './dados';
import { descreverCor } from './fundamentos';

describe('Fundamentos do catálogo: valores lidos do CSS', () => {
  it('descreve a cor resolvida pelo navegador do jeito do catálogo', () => {
    expect(descreverCor('rgb(0, 189, 249)')).toBe('#00BDF9');
    expect(descreverCor('rgb(0 189 249)')).toBe('#00BDF9');
    expect(descreverCor('rgba(255, 255, 255, 0.07)')).toBe('branco 7%');
    expect(descreverCor('rgba(0, 0, 0, 0.45)')).toBe('preto 45%');
    expect(descreverCor('rgba(10, 10, 10, 0.42)')).toBe('#0A0A0A 42%');
    expect(descreverCor('rgba(0, 0, 0, 0)')).toBe('transparente');
    expect(descreverCor(' #fff ')).toBe('#fff');
  });
});

describe('Dados do catálogo', () => {
  it('tipografia: os 13 tokens do DESIGN-SYSTEM.md §2.3, na mesma ordem', () => {
    expect(TIPOGRAFIA.map((fonte) => fonte.token)).toEqual([
      '--fonte-display',
      '--fonte-numero',
      '--fonte-h1',
      '--fonte-h2',
      '--fonte-h3',
      '--fonte-lead',
      '--fonte-corpo',
      '--fonte-corpo-sm',
      '--fonte-rotulo',
      '--fonte-legenda-lg',
      '--fonte-legenda',
      '--fonte-micro',
      '--fonte-numero-pequeno',
    ]);
    // O h2 do palco é só para leitores de tela: na tela, o h2 é o título dos modais.
    expect(TIPOGRAFIA.find((fonte) => fonte.token === '--fonte-h2')?.uso).toBe('Título de modais');
  });

  it('cores: --cor-logo está na lista (o valor é lido do CSS, nos dois temas)', () => {
    const tokens = TOKENS_COR.flatMap((grupo) => grupo.tokens);
    expect(tokens.find((cor) => cor.token === '--cor-logo')?.forma).toBe('logo');
  });
});
