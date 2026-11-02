import { interpretarTitulo, normalizar, quandoReconhecido } from './interpretar-titulo';

// Quarta-feira, 21/10/2026, 14:30 (hora local).
const AGORA = new Date(2026, 9, 21, 14, 30);

const dia = (data: Date | null) =>
  data ? `${data.getDate()}/${data.getMonth() + 1}/${data.getFullYear()}` : null;

describe('normalizar', () => {
  it('tira acentos e maiúsculas sem mudar o comprimento', () => {
    const texto = 'Reunião AMANHÃ às 10h';
    expect(normalizar(texto)).toBe('reuniao amanha as 10h');
    expect(normalizar(texto).length).toBe(texto.length);
  });
});

describe('interpretarTitulo', () => {
  it('"Ligar para Maria amanhã às 10h": ligação, amanhã, 10:00 e o título sem a data', () => {
    const resultado = interpretarTitulo('Ligar para Maria amanhã às 10h', AGORA);
    expect(resultado.tipo).toBe('LIGACAO');
    expect(dia(resultado.dia)).toBe('22/10/2026');
    expect(resultado.hora).toEqual({ horas: 10, minutos: 0 });
    expect(resultado.titulo).toBe('Ligar para Maria');
  });

  it('reconhece o tipo pelo começo da frase', () => {
    expect(interpretarTitulo('Reunião com a diretoria', AGORA).tipo).toBe('REUNIAO');
    expect(interpretarTitulo('Marcar uma reunião de alinhamento', AGORA).tipo).toBe('REUNIAO');
    expect(interpretarTitulo('Enviar e-mail com a proposta', AGORA).tipo).toBe('EMAIL');
    expect(interpretarTitulo('email para o financeiro', AGORA).tipo).toBe('EMAIL');
    expect(interpretarTitulo('Mandar WhatsApp para a Ana', AGORA).tipo).toBe('WHATSAPP');
    expect(interpretarTitulo('Fazer uma ligação para o Bruno', AGORA).tipo).toBe('LIGACAO');
    expect(interpretarTitulo('Preparar a proposta', AGORA).tipo).toBeNull();
    // "ligar" no meio da frase não define o tipo.
    expect(interpretarTitulo('Pedir para o Bruno ligar', AGORA).tipo).toBeNull();
  });

  it('hoje, depois de amanhã e dias da semana (o próximo; hoje não conta)', () => {
    expect(dia(interpretarTitulo('Revisar contrato hoje', AGORA).dia)).toBe('21/10/2026');
    expect(dia(interpretarTitulo('Revisar depois de amanhã', AGORA).dia)).toBe('23/10/2026');
    const sexta = interpretarTitulo('Enviar proposta até sexta', AGORA);
    expect(dia(sexta.dia)).toBe('23/10/2026');
    expect(sexta.titulo).toBe('Enviar proposta');
    expect(dia(interpretarTitulo('Visita na segunda às 9h', AGORA).dia)).toBe('26/10/2026');
    // Numa quarta, "quarta" é a da semana que vem.
    expect(dia(interpretarTitulo('Retorno na quarta-feira', AGORA).dia)).toBe('28/10/2026');
    expect(dia(interpretarTitulo('Churrasco sábado', AGORA).dia)).toBe('24/10/2026');
  });

  it('"segunda via", "segunda reunião" não são datas', () => {
    expect(interpretarTitulo('Enviar a segunda via do boleto', AGORA).dia).toBeNull();
    expect(interpretarTitulo('Marcar a segunda reunião', AGORA).dia).toBeNull();
    // Sem preposição e sem "-feira", "segunda" seguida de outra palavra também não vira data.
    expect(interpretarTitulo('Revisar segunda proposta', AGORA).dia).toBeNull();
    expect(interpretarTitulo('Ler a terça parte do contrato', AGORA).dia).toBeNull();
    expect(interpretarTitulo('Visita à Quinta das Flores', AGORA).dia).toBeNull();
  });

  it('o dia da semana sozinho vale no fim da frase ou seguido de hora ou período', () => {
    const reuniao = interpretarTitulo('Reunião de alinhamento sexta às 9h', AGORA);
    expect(dia(reuniao.dia)).toBe('23/10/2026');
    expect(reuniao.hora).toEqual({ horas: 9, minutos: 0 });
    expect(reuniao.titulo).toBe('Reunião de alinhamento');
    const ligar = interpretarTitulo('Ligar para o Bruno segunda', AGORA);
    expect(dia(ligar.dia)).toBe('26/10/2026');
    expect(ligar.titulo).toBe('Ligar para o Bruno');
    expect(dia(interpretarTitulo('Retornar a Ana quinta, sem falta', AGORA).dia)).toBe(
      '22/10/2026',
    );
    expect(dia(interpretarTitulo('Visitar a escola terça de manhã', AGORA).dia)).toBe('27/10/2026');
    const queVem = interpretarTitulo('Enviar contrato quinta que vem', AGORA);
    expect(dia(queVem.dia)).toBe('22/10/2026');
    expect(queVem.titulo).toBe('Enviar contrato');
    // Um ordinal antes não esconde o dia que vem depois.
    expect(dia(interpretarTitulo('Revisar segunda proposta na sexta', AGORA).dia)).toBe(
      '23/10/2026',
    );
  });

  it('datas com barra e "dia 25"', () => {
    expect(dia(interpretarTitulo('Renovação 05/11', AGORA).dia)).toBe('5/11/2026');
    expect(dia(interpretarTitulo('Entrega em 10/01/2027', AGORA).dia)).toBe('10/1/2027');
    expect(dia(interpretarTitulo('Cobrar no dia 25', AGORA).dia)).toBe('25/10/2026');
    // Dia que já passou neste mês: o do mês que vem.
    expect(dia(interpretarTitulo('Cobrar dia 5', AGORA).dia)).toBe('5/11/2026');
    expect(interpretarTitulo('Prazo 31/02', AGORA).dia).toBeNull();
  });

  it('horas: "às 14", "10h30", "15:45", "meio-dia" e o título limpo', () => {
    expect(interpretarTitulo('Call às 14', AGORA).hora).toEqual({ horas: 14, minutos: 0 });
    expect(interpretarTitulo('Call 10h30', AGORA).hora).toEqual({ horas: 10, minutos: 30 });
    expect(interpretarTitulo('Call 15:45', AGORA).hora).toEqual({ horas: 15, minutos: 45 });
    expect(interpretarTitulo('Almoço ao meio-dia', AGORA).hora).toEqual({ horas: 12, minutos: 0 });
    const reuniao = interpretarTitulo('Reunião com a diretoria na segunda às 15h', AGORA);
    expect(reuniao.titulo).toBe('Reunião com a diretoria');
    // Uma duração ("2h de reunião") sem "às" não é hora.
    expect(interpretarTitulo('Separar 2h para estudar', AGORA).hora).toBeNull();
    expect(interpretarTitulo('às 25h', AGORA).hora).toBeNull();
  });

  it('sem data nem hora, o título fica como foi escrito', () => {
    const resultado = interpretarTitulo('  Preparar a apresentação ', AGORA);
    expect(resultado).toEqual({
      tipo: null,
      dia: null,
      hora: null,
      titulo: 'Preparar a apresentação',
    });
  });

  it('se só sobra a data, o título não fica vazio', () => {
    expect(interpretarTitulo('amanhã', AGORA).titulo).toBe('amanhã');
  });
});

