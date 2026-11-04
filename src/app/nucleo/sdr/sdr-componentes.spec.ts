import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { FaixaSdr } from './faixa-sdr';
import { PainelSugestao } from './painel-sugestao';
import { estadoSdrDeTeste, qualificacaoDeTeste } from './sdr-de-teste';
import type { SdrDaConversa, SugestaoDoSdr } from './sdr.tipos';
import { SeloIa } from './selo-ia';
import { SeloTemperatura } from './selo-temperatura';

const texto = (e: Element | null) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('SeloIa', () => {
  function montar(sdr: SdrDaConversa | null) {
    const f = TestBed.createComponent(SeloIa);
    f.componentRef.setInput('sdr', sdr);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('aparece só com a IA ativa, dizendo o modo para o leitor de tela', () => {
    const base = { nota: null, temperatura: null } as const;
    const auto = montar({ ...base, situacao: 'ATIVA', modo: 'AUTOMATICO' });
    expect(texto(auto)).toContain('IA atendendo');
    expect(texto(auto)).toContain('modo automático');
    const sugestao = montar({ ...base, situacao: 'ATIVA', modo: 'SUGESTAO' });
    expect(texto(sugestao)).toContain('IA sugerindo');
    expect(texto(montar({ ...base, situacao: 'HUMANO', modo: 'AUTOMATICO' }))).toBe('');
    expect(texto(montar(null))).toBe('');
  });
});

describe('SeloTemperatura', () => {
  function montar(temperatura: 'QUENTE' | 'MORNO' | 'FRIO' | null, nota: number | null = 90) {
    const f = TestBed.createComponent(SeloTemperatura);
    f.componentRef.setInput('temperatura', temperatura);
    f.componentRef.setInput('nota', nota);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('escreve a temperatura (nunca só cor) e a nota para o leitor de tela', () => {
    expect(texto(montar('QUENTE'))).toContain('Quente');
    expect(texto(montar('QUENTE'))).toContain('Lead quente, nota 90 de 100');
    expect(texto(montar('MORNO', null))).toContain('Morno');
    expect(texto(montar('FRIO'))).toContain('Frio');
    expect(montar('QUENTE').querySelector('app-selo')?.classList).toContain('selo--coral');
    expect(montar('MORNO').querySelector('app-selo')?.classList).toContain('selo--lima');
    expect(montar('FRIO').querySelector('app-selo')?.classList).toContain('selo--ciano');
  });

  it('sem temperatura, não mostra nada', () => {
    expect(texto(montar(null))).toBe('');
  });
});

describe('PainelSugestao', () => {
  const SUGESTAO: SugestaoDoSdr = {
    id: 's1',
    texto: 'Olá! Qual curso você procura?',
    acao: 'QUALIFICADO',
    motivo: 'Todos os critérios foram descobertos.',
    resumo: null,
    criadoEm: '2026-11-03T12:00:00.000Z',
  };
  let fixture: ComponentFixture<PainelSugestao>;
  let raiz: HTMLElement;
  let enviados: (string | undefined)[];
  let descartes: number;

  const botao = (rotulo: string) =>
    [...raiz.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(rotulo),
    );

  async function montar(sugestao: SugestaoDoSdr | null = SUGESTAO): Promise<void> {
    fixture = TestBed.createComponent(PainelSugestao);
    fixture.componentRef.setInput('sugestao', sugestao);
    enviados = [];
    descartes = 0;
    fixture.componentInstance.enviar.subscribe((t) => enviados.push(t));
    fixture.componentInstance.descartar.subscribe(() => descartes++);
    raiz = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  it('mostra a resposta, o que a IA propõe e o motivo', async () => {
    await montar();
    expect(texto(raiz)).toContain('Olá! Qual curso você procura?');
    expect(texto(raiz)).toContain('o lead também é qualificado');
    expect(texto(raiz)).toContain('Motivo da IA: Todos os critérios foram descobertos.');
    expect(raiz.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('"Enviar" manda o texto sugerido e "Descartar" descarta', async () => {
    await montar();
    botao('Enviar')!.click();
    botao('Descartar')!.click();
    expect(enviados).toEqual([undefined]);
    expect(descartes).toBe(1);
  });

  it('"Editar e enviar" abre o campo e manda o texto editado', async () => {
    await montar();
    botao('Editar e enviar')!.click();
    await fixture.whenStable();
    const campo = raiz.querySelector<HTMLTextAreaElement>('textarea')!;
    expect(campo.value).toBe('Olá! Qual curso você procura?');
    campo.value = '  Oi! Qual curso e cidade?  ';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    botao('Enviar editada')!.click();
    expect(enviados).toEqual(['Oi! Qual curso e cidade?']);
  });

  it('não envia texto editado vazio e deixa cancelar a edição', async () => {
    await montar();
    botao('Editar e enviar')!.click();
    await fixture.whenStable();
    const campo = raiz.querySelector<HTMLTextAreaElement>('textarea')!;
    campo.value = '   ';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(botao('Enviar editada')!.disabled).toBe(true);
    botao('Cancelar edição')!.click();
    await fixture.whenStable();
    expect(raiz.querySelector('textarea')).toBeNull();
  });

  it('chegou outra sugestão: sai da edição e mostra a nova', async () => {
    await montar();
    botao('Editar e enviar')!.click();
    await fixture.whenStable();
    fixture.componentRef.setInput('sugestao', { ...SUGESTAO, id: 's2', texto: 'Texto novo.' });
    await fixture.whenStable();
    expect(raiz.querySelector('textarea')).toBeNull();
    expect(texto(raiz)).toContain('Texto novo.');
  });

  it('sem sugestão, não mostra nada', async () => {
    await montar(null);
    expect(texto(raiz)).toBe('');
  });
});

describe('FaixaSdr', () => {
  let raiz: HTMLElement;
  let pedidos: string[];

  async function montar(estado: ReturnType<typeof estadoSdrDeTeste>) {
    const f = TestBed.createComponent(FaixaSdr);
    f.componentRef.setInput('estado', estado);
    pedidos = [];
    f.componentInstance.assumir.subscribe(() => pedidos.push('assumir'));
    f.componentInstance.devolver.subscribe(() => pedidos.push('devolver'));
    raiz = f.nativeElement as HTMLElement;
    await f.whenStable();
  }

  const botao = (rotulo: string) =>
    [...raiz.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(rotulo),
    );

  it('IA atendendo: explica e oferece "Assumir"', async () => {
    await montar(estadoSdrDeTeste());
    expect(texto(raiz)).toContain('Modo automático: a IA responde este lead sozinha');
    botao('Assumir')!.click();
    expect(pedidos).toEqual(['assumir']);
    expect(botao('Devolver')).toBeUndefined();
  });

  it('passada para a equipe: mostra o motivo, o resumo e "Devolver para a IA"', async () => {
    await montar(
      estadoSdrDeTeste({
        situacao: 'PASSADA_HUMANO',
        ativa: false,
        acoes: { assumir: false, devolver: true },
        qualificacao: qualificacaoDeTeste({
          situacao: 'PASSADA_HUMANO',
          motivo: 'O lead pediu uma pessoa.',
          resumo: 'Quer Direito em Campinas.',
        }),
      }),
    );
    expect(texto(raiz)).toContain('Passada para a equipe');
    expect(texto(raiz)).toContain('O lead pediu uma pessoa.');
    expect(texto(raiz)).toContain('Quer Direito em Campinas.');
    botao('Devolver para a IA')!.click();
    expect(pedidos).toEqual(['devolver']);
  });

  it('nunca atendida pela IA: não mostra nada', async () => {
    await montar(estadoSdrDeTeste({ situacao: null, acoes: { assumir: false } }));
    expect(texto(raiz)).toBe('');
  });
});
