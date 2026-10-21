import { formatDate } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PerfilDemoService } from '../../nucleo/perfil-demo.service';
import type { RespostaSaude } from '../../nucleo/saude';
import { URL_SAUDE } from '../../nucleo/saude.service';
import { formatarIntervalo, Inicio } from './inicio';

const RESPOSTA_OK: RespostaSaude = {
  status: 'ok',
  versao: '0.0.1',
  ambiente: 'production',
  horario: '2026-10-20T18:00:00.000Z',
  uptimeSegundos: 42,
  banco: { status: 'ok', latenciaMs: 3 },
  migrations: { aplicadas: 1, ultima: '20261020180000_inicial' },
};

const texto = (elemento: Element | null | undefined) =>
  elemento?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('formatarIntervalo', () => {
  it('conta os dias do período terminando hoje; o ano só aparece quando muda', () => {
    const hoje = new Date(2026, 9, 20);
    expect(formatarIntervalo(hoje, 30, 'pt-BR')).toBe('21/09 a 20/10/2026');
    expect(formatarIntervalo(hoje, 7, 'pt-BR')).toBe('14/10 a 20/10/2026');
    expect(formatarIntervalo(hoje, 90, 'pt-BR')).toBe('23/07 a 20/10/2026');
    expect(formatarIntervalo(new Date(2026, 0, 10), 30, 'pt-BR')).toBe('12/12/2025 a 10/01/2026');
  });
});

