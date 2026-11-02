import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AvisosService } from '../../nucleo/avisos.service';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import type { RegraDistribuicao } from './configuracoes.modelos';
import { erroDaApiFalso, microtarefas, pagina, resumo } from './dados-de-teste';
import { Distribuicao } from './distribuicao';

function regraMarketing(ajustes: Partial<RegraDistribuicao> = {}): RegraDistribuicao {
  return {
    id: 'r-mkt',
    area: 'MARKETING',
    incluirLideres: false,
    ultimoUsuario: null,
    proximo: { id: 'u-thiago', nome: 'Thiago Lima' },
    participantes: [
      { id: 'u-mariana', nome: 'Mariana Costa', papel: 'MARKETING', motivo: 'MEMBRO_DA_AREA' },
      { id: 'u-thiago', nome: 'Thiago Lima', papel: 'MARKETING', motivo: 'MEMBRO_DA_AREA' },
    ],
    ajustes: [],
    atualizadoEm: '2026-10-21T12:00:00.000Z',
    ...ajustes,
  };
}

const PESSOAS_MKT = pagina([
  resumo('u-camila', 'Camila Rocha', 'LIDER_MARKETING'),
  resumo('u-mariana', 'Mariana Costa', 'MARKETING'),
  resumo('u-thiago', 'Thiago Lima', 'MARKETING'),
]);
const LISTA_MKT = '/api/v1/usuarios?area=MARKETING&ativo=true&porPagina=100';

