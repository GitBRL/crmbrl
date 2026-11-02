import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import type { Contato } from './contatos.tipos';
import { contatoDeTeste } from './dados-de-teste';
import { diferencaDosCampos, FormularioContato } from './formulario-contato';

@Component({
  imports: [FormularioContato],
  template: `
    <app-formulario-contato [(aberto)]="aberto" [contato]="contato()" (salvo)="salvo = $event" />
  `,
})
class Hospedeiro {
  readonly aberto = signal(false);
  readonly contato = signal<Contato | null>(null);
  salvo: Contato | null = null;
}

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

describe('FormularioContato', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Hospedeiro>;
  let euId = '';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    euId = entrarComo('COMERCIAL').usuario.id;
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Hospedeiro);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  async function abrir(contato: Contato | null = null) {
    fixture.componentInstance.contato.set(contato);
    fixture.componentInstance.aberto.set(true);
    fixture.detectChanges();
    await esperar(0);
    fixture.detectChanges();
    http
      .expectOne((req) => req.url === '/api/v1/usuarios')
      .flush({
        itens: [
          {
            id: euId,
            nome: 'João Batista',
            papel: 'COMERCIAL',
            rotuloPapel: 'Comercial',
            ativo: true,
          },
        ],
        total: 1,
        pagina: 1,
        porPagina: 100,
      });
    http.expectOne((req) => req.url === '/api/v1/contatos/etiquetas').flush([]);
    fixture.detectChanges();
  }

  const raiz = () => fixture.nativeElement as HTMLElement;

  function campo(rotulo: string): HTMLInputElement {
    const label = [...raiz().querySelectorAll('label')].find((item) =>
      item.textContent?.trim().startsWith(rotulo),
    ) as HTMLLabelElement;
    return raiz().querySelector(`#${label.htmlFor}`) as HTMLInputElement;
  }

  function digitar(rotulo: string, valor: string) {
    const entrada = campo(rotulo);
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    entrada.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function enviar() {
    (raiz().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('mostra em tempo real o contato que já tem o mesmo e-mail e oferece abrir (R4.2)', async () => {
    await abrir();
    digitar('Nome', 'Ana');
    digitar('E-mail', 'ANA.lopes@clinica.example.com ');
    await esperar(450);
    fixture.detectChanges();

    const porEmail = http.expectOne(
      (req) =>
        req.url === '/api/v1/contatos' &&
        req.params.get('busca') === 'ana.lopes@clinica.example.com',
    );
    porEmail.flush({ itens: [contatoDeTeste()], total: 1, pagina: 1, porPagina: 5 });
    http
      .expectOne((req) => req.url === '/api/v1/contatos' && req.params.get('busca') === 'Ana')
      .flush({ itens: [contatoDeTeste()], total: 1, pagina: 1, porPagina: 4 });
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = raiz().textContent ?? '';
    expect(texto).toContain('Ana Beatriz Lopes já está no CRM com o mesmo e-mail.');
    expect(texto).toContain('o CRM não cria outro contato');
    // O mesmo contato não aparece de novo em "nome parecido".
    expect(texto).not.toContain('Pessoas com nome parecido');
    const abrirContato = [...raiz().querySelectorAll('a')].find(
      (link) => link.textContent?.trim() === 'Abrir contato',
    ) as HTMLAnchorElement;
    expect(abrirContato.getAttribute('href')).toBe(
      '/contatos/11111111-1111-4111-8111-111111111111',
    );
  });

  it('sem e-mail nem telefone não envia e diz o que falta (R4.1)', async () => {
    await abrir();
    digitar('Nome', 'Pessoa sem meio');
    enviar();
    await esperar(0);
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Informe o e-mail, o telefone ou os dois.');
    http.expectNone((req) => req.method === 'POST');
  });

  it('cria o contato; quando a API reconverte o existente, avisa em vez de dizer "criado"', async () => {
    await abrir();
    digitar('Nome', 'Ana Lopes');
    digitar('Telefone', '(41) 98877-1201');
    enviar();
    await esperar(0);

    const pedido = http.expectOne((req) => req.method === 'POST');
    expect(pedido.request.url).toBe('/api/v1/contatos');
    expect(pedido.request.body).toEqual({
      nome: 'Ana Lopes',
      email: null,
      telefone: '(41) 98877-1201',
      cargo: null,
      responsavelId: euId,
      origem: 'MANUAL',
      origemDetalhe: null,
      utm: null,
      etiquetas: [],
      optOutMarketing: false,
      consentimento: null,
    });
    pedido.flush({ criado: false, contato: contatoDeTeste() });
    await esperar(0);

    const avisos = TestBed.inject(AvisosService).lista();
    expect(avisos.at(-1)).toMatchObject({ tipo: 'info', titulo: 'Contato já existia' });
    expect(fixture.componentInstance.salvo?.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(fixture.componentInstance.aberto()).toBe(false);
  });

  it('na edição, só o que mudou vai para a API; e-mail de outro contato (409) vai para o campo', async () => {
    await abrir(contatoDeTeste());
    digitar('E-mail', 'outra@example.com');
    enviar();
    await esperar(0);

    const pedido = http.expectOne((req) => req.method === 'PATCH');
    expect(pedido.request.body).toEqual({ email: 'outra@example.com' });
    pedido.flush(
      {
        statusCode: 409,
        erro: 'conflito',
        mensagem: 'Já existe um contato com este e-mail.',
        detalhes: { regra: 'R4.2', campos: ['email'], contatoId: 'outro-id' },
        requisicaoId: 'r1',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await esperar(0);
    fixture.detectChanges();

    expect(campo('E-mail').getAttribute('aria-invalid')).toBe('true');
    expect(raiz().textContent).toContain('Já existe um contato com este e-mail.');
    expect(raiz().textContent).toContain('Abrir o contato que já usa esse dado');
    expect(fixture.componentInstance.aberto()).toBe(true);
  });

  it('calcula a mudança dos campos personalizados (chave tirada vira null)', () => {
    expect(
      diferencaDosCampos({ faturamento: '50 mil', segmento: 'Varejo', notas: 3 }, [
        { chave: 'faturamento', valor: '80 mil' },
        { chave: 'notas', valor: '3' },
        { chave: ' cidade ', valor: 'Curitiba' },
        { chave: '', valor: 'ignorado' },
      ]),
    ).toEqual({ segmento: null, faturamento: '80 mil', cidade: 'Curitiba' });
    expect(diferencaDosCampos({ a: 'x' }, [{ chave: 'a', valor: 'x' }])).toBeNull();
  });
});
