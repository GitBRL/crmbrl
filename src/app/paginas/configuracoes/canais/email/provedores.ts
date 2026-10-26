import { PORTA_PADRAO_EMAIL, type SegurancaSmtp } from '../canais.modelos';

/** Provedores de e-mail com os servidores já conhecidos (atalho para quem não sabe os dados). */
export type Provedor = 'GMAIL' | 'MICROSOFT' | 'ZOHO' | 'OUTRO';

export interface DadosDoProvedor {
  readonly rotulo: string;
  readonly imap: { readonly host: string; readonly porta: number; readonly tls: boolean };
  readonly smtp: {
    readonly host: string;
    readonly porta: number;
    readonly seguranca: SegurancaSmtp;
  };
  /** O que é preciso fazer no provedor antes (senha de app, IMAP ligado…). */
  readonly dica: string;
}

export const PROVEDORES: Readonly<Record<Exclude<Provedor, 'OUTRO'>, DadosDoProvedor>> = {
  GMAIL: {
    rotulo: 'Gmail ou Google Workspace',
    imap: { host: 'imap.gmail.com', porta: 993, tls: true },
    smtp: { host: 'smtp.gmail.com', porta: 465, seguranca: 'TLS' },
    dica: 'No Google, a senha normal não funciona aqui: ative a verificação em duas etapas na conta e crie uma “senha de app” (Conta do Google → Segurança → Senhas de app). Use essa senha de 16 letras abaixo.',
  },
  MICROSOFT: {
    rotulo: 'Outlook ou Microsoft 365',
    imap: { host: 'outlook.office365.com', porta: 993, tls: true },
    smtp: { host: 'smtp.office365.com', porta: 587, seguranca: 'STARTTLS' },
    dica: 'No Microsoft 365, quem administra a conta precisa deixar o IMAP e o “SMTP autenticado” ligados para esta caixa. Com a verificação em duas etapas, use uma senha de app.',
  },
  ZOHO: {
    rotulo: 'Zoho Mail',
    imap: { host: 'imap.zoho.com', porta: 993, tls: true },
    smtp: { host: 'smtp.zoho.com', porta: 465, seguranca: 'TLS' },
    dica: 'No Zoho, ligue o acesso IMAP em Configurações → Contas de e-mail. Com a verificação em duas etapas, use uma senha específica de aplicativo.',
  },
};

export const DICA_OUTRO_PROVEDOR =
  'Os dados do servidor (endereço e porta de IMAP e SMTP) ficam no painel da sua hospedagem de e-mail ou com quem cuida dela. Na dúvida, procure por “configurar e-mail no Outlook” na ajuda do provedor: são os mesmos dados.';

/** Descobre o provedor pelos servidores gravados (para a tela abrir com a opção certa). */
export function provedorDoServidor(host: string | null | undefined): Provedor {
  const servidor = (host ?? '').toLowerCase();
  for (const [provedor, dados] of Object.entries(PROVEDORES) as [
    Exclude<Provedor, 'OUTRO'>,
    DadosDoProvedor,
  ][]) {
    if (servidor === dados.imap.host) {
      return provedor;
    }
  }
  return 'OUTRO';
}

/** Porta padrão do IMAP com ou sem TLS. */
export function portaImapPadrao(tls: boolean): number {
  return tls ? PORTA_PADRAO_EMAIL.imap.tls : PORTA_PADRAO_EMAIL.imap.aberta;
}

/** Porta padrão do SMTP para a segurança escolhida. */
export function portaSmtpPadrao(seguranca: SegurancaSmtp): number {
  return PORTA_PADRAO_EMAIL.smtp[seguranca];
}

/** Uma porta que ainda é a padrão de outra opção pode ser trocada sozinha. */
export function ehPortaPadraoImap(porta: number | null): boolean {
  return (
    porta === null ||
    porta === PORTA_PADRAO_EMAIL.imap.tls ||
    porta === PORTA_PADRAO_EMAIL.imap.aberta
  );
}

export function ehPortaPadraoSmtp(porta: number | null): boolean {
  return porta === null || Object.values(PORTA_PADRAO_EMAIL.smtp).includes(porta as 465 | 587 | 25);
}
