import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { RegistroDaLinhaDoTempo } from './contatos.tipos';
import { agruparPorDia, frasePorLigacao, LinhaDoTempo, rotuloDoDia } from './linha-do-tempo';

@Component({
  imports: [LinhaDoTempo],
  template: `<app-linha-do-tempo dono="contato" id="c1" [versao]="versao()" />`,
})
class Hospedeiro {
  readonly versao = signal(0);
}

function evento(id: string, ocorridoEm: string, resumo = `Evento ${id}`): RegistroDaLinhaDoTempo {
  return {
    tipo: 'evento',
    ocorridoEm,
    evento: {
      id,
      acao: 'contato.atualizado',
      entidade: 'contato',
      entidadeId: 'c1',
      resumo,
      dados: null,
      tipoAtor: 'USUARIO',
      usuarioId: 'u1',
      atorDescricao: 'Lucas Pereira',
      criadoEm: ocorridoEm,
    },
    atividade: null,
  };
}

function atividade(id: string, ocorridoEm: string, atrasada: boolean): RegistroDaLinhaDoTempo {
  return {
    tipo: 'atividade',
    ocorridoEm,
    evento: null,
    atividade: {
      id,
      tipo: 'LIGACAO',
      titulo: 'Ligar para Ana',
      descricao: null,
      status: 'PENDENTE',
      prioridade: 'MEDIA',
      atrasada,
      venceEm: ocorridoEm,
      inicioEm: null,
      fimEm: null,
      concluidaEm: null,
      canceladaEm: null,
      responsavel: { id: 'u1', nome: 'Lucas Pereira', papel: 'MEMBRO', ativo: true },
      criadoPor: null,
      contatoId: 'c1',
      empresaId: null,
      negocioId: null,
      criadoEm: ocorridoEm,
    },
  };
}

const esperar = () => new Promise((resolver) => setTimeout(resolver, 0));

