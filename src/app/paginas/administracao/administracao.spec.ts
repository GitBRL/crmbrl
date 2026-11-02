import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { Administracao } from './administracao';
import { dadosLegiveis, formatarValor, nomesDosDados } from './formatar-valor';
import { fimDoDia, inicioDoDia, problemaDoPeriodo } from './periodo';
import { ROTULO_ACAO, rotuloDaAcao, rotuloDoCampo } from './tipos';

/**
 * As ações que a API registra na auditoria (`acao:` dos serviços de `crmbrl-api/src` e
 * `GET /auditoria/filtros` da base de demonstração, em 22/10/2026). Ação nova na API: inclua
 * aqui e o rótulo em `ROTULO_ACAO`.
 */
const ACOES_DA_API = [
  'atividade.atualizada',
  'atividade.cancelada',
  'atividade.concluida',
  'atividade.criada',
  'atividade.encaminhada',
  'atividade.reaberta',
  'contato.anonimizado',
  'contato.atualizado',
  'contato.criado',
  'contato.encaminhado',
  'contato.reconvertido',
  'empresa.atualizada',
  'empresa.criada',
  'empresa.encaminhada',
  'etapa.atualizada',
  'etapa.criada',
  'etapa.excluida',
  'funil.arquivado',
  'funil.atualizado',
  'funil.criado',
  'funil.etapas_reordenadas',
  'funil.excluido',
  'funil.reativado',
  'negocio.assumido',
  'negocio.atualizado',
  'negocio.criado',
  'negocio.encaminhado',
  'negocio.excluido',
  'negocio.ganho',
  'negocio.movido',
  'negocio.perdido',
  'negocio.reaberto',
  'negocio.reconvertido',
  'negocio.reposicionado',
  'passagem.atualizada',
  'passagem.criada',
  'passagem.excluida',
  'passagem.executada',
  'passagem.responsavel_fixo_alterado',
  'regra_distribuicao.atualizada',
  'regra_distribuicao.criada',
  'regra_distribuicao.participante_definido',
  'regra_distribuicao.participante_removido',
  'usuario.atualizado',
  'usuario.bloqueado_forca_bruta',
  'usuario.convite_enviado',
  'usuario.criado',
  'usuario.desligado',
  'usuario.lider_alterado',
  'usuario.login',
  'usuario.login_falhou',
  'usuario.logout',
  'usuario.reativado',
  'usuario.redefinicao_solicitada',
  'usuario.senha_alterada',
  'usuario.senha_redefinida',
  'usuario.senha_temporaria_definida',
  'usuario.troca_de_senha_falhou',
  'webhook_entrada.atualizado',
  'webhook_entrada.criado',
  'webhook_entrada.excluido',
  'webhook_entrada.responsavel_fixo_alterado',
  'webhook_entrada.segredo_definido',
  'webhook_entrada.segredo_removido',
  'webhook_entrada.token_regenerado',
  'webhook_entrega.dados_apagados',
  'webhook_entrega.reenviada',
  'webhook_recebimento.dados_apagados',
  'webhook_recebimento.reprocessado',
  'webhook_saida.atualizado',
  'webhook_saida.criado',
  'webhook_saida.desativado_automaticamente',
  'webhook_saida.excluido',
  'webhook_saida.segredo_regenerado',
  'webhook_saida.teste_enviado',
];

