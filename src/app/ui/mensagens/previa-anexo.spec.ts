import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { AnexoMensagem } from './mensagens';
import { PreviaAnexo } from './previa-anexo';

@Component({
  imports: [PreviaAnexo],
  template: `<app-previa-anexo [anexo]="anexo()" [rotulo]="rotulo()" />`,
})
class Hospedeiro {
  readonly anexo = signal<AnexoMensagem>({
    nome: 'proposta.pdf',
    mime: 'application/pdf',
    url: '/api/v1/arquivos/1',
    tamanho: 1_284_000,
  });
  readonly rotulo = signal<string | null>(null);
}

describe('PreviaAnexo', () => {
  async function criar(anexo?: Partial<AnexoMensagem>, rotulo: string | null = null) {
    const fixture = TestBed.createComponent(Hospedeiro);
    if (anexo) {
      fixture.componentInstance.anexo.update((atual) => ({ ...atual, ...anexo }));
    }
    fixture.componentInstance.rotulo.set(rotulo);
    await fixture.whenStable();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  it('documento: nome, "PDF · 1,2 MB" e baixar pela API', async () => {
    const { raiz } = await criar();
    expect(raiz.querySelector('.previa__nome')?.textContent).toBe('proposta.pdf');
    expect(raiz.querySelector('.previa__detalhe')?.textContent).toBe('PDF · 1,2 MB');
    const baixar = raiz.querySelector<HTMLAnchorElement>('a[download]')!;
    expect(baixar.getAttribute('href')).toBe('/api/v1/arquivos/1');
    expect(baixar.getAttribute('aria-label')).toBe('Baixar proposta.pdf');
    expect(baixar.getAttribute('rel')).toBe('noopener');
  });

  it('arquivo sem extensão nem tamanho: "Arquivo"', async () => {
    const { raiz } = await criar({ nome: 'LEIAME', mime: 'text/plain', tamanho: null });
    expect(raiz.querySelector('.previa__detalhe')?.textContent).toBe('Arquivo');
  });

  it('imagem: miniatura com espaço reservado, que amplia num modal com "Baixar"', async () => {
    const { fixture, raiz } = await criar(
      {
        nome: 'fachada.png',
        mime: 'image/png',
        url: '/api/v1/arquivos/2',
        largura: 640,
        altura: 420,
      },
      'Imagem de Maria',
    );
    const botao = raiz.querySelector<HTMLButtonElement>('button.previa__imagem')!;
    expect(botao.getAttribute('aria-label')).toBe('Ampliar a imagem fachada.png');
    expect(botao.style.aspectRatio).toBe('640 / 420');
    const img = botao.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('Imagem de Maria');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('width')).toBe('640');

    botao.click();
    await fixture.whenStable();
    const modal = raiz.querySelector('app-modal dialog')!;
    expect(modal.hasAttribute('open')).toBe(true);
    expect(modal.querySelector('.previa__ampliada')?.getAttribute('src')).toBe(
      '/api/v1/arquivos/2',
    );
    expect(modal.querySelector('a[download]')?.textContent?.trim()).toBe('Baixar');
  });

  it('imagem que não abre vira o cartão de documento', async () => {
    const { fixture, raiz } = await criar({ nome: 'quebrada.jpg', mime: 'image/jpeg' });
    raiz.querySelector('img')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(raiz.querySelector('img')).toBeNull();
    expect(raiz.querySelector('.previa__nome')?.textContent).toBe('quebrada.jpg');
  });

  it('vídeo nativo com controles; áudio no player próprio', async () => {
    const video = await criar({ nome: 'clipe.mp4', mime: 'video/mp4', url: '/v' });
    const elemento = video.raiz.querySelector('video')!;
    expect(elemento.hasAttribute('controls')).toBe(true);
    expect(elemento.getAttribute('aria-label')).toBe('clipe.mp4');

    const audio = await criar(
      { nome: 'voz.ogg', mime: 'audio/ogg', url: '/a', duracao: 45 },
      'Áudio de Maria',
    );
    const player = audio.raiz.querySelector('app-player-audio')!;
    expect(player.querySelector('audio')?.getAttribute('src')).toBe('/a');
    expect(player.querySelector('.player__tempo')?.textContent?.trim()).toBe('0:45');
    expect(player.querySelector('button')?.getAttribute('aria-label')).toBe('Tocar áudio de Maria');
  });
});
