import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { type PapelDeTeste, entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import { funilDeTeste } from '../../funis/funis-de-teste';
import type { Funil } from '../../funis/funis.tipos';
import { microtarefas } from '../dados-de-teste';
import { FunisConfig, rotuloDeEtapas } from './funis-config';
import { podeCriarFunil } from './permissao';

const FUNIS: readonly Funil[] = [
  funilDeTeste({
    id: 'cs1',
    nome: 'Pós-venda',
    area: 'CS',
    nomeSetor: 'Customer Success',
    base: false,
    nivel: 'VER',
    visibilidade: 'RESTRITA',
  }),
  funilDeTeste({
    id: 'c2',
    nome: 'Parcerias',
    base: false,
    nivel: 'CONFIGURAR',
    descricao: 'Canais parceiros',
  }),
  funilDeTeste({ id: 'c1', nome: 'Comercial', nivel: 'CONFIGURAR' }),
  funilDeTeste({
    id: 'm1',
    nome: 'Marketing',
    area: 'MARKETING',
    nomeSetor: 'Marketing',
    nivel: 'GESTOR',
  }),
];

describe('FunisConfig (Configurações → Funis)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<FunisConfig>;

  async function abrir(papel: PapelDeTeste, funis: readonly Funil[] = FUNIS) {
    entrarComo(papel);
    fixture = TestBed.createComponent(FunisConfig);
    fixture.detectChanges();
    http.expectOne('/api/v1/funis').flush(funis);
    await microtarefas();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;
  const funil = (nome: string) => raiz().querySelector<HTMLElement>(`[data-funil="${nome}"]`)!;

  it('agrupa por setor (base primeiro) e mostra visibilidade, etapas, base e nível', async () => {
    await abrir('ADMIN');
    const grupos = [...raiz().querySelectorAll('app-cartao')].map((cartao) => ({
      setor: cartao.querySelector('h3')?.textContent?.replace(/\s+/g, ' ').trim(),
      funis: [...cartao.querySelectorAll('.funil__nome')].map((el) => el.textContent?.trim()),
    }));
    expect(grupos).toEqual([
      { setor: 'Marketing · 1 funil', funis: ['Marketing'] },
      { setor: 'Comercial · 2 funis', funis: ['Comercial', 'Parcerias'] },
      { setor: 'Customer Success · 1 funil', funis: ['Pós-venda'] },
    ]);
    expect(funil('Comercial').textContent).toContain('Funil-base');
    expect(funil('Comercial').textContent).toContain('Todo o setor');
    expect(funil('Comercial').textContent).toContain('4 etapas');
    expect(funil('Parcerias').textContent).toContain('Canais parceiros');
    expect(funil('Pós-venda').textContent).toContain('Só líderes e convidados');
  });

  it('ações pelo nível: só quem configura vê "Configurar"; todos abrem o quadro', async () => {
    await abrir('LIDER_COMERCIAL');
    const acoes = (nome: string) =>
      [...funil(nome).querySelectorAll('a')].map((a) => a.textContent?.trim());
    expect(acoes('Comercial')).toEqual(['Abrir quadro', 'Configurar']);
    expect(acoes('Marketing')).toEqual(['Abrir quadro']);
    expect(acoes('Pós-venda')).toEqual(['Abrir quadro']);
    expect(funil('Pós-venda').textContent).toContain('Só ver');
    expect(funil('Marketing').textContent).toContain('Ver e editar todos');
    const abrirQuadro = funil('Parcerias').querySelector('a')!;
    expect(abrirQuadro.getAttribute('href')).toBe('/funis/comercial?funil=c2');
    expect(funil('Comercial').querySelector('a')!.getAttribute('href')).toBe('/funis/comercial');
  });

  it('"Novo funil" só para Admin, C-level e líderes', async () => {
    expect(podeCriarFunil({ papel: 'MEMBRO', area: 'CS' })).toBe(false);
    for (const papel of ['ADMIN', 'C_LEVEL', 'LIDER_COMERCIAL'] as const) {
      await abrir(papel, []);
      expect(raiz().textContent).toContain('Novo funil');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      });
      http = TestBed.inject(HttpTestingController);
    }
    await abrir('COMERCIAL', []);
    expect(raiz().textContent).not.toContain('Novo funil');
  });

  it('"Mostrar arquivados" pede os arquivados e marca o funil', async () => {
    await abrir('LIDER_COMERCIAL');
    expect(funil('Comercial').textContent).not.toContain('Arquivado');
    raiz().querySelector<HTMLInputElement>('app-caixa-selecao input')!.click();
    fixture.detectChanges();
    const pedido = http.expectOne('/api/v1/funis?incluirArquivados=true');
    pedido.flush([
      ...FUNIS,
      funilDeTeste({ id: 'v', nome: 'Antigo', base: false, ativo: false, nivel: 'CONFIGURAR' }),
    ]);
    await microtarefas();
    fixture.detectChanges();
    expect(funil('Antigo').textContent).toContain('Arquivado');
    // Arquivado não abre o quadro, mas ainda configura (para reativar).
    expect([...funil('Antigo').querySelectorAll('a')].map((a) => a.textContent?.trim())).toEqual([
      'Configurar',
    ]);
  });

  it('lista vazia (membro de setor com funil restrito) explica o que fazer', async () => {
    await abrir('COMERCIAL', []);
    expect(raiz().textContent).toContain('Você não vê nenhum funil');
    expect(raiz().textContent).toContain('restritos a líderes e convidados');
  });

  it('rótulo de etapas no singular e no plural', () => {
    expect(rotuloDeEtapas(1)).toBe('1 etapa');
    expect(rotuloDeEtapas(5)).toBe('5 etapas');
  });
});
