import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AvisosService } from '../../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../../nucleo/confirmacao.service';
import { type PapelDeTeste, entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import { funilDeTeste } from '../../funis/funis-de-teste';
import type { Funil } from '../../funis/funis.tipos';
import { botaoComTexto, digitar, erroDaApiFalso, microtarefas } from '../dados-de-teste';
import { ConfigurarFunilPagina, validarGeral } from './configurar-funil';

const FUNIL = funilDeTeste({
  id: 'f1',
  nome: 'Parcerias',
  base: false,
  nivel: 'CONFIGURAR',
  visibilidade: 'SETOR',
});

describe('ConfigurarFunilPagina', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ConfigurarFunilPagina>;

  async function abrir(funil: Funil = FUNIL, papel: PapelDeTeste = 'LIDER_COMERCIAL') {
    entrarComo(papel);
    fixture = TestBed.createComponent(ConfigurarFunilPagina);
    fixture.componentRef.setInput('id', 'f1');
    fixture.detectChanges();
    await microtarefas();
    http.expectOne('/api/v1/funis/f1').flush(funil);
    await microtarefas();
    fixture.detectChanges();
    // Acessos, setores e pessoas do editor.
    http
      .match(() => true)
      .forEach((pedido) => {
        if (pedido.request.url === '/api/v1/funis/f1/acessos') {
          pedido.flush({
            funilId: 'f1',
            nome: funil.nome,
            area: funil.area,
            nomeSetor: 'Comercial',
            visibilidade: funil.visibilidade ?? 'SETOR',
            acessos: [],
          });
        } else if (pedido.request.url === '/api/v1/usuarios/opcoes') {
          pedido.flush([]);
        } else if (pedido.request.url === '/api/v1/setores') {
          pedido.flush([]);
        }
      });
    await microtarefas();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.match(() => true);
    http.verify();
  });

  const raiz = () => fixture.nativeElement as HTMLElement;

  it('quem só vê ou age (sem nível CONFIGURAR) não configura', async () => {
    await abrir({ ...FUNIL, nivel: 'GESTOR' });
    expect(raiz().textContent).toContain('Você não configura este funil');
    expect(raiz().querySelector('app-editor-de-acessos-do-funil')).toBeNull();
  });

  it('mostra as seções Geral, Etapas, Visibilidade, Acessos e Zona de perigo', async () => {
    await abrir();
    const titulos = [...raiz().querySelectorAll('app-cartao h3')].map((h) => h.textContent?.trim());
    expect(titulos).toEqual(['Geral', 'Etapas', 'Visibilidade', 'Acessos', 'Zona de perigo']);
    expect(raiz().querySelectorAll('.etapa')).toHaveLength(4);
  });

  it('valida o nome e salva nome e descrição com PATCH', async () => {
    expect(validarGeral(' ', '').nome).toBe('Dê um nome ao funil.');
    await abrir();
    const salvar = botaoComTexto(raiz(), 'Salvar');
    expect(salvar.disabled).toBe(true);
    digitar(raiz(), 'Nome', 'Parcerias 2');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Salvar').click();
    const pedido = http.expectOne('/api/v1/funis/f1');
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).toEqual({ nome: 'Parcerias 2', descricao: null });
    pedido.flush({ ...FUNIL, nome: 'Parcerias 2' });
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('h2')?.textContent).toContain('Parcerias 2');
  });

  it('nome repetido (409) aparece no campo', async () => {
    await abrir();
    digitar(raiz(), 'Nome', 'Comercial');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Salvar').click();
    const { corpo, opcoes } = erroDaApiFalso(
      409,
      'conflito',
      'Já existe um funil chamado "Comercial" na área Comercial.',
    );
    http.expectOne('/api/v1/funis/f1').flush(corpo, opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Já existe um funil chamado');
  });

  it('muda a visibilidade para RESTRITA e explica o efeito', async () => {
    await abrir();
    const radio = [...raiz().querySelectorAll('label')].find((l) =>
      l.textContent?.includes('Só líderes e convidados'),
    )!;
    expect(radio.textContent).toContain('Os membros e as pessoas de outros setores só entram');
    radio.click();
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Salvar visibilidade').click();
    const pedido = http.expectOne('/api/v1/funis/f1');
    expect(pedido.request.body).toEqual({ visibilidade: 'RESTRITA' });
    pedido.flush({ ...FUNIL, visibilidade: 'RESTRITA' });
    await microtarefas();
    fixture.detectChanges();
    expect(botaoComTexto(raiz(), 'Salvar visibilidade').disabled).toBe(true);
  });

  it('funil-base não tem exclusão, só arquivo', async () => {
    await abrir({ ...FUNIL, base: true });
    expect(botaoComTexto(raiz(), 'Excluir').disabled).toBe(true);
    expect(raiz().textContent).toContain('não pode ser excluído, só arquivado');
  });

  it('arquivar pede confirmação e manda ativo:false', async () => {
    await abrir();
    const confirmacao = TestBed.inject(ConfirmacaoService);
    const confirmar = vi.spyOn(confirmacao, 'confirmar').mockImplementation(async (pedido) => {
      await pedido.executar?.();
      return true;
    });
    const sucesso = vi.spyOn(TestBed.inject(AvisosService), 'sucesso');
    botaoComTexto(raiz(), 'Arquivar').click();
    await microtarefas();
    const pedido = http.expectOne('/api/v1/funis/f1');
    expect(pedido.request.body).toEqual({ ativo: false });
    pedido.flush({ ...FUNIL, ativo: false });
    await microtarefas();
    fixture.detectChanges();
    expect(confirmar.mock.calls[0][0].titulo).toBe('Arquivar “Parcerias”?');
    expect(sucesso).toHaveBeenCalledWith('Funil “Parcerias” arquivado.');
    expect(raiz().textContent).toContain('Reativar o funil');
  });

  it('excluir confirma digitando o nome, usa DELETE e volta à lista; a recusa da API aparece no modal', async () => {
    await abrir();
    const ir = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const confirmar = vi
      .spyOn(TestBed.inject(ConfirmacaoService), 'confirmar')
      .mockImplementation(async (pedido) => {
        expect(pedido.exigirTexto).toBe('Parcerias');
        expect(pedido.perigo).toBe(true);
        await pedido.executar?.();
        return true;
      });
    botaoComTexto(raiz(), 'Excluir').click();
    await microtarefas();
    const pedido = http.expectOne('/api/v1/funis/f1');
    expect(pedido.request.method).toBe('DELETE');
    pedido.flush(null, { status: 204, statusText: 'No Content' });
    await microtarefas();
    expect(confirmar).toHaveBeenCalledOnce();
    expect(ir).toHaveBeenCalledWith(['/configuracoes/funis']);
  });
});
