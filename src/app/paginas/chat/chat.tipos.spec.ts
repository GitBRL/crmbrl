import {
  aplicarMarcacoes,
  destacarTermos,
  filtrarPessoas,
  gatilhoNoCursor,
  marcacoesPresentes,
  mesclarMensagens,
  paraMensagemConversa,
  previaDoCanal,
  quandoCurto,
  rotaDaReferencia,
  rotuloDoItem,
  secoesDosCanais,
  textoContagem,
  textoParaEdicao,
} from './chat.tipos';
import { ANA, canal, mensagem } from './dados-de-teste';

const EU = 'u-eu';
const NEGOCIO = '0b7e7f43-6c43-4c9e-b2f4-2f1f0d1e5a10';
const FUNIL = '1c8e7f43-6c43-4c9e-b2f4-2f1f0d1e5a10';

describe('chat.tipos', () => {
  describe('paraMensagemConversa', () => {
    it('as do próprio usuário são SAIDA, as dos outros ENTRADA e os avisos SISTEMA', () => {
      expect(paraMensagemConversa(mensagem(), EU).direcao).toBe('ENTRADA');
      expect(paraMensagemConversa(mensagem({ autor: { ...ANA, id: EU } }), EU).direcao).toBe(
        'SAIDA',
      );
      const aviso = paraMensagemConversa(
        mensagem({
          autor: null,
          sistema: true,
          partes: [
            { tipo: 'mencao', texto: '@Ana Lima', usuarioId: 'u-ana' },
            { tipo: 'texto', texto: ' criou o grupo.' },
          ],
        }),
        EU,
      );
      expect(aviso.direcao).toBe('SISTEMA');
      // Nos avisos, as pessoas aparecem pelo nome, sem o "@".
      expect(aviso.texto).toBe('Ana Lima criou o grupo.');
      expect(aviso.trechos).toBeNull();
    });

    it('menções abrem a conversa direta (a si mesmo, o perfil) e referências viram links', () => {
      const convertida = paraMensagemConversa(
        mensagem({
          partes: [
            { tipo: 'texto', texto: 'Oi ' },
            { tipo: 'mencao', texto: '@Bruno', usuarioId: 'u-bruno' },
            { tipo: 'texto', texto: ' e ' },
            { tipo: 'mencao', texto: '@Eu', usuarioId: EU },
            { tipo: 'texto', texto: ', viu o ' },
            {
              tipo: 'referencia',
              texto: 'ACME — implantação',
              referencia: {
                tipo: 'negocio',
                id: NEGOCIO,
                titulo: 'ACME — implantação',
                link: `/funis/${FUNIL}?negocio=${NEGOCIO}`,
                disponivel: true,
              },
            },
            { tipo: 'texto', texto: '? Detalhes em www.brl.com.br.' },
          ],
        }),
        EU,
      );
      const links = convertida.trechos?.filter((trecho) => trecho.link);
      expect(links).toEqual([
        { texto: '@Bruno', link: ['/chat', 'pessoa', 'u-bruno'], tipo: 'mencao' },
        { texto: '@Eu', link: ['/configuracoes', 'perfil'], tipo: 'mencao' },
        {
          texto: 'ACME — implantação',
          link: ['/chat', 'negocio', FUNIL, NEGOCIO],
          tipo: 'referencia',
        },
        { texto: 'www.brl.com.br', link: 'https://www.brl.com.br', externo: true, tipo: 'link' },
      ]);
      expect(convertida.texto).toBe(
        'Oi @Bruno e @Eu, viu o ACME — implantação? Detalhes em www.brl.com.br.',
      );
    });

    it('referência indisponível fica como texto, sem link', () => {
      const convertida = paraMensagemConversa(
        mensagem({
          partes: [
            {
              tipo: 'referencia',
              texto: 'item indisponível',
              referencia: {
                tipo: 'contato',
                id: 'x',
                titulo: null,
                link: null,
                disponivel: false,
              },
            },
          ],
        }),
        EU,
      );
      expect(convertida.trechos).toEqual([{ texto: 'item indisponível' }]);
    });

    it('anexo, tipo pelo MIME, editada e resposta (some na excluída)', () => {
      const com = paraMensagemConversa(
        mensagem({
          anexo: {
            id: 'a1',
            nome: 'foto.png',
            mime: 'image/png',
            tamanho: 2048,
            largura: 640,
            altura: 400,
            duracaoSegundos: null,
            url: '/api/v1/arquivos/a1',
          },
          editadaEm: '2026-10-26T13:05:00.000Z',
          respostaA: {
            id: 'm0',
            autor: 'Bruno',
            resumo: 'Pode mandar?',
            anexoNome: null,
            excluida: false,
          },
        }),
        EU,
      );
      expect(com.tipo).toBe('IMAGEM');
      expect(com.anexo).toEqual({
        nome: 'foto.png',
        mime: 'image/png',
        url: '/api/v1/arquivos/a1',
        tamanho: 2048,
        duracao: null,
        largura: 640,
        altura: 400,
      });
      expect(com.editada).toBe(true);
      expect(com.respondeA).toEqual({ autor: 'Bruno', texto: 'Pode mandar?' });

      const excluida = paraMensagemConversa(
        mensagem({
          excluida: true,
          partes: [],
          editadaEm: '2026-10-26T13:05:00.000Z',
          respostaA: {
            id: 'm0',
            autor: 'Bruno',
            resumo: 'Pode mandar?',
            anexoNome: null,
            excluida: false,
          },
        }),
        EU,
      );
      expect(excluida.excluida).toBe(true);
      expect(excluida.editada).toBe(false);
      expect(excluida.respondeA).toBeNull();
    });
  });

  it('rotaDaReferencia: negócio pela rota do chat; contato e empresa direto', () => {
    const base = { titulo: 'X', disponivel: true } as const;
    expect(
      rotaDaReferencia({
        ...base,
        tipo: 'negocio',
        id: NEGOCIO,
        link: `/funis/${FUNIL}?negocio=${NEGOCIO}`,
      }),
    ).toEqual(['/chat', 'negocio', FUNIL, NEGOCIO]);
    expect(rotaDaReferencia({ ...base, tipo: 'contato', id: 'c', link: '/contatos/c' })).toBe(
      '/contatos/c',
    );
    expect(rotaDaReferencia({ ...base, tipo: 'empresa', id: 'e', link: '/empresas/e?aba=1' })).toBe(
      '/empresas/e',
    );
    expect(
      rotaDaReferencia({ ...base, tipo: 'empresa', id: 'e', link: 'https://fora.com' }),
    ).toBeNull();
    expect(
      rotaDaReferencia({
        ...base,
        tipo: 'empresa',
        id: 'e',
        link: '/empresas/e',
        disponivel: false,
      }),
    ).toBeNull();
  });

  describe('marcações', () => {
    const marcacoes = [
      { visivel: '@Ana', marcacao: '<@u-ana>' },
      { visivel: '@Ana Lima', marcacao: '<@u-ana-lima>' },
      { visivel: '#ACME — implantação', marcacao: `<negocio:${NEGOCIO}>` },
    ];

    it('troca as ocorrências inteiras, as mais longas primeiro', () => {
      expect(
        aplicarMarcacoes('@Ana Lima e @Ana, viram o #ACME — implantação? @Anabela não.', marcacoes),
      ).toBe(`<@u-ana-lima> e <@u-ana>, viram o <negocio:${NEGOCIO}>? @Anabela não.`);
      expect(aplicarMarcacoes('sem nada', marcacoes)).toBe('sem nada');
    });

    it('as que a pessoa apagou do texto não valem mais', () => {
      expect(marcacoesPresentes('Oi @Ana', marcacoes)).toEqual([marcacoes[0]]);
    });

    it('textoParaEdicao devolve a forma visível e volta ao mesmo texto ao salvar', () => {
      const original = mensagem({
        texto: `Oi <@u-bruno>, viu o <negocio:${NEGOCIO}>?`,
        partes: [
          { tipo: 'texto', texto: 'Oi ' },
          { tipo: 'mencao', texto: '@Bruno Tavares', usuarioId: 'u-bruno' },
          { tipo: 'texto', texto: ', viu o ' },
          {
            tipo: 'referencia',
            texto: 'ACME',
            referencia: {
              tipo: 'negocio',
              id: NEGOCIO,
              titulo: 'ACME',
              link: null,
              disponivel: true,
            },
          },
          { tipo: 'texto', texto: '?' },
        ],
      });
      const { texto, marcacoes: lista } = textoParaEdicao(original);
      expect(texto).toBe('Oi @Bruno Tavares, viu o #ACME?');
      expect(aplicarMarcacoes(texto, lista)).toBe(original.texto);
    });
  });

  describe('gatilhoNoCursor', () => {
    it('@ e # no começo de uma palavra, com o que veio depois', () => {
      expect(gatilhoNoCursor('@', 1)).toEqual({ tipo: 'mencao', inicio: 0, consulta: '' });
      expect(gatilhoNoCursor('Oi @an', 6)).toEqual({ tipo: 'mencao', inicio: 3, consulta: 'an' });
      expect(gatilhoNoCursor('veja o #acme fil', 16)).toEqual({
        tipo: 'referencia',
        inicio: 7,
        consulta: 'acme fil',
      });
    });

    it('não abre no meio de um e-mail, depois de quebra de linha ou longe do cursor', () => {
      expect(gatilhoNoCursor('ana@brl.com', 11)).toBeNull();
      expect(gatilhoNoCursor('@ana\nbom dia', 12)).toBeNull();
      expect(gatilhoNoCursor('@ana lima já respondeu tudo', 27)).toBeNull();
      expect(gatilhoNoCursor('@ana', 0)).toBeNull();
    });
  });

  it('filtrarPessoas: sem acentos, primeiro quem começa com o termo', () => {
    const pessoas = [{ nome: 'Mariana Costa' }, { nome: 'Ana Lima' }, { nome: 'José Ana' }];
    expect(filtrarPessoas(pessoas, 'ana').map((p) => p.nome)).toEqual([
      'Ana Lima',
      'José Ana',
      'Mariana Costa',
    ]);
    expect(filtrarPessoas(pessoas, 'jose').map((p) => p.nome)).toEqual(['José Ana']);
    expect(filtrarPessoas(pessoas, 'ana lima').map((p) => p.nome)).toEqual(['Ana Lima']);
    expect(filtrarPessoas(pessoas, '', 2)).toHaveLength(2);
  });

  describe('lista de canais', () => {
    const lista = [
      canal({ id: 'd1', tipo: 'DIRETO', nome: 'Bruno', ultimaMensagemEm: '2026-10-26T10:00:00Z' }),
      canal({ id: 'cs', tipo: 'AREA', area: 'CS', nome: 'Customer Success' }),
      canal({ id: 'g1', nome: 'Antigo', ultimaMensagemEm: '2026-10-20T10:00:00Z' }),
      canal({ id: 'geral', tipo: 'GERAL', nome: 'Geral' }),
      canal({ id: 'g2', nome: 'Recente', ultimaMensagemEm: '2026-10-26T12:00:00Z' }),
      canal({ id: 'g3', nome: 'Arquivado', arquivadoEm: '2026-10-25T10:00:00Z' }),
      canal({ id: 'com', tipo: 'AREA', area: 'COMERCIAL', nome: 'Comercial' }),
    ];

    it('seções na ordem: canais (Geral e áreas), grupos e diretas por recência, arquivados', () => {
      const secoes = secoesDosCanais(lista);
      expect(secoes.map((s) => [s.rotulo, s.canais.map((c) => c.id)])).toEqual([
        ['Canais', ['geral', 'com', 'cs']],
        ['Grupos', ['g2', 'g1']],
        ['Conversas diretas', ['d1']],
        ['Arquivados', ['g3']],
      ]);
    });

    it('o filtro procura no nome sem acentos e esconde as seções vazias', () => {
      expect(secoesDosCanais(lista, 'RECÉN').map((s) => [s.id, s.canais.map((c) => c.id)])).toEqual(
        [['grupos', ['g2']]],
      );
      expect(secoesDosCanais(lista, 'zzz')).toEqual([]);
    });

    it('prévia: "Você:", o primeiro nome de quem escreveu, aviso do sistema sem "@"', () => {
      const ultima = {
        id: 'm',
        autorId: 'u-ana',
        autorNome: 'Ana Lima',
        resumo: 'Bom dia',
        excluida: false,
        criadaEm: '2026-10-26T12:00:00Z',
      };
      expect(previaDoCanal(canal({ ultimaMensagem: ultima }), EU)).toBe('Ana: Bom dia');
      expect(previaDoCanal(canal({ ultimaMensagem: { ...ultima, autorId: EU } }), EU)).toBe(
        'Você: Bom dia',
      );
      expect(previaDoCanal(canal({ tipo: 'DIRETO', ultimaMensagem: ultima }), EU)).toBe('Bom dia');
      expect(previaDoCanal(canal({ ultimaMensagem: { ...ultima, excluida: true } }), EU)).toBe(
        'Ana: Mensagem excluída',
      );
      expect(
        previaDoCanal(
          canal({
            ultimaMensagem: {
              ...ultima,
              autorId: null,
              autorNome: null,
              resumo: '@Ana Lima criou o grupo.',
            },
          }),
          EU,
        ),
      ).toBe('Ana Lima criou o grupo.');
      expect(previaDoCanal(canal(), EU)).toBe('Nenhuma mensagem ainda');
      expect(previaDoCanal(canal({ tipo: 'DIRETO' }), EU)).toBe('Diga olá!');
    });

    it('nome acessível com não lidas e menções (o aberto não conta)', () => {
      const item = canal({ naoLidas: 3, mencoesNaoLidas: 1, silenciado: true });
      expect(rotuloDoItem(item, false)).toBe(
        'Lançamento, 3 não lidas, 1 menção a você, silenciado',
      );
      expect(rotuloDoItem(item, true)).toBe('Lançamento, silenciado');
      expect(
        rotuloDoItem(canal({ tipo: 'DIRETO', nome: 'Ana Lima', outraPessoa: ANA }), false),
      ).toBe('Ana Lima, online');
    });

    it('quandoCurto e textoContagem', () => {
      const agora = new Date(2026, 9, 26, 15, 0);
      expect(quandoCurto(new Date(2026, 9, 26, 9, 5).toISOString(), agora)).toBe('09:05');
      expect(quandoCurto(new Date(2026, 9, 25, 9, 5).toISOString(), agora)).toBe('Ontem');
      expect(quandoCurto(new Date(2026, 9, 22, 9, 5).toISOString(), agora)).toMatch(/^qui/);
      expect(quandoCurto(new Date(2026, 8, 2, 9, 5).toISOString(), agora)).toBe('02/09');
      expect(quandoCurto(new Date(2025, 8, 2, 9, 5).toISOString(), agora)).toBe('02/09/25');
      expect(quandoCurto(null, agora)).toBe('');
      expect(textoContagem(7)).toBe('7');
      expect(textoContagem(120)).toBe('99+');
    });
  });

  it('destacarTermos: sem acentos nem maiúsculas, cada termo', () => {
    expect(destacarTermos('Proposta da Acme revisada', 'acme PROPOSTA')).toEqual([
      { texto: 'Proposta', destaque: true },
      { texto: ' da ', destaque: false },
      { texto: 'Acme', destaque: true },
      { texto: ' revisada', destaque: false },
    ]);
    expect(destacarTermos('Reunião às 15h', 'reuniao')).toEqual([
      { texto: 'Reunião', destaque: true },
      { texto: ' às 15h', destaque: false },
    ]);
    expect(destacarTermos('nada', '')).toEqual([{ texto: 'nada', destaque: false }]);
  });

  it('mesclarMensagens troca pelo id e mantém a ordem de criação', () => {
    const a = mensagem({ id: 'a', criadaEm: '2026-10-26T10:00:00Z' });
    const b = mensagem({ id: 'b', criadaEm: '2026-10-26T11:00:00Z' });
    const bEditada = { ...b, texto: 'editada' };
    const c = mensagem({ id: 'c', criadaEm: '2026-10-26T09:00:00Z' });
    expect(mesclarMensagens([a, b], [bEditada, c]).map((m) => [m.id, m.texto])).toEqual([
      ['c', 'Olá'],
      ['a', 'Olá'],
      ['b', 'editada'],
    ]);
  });
});
