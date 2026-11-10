import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { AvisosService } from '../../../nucleo/avisos.service';
import { entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import { responderSetores } from '../../../nucleo/setores/setores-de-teste';
import type { AcessoFunil, AcessosDoFunil } from '../../funis/funis.tipos';
import {
  botaoComTexto,
  campoPeloRotulo,
  erroDaApiFalso,
  escolher,
  microtarefas,
  opcoesDe,
} from '../dados-de-teste';
import {
  acessosAlterados,
  comAcesso,
  corpoDosAcessos,
  EditorDeAcessos,
  linhasDeAcessos,
} from './editor-de-acessos';

const acessoDoSetor = (
  area: string,
  nome: string,
  nivel: AcessoFunil['nivel'],
  ativo = true,
): AcessoFunil => ({
  id: `a-${area}`,
  alvo: 'SETOR',
  area,
  nomeSetor: nome,
  setorAtivo: ativo,
  usuario: null,
  nivel,
});

const acessoDaPessoa = (
  id: string,
  nome: string,
  nivel: AcessoFunil['nivel'],
  ativo = true,
): AcessoFunil => ({
  id: `a-${id}`,
  alvo: 'PESSOA',
  area: null,
  nomeSetor: null,
  setorAtivo: null,
  usuario: { id, nome, papel: 'MEMBRO', area: 'CS', rotuloPapel: 'Customer Success', ativo },
  nivel,
});

const RESPOSTA = (
  acessos: AcessoFunil[],
  visibilidade: 'SETOR' | 'RESTRITA' = 'SETOR',
): AcessosDoFunil => ({
  funilId: 'f1',
  nome: 'Parcerias',
  area: 'COMERCIAL',
  nomeSetor: 'Comercial',
  visibilidade,
  acessos,
});

const PESSOAS = {
  itens: [
    {
      id: 'u-lucas',
      nome: 'Lucas Prado',
      papel: 'MEMBRO',
      rotuloPapel: 'Customer Success',
      area: 'CS',
      ativo: true,
      nivel: 'MEMBRO',
    },
    {
      id: 'u-bia',
      nome: 'Bia Lima',
      papel: 'MEMBRO',
      rotuloPapel: 'Marketing',
      area: 'MARKETING',
      ativo: true,
      nivel: 'MEMBRO',
    },
    {
      id: 'u-adm',
      nome: 'Admin',
      papel: 'ADMIN',
      rotuloPapel: 'Admin',
      area: null,
      ativo: true,
      nivel: 'ADMINISTRADOR',
    },
  ],
  total: 3,
  pagina: 1,
  porPagina: 100,
};

@Component({
  imports: [EditorDeAcessos],
  template: `<app-editor-de-acessos-do-funil
    [funilId]="id()"
    areaDona="COMERCIAL"
    (salvo)="salvos.update((n) => n + 1)"
  />`,
})
class Hospedeiro {
  readonly id = signal('f1');
  readonly salvos = signal(0);
}

describe('funções do editor de acessos', () => {
  it('converte a lista da API em linhas e de volta no corpo do PUT (um alvo por linha)', () => {
    const linhas = linhasDeAcessos([
      acessoDoSetor('CS', 'Customer Success', 'VER'),
      acessoDaPessoa('u-lucas', 'Lucas Prado', 'GESTOR'),
    ]);
    expect(linhas.map((l) => [l.chave, l.nome, l.nivel])).toEqual([
      ['setor:CS', 'Customer Success', 'VER'],
      ['pessoa:u-lucas', 'Lucas Prado', 'GESTOR'],
    ]);
    expect(corpoDosAcessos(linhas)).toEqual([
      { area: 'CS', nivel: 'VER' },
      { usuarioId: 'u-lucas', nivel: 'GESTOR' },
    ]);
  });

  it('marca alvo inativo; comAcesso não duplica; acessosAlterados vê nível e alvo', () => {
    const linhas = linhasDeAcessos([
      acessoDoSetor('CS', 'CS', 'VER', false),
      acessoDaPessoa('u1', 'Ana', 'VER', false),
    ]);
    expect(linhas.map((l) => l.inativo)).toEqual([true, true]);
    const trocada = comAcesso(linhas, { ...linhas[0], nivel: 'MEMBRO' });
    expect(trocada).toHaveLength(2);
    expect(trocada[0].nivel).toBe('MEMBRO');
    expect(acessosAlterados(trocada, linhas)).toBe(true);
    expect(acessosAlterados(linhas, [...linhas].reverse())).toBe(false);
    expect(acessosAlterados(linhas.slice(1), linhas)).toBe(true);
  });
});

describe('EditorDeAcessos', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Hospedeiro>;
  let avisos: AvisosService;

  async function abrir(resposta: AcessosDoFunil) {
    entrarComo('LIDER_COMERCIAL');
    fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    await microtarefas();
    responderSetores(http, [{ chave: 'ANTIGO', nome: 'Antigo', ativo: false }]);
    http.expectOne('/api/v1/funis/f1/acessos').flush(resposta);
    http.expectOne((r) => r.url === '/api/v1/usuarios').flush(PESSOAS);
    await microtarefas();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    avisos = TestBed.inject(AvisosService);
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;
  const linha = (chave: string) => raiz().querySelector<HTMLElement>(`[data-acesso="${chave}"]`)!;
  const salvar = () => botaoComTexto(raiz(), 'Salvar acessos');

  it('lista os acessos e marca o setor desativado e a pessoa desligada', async () => {
    await abrir(
      RESPOSTA([
        acessoDoSetor('CS', 'Customer Success', 'VER'),
        acessoDoSetor('ANTIGO', 'Antigo', 'MEMBRO', false),
        acessoDaPessoa('u-lucas', 'Lucas Prado', 'GESTOR', false),
      ]),
    );
    expect(raiz().querySelectorAll('.acesso')).toHaveLength(3);
    expect(linha('setor:ANTIGO').textContent).toContain('Setor desativado');
    expect(linha('pessoa:u-lucas').textContent).toContain('Pessoa desligada');
    expect(linha('setor:CS').textContent).not.toContain('desativado');
    expect(salvar().disabled).toBe(true);
  });

  it('o setor dono e os já listados não são oferecidos; só setores ativos', async () => {
    await abrir(RESPOSTA([acessoDoSetor('CS', 'Customer Success', 'VER')]));
    expect(opcoesDe(raiz(), 'Setor')).toEqual(['Marketing']);
  });

  it('adiciona um setor com o nível escolhido e salva (PUT com a lista inteira)', async () => {
    await abrir(RESPOSTA([acessoDoSetor('CS', 'Customer Success', 'VER')]));
    escolher(raiz(), 'Setor', 'Marketing');
    escolher(raiz(), 'Nível do acesso', 'Como membro');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Adicionar').click();
    fixture.detectChanges();
    expect(linha('setor:MARKETING')).not.toBeNull();
    expect(salvar().disabled).toBe(false);
    const sucesso = vi.spyOn(avisos, 'sucesso');
    salvar().click();
    const pedido = http.expectOne('/api/v1/funis/f1/acessos');
    expect(pedido.request.method).toBe('PUT');
    expect(pedido.request.body).toEqual({
      acessos: [
        { area: 'CS', nivel: 'VER' },
        { area: 'MARKETING', nivel: 'MEMBRO' },
      ],
    });
    pedido.flush(
      RESPOSTA([
        acessoDoSetor('CS', 'Customer Success', 'VER'),
        acessoDoSetor('MARKETING', 'Marketing', 'MEMBRO'),
      ]),
    );
    await microtarefas();
    fixture.detectChanges();
    expect(sucesso).toHaveBeenCalledWith('Acessos do funil salvos.');
    expect(fixture.componentInstance.salvos()).toBe(1);
    expect(salvar().disabled).toBe(true);
  });

  it('adiciona uma pessoa (sem Admin e C-level na lista)', async () => {
    await abrir(RESPOSTA([]));
    [...raiz().querySelectorAll('label')]
      .find((l) => l.textContent?.includes('Uma pessoa'))!
      .click();
    fixture.detectChanges();
    expect(opcoesDe(raiz(), 'Pessoa')).toEqual([
      'Lucas Prado · Customer Success',
      'Bia Lima · Marketing',
    ]);
    escolher(raiz(), 'Pessoa', 'Lucas Prado · Customer Success');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Adicionar').click();
    fixture.detectChanges();
    salvar().click();
    expect(http.expectOne('/api/v1/funis/f1/acessos').request.body).toEqual({
      acessos: [{ usuarioId: 'u-lucas', nivel: 'VER' }],
    });
  });

  it('troca o nível e remove, e "Descartar" volta ao que está salvo', async () => {
    await abrir(
      RESPOSTA([
        acessoDoSetor('CS', 'Customer Success', 'VER'),
        acessoDaPessoa('u-lucas', 'Lucas Prado', 'VER'),
      ]),
    );
    escolher(linha('setor:CS'), 'Nível de Customer Success', 'Ver e editar todos');
    fixture.detectChanges();
    raiz()
      .querySelector<HTMLButtonElement>('[aria-label="Remover o acesso de Lucas Prado"]')!
      .click();
    fixture.detectChanges();
    expect(raiz().querySelectorAll('.acesso')).toHaveLength(1);
    salvar().click();
    const pedido = http.expectOne('/api/v1/funis/f1/acessos');
    expect(pedido.request.body).toEqual({ acessos: [{ area: 'CS', nivel: 'GESTOR' }] });
    pedido.flush(RESPOSTA([acessoDoSetor('CS', 'Customer Success', 'GESTOR')]));
    await microtarefas();
    fixture.detectChanges();

    raiz()
      .querySelector<HTMLButtonElement>('[aria-label="Remover o acesso de Customer Success"]')!
      .click();
    fixture.detectChanges();
    expect(raiz().querySelectorAll('.acesso')).toHaveLength(0);
    botaoComTexto(raiz(), 'Descartar').click();
    fixture.detectChanges();
    expect(raiz().querySelectorAll('.acesso')).toHaveLength(1);
  });

  it('422 R5.11 mostra a mensagem da API e mantém a lista da tela', async () => {
    await abrir(RESPOSTA([]));
    escolher(raiz(), 'Setor', 'Marketing');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Adicionar').click();
    fixture.detectChanges();
    salvar().click();
    const { corpo, opcoes } = erroDaApiFalso(
      422,
      'regra_violada',
      'O setor Marketing está desativado: não dá para dar acesso a ele.',
      {
        regra: 'R5.11',
      },
    );
    http.expectOne('/api/v1/funis/f1/acessos').flush(corpo, opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('.acessos__erro')?.textContent).toContain('está desativado');
    expect(raiz().querySelectorAll('.acesso')).toHaveLength(1);
  });

  it('400 com acessos.N põe a mensagem na linha certa', async () => {
    await abrir(RESPOSTA([acessoDoSetor('CS', 'Customer Success', 'VER')]));
    escolher(raiz(), 'Setor', 'Marketing');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Adicionar').click();
    fixture.detectChanges();
    salvar().click();
    const { corpo, opcoes } = erroDaApiFalso(400, 'dados_invalidos', 'Dados inválidos', {
      campos: [{ campo: 'acessos.1', mensagens: ['alvo repetido'] }],
    });
    http.expectOne('/api/v1/funis/f1/acessos').flush(corpo, opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(linha('setor:MARKETING').textContent).toContain('Alvo repetido');
    expect(linha('setor:CS').textContent).not.toContain('repetido');
  });

  it('funil restrito: avisa que só esta lista conta', async () => {
    await abrir(RESPOSTA([], 'RESTRITA'));
    expect(raiz().querySelector('.acessos__aviso')?.textContent).toContain(
      'as demais pessoas só entram por esta lista',
    );
    expect(campoPeloRotulo(raiz(), 'Setor')).not.toBeNull();
  });
});
