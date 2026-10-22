import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { Usuario } from './configuracoes.modelos';
import {
  botaoComTexto,
  erroDaApiFalso,
  escolher,
  microtarefas,
  opcoesDe,
  pagina,
  PEDRO,
  RAFAEL,
  resumo,
  usuario,
} from './dados-de-teste';
import { ReativarUsuario } from './reativar-usuario';

@Component({
  imports: [ReativarUsuario],
  template: `<app-reativar-usuario
    [usuario]="usuario()"
    (reativado)="reativados.push($event)"
    (fechado)="usuario.set(null)"
  />`,
})
class Hospedeiro {
  readonly usuario = signal<Usuario | null>(null);
  readonly reativados: Usuario[] = [];
}

const LIDERES_COMERCIAIS = '/api/v1/usuarios?papel=LIDER_COMERCIAL&ativo=true&porPagina=100';

describe('ReativarUsuario (R7.5)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Hospedeiro>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;

  async function abrir(alvo: Usuario, lideres: readonly Usuario[]) {
    fixture.componentInstance.usuario.set(alvo);
    fixture.detectChanges();
    http.expectOne(LIDERES_COMERCIAIS).flush(pagina(lideres));
    await microtarefas();
    fixture.detectChanges();
  }

  it('avisa que o encaminhado não volta e reativa com o líder de antes', async () => {
    await abrir(PEDRO, [RAFAEL, usuario('u-carla', 'Carla Nogueira', 'LIDER_COMERCIAL')]);
    expect(raiz().textContent).toContain('continua com quem recebeu.');
    expect(raiz().textContent).not.toMatch(/\(R\d/);
    expect(opcoesDe(raiz(), 'Líder')).toEqual(['Rafael Mendes', 'Carla Nogueira']);
    botaoComTexto(raiz(), 'Reativar Pedro').click();
    const pedido = http.expectOne('/api/v1/usuarios/u-pedro/reativar');
    expect(pedido.request.body).toEqual({ liderId: 'u-rafael' });
    pedido.flush({ ...PEDRO, ativo: true });
    await microtarefas();
    expect(fixture.componentInstance.reativados).toHaveLength(1);
    expect(fixture.componentInstance.usuario()).toBeNull();
  });

  it('exige líder quando o de antes foi desligado; o erro da API vai para o campo', async () => {
    const semLider = {
      ...PEDRO,
      lider: resumo('u-velho', 'Líder Antigo', 'LIDER_COMERCIAL', { ativo: false }),
    };
    await abrir(semLider, [RAFAEL, usuario('u-carla', 'Carla Nogueira', 'LIDER_COMERCIAL')]);
    botaoComTexto(raiz(), 'Reativar Pedro').click();
    fixture.detectChanges();
    http.expectNone('/api/v1/usuarios/u-pedro/reativar');
    expect(raiz().textContent).toContain('Escolha o líder.');

    escolher(raiz(), 'Líder', 'Carla Nogueira');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Reativar Pedro').click();
    const mensagem =
      'O líder escolhido, Carla Nogueira, foi desligado: o líder precisa estar ativo.';
    const falha = erroDaApiFalso(422, 'regra_violada', mensagem, { regra: 'R1.2' });
    http.expectOne('/api/v1/usuarios/u-pedro/reativar').flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain(mensagem);
  });

  it('voltar em outro papel troca as opções de líder e manda o papel novo', async () => {
    await abrir(PEDRO, [RAFAEL]);
    escolher(raiz(), 'Papel', 'Líder Comercial · Comercial');
    fixture.detectChanges();
    http
      .expectOne('/api/v1/usuarios?papel=C_LEVEL&ativo=true&porPagina=100')
      .flush(pagina([usuario('u-helena', 'Helena Duarte', 'C_LEVEL')]));
    await microtarefas();
    fixture.detectChanges();
    expect(opcoesDe(raiz(), 'Líder')).toEqual(['Helena Duarte']);
    botaoComTexto(raiz(), 'Reativar Pedro').click();
    const pedido = http.expectOne('/api/v1/usuarios/u-pedro/reativar');
    expect(pedido.request.body).toEqual({ papel: 'LIDER_COMERCIAL', liderId: 'u-helena' });
    pedido.flush({ ...PEDRO, ativo: true, papel: 'LIDER_COMERCIAL' });
    await microtarefas();
  });
});
