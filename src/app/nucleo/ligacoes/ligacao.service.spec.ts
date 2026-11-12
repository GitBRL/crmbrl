import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AvisosService } from '../avisos.service';
import type { Papel } from '../papeis';
import { SessaoService } from '../sessao/sessao.service';
import { perfilDeTeste, type PapelDeTeste } from '../sessao/sessao-de-teste';
import { provideSocketFalso } from '../tempo-real/tempo-real-de-teste';
import { LigacaoService } from './ligacao.service';
import { ligacaoDeTeste, provideNavegadorFalso } from './ligacoes-de-teste';

const OFERTA = 'v=0\r\na=oferta-da-meta\r\n';
const TOCANDO = {
  ligacaoId: 'lig-1',
  contato: { id: 'ct-1', nome: 'Maria Oficial', telefone: '5511999990001', empresa: null },
  canal: { id: 'canal-1', nome: 'WhatsApp Oficial' },
  ofertaSdp: OFERTA,
  expiraEm: new Date(Date.now() + 60_000).toISOString(),
  conversaId: 'conv-1',
};

/** Deixa as continuações das promessas rodarem. */
async function microtarefas(): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
}

describe('LigacaoService (softphone)', () => {
  let http: HttpTestingController;
  let falso: ReturnType<typeof provideSocketFalso>;
  let navegador: ReturnType<typeof provideNavegadorFalso>;

  function iniciar(papel: PapelDeTeste = 'COMERCIAL') {
    TestBed.inject(SessaoService).definirPerfil(perfilDeTeste(papel));
    const servico = TestBed.inject(LigacaoService);
    TestBed.tick();
    return servico;
  }

  async function socket() {
    await microtarefas();
    return falso.ultimo();
  }

  /** Atende a ligação que toca, respondendo as duas chamadas da API. */
  async function atender(servico: LigacaoService, id = 'lig-1') {
    const promessa = servico.atender(id);
    await microtarefas();
    http.expectOne('/api/v1/ligacoes/configuracao-webrtc').flush({ stunUrls: [] });
    await microtarefas();
    const pedido = http.expectOne(`/api/v1/ligacoes/${id}/atender`);
    pedido.flush(
      ligacaoDeTeste({ id, estado: 'EM_ANDAMENTO', atendidaEm: new Date().toISOString() }),
    );
    await promessa;
    await microtarefas();
    return pedido.request;
  }

  beforeEach(() => {
    falso = provideSocketFalso();
    navegador = provideNavegadorFalso();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        falso.providers,
        navegador.providers,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    TestBed.inject(LigacaoService).encerrar();
    http.match(() => true);
    TestBed.resetTestingModule();
  });

  describe('ligação recebida', () => {
    it('ligacao.tocando mostra o toque e começa o som; deixou_de_tocar tira os dois', async () => {
      const servico = iniciar();
      const s = await socket();
      s.receber('ligacao.tocando', TOCANDO);
      expect(servico.toques().map((t) => t.ligacaoId)).toEqual(['lig-1']);
      expect(navegador.toque.tocar).toHaveBeenCalled();
      s.receber('ligacao.deixou_de_tocar', { ligacaoId: 'lig-1', motivo: 'tempo_esgotado' });
      expect(servico.toques()).toEqual([]);
      expect(navegador.toque.parar).toHaveBeenCalled();
    });

    it('outra pessoa atendeu: o toque some e o atendente é avisado', async () => {
      const servico = iniciar();
      const s = await socket();
      s.receber('ligacao.tocando', TOCANDO);
      s.receber('ligacao.deixou_de_tocar', {
        ligacaoId: 'lig-1',
        motivo: 'atendida_por_outro',
        atendidaPor: { id: 'u2', nome: 'Juliana' },
      });
      expect(servico.toques()).toEqual([]);
      expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toContain('Juliana');
    });

    it('"Recusar" (dispensar) só some o aviso nesta aba e não volta com um novo sincronizar', async () => {
      const servico = iniciar();
      const s = await socket();
      s.receber('ligacao.tocando', TOCANDO);
      servico.dispensar('lig-1');
      expect(servico.toques()).toEqual([]);
      s.receber('ligacao.tocando', TOCANDO);
      expect(servico.toques()).toEqual([]);
    });

    it('"Recusar" avisa a API, some na hora e ignora o 409 de quem chegou tarde', async () => {
      const servico = iniciar();
      const s = await socket();
      s.receber('ligacao.tocando', TOCANDO);
      const promessa = servico.recusar('lig-1');
      expect(servico.toques()).toEqual([]);
      http
        .expectOne('/api/v1/ligacoes/lig-1/recusar')
        .flush({ message: 'Já atendida.' }, { status: 409, statusText: 'Conflict' });
      await expect(promessa).resolves.toBeUndefined();
      s.receber('ligacao.deixou_de_tocar', { ligacaoId: 'lig-1', motivo: 'recusada_por_voce' });
      expect(servico.toques()).toEqual([]);
    });

    it('atender: abre o microfone, manda a resposta SDP com CRLF e só então liga o áudio', async () => {
      const servico = iniciar();
      const s = await socket();
      s.receber('ligacao.tocando', TOCANDO);
      const promessa = servico.atender('lig-1');
      await microtarefas();
      http.expectOne('/api/v1/ligacoes/configuracao-webrtc').flush({ stunUrls: [] });
      await microtarefas();
      // Enquanto a API não responde, o microfone fica fechado para o cliente e o áudio parado.
      expect(servico.emCurso()?.fase).toBe('conectando');
      expect(navegador.microfones[0].faixas[0].enabled).toBe(false);
      expect(navegador.audio.play).not.toHaveBeenCalled();
      const pedido = http.expectOne('/api/v1/ligacoes/lig-1/atender');
      expect(pedido.request.body.sdp).toContain('a=resposta-falsa');
      expect(pedido.request.body.sdp.endsWith('\r\n')).toBe(true);
      expect(navegador.conexoes[0].remoteDescription?.sdp).toBe(OFERTA);
      pedido.flush(
        ligacaoDeTeste({ estado: 'EM_ANDAMENTO', atendidaEm: new Date().toISOString() }),
      );
      await promessa;
      expect(servico.emCurso()?.fase).toBe('em-andamento');
      expect(navegador.microfones[0].faixas[0].enabled).toBe(true);
      navegador.conexoes[0].receberAudio();
      servico['ligarAudioDoCliente']();
      expect(navegador.audio.play).toHaveBeenCalled();
      expect(servico.streamLocal()).not.toBeNull();
    });

    it('mudo desliga só a faixa do microfone, sem derrubar a conexão', async () => {
      const servico = iniciar();
      const s = await socket();
      s.receber('ligacao.tocando', TOCANDO);
      await atender(servico);
      servico.alternarMudo();
      expect(servico.mudo()).toBe(true);
      expect(navegador.microfones[0].faixas[0].enabled).toBe(false);
      expect(navegador.conexoes[0].fechada).toBe(false);
      servico.alternarMudo();
      expect(navegador.microfones[0].faixas[0].enabled).toBe(true);
    });

    it('encerrar: desliga o áudio na hora, chama a API e o fim vem em ligacao.encerrada', async () => {
      const servico = iniciar();
      const s = await socket();
      s.receber('ligacao.tocando', TOCANDO);
      await atender(servico);
      const promessa = servico.encerrar();
      await microtarefas();
      expect(navegador.conexoes[0].fechada).toBe(true);
      expect(servico.emCurso()?.fase).toBe('encerrando');
      http
        .expectOne('/api/v1/ligacoes/lig-1/encerrar')
        .flush(ligacaoDeTeste({ estado: 'EM_ANDAMENTO' }));
      await promessa;
      s.receber('ligacao.encerrada', {
        ligacaoId: 'lig-1',
        estado: 'ENCERRADA',
        duracaoSegundos: 75,
        motivo: 'encerrada_pelo_atendente',
        motivoTexto: 'Encerrada por você',
      });
      expect(servico.emCurso()).toBeNull();
      expect(servico.fim()?.texto).toContain('1:15');
      expect(servico.fim()?.tom).toBe('sucesso');
      expect(servico.encerradas()).toBe(1);
      expect(servico.streamLocal()).toBeNull();
    });

    it('"Encerrar" durante o "Conectando…": vira recusa e, se a API já aceitou o atendimento, desliga em seguida', async () => {
      const servico = iniciar();
      const s = await socket();
      s.receber('ligacao.tocando', TOCANDO);
      const atendendo = servico.atender('lig-1');
      await microtarefas();
      http.expectOne('/api/v1/ligacoes/configuracao-webrtc').flush({ stunUrls: [] });
      await microtarefas();
      const aceite = http.expectOne('/api/v1/ligacoes/lig-1/atender');
      expect(servico.emCurso()?.fase).toBe('conectando');
      const encerrando = servico.encerrar();
      await microtarefas();
      // Não chama /encerrar (a API recusaria: a ligação ainda toca); recusa e libera a barra.
      http.expectNone('/api/v1/ligacoes/lig-1/encerrar');
      expect(servico.emCurso()).toBeNull();
      expect(navegador.conexoes[0].fechada).toBe(true);
      http
        .expectOne('/api/v1/ligacoes/lig-1/recusar')
        .flush({ message: 'Já atendida.' }, { status: 409, statusText: 'Conflict' });
      await encerrando;
      // A API aceitou o atendimento que já estava a caminho: a barra não volta a "Em ligação".
      aceite.flush(
        ligacaoDeTeste({
          id: 'lig-1',
          estado: 'EM_ANDAMENTO',
          atendidaEm: new Date().toISOString(),
        }),
      );
      await atendendo;
      await microtarefas();
      expect(servico.emCurso()).toBeNull();
      http
        .expectOne('/api/v1/ligacoes/lig-1/encerrar')
        .flush(ligacaoDeTeste({ estado: 'ENCERRADA' }));
    });

    it('o cliente desligou: ligacao.encerrada fecha a mídia sem chamar a API', async () => {
      const servico = iniciar();
      const s = await socket();
      s.receber('ligacao.tocando', TOCANDO);
      await atender(servico);
      s.receber('ligacao.encerrada', {
        ligacaoId: 'lig-1',
        estado: 'ENCERRADA',
        duracaoSegundos: 10,
        motivo: 'encerrada_pelo_cliente',
        motivoTexto: 'O cliente desligou',
      });
      expect(servico.emCurso()).toBeNull();
      expect(navegador.conexoes[0].fechada).toBe(true);
      http.expectNone('/api/v1/ligacoes/lig-1/encerrar');
    });

    it('microfone negado: a ligação continua tocando e o aviso explica o que fazer', async () => {
      const servico = iniciar();
      const s = await socket();
      s.receber('ligacao.tocando', TOCANDO);
      navegador.falharMicrofone('NotAllowedError');
      const promessa = servico.atender('lig-1');
      await microtarefas();
      http.expectOne('/api/v1/ligacoes/configuracao-webrtc').flush({ stunUrls: [] });
      await promessa;
      expect(servico.emCurso()).toBeNull();
      expect(servico.toques().length).toBe(1);
      expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toContain('microfone');
      http.expectNone('/api/v1/ligacoes/lig-1/atender');
    });

    it('409 atendida_por_outro: mostra quem atendeu e não deixa mídia aberta', async () => {
      const servico = iniciar();
      const s = await socket();
      s.receber('ligacao.tocando', TOCANDO);
      const promessa = servico.atender('lig-1');
      await microtarefas();
      http.expectOne('/api/v1/ligacoes/configuracao-webrtc').flush({ stunUrls: [] });
      await microtarefas();
      http.expectOne('/api/v1/ligacoes/lig-1/atender').flush(
        {
          statusCode: 409,
          erro: 'conflito',
          mensagem: 'Já foi atendida.',
          detalhes: { motivo: 'atendida_por_outro', atendidaPor: { id: 'u2', nome: 'Juliana' } },
          requisicaoId: 'r1',
        },
        { status: 409, statusText: 'Conflict' },
      );
      await promessa;
      await microtarefas();
      expect(servico.emCurso()).toBeNull();
      expect(servico.fim()?.texto).toContain('Juliana');
      expect(navegador.conexoes[0].fechada).toBe(true);
    });

    it('uma ligação por vez: com uma em curso, outro toque não aparece', async () => {
      const servico = iniciar();
      const s = await socket();
      s.receber('ligacao.tocando', TOCANDO);
      await atender(servico);
      s.receber('ligacao.tocando', { ...TOCANDO, ligacaoId: 'lig-2' });
      expect(servico.toques()).toEqual([]);
    });
  });

  describe('ligação feita', () => {
    const contato = { id: 'ct-9', nome: 'Diego Mídia', telefone: '5511999990004' };

    async function ligar(servico: LigacaoService, extra: object = {}) {
      const promessa = servico.ligar({ contato, canalId: 'canal-1', ...extra });
      await microtarefas();
      http.expectOne('/api/v1/ligacoes/configuracao-webrtc').flush({ stunUrls: [] });
      await microtarefas();
      return { promessa, pedido: http.expectOne('/api/v1/ligacoes') };
    }

    it('liga: manda a oferta (com a atividade), mostra "chamando" e aplica a resposta SDP quando chega', async () => {
      const servico = iniciar();
      const s = await socket();
      const { promessa, pedido } = await ligar(servico, { atividadeId: 'at-1' });
      expect(servico.emCurso()?.fase).toBe('preparando');
      expect(pedido.request.body).toMatchObject({
        contatoId: 'ct-9',
        canalId: 'canal-1',
        atividadeId: 'at-1',
      });
      expect(pedido.request.body.sdp).toContain('a=oferta-falsa');
      pedido.flush(
        ligacaoDeTeste({
          id: 'lig-9',
          direcao: 'FEITA',
          estado: 'CHAMANDO',
          contato: { ...contato, empresa: null },
        }),
      );
      const resultado = await promessa;
      expect(resultado.ok).toBe(true);
      expect(servico.emCurso()).toMatchObject({ id: 'lig-9', fase: 'chamando' });

      s.receber('ligacao.estado', { ligacaoId: 'lig-9', estado: 'TOCANDO' });
      expect(servico.emCurso()?.fase).toBe('tocando');
      s.receber('ligacao.resposta_sdp', { ligacaoId: 'lig-9', sdp: 'v=0\na=resposta-da-meta' });
      await microtarefas();
      expect(navegador.conexoes[0].remoteDescription).toEqual({
        type: 'answer',
        sdp: 'v=0\r\na=resposta-da-meta\r\n',
      });
      s.receber('ligacao.estado', {
        ligacaoId: 'lig-9',
        estado: 'EM_ANDAMENTO',
        atendidaEm: new Date().toISOString(),
      });
      expect(servico.emCurso()?.fase).toBe('em-andamento');
    });

    it('eventos que chegam antes da resposta do POST são guardados e aplicados depois', async () => {
      const servico = iniciar();
      const s = await socket();
      const { promessa, pedido } = await ligar(servico);
      s.receber('ligacao.estado', { ligacaoId: 'lig-9', estado: 'TOCANDO' });
      s.receber('ligacao.resposta_sdp', { ligacaoId: 'lig-9', sdp: 'v=0\na=cedo' });
      pedido.flush(ligacaoDeTeste({ id: 'lig-9', direcao: 'FEITA', estado: 'CHAMANDO' }));
      await promessa;
      await microtarefas();
      expect(servico.emCurso()?.fase).toBe('tocando');
      expect(navegador.conexoes[0].remoteDescription?.sdp).toContain('a=cedo');
    });

    it('sem permissão (422): devolve o motivo e não deixa a barra nem o microfone abertos', async () => {
      const servico = iniciar();
      await socket();
      const { promessa, pedido } = await ligar(servico);
      pedido.flush(
        {
          statusCode: 422,
          erro: 'regra_violada',
          mensagem: 'O cliente ainda não permitiu ligações.',
          detalhes: { motivo: 'sem_permissao', regra: 'R29' },
          requisicaoId: 'r2',
        },
        { status: 422, statusText: 'Unprocessable' },
      );
      const resultado = await promessa;
      expect(resultado).toMatchObject({ ok: false, motivo: 'sem_permissao' });
      expect(servico.emCurso()).toBeNull();
      expect(navegador.conexoes[0].fechada).toBe(true);
      expect(navegador.microfones[0].faixas[0].parada).toBe(true);
    });

    it('microfone negado: não chama a API e explica', async () => {
      const servico = iniciar();
      await socket();
      navegador.falharMicrofone('NotAllowedError');
      const promessa = servico.ligar({ contato });
      await microtarefas();
      http.expectOne('/api/v1/ligacoes/configuracao-webrtc').flush({ stunUrls: [] });
      const resultado = await promessa;
      expect(resultado).toMatchObject({ ok: false, motivo: 'microfone' });
      http.expectNone('/api/v1/ligacoes');
      expect(servico.emCurso()).toBeNull();
    });

    it('recusada pelo cliente: o fim aparece com a frase certa', async () => {
      const servico = iniciar();
      const s = await socket();
      const { promessa, pedido } = await ligar(servico);
      pedido.flush(ligacaoDeTeste({ id: 'lig-9', direcao: 'FEITA', estado: 'CHAMANDO' }));
      await promessa;
      s.receber('ligacao.encerrada', {
        ligacaoId: 'lig-9',
        estado: 'RECUSADA',
        duracaoSegundos: null,
        motivo: 'recusada_pelo_cliente',
        motivoTexto: 'O cliente recusou',
      });
      expect(servico.emCurso()).toBeNull();
      expect(servico.fim()).toMatchObject({
        estado: 'RECUSADA',
        texto: 'O cliente recusou a ligação.',
      });
    });

    it('cancelar enquanto o microfone abre não chega a falar com a API', async () => {
      const servico = iniciar();
      await socket();
      const promessa = servico.ligar({ contato });
      await microtarefas();
      await servico.encerrar();
      http.match('/api/v1/ligacoes/configuracao-webrtc').forEach((r) => r.flush({ stunUrls: [] }));
      const resultado = await promessa;
      expect(resultado.ok).toBe(false);
      http.expectNone('/api/v1/ligacoes');
      expect(servico.emCurso()).toBeNull();
    });

    it('já em ligação: recusa uma segunda', async () => {
      const servico = iniciar();
      const s = await socket();
      s.receber('ligacao.tocando', TOCANDO);
      await atender(servico);
      const resultado = await servico.ligar({ contato });
      expect(resultado).toMatchObject({ ok: false, motivo: 'ja_em_ligacao' });
    });
  });

  describe('retomada e permissões', () => {
    it('ao conectar, o que a API diz que está tocando ou em andamento volta para a tela', async () => {
      const servico = iniciar();
      const s = await socket();
      s.simularConexao();
      TestBed.tick();
      await microtarefas();
      http
        .expectOne('/api/v1/ligacoes/canais')
        .flush([{ id: 'canal-1', nome: 'Oficial', botaoVisivel: true }]);
      http.expectOne('/api/v1/ligacoes/ativas').flush({
        emAndamento: null,
        tocando: [
          ligacaoDeTeste({
            ofertaSdp: OFERTA,
            expiraEm: new Date(Date.now() + 8_000).toISOString(),
          }),
        ],
      });
      await microtarefas();
      expect(servico.toques().length).toBe(1);
    });

    it('ligação em andamento sem áudio nesta aba (página recarregada): só dá para encerrar', async () => {
      const servico = iniciar();
      const s = await socket();
      s.simularConexao();
      TestBed.tick();
      await microtarefas();
      http.expectOne('/api/v1/ligacoes/canais').flush([]);
      http.expectOne('/api/v1/ligacoes/ativas').flush({
        emAndamento: ligacaoDeTeste({
          estado: 'EM_ANDAMENTO',
          atendidaEm: new Date(Date.now() - 5_000).toISOString(),
        }),
        tocando: [],
      });
      await microtarefas();
      expect(servico.emCurso()).toMatchObject({ semAudioNestaAba: true, fase: 'em-andamento' });
      expect(servico.segundos()).toBeGreaterThanOrEqual(4);
      servico.alternarMudo();
      expect(servico.mudo()).toBe(false);
    });

    it('Marketing (R12) não consulta ligações nem vê o botão', async () => {
      const servico = iniciar('MARKETING');
      const s = await socket();
      s.simularConexao();
      TestBed.tick();
      await microtarefas();
      http.expectNone('/api/v1/ligacoes/ativas');
      http.expectNone('/api/v1/ligacoes/canais');
      await servico.carregarCanais();
      expect(servico.canais()).toEqual([]);
    });

    it('carregarCanais guarda a lista (uma consulta só) e trata 403 como vazio', async () => {
      const servico = iniciar();
      const promessa = servico.carregarCanais();
      http
        .expectOne('/api/v1/ligacoes/canais')
        .flush([{ id: 'canal-1', nome: 'Oficial', botaoVisivel: true }]);
      await promessa;
      await servico.carregarCanais();
      http.expectNone('/api/v1/ligacoes/canais');
      expect(servico.canais()).toEqual([{ id: 'canal-1', nome: 'Oficial', botaoVisivel: true }]);
    });

    it('abrirPorLink: mostra o toque se a ligação ainda toca; senão diz que terminou', async () => {
      const servico = iniciar();
      await socket();
      let promessa = servico.abrirPorLink('lig-7');
      http.expectOne('/api/v1/ligacoes/lig-7').flush(
        ligacaoDeTeste({
          id: 'lig-7',
          ofertaSdp: OFERTA,
          expiraEm: new Date(Date.now() + 8_000).toISOString(),
        }),
      );
      await promessa;
      expect(servico.toques().map((t) => t.ligacaoId)).toEqual(['lig-7']);
      expect(servico.destaque()).toBe('lig-7');

      promessa = servico.abrirPorLink('lig-8');
      http
        .expectOne('/api/v1/ligacoes/lig-8')
        .flush(ligacaoDeTeste({ id: 'lig-8', estado: 'PERDIDA' }));
      await promessa;
      expect(servico.toques().map((t) => t.ligacaoId)).toEqual(['lig-7']);
      expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toContain('já terminou');
    });
  });
});
