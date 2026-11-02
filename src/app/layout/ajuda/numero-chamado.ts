const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Número do chamado para a tela: o TicketHub devolve um UUID, longo demais para um selo ou uma
 * frase, então aparecem os 8 primeiros caracteres em maiúsculas. Números curtos (de outro
 * destino) ficam como vieram. O completo continua no `title` e na cópia.
 */
export function numeroCurtoDoChamado(numero: string | number | null | undefined): string {
  const texto = String(numero ?? '').trim();
  return UUID.test(texto) ? texto.slice(0, 8).toUpperCase() : texto;
}
