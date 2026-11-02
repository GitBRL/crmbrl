import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { type AcaoCartao, CartaoNegocio } from './cartao-negocio';
import { ETAPAS, negocioDeTeste } from './funis-de-teste';
import type { Atividade, Negocio } from './funis.tipos';

const [NOVO, PROPOSTA, GANHO] = ETAPAS;

describe('CartaoNegocio', () => {
  let fixture: ComponentFixture<CartaoNegocio>;
  let raiz: HTMLElement;
  let acoes: AcaoCartao[];

  function montar(negocio: Negocio, extra: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(CartaoNegocio);
    fixture.componentRef.setInput('negocio', negocio);
    fixture.componentRef.setInput('link', ['/funis', 'comercial', negocio.id]);
    fixture.componentRef.setInput('etapas', ETAPAS);
    for (const [nome, valor] of Object.entries(extra)) {
      fixture.componentRef.setInput(nome, valor);
    }
    acoes = [];
    fixture.componentInstance.acao.subscribe((acao) => acoes.push(acao));
    raiz = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  const texto = (seletor: string) =>
    raiz.querySelector(seletor)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('mostra título com link para o detalhe, contato, empresa, valor e responsável', () => {
    montar(
      negocioDeTeste('a', PROPOSTA, {
        titulo: 'Escola Horizonte — plano Pro',
        valor: '12500.00',
        valorRecorrente: '990.00',
        contato: {
          id: 'c1',
          nome: 'Ana Lopes',
          email: null,
          telefone: null,
          etiquetas: ['Educação'],
        },
        empresa: { id: 'e1', nome: 'Escola Horizonte' },
      }),
    );
    const titulo = raiz.querySelector<HTMLAnchorElement>('a.cartao__titulo')!;
    expect(titulo.textContent?.trim()).toBe('Escola Horizonte — plano Pro');
    expect(titulo.getAttribute('href')).toBe('/funis/comercial/a');
    expect(texto('.cartao__quem')).toBe('Ana Lopes · Escola Horizonte');
    expect(texto('.cartao__valor')).toContain('R$ 12.500');
    expect(texto('.cartao__valor')).toContain('+ R$ 990/mês');
    expect(texto('.cartao__etiquetas')).toBe('Educação');
    expect(texto('.cartao__responsavel-nome')).toBe('Lucas');
  });

  it('não repete o nome do contato quando ele é o título (lead do Marketing)', () => {
    montar(
      negocioDeTeste('b', NOVO, {
        titulo: 'Felipe Andrade',
        contato: { id: 'c2', nome: 'felipe  andrade', email: null, telefone: null, etiquetas: [] },
      }),
    );
    expect(raiz.querySelector('.cartao__quem')).toBeNull();

    montar(
      negocioDeTeste('c', NOVO, {
        titulo: 'Felipe Andrade',
        contato: { id: 'c2', nome: 'Felipe Andrade', email: null, telefone: null, etiquetas: [] },
        empresa: { id: 'e2', nome: 'Studio Fit' },
      }),
    );
    expect(texto('.cartao__quem')).toBe('Studio Fit');
  });

  it('selo do tempo na etapa: neutro; coral e "Parado" acima do prazo-alvo (R5.10)', () => {
    montar(negocioDeTeste('d', NOVO, { diasNaEtapa: 0, etapaDesde: new Date().toISOString() }));
    expect(raiz.querySelector('.cartao--parado')).toBeNull();
    expect(texto('.cartao__tempo [aria-hidden="true"]')).toBe('hoje');

    // Menos de 24 h, mas entrou ontem à noite: "ontem", não "hoje".
    const ontemANoite = new Date();
    ontemANoite.setHours(0, 0, 0, 0);
    ontemANoite.setTime(ontemANoite.getTime() - 3_600_000);
    montar(negocioDeTeste('d2', NOVO, { diasNaEtapa: 0, etapaDesde: ontemANoite.toISOString() }));
    expect(texto('.cartao__tempo [aria-hidden="true"]')).toBe('ontem');
    expect(texto('.cartao__tempo .visualmente-oculto')).toBe('Entrou nesta etapa ontem.');

    montar(negocioDeTeste('e', NOVO, { diasNaEtapa: 4, parado: true }));
    expect(raiz.querySelector('.cartao--parado')).not.toBeNull();
    expect(texto('.cartao__tempo [aria-hidden="true"]')).toBe('Parado · 4 d');
    expect(texto('.cartao__tempo .visualmente-oculto')).toBe(
      'Parado: há 4 dias nesta etapa, acima do prazo-alvo de 1 dia.',
    );
  });

  it('sem responsável: "Assumir" para quem é da área; senão, "Sem responsável"', () => {
    montar(negocioDeTeste('f', NOVO, { responsavel: null }), { podeAssumir: true });
    const assumir = raiz.querySelector<HTMLButtonElement>('.cartao__assumir')!;
    assumir.click();
    expect(acoes).toEqual([{ tipo: 'assumir' }]);

    montar(negocioDeTeste('g', NOVO, { responsavel: null }), { podeAssumir: false });
    expect(raiz.querySelector('.cartao__assumir')).toBeNull();
    expect(texto('.cartao__sem-responsavel')).toBe('Sem responsável');
  });

  it('ganho ou perdido sem responsável não oferece "Assumir" (nem no menu)', () => {
    montar(negocioDeTeste('p', GANHO, { responsavel: null }), { podeAssumir: true });
    expect(raiz.querySelector('.cartao__assumir')).toBeNull();
    expect(texto('.cartao__sem-responsavel')).toBe('Sem responsável');
    const itens = (
      fixture.componentInstance as unknown as { itensMenu: () => { id: string }[] }
    ).itensMenu();
    expect(itens.some((item) => item.id === 'assumir')).toBe(false);
  });

  it('próxima atividade atrasada ganha o aviso para leitores de tela', () => {
    const atrasada = {
      id: 'at1',
      tipo: 'LIGACAO',
      titulo: 'Ligar para a diretora',
      status: 'PENDENTE',
      prioridade: 'MEDIA',
      venceEm: new Date(Date.now() - 3 * 3_600_000).toISOString(),
      atrasada: true,
      responsavel: { id: 'u-lucas', nome: 'Lucas Pereira' },
      criadoEm: '2026-10-20T12:00:00.000Z',
    } satisfies Atividade;
    montar(negocioDeTeste('h', NOVO), { proxima: atrasada });
    expect(texto('.cartao__proxima')).toMatch(
      /^Atividade atrasada: Ligar para a diretora · há 3 h$/,
    );
  });

  it('fechado para quem não reabre: "Mover para…" fica desabilitado com o motivo (R5.5)', () => {
    montar(negocioDeTeste('i', GANHO), { podeSair: false });
    const itens = (
      fixture.componentInstance as unknown as {
        itensMenu: () => { id: string; desabilitado?: boolean; motivo?: string }[];
      }
    ).itensMenu();
    const mover = itens.filter((item) => item.id.startsWith('mover:'));
    expect(mover.map((item) => item.id)).toEqual(['mover:novo', 'mover:proposta', 'mover:perdido']);
    expect(mover.every((item) => item.desabilitado && item.motivo?.includes('reabrem'))).toBe(true);
  });
});