describe('quandoReconhecido', () => {
  it('dia e hora → o valor do campo datetime-local', () => {
    const resultado = interpretarTitulo('Ligar amanhã às 9h', AGORA);
    expect(quandoReconhecido(resultado, AGORA)).toBe('2026-10-22T09:00');
  });

  it('só o dia → às 18:00 (ou 23:59 se hoje já passou das 18:00)', () => {
    expect(quandoReconhecido(interpretarTitulo('Ligar amanhã', AGORA), AGORA)).toBe(
      '2026-10-22T18:00',
    );
    const noite = new Date(2026, 9, 21, 19, 0);
    expect(quandoReconhecido(interpretarTitulo('Ligar hoje', noite), noite)).toBe(
      '2026-10-21T23:59',
    );
  });

  it('só a hora → hoje, ou amanhã se a hora já passou', () => {
    expect(quandoReconhecido(interpretarTitulo('Ligar às 16h', AGORA), AGORA)).toBe(
      '2026-10-21T16:00',
    );
    expect(quandoReconhecido(interpretarTitulo('Ligar às 9h', AGORA), AGORA)).toBe(
      '2026-10-22T09:00',
    );
  });

  it('nada reconhecido → null', () => {
    expect(quandoReconhecido(interpretarTitulo('Preparar proposta', AGORA), AGORA)).toBeNull();
  });
});
