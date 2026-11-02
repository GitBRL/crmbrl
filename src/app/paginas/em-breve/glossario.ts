/**
 * Glossário das siglas e termos que aparecem nas páginas "em breve" (DESIGN-SYSTEM.md §7: o
 * que não se explica sozinho ganha uma dica). Os textos dos módulos ficam em
 * `nucleo/navegacao.ts`, iguais aos do contrato; aqui ficam só as explicações.
 */
export interface TermoGlossario {
  /** Como o termo aparece nos textos ("UTM", "kanban"). */
  readonly termo: string;
  readonly explicacao: string;
}

export const GLOSSARIO: readonly TermoGlossario[] = [
  {
    termo: 'UTM',
    explicacao: 'Etiquetas no link do anúncio que dizem de qual campanha o lead veio.',
  },
  { termo: 'MQL', explicacao: 'Lead que o Marketing considera pronto para o Comercial.' },
  {
    termo: 'kanban',
    explicacao: 'Quadro com uma coluna por etapa: você arrasta o cartão do negócio.',
  },
  { termo: 'churn', explicacao: 'Clientes que cancelam.' },
  { termo: 'NPS', explicacao: 'Nota de 0 a 10 para a pergunta: você nos indicaria?' },
  { termo: 'CSAT', explicacao: 'Nota de satisfação com um atendimento.' },
  { termo: 'SLA', explicacao: 'Prazo máximo combinado para responder o cliente.' },
  {
    termo: 'MRR',
    explicacao: 'Receita recorrente mensal: quanto os contratos ativos faturam por mês.',
  },
  { termo: 'deduplicação', explicacao: 'Junta cadastros repetidos da mesma pessoa.' },
  { termo: 'gateway', explicacao: 'A conexão do próprio CRM com o WhatsApp.' },
  { termo: 'PWA', explicacao: 'App que se instala no celular direto do navegador.' },
  {
    termo: 'webhook',
    explicacao: 'Ligação automática que manda ou recebe dados de outro sistema.',
  },
];

/**
 * Palavra inteira, sem diferenciar maiúsculas e aceitando o plural com "s" ("Webhooks").
 * As bordas valem para letras acentuadas ("deduplicação"), o que o `\b` do JavaScript não faz.
 */
const PADROES = GLOSSARIO.map((item) => ({
  item,
  padrao: new RegExp(`(?<![\\p{L}\\p{N}])${item.termo}s?(?![\\p{L}\\p{N}])`, 'iu'),
}));

/** Os termos do glossário presentes num texto, na ordem do glossário. */
export function termosNoTexto(texto: string): readonly TermoGlossario[] {
  return PADROES.filter(({ padrao }) => padrao.test(texto)).map(({ item }) => item);
}
