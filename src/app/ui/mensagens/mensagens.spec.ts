import {
  duracaoFalada,
  duracaoLegivel,
  extensao,
  fraseDigitando,
  itensDaLista,
  JANELA_GRUPO_MS,
  type MensagemConversa,
  motivoDeRecusa,
  rotuloDoDia,
  substituirVariaveis,
  tamanhoLegivel,
  tipoDoAnexo,
  trechosDoTexto,
} from './mensagens';

const MARIA = { id: 'c1', nome: 'Maria Souza' };
const ANA = { id: 'u1', nome: 'Ana Ribeiro' };

function mensagem(
  id: string,
  criadaEm: Date,
  dados: Partial<MensagemConversa> = {},
): MensagemConversa {
  return { id, direcao: 'ENTRADA', tipo: 'TEXTO', texto: id, criadaEm, autor: MARIA, ...dados };
}

describe('mensagens (modelo e formatos)', () => {
  it('tipoDoAnexo: pelo MIME e, se ele for genérico, pela extensão', () => {
    expect(tipoDoAnexo('image/jpeg')).toBe('imagem');
    expect(tipoDoAnexo('VIDEO/MP4')).toBe('video');
    expect(tipoDoAnexo('audio/ogg; codecs=opus')).toBe('audio');
    expect(tipoDoAnexo('application/pdf', 'proposta.pdf')).toBe('documento');
    expect(tipoDoAnexo('application/octet-stream', 'foto.WEBP')).toBe('imagem');
    expect(tipoDoAnexo('', 'nota.opus')).toBe('audio');
    expect(tipoDoAnexo(null, 'clipe.mov')).toBe('video');
    expect(tipoDoAnexo(undefined)).toBe('documento');
  });

  it('extensao: o que vem depois do último ponto, em maiúsculas', () => {
    expect(extensao('relatorio.final.pdf')).toBe('PDF');
    expect(extensao('LEIAME')).toBe('');
    expect(extensao('.oculto')).toBe('');
    expect(extensao('termina.')).toBe('');
  });

  it('tamanhoLegivel: base 1024, uma casa a partir de MB, vírgula decimal', () => {
    expect(tamanhoLegivel(512)).toBe('512 B');
    expect(tamanhoLegivel(12 * 1024)).toBe('12 KB');
    expect(tamanhoLegivel(1_284_000)).toBe('1,2 MB');
    expect(tamanhoLegivel(1.1 * 1024 ** 3)).toBe('1,1 GB');
    expect(tamanhoLegivel(null)).toBe('');
    expect(tamanhoLegivel(-1)).toBe('');
    expect(tamanhoLegivel(Number.NaN)).toBe('');
  });

  it('duracaoLegivel e duracaoFalada', () => {
    expect(duracaoLegivel(12)).toBe('0:12');
    expect(duracaoLegivel(65.9)).toBe('1:05');
    expect(duracaoLegivel(3723)).toBe('1:02:03');
    expect(duracaoLegivel(null)).toBe('0:00');
    expect(duracaoFalada(65)).toBe('1 minuto e 5 segundos');
    expect(duracaoFalada(120)).toBe('2 minutos');
    expect(duracaoFalada(1)).toBe('1 segundo');
    expect(duracaoFalada(0)).toBe('0 segundos');
  });

  it('rotuloDoDia: Hoje, Ontem, dia da semana na última semana e a data antes disso', () => {
    const agora = new Date(2026, 9, 23, 10, 0); // sexta-feira, 23/10/2026
    expect(rotuloDoDia(new Date(2026, 9, 23, 0, 1), agora)).toBe('Hoje');
    expect(rotuloDoDia(new Date(2026, 9, 22, 23, 59), agora)).toBe('Ontem');
    expect(rotuloDoDia(new Date(2026, 9, 19, 9, 0), agora)).toBe('Segunda-feira');
    expect(rotuloDoDia(new Date(2026, 9, 16, 9, 0), agora)).toBe('16 de outubro');
    expect(rotuloDoDia(new Date(2025, 11, 31, 9, 0), agora)).toBe('31 de dezembro de 2025');
    expect(rotuloDoDia('não é data', agora)).toBe('');
  });

  it('trechosDoTexto: endereços da web viram links externos, sem a pontuação que fecha a frase', () => {
    expect(trechosDoTexto('Veja www.brl.com.br/escolas, por favor.')).toEqual([
      { texto: 'Veja ' },
      {
        texto: 'www.brl.com.br/escolas',
        link: 'https://www.brl.com.br/escolas',
        externo: true,
        tipo: 'link',
      },
      { texto: ', por favor.' },
    ]);
    expect(trechosDoTexto('(https://exemplo.com/a?b=1)')).toEqual([
      { texto: '(' },
      {
        texto: 'https://exemplo.com/a?b=1',
        link: 'https://exemplo.com/a?b=1',
        externo: true,
        tipo: 'link',
      },
      { texto: ')' },
    ]);
    // Só texto: HTML continua sendo texto (o Angular escapa na interpolação).
    expect(trechosDoTexto('<b>oi</b>')).toEqual([{ texto: '<b>oi</b>' }]);
    expect(trechosDoTexto('javascript:alert(1)')).toEqual([{ texto: 'javascript:alert(1)' }]);
    expect(trechosDoTexto('')).toEqual([]);
    expect(trechosDoTexto(null)).toEqual([]);
  });

  it('substituirVariaveis: troca as conhecidas e deixa as sem valor como estão', () => {
    const texto = 'Olá, {{contato.nome}}! Aqui é {{ usuario.nome }}. Pedido {{pedido}}.';
    expect(
      substituirVariaveis(texto, { 'contato.nome': 'Maria', 'usuario.nome': 'Ana', pedido: '' }),
    ).toBe('Olá, Maria! Aqui é Ana. Pedido {{pedido}}.');
  });

  it('fraseDigitando: uma, duas ou várias pessoas', () => {
    expect(fraseDigitando([])).toBe('');
    expect(fraseDigitando(['Maria'])).toBe('Maria está digitando…');
    expect(fraseDigitando(['Maria', 'Ana'])).toBe('Maria e Ana estão digitando…');
    expect(fraseDigitando(['Maria', 'Ana', 'João'])).toBe('3 pessoas estão digitando…');
  });

  describe('itensDaLista', () => {
    const agora = new Date(2026, 9, 23, 12, 0);
    const em = (dia: number, hora: number, minuto = 0) => new Date(2026, 9, dia, hora, minuto);

    it('vazia não tem nem o topo', () => {
      expect(itensDaLista([], agora)).toEqual([]);
    });

    it('topo, um separador por dia e as mensagens com chaves estáveis', () => {
      const itens = itensDaLista(
        [mensagem('a', em(22, 9)), mensagem('b', em(23, 9)), mensagem('c', em(23, 10))],
        agora,
      );
      expect(itens.map((item) => item.id)).toEqual([
        'topo',
        'data:2026-10-22',
        'm:a',
        'data:2026-10-23',
        'm:b',
        'm:c',
      ]);
      expect(itens.filter((item) => item.tipo === 'data').map((item) => item.rotulo)).toEqual([
        'Ontem',
        'Hoje',
      ]);
    });

    it('agrupa o mesmo autor em sequência (até 5 min entre elas), não a direção nem o autor diferentes', () => {
      const base = em(23, 9);
      const depois = (ms: number) => new Date(base.getTime() + ms);
      const itens = itensDaLista(
        [
          mensagem('1', base),
          mensagem('2', depois(60_000)),
          mensagem('3', depois(60_000 + JANELA_GRUPO_MS + 1)),
          mensagem('4', depois(JANELA_GRUPO_MS * 2), { direcao: 'SAIDA', autor: ANA }),
          mensagem('5', depois(JANELA_GRUPO_MS * 2 + 1000), { direcao: 'INTERNA', autor: ANA }),
          mensagem('6', depois(JANELA_GRUPO_MS * 2 + 2000), { direcao: 'SISTEMA', autor: null }),
          mensagem('7', depois(JANELA_GRUPO_MS * 2 + 3000), { direcao: 'SISTEMA', autor: null }),
        ],
        agora,
      );
      const marcas = Object.fromEntries(
        itens
          .filter((item) => item.tipo === 'mensagem')
          .map((item) => [item.mensagem.id, `${+item.continuacao}${+item.seguida}`]),
      );
      expect(marcas).toEqual({
        '1': '01', // começa o grupo
        '2': '10', // continua; a próxima passou da janela
        '3': '00',
        '4': '00', // saída depois de entrada
        '5': '00', // nota interna não se junta à saída
        '6': '00', // avisos do sistema nunca se agrupam
        '7': '00',
      });
    });

    it('mesmo autor em dias diferentes não se agrupa', () => {
      const itens = itensDaLista(
        [mensagem('a', em(22, 23, 59)), mensagem('b', em(23, 0, 1))],
        agora,
      );
      const b = itens.find((item) => item.id === 'm:b');
      expect(b?.tipo === 'mensagem' && b.continuacao).toBe(false);
    });
  });

  describe('motivoDeRecusa (R11)', () => {
    const arquivo = (name: string, type: string, size: number) => ({ name, type, size });
    const MB = 1024 * 1024;

    it('SVG e HTML são recusados, pelo MIME ou pela extensão', () => {
      expect(motivoDeRecusa(arquivo('logo.svg', 'image/svg+xml', 10))).toContain(
        'SVG e HTML não são aceitos',
      );
      expect(motivoDeRecusa(arquivo('pagina.HTML', '', 10))).toContain(
        'SVG e HTML não são aceitos',
      );
      expect(motivoDeRecusa(arquivo('x.xhtml', 'application/xhtml+xml', 10))).toContain(
        '“x.xhtml”',
      );
    });

    it('25 MB para imagem, áudio e vídeo; 100 MB para documentos', () => {
      expect(motivoDeRecusa(arquivo('foto.jpg', 'image/jpeg', 25 * MB))).toBeNull();
      expect(motivoDeRecusa(arquivo('foto.jpg', 'image/jpeg', 25 * MB + 1))).toBe(
        '“foto.jpg” passa de 25 MB, o limite para imagens, áudios e vídeos.',
      );
      expect(motivoDeRecusa(arquivo('contrato.pdf', 'application/pdf', 99 * MB))).toBeNull();
      expect(motivoDeRecusa(arquivo('contrato.pdf', 'application/pdf', 100 * MB + 1))).toBe(
        '“contrato.pdf” passa de 100 MB, o limite para documentos.',
      );
      expect(
        motivoDeRecusa(arquivo('a.zip', 'application/zip', 30 * MB), {
          padraoMb: 10,
          documentoMb: 20,
        }),
      ).toBe('“a.zip” passa de 20 MB, o limite para documentos.');
    });
  });
});