describe('Distribuicao (rodízio por área, R5.8)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Distribuicao>;
  let avisos: AvisosService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    avisos = TestBed.inject(AvisosService);
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;

  async function criar(regras: RegraDistribuicao[] = [regraMarketing()]) {
    entrarComo('LIDER_MARKETING', { usuario: { id: 'u-camila', nome: 'Camila Rocha' } });
    fixture = TestBed.createComponent(Distribuicao);
    fixture.detectChanges();
    http.expectOne('/api/v1/regras-distribuicao').flush(regras);
    await microtarefas();
    http.expectOne(LISTA_MKT).flush(PESSOAS_MKT);
    await microtarefas();
    fixture.detectChanges();
  }

  function alternador(rotulo: string): HTMLInputElement {
    const label = Array.from(raiz().querySelectorAll('label.alternador__rotulo')).find((item) =>
      item.textContent?.includes(rotulo),
    )!;
    return raiz().querySelector<HTMLInputElement>(`#${CSS.escape(label.getAttribute('for')!)}`)!;
  }

  it('mostra o próximo da vez, a fila em ordem e quem está fora', async () => {
    await criar();
    const cartao = raiz().querySelector('.rodizio__cartao')!;
    expect(cartao.textContent).toContain('Marketing');
    expect(cartao.textContent).toContain('2 na fila');
    expect(cartao.querySelector('.rodizio__proximo')?.textContent).toContain('Thiago Lima');
    const nomes = Array.from(cartao.querySelectorAll('.rodizio__pessoa .alternador__rotulo')).map(
      (l) => l.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(nomes[0]).toBe('Mariana Costa');
    expect(nomes[1]).toBe('Thiago Lima');
    expect(nomes[2]).toContain('Camila Rocha');
    expect(alternador('Camila Rocha').checked).toBe(false);
    expect(alternador('Thiago Lima').checked).toBe(true);
  });

  it('a líder que vê a própria área lê "você" na dica do líder no rodízio', async () => {
    await criar();
    const dica = raiz().querySelector('.rodizio__lider')?.textContent?.replace(/\s+/g, ' ');
    // O alternador está desligado: a dica começa pela situação de agora.
    expect(dica).toContain(
      'Desligado: só a equipe recebe leads. Se ligar, você também recebe na vez.',
    );
  });

  it('tirar alguém da fila cria o ajuste manual e oferece desfazer', async () => {
    const sucesso = vi.spyOn(avisos, 'sucesso');
    await criar();
    alternador('Thiago Lima').click();
    fixture.detectChanges();
    const pedido = http.expectOne('/api/v1/regras-distribuicao/MARKETING/participantes/u-thiago');
    expect(pedido.request.method).toBe('PUT');
    expect(pedido.request.body).toEqual({ participa: false });
    pedido.flush(
      regraMarketing({
        participantes: [
          { id: 'u-mariana', nome: 'Mariana Costa', papel: 'MARKETING', motivo: 'MEMBRO_DA_AREA' },
        ],
        proximo: { id: 'u-mariana', nome: 'Mariana Costa' },
        ajustes: [
          {
            id: 'u-thiago',
            nome: 'Thiago Lima',
            papel: 'MARKETING',
            ativo: true,
            participa: false,
          },
        ],
      }),
    );
    await microtarefas();
    fixture.detectChanges();
    expect(sucesso).toHaveBeenCalledWith(
      'Thiago Lima saiu do rodízio de Marketing.',
      expect.objectContaining({ acao: expect.objectContaining({ rotulo: 'Desfazer' }) }),
    );
    expect(raiz().textContent).toContain('tirado(a) do rodízio à mão');

    // Desfazer volta à regra: apaga o ajuste em vez de criar outro.
    sucesso.mock.calls[0][1]!.acao!.executar();
    const desfazer = http.expectOne('/api/v1/regras-distribuicao/MARKETING/participantes/u-thiago');
    expect(desfazer.request.method).toBe('DELETE');
    desfazer.flush(regraMarketing());
    await microtarefas();
  });

  it('o líder entra no rodízio pelo alternador da regra', async () => {
    await criar();
    alternador('O líder entra no rodízio').click();
    fixture.detectChanges();
    const pedido = http.expectOne('/api/v1/regras-distribuicao/MARKETING');
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).toEqual({ incluirLideres: true });
    pedido.flush(
      regraMarketing({
        incluirLideres: true,
        participantes: [
          ...regraMarketing().participantes,
          {
            id: 'u-camila',
            nome: 'Camila Rocha',
            papel: 'LIDER_MARKETING',
            motivo: 'LIDER_INCLUIDO_PELA_REGRA',
          },
        ],
      }),
    );
    await microtarefas();
    fixture.detectChanges();
    expect(alternador('Camila Rocha').checked).toBe(true);
    expect(raiz().textContent).toContain('3 na fila');
    expect(raiz().querySelector('.rodizio__lider')?.textContent?.replace(/\s+/g, ' ')).toContain(
      'Ligado: você também recebe leads na vez. Se desligar, só a equipe recebe.',
    );
  });

  it('se salvar falha, o alternador volta ao valor real e o erro aparece', async () => {
    const erro = vi.spyOn(avisos, 'erro');
    await criar();
    alternador('Mariana Costa').click();
    fixture.detectChanges();
    expect(alternador('Mariana Costa').checked).toBe(false);
    const falha = erroDaApiFalso(
      403,
      'sem_permissao',
      'Você não pode configurar o rodízio de Marketing.',
    );
    http
      .expectOne('/api/v1/regras-distribuicao/MARKETING/participantes/u-mariana')
      .flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(erro).toHaveBeenCalled();
    expect(alternador('Mariana Costa').checked).toBe(true);
  });

  it('quem ainda não ativou o acesso fica fora da fila, com o aviso de quando entra', async () => {
    await criar([
      regraMarketing({
        aguardandoAcesso: [
          {
            id: 'u-rodrigo',
            nome: 'Rodrigo Nunes',
            papel: 'MARKETING',
            motivo: 'CONVITE_PENDENTE',
          },
        ],
      }),
    ]);
    const cartao = raiz().querySelector('.rodizio__cartao')!;
    expect(cartao.textContent).toContain('2 na fila');
    expect(cartao.querySelector('.rodizio__aguardando')?.textContent?.trim()).toBe(
      'Rodrigo Nunes ainda não ativou o acesso: entra na fila quando ativar.',
    );
    const linha = Array.from(cartao.querySelectorAll('.rodizio__pessoa')).find((li) =>
      li.textContent?.includes('Rodrigo Nunes'),
    )!;
    expect(linha.classList).toContain('rodizio__pessoa--fora');
    expect(linha.querySelector('.rodizio__posicao')?.textContent?.trim()).toBe('–');
    expect(alternador('Rodrigo Nunes').checked).toBe(true);
    expect(raiz().querySelector('.faixa--info')?.textContent).toContain(
      'Só fica na fila quem já ativou o acesso',
    );
  });

  it('fila vazia diz para quem os leads vão', async () => {
    await criar([
      regraMarketing({ participantes: [], proximo: { id: 'u-camila', nome: 'Camila Rocha' } }),
    ]);
    expect(raiz().textContent).toContain(
      'Ninguém na fila: os leads vão para Camila Rocha até alguém entrar.',
    );
  });
});
