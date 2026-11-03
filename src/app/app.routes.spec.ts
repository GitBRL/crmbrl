import type { Route, Routes } from '@angular/router';

import { acrescentarSecoes, routes } from './app.routes';
import { ROTAS_ATENDIMENTO } from './paginas/atendimento/atendimento.routes';
import { ROTAS_CHAT } from './paginas/chat/chat.routes';
import { ROTAS_CONFIG_ATENDIMENTO } from './paginas/configuracoes/atendimento/atendimento.routes';
import { ROTAS_CONFIG_CANAIS } from './paginas/configuracoes/canais/canais.routes';
import { ROTAS_CONFIGURACOES } from './paginas/configuracoes/configuracoes.routes';

/** As filhas da casca (a rota sem caminho que tem a Visão geral). */
function filhasDaCasca(): Routes {
  const casca = routes.find(
    (rota) => rota.path === '' && rota.children?.some((filha) => filha.path === 'inicio'),
  );
  return casca?.children ?? [];
}

const caminho = (rota: Route) => rota.path;

describe('app.routes (Onda A)', () => {
  it('a raiz sozinha é a primeira rota, antes das cascas de caminho vazio (sem sessão → /entrar)', () => {
    expect(routes[0].path).toBe('');
    expect(routes[0].pathMatch).toBe('full');
    expect(routes[0].canActivate).toHaveLength(1);
    expect(routes[0].loadComponent).toBeUndefined();
  });

  it('Atendimento e Chat da equipe são rotas da casca com título, carregadas sob demanda', () => {
    const filhas = filhasDaCasca();
    for (const [path, titulo] of [
      ['atendimento', 'Atendimento'],
      ['chat', 'Chat da equipe'],
    ]) {
      const rota = filhas.find((filha) => filha.path === path);
      expect(rota, path).toBeDefined();
      expect(rota?.title).toBe(titulo);
      expect(rota?.loadChildren).toBeTypeOf('function');
    }
  });

  it('as rotas das telas novas têm a página e a filha com o id (conversa, canal)', () => {
    // A aba Ligações (E4) vem antes; a caixa de entrada é a rota de caminho vazio.
    expect(ROTAS_ATENDIMENTO.map(caminho)).toEqual(['ligacoes', '']);
    expect(ROTAS_ATENDIMENTO[1].children?.map(caminho)).toEqual(['', ':conversaId']);
    expect(ROTAS_ATENDIMENTO[0].children?.map(caminho)).toEqual(['', ':ligacaoId']);
    expect(ROTAS_CHAT[0].children?.map(caminho)).toEqual(['', ':canalId']);
    expect(ROTAS_CONFIG_CANAIS.map(caminho)).toEqual(['canais']);
    expect(ROTAS_CONFIG_ATENDIMENTO.map(caminho)).toEqual(['atendimento']);
    expect(ROTAS_CONFIG_CANAIS[0].canActivate).toHaveLength(1);
    expect(ROTAS_CONFIG_ATENDIMENTO[0].canActivate).toHaveLength(1);
  });

  it('Canais e Atendimento entram como seções filhas da página de Configurações', () => {
    const mescladas = acrescentarSecoes(ROTAS_CONFIGURACOES, [
      ...ROTAS_CONFIG_CANAIS,
      ...ROTAS_CONFIG_ATENDIMENTO,
    ]);
    const pagina = mescladas[0];
    expect(pagina.loadComponent).toBe(ROTAS_CONFIGURACOES[0].loadComponent);
    const filhas = pagina.children?.map(caminho) ?? [];
    expect(filhas.slice(0, ROTAS_CONFIGURACOES[0].children?.length)).toEqual(
      ROTAS_CONFIGURACOES[0].children?.map(caminho),
    );
    expect(filhas.slice(-2)).toEqual(['canais', 'atendimento']);
    // O resto da lista (se houver) continua igual.
    expect(mescladas.slice(1)).toEqual(ROTAS_CONFIGURACOES.slice(1));
  });

  it('acrescentarSecoes não repete um caminho que a página já declare nem altera a original', () => {
    const base: Routes = [
      { path: '', children: [{ path: 'perfil' }, { path: 'canais', title: 'Antiga' }] },
    ];
    const mescladas = acrescentarSecoes(base, [
      { path: 'canais', title: 'Nova' },
      { path: 'atendimento' },
    ]);
    expect(mescladas[0].children).toEqual([
      { path: 'perfil' },
      { path: 'canais', title: 'Antiga' },
      { path: 'atendimento' },
    ]);
    expect(base[0].children).toHaveLength(2);
    expect(acrescentarSecoes([], [{ path: 'canais' }])).toEqual([{ path: 'canais' }]);
  });
});
