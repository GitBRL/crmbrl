import {
  contagemDoTipo,
  desdeQuando,
  detalheDoCanal,
  enviosDeHoje,
  linkDoCanal,
  linkDoNovo,
  resumoDaPausa,
  resumoDoAquecimento,
  resumoDoRitmo,
  segundosAte,
  situacaoDoCanal,
  telefoneDoNumero,
  textoDaFila,
} from './apresentacao';
import { email, numero, site } from './dados-de-teste';
import { contraste, corDeTextoPara, ehCor, normalizarDominio } from './site/widget';

describe('apresentação dos canais', () => {
  it('conta por tipo com o substantivo certo', () => {
    expect(contagemDoTipo('WHATSAPP', 0)).toBe('nenhum ainda');
    expect(contagemDoTipo('EMAIL', 0)).toBe('nenhuma ainda');
    expect(contagemDoTipo('WHATSAPP', 1)).toBe('1 número');
    expect(contagemDoTipo('WHATSAPP', 3)).toBe('3 números');
    expect(contagemDoTipo('MESSENGER', 2)).toBe('2 páginas');
  });

  it('monta as rotas das telas (Instagram e Messenger na mesma tela)', () => {
    expect(linkDoCanal('WHATSAPP', 'x')).toEqual(['/configuracoes', 'canais', 'whatsapp', 'x']);
    expect(linkDoCanal('INSTAGRAM', 'y')).toEqual(['/configuracoes', 'canais', 'meta', 'y']);
    expect(linkDoCanal('WEBCHAT', 'z')).toEqual(['/configuracoes', 'canais', 'site', 'z']);
    expect(linkDoNovo('MESSENGER')).toEqual(['/configuracoes', 'canais', 'messenger', 'novo']);
  });

  it('textos do número: telefone, envios, ritmo e aquecimento', () => {
    expect(telefoneDoNumero({ telefone: '5511988887777' })).toBe('+55 (11) 98888-7777');
    expect(telefoneDoNumero({ telefone: null })).toBe('Telefone aparece depois do QR');
    expect(
      enviosDeHoje(numero({ hoje: { dia: 'x', enviados: 1200, falhas: 0, limite: 5000 } })),
    ).toBe('1.200 de 5.000 envios hoje');
    expect(resumoDoRitmo(numero())).toBe('2 a 6 segundos entre um envio e outro');
    expect(resumoDoRitmo(numero({ intervaloMinimoSegundos: 3, intervaloMaximoSegundos: 3 }))).toBe(
      '3 segundos entre um envio e outro',
    );
    expect(resumoDoRitmo(numero({ intervaloMinimoSegundos: 0, intervaloMaximoSegundos: 0 }))).toBe(
      'Sem espera entre um envio e outro',
    );
    expect(resumoDoAquecimento(numero())).toBe('Aquecendo: dia 3 de 14');
    expect(
      resumoDoAquecimento(
        numero({
          aquecimento: { ativo: false, dia: null, dias: 14, inicioEm: null, terminaEm: null },
        }),
      ),
    ).toBe('Aquecimento de 14 dias começa na primeira conexão');
    expect(
      resumoDoAquecimento(
        numero({
          aquecimento: {
            ativo: false,
            dia: null,
            dias: 14,
            inicioEm: '2026-01-01T00:00:00Z',
            terminaEm: '2026-01-15',
          },
        }),
      ),
    ).toBe('Aquecimento concluído');
    expect(
      resumoDoAquecimento(
        numero({
          aquecimento: { ativo: false, dia: null, dias: 0, inicioEm: null, terminaEm: null },
        }),
      ),
    ).toBe('Sem aquecimento');
  });

  it('pausa, desde quando e a contagem do QR', () => {
    expect(resumoDaPausa(numero())).toBeNull();
    expect(
      resumoDaPausa(
        numero({
          pausa: { pausadoEm: '2026-10-26T12:00:00Z', motivo: 'Troca de chip', automatica: false },
        }),
      ),
    ).toMatch(/^Pausado em .+ · Troca de chip$/);
    expect(
      resumoDaPausa(
        numero({ pausa: { pausadoEm: '2026-10-26T12:00:00Z', motivo: null, automatica: true } }),
      ),
    ).toMatch(/^Pausado pelo CRM em /);
    const agora = new Date('2026-10-26T12:00:00.000Z');
    expect(desdeQuando(numero(), agora)).toBe('Conectado há 2 h');
    expect(desdeQuando(numero({ status: 'AGUARDANDO_QR' }), agora)).toBeNull();
    expect(segundosAte('2026-10-26T12:00:20.000Z', agora.getTime())).toBe(20);
    expect(segundosAte('2026-10-26T11:59:00.000Z', agora.getTime())).toBe(0);
    expect(segundosAte(null)).toBeNull();
  });

  it('situação e detalhe dos canais extras', () => {
    expect(situacaoDoCanal({ ativo: false, ultimoErro: null }).rotulo).toBe('Desligado');
    expect(situacaoDoCanal({ ativo: true, ultimoErro: 'Senha errada' }).variante).toBe('coral');
    expect(situacaoDoCanal({ ativo: true, ultimoErro: null }).rotulo).toBe('Ativo');
    expect(detalheDoCanal(site())).toBe('www.brl.com.br');
    expect(detalheDoCanal(site({ dominios: ['https://a.com', 'https://b.com'] }))).toBe(
      'a.com e mais 1',
    );
    expect(detalheDoCanal(site({ dominios: [] }))).toBe('Nenhum site autorizado ainda');
    expect(detalheDoCanal(email())).toBe('atendimento@brl.com.br');
    expect(textoDaFila(numero())).toBe('Fila: Comercial — WhatsApp');
    expect(textoDaFila({ filaPadrao: null })).toBe('Sem fila: as conversas ficam sem responsável');
  });
});

describe('regras do chat do site (iguais às da API)', () => {
  it('normaliza domínios para a origem do navegador', () => {
    expect(normalizarDominio('www.Site.com.br/contato')).toBe('https://www.site.com.br');
    expect(normalizarDominio('http://localhost:8080/')).toBe('http://localhost:8080');
    expect(normalizarDominio('*.brl.com.br')).toBe('https://*.brl.com.br');
    expect(normalizarDominio('ftp://site.com')).toBeNull();
    expect(normalizarDominio('https://user:senha@site.com')).toBeNull();
    expect(normalizarDominio('não é site')).toBeNull();
    expect(normalizarDominio('   ')).toBeNull();
  });

  it('cor válida, texto de mais contraste e razão de contraste', () => {
    expect(ehCor('#2563eb')).toBe(true);
    expect(ehCor('2563EB')).toBe(false);
    expect(ehCor('#25G3EB')).toBe(false);
    expect(corDeTextoPara('#2563EB')).toBe('#FFFFFF');
    expect(corDeTextoPara('#E5F900')).toBe('#111827');
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });
});
