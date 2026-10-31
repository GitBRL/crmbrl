import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { detalhe } from './dados-de-teste';
import { DisparoNovo } from './disparo-novo';

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const vazia = { itens: [], total: 0, pagina: 1, porPagina: 20 };

describe('DisparoNovo (assistente)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('LIDER_COMERCIAL');
  });

  async function passar(fixture: ComponentFixture<unknown>) {
    await new Promise((resolver) => setTimeout(resolver));
    fixture.detectChanges();
  }

  /** Responde o que o assistente pede ao abrir (canais, etiquetas, pessoas, importações, modelos, variáveis). */
  function responderApoio() {
    for (const pedido of http.match(() => true)) {
      const url = pedido.request.url;
      if (url.endsWith('/disparos/canais')) {
        pedido.flush([
          { id: 'c1', tipo: 'WHATSAPP', nome: 'WhatsApp Vendas', ativo: true, disponivel: true },
          { id: 'c2', tipo: 'WHATSAPP', nome: 'WhatsApp Suporte', ativo: true, disponivel: false },
        ]);
      } else if (url.endsWith('/modelos/variaveis')) {
        pedido.flush({ variaveis: [{ chave: 'contato.nome', rotulo: 'Nome' }] });
      } else if (url.endsWith('/importacoes') || url.endsWith('/modelos-mensagem')) {
        pedido.flush(vazia);
      } else if (url.endsWith('/usuarios')) {
        pedido.flush(vazia);
      } else {
        pedido.flush([]);
      }
    }
  }

  async function abrir() {
    const fixture = TestBed.createComponent(DisparoNovo);
    fixture.detectChanges();
    await passar(fixture);
    responderApoio();
    await passar(fixture);
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  const clicar = (raiz: HTMLElement, rotulo: string) =>
    ([...raiz.querySelectorAll('button')] as HTMLButtonElement[])
      .find((b) => texto(b) === rotulo)
      ?.click();

  it('começa no passo 1 com os cinco passos na trilha', async () => {
    const { raiz } = await abrir();
    expect(texto(raiz)).toContain('Quem vai receber');
    const passos = [...raiz.querySelectorAll('.passos__rotulo')].map((p) => texto(p));
    expect(passos).toEqual(['Público', 'Mensagem', 'Números e ritmo', 'Quando enviar', 'Revisão']);
    expect(raiz.querySelector('[aria-current=step]')).not.toBeNull();
  });

  it('não avança sem o nome da campanha', async () => {
    const { fixture, raiz } = await abrir();
    clicar(raiz, 'Continuar');
    await passar(fixture);
    expect(texto(raiz.querySelector('[role=alert]'))).toContain('Dê um nome');
    http.expectNone('/api/v1/disparos/campanhas');
  });

  it('com o nome, salva o rascunho (sem canal de envio ainda) e vai para a mensagem', async () => {
    const { fixture, raiz } = await abrir();
    const nome = raiz.querySelector('input[type=text]') as HTMLInputElement;
    nome.value = 'Minha campanha';
    nome.dispatchEvent(new Event('input', { bubbles: true }));
    await passar(fixture);
    clicar(raiz, 'Continuar');
    await passar(fixture);
    const pedido = http.expectOne(
      (r) => r.method === 'POST' && r.url === '/api/v1/disparos/campanhas',
    );
    expect(pedido.request.body).toMatchObject({
      nome: 'Minha campanha',
      canal: 'WHATSAPP',
      tipoPublico: 'SEGMENTO',
      segmento: { combinacao: 'todas', condicoes: [] },
    });
    expect('canalIds' in pedido.request.body).toBe(false);
    pedido.flush(detalhe('novo', { status: 'RASCUNHO' }));
    await passar(fixture);
    await passar(fixture);
    expect(texto(raiz)).toContain('O que dizer');
    expect(texto(raiz.querySelector('h1'))).toBe('Editar campanha');
  });

  it('o canal não muda depois que o rascunho existe', async () => {
    const { fixture, raiz } = await abrir();
    const nome = raiz.querySelector('input[type=text]') as HTMLInputElement;
    nome.value = 'X';
    nome.dispatchEvent(new Event('input', { bubbles: true }));
    await passar(fixture);
    const radios = () => [...raiz.querySelectorAll('app-grupo-opcoes input')] as HTMLInputElement[];
    expect(radios().some((r) => r.disabled)).toBe(false);
    clicar(raiz, 'Continuar');
    await passar(fixture);
    http
      .expectOne((r) => r.method === 'POST' && r.url === '/api/v1/disparos/campanhas')
      .flush(detalhe('novo', { status: 'RASCUNHO' }));
    await passar(fixture);
    await passar(fixture);
    clicar(raiz, 'Voltar');
    await passar(fixture);
    expect(texto(raiz)).toContain('Por onde enviar');
    expect(radios().some((r) => r.disabled)).toBe(true);
  });
});
