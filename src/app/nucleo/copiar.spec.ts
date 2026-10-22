import { copiarTexto } from './copiar';

describe('copiarTexto', () => {
  const execOriginal = Object.getOwnPropertyDescriptor(document, 'execCommand');

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
    if (execOriginal) {
      Object.defineProperty(document, 'execCommand', execOriginal);
    } else {
      Reflect.deleteProperty(document, 'execCommand');
    }
  });

  function comClipboard(writeText: (texto: string) => Promise<void>) {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  }

  function comExecCommand(resultado: boolean | Error) {
    const chamadas: string[] = [];
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: (comando: string) => {
        chamadas.push(comando);
        const campo = document.querySelector('textarea');
        chamadas.push(`campo:${campo?.value ?? ''}`);
        if (resultado instanceof Error) {
          throw resultado;
        }
        return resultado;
      },
    });
    return chamadas;
  }

  it('usa a Clipboard API quando ela existe', async () => {
    const copiados: string[] = [];
    comClipboard(async (texto) => {
      copiados.push(texto);
    });
    const exec = comExecCommand(true);
    await expect(copiarTexto('https://crm/negocio/1')).resolves.toBe(true);
    expect(copiados).toEqual(['https://crm/negocio/1']);
    expect(exec).toEqual([]);
  });

  it('sem permissão na Clipboard API, cai para o campo temporário e devolve o foco', async () => {
    comClipboard(() => Promise.reject(new Error('NotAllowedError')));
    const exec = comExecCommand(true);
    const botao = document.createElement('button');
    document.body.append(botao);
    botao.focus();

    await expect(copiarTexto('segredo')).resolves.toBe(true);

    expect(exec).toEqual(['copy', 'campo:segredo']);
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.activeElement).toBe(botao);
    botao.remove();
  });

  it('página sem Clipboard API (http pelo IP da rede) usa o modo antigo', async () => {
    const exec = comExecCommand(true);
    await expect(copiarTexto('(11) 98888-7777')).resolves.toBe(true);
    expect(exec[0]).toBe('copy');
  });

  it('devolve false quando nenhum dos dois funciona', async () => {
    comExecCommand(false);
    await expect(copiarTexto('x')).resolves.toBe(false);
    comExecCommand(new Error('falhou'));
    await expect(copiarTexto('x')).resolves.toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('com um modal aberto, o campo temporário nasce dentro do <dialog> (fora dele, é inerte)', async () => {
    const pais: (Element | null)[] = [];
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: () => {
        pais.push(document.querySelector('textarea')?.parentElement ?? null);
        return true;
      },
    });
    const dialogo = document.createElement('dialog');
    const botao = document.createElement('button');
    dialogo.append(botao);
    document.body.append(dialogo);
    // O jsdom não tem showModal(): o diálogo aberto passa por modal (`:modal`).
    dialogo.setAttribute('open', '');
    const combina = dialogo.matches.bind(dialogo);
    vi.spyOn(dialogo, 'matches').mockImplementation(
      (seletor: string) => seletor === ':modal' || combina(seletor),
    );
    botao.focus();

    await expect(copiarTexto('https://crm/webhooks/entrada/abc')).resolves.toBe(true);

    expect(pais).toEqual([dialogo]);
    expect(document.activeElement).toBe(botao);
    dialogo.remove();
  });

  it('se o campo não recebe o foco (página inerte), não diz que copiou', async () => {
    const exec = comExecCommand(true);
    const focar = vi.spyOn(HTMLTextAreaElement.prototype, 'focus').mockImplementation(() => {});
    try {
      await expect(copiarTexto('segredo')).resolves.toBe(false);
      expect(exec).toEqual([]);
      expect(document.querySelector('textarea')).toBeNull();
    } finally {
      focar.mockRestore();
    }
  });
});
