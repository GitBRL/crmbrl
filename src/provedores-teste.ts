import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { DEFAULT_CURRENCY_CODE, LOCALE_ID } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';

import { FABRICA_SOCKET_INERTE } from './app/nucleo/tempo-real/tempo-real-de-teste';

// Provedores aplicados a todos os testes (angular.json → test.options.providersFile):
// o mesmo locale do app, para os números saírem em pt-BR ("1.600"), e o tempo real com
// sockets falsos que nunca conectam (nenhum teste abre conexão de verdade; quem precisa
// simular eventos usa `provideSocketFalso()`). O service worker fica desligado (SwUpdate e SwPush
// existem, com `isEnabled` falso).
registerLocaleData(localePt);

export default [
  { provide: LOCALE_ID, useValue: 'pt-BR' },
  { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
  FABRICA_SOCKET_INERTE,
  provideServiceWorker('ngsw-worker.js', { enabled: false }),
];
