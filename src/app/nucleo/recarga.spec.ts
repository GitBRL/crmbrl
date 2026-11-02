import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationError, provideRouter, Router } from '@angular/router';

import {
  CHAVE_RECARGA,
  ehFalhaDeCarregamento,
  provideLimpezaDaRecarga,
  recarregarSeFalhouCarregamento,
} from './recarga';

@Component({ template: '' })
class Vazia {}

describe('recarga por falha de carregamento', () => {
  function janelaFalsa() {
    const sessao = new Map<string, string>();
    const assign = vi.fn();
    const janela = {
      location: { assign } as unknown as Location,
      sessionStorage: {
        getItem: (chave: string) => sessao.get(chave) ?? null,
        setItem: (chave: string, valor: string) => void sessao.set(chave, valor),
        removeItem: (chave: string) => void sessao.delete(chave),
      } as unknown as Storage,
    };
    return { janela, assign, sessao };
  }

  const falhaDeChunk = (url: string) =>
    new NavigationError(
      1,
      url,
      new TypeError('Failed to fetch dynamically imported module: /chunk-ABC.js'),
    );

  afterEach(() => sessionStorage.clear());

  it('reconhece as mensagens de chunk que não chegou (Chrome, Firefox e Safari)', () => {
    expect(
      ehFalhaDeCarregamento(new TypeError('Failed to fetch dynamically imported module')),
    ).toBe(true);
    expect(ehFalhaDeCarregamento(new TypeError('error loading dynamically imported module'))).toBe(
      true,
    );
    expect(ehFalhaDeCarregamento(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(ehFalhaDeCarregamento(new Error('Cannot match any routes'))).toBe(false);
    expect(ehFalhaDeCarregamento(null)).toBe(false);
  });

  it('recarrega no destino uma vez por URL e ignora outros erros', () => {
    const { janela, assign, sessao } = janelaFalsa();
    expect(recarregarSeFalhouCarregamento(falhaDeChunk('/disparos'), janela)).toBe(true);
    expect(assign).toHaveBeenCalledWith('/disparos');
    expect(sessao.get(CHAVE_RECARGA)).toBe('/disparos');

    // A mesma URL falhando de novo (deploy quebrado): não entra em laço.
    expect(recarregarSeFalhouCarregamento(falhaDeChunk('/disparos'), janela)).toBe(false);
    // Outra URL ainda pode recarregar uma vez.
    expect(recarregarSeFalhouCarregamento(falhaDeChunk('/bi'), janela)).toBe(true);
    expect(assign).toHaveBeenCalledTimes(2);

    const outroErro = new NavigationError(2, '/x', new Error('Cannot match any routes'));
    expect(recarregarSeFalhouCarregamento(outroErro, janela)).toBe(false);
    expect(assign).toHaveBeenCalledTimes(2);
  });

  it('sessionStorage bloqueado não quebra a recarga', () => {
    const { janela, assign } = janelaFalsa();
    janela.sessionStorage.getItem = () => {
      throw new Error('bloqueado');
    };
    janela.sessionStorage.setItem = () => {
      throw new Error('bloqueado');
    };
    expect(recarregarSeFalhouCarregamento(falhaDeChunk('/chat'), janela)).toBe(true);
    expect(assign).toHaveBeenCalledWith('/chat');
  });

  it('a próxima navegação que dá certo esquece a marca', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'inicio', component: Vazia }]), provideLimpezaDaRecarga()],
    });
    TestBed.inject(Router); // cria o roteador antes do inicializador acompanhar os eventos
    sessionStorage.setItem(CHAVE_RECARGA, '/inicio');
    await TestBed.inject(Router).navigateByUrl('/inicio');
    expect(sessionStorage.getItem(CHAVE_RECARGA)).toBeNull();
  });
});
