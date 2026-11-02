import {
  cabeNoFiltro,
  duracaoCurta,
  duracaoPorExtenso,
  esperaDaConversa,
  formatarTelefone,
  horaCurta,
  janela24h,
  juntarMensagens,
  nomeDoContato,
  ordenarConversas,
  paraMensagemConversa,
  previaDaConversa,
  rotaDoNegocio,
  saudacao,
  slaEstourado,
  variaveisDaConversa,
} from './apresentacao';
import {
  ANA,
  CANAL_INSTAGRAM,
  conversaDetalhe,
  conversaResumo,
  EU,
  ha,
  mensagemDto,
} from './dados-de-teste';
import { fraseDaAtribuicao } from './historico-conversa';

const AGORA = new Date(2026, 9, 26, 14, 30); // segunda-feira, 26/10/2026 14:30 (fuso local)

describe('apresentação do Atendimento', () => {
  describe('horaCurta', () => {
    it('hoje mostra a hora; ontem, "ontem"; na semana, o dia abreviado; antes, a data', () => {
      expect(horaCurta(new Date(2026, 9, 26, 9, 5).toISOString(), AGORA)).toBe('09:05');
      expect(horaCurta(new Date(2026, 9, 25, 23, 0).toISOString(), AGORA)).toBe('ontem');
      expect(horaCurta(new Date(2026, 9, 22, 10, 0).toISOString(), AGORA)).toBe('qui');
      expect(horaCurta(new Date(2026, 8, 2, 10, 0).toISOString(), AGORA)).toBe('02/09');
      expect(horaCurta(new Date(2025, 8, 2, 10, 0).toISOString(), AGORA)).toBe('02/09/2025');
      expect(horaCurta(null, AGORA)).toBe('');
    });
  });

  describe('durações', () => {
    it('curta para o selo e por extenso para o leitor de tela', () => {
      expect(duracaoCurta(20_000)).toBe('agora');
      expect(duracaoCurta(4 * 60_000)).toBe('4 min');
      expect(duracaoCurta(125 * 60_000)).toBe('2 h');
      expect(duracaoCurta(3 * 24 * 3_600_000)).toBe('3 d');
      expect(duracaoPorExtenso(60_000)).toBe('1 minuto');
      expect(duracaoPorExtenso(12 * 60_000)).toBe('12 minutos');
      expect(duracaoPorExtenso(3_600_000)).toBe('1 hora');
      expect(duracaoPorExtenso(2 * 24 * 3_600_000)).toBe('2 dias');
    });
  });

  describe('espera e SLA', () => {
    it('sem ninguém esperando, não há espera', () => {
      expect(esperaDaConversa(conversaResumo({ aguardandoDesde: null }), AGORA)).toBeNull();
      expect(
        esperaDaConversa(
          conversaResumo({ aguardandoDesde: ha(3, AGORA), status: 'RESOLVIDA' }),
          AGORA,
        ),
      ).toBeNull();
    });

    it('esperando dentro do prazo: selo neutro com o tempo', () => {
      const conversa = conversaResumo({
        aguardandoDesde: ha(12, AGORA),
        sla: {
          primeiraRespostaAte: ha(-3, AGORA),
          resolucaoAte: ha(-300, AGORA),
          primeiraRespostaEstourada: false,
          resolucaoEstourada: false,
        },
      });
      expect(esperaDaConversa(conversa, AGORA)).toEqual({
        curta: '12 min',
        frase: 'Esperando resposta há 12 minutos',
        estourada: false,
      });
    });

    it('a API diz que estourou: selo coral e a frase avisa', () => {
      const conversa = conversaResumo({
        aguardandoDesde: ha(40, AGORA),
        sla: {
          primeiraRespostaAte: ha(10, AGORA),
          resolucaoAte: null,
          primeiraRespostaEstourada: true,
          resolucaoEstourada: false,
        },
      });
      expect(esperaDaConversa(conversa, AGORA)?.estourada).toBe(true);
      expect(esperaDaConversa(conversa, AGORA)?.frase).toContain('acima do prazo da fila');
    });

    it('o prazo de resolução vence com o relógio da tela; o da primeira resposta, só sem resposta', () => {
      const vencida = {
        primeiraRespostaAte: ha(5, AGORA),
        resolucaoAte: null,
        primeiraRespostaEstourada: false,
        resolucaoEstourada: false,
      };
      // Na lista não se sabe se a primeira resposta saiu: confia na API.
      expect(
        slaEstourado(conversaResumo({ aguardandoDesde: ha(20, AGORA), sla: vencida }), AGORA),
      ).toBe(false);
      // No detalhe, sem primeira resposta e com o prazo vencido: estourou.
      expect(slaEstourado(conversaDetalhe({ sla: vencida, primeiraRespostaEm: null }), AGORA)).toBe(
        true,
      );
      expect(
        slaEstourado(conversaDetalhe({ sla: vencida, primeiraRespostaEm: ha(30, AGORA) }), AGORA),
      ).toBe(false);
      expect(
        slaEstourado(
          conversaResumo({
            sla: { ...vencida, primeiraRespostaAte: null, resolucaoAte: ha(1, AGORA) },
          }),
          AGORA,
        ),
      ).toBe(true);
      expect(
        slaEstourado(
          conversaResumo({ status: 'RESOLVIDA', sla: { ...vencida, resolucaoEstourada: true } }),
          AGORA,
        ),
      ).toBe(false);
    });
  });

  describe('janela de 24 h', () => {
    it('só no Instagram e no Messenger', () => {
      expect(janela24h(conversaResumo(), AGORA)).toBeNull();
    });

    it('aberta: até quando; fechada: quando fechou', () => {
      const aberta = janela24h(
        conversaResumo({
          canal: CANAL_INSTAGRAM,
          janelaAte: new Date(2026, 9, 27, 9, 15).toISOString(),
        }),
        AGORA,
      );
      expect(aberta).toEqual(
        expect.objectContaining({ aberta: true, frase: 'aberta até amanhã às 09:15' }),
      );
      const fechada = janela24h(
        conversaResumo({
          canal: CANAL_INSTAGRAM,
          janelaAte: new Date(2026, 9, 25, 11, 0).toISOString(),
        }),
        AGORA,
      );
      expect(fechada).toEqual(
        expect.objectContaining({ aberta: false, frase: 'fechou ontem às 11:00' }),
      );
    });
  });

  describe('prévia da última mensagem', () => {
    const com = (
      ultima: Partial<NonNullable<ReturnType<typeof conversaResumo>['ultimaMensagem']>>,
    ) =>
      conversaResumo({
        ultimaMensagem: {
          id: 'm',
          direcao: 'ENTRADA',
          tipo: 'TEXTO',
          previa: 'Oi',
          autorNome: null,
          ocorridaEm: ha(1),
          ...ultima,
        },
      });

    it('do contato, só o texto; da equipe, quem mandou; nota e automática marcadas', () => {
      expect(previaDaConversa(com({}))).toBe('Oi');
      expect(previaDaConversa(com({ direcao: 'SAIDA', autorNome: EU.nome }), EU.nome)).toBe(
        'Você: Oi',
      );
      expect(previaDaConversa(com({ direcao: 'SAIDA', autorNome: 'Ana Souza' }), EU.nome)).toBe(
        'Ana: Oi',
      );
      expect(previaDaConversa(com({ direcao: 'SAIDA', autorNome: null }))).toBe('Automática: Oi');
      expect(previaDaConversa(com({ direcao: 'INTERNA', autorNome: 'Ana Souza' }))).toBe(
        'Nota: Oi',
      );
    });

    it('mídia mostra o tipo; mensagem apagada e conversa vazia têm frase própria', () => {
      expect(previaDaConversa(com({ tipo: 'IMAGEM', previa: 'foto.png' }))).toBe(
        'Imagem · foto.png',
      );
      expect(previaDaConversa(com({ tipo: 'AUDIO', previa: null }))).toBe('Áudio');
      expect(previaDaConversa(com({ tipo: 'TEXTO', previa: null }))).toBe('Mensagem apagada');
      expect(previaDaConversa(conversaResumo({ ultimaMensagem: null }))).toBe('Sem mensagens');
    });
  });

  describe('contato', () => {
    it('telefone brasileiro formatado; nome com reserva no telefone ou e-mail', () => {
      expect(formatarTelefone('5511987654321')).toBe('+55 (11) 98765-4321');
      expect(formatarTelefone('552132104321')).toBe('+55 (21) 3210-4321');
      expect(formatarTelefone('14155550100')).toBe('+14155550100');
      expect(formatarTelefone(null)).toBe('');
      expect(nomeDoContato({ id: 'x', nome: ' ', email: 'a@b.com', telefone: null })).toBe(
        'a@b.com',
      );
      expect(nomeDoContato({ id: 'x', nome: '', email: null, telefone: '5511987654321' })).toBe(
        '+55 (11) 98765-4321',
      );
    });

    it('rota do negócio pela área do funil', () => {
      expect(rotaDoNegocio({ id: 'n1', funil: { area: 'CS' } })).toEqual(['/funis', 'cs', 'n1']);
    });
  });

  describe('mensagens', () => {
    it('entrada leva o nome do contato; saída, o autor e o status; automática tem nome próprio', () => {
      const contexto = { contato: 'Marina Lopes' };
      expect(paraMensagemConversa(mensagemDto(), contexto)).toEqual(
        expect.objectContaining({
          direcao: 'ENTRADA',
          autor: { nome: 'Marina Lopes' },
          status: null,
        }),
      );
      const saida = paraMensagemConversa(
        mensagemDto({
          direcao: 'SAIDA',
          autor: ANA,
          status: 'ENTREGUE',
          texto: 'Veja www.brl.com.br',
        }),
        contexto,
      );
      expect(saida.autor).toEqual({ id: 'u-ana', nome: 'Ana Souza', foto: null });
      expect(saida.status).toBe('ENTREGUE');
      expect(saida.trechos?.some((trecho) => trecho.link === 'https://www.brl.com.br')).toBe(true);
      expect(
        paraMensagemConversa(
          mensagemDto({ direcao: 'SAIDA', autor: null, automatica: true }),
          contexto,
        ).autor,
      ).toEqual({ nome: 'Resposta automática' });
      expect(paraMensagemConversa(mensagemDto({ direcao: 'SISTEMA' }), contexto).autor).toBeNull();
    });

    it('anexo, citação, editada e excluída', () => {
      const dto = mensagemDto({
        tipo: 'IMAGEM',
        texto: null,
        arquivo: {
          id: 'a1',
          nome: 'foto.png',
          mime: 'image/png',
          tamanho: 1234,
          largura: 480,
          altura: 300,
          duracaoSegundos: null,
          criadoEm: ha(5),
          url: '/api/v1/arquivos/a1',
        },
        respostaA: {
          id: 'm0',
          direcao: 'SAIDA',
          tipo: 'TEXTO',
          texto: 'Pode mandar?',
          autorNome: 'Ana Souza',
        },
        editadaEm: ha(1),
      });
      const mensagem = paraMensagemConversa(dto, { contato: 'Marina' });
      expect(mensagem.anexo).toEqual({
        nome: 'foto.png',
        mime: 'image/png',
        url: '/api/v1/arquivos/a1',
        tamanho: 1234,
        duracao: null,
        largura: 480,
        altura: 300,
      });
      expect(mensagem.respondeA).toEqual({
        autor: 'Ana Souza',
        texto: 'Pode mandar?',
        tipo: 'TEXTO',
      });
      expect(mensagem.editada).toBe(true);
      expect(
        paraMensagemConversa(mensagemDto({ excluida: true, texto: null }), { contato: 'M' })
          .excluida,
      ).toBe(true);
    });

    it('localização vira link do mapa; reação e contato compartilhado viram frase', () => {
      const local = paraMensagemConversa(
        mensagemDto({
          tipo: 'LOCALIZACAO',
          texto: null,
          metadados: { latitude: -23.5, longitude: -46.6, nome: 'Escola' },
        }),
        { contato: 'M' },
      );
      expect(local.texto).toBe('Localização: Escola');
      expect(local.trechos?.[1]).toEqual(
        expect.objectContaining({
          link: 'https://www.google.com/maps?q=-23.5,-46.6',
          externo: true,
        }),
      );
      expect(
        paraMensagemConversa(
          mensagemDto({ tipo: 'REACAO', texto: null, metadados: { emoji: '❤' } }),
          {
            contato: 'M',
          },
        ).texto,
      ).toBe('Reagiu com ❤');
      expect(
        paraMensagemConversa(
          mensagemDto({
            tipo: 'CONTATO',
            texto: null,
            metadados: { vcard: 'BEGIN:VCARD\nFN:Paulo Lima\nEND:VCARD' },
          }),
          { contato: 'M' },
        ).texto,
      ).toBe('Contato compartilhado: Paulo Lima');
    });

    it('juntar: sem repetir (a versão nova vence) e em ordem cronológica', () => {
      const a = mensagemDto({ id: 'a', ocorridaEm: '2026-10-26T10:00:00.000Z' });
      const b = mensagemDto({ id: 'b', ocorridaEm: '2026-10-26T10:05:00.000Z', status: 'ENVIADA' });
      const bLida = { ...b, status: 'LIDA' as const };
      const c = mensagemDto({ id: 'c', ocorridaEm: '2026-10-26T09:00:00.000Z' });
      expect(juntarMensagens([a, b], [bLida, c]).map((m) => `${m.id}:${m.status ?? ''}`)).toEqual([
        'c:',
        'a:',
        'b:LIDA',
      ]);
    });
  });

  describe('lista e filtro local (tempo real)', () => {
    it('ordena da mais recente para a mais antiga', () => {
      const velha = conversaResumo({ id: 'v', ultimaMensagemEm: ha(60) });
      const nova = conversaResumo({ id: 'n', ultimaMensagemEm: ha(1) });
      expect(ordenarConversas([velha, nova]).map((c) => c.id)).toEqual(['n', 'v']);
    });

    it('confere escopo, situação, canal, fila, etiqueta, não lidas e busca', () => {
      const minha = conversaResumo();
      const semDono = conversaResumo({ responsavel: null });
      expect(cabeNoFiltro(minha, { escopo: 'MINHAS' }, EU.id)).toBe(true);
      expect(cabeNoFiltro(semDono, { escopo: 'MINHAS' }, EU.id)).toBe(false);
      expect(cabeNoFiltro(semDono, { escopo: 'SEM_RESPONSAVEL' }, EU.id)).toBe(true);
      expect(cabeNoFiltro(minha, { escopo: 'SEM_RESPONSAVEL' }, EU.id)).toBe(false);
      // Padrão: só as em aberto.
      expect(
        cabeNoFiltro(conversaResumo({ status: 'RESOLVIDA' }), { escopo: 'TODAS' }, EU.id),
      ).toBe(false);
      expect(
        cabeNoFiltro(
          conversaResumo({ status: 'RESOLVIDA' }),
          { escopo: 'TODAS', status: ['RESOLVIDA'] },
          EU.id,
        ),
      ).toBe(true);
      expect(cabeNoFiltro(minha, { escopo: 'TODAS', tipoCanal: ['EMAIL'] }, EU.id)).toBe(false);
      expect(cabeNoFiltro(minha, { escopo: 'TODAS', filaId: 'outra' }, EU.id)).toBe(false);
      expect(
        cabeNoFiltro(
          conversaResumo({ etiquetas: ['Escola'] }),
          { escopo: 'TODAS', etiqueta: ['escola'] },
          EU.id,
        ),
      ).toBe(true);
      expect(cabeNoFiltro(minha, { escopo: 'TODAS', naoLidas: true }, EU.id)).toBe(false);
      expect(cabeNoFiltro(minha, { escopo: 'TODAS', busca: 'marína' }, EU.id)).toBe(true);
      expect(cabeNoFiltro(minha, { escopo: 'TODAS', busca: '98765' }, EU.id)).toBe(true);
      expect(cabeNoFiltro(minha, { escopo: 'TODAS', busca: 'otávio' }, EU.id)).toBe(false);
    });
  });

  describe('respostas rápidas', () => {
    it('saudação pela hora e as variáveis da conversa', () => {
      expect(saudacao(new Date(2026, 9, 26, 9))).toBe('Bom dia');
      expect(saudacao(new Date(2026, 9, 26, 15))).toBe('Boa tarde');
      expect(saudacao(new Date(2026, 9, 26, 20))).toBe('Boa noite');
      expect(variaveisDaConversa(conversaResumo(), { nome: 'Ana Souza' }, 'ACME', AGORA)).toEqual({
        'contato.nome': 'Marina Lopes',
        'contato.primeiroNome': 'Marina',
        'contato.email': null,
        'contato.telefone': '+55 (11) 98765-4321',
        'contato.empresa': 'ACME',
        'usuario.nome': 'Ana Souza',
        'usuario.primeiroNome': 'Ana',
        'canal.nome': 'WhatsApp Vendas',
        saudacao: 'Boa tarde',
        'data.hoje': '26/10/2026',
      });
    });
  });

  describe('histórico de atribuições', () => {
    const base = {
      id: 'a',
      de: null,
      para: null,
      deFila: null,
      paraFila: null,
      nota: null,
      por: null,
      tipoAtor: 'SISTEMA',
      criadoEm: ha(1),
    };

    it('frases por motivo', () => {
      expect(
        fraseDaAtribuicao({
          ...base,
          motivo: 'DISTRIBUICAO',
          paraFila: { id: 'f', nome: 'Vendas', area: 'COMERCIAL' },
          para: ANA,
        }),
      ).toBe('A fila Vendas entregou para Ana Souza');
      expect(fraseDaAtribuicao({ ...base, motivo: 'ASSUMIDA', para: ANA })).toBe(
        'Ana Souza assumiu a conversa',
      );
      expect(
        fraseDaAtribuicao({
          ...base,
          motivo: 'TRANSFERENCIA',
          de: ANA,
          para: { id: EU.id, nome: EU.nome },
          por: ANA,
        }),
      ).toBe('Ana Souza transferiu de Ana Souza para João Batista');
      expect(fraseDaAtribuicao({ ...base, motivo: 'REABERTURA', por: ANA, para: ANA })).toBe(
        'Ana Souza reabriu a conversa, que ficou com Ana Souza',
      );
    });
  });
});
