import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { erroDaApi } from './api/erro-api';
import { AvisosService, MAXIMO_AVISOS } from './avisos.service';

describe('AvisosService', () => {
  let avisos: AvisosService;

  beforeEach(() => {
    avisos = TestBed.inject(AvisosService);
  });

  it('enfileira avisos por tipo, com a ação pelo rótulo', () => {
    avisos.sucesso('Contato salvo.');
    const executar = vi.fn();
    const id = avisos.info('Atividade concluída.', { acao: { rotulo: 'Desfazer', executar } });
    expect(avisos.lista()).toEqual([
      { id: 1, tipo: 'sucesso', mensagem: 'Contato salvo.' },
      { id, tipo: 'info', mensagem: 'Atividade concluída.', acao: 'Desfazer' },
    ]);

    avisos.agir(id);
    expect(executar).toHaveBeenCalledTimes(1);
    avisos.dispensar(id);
    expect(avisos.lista().map((aviso) => aviso.id)).toEqual([1]);
  });

  it('erro aceita a falha: mensagem humana e, no 5xx, o código para o suporte', () => {
    const falha = new HttpErrorResponse({
      status: 500,
      error: { statusCode: 500, erro: 'erro_interno', mensagem: 'x', requisicaoId: 'req-9' },
    });
    avisos.erro(falha);
    expect(avisos.lista()[0]).toMatchObject({
      tipo: 'erro',
      mensagem: erroDaApi(falha).resumo,
      codigo: 'req-9',
    });
    avisos.erro('Não foi possível salvar.');
    expect(avisos.lista()[1]).toEqual({
      id: 2,
      tipo: 'erro',
      mensagem: 'Não foi possível salvar.',
    });
  });

  it('a mesma chave substitui o aviso anterior; passa do máximo, sai o mais antigo', () => {
    avisos.info('Sessão terminou.', { chave: 'sessao' });
    avisos.info('Sessão terminou.', { chave: 'sessao' });
    expect(avisos.lista().length).toBe(1);

    for (let i = 0; i < MAXIMO_AVISOS + 1; i++) {
      avisos.sucesso(`Aviso ${i}`);
    }
    expect(avisos.lista().length).toBe(MAXIMO_AVISOS);
    expect(avisos.lista().at(-1)?.mensagem).toBe(`Aviso ${MAXIMO_AVISOS}`);
    avisos.limpar();
    expect(avisos.lista()).toEqual([]);
  });
});
