import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AvisosService } from '../../nucleo/avisos.service';
import type { PreviaDesligamento, ResultadoDesligamento, Usuario } from './configuracoes.modelos';
import {
  botaoComTexto,
  digitar,
  erroDaApiFalso,
  escolher,
  HELENA,
  LUCAS,
  microtarefas,
  RAFAEL,
  resumo,
} from './dados-de-teste';
import { DesligarUsuario } from './desligar-usuario';

@Component({
  imports: [DesligarUsuario],
  template: `<app-desligar-usuario
    [usuario]="usuario()"
    (desligado)="resultados.push($event)"
    (fechado)="usuario.set(null)"
  />`,
})
class Hospedeiro {
  readonly usuario = signal<Usuario | null>(null);
  readonly resultados: ResultadoDesligamento[] = [];
}

const ZERO = {
  atividades: 0,
  negocios: 0,
  contatos: 0,
  empresas: 0,
  liderados: 0,
  responsavelFixo: 0,
};
const RAFAEL_RESUMO = resumo('u-rafael', 'Rafael Mendes', 'LIDER_COMERCIAL');
const HELENA_RESUMO = resumo('u-helena', 'Helena Duarte', 'C_LEVEL');

function previaDoLucas(ajustes: Partial<PreviaDesligamento> = {}): PreviaDesligamento {
  return {
    usuario: resumo('u-lucas', 'Lucas Pereira', 'COMERCIAL'),
    destinatario: RAFAEL_RESUMO,
    motivoDestinatario: 'LIDER',
    explicacao: 'O que está com Lucas Pereira (Comercial) vai para o líder, Rafael Mendes.',
    exigeEscolha: false,
    candidatos: [],
    ignorados: [],
    contagens: { ...ZERO, atividades: 12, negocios: 3, contatos: 5 },
    liderados: [],
    alertaEquipeSemLider: false,
    ...ajustes,
  };
}

