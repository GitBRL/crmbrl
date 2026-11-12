import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { responderSetores } from '../../nucleo/setores/setores-de-teste';
import { botaoComTexto, erroDaApiFalso, microtarefas } from './dados-de-teste';
import { SetoresConfig } from './setores';
import { SECOES_CONFIGURACOES } from './secoes';
import { perfilDeTeste } from '../../nucleo/sessao/sessao-de-teste';

const POS_VENDA = {
  chave: 'POS_VENDA',
  nome: 'Pós-venda',
  descricao: 'Cuida de quem já comprou.',
  cor: 'coral',
  lideres: [{ id: 'u-diego', nome: 'Diego Martins' }],
  contagens: { usuariosAtivos: 2, funisAtivos: 1 },
};
const ANTIGO = {
  chave: 'ANTIGO',
  nome: 'Antigo',
  ativo: false,
  lideres: [],
  contagens: { usuariosAtivos: 0, funisAtivos: 0 },
};

describe('SetoresConfig (lista de setores)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<SetoresConfig>;

  const raiz = () => fixture.nativeElement as HTMLElement;

  async function abrir(papel: 'ADMIN' | 'LIDER_COMERCIAL' = 'ADMIN') {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    entrarComo(papel);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SetoresConfig);
    fixture.detectChanges();
    responderSetores(http, [POS_VENDA, ANTIGO]);
    await microtarefas();
    fixture.detectChanges();
  }
  afterEach(() => http.verify());

  it('mostra nome com a cor, descrição, líderes, contagens e o selo de base', async () => {
    await abrir();
    const cartoes = Array.from(raiz().querySelectorAll('.setor'));
    expect(cartoes).toHaveLength(4);
    const pos = cartoes.find((c) => c.textContent?.includes('Pós-venda'))!;
    expect(pos.querySelector('app-selo')!.className).toContain('coral');
    expect(pos.textContent).toContain('Cuida de quem já comprou.');
    expect(pos.textContent).toContain('Diego Martins');
    expect(pos.textContent).toContain('2 pessoas · 1 funil ativo');
    expect(pos.textContent).not.toContain('Base');
    const comercial = cartoes.find((c) => c.textContent?.includes('Comercial'))!;
    expect(comercial.textContent).toContain('Base');
    expect(comercial.textContent).not.toContain('Desativar');
    expect(pos.textContent).toContain('Desativar');
  });

  it('esconde os desativados até marcar "Mostrar desativados"', async () => {
    await abrir();
    expect(raiz().textContent).not.toContain('Antigo');
    raiz().querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    fixture.detectChanges();
    const antigo = Array.from(raiz().querySelectorAll('.setor')).find((c) =>
      c.textContent?.includes('Antigo'),
    )!;
    expect(antigo.textContent).toContain('Desativado');
    expect(antigo.textContent).toContain('Reativar');
  });

  it('o líder só vê o próprio setor, sem criar, editar nem desativar', async () => {
    await abrir('LIDER_COMERCIAL');
    expect(raiz().querySelectorAll('.setor')).toHaveLength(1);
    const lista = raiz().querySelector('.setores__lista')!.textContent;
    expect(lista).toContain('Comercial');
    expect(lista).toContain('Quem mais vê');
    expect(lista).not.toContain('Editar');
    expect(lista).not.toContain('Desativar');
    expect(raiz().querySelector('.secao__acao')).toBeNull();
    expect(raiz().querySelector('app-setores-formulario')).toBeNull();
  });

  it('o menu de Configurações oferece Setores a Admin, C-level e líderes, não a membros', () => {
    const secao = SECOES_CONFIGURACOES.find((s) => s.caminho === 'setores')!;
    const pode = (papel: Parameters<typeof perfilDeTeste>[0]) => {
      const perfil = perfilDeTeste(papel);
      return secao.permite(perfil.permissoes, perfil);
    };
    expect(pode('ADMIN')).toBe(true);
    expect(pode('C_LEVEL')).toBe(true);
    expect(pode('LIDER_COMERCIAL')).toBe(true);
    expect(pode('COMERCIAL')).toBe(false);
  });

  it('desativar pede confirmação e, recusado (R1.10), lista o que falta tirar com links', async () => {
    await abrir();
    const confirmar = vi.spyOn(TestBed.inject(ConfirmacaoService), 'confirmar');
    confirmar.mockResolvedValueOnce(false);
    const pos = () =>
      Array.from(raiz().querySelectorAll('.setor')).find((c) =>
        c.textContent?.includes('Pós-venda'),
      )!;
    botaoComTexto(pos() as HTMLElement, 'Desativar').click();
    await microtarefas();
    http.expectNone('/api/v1/setores/POS_VENDA/desativar');

    confirmar.mockResolvedValueOnce(true);
    botaoComTexto(pos() as HTMLElement, 'Desativar').click();
    await microtarefas();
    expect(confirmar.mock.calls[1][0].titulo).toContain('Pós-venda');
    const falha = erroDaApiFalso(409, 'conflito', 'O setor ainda tem o que tirar antes.', {
      regra: 'R1.10',
      usuarios: [
        { id: 'u-diego', nome: 'Diego Martins', papel: 'LIDER', rotuloPapel: 'Líder Pós-venda' },
      ],
      funis: [{ id: 'f-pos', nome: 'Pós-venda', base: true }],
      filas: [{ id: 'q-1', nome: 'Fila Pós-venda' }],
    });
    http.expectOne('/api/v1/setores/POS_VENDA/desativar').flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    const modal = raiz().querySelector('.bloqueio')!;
    expect(modal.textContent).toContain('Diego Martins');
    expect(modal.textContent).toContain('Líder Pós-venda');
    expect(modal.textContent).toContain('funil próprio do setor');
    expect(modal.textContent).toContain('Fila Pós-venda');
    const links = Array.from(modal.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toEqual([
      '/configuracoes/usuarios',
      '/configuracoes/funis/f-pos',
      '/configuracoes/funis/f-pos'.replace('funis/f-pos', 'atendimento'),
    ]);
  });

  it('desativar com sucesso recarrega a lista', async () => {
    await abrir();
    vi.spyOn(TestBed.inject(ConfirmacaoService), 'confirmar').mockResolvedValue(true);
    const pos = Array.from(raiz().querySelectorAll('.setor')).find((c) =>
      c.textContent?.includes('Pós-venda'),
    )!;
    botaoComTexto(pos as HTMLElement, 'Desativar').click();
    await microtarefas();
    http.expectOne('/api/v1/setores/POS_VENDA/desativar').flush({ ...POS_VENDA, ativo: false });
    await microtarefas();
    expect(responderSetores(http, [{ ...POS_VENDA, ativo: false }, ANTIGO])).toBe(1);
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).not.toContain('Pós-venda');
  });
});
