import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { alturasDaOnda, BARRAS_ONDA, PlayerAudio } from './player-audio';

@Component({
  imports: [PlayerAudio],
  template: `
    <app-player-audio class="um" src="/a.ogg" [duracao]="duracao()" rotulo="Áudio de Maria" />
    <app-player-audio class="dois" src="/b.ogg" [duracao]="10" />
  `,
})
class Hospedeiro {
  readonly duracao = signal<number | null>(45);
}

describe('PlayerAudio', () => {
  let tocar: ReturnType<typeof vi.spyOn>;
  let pausar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // O jsdom não toca mídia: play() e pause() viram espiões.
    tocar = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
    pausar = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      this.dispatchEvent(new Event('pause'));
    });
  });
  afterEach(() => vi.restoreAllMocks());

  async function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const player = (classe: string) =>
      raiz.querySelector(`app-player-audio.${classe}`) as HTMLElement;
    return { fixture, raiz, player };
  }

  it('onda determinística: mesmas alturas para o mesmo endereço, entre 0,2 e 1', () => {
    const a = alturasDaOnda('/api/v1/arquivos/1');
    expect(a).toHaveLength(BARRAS_ONDA);
    expect(alturasDaOnda('/api/v1/arquivos/1')).toEqual(a);
    expect(alturasDaOnda('/api/v1/arquivos/2')).not.toEqual(a);
    expect(Math.min(...a)).toBeGreaterThanOrEqual(0.2);
    expect(Math.max(...a)).toBeLessThanOrEqual(1);
  });

  it('parado mostra a duração; a posição é um controle deslizante com texto falado', async () => {
    const { player } = await criar();
    const um = player('um');
    expect(um.querySelector('.player__tempo')?.textContent?.trim()).toBe('0:45');
    expect(um.querySelectorAll('.player__barras i')).toHaveLength(BARRAS_ONDA);
    const posicao = um.querySelector<HTMLInputElement>('input[type=range]')!;
    expect(posicao.getAttribute('aria-label')).toBe('Posição do áudio de Maria');
    expect(posicao.getAttribute('aria-valuetext')).toBe('0 segundos de 45 segundos');
    expect(posicao.max).toBe('45');
    expect(posicao.disabled).toBe(false);
  });

  it('sem duração conhecida, a posição fica desabilitada até o arquivo carregar', async () => {
    const { fixture, player } = await criar();
    fixture.componentInstance.duracao.set(null);
    await fixture.whenStable();
    expect(player('um').querySelector<HTMLInputElement>('input[type=range]')?.disabled).toBe(true);
  });

  it('tocar/pausar troca o botão; tocar um pausa o outro', async () => {
    const { fixture, player } = await criar();
    const botaoUm = player('um').querySelector<HTMLButtonElement>('button')!;
    expect(botaoUm.getAttribute('aria-label')).toBe('Tocar áudio de Maria');
    botaoUm.click();
    await fixture.whenStable();
    expect(tocar).toHaveBeenCalledTimes(1);
    expect(botaoUm.getAttribute('aria-label')).toBe('Pausar áudio de Maria');

    player('dois').querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(pausar).toHaveBeenCalled();
    expect(botaoUm.getAttribute('aria-label')).toBe('Tocar áudio de Maria');
    expect(player('dois').querySelector('button')?.getAttribute('aria-label')).toBe('Pausar áudio');
  });

  it('a velocidade passa por 1×, 1,5× e 2× e vale para o elemento de áudio', async () => {
    const { fixture, player } = await criar();
    const velocidade = player('um').querySelector<HTMLButtonElement>('.player__velocidade')!;
    const audio = player('um').querySelector('audio')!;
    expect(velocidade.textContent?.trim()).toBe('1×');
    expect(velocidade.getAttribute('aria-label')).toBe('Velocidade: 1 vez. Mudar para 1,5 vezes');
    velocidade.click();
    await fixture.whenStable();
    expect(velocidade.textContent?.trim()).toBe('1,5×');
    expect(audio.playbackRate).toBe(1.5);
    velocidade.click();
    velocidade.click();
    await fixture.whenStable();
    expect(velocidade.textContent?.trim()).toBe('1×');
  });

  it('arrastar a posição leva o áudio até o ponto', async () => {
    const { fixture, player } = await criar();
    const posicao = player('um').querySelector<HTMLInputElement>('input[type=range]')!;
    posicao.value = '12';
    posicao.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(player('um').querySelector('audio')!.currentTime).toBe(12);
    expect(posicao.getAttribute('aria-valuetext')).toBe('12 segundos de 45 segundos');
    expect(player('um').querySelector('.player__tempo')?.textContent?.trim()).toBe('0:12');
    expect(player('um').querySelectorAll('.player__barras i.tocada').length).toBe(
      Math.round((12 / 45) * BARRAS_ONDA),
    );
  });

  it('arquivo que não abre: aviso e link para baixar', async () => {
    const { fixture, player } = await criar();
    player('um').querySelector('audio')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(player('um').querySelector('.player__erro')?.textContent).toContain(
      'Não foi possível tocar este áudio.',
    );
    expect(player('um').querySelector('.player__erro a')?.getAttribute('href')).toBe('/a.ogg');
    expect(player('um').querySelector('input[type=range]')).toBeNull();
  });
});
