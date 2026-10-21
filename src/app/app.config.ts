import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import localePt from '@angular/common/locales/pt';
import {
  type ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
  withPreloading,
} from '@angular/router';
import { provideLucideConfig } from '@lucide/angular';

import { routes } from './app.routes';
import { provideLimpezaDaRecarga, recarregarSeFalhouCarregamento } from './nucleo/recarga';
import { TituloPagina } from './nucleo/titulo-pagina';

// Datas, números e moeda em pt-BR (DecimalPipe, CurrencyPipe, formatNumber…).
registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      // As páginas carregadas sob demanda vêm em segundo plano depois da primeira pintura.
      withPreloading(PreloadAllModules),
      // Página que não chegou (aba aberta antes de um deploy): recarrega no destino, uma vez.
      withNavigationErrorHandler((erro) => {
        recarregarSeFalhouCarregamento(erro);
      }),
    ),
    provideLimpezaDaRecarga(),
    provideHttpClient(withFetch()),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
    { provide: TitleStrategy, useClass: TituloPagina },
    // Ícones: traço 1.75 e 20px por padrão (DESIGN-SYSTEM.md §4).
    provideLucideConfig({ strokeWidth: 1.75, size: 20 }),
  ],
};
