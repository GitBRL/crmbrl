import { computed, Injectable, signal } from '@angular/core';

import { gravarArmazenado, lerArmazenado } from './armazenamento';
import { moduloPorId, moduloPorRota, MODULOS, type Modulo } from './navegacao';
import { ehPapel, ROTULO_PAPEL, type Papel } from './papeis';

export const CHAVE_PERFIL_DEMO = 'crmbrl.perfil-demo';

export interface PersonaDemo {
  readonly papel: Papel;
  readonly nome: string;
  readonly iniciais: string;
  /** Rótulo do papel ("Líder Comercial"). */
  readonly rotuloPapel: string;
}

function persona(papel: Papel, nome: string, iniciais: string): PersonaDemo {
  return { papel, nome, iniciais, rotuloPapel: ROTULO_PAPEL[papel] };
}

/** Uma pessoa fictícia por papel (contrato §6.2). */
export const PERSONAS_DEMO: readonly PersonaDemo[] = [
  persona('ADMIN', 'Ana Ribeiro', 'AR'),
  persona('C_LEVEL', 'Marcos Andrade', 'MA'),
  persona('LIDER_COMERCIAL', 'Carla Nogueira', 'CN'),
  persona('COMERCIAL', 'João Batista', 'JB'),
  persona('LIDER_MARKETING', 'Beatriz Lima', 'BL'),
  persona('MARKETING', 'Rafael Souto', 'RS'),
  persona('LIDER_CS', 'Fernanda Rocha', 'FR'),
  persona('CS', 'Lucas Prado', 'LP'),
];

/**
 * Modo demonstração: enquanto não há login, o usuário escolhe "ver como" uma persona e a
 * navegação filtra os módulos pelo papel dela. Padrão: Admin. A escolha fica em
 * `localStorage['crmbrl.perfil-demo']`.
 */
@Injectable({ providedIn: 'root' })
export class PerfilDemoService {
  readonly personas = PERSONAS_DEMO;

  private readonly papelAtual = signal<Papel>(this.lerPapelSalvo());

  readonly papel = this.papelAtual.asReadonly();
  readonly persona = computed(
    () => PERSONAS_DEMO.find((item) => item.papel === this.papel()) ?? PERSONAS_DEMO[0],
  );
  readonly rotuloPapel = computed(() => ROTULO_PAPEL[this.papel()]);
  readonly ehAdmin = computed(() => this.papel() === 'ADMIN');
  /** Módulos que a persona atual enxerga, na ordem do menu. */
  readonly modulosVisiveis = computed(() =>
    MODULOS.filter((modulo) => modulo.papeis.includes(this.papel())),
  );

  /**
   * A persona atual acessa o módulo? Aceita o módulo, o id ("disparos") ou a rota
   * ("/funis/cs"). Módulo desconhecido devolve `false`. Lê signals: é reativo em
   * templates e `computed`.
   */
  pode(modulo: Modulo | string): boolean {
    const alvo =
      typeof modulo === 'string' ? (moduloPorId(modulo) ?? moduloPorRota(modulo)) : modulo;
    return alvo ? alvo.papeis.includes(this.papel()) : false;
  }

  /** Troca a persona do modo demonstração ("Ver como"). */
  verComo(papel: Papel): void {
    this.papelAtual.set(papel);
    gravarArmazenado(CHAVE_PERFIL_DEMO, papel);
  }

  private lerPapelSalvo(): Papel {
    const salvo = lerArmazenado(CHAVE_PERFIL_DEMO);
    return ehPapel(salvo) ? salvo : 'ADMIN';
  }
}
