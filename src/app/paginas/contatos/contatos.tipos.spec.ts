import {
  alteracaoNaoContatarWhatsapp,
  alteracoesDoEvento,
  cnpjValido,
  descreverOrigem,
  descreverUtm,
  formatarTelefone,
  marcadoNaoContatarWhatsapp,
  montarJornada,
  type NegocioRelacionado,
  normalizarTelefone,
  primeiroNome,
  resumoDoEvento,
} from './contatos.tipos';

function negocio(
  id: string,
  area: 'MARKETING' | 'COMERCIAL' | 'CS',
  criadoEm: string,
  negocioOrigemId: string | null = null,
): NegocioRelacionado {
  return {
    id,
    titulo: `Negócio ${id}`,
    status: 'ABERTO',
    valor: '0.00',
    diasNaEtapa: 1,
    parado: false,
    negocioOrigemId,
    funil: { id: `funil-${area}`, nome: area, area },
    etapa: { id: 'e', nome: 'Etapa', tipo: 'ABERTA' },
    contato: { id: 'c', nome: 'Ana' },
    criadoEm,
  };
}

describe('contatos.tipos', () => {
  it('normaliza o telefone como a API (R4.1): 10 ou 11 dígitos ganham o 55', () => {
    expect(normalizarTelefone('(11) 98765-4321')).toBe('5511987654321');
    expect(normalizarTelefone('(41) 3021-2202')).toBe('554130212202');
    expect(normalizarTelefone('+55 11 98765-4321')).toBe('5511987654321');
    expect(normalizarTelefone('011 98765-4321')).toBe('5511987654321');
    expect(normalizarTelefone('  ')).toBeNull();
  });

  it('formata o telefone E.164 para leitura', () => {
    expect(formatarTelefone('5511987654321')).toBe('+55 (11) 98765-4321');
    expect(formatarTelefone('554130212202')).toBe('+55 (41) 3021-2202');
    expect(formatarTelefone('14155550123')).toBe('+14155550123');
    expect(formatarTelefone(null)).toBe('');
  });

  it('valida o CNPJ pelos dígitos verificadores, numérico ou alfanumérico (R4.4)', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11222333000181')).toBe(true);
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
    expect(cnpjValido('11.111.111/1111-11')).toBe(false);
    expect(cnpjValido('123')).toBe(false);
    // Exemplo oficial do CNPJ alfanumérico (Receita Federal).
    expect(cnpjValido('12.ABC.345/01DE-35')).toBe(true);
    expect(cnpjValido('12.ABC.345/01DE-36')).toBe(false);
  });

  it('descreve a origem e a UTM só com o que veio preenchido', () => {
    expect(descreverOrigem({ tipo: 'WEBHOOK', detalhe: 'Landing', utm: null })).toBe(
      'Webhook · Landing',
    );
    expect(descreverOrigem({ tipo: 'SITE', detalhe: null, utm: null })).toBe('Site');
    expect(descreverUtm({ source: 'google', campaign: 'black-friday', medium: ' ' })).toBe(
      'Fonte: google · Campanha: black-friday',
    );
    expect(descreverUtm({})).toBeNull();
    expect(descreverUtm(null)).toBeNull();
  });

  it('lê as alterações de um evento da auditoria', () => {
    const alteracoes = alteracoesDoEvento({
      id: '1',
      acao: 'contato.atualizado',
      entidade: 'contato',
      entidadeId: 'x',
      resumo: 'Contato atualizado',
      dados: {
        alteracoes: {
          email: { antes: null, depois: 'ana@x.com' },
          optOutMarketing: { antes: false, depois: true },
          etiquetas: { antes: [], depois: ['VIP', 'Evento'] },
        },
      },
      tipoAtor: 'USUARIO',
      usuarioId: null,
      atorDescricao: 'Ana',
      criadoEm: '2026-10-21T10:00:00Z',
    });
    expect(alteracoes).toEqual([
      { campo: 'E-mail', antes: 'vazio', depois: 'ana@x.com' },
      { campo: 'Opt-out de marketing', antes: 'não', depois: 'sim' },
      { campo: 'Etiquetas', antes: 'vazio', depois: 'VIP, Evento' },
    ]);
  });

  it('troca os nomes técnicos dos campos do resumo por rótulos, só em atualizações', () => {
    expect(
      resumoDoEvento({
        acao: 'negocio.atualizado',
        resumo: 'Negócio "Padaria — filiais" atualizado (valor, previsaoFechamento)',
      }),
    ).toBe('Negócio "Padaria — filiais" atualizado (valor, previsão de fechamento)');
    // Texto livre entre parênteses (detalhe da origem) e outras ações ficam como vieram.
    const criado = 'Contato "Ana" criado por indicação (Indicação de Gustavo (gerente))';
    expect(resumoDoEvento({ acao: 'contato.atualizado', resumo: criado })).toBe(criado);
    expect(
      resumoDoEvento({ acao: 'negocio.criado', resumo: 'Negócio "X" criado (valorRecorrente)' }),
    ).toBe('Negócio "X" criado (valorRecorrente)');
    expect(
      resumoDoEvento({ acao: 'funil.atualizado', resumo: 'Funil CS atualizado (novoCampo)' }),
    ).toBe('Funil CS atualizado (novo campo)');
  });

  it('monta a jornada na ordem Marketing → Comercial → CS, com "veio de" e "gerou"', () => {
    const jornada = montarJornada([
      negocio('cs', 'CS', '2026-10-03T00:00:00Z', 'com'),
      negocio('com', 'COMERCIAL', '2026-10-02T00:00:00Z', 'mkt'),
      negocio('mkt', 'MARKETING', '2026-10-01T00:00:00Z'),
      negocio('com2', 'COMERCIAL', '2026-10-05T00:00:00Z', 'escondido'),
    ]);
    expect(jornada.map((item) => item.negocio.id)).toEqual(['mkt', 'com', 'com2', 'cs']);
    const [mkt, com, com2, cs] = jornada;
    expect(mkt.veioDe).toBeNull();
    expect(mkt.veioDeOculto).toBe(false);
    expect(mkt.gerou.map((vinculo) => vinculo.id)).toEqual(['com']);
    expect(com.veioDe).toMatchObject({ id: 'mkt', area: 'MARKETING' });
    expect(com.gerou.map((vinculo) => vinculo.id)).toEqual(['cs']);
    // Veio de um funil que a pessoa não vê.
    expect(com2.veioDe).toBeNull();
    expect(com2.veioDeOculto).toBe(true);
    expect(cs.gerou).toEqual([]);
  });

  it('pega o primeiro nome', () => {
    expect(primeiroNome('  Ana Beatriz Lopes ')).toBe('Ana');
  });
});

