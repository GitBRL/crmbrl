import { describe, expect, it } from 'vitest';

import {
  aplicarProgresso,
  chaveDeCampoPersonalizado,
  erroDoArquivo,
  etapasParaImportacao,
  filtroDasRegras,
  exigenciasDoMapeamento,
  type FunisDaPlanilha,
  type Importacao,
  linhasSemDestino,
  normalizarValor,
  resumoPorStatus,
  valoresIguais,
  mapearColuna,
  operadorSemValor,
  regraCompleta,
  resumoDoRodape,
} from './importar.tipos';

const BASE = {
  id: 'i1',
  status: 'PROCESSANDO',
  totalLinhas: 200,
  processadas: 100,
  criados: 90,
  atualizados: 5,
  ignorados: 3,
  erros: 2,
  progresso: 50,
  relatorioId: null,
} as unknown as Importacao;

describe('importação: regras da tela', () => {
  it('propõe a chave de campo próprio sem acento nem símbolos', () => {
    expect(chaveDeCampoPersonalizado('Data de Nascimento')).toBe('data_de_nascimento');
    expect(chaveDeCampoPersonalizado('  Região (UF) ')).toBe('regiao_uf');
    expect(chaveDeCampoPersonalizado('???')).toBe('');
  });

  it('não repete o mesmo campo em duas colunas e permite tirar o campo', () => {
    const m = mapearColuna({ A: 'nome', B: 'email' }, 'C', 'nome');
    expect(m).toEqual({ B: 'email', C: 'nome' });
    expect(mapearColuna(m, 'B', null)).toEqual({ C: 'nome' });
  });

  it('exige nome e e-mail ou telefone para contatos, só o nome para empresas', () => {
    expect(exigenciasDoMapeamento('CONTATOS', { A: 'nome' }).map((e) => e.atendida)).toEqual([
      true,
      false,
    ]);
    expect(
      exigenciasDoMapeamento('CONTATOS', { A: 'nome', B: 'telefone' }).every((e) => e.atendida),
    ).toBe(true);
    expect(exigenciasDoMapeamento('EMPRESAS', { A: 'nome' }).every((e) => e.atendida)).toBe(true);
  });

  it('aplica o progresso, ignora outra importação e evento repetido atrasado', () => {
    const novo = aplicarProgresso(BASE, {
      importacaoId: 'i1',
      status: 'PROCESSANDO',
      totalLinhas: 200,
      processadas: 150,
      criados: 140,
      atualizados: 5,
      ignorados: 3,
      erros: 2,
    });
    expect(novo.progresso).toBe(75);
    expect(aplicarProgresso(BASE, { ...novo, importacaoId: 'outra' } as never)).toBe(BASE);
    expect(aplicarProgresso(novo, { ...novo, processadas: 100 } as never)).toBe(novo);
  });

  it('ao concluir vai a 100% e guarda o relatório', () => {
    const fim = aplicarProgresso(BASE, {
      importacaoId: 'i1',
      status: 'CONCLUIDA',
      totalLinhas: 200,
      processadas: 200,
      criados: 190,
      atualizados: 5,
      ignorados: 3,
      erros: 2,
      relatorioId: 'r1',
    });
    expect(fim.progresso).toBe(100);
    expect(fim.relatorioId).toBe('r1');
  });

  it('só aceita csv e xlsx e recusa arquivo vazio', () => {
    expect(erroDoArquivo({ name: 'a.CSV', size: 10 })).toBeNull();
    expect(erroDoArquivo({ name: 'a.xlsx', size: 10 })).toBeNull();
    expect(erroDoArquivo({ name: 'a.pdf', size: 10 })).toMatch(/formato/);
    expect(erroDoArquivo({ name: 'a.csv', size: 0 })).toMatch(/vazio/);
  });
});

