import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  type Route,
  Router,
  TitleStrategy,
  withComponentInputBinding,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { App } from './app';
import { routes } from './app.routes';
import { MODULOS } from './nucleo/navegacao';
import type { Papel } from './nucleo/papeis';
import { SessaoService } from './nucleo/sessao/sessao.service';
import { entrarComo } from './nucleo/sessao/sessao-de-teste';
import { TituloPagina } from './nucleo/titulo-pagina';

@Component({ template: '<p>página</p>' })
class PaginaFalsa {}

describe('App', () => {
  it('só tem o roteamento e liga o tema na partida', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('router-outlet')).not.toBeNull();
    expect(raiz.querySelector('h1')).toBeNull();
    expect(document.documentElement.getAttribute('data-tema')).toMatch(/^(escuro|claro)$/);
  });

  it('título da aba: "<página> · BRL CRM"', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'x', title: 'Visão geral', component: PaginaFalsa }]),
        { provide: TitleStrategy, useClass: TituloPagina },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/x');
    expect(document.title).toBe('Visão geral · BRL CRM');
  });
});

const UUID = '1e61b8e7-0cb3-4184-a167-77f7c5febf42';

describe('app.routes', () => {
  const casca = routes.find((rota) => rota.canActivate?.length) as Route;
  const filhas: Route[] = casca.children ?? [];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          routes,
          withComponentInputBinding(),
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TitleStrategy, useClass: TituloPagina },
      ],
    });
  });

  /** Um harness por teste (o RouterTestingHarness não deixa criar dois). */
  let harness: RouterTestingHarness | null = null;
  afterEach(() => {
    harness = null;
  });

  async function abrir(url: string, papel: Papel | null = 'ADMIN') {
    if (papel) {
      entrarComo(papel);
    } else {
      TestBed.inject(SessaoService).encerrarLocalmente();
    }
    harness ??= await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await estabilizar(harness);
    return { raiz: harness.fixture.nativeElement as HTMLElement };
  }

  /**
   * Espera a tela ficar estável. Telas com `rxResource` (contatos) seguram a estabilidade
   * enquanto a consulta não volta, e aqui ninguém responde: as consultas pendentes recebem
   * um 503, a tela vai para o estado de erro e o app estabiliza.
   */
  async function estabilizar(atual: RouterTestingHarness) {
    const http = TestBed.inject(HttpTestingController);
    let estavel = false;
    const pronto = atual.fixture.whenStable().then(() => (estavel = true));
    for (let tentativa = 0; tentativa < 50 && !estavel; tentativa++) {
      await new Promise((resolver) => setTimeout(resolver, 10));
      for (const pendente of http.match(() => true)) {
        pendente.flush(null, { status: 503, statusText: 'Indisponível' });
      }
    }
    await pronto;
  }

  it('a casca exige sessão e confere o módulo; "/" vai para /inicio e "**" para a 404', () => {
    expect(casca.loadComponent).toBeDefined();
    expect(casca.canActivateChild?.length).toBe(2);
    expect(filhas[0]).toMatchObject({ path: '', redirectTo: 'inicio', pathMatch: 'full' });
    expect(filhas[filhas.length - 1].path).toBe('**');
  });

  it('módulos "em breve" saem da navegação, com título e o id em data.modulo', () => {
    for (const modulo of MODULOS.filter((item) => item.status === 'em-breve')) {
      const rota = filhas.find((item) => item.path === modulo.rota.slice(1));
      expect(rota, modulo.rota).toBeDefined();
      expect(rota?.loadComponent).toBeDefined();
      expect(rota?.title).toBe(modulo.rotulo);
      expect(rota?.data).toEqual({ modulo: modulo.id });
    }
  });

  // Cada tela da Fase 1 abre o seu componente (os esqueletos das pastas de tela).
  const TELAS: readonly [url: string, seletor: string, titulo: string][] = [
    ['/inicio', 'app-inicio', 'Visão geral'],
    ['/funis/comercial', 'app-quadro-funil', 'Comercial'],
    [`/funis/cs/${UUID}`, 'app-detalhe-negocio', 'Negócio'],
    ['/contatos', 'app-contatos', 'Contatos e empresas'],
    [`/contatos/${UUID}`, 'app-detalhe-contato', 'Contato'],
    [`/empresas/${UUID}`, 'app-detalhe-empresa', 'Empresa'],
    ['/atividades', 'app-atividades', 'Atividades'],
    ['/configuracoes/usuarios', 'app-usuarios', 'Usuários'],
    ['/configuracoes/perfil', 'app-meu-perfil', 'Meu perfil'],
    ['/configuracoes/distribuicao', 'app-distribuicao', 'Distribuição de leads'],
    ['/configuracoes/passagens', 'app-passagens', 'Passagens entre funis'],
    ['/integracoes/entrada', 'app-webhooks-entrada', 'Webhooks de entrada'],
    ['/integracoes/saida', 'app-webhooks-saida', 'Webhooks de saída'],
    ['/administracao/auditoria', 'app-auditoria', 'Auditoria'],
    ['/administracao/logs', 'app-logs-tecnicos', 'Logs técnicos'],
    ['/administracao/ia', 'app-duvidas-ia', 'Dúvidas à IA'],
    ['/sem-acesso?pagina=%2Fintegracoes', 'app-sem-acesso', 'Sem acesso'],
    ['/financeiro', 'app-em-breve', 'Financeiro'],
    ['/disparos', 'app-disparos', 'Disparos'],
    ['/disparos/novo', 'app-disparo-novo', 'Nova campanha'],
    [`/disparos/${UUID}`, 'app-detalhe-disparo', 'Campanha'],
    ['/chatbot', 'app-chatbot', 'Chatbot'],
    ['/chatbot/novo', 'app-novo-fluxo', 'Novo fluxo'],
    [`/chatbot/${UUID}`, 'app-editor-fluxo', 'Fluxo do chatbot'],
    ['/automacoes', 'app-automacoes', 'Automações'],
    ['/automacoes/nova', 'app-editor-automacao', 'Nova automação'],
    [`/automacoes/${UUID}`, 'app-editor-automacao', 'Automação'],
    ['/contatos/importar', 'app-importar-contatos', 'Importar contatos'],
    ['/trocar-senha', 'app-trocar-senha', 'Trocar senha'],
    ['/redefinir-senha?token=abc', 'app-redefinir-senha', 'Redefinir senha'],
    ['/definir-senha?token=abc', 'app-definir-senha', 'Definir senha'],
  ];

  for (const [url, seletor, titulo] of TELAS) {
    it(`${url} abre ${seletor}`, async () => {
      const { raiz } = await abrir(url);
      expect(raiz.querySelector(seletor), url).not.toBeNull();
      expect(document.title).toBe(`${titulo} · BRL CRM`);
    });
  }

  it('as telas de quem não entrou ficam fora da casca', async () => {
    const { raiz } = await abrir('/entrar', null);
    expect(raiz.querySelector('app-entrar')).not.toBeNull();
    expect(raiz.querySelector('app-casca')).toBeNull();
    expect(raiz.querySelector('main#conteudo')).not.toBeNull();
    const esqueci = await abrir('/esqueci-senha', null);
    expect(esqueci.raiz.querySelector('app-esqueci-senha')).not.toBeNull();
  });

  it('redirecionamentos: seção padrão, links das notificações e a lista de empresas', async () => {
    const casos: readonly [de: string, para: string, papel?: Papel][] = [
      ['/configuracoes', '/configuracoes/usuarios'],
      ['/configuracoes', '/configuracoes/perfil', 'COMERCIAL'],
      ['/administracao', '/administracao/auditoria', 'C_LEVEL'],
      ['/administracao/usuarios', '/configuracoes/usuarios'],
      ['/integracoes', '/integracoes/entrada'],
      ['/integracoes?webhookSaida=w1', '/integracoes/saida?webhookSaida=w1'],
      ['/empresas', '/contatos?aba=empresas'],
      ['/funis', '/funis/marketing'],
      ['/funis', '/funis/cs', 'CS'],
    ];
    for (const [de, para, papel] of casos) {
      await abrir(de, papel ?? 'ADMIN');
      expect(TestBed.inject(Router).url, de).toBe(para);
    }
  });
});
