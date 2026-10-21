import { TestBed } from '@angular/core/testing';

import { CHAVE_NAVEGACAO_RECOLHIDA, EstadoCasca, MIDIA_MOBILE, MIDIA_TABLET } from './estado-casca';

type Faixa = 'desktop' | 'tablet' | 'mobile';

/** `MediaQueryList` falso: guarda os ouvintes e dispara `change` quando a faixa muda. */
class MidiaFalsa {
  private readonly ouvintes = new Set<(evento: MediaQueryListEvent) => void>();

  constructor(
    readonly media: string,
    public matches: boolean,
  ) {}

  addEventListener(_tipo: 'change', ouvinte: (evento: MediaQueryListEvent) => void): void {
    this.ouvintes.add(ouvinte);
  }

  removeEventListener(_tipo: 'change', ouvinte: (evento: MediaQueryListEvent) => void): void {
    this.ouvintes.delete(ouvinte);
  }

  mudar(matches: boolean): void {
    if (matches === this.matches) {
      return;
    }
    this.matches = matches;
    for (const ouvinte of this.ouvintes) {
      ouvinte({ matches, media: this.media } as MediaQueryListEvent);
    }
  }
}

/** Instala um `matchMedia` controlável (o jsdom não tem) na faixa de largura pedida. */
function simularLargura(inicial: Faixa) {
  let faixa = inicial;
  const consultas = new Map<string, MidiaFalsa>();
  const combina = (midia: string) =>
    (midia === MIDIA_TABLET && faixa === 'tablet') ||
    (midia === MIDIA_MOBILE && faixa === 'mobile');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (midia: string) => {
      let consulta = consultas.get(midia);
      if (!consulta) {
        consulta = new MidiaFalsa(midia, combina(midia));
        consultas.set(midia, consulta);
      }
      return consulta;
    },
  });
  return {
    mudarPara(nova: Faixa) {
      faixa = nova;
      for (const consulta of consultas.values()) {
        consulta.mudar(combina(consulta.media));
      }
    },
  };
}

describe('EstadoCasca', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    Reflect.deleteProperty(window, 'matchMedia');
  });

  function criar(): EstadoCasca {
    TestBed.configureTestingModule({ providers: [EstadoCasca] });
    return TestBed.inject(EstadoCasca);
  }

  it('começa com a navegação expandida e a gaveta fechada', () => {
    const estado = criar();
    expect(estado.recolhida()).toBe(false);
    expect(estado.sobreposta()).toBe(false);
    expect(estado.gavetaAberta()).toBe(false);
    // Sem matchMedia (jsdom), não é tablet nem mobile.
    expect(estado.ehTablet()).toBe(false);
    expect(estado.ehMobile()).toBe(false);
  });

  it('recolher a navegação fica salvo', () => {
    const estado = criar();
    estado.alternarNavegacao();
    expect(estado.recolhida()).toBe(true);
    expect(localStorage.getItem(CHAVE_NAVEGACAO_RECOLHIDA)).toBe('true');
    estado.alternarNavegacao();
    expect(estado.recolhida()).toBe(false);
    expect(localStorage.getItem(CHAVE_NAVEGACAO_RECOLHIDA)).toBe('false');
  });

  it('lê a escolha salva', () => {
    localStorage.setItem(CHAVE_NAVEGACAO_RECOLHIDA, 'true');
    expect(criar().recolhida()).toBe(true);
  });

  it('abre e fecha a gaveta', () => {
    const estado = criar();
    estado.abrirGaveta();
    expect(estado.gavetaAberta()).toBe(true);
    estado.fecharGaveta();
    expect(estado.gavetaAberta()).toBe(false);
  });

  it('pedir o menu da conta chama quem se registrou, até desfazer o registro', () => {
    const estado = criar();
    const abrir = vi.fn();
    estado.pedirMenuConta(); // ninguém registrado: não faz nada
    const desfazer = estado.registrarAbrirMenuConta(abrir);
    estado.pedirMenuConta();
    expect(abrir).toHaveBeenCalledTimes(1);
    desfazer();
    estado.pedirMenuConta();
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('tablet: trilho recolhido; o «/» abre por cima do conteúdo, sem salvar, e fecha', () => {
    simularLargura('tablet');
    const estado = criar();
    expect(estado.ehTablet()).toBe(true);
    expect(estado.recolhida()).toBe(true);
    expect(estado.sobreposta()).toBe(false);

    estado.alternarNavegacao();
    expect(estado.recolhida()).toBe(false);
    expect(estado.sobreposta()).toBe(true);
    expect(localStorage.getItem(CHAVE_NAVEGACAO_RECOLHIDA)).toBeNull();

    estado.recolherSobreposta();
    expect(estado.recolhida()).toBe(true);
    expect(estado.sobreposta()).toBe(false);

    estado.alternarNavegacao();
    estado.alternarNavegacao();
    expect(estado.sobreposta()).toBe(false);
  });

  it('tablet: a escolha salva do desktop não muda o trilho', () => {
    localStorage.setItem(CHAVE_NAVEGACAO_RECOLHIDA, 'false');
    simularLargura('tablet');
    expect(criar().recolhida()).toBe(true);
  });

  it('sair da faixa do tablet desfaz a navegação sobreposta', () => {
    const largura = simularLargura('tablet');
    const estado = criar();
    estado.alternarNavegacao();
    expect(estado.sobreposta()).toBe(true);

    largura.mudarPara('desktop');
    expect(estado.ehTablet()).toBe(false);
    expect(estado.sobreposta()).toBe(false);
    expect(estado.recolhida()).toBe(false); // volta à escolha salva do desktop

    largura.mudarPara('tablet');
    expect(estado.recolhida()).toBe(true); // não reabre sozinha
  });

  it('mobile: a gaveta fecha ao sair da faixa do celular', () => {
    const largura = simularLargura('mobile');
    const estado = criar();
    expect(estado.ehMobile()).toBe(true);
    estado.abrirGaveta();
    expect(estado.gavetaAberta()).toBe(true);

    largura.mudarPara('tablet');
    expect(estado.ehMobile()).toBe(false);
    expect(estado.ehTablet()).toBe(true);
    expect(estado.gavetaAberta()).toBe(false);
  });
});
