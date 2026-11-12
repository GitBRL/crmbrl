import { TestBed } from '@angular/core/testing';

import { TrescPlusApi } from '../../nucleo/tresc-plus/tresc-plus.api';
import { agenteDeTeste, trescServiceFalso } from '../../nucleo/tresc-plus/tresc-plus-de-teste';
import { TrescPlusService } from '../../nucleo/tresc-plus/tresc-plus.service';
import { PainelAgente } from './painel-agente';

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('PainelAgente', () => {
  let falso: ReturnType<typeof trescServiceFalso>;

  function montar() {
    const fixture = TestBed.createComponent(PainelAgente);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    falso = trescServiceFalso();
    falso.agente.set(agenteDeTeste());
    TestBed.configureTestingModule({
      providers: [
        { provide: TrescPlusService, useValue: falso },
        {
          provide: TrescPlusApi,
          useValue: {
            campanhasDoAgente: vi.fn(() =>
              Promise.resolve([
                { id: 1, nome: 'Prospecção Demo' },
                { id: 2, nome: 'Retomada Demo' },
              ]),
            ),
            pausas: vi.fn(() => Promise.resolve([{ id: 1, nome: 'Almoço', minutos: 60 }])),
          },
        },
      ],
    });
  });

  it('só aparece para quem está vinculado', () => {
    falso.vinculado.set(false);
    const fixture = montar();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('mostra o estado em texto e o nome acessível com a campanha', () => {
    const fixture = montar();
    const botao = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(botao.getAttribute('aria-label')).toBe('Agente 3C+: Manual, Prospecção Demo');
    expect(botao.getAttribute('data-estado')).toBe('manual');
    expect(botao.textContent).toContain('Manual');
    expect(botao.getAttribute('aria-expanded')).toBe('false');
  });

  it('abre o painel, confere o estado e deixa sair da campanha', async () => {
    const fixture = montar();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
    expect(falso.carregar).toHaveBeenCalledWith(true);
    const painel = fixture.nativeElement.querySelector('.agente__painel') as HTMLElement;
    expect(painel.textContent).toContain('Prospecção Demo');
    const sair = [...painel.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Sair da campanha'),
    ) as HTMLButtonElement;
    sair.click();
    expect(falso.sairDaCampanha).toHaveBeenCalled();
  });

  it('fora da campanha oferece entrar com a campanha padrão escolhida', async () => {
    falso.agente.set(agenteDeTeste({ estado: 'desconectado', campanha: null, modo: null }));
    const fixture = montar();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
    const entrar = [...fixture.nativeElement.querySelectorAll('.agente__painel button')].find((b) =>
      (b as HTMLElement).textContent?.includes('Entrar na campanha'),
    ) as HTMLButtonElement;
    entrar.click();
    expect(falso.entrarNaCampanha).toHaveBeenCalledWith(1, 'manual');
  });

  it('em pausa mostra a pausa e o botão de voltar', async () => {
    falso.agente.set(agenteDeTeste({ estado: 'pausa', pausa: { id: 1, nome: 'Almoço' } }));
    const fixture = montar();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
    const painel = fixture.nativeElement.querySelector('.agente__painel') as HTMLElement;
    expect(painel.textContent).toContain('Almoço');
    const voltar = [...painel.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Voltar da pausa'),
    ) as HTMLButtonElement;
    voltar.click();
    expect(falso.voltarDaPausa).toHaveBeenCalled();
  });

  it('no pós-atendimento oferece qualificar e bloqueia sair', async () => {
    falso.agente.set(agenteDeTeste({ estado: 'pos_atendimento' }));
    falso.qualificacaoPendente.set({ ligacaoId: 'l1', campanhaId: 1 });
    const fixture = montar();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
    const botoes = [
      ...fixture.nativeElement.querySelectorAll('.agente__painel button'),
    ] as HTMLButtonElement[];
    expect(botoes.find((b) => b.textContent?.includes('Sair da campanha'))?.disabled).toBe(true);
    botoes.find((b) => b.textContent?.includes('Qualificar a ligação'))?.click();
    expect(falso.pedirQualificacao).toHaveBeenCalledWith('l1', 1);
  });

  it('avisa quando a conexão ao vivo caiu', async () => {
    falso.reconectando.set(true);
    const fixture = montar();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reconectando…');
  });

  it('Esc fecha o painel', async () => {
    const fixture = montar();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.agente__painel')).not.toBeNull();
    fixture.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.agente__painel')).toBeNull();
  });
});