describe('DesligarUsuario (prévia R7.1 e confirmação)', () => {
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

  async function abrir(usuario: Usuario, previa: PreviaDesligamento) {
    fixture.componentInstance.usuario.set(usuario);
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Carregando a prévia do desligamento');
    http.expectOne(`/api/v1/usuarios/${usuario.id}/desligamento/previa`).flush(previa);
    await microtarefas();
    fixture.detectChanges();
  }

  it('mostra quem recebe e quanto, e só libera depois de digitar o primeiro nome', async () => {
    await abrir(LUCAS, previaDoLucas());
    const texto = raiz().textContent ?? '';
    expect(texto).toContain(
      'As 12 atividades pendentes, 3 negócios abertos e 5 contatos de Lucas vão para Rafael Mendes (Líder Comercial).',
    );
    expect(texto).toContain('Quem recebe');
    expect(texto).toContain(
      'O que está com Lucas Pereira (Comercial) vai para o líder, Rafael Mendes.',
    );
    expect(texto).toContain('Lucas perde o acesso na hora');

    const botao = botaoComTexto(raiz(), 'Desligar Lucas');
    expect(botao.disabled).toBe(true);
    digitar(raiz(), 'Digite “Lucas” para confirmar', 'luc');
    fixture.detectChanges();
    expect(botao.disabled).toBe(true);
    digitar(raiz(), 'Digite “Lucas” para confirmar', ' LÚCAS ');
    fixture.detectChanges();
    expect(botao.disabled).toBe(false);

    const sucesso = vi.spyOn(TestBed.inject(AvisosService), 'sucesso');
    botao.click();
    const pedido = http.expectOne('/api/v1/usuarios/u-lucas/desligar');
    expect(pedido.request.method).toBe('POST');
    // O destinatário da prévia vai junto, como confirmação (409 se a situação mudou).
    expect(pedido.request.body).toEqual({ destinatarioId: 'u-rafael' });
    const resultado: ResultadoDesligamento = {
      usuario: { ...LUCAS, ativo: false },
      destinatario: RAFAEL_RESUMO,
      motivoDestinatario: 'LIDER',
      contagens: { ...ZERO, atividades: 12, negocios: 3, contatos: 5, sessoesRevogadas: 1 },
    };
    pedido.flush(resultado);
    await microtarefas();
    fixture.detectChanges();
    expect(sucesso).toHaveBeenCalledWith(
      'Lucas Pereira foi desligado(a). 12 atividades pendentes, 3 negócios abertos e 5 contatos foram para Rafael Mendes.',
    );
    expect(fixture.componentInstance.resultados).toEqual([resultado]);
    expect(fixture.componentInstance.usuario()).toBeNull();
  });

  it('líder: liderados passam ao C-level e os Admins recebem o alerta', async () => {
    await abrir(
      RAFAEL,
      previaDoLucas({
        usuario: RAFAEL_RESUMO,
        destinatario: HELENA_RESUMO,
        motivoDestinatario: 'C_LEVEL_RESPONSAVEL',
        explicacao:
          'O que está com Rafael Mendes (Líder Comercial) vai para o C-level responsável, Helena Duarte.',
        contagens: { ...ZERO, atividades: 7, liderados: 2 },
        liderados: [
          resumo('u-lucas', 'Lucas Pereira', 'COMERCIAL'),
          resumo('u-ju', 'Juliana Alves', 'COMERCIAL'),
        ],
        alertaEquipeSemLider: true,
      }),
    );
    const texto = raiz().textContent ?? '';
    expect(texto).toContain('Lucas Pereira e Juliana Alves passam a responder a Helena Duarte');
    expect(texto).toContain('equipe sem líder');
  });

  it('C-level: escolhe o C-level que recebe e a prévia é refeita com ele', async () => {
    const marcos = { ...HELENA, id: 'u-marcos', nome: 'Marcos Andrade' };
    await abrir(
      marcos,
      previaDoLucas({
        usuario: resumo('u-marcos', 'Marcos Andrade', 'C_LEVEL'),
        destinatario: null,
        motivoDestinatario: null,
        exigeEscolha: true,
        explicacao:
          'Marcos Andrade (C-level) é C-level: escolha outro C-level ativo para receber o que está com Marcos Andrade.',
        candidatos: [HELENA_RESUMO],
      }),
    );
    expect(raiz().textContent).toContain('Quem recebe');
    expect(botaoComTexto(raiz(), 'Desligar Marcos').disabled).toBe(true);

    escolher(raiz(), 'Quem recebe', 'Helena Duarte');
    fixture.detectChanges();
    http.expectOne('/api/v1/usuarios/u-marcos/desligamento/previa?destinatarioId=u-helena').flush(
      previaDoLucas({
        usuario: resumo('u-marcos', 'Marcos Andrade', 'C_LEVEL'),
        destinatario: HELENA_RESUMO,
        motivoDestinatario: 'ESCOLHIDO_PELO_ADMIN',
        exigeEscolha: true,
        explicacao:
          'O que está com Marcos Andrade (C-level) vai para o C-level escolhido, Helena Duarte.',
        contagens: { ...ZERO, contatos: 2 },
      }),
    );
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain(
      'Os 2 contatos de Marcos vão para Helena Duarte (C-level).',
    );
    // A escolha continua visível depois da nova prévia (a API não repete os candidatos).
    expect(raiz().textContent).toContain('Helena Duarte');
    digitar(raiz(), 'Digite “Marcos” para confirmar', 'Marcos');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Desligar Marcos').click();
    const pedido = http.expectOne('/api/v1/usuarios/u-marcos/desligar');
    expect(pedido.request.body).toEqual({ destinatarioId: 'u-helena' });
    pedido.flush({
      usuario: { ...marcos, ativo: false },
      destinatario: HELENA_RESUMO,
      motivoDestinatario: 'ESCOLHIDO_PELO_ADMIN',
      contagens: { ...ZERO, contatos: 2, sessoesRevogadas: 0 },
    });
    await microtarefas();
  });

  it('se a situação mudou desde a prévia (409), mostra o motivo e refaz a prévia', async () => {
    await abrir(LUCAS, previaDoLucas());
    digitar(raiz(), 'Digite “Lucas” para confirmar', 'Lucas');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Desligar Lucas').click();
    const mensagem =
      'Quem recebe o que está com Lucas Pereira é Helena Duarte, não o destinatário informado — a situação mudou desde a prévia ou a escolha não se aplica. Confira a prévia de novo.';
    const falha = erroDaApiFalso(409, 'conflito', mensagem);
    http.expectOne('/api/v1/usuarios/u-lucas/desligar').flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    http
      .expectOne('/api/v1/usuarios/u-lucas/desligamento/previa')
      .flush(previaDoLucas({ destinatario: HELENA_RESUMO, motivoDestinatario: 'SUBIU_NA_CADEIA' }));
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('[role="alert"]')?.textContent).toContain(
      'a situação mudou desde a prévia',
    );
    expect(raiz().textContent).toContain('vão para Helena Duarte (C-level)');
    expect(fixture.componentInstance.usuario()).not.toBeNull();
  });

  it('prévia recusada pela regra (último Admin, R1.4) explica e não oferece tentar de novo', async () => {
    fixture.componentInstance.usuario.set(LUCAS);
    fixture.detectChanges();
    const falha = erroDaApiFalso(422, 'regra_violada', 'Sempre existe pelo menos um Admin ativo.', {
      regra: 'R1.4',
    });
    http.expectOne('/api/v1/usuarios/u-lucas/desligamento/previa').flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Não dá para desligar agora');
    expect(raiz().textContent).toContain('Sempre existe pelo menos um Admin ativo.');
    expect(() => botaoComTexto(raiz(), 'Tentar de novo')).toThrow();
  });
});
