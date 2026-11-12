import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { responderSetores } from '../../nucleo/setores/setores-de-teste';
import type { Equipe, Usuario } from './configuracoes.modelos';
import {
  LUCAS,
  membro,
  microtarefas,
  pagina,
  PEDRO,
  RAFAEL,
  resumo,
  RODRIGO,
  usuario,
} from './dados-de-teste';
import { Usuarios } from './usuarios';

const LISTA_ATIVOS = '/api/v1/usuarios?ativo=true&pagina=1&porPagina=20';

describe('Usuarios (Configurações › Usuários)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Usuarios>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  function elemento(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function criar(
    itens: readonly Usuario[] = [RAFAEL, LUCAS, RODRIGO],
    equipes: Equipe[] = [],
  ) {
    entrarComo('ADMIN', { usuario: { id: 'u-admin', nome: 'Ana Ribeiro' } });
    fixture = TestBed.createComponent(Usuarios);
    fixture.detectChanges();
    responderSetores(http);
    http.expectOne(LISTA_ATIVOS).flush(pagina(itens));
    http.expectOne('/api/v1/usuarios/equipes').flush(equipes);
    await microtarefas();
    fixture.detectChanges();
  }

  function linhas(): HTMLElement[] {
    return Array.from(elemento().querySelectorAll<HTMLElement>('tbody tr.tabela__linha'));
  }

  it('lista nome, e-mail, papel, líder, situação e último acesso', async () => {
    await criar();
    const [rafael, lucas, rodrigo] = linhas().map((linha) => linha.textContent ?? '');
    expect(rafael).toContain('Rafael Mendes');
    expect(rafael).toContain('Líder Comercial');
    // Coluna do setor (nome do setor; Admin e C-level ficam com "—").
    expect(rafael).toContain('Comercial');
    expect(rafael).toContain('Helena Duarte');
    expect(lucas).toContain('lucas@brl.com.br');
    expect(lucas).toContain('há 5 min');
    expect(lucas).toContain('Ativo');
    expect(rodrigo).toContain('Convite pendente');
    expect(rodrigo).toContain('Nunca entrou');
  });

  it('a busca espera a pessoa parar de digitar e volta à página 1', async () => {
    await criar();
    const campo = elemento().querySelector<HTMLInputElement>('input[type="search"]')!;
    campo.value = 'luc';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    http.expectNone((req) => req.url === '/api/v1/usuarios' && req.params.has('busca'));
    vi.advanceTimersByTime(400);
    fixture.detectChanges();
    http
      .expectOne('/api/v1/usuarios?busca=luc&ativo=true&pagina=1&porPagina=20')
      .flush(pagina([LUCAS]));
    await microtarefas();
    fixture.detectChanges();
    expect(linhas()).toHaveLength(1);
  });

  it('filtra por situação (desligados) e por papel', async () => {
    await criar();
    const desligados = Array.from(elemento().querySelectorAll<HTMLButtonElement>('button')).find(
      (botao) => botao.textContent?.trim() === 'Desligados',
    )!;
    desligados.click();
    fixture.detectChanges();
    http.expectOne('/api/v1/usuarios?ativo=false&pagina=1&porPagina=20').flush(pagina([PEDRO]));
    await microtarefas();
    fixture.detectChanges();
    expect(linhas()[0].textContent).toContain('Desligado');

    const escolher = (indice: number, texto: string) => {
      const seletor =
        elemento().querySelectorAll<HTMLSelectElement>('.usuarios__papel select')[indice];
      seletor.selectedIndex = Array.from(seletor.options).findIndex(
        (o) => o.textContent?.trim() === texto,
      );
      seletor.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    escolher(0, 'Membro');
    http
      .expectOne('/api/v1/usuarios?papel=MEMBRO&ativo=false&pagina=1&porPagina=20')
      .flush(pagina([PEDRO]));
    await microtarefas();
    fixture.detectChanges();

    // Filtro por setor (os setores ativos vêm de `GET /setores`).
    escolher(1, 'Customer Success');
    http
      .expectOne('/api/v1/usuarios?papel=MEMBRO&area=CS&ativo=false&pagina=1&porPagina=20')
      .flush(pagina([]));
    await microtarefas();
  });

  it('mostra quem está sem o líder certo depois de um desligamento (R7.3)', async () => {
    const lucasProvisorio = usuario('u-lucas', 'Lucas Pereira', 'COMERCIAL', {
      lider: resumo('u-helena', 'Helena Duarte', 'C_LEVEL'),
    });
    await criar(
      [lucasProvisorio],
      [
        {
          lider: membro(resumo('u-helena', 'Helena Duarte', 'C_LEVEL')),
          area: null,
          membros: [membro(resumo('u-lucas', 'Lucas Pereira', 'COMERCIAL'), {}, true)],
        },
      ],
    );
    const faixa = elemento().querySelector('.faixa')!;
    expect(faixa.textContent).toContain('1 pessoa está sem o líder certo');
    expect(faixa.textContent).toContain('Lucas Pereira responde provisoriamente');
    expect(linhas()[0].textContent).toContain('provisório');
  });

  it('o menu de quem está ativo não deixa você desligar a si mesmo', async () => {
    const eu = usuario('u-admin', 'Ana Ribeiro', 'ADMIN');
    await criar([eu]);
    const componente = fixture.componentInstance as unknown as {
      linhas: () => { acoes: { id: string; desabilitado?: boolean; motivo?: string }[] }[];
    };
    const desligar = componente.linhas()[0].acoes.find((acao) => acao.id === 'desligar')!;
    expect(desligar.desabilitado).toBe(true);
    expect(desligar.motivo).toBe('Você não pode desligar a si mesmo.');
    expect(linhas()[0].textContent).toContain('você');
  });

  it('desligado tem "Reativar" no menu; convidado tem "Reenviar convite"', async () => {
    await criar([PEDRO, RODRIGO]);
    const componente = fixture.componentInstance as unknown as {
      linhas: () => { acoes: { id: string }[] }[];
    };
    const [pedro, rodrigo] = componente.linhas();
    expect(pedro.acoes.map((acao) => acao.id)).toEqual(['editar', 'reativar']);
    expect(rodrigo.acoes.map((acao) => acao.id)).toEqual([
      'editar',
      'convite',
      'senha',
      'desligar',
    ]);
  });

  it('reenviar convite avisa até quando o link vale', async () => {
    await criar([RODRIGO]);
    const componente = fixture.componentInstance as unknown as {
      agir: (acao: string, linha: unknown) => void;
      linhas: () => unknown[];
    };
    componente.agir('convite', componente.linhas()[0]);
    const pedido: TestRequest = http.expectOne('/api/v1/usuarios/u-rodrigo/convite');
    expect(pedido.request.method).toBe('POST');
    pedido.flush({
      mensagem: 'Convite enviado para rodrigo@brl.com.br.',
      expiraEm: '2026-10-22T18:05:00.000Z',
    });
    await microtarefas();
  });

  it('R2.11 — quem usa verificação em duas etapas tem "Redefinir" no menu; confirmar chama a API e recarrega', async () => {
    const ana: Usuario = { ...LUCAS, doisFatoresAtivo: true };
    await criar([ana, RODRIGO]);
    const componente = fixture.componentInstance as unknown as {
      agir: (acao: string, linha: unknown) => void;
      linhas: () => { acoes: { id: string; rotulo: string }[] }[];
    };
    const [primeira, segunda] = componente.linhas();
    expect(primeira.acoes.find((a) => a.id === 'dois-fatores')?.rotulo).toBe(
      'Redefinir verificação em duas etapas',
    );
    expect(segunda.acoes.some((a) => a.id === 'dois-fatores')).toBe(false);

    vi.spyOn(TestBed.inject(ConfirmacaoService), 'confirmar').mockResolvedValue(true);
    componente.agir('dois-fatores', primeira);
    await microtarefas();
    const pedido = http.expectOne(`/api/v1/usuarios/${ana.id}/dois-fatores/redefinir`);
    expect(pedido.request.method).toBe('POST');
    pedido.flush({ ...ana, doisFatoresAtivo: false });
    await microtarefas();
    http.expectOne(LISTA_ATIVOS).flush(pagina([{ ...ana, doisFatoresAtivo: false }, RODRIGO]));
    http.expectOne('/api/v1/usuarios/equipes').flush([]);
    await microtarefas();
  });

  it('erro ao carregar mostra a mensagem e "Tentar de novo"', async () => {
    entrarComo('ADMIN');
    fixture = TestBed.createComponent(Usuarios);
    fixture.detectChanges();
    responderSetores(http);
    http
      .expectOne(LISTA_ATIVOS)
      .flush(
        { statusCode: 500, erro: 'erro_interno', mensagem: 'Falhou.', requisicaoId: 'req-1' },
        { status: 500, statusText: 'Erro' },
      );
    http.expectOne('/api/v1/usuarios/equipes').flush([]);
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Não conseguimos carregar os usuários');
    const tentar = Array.from(elemento().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Tentar de novo'),
    )!;
    tentar.click();
    http.expectOne(LISTA_ATIVOS).flush(pagina([LUCAS]));
    http.expectOne('/api/v1/usuarios/equipes').flush([]);
    await microtarefas();
    fixture.detectChanges();
    expect(linhas()).toHaveLength(1);
  });
});
