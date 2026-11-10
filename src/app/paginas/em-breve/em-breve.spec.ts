import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ModuloBase } from '../../nucleo/modulos';
import { MODULOS, type Modulo } from '../../nucleo/navegacao';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { descreverQuemAcessa, EmBreve } from './em-breve';
import { termosNoTexto } from './glossario';
import { FASES_ROADMAP, frasesNoAr, numeroDaFase } from './roadmap';

describe('glossário', () => {
  const termos = (texto: string) => termosNoTexto(texto).map((item) => item.termo);

  it('acha os termos como palavra inteira, sem diferenciar maiúsculas, com plural', () => {
    expect(termos('Origem e campanhas (UTM)')).toEqual(['UTM']);
    expect(termos('Pesquisas de satisfação (NPS/CSAT)')).toEqual(['NPS', 'CSAT']);
    expect(termos('Funil Kanban com etapas configuráveis')).toEqual(['kanban']);
    expect(termos('Webhooks de entrada (captação de leads)')).toEqual(['webhook']);
    expect(termos('Importação e deduplicação')).toEqual(['deduplicação']);
    expect(termos('App mobile (PWA)')).toEqual(['PWA']);
    expect(termos('Métricas de atendimento (tempo de resposta, SLA, satisfação)')).toEqual(['SLA']);
    expect(termos('Receita recorrente (MRR)')).toEqual(['MRR']);
    // Pedaço de outra palavra não conta.
    expect(termos('Gatewayzinho, utmost, MQLX, Slack, MRRs2')).toEqual([]);
  });

  it('explica SLA e MRR em português simples, como os outros termos', () => {
    const explicacao = (texto: string) => termosNoTexto(texto)[0]?.explicacao;
    expect(explicacao('SLA')).toBe('Prazo máximo combinado para responder o cliente.');
    expect(explicacao('MRR')).toBe(
      'Receita recorrente mensal: quanto os contratos ativos faturam por mês.',
    );
  });
});

describe('quem acessa', () => {
  it('diz "todos, menos…" quando faltam um ou dois papéis; senão, a lista', () => {
    expect(descreverQuemAcessa(['ADMIN', 'C_LEVEL', 'LIDER'])).toBe(
      'todos os papéis, menos Membro',
    );
    expect(descreverQuemAcessa(['ADMIN', 'LIDER'])).toBe('todos os papéis, menos C-level e Membro');
    expect(descreverQuemAcessa(['ADMIN'])).toBe('Admin');
  });
});

