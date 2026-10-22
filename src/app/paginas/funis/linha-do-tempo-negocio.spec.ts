import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { RegistroLinhaDoTempo } from './funis.tipos';
import { LinhaDoTempoNegocio, semEventosRepetidos } from './linha-do-tempo-negocio';

function evento(
  id: string,
  acao: string,
  entidadeId: string,
  resumo: string,
): RegistroLinhaDoTempo {
  return {
    tipo: 'evento',
    ocorridoEm: '2026-10-22T12:00:00.000Z',
    atividade: null,
    evento: {
      id,
      acao,
      entidade: acao.split('.')[0],
      entidadeId,
      resumo,
      tipoAtor: 'USUARIO',
      usuarioId: 'u1',
      atorDescricao: 'Rafael Mendes',
      criadoEm: '2026-10-22T12:00:00.000Z',
    },
  };
}

const REUNIAO: RegistroLinhaDoTempo = {
  tipo: 'atividade',
  ocorridoEm: '2026-10-22T11:00:00.000Z',
  evento: null,
  atividade: {
    id: 'a1',
    tipo: 'REUNIAO',
    titulo: 'Kickoff com a Ferragens Araújo',
    descricao: null,
    status: 'CONCLUIDA',
    atrasada: false,
    venceEm: null,
    inicioEm: '2026-10-22T11:00:00.000Z',
    fimEm: null,
    concluidaEm: '2026-10-22T12:00:00.000Z',
    responsavel: { id: 'u2', nome: 'Lucas Pereira' },
  },
};

const REGISTROS: RegistroLinhaDoTempo[] = [
  evento('e1', 'atividade.concluida', 'a1', 'Reunião "Kickoff" concluída'),
  REUNIAO,
  evento('e2', 'atividade.criada', 'a1', 'Reunião "Kickoff" criada para Lucas Pereira'),
  evento('e3', 'atividade.criada', 'a9', 'Tarefa de outra página criada'),
  evento('e4', 'negocio.movido', 'n1', 'Movido para Proposta'),
];

describe('LinhaDoTempoNegocio', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('a atividade aparece uma vez: os eventos "criada" e "concluída" dela saem', () => {
    expect(semEventosRepetidos(REGISTROS).map((r) => r.evento?.id ?? r.atividade?.id)).toEqual([
      'a1',
      'e3',
      'e4',
    ]);
  });

  it('filtros Tudo · Alterações · Atividades pedem à API o conteúdo escolhido', async () => {
    const fixture = TestBed.createComponent(LinhaDoTempoNegocio);
    fixture.componentRef.setInput('negocioId', 'n1');
    fixture.detectChanges();
    http
      .expectOne(
        (req) => req.url === '/api/v1/negocios/n1/linha-do-tempo' && !req.params.has('incluir'),
      )
      .flush({ itens: REGISTROS, total: 5, pagina: 1, porPagina: 20 });
    await fixture.whenStable();
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('.item')).toHaveLength(3);

    const atividades = [...raiz.querySelectorAll<HTMLButtonElement>('button')].find(
      (botao) => botao.textContent?.trim() === 'Atividades',
    )!;
    atividades.click();
    fixture.detectChanges();
    http
      .expectOne((req) => req.params.get('incluir') === 'atividades')
      .flush({ itens: [REUNIAO], total: 1, pagina: 1, porPagina: 20 });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(raiz.querySelectorAll('.item')).toHaveLength(1);
  });
});