describe('apoio da Administração', () => {
  it('toda ação que a API registra tem rótulo revisado, e o mapa só tem ações da API', () => {
    expect(ACOES_DA_API.filter((acao) => !ROTULO_ACAO[acao])).toEqual([]);
    expect(Object.keys(ROTULO_ACAO).filter((acao) => !ACOES_DA_API.includes(acao))).toEqual([]);
  });

  it('ações e campos em português, com nome legível para os desconhecidos', () => {
    expect(rotuloDaAcao('negocio.movido')).toBe('Negócio movido');
    expect(rotuloDaAcao('usuario.bloqueado_forca_bruta')).toBe(
      'Entrada bloqueada (muitas tentativas)',
    );
    expect(rotuloDaAcao('webhook_saida.algo_novo')).toBe('Webhook de saída: algo novo');
    expect(rotuloDoCampo('responsavelId')).toBe('Responsável');
    expect(rotuloDoCampo('ultimaOrigemDetalhe')).toBe('Ultima origem detalhe');
  });

  it('dados do desligamento em lista legível (pessoa pelo nome, contagens sem os zeros)', () => {
    const linhas = dadosLegiveis(
      {
        area: 'COMERCIAL',
        papel: 'COMERCIAL',
        contagens: { atividades: 1, negocios: 1, contatos: 1, empresas: 0, rodizios: 3 },
        liderados: [],
        destinatario: { id: 'u-rafael', nome: 'Rafael Mendes', papel: 'LIDER_COMERCIAL' },
        motivoDestinatario: 'LIDER',
      },
      rotuloDoCampo,
    ).map((linha) => `${linha.campo}: ${linha.valor.texto}`);
    expect(linhas).toEqual([
      'Área: Comercial',
      'Papel: Comercial',
      'Em números: 1 atividade · 1 negócio · 1 contato · saiu de 3 rodízios',
      'Liderados: —',
      'Quem recebeu: Rafael Mendes (Líder Comercial)',
      'Por que essa pessoa: É o líder de quem saiu',
    ]);
  });

  it('valores do diff legíveis', () => {
    expect(formatarValor(null)).toEqual({ texto: '—', vazio: true });
    expect(formatarValor('[omitido]')).toEqual({ texto: 'omitido (dado sensível)', vazio: true });
    expect(formatarValor(true).texto).toBe('Sim');
    expect(formatarValor(1600).texto).toBe('1.600');
    expect(formatarValor(['a', 'b']).texto).toBe('a, b');
    expect(formatarValor({ a: 1, b: null }).texto).toBe('a: 1; b: —');
    expect(formatarValor({ a: { b: 1 } }).texto).toBe('{"a":{"b":1}}');
    expect(formatarValor('RODIZIO')).toEqual({
      texto: 'Rodízio da área',
      vazio: false,
      original: 'RODIZIO',
    });
    expect(formatarValor('NAO_CONHECIDO').texto).toBe('NAO_CONHECIDO');
    const id = '7c0a1b2c-3d4e-4f50-8a61-9b72c3d4e5f6';
    expect(formatarValor(id)).toEqual({ texto: id, vazio: false, id: true });
    expect(formatarValor(id, new Map([[id, 'Tatiane']]))).toEqual({
      texto: 'Tatiane',
      vazio: false,
      original: id,
    });
    expect(formatarValor('2026-10-21T21:10:51.380Z').texto).toMatch(
      /^\d{2}\/10\/2026 às \d{2}:\d{2}$/,
    );
  });

  it('nomes que o próprio evento registrou ({ id, nome }), em qualquer nível', () => {
    const nomes = nomesDosDados({
      de: { id: 'A1', nome: 'Qualificação' },
      lista: [{ id: 'b2', nome: 'Proposta' }],
      outro: { id: 'c3' },
    });
    expect(nomes.get('a1')).toBe('Qualificação');
    expect(nomes.get('b2')).toBe('Proposta');
    expect(nomes.has('c3')).toBe(false);
  });

  it('período do dia local, com o fim exclusivo', () => {
    expect(inicioDoDia('2026-10-20')).toBe(new Date(2026, 9, 20).toISOString());
    expect(fimDoDia('2026-10-20')).toBe(new Date(2026, 9, 21).toISOString());
    expect(inicioDoDia(null)).toBeNull();
    expect(problemaDoPeriodo('2026-10-20', '2026-10-19')).toContain('data final');
    expect(problemaDoPeriodo('2026-10-20', '2026-10-20')).toBeNull();
  });
});

describe('Administracao (moldura)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  function abas(): string[] {
    const fixture = TestBed.createComponent(Administracao);
    fixture.detectChanges();
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav a')).map(
      (link) => link.textContent?.trim() ?? '',
    );
  }

  it('Admin vê auditoria, logs técnicos, dúvidas à IA e saúde do sistema', () => {
    entrarComo('ADMIN');
    expect(abas()).toEqual(['Auditoria', 'Logs técnicos', 'Dúvidas à IA', 'Saúde do sistema']);
  });

  it('C-level não vê os logs técnicos nem as dúvidas à IA (só o Admin)', () => {
    entrarComo('C_LEVEL');
    expect(abas()).toEqual(['Auditoria']);
  });

  it('a frase só fala da saúde do sistema para quem vê essa aba', () => {
    const frase = () => {
      const fixture = TestBed.createComponent(Administracao);
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).querySelector('.moldura__frase')?.textContent;
    };
    entrarComo('ADMIN');
    expect(frase()).toContain('saúde do sistema');
    entrarComo('C_LEVEL');
    expect(frase()).toBe('Quem fez o quê no CRM, para conferir e investigar.');
  });
});
