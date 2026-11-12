import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LigacaoService } from '../../nucleo/ligacoes/ligacao.service';
import { ligacaoServiceFalso } from '../ligacao/ligacoes-stub';
import { trescServiceFalso } from '../../nucleo/tresc-plus/tresc-plus-de-teste';
import {
  type LigacaoEmCursoTresc,
  TrescPlusService,
} from '../../nucleo/tresc-plus/tresc-plus.service';
import { BarraLigacaoTresc } from './barra-ligacao-tresc';

function ligacao(extra: Partial<LigacaoEmCursoTresc> = {}): LigacaoEmCursoTresc {
  return {
    id: 'l1',
    estado: 'CHAMANDO',
    direcao: 'FEITA',
    telefone: '5511999990001',
    nome: 'Maria Silva',
    contatoId: 'c1',
    negocioId: null,
    atendidaEm: null,
    duracaoSegundos: null,
    motivoTexto: null,
    iniciadaEm: Date.now(),
    ...extra,
  };
}

describe('BarraLigacaoTresc', () => {
  let falso: ReturnType<typeof trescServiceFalso>;

  function montar() {
    const fixture = TestBed.createComponent(BarraLigacaoTresc);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    falso = trescServiceFalso();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: TrescPlusService, useValue: falso },
        { provide: LigacaoService, useValue: ligacaoServiceFalso() },
      ],
    });
  });

  it('não aparece sem ligação', () => {
    expect(montar().nativeElement.querySelector('section')).toBeNull();
  });

  it('mostra "Entrando na campanha…" enquanto a API entra por você', () => {
    falso.entrando.set(true);
    const texto = montar().nativeElement.textContent as string;
    expect(texto).toContain('Entrando na campanha…');
  });

  it('chamando: nome com link, selo 3C+, estado e Desligar', () => {
    falso.ligacao.set(ligacao());
    const fixture = montar();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a')?.textContent).toContain('Maria Silva');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/contatos/c1');
    expect(el.textContent).toContain('3C+');
    expect(el.textContent).toContain('Chamando…');
    expect(el.querySelector('time')).toBeNull();
    const desligar = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Desligar'),
    ) as HTMLButtonElement;
    desligar.click();
    expect(falso.desligar).toHaveBeenCalled();
  });

  it('em ligação mostra o tempo com texto para o leitor de tela', () => {
    falso.ligacao.set(
      ligacao({ estado: 'EM_ANDAMENTO', atendidaEm: new Date(Date.now() - 65_000).toISOString() }),
    );
    const tempo = montar().nativeElement.querySelector('time') as HTMLElement;
    expect(tempo.textContent?.trim()).toMatch(/^1:0[5-9]$/);
    expect(tempo.getAttribute('aria-label')).toContain('1 minuto');
  });

  it('usa o telefone quando não há nome', () => {
    falso.ligacao.set(ligacao({ nome: null, contatoId: null }));
    const el = montar().nativeElement as HTMLElement;
    expect(el.querySelector('a')).toBeNull();
    expect(el.textContent).toContain('(11) 99999-0001');
  });

  it('terminada sem qualificação: mostra o motivo e não tem Desligar', () => {
    falso.ligacao.set(ligacao({ estado: 'FALHOU', motivoTexto: 'Número inválido.' }));
    const el = montar().nativeElement as HTMLElement;
    expect(el.textContent).toContain('Falhou: Número inválido.');
    expect(el.textContent).not.toContain('Desligar');
  });

  it('encerrada com qualificação pendente oferece Qualificar', () => {
    falso.ligacao.set(
      ligacao({ estado: 'ENCERRADA', atendidaEm: new Date().toISOString(), duracaoSegundos: 7 }),
    );
    falso.qualificacaoPendente.set({ ligacaoId: 'l1', campanhaId: 1 });
    const el = montar().nativeElement as HTMLElement;
    expect(el.textContent).toContain('Qualifique a ligação');
    const botao = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Qualificar'),
    ) as HTMLButtonElement;
    botao.click();
    expect(falso.pedirQualificacao).toHaveBeenCalledWith('l1', 1);
  });
});