describe('Inicio (visão geral)', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => localStorage.clear());

  /** Cria a página e responde a consulta de saúde (o único dado real da tela). */
  async function criar() {
    const fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(URL_SAUDE).flush(RESPOSTA_OK);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const clicar = async (seletor: string, rotulo: string) => {
      const alvo = [...raiz.querySelectorAll<HTMLElement>(seletor)].find(
        (elemento) => texto(elemento) === rotulo,
      );
      expect(alvo, `${seletor} "${rotulo}"`).toBeDefined();
      alvo?.click();
      await fixture.whenStable();
    };
    return {
      fixture,
      raiz,
      aba: (rotulo: string) => clicar('[role="tab"]', rotulo),
      periodo: (rotulo: string) => clicar('[role="radio"]', rotulo),
      abas: () => [...raiz.querySelectorAll('[role="tab"]')].map(texto),
      totais: () => [...raiz.querySelectorAll('app-barra-funil .funil__total')].map(texto),
      etapas: () => [...raiz.querySelectorAll('app-barra-funil .funil__etapa')].map(texto),
      /** "R$ 186 mil": prefixo, valor e unidade de cada indicador (sem o selo de variação). */
      numeros: (seletor: string) =>
        [...raiz.querySelectorAll(`${seletor} app-indicador`)].map((indicador) =>
          [...indicador.querySelectorAll('.indicador__unidade, .indicador__valor')]
            .map(texto)
            .join(' '),
        ),
      /** Texto do balão de uma dica, pelo rótulo do botão "?". */
      dica: (rotulo: string) => {
        const botao = raiz.querySelector(`app-dica button[aria-label="${rotulo}"]`);
        return texto(raiz.querySelector(`#${botao?.getAttribute('aria-describedby')}`));
      },
      eventos: () => [...raiz.querySelectorAll('.evento__titulo')].map(texto),
    };
  }

  it('cabeçalho: título em dois tons com o mês atual, aviso de dados de exemplo e a frase', async () => {
    const { raiz } = await criar();
    const titulo = raiz.querySelector('h1');
    const mes = formatDate(new Date(), "MMMM 'de' y", 'pt-BR');
    expect(texto(titulo)).toBe(`Visão geral · ${mes}`);
    // O "·" fica no fim da primeira linha; o complemento desce inteiro.
    expect(texto(titulo?.querySelector('.tom-fraco'))).toBe('·');
    expect(texto(titulo?.querySelector('.tom-fraco.sem-quebra'))).toBe(mes);
    expect(texto(raiz.querySelector('.cabecalho__aviso app-selo'))).toBe('Dados de exemplo');
    expect(
      raiz.querySelector('.cabecalho__aviso app-dica button')?.getAttribute('aria-label'),
    ).toBe('Sobre os dados de exemplo');
    expect(texto(raiz.querySelector('.cabecalho__frase'))).toBe(
      'Da captação do lead ao sucesso do cliente, em um só lugar.',
    );
    expect(raiz.querySelector('app-pilha-avatares')?.getAttribute('aria-label')).toMatch(
      /^Quem usa o CRM: Ana Ribeiro, Carla Nogueira, Lucas Prado e mais \d+ pessoas$/,
    );
  });

  it('o período mostra as datas que cobre, ligadas ao grupo de opções', async () => {
    const { raiz, periodo } = await criar();
    const intervalo = raiz.querySelector('.cabecalho__intervalo') as HTMLElement;
    const grupo = raiz.querySelector('[role="radiogroup"]');
    expect(grupo?.getAttribute('aria-describedby')).toBe(intervalo.id);
    expect(texto(intervalo)).toBe(formatarIntervalo(new Date(), 30, 'pt-BR'));
    await periodo('Trimestre');
    expect(texto(intervalo)).toBe(formatarIntervalo(new Date(), 90, 'pt-BR'));
  });

  it('abre na jornada do cliente: indicadores do palco e o funil do lead ao CS, por área', async () => {
    const { raiz, abas, totais, etapas, numeros, dica } = await criar();
    expect(abas()).toEqual(['Jornada do cliente', 'Atendimento', 'Equipe']);
    expect(raiz.querySelector('[role="tab"]')?.getAttribute('aria-selected')).toBe('true');

    // A aba já titula o painel: o h2 fica só para leitores de tela.
    const titulo = raiz.querySelector('[role="tabpanel"] h2');
    expect(texto(titulo)).toBe('Jornada do cliente · 30 dias');
    expect(titulo?.classList).toContain('visualmente-oculto');
    expect(numeros('app-inicio-jornada')).toEqual(['17 %', '12 d', 'R$ 186 mil']);
    expect(etapas()).toEqual([
      'Leads',
      'Leads qualificados',
      'Oportunidades',
      'Negócios ganhos',
      'Clientes em onboarding',
    ]);
    expect(totais()).toEqual(['1.600', '880', '560', '272', '264']);
    expect([...raiz.querySelectorAll('.etapas__nome')].map(texto)).toEqual([
      'Marketing',
      'Comercial',
      'Customer Success',
    ]);
    expect(texto(raiz.querySelector('app-inicio-jornada app-legenda'))).toBe(
      'Site e webhooks WhatsApp Indicação e outros',
    );
    // A dica vem logo depois da última origem, na mesma linha da legenda.
    expect(
      raiz
        .querySelector('.jornada__legenda > app-legenda + app-dica button')
        ?.getAttribute('aria-label'),
    ).toBe('Como ler o funil');
    expect(dica('Como ler o funil')).toContain('o webhook é essa ligação automática');
    // As passagens entre áreas são texto (não selo) com uma dica que explica as quedas.
    expect([...raiz.querySelectorAll('.etapas__passagem-texto')].map(texto)).toEqual([
      'passagem automática',
      'passagem automática',
    ]);
    expect(dica('Como o negócio chega ao Comercial')).toContain(
      'os outros são descartados com o motivo registrado',
    );
    expect(dica('Como o negócio chega ao Customer Success')).toContain(
      'Todo negócio ganho entra sozinho nele, na etapa Boas-vindas',
    );
    expect(raiz.querySelector('app-barra-funil[role="img"]')?.getAttribute('aria-label')).toContain(
      'Leads: 1.600; Site e webhooks 720, WhatsApp 560, Indicação e outros 320',
    );
  });

  it('troca as abas do palco: atendimento por canal e o ranking da equipe', async () => {
    const { raiz, aba, etapas, numeros } = await criar();

    await aba('Atendimento');
    const titulo = raiz.querySelector('[role="tabpanel"] h2');
    expect(texto(titulo)).toBe('Atendimento · 30 dias');
    expect(titulo?.classList).toContain('visualmente-oculto');
    expect(numeros('app-inicio-atendimento')).toEqual(['38', '4,2 min', '94 %', '92 %']);
    expect(texto(raiz.querySelector('app-inicio-atendimento .palco__base'))).toBe(
      'Variações em relação aos 30 dias anteriores',
    );
    expect(etapas()).toEqual(['WhatsApp', 'Instagram', 'Chat do site', 'E-mail']);
    expect(raiz.querySelector('app-inicio-jornada')).toBeNull();

    await aba('Equipe');
    expect(texto(raiz.querySelector('[role="tabpanel"] h2'))).toBe('Equipe comercial · 30 dias');
    const pessoas = [...raiz.querySelectorAll('.ranking__item')];
    expect(pessoas.length).toBe(6);
    expect(texto(pessoas[0].querySelector('.ranking__nome'))).toBe('1º lugar: João Batista');
    expect(
      [...pessoas[0].querySelectorAll('.ranking__dado')].map((dado) => [
        texto(dado.querySelector('dt')),
        texto(dado.querySelector('dd')),
      ]),
    ).toEqual([
      ['Negócios ganhos', '58'],
      ['Atividades concluídas', '214'],
      ['Meta', '105% (58 de 55)'],
    ]);
    expect(texto(raiz.querySelector('app-inicio-equipe app-selo'))).toBe('272 negócios ganhos');
    expect(texto(raiz.querySelector('app-inicio-equipe .palco__nota'))).toContain(
      'Pedro Martins foi desligado',
    );
  });

  it('o período troca os números do painel inteiro', async () => {
    const { raiz, periodo, totais, numeros } = await criar();
    const opcoes = [...raiz.querySelectorAll('[role="radio"]')];
    expect(opcoes.map(texto)).toEqual(['7 dias', '30 dias', 'Trimestre']);
    expect(opcoes[1].getAttribute('aria-checked')).toBe('true');
    expect(numeros('app-inicio-indicadores')).toEqual(['1.600', '48,6 %', 'R$ 412 mil', '78']);

    await periodo('7 dias');
    expect(totais()[0]).toBe('388');
    expect(texto(raiz.querySelector('[role="tabpanel"] h2'))).toBe('Jornada do cliente · 7 dias');
    expect(texto(raiz.querySelector('app-inicio-indicadores .indicador__legenda'))).toBe(
      'Leads em 7 dias',
    );
    expect(texto(raiz.querySelector('.kpis__base'))).toBe(
      'Variações em relação aos 7 dias anteriores',
    );

    await periodo('Trimestre');
    expect(totais()).toEqual(['4.520', '2.440', '1.530', '723', '709']);
    expect(numeros('app-inicio-jornada')).toEqual(['16 %', '13 d', 'R$ 494 mil']);
  });

  it('indicadores: a base das variações à vista e, em cada dica, com o que a seta compara', async () => {
    const { raiz, dica } = await criar();
    expect(texto(raiz.querySelector('.kpis__base'))).toBe(
      'Variações em relação aos 30 dias anteriores',
    );
    expect(dica('Sobre: Leads em 30 dias')).toContain('A seta compara com os 30 dias anteriores.');
    const taxa = dica('Sobre: Taxa de ganho');
    expect(taxa).toContain('272 de 560. A seta compara com os 30 dias anteriores.');
    expect(taxa).not.toContain('A variação é em pontos percentuais');
    expect(dica('Sobre: Receita recorrente (MRR)')).toContain(
      'Valor de hoje; a seta compara com o início do período.',
    );
    expect(dica('Sobre: Health score médio (CS)')).toContain(
      'Valor de hoje; a seta compara com o início do período.',
    );
    // A dica fica no topo de cada cartão (na mesma altura em todos), não ao lado da legenda,
    // que fica com a largura toda; "30 dias" não se parte (espaço inseparável).
    const cartoes = [...raiz.querySelectorAll('app-inicio-indicadores .kpi')];
    expect(
      cartoes.map((cartao) => cartao.querySelector(':scope > app-dica.kpi__dica')),
    ).not.toContain(null);
    expect(raiz.querySelector('app-inicio-indicadores app-indicador app-dica')).toBeNull();
    expect(cartoes[0].querySelector('.indicador__legenda')?.textContent).toBe(
      'Leads em 30\u00a0dias',
    );
    // A unidade da variação: % nos leads e no MRR, pontos percentuais na taxa e pontos da nota.
    const variacoes = [...raiz.querySelectorAll('app-inicio-indicadores .indicador__variacao')];
    expect(variacoes.map((selo) => texto(selo.querySelector('span[aria-hidden="true"]')))).toEqual([
      '8,4%',
      '2,1 p.p.',
      '3,1%',
      '2,6 pts',
    ]);
  });

  it('o botão "Analisar com IA" só aparece para o Admin e abre o modal', async () => {
    const { fixture, raiz } = await criar();
    const botaoIa = () =>
      [...raiz.querySelectorAll<HTMLButtonElement>('.cabecalho button')].find(
        (botao) => texto(botao) === 'Analisar com IA',
      );
    // No celular, o mesmo atalho é um botão-ícone.
    const iconeIa = () => raiz.querySelector('.cabecalho__icones [aria-label="Analisar com IA"]');
    expect(botaoIa()?.classList).toContain('botao--marca');
    expect(iconeIa()?.classList).toContain('botao-icone--marca');
    botaoIa()?.click();
    await fixture.whenStable();
    expect(raiz.querySelector('app-inicio-analise dialog')?.hasAttribute('open')).toBe(true);

    for (const papel of ['C_LEVEL', 'LIDER_COMERCIAL', 'COMERCIAL', 'MARKETING', 'CS'] as const) {
      TestBed.inject(PerfilDemoService).verComo(papel);
      await fixture.whenStable();
      expect(botaoIa(), papel).toBeUndefined();
      expect(iconeIa(), papel).toBeNull();
      expect(raiz.querySelector('app-inicio-analise'), papel).toBeNull();
      // A auditoria completa (Administração) também é só do Admin.
      expect(raiz.querySelector('.atividades__rodape'), papel).toBeNull();
    }
    TestBed.inject(PerfilDemoService).verComo('ADMIN');
    await fixture.whenStable();
    expect(botaoIa()).toBeDefined();
  });

  it('"Compartilhar" copia o link da página e mostra "Link copiado" à vista', async () => {
    const copiar = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copiar },
    });
    try {
      const { fixture, raiz } = await criar();
      const botao = [...raiz.querySelectorAll<HTMLButtonElement>('.cabecalho button')].find(
        (elemento) => texto(elemento) === 'Compartilhar',
      );
      const retorno = raiz.querySelector('.cabecalho [aria-live="polite"]') as HTMLElement;
      expect(retorno.classList).not.toContain('visualmente-oculto');
      expect(texto(retorno)).toBe('');

      botao?.click();
      await fixture.whenStable();
      expect(copiar).toHaveBeenCalledWith(document.location.href);
      expect(texto(botao)).toBe('Link copiado');
      expect(texto(retorno)).toBe('Link copiado.');
      expect(retorno.classList).toContain('cabecalho__retorno--visivel');
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('"Compartilhar" avisa quando não dá para copiar', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('sem permissão')) },
    });
    const execCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
    try {
      const { fixture, raiz } = await criar();
      const botao = [...raiz.querySelectorAll<HTMLButtonElement>('.cabecalho button')].find(
        (elemento) => texto(elemento) === 'Compartilhar',
      );
      botao?.click();
      await fixture.whenStable();
      expect(texto(botao)).toBe('Não deu para copiar');
      expect(texto(raiz.querySelector('.cabecalho [aria-live="polite"]'))).toBe(
        'Não deu para copiar o link. Copie o endereço na barra do navegador.',
      );
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard');
      if (execCommand) {
        Object.defineProperty(document, 'execCommand', execCommand);
      } else {
        Reflect.deleteProperty(document, 'execCommand');
      }
    }
  });

  it('coluna lateral: atividades recentes (auditoria) e o status real da API', async () => {
    const { raiz, eventos } = await criar();
    const regioes = [...raiz.querySelectorAll('app-cartao[role="region"]')].map((regiao) =>
      texto(raiz.querySelector(`#${regiao.getAttribute('aria-labelledby')}`)),
    );
    expect(regioes).toEqual(['Atividades recentes', 'Status do sistema']);

    expect(eventos().length).toBe(6);
    expect(eventos()[0]).toBe('Webhook “Site” criou o lead Maria Souza');
    const primeiro = raiz.querySelector('.evento');
    expect(texto(primeiro?.querySelector('time'))).toBe('há 4 min');
    expect(primeiro?.querySelector('time')?.getAttribute('datetime')).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
    // Admin vê o atalho para a auditoria completa, que ainda é "em breve".
    const auditoria = raiz.querySelector('.atividades__rodape a');
    expect(texto(auditoria)).toBe('Ver auditoria');
    expect(auditoria?.getAttribute('aria-label')).toBe('Ver auditoria (em breve)');
    expect(auditoria?.getAttribute('href')).toBe('/administracao');
    expect(texto(raiz.querySelector('.atividades__rodape app-selo'))).toBe('em breve');

    const banco = raiz.querySelectorAll('app-inicio-status .status__linha dd')[1];
    expect(texto(banco?.querySelector('app-selo'))).toBe('Conectado');
    expect(texto(banco?.querySelector('.status__extra'))).toBe('3 ms');
  });

  it('a visão geral segue a persona: o Marketing não vê o Atendimento nem os eventos do Admin', async () => {
    const { fixture, abas, aba, eventos, dica, raiz } = await criar();
    await aba('Atendimento');
    expect(raiz.querySelector('app-inicio-atendimento')).not.toBeNull();

    // Trocar para o Marketing com a aba Atendimento aberta volta para a Jornada.
    TestBed.inject(PerfilDemoService).verComo('MARKETING');
    await fixture.whenStable();
    expect(abas()).toEqual(['Jornada do cliente', 'Equipe']);
    expect(raiz.querySelector('app-inicio-atendimento')).toBeNull();
    expect(raiz.querySelector('app-inicio-jornada')).not.toBeNull();
    expect(raiz.querySelector('[role="tab"]')?.getAttribute('aria-selected')).toBe('true');

    expect(eventos().some((evento) => evento.includes('TicketHub'))).toBe(false);
    expect(eventos().some((evento) => evento.includes('foi desligado'))).toBe(false);
    expect(dica('Sobre: Atividades recentes')).toBe(
      'Atividades recentes da sua área. Estes eventos são exemplos.',
    );

    // O líder comercial vê o desligamento da equipe dele, mas não o histórico da IA.
    TestBed.inject(PerfilDemoService).verComo('LIDER_COMERCIAL');
    await fixture.whenStable();
    expect(abas()).toEqual(['Jornada do cliente', 'Atendimento', 'Equipe']);
    expect(eventos().some((evento) => evento.includes('foi desligado'))).toBe(true);
    expect(eventos().some((evento) => evento.includes('TicketHub'))).toBe(false);
  });
});
