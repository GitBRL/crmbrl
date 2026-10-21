import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { DEFAULT_CURRENCY_CODE, LOCALE_ID } from '@angular/core';

// Provedores aplicados a todos os testes (angular.json → test.options.providersFile):
// o mesmo locale do app, para os números saírem em pt-BR ("1.600").
registerLocaleData(localePt);

export default [
  { provide: LOCALE_ID, useValue: 'pt-BR' },
  { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
];
