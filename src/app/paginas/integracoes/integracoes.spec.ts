import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { LucidePlus } from '@lucide/angular';

import { registrarAcaoPrincipal } from './comum/acao-da-secao';
import { formatarJson, partesComCodigo } from './comum/copiar';
import { aspasDoShell, exemploCurlEntrada } from './exemplos';
import { Integracoes } from './integracoes';

let novos = 0;

@Component({
  selector: 'app-secao-falsa',
  template: '<p>seção</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class SecaoFalsa {
  constructor() {
    registrarAcaoPrincipal({
      rotulo: 'Novo webhook de saída',
      icone: LucidePlus,
      executar: () => novos++,
    });
  }
}

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class SecaoSemAcao {}

@Component({
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class RaizDeTeste {}

describe('exemplos e apoio', () => {
  it('curl sem assinatura manda o JSON como veio', () => {
    expect(exemploCurlEntrada('http://crm/x', { name: 'Ana' })).toBe(
      [
        "curl -X POST 'http://crm/x' \\",
        "  -H 'Content-Type: application/json' \\",
        `  --data-raw '{"name":"Ana"}'`,
      ].join('\n'),
    );
  });

  it('curl com assinatura calcula o X-Assinatura com o segredo (ou SEU_SEGREDO)', () => {
    const comSegredo = exemploCurlEntrada('http://crm/x', { a: 1 }, { exige: true, segredo: 's3' });
    expect(comSegredo).toContain("openssl dgst -sha256 -hmac 's3'");
    expect(comSegredo).toContain('-H "X-Assinatura: sha256=$ASSINATURA"');
    expect(exemploCurlEntrada('http://crm/x', {}, { exige: true })).toContain("'SEU_SEGREDO'");
  });

  it('protege aspas simples para o shell', () => {
    expect(aspasDoShell("D'Ávila")).toBe(`'D'\\''Ávila'`);
  });

  it('separa os trechos entre crases e formata JSON', () => {
    expect(partesComCodigo('Campos `name` e `email`.')).toEqual([
      { texto: 'Campos ', codigo: false },
      { texto: 'name', codigo: true },
      { texto: ' e ', codigo: false },
      { texto: 'email', codigo: true },
      { texto: '.', codigo: false },
    ]);
    expect(formatarJson({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(formatarJson(null)).toBe('—');
  });
});

describe('Integracoes (moldura)', () => {
  beforeEach(() => {
    novos = 0;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'integracoes',
            component: Integracoes,
            children: [
              { path: 'saida', component: SecaoFalsa },
              { path: 'aplicativos', component: SecaoSemAcao },
              { path: 'historico', component: SecaoSemAcao },
            ],
          },
        ]),
      ],
    });
  });

  async function abrir(url: string) {
    const fixture = TestBed.createComponent(RaizDeTeste);
    await TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('mostra o título, as seções e a ação principal da seção aberta', async () => {
    const raiz = await abrir('/integracoes/saida');
    expect(raiz.querySelector('h1')?.textContent).toBe('Integrações — Webhooks e aplicativos');
    const secoes = Array.from(raiz.querySelectorAll('.moldura__secao')).map((a) =>
      a.textContent?.trim(),
    );
    expect(secoes).toEqual(['Aplicativos', 'Histórico', 'Webhooks de saída']);
    const ativa = raiz.querySelector('[aria-current="page"]');
    expect(ativa?.textContent?.trim()).toBe('Webhooks de saída');
    const acao = raiz.querySelector<HTMLButtonElement>('.moldura__acao')!;
    expect(acao.textContent?.trim()).toBe('Novo webhook de saída');
    acao.click();
    expect(novos).toBe(1);
    // No celular, a mesma ação vira o botão flutuante (com nome para o leitor de tela).
    expect(raiz.querySelector('.moldura__flutuante')?.getAttribute('aria-label')).toBe(
      'Novo webhook de saída',
    );
  });

  it('a ação some quando a seção não tem uma', async () => {
    const raiz = await abrir('/integracoes/aplicativos');
    expect(raiz.querySelector('.moldura__acao')).toBeNull();
  });
});
