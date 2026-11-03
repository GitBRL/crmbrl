import type { TemplateDoCanal } from '../configuracoes/canais/canais.modelos';
import { templateDoCanal } from '../configuracoes/canais/dados-de-teste';
import {
  exigeMidia,
  filtrarTemplates,
  preencherTexto,
  previaDoTemplate,
  rascunhoVazio,
  variaveisDoEnvio,
  variaveisFaltando,
} from './templates';

const COM_CABECALHO: TemplateDoCanal = templateDoCanal({
  id: 't-3',
  nome: 'oferta_com_cabecalho',
  cabecalho: { formato: 'TEXT', texto: 'Oferta para {{1}}', variaveis: ['1'] },
  corpo: { texto: 'De {{1}} por {{2}}.', variaveis: ['1', '2'] },
  rodape: 'BRL Educação',
  botoes: [
    { tipo: 'QUICK_REPLY', texto: 'Quero', url: null, variaveis: [] },
    { tipo: 'URL', texto: 'Ver', url: 'https://brl.com/{{1}}', variaveis: ['1'] },
  ],
});

describe('templates do WhatsApp oficial', () => {
  it('preenche as variáveis na ordem e deixa o marcador das que faltam', () => {
    expect(preencherTexto('Olá {{1}}, pedido {{2}}', ['1', '2'], ['Ana', ''])).toBe(
      'Olá Ana, pedido {{2}}',
    );
    expect(preencherTexto('Oi {{nome}}', ['nome'], ['  Rui '])).toBe('Oi Rui');
  });

  it('a prévia junta cabeçalho de texto, corpo e rodapé', () => {
    const previa = previaDoTemplate(COM_CABECALHO, {
      cabecalho: ['Ana'],
      corpo: ['R$ 10', 'R$ 8'],
    });
    expect(previa).toEqual({
      cabecalho: 'Oferta para Ana',
      corpo: 'De R$ 10 por R$ 8.',
      rodape: 'BRL Educação',
    });
  });

  it('lista o que falta preencher (cabeçalho, corpo e botão de URL) e monta o envio', () => {
    const vazio = rascunhoVazio(COM_CABECALHO);
    expect(variaveisFaltando(COM_CABECALHO, vazio)).toEqual([
      'cabeçalho {{1}}',
      'corpo {{1}}',
      'corpo {{2}}',
      'botão “Ver”',
    ]);
    const cheio = { cabecalho: ['Ana '], corpo: ['a', 'b'], botoes: ['', 'abc'] };
    expect(variaveisFaltando(COM_CABECALHO, cheio)).toEqual([]);
    expect(variaveisDoEnvio(COM_CABECALHO, cheio)).toEqual({
      cabecalho: ['Ana'],
      corpo: ['a', 'b'],
      botoes: [null, 'abc'],
    });
  });

  it('template sem variáveis envia sem o campo de variáveis', () => {
    const simples = templateDoCanal({ corpo: { texto: 'Oi', variaveis: [] } });
    expect(variaveisDoEnvio(simples, rascunhoVazio(simples))).toEqual({});
  });

  it('cabeçalho de mídia exige arquivo', () => {
    expect(exigeMidia(COM_CABECALHO)).toBe(false);
    expect(
      exigeMidia(templateDoCanal({ cabecalho: { formato: 'IMAGE', texto: null, variaveis: [] } })),
    ).toBe(true);
  });

  it('a busca ignora acento, caixa e sublinhado', () => {
    const lista = [templateDoCanal(), COM_CABECALHO];
    expect(filtrarTemplates(lista, 'PEDIDO atualizacao')).toHaveLength(1);
    expect(filtrarTemplates(lista, 'oferta')).toHaveLength(1);
    expect(filtrarTemplates(lista, '')).toHaveLength(2);
    expect(filtrarTemplates(lista, 'zzz')).toHaveLength(0);
  });
});
