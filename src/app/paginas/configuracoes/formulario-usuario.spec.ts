import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AvisosService } from '../../nucleo/avisos.service';
import type { Usuario } from './configuracoes.modelos';
import {
  botaoComTexto,
  CAMILA,
  campoPeloRotulo,
  digitar,
  erroDaApiFalso,
  escolher,
  HELENA,
  LUCAS,
  MARCOS,
  microtarefas,
  opcoesDe,
  pagina,
  RAFAEL,
  resumo,
  usuario,
} from './dados-de-teste';
import { FormularioUsuario, type PedidoFormularioUsuario } from './formulario-usuario';

@Component({
  imports: [FormularioUsuario],
  template: `<app-formulario-usuario
    [pedido]="pedido()"
    (salvo)="salvos.push($event)"
    (fechado)="pedido.set(null)"
  />`,
})
class Hospedeiro {
  readonly pedido = signal<PedidoFormularioUsuario | null>(null);
  readonly salvos: Usuario[] = [];
}

const LIDERES_COMERCIAIS = '/api/v1/usuarios?papel=LIDER_COMERCIAL&ativo=true&porPagina=100';
const C_LEVELS = '/api/v1/usuarios?papel=C_LEVEL&ativo=true&porPagina=100';

describe('FormularioUsuario (convidar e editar)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Hospedeiro>;
  let avisos: AvisosService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    avisos = TestBed.inject(AvisosService);
    fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;

  async function abrir(pedido: PedidoFormularioUsuario) {
    fixture.componentInstance.pedido.set(pedido);
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
  }

  async function responder(url: string, corpo: object) {
    http.expectOne(url).flush(corpo);
    await microtarefas();
    fixture.detectChanges();
  }

  it('o seletor de líder só oferece quem a regra R1.2 permite para o papel, e explica', async () => {
    await abrir({ modo: 'convidar' });
    expect(campoPeloRotulo<HTMLSelectElement>(raiz(), 'Líder').disabled).toBe(true);
    expect(raiz().textContent).toContain('Escolha o papel primeiro');

    escolher(raiz(), 'Papel', 'Comercial · Comercial');
    fixture.detectChanges();
    await responder(LIDERES_COMERCIAIS, pagina([RAFAEL]));
    expect(opcoesDe(raiz(), 'Líder')).toEqual(['Rafael Mendes']);
    // Uma opção só: já vem escolhida.
    expect(
      campoPeloRotulo<HTMLSelectElement>(raiz(), 'Líder').selectedOptions[0].textContent?.trim(),
    ).toBe('Rafael Mendes');
    expect(raiz().textContent).toContain(
      'Quem é Comercial responde a um Líder Comercial ativo, da mesma área. Por isso só aparecem Líderes Comerciais.',
    );

    escolher(raiz(), 'Papel', 'Líder Marketing · Marketing');
    fixture.detectChanges();
    await responder(C_LEVELS, pagina([HELENA, MARCOS]));
    expect(opcoesDe(raiz(), 'Líder')).toEqual(['Helena Duarte', 'Marcos Andrade']);

    escolher(raiz(), 'Papel', 'C-level · Diretoria');
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
    expect(() => campoPeloRotulo(raiz(), 'Líder')).toThrow();
    expect(raiz().textContent).toContain('Quem é C-level não tem líder.');
  });

  it('sem nenhum líder possível, diz o que fazer e não deixa enviar', async () => {
    await abrir({ modo: 'convidar' });
    digitar(raiz(), 'Nome', 'Nova Pessoa');
    digitar(raiz(), 'E-mail', 'nova@brl.com.br');
    escolher(raiz(), 'Papel', 'CS · Customer Success');
    fixture.detectChanges();
    await responder('/api/v1/usuarios?papel=LIDER_CS&ativo=true&porPagina=100', pagina([]));
    expect(raiz().textContent).toContain('Não há nenhum Líder CS ativo para liderar quem é CS.');
    botaoComTexto(raiz(), 'Enviar convite').click();
    fixture.detectChanges();
    await microtarefas();
    http.expectNone('/api/v1/usuarios');
  });

  it('convida com o líder escolhido e avisa que o convite saiu', async () => {
    const sucesso = vi.spyOn(avisos, 'sucesso');
    await abrir({ modo: 'convidar' });
    digitar(raiz(), 'Nome', '  Nova Pessoa ');
    digitar(raiz(), 'E-mail', 'nova@brl.com.br');
    escolher(raiz(), 'Papel', 'Comercial · Comercial');
    fixture.detectChanges();
    await responder(
      LIDERES_COMERCIAIS,
      pagina([RAFAEL, usuario('u-outro', 'Outro Líder', 'LIDER_COMERCIAL')]),
    );
    escolher(raiz(), 'Líder', 'Outro Líder');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Enviar convite').click();
    fixture.detectChanges();

    const pedido = http.expectOne('/api/v1/usuarios');
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({
      nome: 'Nova Pessoa',
      email: 'nova@brl.com.br',
      papel: 'COMERCIAL',
      liderId: 'u-outro',
    });
    const criado = usuario('u-nova', 'Nova Pessoa', 'COMERCIAL', { senhaDefinida: false });
    pedido.flush({
      usuario: criado,
      convite: { enviado: true, expiraEm: '2026-10-22T18:05:00.000Z' },
    });
    await microtarefas();
    fixture.detectChanges();
    expect(sucesso).toHaveBeenCalledWith(
      expect.stringContaining('Convite enviado para nova@brl.com.br.'),
    );
    expect(fixture.componentInstance.salvos).toEqual([criado]);
    expect(fixture.componentInstance.pedido()).toBeNull();
  });

  it('com senha temporária, manda a senha e pede pelo menos 8 caracteres', async () => {
    await abrir({ modo: 'convidar' });
    digitar(raiz(), 'Nome', 'Diretora Nova');
    digitar(raiz(), 'E-mail', 'diretora@brl.com.br');
    escolher(raiz(), 'Papel', 'C-level · Diretoria');
    fixture.detectChanges();
    await microtarefas();
    const opcaoSenha = Array.from(
      raiz().querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    )[1];
    opcaoSenha.click();
    fixture.detectChanges();
    digitar(raiz(), 'Senha temporária', 'curta');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Cadastrar usuário').click();
    fixture.detectChanges();
    http.expectNone('/api/v1/usuarios');
    expect(raiz().textContent).toContain('Use pelo menos 8 caracteres.');

    digitar(raiz(), 'Senha temporária', 'Temporaria@2026');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Cadastrar usuário').click();
    const pedido = http.expectOne('/api/v1/usuarios');
    expect(pedido.request.body).toEqual({
      nome: 'Diretora Nova',
      email: 'diretora@brl.com.br',
      papel: 'C_LEVEL',
      senhaTemporaria: 'Temporaria@2026',
    });
    pedido.flush({
      usuario: usuario('u-d', 'Diretora Nova', 'C_LEVEL', { deveTrocarSenha: true }),
      convite: null,
    });
    await microtarefas();
  });

  it('e-mail repetido (409, R1.1) volta para o campo de e-mail', async () => {
    await abrir({ modo: 'convidar' });
    digitar(raiz(), 'Nome', 'Repetida');
    digitar(raiz(), 'E-mail', 'lucas@brl.com.br');
    escolher(raiz(), 'Papel', 'Admin · Sistema');
    fixture.detectChanges();
    await microtarefas();
    botaoComTexto(raiz(), 'Enviar convite').click();
    const falha = erroDaApiFalso(
      409,
      'conflito',
      'Já existe um usuário com o e-mail lucas@brl.com.br.',
      {
        regra: 'R1.1',
      },
    );
    http.expectOne('/api/v1/usuarios').flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    const email = campoPeloRotulo(raiz(), 'E-mail');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(raiz().textContent).toContain('Já existe um usuário com o e-mail lucas@brl.com.br.');
    expect(document.activeElement).toBe(email);
  });

  it('editar manda só o que mudou; liderados sem líder (R1.3) aparecem no campo papel', async () => {
    await abrir({ modo: 'editar', usuario: RAFAEL });
    await responder(C_LEVELS, pagina([HELENA]));
    expect((campoPeloRotulo(raiz(), 'Nome') as HTMLInputElement).value).toBe('Rafael Mendes');
    expect(
      campoPeloRotulo<HTMLSelectElement>(raiz(), 'Líder').selectedOptions[0].textContent?.trim(),
    ).toBe('Helena Duarte');

    escolher(raiz(), 'Papel', 'Comercial · Comercial');
    fixture.detectChanges();
    await responder(
      LIDERES_COMERCIAIS,
      pagina([RAFAEL, usuario('u-carla', 'Carla Nogueira', 'LIDER_COMERCIAL')]),
    );
    // A própria pessoa não aparece como líder dela mesma.
    expect(opcoesDe(raiz(), 'Líder')).toEqual(['Carla Nogueira']);
    botaoComTexto(raiz(), 'Salvar alterações').click();
    const pedido = http.expectOne('/api/v1/usuarios/u-rafael');
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).toEqual({ papel: 'COMERCIAL', liderId: 'u-carla' });
    const mensagem =
      'Rafael Mendes tem 2 liderados que precisam de um novo líder antes de mudar para Comercial: Lucas e Juliana.';
    const falha = erroDaApiFalso(422, 'regra_violada', mensagem, { regra: 'R1.3' });
    pedido.flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(campoPeloRotulo(raiz(), 'Papel').getAttribute('aria-invalid')).toBe('true');
    expect(raiz().textContent).toContain(mensagem);
  });

  it('editar sem mudar nada só fecha', async () => {
    const info = vi.spyOn(avisos, 'info');
    await abrir({ modo: 'editar', usuario: CAMILA });
    await responder(C_LEVELS, pagina([HELENA]));
    botaoComTexto(raiz(), 'Salvar alterações').click();
    await microtarefas();
    expect(info).toHaveBeenCalledWith('Nada mudou: não havia o que salvar.');
    expect(fixture.componentInstance.pedido()).toBeNull();
  });

  it('líder provisório (depois de um desligamento) aparece marcado e pede um líder da área', async () => {
    const provisorio = { ...LUCAS, lider: resumo('u-helena', 'Helena Duarte', 'C_LEVEL') };
    await abrir({ modo: 'editar', usuario: provisorio });
    await responder(LIDERES_COMERCIAIS, pagina([RAFAEL]));
    expect(opcoesDe(raiz(), 'Líder')).toEqual(['Rafael Mendes', 'Helena Duarte (provisório)']);
    expect(raiz().textContent).toContain('Este líder é provisório');
    escolher(raiz(), 'Líder', 'Rafael Mendes');
    fixture.detectChanges();
    expect(raiz().textContent).not.toContain('Este líder é provisório');
    botaoComTexto(raiz(), 'Salvar alterações').click();
    const pedido = http.expectOne('/api/v1/usuarios/u-lucas');
    expect(pedido.request.body).toEqual({ liderId: 'u-rafael' });
    pedido.flush({ ...LUCAS });
    await microtarefas();
  });
});
