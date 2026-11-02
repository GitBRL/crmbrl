import { validarPassos } from '../../ui/editor-passos/passos';
import type { PassoApi } from './automacoes.tipos';
import {
  APOIO_VAZIO,
  type Bruto,
  definicoesDePassos,
  passosDaApi,
  passosParaApi,
} from './passos-automacao';

const funilDaEtapa = (etapa: string) => (etapa === 'et-1' ? 'fu-1' : undefined);

describe('passos da automação', () => {
  const API: PassoApi[] = [
    {
      id: 'zap',
      tipo: 'acao.whatsapp',
      rotulo: 'Boas-vindas',
      config: { texto: 'Oi, {{contato.primeiro_nome}}', canalId: 'canal-1' },
    },
    { id: 'espera', tipo: 'aguardar', config: { quantidade: 2, unidade: 'dias' } },
    {
      id: 'tarefa',
      tipo: 'acao.atividade',
      config: {
        tipo: 'LIGACAO',
        titulo: 'Ligar',
        prioridade: 'ALTA',
        prazo: { quantidade: 1, unidade: 'horas' },
      },
    },
    {
      id: 'se',
      tipo: 'condicao',
      config: {
        segmento: {
          condicoes: [{ campo: 'etiquetas', operador: 'contem_alguma', valor: ['cliente'] }],
        },
      },
      ramos: [
        {
          id: 'sim',
          rotulo: 'Se sim',
          passos: [{ id: 'et', tipo: 'acao.etiquetar', config: { adicionar: ['a', 'b'] } }],
        },
      ],
    },
  ];

  it('mostra os passos na tela em campos simples', () => {
    const bruto: Bruto = new Map();
    const passos = passosDaApi(API, bruto);
    expect(passos[0].config).toMatchObject({ texto: 'Oi, {{contato.primeiro_nome}}' });
    expect(passos[2].config).toMatchObject({
      prazoQuantidade: 1,
      prazoUnidade: 'horas',
      prioridade: 'ALTA',
    });
    expect(passos[3].config).toMatchObject({ tipoCondicao: 'etiqueta', valor: 'cliente' });
    expect(passos[3].ramos?.map((r) => r.rotulo)).toEqual(['Se sim', 'Se não']);
    expect(passos[3].ramos?.[0].passos[0].config).toMatchObject({ adicionar: 'a, b' });
    expect(validarPassos(passos, definicoesDePassos(APOIO_VAZIO))).toEqual([]);
  });

  it('ida e volta mantém o que a tela não edita (rótulo e canal)', () => {
    const bruto: Bruto = new Map();
    const passos = passosDaApi(API, bruto);
    const volta = passosParaApi(passos, bruto, funilDaEtapa);
    expect(volta[0]).toEqual(API[0]);
    expect(volta[1].config).toEqual({ quantidade: 2, unidade: 'dias' });
    expect(volta[2].config).toEqual(API[2].config);
    expect(volta[3].ramos?.map((r) => r.id)).toEqual(['sim', 'nao']);
    expect(volta[3].ramos?.[0].passos[0].config).toEqual({ adicionar: ['a', 'b'] });
    expect(volta[3].config).toEqual(API[3].config);
  });

  it('edição na tela volta para a API com objetos e listas', () => {
    const bruto: Bruto = new Map();
    const passos = passosDaApi(API, bruto);
    const editados = [
      {
        ...passos[2],
        config: { ...passos[2].config, prazoQuantidade: 3, prazoUnidade: 'dias', titulo: 'Novo' },
      },
    ];
    expect(passosParaApi(editados, bruto, funilDaEtapa)[0].config).toMatchObject({
      titulo: 'Novo',
      prazo: { quantidade: 3, unidade: 'dias' },
    });
  });

  it('criar negócio leva o funil da etapa escolhida', () => {
    const novo = [
      {
        id: 'n',
        tipo: 'acao.criar_negocio',
        config: { etapaId: 'et-1', titulo: 'Oportunidade', valor: 1500 },
      },
    ];
    expect(passosParaApi(novo, new Map(), funilDaEtapa)[0].config).toEqual({
      etapaId: 'et-1',
      funilId: 'fu-1',
      titulo: 'Oportunidade',
      valor: 1500,
    });
  });

  it('notificar uma pessoa específica manda a lista de usuários', () => {
    const novo = [
      {
        id: 'n',
        tipo: 'acao.notificar',
        config: { para: 'usuarios', usuarioId: 'u1', titulo: 'Olhe' },
      },
    ];
    expect(passosParaApi(novo, new Map(), funilDaEtapa)[0].config).toEqual({
      para: 'usuarios',
      usuarioIds: ['u1'],
      titulo: 'Olhe',
    });
  });

  it('ids repetidos ganham sufixo', () => {
    const dois = [
      { id: 'passo-1', tipo: 'encerrar', config: {} },
      { id: 'passo-1', tipo: 'encerrar', config: {} },
    ];
    expect(passosParaApi(dois, new Map(), funilDaEtapa).map((p) => p.id)).toEqual([
      'passo-1',
      'passo-1-2',
    ]);
  });

  it('condição avançada fica como estava', () => {
    const avancada: PassoApi[] = [
      {
        id: 'se',
        tipo: 'condicao',
        config: {
          segmento: { condicoes: [{ campo: 'campos.cidade', operador: 'igual', valor: 'Rio' }] },
        },
        ramos: [],
      },
    ];
    const bruto: Bruto = new Map();
    const passos = passosDaApi(avancada, bruto);
    expect(passos[0].config['tipoCondicao']).toBe('avancada');
    expect(passosParaApi(passos, bruto, funilDaEtapa)[0].config).toEqual(avancada[0].config);
  });
});
