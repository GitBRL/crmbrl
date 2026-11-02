import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { ConfigurarEtapas, textoEtapaComNegocios, validarRascunho } from './configurar-etapas';
import {
  colunasDeTeste,
  ETAPAS,
  FUNIL_ID,
  funilDeTeste,
  negocioDeTeste,
  quadroDeTeste,
} from './funis-de-teste';
import type { Funil } from './funis.tipos';

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('ConfigurarEtapas', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ConfigurarEtapas>;
  let raiz: HTMLElement;
  let alterados: Funil[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('LIDER_COMERCIAL');
    fixture = TestBed.createComponent(ConfigurarEtapas);
    fixture.componentRef.setInput('funil', funilDeTeste());
    alterados = [];
    fixture.componentInstance.alterado.subscribe((funil) => alterados.push(funil));
    fixture.componentRef.setInput('aberto', true);
    raiz = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    const contagens = http.expectOne((req) => req.url === `/api/v1/funis/${FUNIL_ID}/quadro`);
    expect(contagens.request.params.get('limitePorEtapa')).toBe('1');
    contagens.flush(
      quadroDeTeste(
        colunasDeTeste({ novo: [negocioDeTeste('a', ETAPAS[0]), negocioDeTeste('b', ETAPAS[0])] }),
      ),
    );
    await microtarefas();
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function linha(etapaId: string): HTMLElement {
    return raiz.querySelector<HTMLElement>(`[data-etapa="${etapaId}"]`)!;
  }

  function botao(dentro: HTMLElement, rotulo: string): HTMLButtonElement {
    return [...dentro.querySelectorAll<HTMLButtonElement>('button')].find((item) =>
      (item.getAttribute('aria-label') ?? item.textContent ?? '').includes(rotulo),
    )!;
  }

  it('lista as abertas em ordem e ganho e perda no fim', () => {
    const abertas = [...raiz.querySelectorAll('ol.etapas > li')].map((li) =>
      li.getAttribute('data-etapa'),
    );
    expect(abertas).toEqual(['novo', 'proposta']);
    const fechadas = [...raiz.querySelectorAll('ul.etapas > li')].map((li) =>
      li.getAttribute('data-etapa'),
    );
    expect(fechadas).toEqual(['ganho', 'perdido']);
  });

  it('etapa com negócios não sai: diz quantos e por quê (R5.2)', () => {
    const novo = linha('novo');
    expect(novo.textContent).toContain(
      'Tem 2 negócios: mova-os para outra etapa antes de remover.',
    );
    const remover = botao(novo, 'Remover a etapa Novo');
    expect(remover.getAttribute('aria-disabled')).toBe('true');
    remover.click();
    expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toContain('Tem 2 negócios');
    expect(linha('ganho').textContent).toContain('Todo funil tem exatamente uma etapa de ganho.');
  });

  it('a frase concorda com a quantidade de negócios', () => {
    expect(textoEtapaComNegocios(1)).toBe(
      'Tem 1 negócio: mova-o para outra etapa antes de remover.',
    );
    expect(textoEtapaComNegocios(3)).toBe(
      'Tem 3 negócios: mova-os para outra etapa antes de remover.',
    );
  });

  it('remove a etapa vazia depois da confirmação', async () => {
    const confirmacao = TestBed.inject(ConfirmacaoService);
    const pedido = vi.spyOn(confirmacao, 'confirmar').mockImplementation(async (dados) => {
      const executando = dados.executar!();
      http
        .expectOne(
          (req) =>
            req.method === 'DELETE' && req.url === `/api/v1/funis/${FUNIL_ID}/etapas/proposta`,
        )
        .flush(null);
      await executando;
      return true;
    });
    botao(linha('proposta'), 'Remover a etapa Proposta').click();
    await microtarefas();
    fixture.detectChanges();
    expect(pedido.mock.calls[0][0]).toMatchObject({
      titulo: 'Remover a etapa “Proposta”?',
      perigo: true,
    });
    expect(linha('proposta')).toBeNull();
    expect(alterados.at(-1)?.etapas.map((etapa) => etapa.id)).toEqual(['novo', 'ganho', 'perdido']);
  });

  it('muda a ordem pelos botões e manda todas as etapas, com ganho e perda no fim', async () => {
    botao(linha('novo'), 'Mover Novo para baixo').click();
    fixture.detectChanges();
    const pedido = http.expectOne(`/api/v1/funis/${FUNIL_ID}/etapas/reordenar`);
    expect(pedido.request.body).toEqual({ etapaIds: ['proposta', 'novo', 'ganho', 'perdido'] });
    const [novo, proposta, ganho, perdido] = ETAPAS;
    pedido.flush(
      funilDeTeste({
        etapas: [{ ...proposta, ordem: 1 }, { ...novo, ordem: 2 }, ganho, perdido],
      }),
    );
    await microtarefas();
    fixture.detectChanges();
    const abertas = [...raiz.querySelectorAll('ol.etapas > li')].map((li) =>
      li.getAttribute('data-etapa'),
    );
    expect(abertas).toEqual(['proposta', 'novo']);
    expect(alterados).toHaveLength(1);
  });

  it('enquanto salva a ordem, as setas seguem focáveis e um clique a mais é ignorado', async () => {
    botao(linha('novo'), 'Mover Novo para baixo').click();
    fixture.detectChanges();
    const pedido = http.expectOne(`/api/v1/funis/${FUNIL_ID}/etapas/reordenar`);
    // O foco volta ao botão da etapa movida: ele não pode estar desabilitado agora.
    const subir = botao(linha('novo'), 'Mover Novo para cima');
    expect(subir.disabled).toBe(false);
    subir.click();
    fixture.detectChanges();
    http.expectNone(`/api/v1/funis/${FUNIL_ID}/etapas/reordenar`);
    pedido.flush(funilDeTeste());
    await microtarefas();
  });

  it('renomeia e ajusta prazo e probabilidade, salvando só a linha', async () => {
    const nome = linha('proposta').querySelector<HTMLInputElement>('input')!;
    nome.value = 'Proposta enviada';
    nome.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    botao(linha('proposta'), 'Salvar').click();
    const pedido = http.expectOne((req) => req.method === 'PATCH');
    expect(pedido.request.url).toBe(`/api/v1/funis/${FUNIL_ID}/etapas/proposta`);
    expect(pedido.request.body).toEqual({
      nome: 'Proposta enviada',
      prazoDias: 7,
      probabilidade: 60,
    });
    pedido.flush({ ...ETAPAS[1], nome: 'Proposta enviada' });
    await microtarefas();
    expect(alterados.at(-1)?.etapas[1].nome).toBe('Proposta enviada');
  });

  it('adiciona uma etapa aberta (entra antes do ganho)', async () => {
    const nova = raiz.querySelector<HTMLFormElement>('form.nova')!;
    const [nome, prazo] = [...nova.querySelectorAll<HTMLInputElement>('input')];
    nome.value = 'Demonstração';
    nome.dispatchEvent(new Event('input'));
    prazo.value = '3';
    prazo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    nova.dispatchEvent(new Event('submit', { cancelable: true }));
    const pedido = http.expectOne(
      (req) => req.method === 'POST' && req.url === `/api/v1/funis/${FUNIL_ID}/etapas`,
    );
    expect(pedido.request.body).toEqual({
      nome: 'Demonstração',
      prazoDias: 3,
      probabilidade: null,
    });
    pedido.flush(funilDeTeste());
    await microtarefas();
    expect(alterados).toHaveLength(1);
  });

  it('valida nome, prazo e probabilidade como a API', () => {
    expect(validarRascunho({ nome: ' ', prazo: null, probabilidade: null }).nome).toBe(
      'Dê um nome à etapa.',
    );
    expect(validarRascunho({ nome: 'X', prazo: 2.5, probabilidade: null }).prazo).toContain(
      'inteiro',
    );
    expect(validarRascunho({ nome: 'X', prazo: 0, probabilidade: null }).prazo).toContain(
      'de 1 a 3.650',
    );
    expect(validarRascunho({ nome: 'X', prazo: 1, probabilidade: 150 }).probabilidade).toBe(
      'Use um número inteiro de 0 a 100.',
    );
    expect(validarRascunho({ nome: 'X'.repeat(101), prazo: null, probabilidade: null }).nome).toBe(
      'Use no máximo 100 caracteres.',
    );
    expect(validarRascunho({ nome: 'X', prazo: 1, probabilidade: 100 })).toEqual({
      nome: null,
      prazo: null,
      probabilidade: null,
    });
  });
});
