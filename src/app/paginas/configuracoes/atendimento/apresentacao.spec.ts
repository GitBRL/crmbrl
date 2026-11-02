import {
  aplicarExemplos,
  formatarMinutos,
  horarioComercial,
  juntarMinutos,
  normalizarAtalho,
  partirMinutos,
  problemasDoDia,
  resumoDoHorario,
  situacaoDoHorario,
  variaveisDesconhecidas,
  variaveisDoTexto,
  FORMATO_DO_ATALHO,
} from './apresentacao';

const VARIAVEIS = [
  { nome: 'contato.primeiroNome', descricao: 'Primeiro nome do contato', exemplo: 'Maria' },
  { nome: 'usuario.primeiroNome', descricao: 'Primeiro nome de quem atende', exemplo: 'Ana' },
  { nome: 'saudacao', descricao: 'Bom dia/Boa tarde', exemplo: 'Boa tarde' },
];

describe('apresentação do Atendimento', () => {
  it('SLA: minutos em texto e de volta', () => {
    expect(formatarMinutos(null)).toBe('Sem prazo');
    expect(formatarMinutos(15)).toBe('15 min');
    expect(formatarMinutos(60)).toBe('1 h');
    expect(formatarMinutos(90)).toBe('1 h 30 min');
    expect(formatarMinutos(1440)).toBe('1 dia');
    expect(formatarMinutos(2 * 1440 + 240)).toBe('2 dias e 4 h');
    expect(partirMinutos(15)).toEqual({ valor: 15, unidade: 'minutos' });
    expect(partirMinutos(120)).toEqual({ valor: 2, unidade: 'horas' });
    expect(partirMinutos(2880)).toEqual({ valor: 2, unidade: 'dias' });
    expect(partirMinutos(90)).toEqual({ valor: 90, unidade: 'minutos' });
    expect(juntarMinutos(3, 'horas')).toBe(180);
    expect(juntarMinutos(1, 'dias')).toBe(1440);
  });

  it('resume o horário juntando dias seguidos iguais', () => {
    expect(resumoDoHorario(null)).toBe('24 horas, todos os dias');
    expect(resumoDoHorario(horarioComercial())).toBe('Seg a Sex, 08:00–18:00');
    expect(
      resumoDoHorario({
        fusoHorario: 'America/Sao_Paulo',
        dias: {
          '1': [
            { inicio: '08:00', fim: '12:00' },
            { inicio: '13:00', fim: '18:00' },
          ],
          '2': [
            { inicio: '08:00', fim: '12:00' },
            { inicio: '13:00', fim: '18:00' },
          ],
          '6': [{ inicio: '09:00', fim: '13:00' }],
          '0': [{ inicio: '10:00', fim: '14:00' }],
        },
      }),
    ).toBe('Seg e Ter, 08:00–12:00, 13:00–18:00 · Sáb, 09:00–13:00 · Dom, 10:00–14:00');
    expect(resumoDoHorario({ fusoHorario: 'America/Sao_Paulo', dias: {} })).toBe(
      'Fechado todos os dias',
    );
  });

  it('situação agora (aberto, fechado, 24 h)', () => {
    const agora = new Date('2026-10-26T12:00:00');
    expect(
      situacaoDoHorario({ aberto: true, proximaAbertura: null, proximoFechamento: null }, false),
    ).toBe('Sempre aberto');
    expect(
      situacaoDoHorario(
        {
          aberto: true,
          proximaAbertura: null,
          proximoFechamento: new Date('2026-10-26T18:00:00').toISOString(),
        },
        true,
        agora,
      ),
    ).toBe('Aberto agora · fecha às 18:00');
    expect(
      situacaoDoHorario(
        {
          aberto: false,
          proximaAbertura: new Date('2026-10-27T08:00:00').toISOString(),
          proximoFechamento: null,
        },
        true,
        agora,
      ),
    ).toBe('Fechado agora · abre amanhã às 08:00');
  });

  it('confere os intervalos de um dia como a API', () => {
    expect(problemasDoDia([{ inicio: '08:00', fim: '18:00' }])).toBeNull();
    expect(problemasDoDia([{ inicio: '22:00', fim: '24:00' }])).toBeNull();
    expect(problemasDoDia([{ inicio: '18:00', fim: '08:00' }])).toMatch(/precisa ser depois/);
    expect(
      problemasDoDia([
        { inicio: '08:00', fim: '12:00' },
        { inicio: '11:00', fim: '14:00' },
      ]),
    ).toBe('Há intervalos que se sobrepõem.');
    expect(problemasDoDia([{ inicio: '', fim: '12:00' }])).toMatch(/Preencha/);
  });

  it('atalho e variáveis das respostas rápidas', () => {
    expect(normalizarAtalho('  /Boas-Vindas ')).toBe('boas-vindas');
    expect(FORMATO_DO_ATALHO.test('boas-vindas')).toBe(true);
    expect(FORMATO_DO_ATALHO.test('boas vindas')).toBe(false);
    expect(FORMATO_DO_ATALHO.test('a/b')).toBe(false);
    const texto =
      '{{saudacao}}, {{ contato.primeiroNome }}! Sou {{usuario.primeiroNome}}. {{contato.cpf}}';
    expect(variaveisDoTexto(texto)).toEqual([
      'saudacao',
      'contato.primeiroNome',
      'usuario.primeiroNome',
      'contato.cpf',
    ]);
    expect(variaveisDesconhecidas(texto, VARIAVEIS)).toEqual(['contato.cpf']);
    expect(aplicarExemplos(texto, VARIAVEIS)).toBe('Boa tarde, Maria! Sou Ana. {{contato.cpf}}');
  });
});
