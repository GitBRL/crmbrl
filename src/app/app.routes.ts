import type { ResolveFn, Routes } from '@angular/router';

import { MODULOS_BASE, moduloBasePorId, moduloBasePorRota } from './nucleo/modulos';
import {
  acessoAoModulo,
  apenasVisitante,
  ehAreaDeFunil,
  ehUuid,
  exigirSessao,
  exigirSessaoParaTrocarSenha,
  paraPrimeiroFunil,
  redirecionarFunilPorId,
} from './nucleo/sessao/guardas';

/**
 * Rotas do CRM. Todas carregam sob demanda (`loadComponent`/`loadChildren`).
 *
 * - **Acesso** (fora da casca, em `layout/casca-acesso.ts`): `/entrar`, `/esqueci-senha`,
 *   `/redefinir-senha`, `/definir-senha` e `/trocar-senha`.
 * - **Casca** (`layout/casca.ts`): exige sessão e a troca de senha feita (`exigirSessao`) e
 *   confere, a cada página, o acesso ao módulo dono da URL (`acessoAoModulo`, pelo papel e
 *   pelas permissões do `auth/eu`; negado → `/sem-acesso?pagina=<rota>`).
 * - Cada módulo pronto da Fase 1 tem as suas rotas no arquivo `*.routes.ts` da própria pasta
 *   (`paginas/<modulo>/`), com as guardas de cada seção. Os módulos "em breve" saem de
 *   `nucleo/modulos.ts` e levam o id em `data.modulo` (input `modulo` da página).
 *
 * O `title` de cada rota vira "<título> · BRL CRM" (nucleo/titulo-pagina.ts).
 */

const paginaEmBreve = () => import('./paginas/em-breve/em-breve').then((m) => m.EmBreve);

const rotasEmBreve: Routes = MODULOS_BASE.filter((modulo) => modulo.status === 'em-breve').map(
  (modulo) => ({
    path: modulo.rota.slice(1),
    title: modulo.rotulo,
    data: { modulo: modulo.id },
    loadComponent: paginaEmBreve,
  }),
);

const titulo = (id: string) => moduloBasePorId(id)?.rotulo;

/** "Comercial", "Marketing", "Customer Success" pelo `:area` da URL. */
const tituloDoFunil: ResolveFn<string> = (rota) =>
  moduloBasePorRota(`/funis/${rota.paramMap.get('area') ?? ''}`)?.rotulo ?? 'Funis';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/casca-acesso').then((m) => m.CascaAcesso),
    children: [
      {
        path: 'entrar',
        title: 'Entrar',
        canActivate: [apenasVisitante],
        loadComponent: () => import('./paginas/acesso/entrar').then((m) => m.Entrar),
      },
      {
        path: 'esqueci-senha',
        title: 'Esqueci minha senha',
        canActivate: [apenasVisitante],
        loadComponent: () => import('./paginas/acesso/esqueci-senha').then((m) => m.EsqueciSenha),
      },
      {
        path: 'redefinir-senha',
        title: 'Redefinir senha',
        loadComponent: () =>
          import('./paginas/acesso/redefinir-senha').then((m) => m.RedefinirSenha),
      },
      {
        path: 'definir-senha',
        title: 'Definir senha',
        loadComponent: () => import('./paginas/acesso/definir-senha').then((m) => m.DefinirSenha),
      },
      {
        path: 'trocar-senha',
        title: 'Trocar senha',
        canActivate: [exigirSessaoParaTrocarSenha],
        loadComponent: () => import('./paginas/acesso/trocar-senha').then((m) => m.TrocarSenha),
      },
    ],
  },
  {
    path: '',
    canActivate: [exigirSessao],
    canActivateChild: [exigirSessao, acessoAoModulo],
    loadComponent: () => import('./layout/casca').then((m) => m.Casca),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: titulo('inicio'),
        loadComponent: () => import('./paginas/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'funis',
        children: [
          { path: '', pathMatch: 'full', canActivate: [paraPrimeiroFunil], children: [] },
          {
            path: ':area',
            canMatch: [ehAreaDeFunil],
            title: tituloDoFunil,
            loadChildren: () => import('./paginas/funis/funis.routes').then((m) => m.ROTAS_FUNIS),
          },
          // Links das notificações: /funis/<funilId>?negocio=<id> → /funis/<area>/<id>.
          {
            path: ':funilId',
            canMatch: [ehUuid],
            canActivate: [redirecionarFunilPorId],
            children: [],
          },
        ],
      },
      {
        path: 'contatos',
        title: titulo('contatos'),
        loadChildren: () =>
          import('./paginas/contatos/contatos.routes').then((m) => m.ROTAS_CONTATOS),
      },
      {
        path: 'empresas',
        title: 'Empresas',
        loadChildren: () =>
          import('./paginas/contatos/contatos.routes').then((m) => m.ROTAS_EMPRESAS),
      },
      {
        path: 'atividades',
        title: titulo('atividades'),
        loadChildren: () =>
          import('./paginas/atividades/atividades.routes').then((m) => m.ROTAS_ATIVIDADES),
      },
      {
        path: 'configuracoes',
        title: titulo('configuracoes'),
        loadChildren: () =>
          import('./paginas/configuracoes/configuracoes.routes').then((m) => m.ROTAS_CONFIGURACOES),
      },
      {
        path: 'integracoes',
        title: titulo('integracoes'),
        loadChildren: () =>
          import('./paginas/integracoes/integracoes.routes').then((m) => m.ROTAS_INTEGRACOES),
      },
      // A API grava este link na notificação "equipe sem líder"; os usuários ficam em
      // Configurações.
      { path: 'administracao/usuarios', redirectTo: '/configuracoes/usuarios' },
      {
        path: 'administracao',
        title: titulo('administracao'),
        loadChildren: () =>
          import('./paginas/administracao/administracao.routes').then((m) => m.ROTAS_ADMINISTRACAO),
      },
      {
        path: 'sem-acesso',
        title: 'Sem acesso',
        loadComponent: () => import('./layout/sem-acesso').then((m) => m.SemAcesso),
      },
      {
        path: 'design-system',
        title: titulo('design-system'),
        // Catálogo técnico e pesado: só abre sob demanda (nucleo/preload.ts).
        data: { preload: false },
        loadComponent: () =>
          import('./paginas/design-system/design-system').then((m) => m.DesignSystem),
      },
      ...rotasEmBreve,
      {
        path: '**',
        title: 'Página não encontrada',
        loadComponent: () =>
          import('./paginas/nao-encontrada/nao-encontrada').then((m) => m.NaoEncontrada),
      },
    ],
  },
];
