import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { RespostaSaude } from '../../nucleo/saude';
import { SaudeService, URL_SAUDE } from '../../nucleo/saude.service';
import {
  formatarDuracao,
  formatarLatencia,
  partirMigracao,
  StatusSistema,
  traduzirAmbiente,
} from './status-sistema';

const RESPOSTA_OK: RespostaSaude = {
  status: 'ok',
  versao: '0.0.1',
  ambiente: 'development',
  horario: '2026-10-20T18:00:00.000Z',
  uptimeSegundos: 3720,
  banco: { status: 'ok', latenciaMs: 3 },
  migrations: { aplicadas: 1, ultima: '20261020180000_inicial' },
};

const texto = (elemento: Element | null | undefined) =>
  elemento?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

// Sem whenStable(): uma requisição em aberto deixa a aplicação "instável" de propósito.
describe('StatusSistema (dados reais de /api/saude)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function criar() {
    const fixture = TestBed.createComponent(StatusSistema);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const botao = () => raiz.querySelector<HTMLButtonElement>('.status__rodape button');
    /** [rótulo, partes do valor separadas por espaço] de cada linha. */
    const linhas = () =>
      [...raiz.querySelectorAll('.status__linha')].map((linha) => {
        const valor = linha.querySelector('dd');
        const partes = valor?.children.length ? [...valor.children].map(texto) : [texto(valor)];
        return [texto(linha.querySelector('dt')), partes.join(' ')];
      });
    return { fixture, raiz, botao, linhas };
  }

  it('é uma região "Status do sistema" com o selo "ao vivo" e consulta a API ao abrir', () => {
    const { raiz, botao } = criar();
    const regiao = raiz.querySelector('[role="region"]');
    expect(texto(raiz.querySelector(`#${regiao?.getAttribute('aria-labelledby')}`))).toBe(
      'Status do sistema',
    );
    // A dica fala com quem usa o CRM, não com quem desenvolve.
    expect(texto(raiz.querySelector('app-dica [role="tooltip"]'))).toBe(
      'Mostra, ao vivo, se o servidor do CRM e o banco de dados estão respondendo. Se algo ficar vermelho, avise o administrador.',
    );
    expect(texto(raiz.querySelector('app-selo'))).toBe('ao vivo');
    expect(raiz.querySelector('app-selo .selo__ponto')).not.toBeNull();
    expect(texto(raiz.querySelector('.status__consultando'))).toBe('Verificando o sistema…');
    expect(botao()?.getAttribute('aria-busy')).toBe('true');
    http.expectOne(URL_SAUDE).flush(RESPOSTA_OK);
  });

  it('API no ar: versão e ambiente, banco com latência, atualizações do banco e tempo no ar', () => {
    const { fixture, raiz, botao, linhas } = criar();
    http.expectOne(URL_SAUDE).flush(RESPOSTA_OK);
    fixture.detectChanges();
    expect(linhas()).toEqual([
      ['API', 'No ar v0.0.1 · desenvolvimento'],
      ['Banco de dados', 'Conectado 3 ms'],
      ['Atualizações do banco', '1 aplicada inicial de 20/10/2026'],
      ['No ar há', '1 h 2 min'],
    ]);
    expect(raiz.querySelector('.status__codigo')?.getAttribute('title')).toBe(
      'Última atualização aplicada: 20261020180000_inicial',
    );
    // Respondendo, o "ao vivo" ganha o ponto menta (classe que define --selo-ponto).
    const selo = raiz.querySelector('app-selo');
    expect(texto(selo)).toBe('ao vivo');
    expect(selo?.classList).toContain('status__ao-vivo');
    expect(texto(raiz.querySelector('.status__atualizado'))).toBe('Atualizado agora');
    expect(texto(botao())).toBe('Atualizar');
    expect(botao()?.hasAttribute('aria-busy')).toBe(false);
  });

  it('produção e latência abaixo de 1 ms aparecem em português', () => {
    const { fixture, linhas } = criar();
    http
      .expectOne(URL_SAUDE)
      .flush({ ...RESPOSTA_OK, ambiente: 'production', banco: { status: 'ok', latenciaMs: 0 } });
    fixture.detectChanges();
    expect(linhas().slice(0, 2)).toEqual([
      ['API', 'No ar v0.0.1 · produção'],
      ['Banco de dados', 'Conectado < 1 ms'],
    ]);
  });

  it('banco fora do ar (HTTP 503): a API responde, o banco aparece com o erro', () => {
    const { fixture, linhas } = criar();
    http.expectOne(URL_SAUDE).flush(
      {
        ...RESPOSTA_OK,
        status: 'degradado',
        banco: { status: 'erro', erro: 'conexão recusada' },
        migrations: null,
      },
      { status: 503, statusText: 'Service Unavailable' },
    );
    fixture.detectChanges();
    expect(linhas().slice(0, 3)).toEqual([
      ['API', 'No ar, com falhas v0.0.1 · desenvolvimento'],
      ['Banco de dados', 'Com erro conexão recusada'],
      ['Atualizações do banco', 'Sem leitura enquanto o banco não responde'],
    ]);
  });

  it('quem não é Admin recebe só { status }: mostra apenas que a API está no ar, sem versão nem banco', () => {
    const { fixture, linhas } = criar();
    http.expectOne(URL_SAUDE).flush({ status: 'ok' });
    fixture.detectChanges();
    expect(linhas()).toEqual([['API', 'No ar']]);
  });

  it('sem conexão: explica o que fazer e "Tentar de novo" consulta outra vez', () => {
    const { fixture, raiz, botao } = criar();
    http.expectOne(URL_SAUDE).error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();
    const erro = texto(raiz.querySelector('.status__erro'));
    expect(texto(raiz.querySelector('.status__erro-titulo'))).toBe('Sem conexão com o servidor');
    // Sem resposta, o selo diz "sem conexão", sem o ponto pulsante.
    expect(texto(raiz.querySelector('app-selo'))).toBe('sem conexão');
    expect(raiz.querySelector('app-selo .selo__ponto')).toBeNull();
    expect(raiz.querySelector('app-selo')?.classList).not.toContain('status__ao-vivo');
    expect(erro).toContain(
      'Não conseguimos verificar o CRM agora. Os números desta tela são de exemplo e continuam aparecendo. Tente de novo em instantes; se continuar, avise o administrador.',
    );
    // A ajuda técnica (o erro da consulta e como subir a API) só aparece em desenvolvimento
    // (os testes rodam nesse modo).
    const dev = texto(raiz.querySelector('.status__dev'));
    expect(dev).toContain(TestBed.inject(SaudeService).erro() ?? '?');
    expect(dev).toContain('ng serve');
    expect(raiz.querySelector('.status__lista')).toBeNull();
    expect(texto(raiz.querySelector('.status__atualizado'))).toBe('Última tentativa agora');
    expect(texto(botao())).toBe('Tentar de novo');

    botao()?.click();
    fixture.detectChanges();
    expect(botao()?.getAttribute('aria-busy')).toBe('true');
    expect(texto(raiz.querySelector('[aria-live="polite"]'))).toBe(
      'Verificando o status do sistema.',
    );
    http.expectOne(URL_SAUDE).flush(RESPOSTA_OK);
    fixture.detectChanges();
    expect(raiz.querySelector('.status__erro')).toBeNull();
    expect(texto(raiz.querySelector('app-selo'))).toBe('ao vivo');
    expect(texto(raiz.querySelector('[aria-live="polite"]'))).toBe(
      'Status do sistema: servidor no ar e banco de dados conectado.',
    );
  });

  it('traduz o ambiente e formata a latência', () => {
    expect(traduzirAmbiente('production')).toBe('produção');
    expect(traduzirAmbiente('development')).toBe('desenvolvimento');
    expect(traduzirAmbiente('homologacao')).toBe('homologacao');
    expect(formatarLatencia(0)).toBe('< 1 ms');
    expect(formatarLatencia(0.4)).toBe('< 1 ms');
    expect(formatarLatencia(3)).toBe('3 ms');
  });

  it('formata há quanto tempo a API está no ar', () => {
    expect(formatarDuracao(42)).toBe('menos de 1 min');
    expect(formatarDuracao(600)).toBe('10 min');
    expect(formatarDuracao(7200)).toBe('2 h');
    expect(formatarDuracao(3720)).toBe('1 h 2 min');
    expect(formatarDuracao(2 * 86400 + 7 * 3600 + 59)).toBe('2 d 7 h');
    expect(formatarDuracao(86400)).toBe('1 d');
  });

  it('mostra a última atualização do banco pelo nome e pela data, sem o carimbo', () => {
    expect(partirMigracao('20261020180000_fase1_nucleo')).toEqual({
      nome: 'fase1_nucleo',
      data: '20/10/2026',
    });
    expect(partirMigracao('inicial')).toEqual({ nome: 'inicial', data: null });
  });
});
