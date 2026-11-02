import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { Botao } from '../../ui/botao/botao';
import { Alternador } from '../../ui/alternador/alternador';
import { BolhaMensagem } from '../../ui/mensagens/bolha-mensagem';
import { Compositor, type EnvioCompositor } from '../../ui/mensagens/compositor';
import { Digitando } from '../../ui/mensagens/digitando';
import { ListaMensagens } from '../../ui/mensagens/lista-mensagens';
import {
  type AnexoMensagem,
  itensDaLista,
  type MensagemConversa,
  ROTULO_STATUS,
  type StatusMensagem,
  tipoDoAnexo,
} from '../../ui/mensagens/mensagens';
import { PlayerAudio } from '../../ui/mensagens/player-audio';
import { PreviaAnexo } from '../../ui/mensagens/previa-anexo';
import type { RespostaRapidaOpcao } from '../../ui/mensagens/respostas-rapidas';
import { SeparadorData } from '../../ui/mensagens/separador-data';
import { StatusEntrega } from '../../ui/mensagens/status-entrega';
import { Exemplo } from './exemplo';
import { Secao } from './secao';

const CONTATO = { id: 'contato', nome: 'Maria Souza' };
const ANA = { id: 'ana', nome: 'Ana Ribeiro' };
const JOAO = { id: 'joao', nome: 'João Batista' };

type Quem = 'contato' | 'ana' | 'joao';
type Fala = readonly [quem: Quem, texto: string];

/** Um dia de conversa cada; o mais recente é o último. */
const ROTEIROS: readonly (readonly Fala[])[] = [
  [
    ['contato', 'Oi! Vi o anúncio de vocês e queria saber mais sobre o plano para escolas.'],
    ['contato', 'Somos uma rede com 3 unidades.'],
    ['ana', 'Olá, Maria! Que bom falar com você. Posso te ajudar, sim.'],
    ['ana', 'Quantos alunos vocês têm, somando as três unidades?'],
    ['contato', 'Uns 850 alunos.'],
    ['ana', 'Para esse tamanho, o plano Rede é o mais indicado: atende até 1.000 alunos.'],
    ['contato', 'E a implantação demora quanto tempo?'],
    ['ana', 'De 5 a 7 dias úteis, com treinamento para a equipe.'],
    ['contato', 'Consigo pagar no boleto?'],
    ['ana', 'Sim: boleto, Pix ou cartão, mensal ou anual.'],
    ['contato', 'Vou falar com a direção e volto a falar com vocês.'],
    ['ana', 'Combinado! Fico no aguardo.'],
  ],
  [
    ['joao', 'Bom dia, Maria! Aqui é o João, da BRL. Conseguiu falar com a direção?'],
    ['contato', 'Bom dia, João! Ainda não, a reunião ficou para quinta.'],
    ['joao', 'Sem problema. Quer que eu prepare uma simulação de valores para levar?'],
    ['contato', 'Seria ótimo!'],
    ['joao', 'Te mando até amanhã cedo.'],
    ['contato', 'Obrigada!'],
  ],
  [
    ['contato', 'Bom dia! A direção aprovou 🎉'],
    ['ana', 'Que ótima notícia, Maria! Parabéns!'],
    ['contato', 'Pode me mandar a proposta em PDF?'],
    ['ana', 'Claro! Preparo agora e te envio ainda hoje.'],
    ['contato', 'Perfeito. Precisa de algum dado nosso?'],
    ['ana', 'Só o CNPJ e o nome de quem vai assinar.'],
    ['contato', 'Mando por e-mail ainda hoje. Quem assina é a diretora, Luíza Campos.'],
    ['ana', 'Anotado. Obrigada pela agilidade!'],
    ['contato', 'Obrigada pela paciência!'],
  ],
];
const AUTORES: Readonly<Record<Quem, { id: string; nome: string }>> = {
  contato: CONTATO,
  ana: ANA,
  joao: JOAO,
};
const DIA_MS = 86_400_000;

/**
 * Mensagens de exemplo, da mais antiga para a mais nova: um roteiro por dia, de trás para a
 * frente (o dia mais recente termina em `ate`; os anteriores começam às 9h30).
 */
