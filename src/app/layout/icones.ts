import type { Provider } from '@angular/core';
import { provideLucideConfig } from '@lucide/angular';

/**
 * Padrão dos ícones (DESIGN-SYSTEM.md §4): traço 1.75 e 20px. Vai nos `providers` das duas
 * cascas (`Casca` e `CascaAcesso`), que envolvem todas as telas, e não no `app.config.ts`:
 * assim o pacote de ícones fica fora do carregamento inicial e chega junto com a casca.
 */
export function provideIcones(): Provider {
  return provideLucideConfig({ strokeWidth: 1.75, size: 20 });
}
