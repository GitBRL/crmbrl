import type { ResolveFn, Routes } from '@angular/router';

import { MODULOS_BASE, moduloBasePorId, moduloBasePorRota } from './nucleo/modulos';
import {
  acessoAoModulo,
  apenasVisitante,
  ehAreaDeFunil,
  ehUuid,
  exigirSessao,
  exigirSessaoParaTrocarSenha,
  paraInicioOuEntrar,
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
 * - Cada módulo pronto tem as suas rotas no arquivo `*.routes.ts` da própria pasta
 *   (`paginas/<modulo>/`), com as guardas de cada seção. Os módulos "em breve" saem de
 *   `nucleo/modulos.ts` e levam o id em `data.modulo` (input `modulo` da página).
 * - Onda B: Disparos, Chatbot e Automações (esqueletos em `paginas/{disparos,chatbot,automacoes}`) e
 *   a importação (`/contatos/importar`).
 * - Onda A: Atendimento (`/atendimento`, `/atendimento/:conversaId`) e Chat da equipe
 *   (`/chat`, `/chat/:canalId`); em Configurações, as seções Canais (`/configuracoes/canais…`)
 *   e Atendimento (`/configuracoes/atendimento…`), que moram em subpastas próprias e entram
 *   como filhas da página de Configurações (`rotasDeConfiguracoes`).
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

/**
 * Configurações: as seções da Fase 1 (`paginas/configuracoes/configuracoes.routes.ts`) mais as
 * da Onda A, Canais e Atendimento (`configuracoes/canais/`, `configuracoes/atendimento/`), como
 * filhas da mesma página — o título, as seções em pílula e o `<router-outlet>` são os dela.
 */
const rotasDeConfiguracoes = (): Promise<Routes> =>
  Promise.all([
    import('./paginas/configuracoes/configuracoes.routes'),
    import('./paginas/configuracoes/canais/canais.routes'),
    import('./paginas/configuracoes/atendimento/atendimento.routes'),
    import('./paginas/configuracoes/sdr/sdr.routes'),
  ]).then(([base, canais, atendimento, sdr]) =>
    acrescentarSecoes(base.ROTAS_CONFIGURACOES, [
      ...canais.ROTAS_CONFIG_CANAIS,
      ...atendimento.ROTAS_CONFIG_ATENDIMENTO,
      ...sdr.ROTAS_CONFIG_SDR,
    ]),
  );

/**
 * Acrescenta seções às filhas da página de Configurações (a primeira rota da lista), sem
 * repetir um caminho que ela já declare.
 */
export function acrescentarSecoes(rotas: Routes, secoes: Routes): Routes {
  const [pagina, ...resto] = rotas;
  if (!pagina) {
    return secoes;
  }
  const filhas = pagina.children ?? [];
  const novas = secoes.filter((secao) => !filhas.some((filha) => filha.path === secao.path));
  return [{ ...pagina, children: [...filhas, ...novas] }, ...resto];
}

/** "Comercial", "Marketing", "Customer Success" pelo `:area` da URL. */
const tituloDoFunil: ResolveFn<string> = (rota) =>
  moduloBasePorRota(`/funis/${rota.paramMap.get('area') ?? ''}`)?.rotulo ?? 'Funis';

export const routes: Routes = [
  // A raiz sozinha: as duas cascas abaixo têm caminho vazio e a de acesso (sem filha vazia) a
  // engoliria, deixando a tela em branco.
  { path: '', pathMatch: 'full', canActivate: [paraInicioOuEntrar], children: [] },
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
        path: 'atendimento',
        title: titulo('atendimento'),
        loadChildren: () =>
          import('./paginas/atendimento/atendimento.routes').then((m) => m.ROTAS_ATENDIMENTO),
      },
      {
        path: 'bi',
        title: titulo('bi'),
        loadChildren: () => import('./paginas/bi/bi.routes').then((m) => m.ROTAS_BI),
      },
      {
        path: 'chat',
        title: titulo('chat'),
        loadChildren: () => import('./paginas/chat/chat.routes').then((m) => m.ROTAS_CHAT),
      },
      {
        path: 'disparos',
        title: titulo('disparos'),
        loadChildren: () =>
          import('./paginas/disparos/disparos.routes').then((m) => m.ROTAS_DISPAROS),
      },
      {
        path: 'chatbot',
        title: titulo('chatbot'),
        loadChildren: () => import('./paginas/chatbot/chatbot.routes').then((m) => m.ROTAS_CHATBOT),
      },
      {
        path: 'automacoes',
        title: titulo('automacoes'),
        loadChildren: () =>
          import('./paginas/automacoes/automacoes.routes').then((m) => m.ROTAS_AUTOMACOES),
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
        path: 'financeiro',
        title: titulo('financeiro'),
        loadChildren: () =>
          import('./paginas/financeiro/financeiro.routes').then((m) => m.ROTAS_FINANCEIRO),
      },
      {
        path: 'configuracoes',
        title: titulo('configuracoes'),
        loadChildren: rotasDeConfiguracoes,
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
