import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Papel } from '../../nucleo/papeis';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import type { NegocioRelacionado } from './contatos.tipos';
import { NegociosRelacionados } from './negocios-relacionados';

const ABERTO_NO_COMERCIAL: NegocioRelacionado = {
  id: 'n1',
  titulo: 'Padaria Pão Dourado — delivery',
  status: 'ABERTO',
  valor: '1200.00',
  valorRecorrente: '0.00',
  diasNaEtapa: 0,
  etapaDesde: new Date(Date.now() - 36 * 3_600_000).toISOString(),
  parado: false,
  funil: { id: 'f-com', nome: 'Comercial', area: 'COMERCIAL' },
  etapa: { id: 'e-novo', nome: 'Novo', tipo: 'ABERTA' },
  contato: { id: 'c1', nome: 'Gustavo Henrique Silva' },
  responsavel: null,
  criadoEm: '2026-10-21T12:00:00.000Z',
};

function montar(papel: Papel) {
  entrarComo(papel);
  const fixture = TestBed.createComponent(NegociosRelacionados);
  fixture.componentRef.setInput('negocios', [ABERTO_NO_COMERCIAL]);
  fixture.detectChanges();
  const raiz = fixture.nativeElement as HTMLElement;
  const etapas = [...raiz.querySelectorAll('.jornada__etapa')].map((etapa) =>
    etapa.textContent!.replace(/\s+/g, ' ').trim(),
  );
  return { raiz, etapas };
}

describe('NegociosRelacionados', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('membro: as áreas que o papel não vê ficam "sem acesso" (e não "nenhum"), com a nota fora do balão', () => {
    const { raiz, etapas } = montar('COMERCIAL');
    expect(etapas).toEqual([
      'Marketing: sem acesso',
      'Comercial: 1 aberto',
      'Customer Success: sem acesso',
    ]);
    expect(raiz.querySelector('.jornada__nota')?.textContent).toContain(
      'Você vê só os seus negócios e os sem responsável.',
    );
  });

  it('C-level vê todas as áreas: sem negócio é "nenhum" e não há a nota do membro', () => {
    const { raiz, etapas } = montar('C_LEVEL');
    expect(etapas).toEqual([
      'Marketing: nenhum',
      'Comercial: 1 aberto',
      'Customer Success: nenhum',
    ]);
    expect(raiz.querySelector('.jornada__nota')).toBeNull();
  });

  it('valor sem centavos e tempo na etapa como no quadro', () => {
    const { raiz } = montar('C_LEVEL');
    const texto = raiz.querySelector('.negocio__linha')!.textContent!.replace(/\s+/g, ' ');
    expect(texto).toMatch(/R\$\s1\.200(?!,)/);
    expect(texto).not.toContain('/mês');
    expect(texto).toMatch(/Na etapa desde (ontem|hoje)/);
  });
});