function conversaDeExemplo(total: number, ate: number): MensagemConversa[] {
  const dias: MensagemConversa[][] = [];
  let quantas = 0;
  for (let dia = 0; quantas < total; dia++) {
    const roteiro = ROTEIROS[ROTEIROS.length - 1 - (dia % ROTEIROS.length)];
    const data = new Date(ate - dia * DIA_MS);
    const comeco =
      dia === 0
        ? ate - roteiro.length * 3 * 60_000
        : new Date(data.getFullYear(), data.getMonth(), data.getDate(), 9, 30).getTime();
    dias.unshift(
      roteiro.map(([quem, texto], i) => {
        const daEquipe = quem !== 'contato';
        return {
          id: '',
          direcao: daEquipe ? 'SAIDA' : 'ENTRADA',
          tipo: 'TEXTO',
          texto,
          criadaEm: new Date(comeco + i * 3 * 60_000 + (i % 3) * 40_000),
          autor: AUTORES[quem],
          status: daEquipe ? 'LIDA' : null,
        } satisfies MensagemConversa;
      }),
    );
    quantas += roteiro.length;
  }
  return dias
    .flat()
    .slice(-total)
    .map((mensagem, i) => ({ ...mensagem, id: `exemplo-${i}` }));
}

/** Um WAV curto com uma "fala" sintética, para o player tocar de verdade. */
function gerarAudio(segundos = 6, taxa = 16_000): string {
  const amostras = Math.floor(segundos * taxa);
  const dados = new DataView(new ArrayBuffer(44 + amostras * 2));
  const escrever = (posicao: number, texto: string) =>
    [...texto].forEach((letra, i) => dados.setUint8(posicao + i, letra.charCodeAt(0)));
  escrever(0, 'RIFF');
  dados.setUint32(4, 36 + amostras * 2, true);
  escrever(8, 'WAVEfmt ');
  dados.setUint32(16, 16, true);
  dados.setUint16(20, 1, true);
  dados.setUint16(22, 1, true);
  dados.setUint32(24, taxa, true);
  dados.setUint32(28, taxa * 2, true);
  dados.setUint16(32, 2, true);
  dados.setUint16(34, 16, true);
  escrever(36, 'data');
  dados.setUint32(40, amostras * 2, true);
  for (let i = 0; i < amostras; i++) {
    const t = i / taxa;
    const silaba = Math.max(0, Math.sin(Math.PI * t * 3.1)) ** 2;
    const voz = Math.sin(2 * Math.PI * 180 * t) + 0.4 * Math.sin(2 * Math.PI * 360 * t);
    dados.setInt16(44 + i * 2, Math.round(voz * silaba * 0.25 * 32767), true);
  }
  return URL.createObjectURL(new Blob([dados.buffer], { type: 'audio/wav' }));
}

/** Uma "foto" com o brilho do palco e barras de dado, para a prévia de imagem. */
function gerarImagem(documento: Document): Promise<string | null> {
  const tela = documento.createElement('canvas');
  tela.width = 640;
  tela.height = 420;
  const ctx = tela.getContext('2d');
  if (!ctx) {
    return Promise.resolve(null);
  }
  // As cores saem dos tokens da paleta (o brilho é o do palco escuro).
  const estilo = getComputedStyle(documento.documentElement);
  const token = (nome: string) => estilo.getPropertyValue(nome).trim() || 'gray';
  ctx.fillStyle = token('--pb-preto');
  ctx.fillRect(0, 0, 640, 420);
  const brilho = (x: number, y: number, cor: string) => {
    const radial = ctx.createRadialGradient(x, y, 0, x, y, 420);
    radial.addColorStop(0, cor);
    radial.addColorStop(1, 'transparent');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, 640, 420);
  };
  brilho(0, 0, 'rgba(0, 200, 170, 0.35)');
  brilho(640, 420, 'rgba(190, 70, 160, 0.35)');
  const cores = ['--pb-ciano', '--pb-menta', '--pb-lima', '--pb-coral'].map(token);
  [460, 380, 300, 220].forEach((largura, i) => {
    ctx.fillStyle = cores[i];
    ctx.beginPath();
    ctx.roundRect(60, 70 + i * 78, largura, 52, 26);
    ctx.fill();
  });
  return new Promise((resolver) =>
    tela.toBlob((blob) => resolver(blob ? URL.createObjectURL(blob) : null), 'image/png'),
  );
}

