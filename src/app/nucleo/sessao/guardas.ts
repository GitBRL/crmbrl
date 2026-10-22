import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  type CanActivateChildFn,
  type CanActivateFn,
  type CanMatchFn,
  Router,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';

import { firstValueFrom } from 'rxjs';

import { urlApi } from '../api/api';
import { AvisosService } from '../avisos.service';
import { moduloBasePorRota } from '../modulos';
import type { Papel } from '../papeis';
import { type Area, areaDoSlug, type Perfil, type Permissoes, SLUG_AREA } from './perfil';
import { SessaoService, voltarSeguro } from './sessao.service';

/**
 * Guardas de rota (TELAS-FASE1 §2): sem sessão → `/entrar` guardando a rota; troca de senha
 * pendente → `/trocar-senha`; sem papel/permissão → página "sem acesso"
 * (`/sem-acesso?pagina=<rota>`). Todas leem o `SessaoService`; a API continua sendo a
 * autoridade.
 *
 * ```ts
 * { path: 'usuarios', canActivate: [exigirPermissao((p) => p.gerenciarUsuarios)], loadComponent: … }
 * { path: 'equipe', canActivate: [exigirPapel('C_LEVEL', ...LIDERES)], loadComponent: … }
 * ```
 */

/** `/entrar?voltar=<rota>` (sem o `voltar` quando a rota é o início). */
function paraEntrar(router: Router, url: string): UrlTree {
  const voltar = voltarSeguro(url);
  return router.createUrlTree(['/entrar'], {
    queryParams: voltar === '/inicio' ? {} : { voltar },
  });
}

/** A página "sem acesso", dizendo qual página foi negada. */
export function paraSemAcesso(router: Router, url: string): UrlTree {
  return router.createUrlTree(['/sem-acesso'], { queryParams: { pagina: url } });
}

/**
 * Casca (e filhas): exige sessão e a troca de senha feita. Pergunta ao `auth/eu` só na
 * primeira vez; depois usa o que o `SessaoService` já sabe.
 */
export const exigirSessao: CanActivateFn & CanActivateChildFn = async (
  _rota: ActivatedRouteSnapshot,
  estado: RouterStateSnapshot,
): Promise<boolean | UrlTree> => {
  const sessao = inject(SessaoService);
  const router = inject(Router);
  let perfil: Perfil | null;
  try {
    perfil = await sessao.carregar();
  } catch {
    // A API não respondeu: a tela de entrar mostra o problema quando a pessoa tentar.
    return paraEntrar(router, estado.url);
  }
  if (!perfil) {
    return paraEntrar(router, estado.url);
  }
  if (perfil.deveTrocarSenha) {
    const voltar = voltarSeguro(estado.url);
    return router.createUrlTree(['/trocar-senha'], {
      queryParams: voltar === '/inicio' ? {} : { voltar },
    });
  }
  return true;
};

/** `/trocar-senha`: exige sessão (com ou sem troca pendente). */
export const exigirSessaoParaTrocarSenha: CanActivateFn = async (_rota, estado) => {
  const sessao = inject(SessaoService);
  const router = inject(Router);
  try {
    return (await sessao.carregar()) ? true : paraEntrar(router, estado.url);
  } catch {
    return paraEntrar(router, estado.url);
  }
};

/**
 * Telas de quem ainda não entrou (`/entrar`, `/esqueci-senha`): com sessão, segue para onde
 * iria depois do login. Se a API não responder, mostra a tela.
 */
export const apenasVisitante: CanActivateFn = async (rota) => {
  const sessao = inject(SessaoService);
  try {
    return (await sessao.carregar())
      ? sessao.rotaAposEntrar(rota.queryParamMap.get('voltar'))
      : true;
  } catch {
    return true;
  }
};

/**
 * Filhas da casca: o módulo dono da URL (`nucleo/modulos.ts`, inclusive as rotas
 * relacionadas) precisa estar liberado para o papel e as permissões do usuário.
 */
export const acessoAoModulo: CanActivateChildFn = (_rota, estado) => {
  const sessao = inject(SessaoService);
  const modulo = moduloBasePorRota(estado.url);
  return !modulo || sessao.pode(modulo) ? true : paraSemAcesso(inject(Router), estado.url);
};

/** Libera a rota quando o teste das permissões passa: `exigirPermissao((p) => p.verAuditoria)`. */
export function exigirPermissao(
  teste: (permissoes: Permissoes, perfil: Perfil) => boolean,
): CanActivateFn {
  return (_rota, estado) =>
    inject(SessaoService).permite(teste) ? true : paraSemAcesso(inject(Router), estado.url);
}

/** Libera a rota para estes papéis: `exigirPapel('ADMIN', 'C_LEVEL')`. */
export function exigirPapel(...papeis: readonly Papel[]): CanActivateFn {
  return (_rota, estado) =>
    inject(SessaoService).temPapel(...papeis) ? true : paraSemAcesso(inject(Router), estado.url);
}

/**
 * Rota sem tela que só redireciona, decidindo na hora (depois das guardas da casca, com o
 * perfil carregado): `{ path: '', pathMatch: 'full', canActivate: [redirecionar(() => '/x')],
 * children: [] }`. Mantém a query string da URL original quando o destino não tem uma.
 */
export function redirecionar(
  destino: (rota: ActivatedRouteSnapshot) => string | UrlTree,
): CanActivateFn {
  return (rota) => {
    const router = inject(Router);
    const alvo = destino(rota);
    if (typeof alvo !== 'string') {
      return alvo;
    }
    const arvore = router.parseUrl(alvo);
    if (Object.keys(arvore.queryParams).length === 0) {
      arvore.queryParams = { ...rota.queryParams };
    }
    return arvore;
  };
}

/** `canMatch` da rota `funis/:area`: só `marketing`, `comercial` ou `cs`. */
export const ehAreaDeFunil: CanMatchFn = (_rota, segmentos) =>
  areaDoSlug(segmentos[0]?.path) !== null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `canMatch` de rotas com id: só UUID (o resto cai na página não encontrada). */
export const ehUuid: CanMatchFn = (_rota, segmentos) => UUID.test(segmentos[0]?.path ?? '');

/** `/funis` sozinho: o primeiro funil que o usuário vê (ou a visão geral, se nenhum). */
export const paraPrimeiroFunil: CanActivateFn = () => {
  const router = inject(Router);
  const area = inject(SessaoService).permissoes()?.areasVisiveis[0];
  return router.parseUrl(area ? `/funis/${SLUG_AREA[area]}` : '/inicio');
};

/**
 * Links das notificações apontam para o funil pelo id (`/funis/<funilId>?negocio=<id>`): a
 * guarda pergunta a área do funil à API e leva a `/funis/<area>/<negocioId>?funil=<funilId>`
 * (ou `/funis/<area>?funil=<funilId>` sem negócio). Funil que não existe ou não é visível:
 * aviso e o primeiro funil do usuário.
 */
export const redirecionarFunilPorId: CanActivateFn = async (rota) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const avisos = inject(AvisosService);
  const funilId = rota.paramMap.get('funilId') ?? '';
  const negocio = rota.queryParamMap.get('negocio');
  try {
    const funil = await firstValueFrom(http.get<{ area: Area }>(urlApi('funis', funilId)));
    return router.createUrlTree(['/funis', SLUG_AREA[funil.area], ...(negocio ? [negocio] : [])], {
      queryParams: { funil: funilId },
    });
  } catch (falha) {
    avisos.erro(falha);
    return router.parseUrl('/funis');
  }
};
