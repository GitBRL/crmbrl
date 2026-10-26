import {
  LucideCamera,
  LucideGlobe,
  LucideMail,
  LucideMessageCircle,
  LucideMessagesSquare,
} from '@lucide/angular';

import type { TipoCanal } from './canais.modelos';

/**
 * Ícone de cada tipo de canal. O Lucide não tem as marcas (WhatsApp, Instagram, Facebook):
 * balão para o WhatsApp, globo para o chat do site, envelope para o e-mail, câmera para o
 * Instagram e balões para o Messenger — sempre com o nome do canal ao lado.
 */
export const ICONE_DO_CANAL = {
  WHATSAPP: LucideMessageCircle,
  WEBCHAT: LucideGlobe,
  EMAIL: LucideMail,
  INSTAGRAM: LucideCamera,
  MESSENGER: LucideMessagesSquare,
} as const satisfies Record<TipoCanal, unknown>;