describe('importação: filtro, negócio e rodapé', () => {
  it('regra incompleta (sem coluna ou sem valor) não vai para a API', () => {
    const regras = [
      { chave: 1, coluna: 'Cidade', operador: 'IGUAL' as const, valor: ' Recife ' },
      { chave: 2, coluna: 'Cidade', operador: 'CONTEM' as const, valor: '' },
      { chave: 3, coluna: null, operador: 'VAZIO' as const, valor: '' },
      { chave: 4, coluna: 'Email', operador: 'PREENCHIDO' as const, valor: 'lixo' },
    ];
    expect(regras.map(regraCompleta)).toEqual([true, false, false, true]);
    expect(filtroDasRegras('QUALQUER', regras)).toEqual({
      combinacao: 'QUALQUER',
      regras: [
        { coluna: 'Cidade', operador: 'IGUAL', valor: 'Recife' },
        { coluna: 'Email', operador: 'PREENCHIDO' },
      ],
    });
    expect(filtroDasRegras('TODAS', [regras[1]])).toBeNull();
  });

  it('vazio e preenchido não têm valor', () => {
    expect(operadorSemValor('VAZIO')).toBe(true);
    expect(operadorSemValor('PREENCHIDO')).toBe(true);
    expect(operadorSemValor('IGUAL')).toBe(false);
  });

  it('as etapas para o negócio não incluem a de perda', () => {
    const etapas = [{ tipo: 'ABERTA' }, { tipo: 'GANHO' }, { tipo: 'PERDIDO' }];
    expect(etapasParaImportacao(etapas).map((e) => e.tipo)).toEqual(['ABERTA', 'GANHO']);
  });

  it('resumo do rodapé', () => {
    expect(
      resumoDoRodape({
        totalLinhas: 3500,
        linhasNoFiltro: 1240,
        negocio: { funil: 'Comercial', etapa: 'Novo lead' },
      }),
    ).toBe('1.240 de 3.500 linhas · negócio em Comercial › Novo lead');
    expect(resumoDoRodape({ totalLinhas: 50, linhasNoFiltro: null, negocio: null })).toBe(
      '50 linhas',
    );
  });
});

describe('conferência de funis e etapas', () => {
  it('normaliza o valor como a API: sem acento, minúsculas, aparado', () => {
    expect(normalizarValor('  1º CONTATO - Negociação ')).toBe('1º contato - negociacao');
  });

  it('resume por status só com o que não é zero', () => {
    expect(resumoPorStatus({ ABERTO: 7, GANHO: 1, PERDIDO: 2 })).toBe(
      '7 abertas, 1 ganha, 2 perdidas',
    );
    expect(resumoPorStatus({ ABERTO: 1, GANHO: 0, PERDIDO: 0 })).toBe('1 aberta');
  });

  it('conta as linhas sem destino por funil ou por etapa', () => {
    const dados: FunisDaPlanilha = {
      semFunil: 0,
      funis: [
        {
          valor: 'A',
          linhas: 4,
          porStatus: { ABERTO: 4, GANHO: 0, PERDIDO: 0 },
          funil: null,
          como: null,
          problema: 'NAO_ENCONTRADO',
          etapas: [],
        },
        {
          valor: 'B',
          linhas: 5,
          porStatus: { ABERTO: 5, GANHO: 0, PERDIDO: 0 },
          funil: { id: 'f', nome: 'B', area: 'COMERCIAL' },
          como: 'NOME',
          problema: null,
          etapas: [
            { valor: 'x', linhas: 2, etapa: null, como: null, problema: 'NAO_ENCONTRADA' },
            {
              valor: 'y',
              linhas: 3,
              etapa: { id: 'e', nome: 'y', tipo: 'ABERTA' },
              como: 'NOME',
              problema: null,
            },
          ],
        },
      ],
    };
    expect(linhasSemDestino(dados)).toBe(6);
    expect(linhasSemDestino(null)).toBe(0);
  });

  it('compara objetos sem depender da ordem das chaves', () => {
    expect(
      valoresIguais({ a: { x: '1', y: '2' }, b: '3' }, { b: '3', a: { y: '2', x: '1' } }),
    ).toBe(true);
    expect(valoresIguais({ a: '1' }, { a: '2' })).toBe(false);
  });

  it('junta o contador de negócios atualizados do evento', () => {
    const atual = { ...BASE, negociosAtualizados: 0 } as unknown as Importacao;
    const novo = aplicarProgresso(atual, {
      importacaoId: 'i1',
      status: 'PROCESSANDO',
      totalLinhas: 200,
      processadas: 120,
      criados: 100,
      atualizados: 5,
      ignorados: 3,
      erros: 2,
      negociosAtualizados: 4,
    });
    expect(novo.negociosAtualizados).toBe(4);
  });
});
