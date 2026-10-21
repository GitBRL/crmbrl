import { TestBed } from '@angular/core/testing';

import { MODULOS } from './navegacao';
import { CHAVE_PERFIL_DEMO, PERSONAS_DEMO, PerfilDemoService } from './perfil-demo.service';
import { PAPEIS } from './papeis';

describe('PerfilDemoService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('tem uma persona por papel e começa como Admin', () => {
    expect(PERSONAS_DEMO.map((persona) => persona.papel)).toEqual([...PAPEIS]);
    const perfil = TestBed.inject(PerfilDemoService);
    expect(perfil.papel()).toBe('ADMIN');
    expect(perfil.ehAdmin()).toBe(true);
    expect(perfil.persona().rotuloPapel).toBe('Admin');
    expect(perfil.modulosVisiveis().length).toBe(MODULOS.length);
  });

  it('"Ver como" troca a persona, salva e filtra os módulos', () => {
    const perfil = TestBed.inject(PerfilDemoService);
    perfil.verComo('MARKETING');
    expect(localStorage.getItem(CHAVE_PERFIL_DEMO)).toBe('MARKETING');
    expect(perfil.ehAdmin()).toBe(false);
    expect(perfil.rotuloPapel()).toBe('Marketing');
    expect(perfil.pode('atendimento')).toBe(false);
    expect(perfil.pode('/funis/marketing')).toBe(true);
    expect(perfil.pode('/funis/comercial')).toBe(false);
    expect(perfil.pode('integracoes')).toBe(false);
    expect(perfil.pode('modulo-que-nao-existe')).toBe(false);
    const ids = perfil.modulosVisiveis().map((modulo) => modulo.id);
    expect(ids).toContain('inicio');
    expect(ids).not.toContain('atendimento');
  });

  it('lê a persona salva e ignora valor inválido', () => {
    localStorage.setItem(CHAVE_PERFIL_DEMO, 'LIDER_CS');
    expect(TestBed.inject(PerfilDemoService).papel()).toBe('LIDER_CS');
    TestBed.resetTestingModule();
    localStorage.setItem(CHAVE_PERFIL_DEMO, 'CHEFE');
    expect(TestBed.inject(PerfilDemoService).papel()).toBe('ADMIN');
  });
});