/**
 * Seção 15 do catálogo: os componentes de conversa de `ui/mensagens/` (bolhas, lista virtual,
 * compositor, player, prévias, "digitando", separador e status). A conversa de exemplo funciona
 * de verdade: enviar acrescenta uma bolha que passa por enviando → enviada → entregue → lida.
 * Uso interno de paginas/design-system.
 */
@Component({
  selector: 'app-ds-conversas',
  imports: [
    Alternador,
    BolhaMensagem,
    Botao,
    Compositor,
    Digitando,
    Exemplo,
    ListaMensagens,
    PlayerAudio,
    PreviaAnexo,
    Secao,
    SeparadorData,
    StatusEntrega,
  ],
  templateUrl: './conversas.html',
  styleUrl: './conversas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Conversas {
  private readonly agora = Date.now();
  private readonly temporizadores = new Set<ReturnType<typeof setTimeout>>();
  private readonly urls: string[] = [];
  private proximoId = 1;
  private paginasAnteriores = 3;

  protected readonly lista = viewChild(ListaMensagens);

  protected readonly respostas: readonly RespostaRapidaOpcao[] = [
    {
      id: 'r1',
      atalho: 'boasvindas',
      titulo: 'Boas-vindas',
      texto: 'Olá, {{contato.nome}}! Aqui é {{usuario.nome}}, da BRL. Como posso ajudar?',
    },
    {
      id: 'r2',
      atalho: 'proposta',
      titulo: 'Envio de proposta',
      texto: 'Segue a proposta. Ela vale por 15 dias; qualquer dúvida, é só chamar.',
    },
    {
      id: 'r3',
      atalho: 'horario',
      titulo: 'Horário de atendimento',
      texto: 'Atendemos de segunda a sexta, das 8h às 18h.',
    },
    {
      id: 'r4',
      atalho: 'pagamento',
      titulo: 'Formas de pagamento',
      texto: 'Aceitamos boleto, Pix e cartão, mensal ou anual.',
    },
  ];
  protected readonly variaveis = { 'contato.nome': 'Maria', 'usuario.nome': 'Ana' };

  // Conversa ao vivo
  protected readonly mensagens = signal<readonly MensagemConversa[]>(
    conversaDeExemplo(180, this.agora),
  );
  protected readonly carregandoAnteriores = signal(false);
  protected readonly temAnteriores = signal(true);
  protected readonly digitando = signal(false);
  protected readonly ultimoEnvio = signal('');

  // Mídia gerada no navegador (o catálogo não tem arquivos de exemplo).
  protected readonly audioUrl = signal<string | null>(null);
  protected readonly imagem = signal<AnexoMensagem | null>(null);
  protected readonly documento: AnexoMensagem = {
    nome: 'Proposta Escola Horizonte.pdf',
    mime: 'application/pdf',
    url: '/design-system',
    tamanho: 1_284_000,
  };

  // Bolhas (agrupadas como na lista: o nome só na primeira do grupo, o avatar na última)
  protected readonly bolhas = signal<readonly MensagemConversa[]>([]);
  protected readonly itensBolhas = computed(() => itensDaLista(this.bolhas()));
  protected readonly rotuloStatus = ROTULO_STATUS;
  protected readonly ontem = new Date(this.agora - 86_400_000);
  protected readonly statusExemplo: readonly StatusMensagem[] = [
    'PENDENTE',
    'ENVIADA',
    'ENTREGUE',
    'LIDA',
    'FALHOU',
  ];

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.temporizadores.forEach(clearTimeout);
      this.urls.forEach((url) => URL.revokeObjectURL(url));
    });
    afterNextRender(() => {
      const audio = gerarAudio();
      this.urls.push(audio);
      this.audioUrl.set(audio);
      void gerarImagem(document).then((url) => {
        if (url) {
          this.urls.push(url);
          this.imagem.set({
            nome: 'fachada-escola.png',
            mime: 'image/png',
            url,
            largura: 640,
            altura: 420,
            tamanho: 182_000,
          });
        }
        this.bolhas.set(this.bolhasDeExemplo());
      });
    });
  }

  protected carregarAnteriores(): void {
    if (this.carregandoAnteriores() || !this.temAnteriores()) {
      return;
    }
    this.carregandoAnteriores.set(true);
    this.depois(900, () => {
      const primeira = this.mensagens()[0];
      // As anteriores terminam às 17h do dia antes da primeira carregada.
      const vespera = new Date(
        (primeira ? new Date(primeira.criadaEm).getTime() : this.agora) - DIA_MS,
      );
      const ate = new Date(vespera.getFullYear(), vespera.getMonth(), vespera.getDate(), 17);
      const anteriores = conversaDeExemplo(40, ate.getTime()).map((mensagem) => ({
        ...mensagem,
        id: `anterior-${this.paginasAnteriores}-${mensagem.id}`,
      }));
      this.mensagens.update((lista) => [...anteriores, ...lista]);
      this.paginasAnteriores--;
      this.temAnteriores.set(this.paginasAnteriores > 0);
      this.carregandoAnteriores.set(false);
    });
  }

  protected simularRecebida(): void {
    this.digitando.set(false);
    this.acrescentar({
      id: `recebida-${this.proximoId++}`,
      direcao: 'ENTRADA',
      tipo: 'TEXTO',
      texto: 'Recebi a proposta! Vou ler com calma e te respondo ainda hoje.',
      criadaEm: new Date(),
      autor: CONTATO,
    });
  }

  protected enviar(envio: EnvioCompositor): void {
    const anexos = envio.anexos.map((arquivo) => this.anexoLocal(arquivo));
    const partes: MensagemConversa[] = [];
    anexos.forEach((anexo, i) =>
      partes.push(
        this.novaMensagem(envio, {
          tipo: envio.audio
            ? 'AUDIO'
            : (
                {
                  imagem: 'IMAGEM',
                  video: 'VIDEO',
                  audio: 'AUDIO',
                  documento: 'DOCUMENTO',
                } as const
              )[tipoDoAnexo(anexo.mime, anexo.nome)],
          anexo,
          texto: i === anexos.length - 1 ? envio.texto || null : null,
        }),
      ),
    );
    if (!anexos.length) {
      partes.push(this.novaMensagem(envio, { tipo: 'TEXTO', texto: envio.texto }));
    }
    partes.forEach((mensagem) => this.acrescentar(mensagem));
    this.ultimoEnvio.set(
      envio.nota
        ? 'Nota interna salva.'
        : envio.audio
          ? 'Áudio enviado.'
          : `Enviado: ${envio.texto || `${anexos.length} anexo(s)`}`,
    );
    if (!envio.nota) {
      partes.forEach((mensagem) => this.avancarStatus(mensagem.id));
    }
  }

  protected tentarDeNovo(mensagem: MensagemConversa): void {
    this.trocarStatus(mensagem.id, 'PENDENTE');
    this.avancarStatus(mensagem.id);
  }

  private novaMensagem(
    envio: EnvioCompositor,
    dados: Pick<MensagemConversa, 'tipo'> & Partial<MensagemConversa>,
  ): MensagemConversa {
    return {
      id: `enviada-${this.proximoId++}`,
      direcao: envio.nota ? 'INTERNA' : 'SAIDA',
      criadaEm: new Date(),
      autor: ANA,
      status: envio.nota ? null : 'PENDENTE',
      ...dados,
    };
  }

  private anexoLocal(arquivo: File): AnexoMensagem {
    const url = URL.createObjectURL(arquivo);
    this.urls.push(url);
    return { nome: arquivo.name, mime: arquivo.type, url, tamanho: arquivo.size };
  }

  private acrescentar(mensagem: MensagemConversa): void {
    this.mensagens.update((lista) => [...lista, mensagem]);
  }

  /** Enviando → enviada → entregue → lida (a cada ~1 s). */
  private avancarStatus(id: string): void {
    (['ENVIADA', 'ENTREGUE', 'LIDA'] as const).forEach((status, i) =>
      this.depois(700 + i * 1100, () => this.trocarStatus(id, status)),
    );
  }

  private trocarStatus(id: string, status: StatusMensagem): void {
    this.mensagens.update((lista) =>
      lista.map((mensagem) =>
        mensagem.id === id ? { ...mensagem, status, erro: null } : mensagem,
      ),
    );
  }

  private depois(ms: number, acao: () => void): void {
    const temporizador = setTimeout(() => {
      this.temporizadores.delete(temporizador);
      acao();
    }, ms);
    this.temporizadores.add(temporizador);
  }

  private bolhasDeExemplo(): readonly MensagemConversa[] {
    const base = this.agora - 40 * 60_000;
    const em = (minutos: number) => new Date(base + minutos * 60_000);
    const imagem = this.imagem();
    const audio = this.audioUrl();
    const lista: MensagemConversa[] = [
      {
        id: 'b1',
        direcao: 'SISTEMA',
        tipo: 'TEXTO',
        texto: 'Conversa atribuída a Ana Ribeiro pela fila Comercial',
        criadaEm: em(0),
      },
      {
        id: 'b2',
        direcao: 'ENTRADA',
        tipo: 'TEXTO',
        texto: 'Oi! Vocês têm o material do plano para escolas? Vi em www.brl.com.br/escolas',
        criadaEm: em(1),
        autor: CONTATO,
      },
      {
        id: 'b3',
        direcao: 'ENTRADA',
        tipo: 'TEXTO',
        texto: 'É para uma rede com 3 unidades.',
        criadaEm: em(2),
        autor: CONTATO,
      },
      {
        id: 'b4',
        direcao: 'SAIDA',
        tipo: 'TEXTO',
        texto: 'Temos sim, Maria! Te mando o PDF agora.',
        criadaEm: em(4),
        autor: ANA,
        status: 'LIDA',
      },
      {
        id: 'b5',
        direcao: 'SAIDA',
        tipo: 'DOCUMENTO',
        anexo: this.documento,
        criadaEm: em(5),
        autor: ANA,
        status: 'ENTREGUE',
      },
      {
        id: 'b6',
        direcao: 'INTERNA',
        tipo: 'TEXTO',
        texto: 'Rede com 3 unidades: vale oferecer o plano Rede. @João, consegue o desconto?',
        trechos: [
          { texto: 'Rede com 3 unidades: vale oferecer o plano Rede. ' },
          { texto: '@João', link: '/configuracoes/perfil', tipo: 'mencao' },
          { texto: ', consegue o desconto?' },
        ],
        criadaEm: em(6),
        autor: ANA,
      },
      {
        id: 'b7',
        direcao: 'ENTRADA',
        tipo: 'TEXTO',
        texto: 'Recebi, obrigada! Uma dúvida: o treinamento é presencial?',
        criadaEm: em(9),
        autor: CONTATO,
        respondeA: { autor: 'Ana Ribeiro', texto: 'Temos sim, Maria! Te mando o PDF agora.' },
      },
      {
        id: 'b8',
        direcao: 'SAIDA',
        tipo: 'TEXTO',
        texto: 'Pode ser presencial ou on-line, como a escola preferir.',
        criadaEm: em(10),
        autor: JOAO,
        status: 'FALHOU',
        erro: 'O WhatsApp não aceitou a mensagem. Confira a conexão do número.',
      },
    ];
    if (imagem) {
      lista.push({
        id: 'b9',
        direcao: 'ENTRADA',
        tipo: 'IMAGEM',
        anexo: imagem,
        criadaEm: em(12),
        autor: CONTATO,
      });
    }
    if (audio) {
      lista.push({
        id: 'b10',
        direcao: 'ENTRADA',
        tipo: 'AUDIO',
        anexo: { nome: 'audio.wav', mime: 'audio/wav', url: audio, duracao: 6 },
        criadaEm: em(13),
        autor: CONTATO,
      });
    }
    lista.push({
      id: 'b11',
      direcao: 'SAIDA',
      tipo: 'TEXTO',
      texto: 'Enviando a confirmação…',
      criadaEm: em(14),
      autor: ANA,
      status: 'PENDENTE',
    });
    return lista;
  }
}
