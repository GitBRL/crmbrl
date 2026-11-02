import { numeroCurtoDoChamado } from './numero-chamado';

describe('numeroCurtoDoChamado', () => {
  it('abrevia o UUID do TicketHub para os 8 primeiros caracteres', () => {
    expect(numeroCurtoDoChamado('3f2a9c1e-7b4d-4e8a-9c15-0d6f2b8a41c7')).toBe('3F2A9C1E');
  });

  it('mantém números curtos e trata vazio', () => {
    expect(numeroCurtoDoChamado('CH-1042')).toBe('CH-1042');
    expect(numeroCurtoDoChamado(null)).toBe('');
    expect(numeroCurtoDoChamado('  ')).toBe('');
  });
});