describe('marca "não contatar por WhatsApp"', () => {
  it('vale pela etiqueta ou pelo campo personalizado', () => {
    expect(marcadoNaoContatarWhatsapp({ etiquetas: [], camposPersonalizados: {} })).toBe(false);
    expect(
      marcadoNaoContatarWhatsapp({
        etiquetas: ['nao-contatar-whatsapp'],
        camposPersonalizados: {},
      }),
    ).toBe(true);
    expect(
      marcadoNaoContatarWhatsapp({
        etiquetas: [],
        camposPersonalizados: { nao_contatar_whatsapp: 'Sim' },
      }),
    ).toBe(true);
  });

  it('cenário 114 — ligar põe a etiqueta; desligar tira a etiqueta e o campo', () => {
    const contato = {
      etiquetas: ['vip', 'nao-contatar-whatsapp'],
      camposPersonalizados: { nao_contatar_whatsapp: true, plano: 'ouro' },
    };
    expect(
      alteracaoNaoContatarWhatsapp({ etiquetas: ['vip'], camposPersonalizados: {} }, true),
    ).toEqual({
      etiquetas: ['vip', 'nao-contatar-whatsapp'],
    });
    expect(alteracaoNaoContatarWhatsapp(contato, false)).toEqual({
      etiquetas: ['vip'],
      camposPersonalizados: { plano: 'ouro' },
    });
  });
});