describe('LinhaDoTempo', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Hospedeiro>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Hospedeiro);
  });

  afterEach(() => http.verify());

  it('rótulos de dia: hoje, ontem e a data por extenso', () => {
    const agora = new Date(2026, 9, 21, 15, 0);
    expect(rotuloDoDia(new Date(2026, 9, 21, 9, 0).toISOString(), agora)).toBe('Hoje');
    expect(rotuloDoDia(new Date(2026, 9, 20, 23, 0).toISOString(), agora)).toBe('Ontem');
    expect(rotuloDoDia(new Date(2026, 9, 2, 10, 0).toISOString(), agora)).toBe(
      '2 de outubro de 2026',
    );
    const dias = agruparPorDia(
      [
        evento('3', new Date(2026, 9, 21, 12).toISOString()),
        evento('2', new Date(2026, 9, 21, 8).toISOString()),
        evento('1', new Date(2026, 9, 19, 8).toISOString()),
      ],
      agora,
    );
    expect(dias.map((dia) => [dia.rotulo, dia.itens.length])).toEqual([
      ['Hoje', 2],
      ['19 de outubro de 2026', 1],
    ]);
  });

  it('carrega 20 por vez, "Carregar mais" junta a página seguinte e o filtro recomeça', async () => {
    fixture.detectChanges();
    await esperar();
    const primeira = http.expectOne((req) => req.url === '/api/v1/contatos/c1/linha-do-tempo');
    expect(primeira.request.params.get('pagina')).toBe('1');
    primeira.flush({
      itens: [evento('2', '2026-10-21T12:00:00Z'), atividade('a1', '2026-10-20T12:00:00Z', true)],
      total: 3,
      pagina: 1,
      porPagina: 20,
    });
    await esperar();
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).toContain('Evento 2');
    expect(raiz.textContent).toContain('Atrasada');
    expect(raiz.querySelector('.item__icone--atrasada')).not.toBeNull();
    expect(raiz.textContent).toContain('2 de 3');

    const mais = [...raiz.querySelectorAll('button')].find(
      (botao) => botao.textContent?.trim() === 'Carregar mais',
    ) as HTMLButtonElement;
    mais.click();
    await esperar();
    const segunda = http.expectOne((req) => req.params.get('pagina') === '2');
    segunda.flush({
      itens: [evento('1', '2026-10-01T12:00:00Z')],
      total: 3,
      pagina: 2,
      porPagina: 20,
    });
    await esperar();
    fixture.detectChanges();
    expect(raiz.querySelectorAll('.item').length).toBe(3);
    expect(
      [...raiz.querySelectorAll('button')].some((b) => b.textContent?.includes('Carregar mais')),
    ).toBe(false);

    const atividades = [...raiz.querySelectorAll('button')].find(
      (botao) => botao.textContent?.trim() === 'Atividades',
    ) as HTMLButtonElement;
    atividades.click();
    fixture.detectChanges();
    await esperar();
    const filtrada = http.expectOne((req) => req.params.get('incluir') === 'atividades');
    expect(filtrada.request.params.get('pagina')).toBe('1');
    filtrada.flush({ itens: [], total: 0, pagina: 1, porPagina: 20 });
    await esperar();
    fixture.detectChanges();
    expect(raiz.textContent).toContain('Nenhuma atividade ainda');
  });

  describe('ligações (Onda E)', () => {
    const ligacao = (extra: Record<string, unknown> = {}): RegistroDaLinhaDoTempo => ({
      tipo: 'ligacao',
      ocorridoEm: '2026-10-21T12:00:00Z',
      evento: null,
      atividade: null,
      ligacao: {
        id: 'lig-7',
        direcao: 'RECEBIDA',
        estado: 'ENCERRADA',
        resultado: 'atendida',
        motivoTexto: null,
        duracaoSegundos: 125,
        conversaId: 'conv-1',
        canalId: 'canal-1',
        canalNome: 'WhatsApp Oficial',
        atendente: { id: 'u1', nome: 'Lucas' },
        iniciadaEm: '2026-10-21T11:57:00Z',
        encerradaEm: '2026-10-21T12:00:00Z',
        resumoAssunto: 'Segunda via do boleto',
        resumoTrecho: 'Cliente pediu o boleto de novembro.',
        temGravacao: true,
        temTranscricao: true,
        ...extra,
      },
    });

    it('a frase diz direção, resultado e duração', () => {
      expect(frasePorLigacao(ligacao().ligacao!)).toBe('Ligação recebida · atendida, 2:05');
      expect(
        frasePorLigacao(
          ligacao({ direcao: 'FEITA', resultado: 'sem_resposta', duracaoSegundos: null }).ligacao!,
        ),
      ).toBe('Ligação feita · sem resposta');
    });

    it('mostra a ligação com resumo e abre o painel ali mesmo (player e transcrição)', async () => {
      fixture.detectChanges();
      await esperar();
      http
        .expectOne((req) => req.url === '/api/v1/contatos/c1/linha-do-tempo')
        .flush({ itens: [ligacao()], total: 1, pagina: 1, porPagina: 20 });
      await esperar();
      fixture.detectChanges();
      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.textContent).toContain('Ligação recebida · atendida, 2:05');
      expect(raiz.textContent).toContain('Segunda via do boleto');
      expect(raiz.textContent).toContain('Cliente pediu o boleto de novembro.');
      expect(raiz.textContent).toContain('Lucas');
      expect(raiz.querySelector('app-painel-ligacao')).toBeNull();
      const abrir = [...raiz.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Ouvir e ler a transcrição'),
      ) as HTMLButtonElement;
      expect(abrir.getAttribute('aria-expanded')).toBe('false');
      abrir.click();
      fixture.detectChanges();
      expect(abrir.getAttribute('aria-expanded')).toBe('true');
      expect(raiz.querySelector('app-painel-ligacao')).not.toBeNull();
      http.expectOne('/api/v1/ligacoes/lig-7').flush({});
      const link = raiz.querySelector<HTMLAnchorElement>('a[href="/atendimento/ligacoes/lig-7"]');
      expect(link?.textContent).toContain('Abrir a ligação');
    });

    it('ligação perdida sem gravação não oferece o player, só o motivo e o link', async () => {
      fixture.detectChanges();
      await esperar();
      http
        .expectOne((req) => req.url === '/api/v1/contatos/c1/linha-do-tempo')
        .flush({
          itens: [
            ligacao({
              resultado: 'perdida',
              estado: 'PERDIDA',
              duracaoSegundos: null,
              resumoAssunto: null,
              resumoTrecho: null,
              motivoTexto: 'Ninguém atendeu a tempo.',
              temGravacao: false,
              temTranscricao: false,
            }),
          ],
          total: 1,
          pagina: 1,
          porPagina: 20,
        });
      await esperar();
      fixture.detectChanges();
      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.textContent).toContain('Perdida');
      expect(raiz.textContent).toContain('Ninguém atendeu a tempo.');
      expect(raiz.textContent).not.toContain('Ouvir e ler');
      expect(raiz.querySelector('.item__icone--atrasada')).not.toBeNull();
    });

    it('o filtro "Ligações" pede incluir=ligacoes', async () => {
      fixture.detectChanges();
      await esperar();
      http
        .expectOne((req) => req.url === '/api/v1/contatos/c1/linha-do-tempo')
        .flush({ itens: [], total: 0, pagina: 1, porPagina: 20 });
      await esperar();
      fixture.detectChanges();
      const botao = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Ligações',
      ) as HTMLButtonElement;
      botao.click();
      fixture.detectChanges();
      await esperar();
      const pedido = http.expectOne((req) => req.url === '/api/v1/contatos/c1/linha-do-tempo');
      expect(pedido.request.params.get('incluir')).toBe('ligacoes');
      pedido.flush({ itens: [], total: 0, pagina: 1, porPagina: 20 });
    });
  });
});
