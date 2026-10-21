import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { NaoEncontrada } from './nao-encontrada';

describe('NaoEncontrada', () => {
  it('mostra o 404 com o endereço procurado e o caminho de volta', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: NaoEncontrada }])],
    });
    const harness = await RouterTestingHarness.create('/modulo/que-nao-existe');
    const raiz = harness.routeNativeElement as HTMLElement;

    const titulo = raiz.querySelector('h1') as HTMLElement;
    expect(titulo.textContent?.replace(/\s+/g, ' ').trim()).toBe('Página não encontrada · 404');
    expect(titulo.querySelector('.tom-fraco.sem-quebra')?.textContent).toBe('404');
    expect(raiz.querySelector('.nao-encontrada__caminho')?.textContent).toBe(
      '/modulo/que-nao-existe',
    );
    expect(raiz.querySelector('.capsulas')?.getAttribute('aria-hidden')).toBe('true');
    const voltar = raiz.querySelector('a[href="/inicio"]') as HTMLAnchorElement;
    expect(voltar.textContent?.trim()).toBe('Ir para a visão geral');
  });

  it('acompanha o endereço quando o componente é reaproveitado entre endereços inexistentes', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: NaoEncontrada }])],
    });
    const harness = await RouterTestingHarness.create('/nao-existe-1');
    const caminho = () =>
      (harness.routeNativeElement as HTMLElement).querySelector('.nao-encontrada__caminho')
        ?.textContent;
    expect(caminho()).toBe('/nao-existe-1');

    await harness.navigateByUrl('/nao-existe-2');
    await harness.fixture.whenStable();
    expect(caminho()).toBe('/nao-existe-2');
  });
});
