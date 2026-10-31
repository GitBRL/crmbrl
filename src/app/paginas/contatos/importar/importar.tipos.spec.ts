import { describe, expect, it } from 'vitest';

import {
  aplicarProgresso,
  chaveDeCampoPersonalizado,
  erroDoArquivo,
  exigenciasDoMapeamento,
  type Importacao,
  mapearColuna,
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
