import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localePt from '@angular/common/locales/pt';
import {
  type ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  isDevMode,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
  withPreloading,
  withRouterConfig,
} from '@angular/router';

import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { interceptarErros } from './nucleo/api/interceptor-erros';
import { PreloadDoQueAcessa } from './nucleo/preload';
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
      // Os parâmetros das rotas pai chegam às filhas (`:area` no detalhe do negócio).
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      // As páginas dos módulos que o papel acessa vêm em segundo plano depois de entrar.
      withPreloading(PreloadDoQueAcessa),
      // Página que não chegou (aba aberta antes de um deploy): recarrega no destino, uma vez.
      withNavigationErrorHandler((erro) => {
        recarregarSeFalhouCarregamento(erro);
      }),
    ),
    provideLimpezaDaRecarga(),
    // Falhas de /api/v1 viram ErroApi; 401 leva a /entrar e a troca pendente a /trocar-senha.
    provideHttpClient(withFetch(), withInterceptors([interceptarErros])),
    // Service worker (só no build de produção): app shell em cache; /api e o socket nunca (ngsw-config.json).
    // `sw-crm.js` = ngsw-worker.js + o tratamento do push (public/sw-crm.js).
    provideServiceWorker('sw-crm.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
    { provide: TitleStrategy, useClass: TituloPagina },
    // Ícones (traço 1.75, 20px): nos providers das cascas (layout/icones.ts), para o pacote do
    // Lucide ficar fora do carregamento inicial.
  ],
};