describe('roadmap', () => {
  it('lê o número da fase', () => {
    expect(numeroDaFase('Fase 2')).toBe(2);
    expect(numeroDaFase(null)).toBeNull();
    expect(numeroDaFase('Sem fase')).toBeNull();
  });

  it('tem as fases de 0 a 6, com a base e o núcleo do CRM no ar', () => {
    expect(FASES_ROADMAP.map((fase) => fase.numero)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(FASES_ROADMAP.filter((fase) => fase.concluida).map((fase) => fase.numero)).toEqual([
      0, 1,
    ]);
    expect(frasesNoAr()).toBe('as Fases 0 (base) e 1 (núcleo do CRM) já estão no ar');
  });
});

describe('EmBreve', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    entrarComo('ADMIN');
  });
  afterEach(() => localStorage.clear());

  function criar(modulo: string | undefined) {
    const fixture = TestBed.createComponent(EmBreve);
    fixture.componentRef.setInput('modulo', modulo);
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  // Todos os módulos já estão prontos: um módulo "em breve" de mentira (Fase 3) exercita a tela.
  const MODULO_DE_TESTE: Modulo = {
    ...({} as ModuloBase),
    icone: MODULOS[0].icone,
    id: 'modulo-de-teste',
    rotulo: 'Módulo de teste',
    rota: '/modulo-de-teste',
    grupo: 'gestao',
    papeis: ['ADMIN'],
    status: 'em-breve',
    fase: 'Fase 3',
    descricao: 'Descrição do módulo de teste.',
    funcionalidades: ['Painéis por área', 'Filtros', 'Exportação', 'Análise'],
  };
  beforeEach(() => (MODULOS as Modulo[]).push(MODULO_DE_TESTE));
  afterEach(() => (MODULOS as Modulo[]).splice(MODULOS.indexOf(MODULO_DE_TESTE), 1));

  it('mostra o módulo no palco: título em dois tons, descrição, fase e funcionalidades', () => {
    const { raiz } = criar('modulo-de-teste');
    const titulo = raiz.querySelector('h1') as HTMLElement;
    expect(titulo.textContent?.replace(/\s+/g, ' ').trim()).toBe('Módulo de teste · em breve');
    // O "·" fica no fim da primeira linha; o complemento desce inteiro.
    expect(titulo.querySelector('.tom-fraco')?.textContent?.trim()).toBe('·');
    expect(titulo.querySelector('.tom-fraco.sem-quebra')?.textContent?.trim()).toBe('em breve');
    expect(raiz.querySelector('app-cartao.em-breve__palco')?.classList).toContain('cartao--palco');
    expect(raiz.textContent).toContain('Descrição do módulo de teste.');
    expect(raiz.querySelector('app-selo')?.textContent?.trim()).toBe('Fase 3');

    const chips = [...raiz.querySelectorAll('app-chip')].map((chip) => chip.textContent?.trim());
    expect(chips.length).toBe(4);
    expect(chips[0]).toBe('Painéis por área');

    const [fase, total] = [...raiz.querySelectorAll('app-indicador')];
    expect(fase.querySelector('.indicador__unidade--antes')?.textContent).toBe('Fase');
    expect(fase.querySelector('.indicador__valor')?.textContent).toBe('3');
    expect(total.querySelector('.indicador__valor')?.textContent).toBe('4');
    expect(total.textContent).toContain('Funcionalidades planejadas');
  });

  it('destaca a fase do módulo no roadmap', () => {
    const { raiz } = criar('modulo-de-teste');
    const fases = [...raiz.querySelectorAll('.roadmap__fase')];
    expect(fases.length).toBe(7);
    const atual = raiz.querySelector('[aria-current="step"]') as HTMLElement;
    expect(atual.textContent).toContain('Fase 3');
    expect(atual.textContent).toContain('BI');
    expect(fases[0].textContent).toContain('no ar');
    expect(fases[1].textContent).toContain('no ar');
  });

  it('siglas e termos das funcionalidades ganham uma dica ao lado do chip (Marketing)', () => {
    const { raiz } = criar('funil-marketing');
    const dicas = [...raiz.querySelectorAll('.em-breve__chips app-dica button')].map((botao) =>
      botao.getAttribute('aria-label'),
    );
    expect(dicas).toEqual(['O que é webhook?', 'O que é kanban?', 'O que é UTM?', 'O que é MQL?']);
    const utm = raiz.querySelector('.em-breve__chips app-dica button[aria-label="O que é UTM?"]');
    const balao = raiz.querySelector(`#${utm?.getAttribute('aria-describedby')}`);
    expect(balao?.textContent).toContain(
      'Etiquetas no link do anúncio que dizem de qual campanha o lead veio.',
    );
    // A dica fica junto do chip que cita o termo.
    expect(utm?.closest('li')?.querySelector('app-chip')?.textContent).toContain('(UTM)');
  });

  it('as métricas do Atendimento explicam SLA e a receita do Financeiro explica MRR', () => {
    const dicaDoChip = (modulo: string, termo: string) => {
      const { raiz } = criar(modulo);
      const botao = raiz.querySelector(
        `.em-breve__chips app-dica button[aria-label="O que é ${termo}?"]`,
      );
      return {
        chip: botao?.closest('li')?.querySelector('app-chip')?.textContent?.trim(),
        balao: raiz.querySelector(`#${botao?.getAttribute('aria-describedby')}`)?.textContent,
      };
    };
    const sla = dicaDoChip('atendimento', 'SLA');
    expect(sla.chip).toBe('Métricas de atendimento (tempo de resposta, SLA, satisfação)');
    expect(sla.balao).toContain('Prazo máximo combinado para responder o cliente.');
    const mrr = dicaDoChip('financeiro', 'MRR');
    expect(mrr.chip).toBe('Receita recorrente (MRR) e inadimplência');
    expect(mrr.balao).toContain('Receita recorrente mensal');
  });

  it('o roadmap explica a sigla PWA', () => {
    const { raiz } = criar('atendimento');
    const pwa = raiz.querySelector('.roadmap app-dica button');
    expect(pwa?.getAttribute('aria-label')).toBe('O que é PWA?');
    expect(pwa?.closest('.roadmap__fase')?.textContent).toContain('App mobile (PWA)');
  });

  it('sem acesso: explica quem acessa (sem modo demonstração)', () => {
    entrarComo('MARKETING');
    const { raiz } = criar('atendimento');
    const titulo = raiz.querySelector('h1') as HTMLElement;
    expect(titulo.textContent?.replace(/\s+/g, ' ').trim()).toBe('Atendimento · sem acesso');
    expect(raiz.textContent).toContain('O papel Marketing não acessa este módulo.');
    expect(raiz.textContent?.replace(/\s+/g, ' ')).toContain(
      'Quem acessa: todos, menos o setor de Marketing.',
    );
    expect(raiz.textContent).not.toContain('Ver como');
    expect(raiz.querySelectorAll('app-chip').length).toBe(0);
    expect(raiz.querySelector('a[href="/inicio"]')?.textContent).toContain('Ir para a visão geral');
  });

  it('módulo desconhecido mostra o aviso genérico', () => {
    const { raiz } = criar('nao-existe');
    expect(raiz.querySelector('h1')?.textContent?.trim()).toBe('Em breve');
    expect(raiz.querySelector('a[href="/inicio"]')).not.toBeNull();
  });
});
