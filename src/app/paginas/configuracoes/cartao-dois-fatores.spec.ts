import { TestBed } from '@angular/core/testing';

import { AvisosService } from '../../nucleo/avisos.service';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { perfilDeTeste } from '../../nucleo/sessao/sessao-de-teste';
import { CartaoDoisFatores, textoDosCodigos } from './cartao-dois-fatores';
import { DoisFatoresApi } from './dois-fatores.api';

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
}

function digitar(campo: HTMLInputElement, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

const CODIGOS = ['AAAAA-BBBBB', 'CCCCC-DDDDD'];

describe('CartaoDoisFatores (Meu perfil, R2.11)', () => {
  let api: Record<keyof DoisFatoresApi, ReturnType<typeof vi.fn>>;

  async function montar(ativo = false) {
    api.situacao.mockResolvedValue({
      ativo,
      ativadoEm: ativo ? '2026-11-12T10:00:00Z' : null,
      codigosRestantes: ativo ? 7 : 0,
    });
    const fixture = TestBed.createComponent(CartaoDoisFatores);
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const botao = (el: HTMLElement, texto: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      (b.textContent ?? '').includes(texto),
    );

  beforeEach(() => {
    api = {
      situacao: vi.fn(),
      ativar: vi.fn().mockResolvedValue({
        chave: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,AAAA',
        urlOtpauth: 'otpauth://totp/x',
      }),
      confirmar: vi.fn().mockResolvedValue(CODIGOS),
      novosCodigos: vi.fn().mockResolvedValue(CODIGOS),
      desativar: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: DoisFatoresApi, useValue: api },
        {
          provide: SessaoService,
          useValue: {
            carregar: vi.fn().mockResolvedValue(null),
            usuario: () => perfilDeTeste('CS').usuario,
          },
        },
        { provide: AvisosService, useValue: { sucesso: vi.fn(), info: vi.fn(), erro: vi.fn() } },
      ],
    });
  });

  it('desativada: oferece "Ativar"', async () => {
    const { el } = await montar(false);
    expect(el.textContent).toContain('Verificação em duas etapas');
    expect(el.textContent).toContain('Desativada');
    expect(botao(el, 'Ativar')).toBeDefined();
  });

  it('ativar mostra QR com texto alternativo e a chave; confirmar mostra os códigos uma vez', async () => {
    const { fixture, el } = await montar(false);
    botao(el, 'Ativar')?.click();
    await microtarefas();
    fixture.detectChanges();
    const qr = el.querySelector<HTMLImageElement>('img.df__qr');
    expect(qr?.alt).toContain('QR code');
    expect(el.querySelector('.df__chave')?.textContent).toContain('JBSWY3DPEHPK3PXP');

    digitar(el.querySelector<HTMLInputElement>('input[name=codigo]')!, '123456');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await microtarefas();
    fixture.detectChanges();
    expect(api.confirmar).toHaveBeenCalledWith('123456');
    expect([...el.querySelectorAll('.df__codigos li')].map((li) => li.textContent)).toEqual(
      CODIGOS,
    );
    expect(botao(el, 'Baixar .txt')).toBeDefined();
    expect(botao(el, 'Concluir')?.disabled).toBe(true);
  });

  it('código errado na confirmação fica no campo, sem mostrar códigos', async () => {
    api.confirmar.mockRejectedValue(
      new (await import('@angular/common/http')).HttpErrorResponse({
        status: 400,
        error: { statusCode: 400, erro: 'dados_invalidos', mensagem: 'Código incorreto.' },
      }),
    );
    const { fixture, el } = await montar(false);
    botao(el, 'Ativar')?.click();
    await microtarefas();
    fixture.detectChanges();
    digitar(el.querySelector<HTMLInputElement>('input[name=codigo]')!, '000000');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await microtarefas();
    fixture.detectChanges();
    expect(el.querySelector('.df__codigos')).toBeNull();
    expect(el.textContent).toContain('Código incorreto');
  });

  it('ativa: mostra os códigos restantes e permite gerar novos e desativar', async () => {
    const { fixture, el } = await montar(true);
    expect(el.textContent).toContain('Ativada');
    expect(el.textContent).toContain('7');
    botao(el, 'Desativar')?.click();
    fixture.detectChanges();
    const campos = el.querySelectorAll<HTMLInputElement>('input');
    digitar(campos[0], 'minha-senha-123');
    digitar(campos[1], '654321');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await microtarefas();
    expect(api.desativar).toHaveBeenCalledWith('minha-senha-123', '654321');
  });

  it('o arquivo .txt traz a conta e os códigos', () => {
    const texto = textoDosCodigos(CODIGOS, 'ana@brl.com.br');
    expect(texto).toContain('ana@brl.com.br');
    expect(texto).toContain('AAAAA-BBBBB');
    expect(texto).toContain('CCCCC-DDDDD');
  });
});
