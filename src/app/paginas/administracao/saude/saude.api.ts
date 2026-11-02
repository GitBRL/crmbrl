import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { urlApi } from '../../../nucleo/api/api';
import type { SaudeDoSistema } from './saude.tipos';

@Injectable({ providedIn: 'root' })
export class SaudeApi {
  private readonly http = inject(HttpClient);

  consultar(): Promise<SaudeDoSistema> {
    return firstValueFrom(
      this.http.get<SaudeDoSistema>(urlApi('administracao', 'saude-do-sistema')),
    );
  }
}
