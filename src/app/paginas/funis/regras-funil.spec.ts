import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { Papel } from '../../nucleo/papeis';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import type { PassagemDoFunil, RegraDoRodizio } from './funis.tipos';
import { RegrasFunil } from './regras-funil';
import { DICAS_DO_FUNIL, dicaDasPassagens, dicaDoRodizio } from './regras-funis';

const MKT_COM: PassagemDoFunil = {
  id: 'p1',
  nome: 'Marketing → Comercial',
  funilOrigem: { id: 'f-mkt', nome: 'Marketing', area: 'MARKETING' },
  etapaGatilho: { id: 'e-mql', nome: 'Qualificado (MQL)' },
  funilDestino: { id: 'f-com', nome: 'Comercial', area: 'COMERCIAL' },
  etapaDestino: { id: 'e-novo', nome: 'Novo' },
  estrategia: 'RODIZIO',
  responsavelFixo: null,
  ativa: true,
};

const COM_CS: PassagemDoFunil = {
  ...MKT_COM,
  id: 'p2',
  nome: 'Comercial → CS',
  funilOrigem: MKT_COM.funilDestino,
  etapaGatilho: { id: 'e-ganho', nome: 'Ganho' },
  funilDestino: { id: 'f-cs', nome: 'Customer Success', area: 'CS' },
  etapaDestino: { id: 'e-boas', nome: 'Boas-vindas' },
  estrategia: 'LIDER_DA_AREA',
  ativa: false,
};

const REGRA_MKT: RegraDoRodizio = {
  area: 'MARKETING',
  incluirLideres: false,
  participantes: [
    { id: 'u1', nome: 'Mariana Costa' },
    { id: 'u2', nome: 'Thiago Lima' },
  ],
};

describe('RegrasFunil', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function montar(papel: Papel, area: 'MARKETING' | 'COMERCIAL' | 'CS') {
    entrarComo(papel);
    const fixture = TestBed.createComponent(RegrasFunil);
    fixture.componentRef.setInput('area', area);
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  const textoDaDica = (raiz: HTMLElement, indice: number) =>
    raiz.querySelectorAll('.dica__balao')[indice].textContent!.replace(/\s+/g, ' ');

  it('mostra "Passagens" e "Rodízio" com a ajuda daquele funil', () => {
    const { raiz } = montar('CS', 'CS');
    const lista = raiz.querySelector('ul[aria-label="Regras automáticas deste funil"]')!;
    const itens = [...lista.querySelectorAll('li')].map((li) => li.textContent?.trim() ?? '');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toMatch(/^Passagens/);
    expect(itens[1]).toMatch(/^Rodízio/);
    const ajudas = [...raiz.querySelectorAll('[aria-label]')].map((el) =>
      el.getAttribute('aria-label'),
    );
    expect(ajudas).toContain('Como funcionam as passagens do funil Customer Success');
    expect(ajudas).toContain('Como funciona o rodízio do funil Customer Success');
  });

  it('membro não lê a configuração: vê a padrão em frases condicionais', () => {
    const { raiz } = montar('MARKETING', 'MARKETING');
    expect(textoDaDica(raiz, 0)).toContain(DICAS_DO_FUNIL.MARKETING.passagens);
    expect(textoDaDica(raiz, 0)).toContain('só enquanto a passagem estiver ligada');
    expect(textoDaDica(raiz, 1)).toContain('webhooks configurados com rodízio');
  });

  it('C-level vê as dicas montadas da configuração real', async () => {
    const { fixture, raiz } = montar('C_LEVEL', 'COMERCIAL');
    http.expectOne('/api/v1/passagens').flush([MKT_COM, COM_CS]);
    http.expectOne('/api/v1/regras-distribuicao').flush([REGRA_MKT]);
    await fixture.whenStable();
    fixture.detectChanges();
    const passagens = textoDaDica(raiz, 0);
    expect(passagens).toContain(
      'Chegam aqui, em “Novo”, os leads que entram em “Qualificado (MQL)”',
    );
    expect(passagens).toContain('aos cuidados do líder de Customer Success');
    expect(passagens).toContain('Esta passagem está desligada no momento');
    // Sem regra do Comercial na resposta: fica a padrão.
    expect(textoDaDica(raiz, 1)).toContain(DICAS_DO_FUNIL.COMERCIAL.rodizio);
  });

  it('clicar na pílula (e não só no "?") abre o balão', async () => {
    const { fixture, raiz } = montar('CS', 'CS');
    raiz.querySelector<HTMLElement>('.regra')!.click();
    // Com a Popover API, o "toggle" chega numa tarefa seguinte.
    await new Promise((resolver) => setTimeout(resolver));
    fixture.detectChanges();
    expect(raiz.querySelector('.dica__botao')?.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('dicas montadas da configuração', () => {
  it('passagens: o que chega, o que sai, quem recebe e se está desligada', () => {
    expect(dicaDasPassagens('MARKETING', 'f-mkt', [MKT_COM])).toBe(
      'Quando um lead entra em “Qualificado (MQL)”, o CRM cria sozinho um negócio no funil Comercial, em “Novo”, pelo rodízio de Comercial. Cada passagem roda uma única vez por negócio. Ajuste em Configurações › Passagens.',
    );
    expect(dicaDasPassagens('CS', null, [MKT_COM])).toContain('Nenhuma passagem automática');
  });

  it('rodízio: quantos na fila e se a liderança entra', () => {
    expect(dicaDoRodizio('MARKETING', REGRA_MKT)).toContain(
      'Hoje há 2 pessoas na fila de Marketing, sem a liderança.',
    );
    expect(dicaDoRodizio('MARKETING', { ...REGRA_MKT, participantes: [] })).toContain(
      'a fila de Marketing está vazia',
    );
  });
});
