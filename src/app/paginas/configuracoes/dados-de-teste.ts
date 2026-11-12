import { rotuloDoPapel } from '../../nucleo/papeis';
import { desdobrarPapel, type PapelDeTeste } from '../../nucleo/sessao/sessao-de-teste';
import { nomeDoSetor } from '../../nucleo/setores/setores';
import type { Equipe, Indicadores, Usuario, UsuarioResumo } from './configuracoes.modelos';

/**
 * **Só para testes (specs) de Configurações.** Usuários e equipes falsos, no formato da API.
 */

export function resumo(
  id: string,
  nome: string,
  papelDeTeste: PapelDeTeste,
  ajustes: Partial<UsuarioResumo> = {},
): UsuarioResumo {
  const { papel, area } = desdobrarPapel(papelDeTeste);
  return {
    id,
    nome,
    email: `${nome.split(' ')[0].toLowerCase()}@brl.com.br`,
    papel,
    rotuloPapel: rotuloDoPapel(papel, area ? nomeDoSetor(area) : null),
    area,
    nomeSetor: area ? nomeDoSetor(area) : null,
    ativo: true,
    ...ajustes,
  };
}

export function usuario(
  id: string,
  nome: string,
  papelDeTeste: PapelDeTeste,
  ajustes: Partial<Usuario> = {},
): Usuario {
  const { papel } = desdobrarPapel(papelDeTeste);
  return {
    ...resumo(id, nome, papelDeTeste),
    nivel:
      papel === 'ADMIN'
        ? 'ADMINISTRADOR'
        : papel === 'C_LEVEL'
          ? 'DIRETORIA'
          : papel === 'LIDER'
            ? 'LIDER'
            : 'MEMBRO',
    lider: null,
    desligadoEm: null,
    deveTrocarSenha: false,
    senhaDefinida: true,
    telefone: null,
    avatarUrl: null,
    ultimoAcessoEm: null,
    criadoEm: '2026-10-01T12:00:00.000Z',
    atualizadoEm: '2026-10-01T12:00:00.000Z',
    ...ajustes,
  };
}

export const HELENA = usuario('u-helena', 'Helena Duarte', 'C_LEVEL');
export const MARCOS = usuario('u-marcos', 'Marcos Andrade', 'C_LEVEL');
export const RAFAEL = usuario('u-rafael', 'Rafael Mendes', 'LIDER_COMERCIAL', {
  lider: resumo('u-helena', 'Helena Duarte', 'C_LEVEL'),
});
export const CAMILA = usuario('u-camila', 'Camila Rocha', 'LIDER_MARKETING', {
  lider: resumo('u-helena', 'Helena Duarte', 'C_LEVEL'),
});
export const LUCAS = usuario('u-lucas', 'Lucas Pereira', 'COMERCIAL', {
  lider: resumo('u-rafael', 'Rafael Mendes', 'LIDER_COMERCIAL'),
  ultimoAcessoEm: new Date(Date.now() - 5 * 60_000).toISOString(),
});
export const PEDRO = usuario('u-pedro', 'Pedro Santos', 'COMERCIAL', {
  ativo: false,
  desligadoEm: '2026-10-20T12:00:00.000Z',
  lider: resumo('u-rafael', 'Rafael Mendes', 'LIDER_COMERCIAL'),
});
export const RODRIGO = usuario('u-rodrigo', 'Rodrigo Nunes', 'MARKETING', {
  senhaDefinida: false,
  lider: resumo('u-camila', 'Camila Rocha', 'LIDER_MARKETING'),
});

export function pagina<T>(itens: readonly T[], total = itens.length) {
  return { itens, total, pagina: 1, porPagina: 20 };
}

export const SEM_NUMEROS: Indicadores = {
  atividadesPendentes: 0,
  atividadesAtrasadas: 0,
  negociosAbertos: 0,
  valorEmAberto: '0.00',
  contatos: 0,
};

export function membro(
  pessoa: UsuarioResumo,
  indicadores: Partial<Indicadores> = {},
  aguardandoNovoLider = false,
) {
  return { usuario: pessoa, indicadores: { ...SEM_NUMEROS, ...indicadores }, aguardandoNovoLider };
}

/** Helena (C-level) → Rafael e Camila; Rafael → Lucas e Juliana; Camila → Mariana. */
export function equipesDeTeste(): Equipe[] {
  const helena = resumo('u-helena', 'Helena Duarte', 'C_LEVEL');
  const rafael = resumo('u-rafael', 'Rafael Mendes', 'LIDER_COMERCIAL');
  const camila = resumo('u-camila', 'Camila Rocha', 'LIDER_MARKETING');
  const lucas = resumo('u-lucas', 'Lucas Pereira', 'COMERCIAL');
  const juliana = resumo('u-juliana', 'Juliana Alves', 'COMERCIAL');
  const mariana = resumo('u-mariana', 'Mariana Costa', 'MARKETING');
  return [
    {
      lider: membro(helena, { atividadesPendentes: 1 }),
      area: null,
      membros: [
        membro(rafael, { atividadesPendentes: 7, negociosAbertos: 4, valorEmAberto: '117700.00' }),
        membro(camila, { atividadesPendentes: 1 }),
      ],
    },
    {
      lider: membro(rafael, {
        atividadesPendentes: 7,
        negociosAbertos: 4,
        valorEmAberto: '117700.00',
      }),
      area: 'COMERCIAL',
      membros: [
        membro(lucas, {
          atividadesPendentes: 3,
          atividadesAtrasadas: 1,
          negociosAbertos: 4,
          valorEmAberto: '43200.00',
        }),
        membro(juliana, { atividadesPendentes: 2, negociosAbertos: 3, valorEmAberto: '36600.00' }),
      ],
    },
    {
      lider: membro(camila, { atividadesPendentes: 1 }),
      area: 'MARKETING',
      membros: [membro(mariana, { atividadesAtrasadas: 2, atividadesPendentes: 2 }, true)],
    },
  ];
}

/** Espera as promessas pendentes (respostas do HttpTestingController) andarem. */
export async function microtarefas(vezes = 10): Promise<void> {
  for (let i = 0; i < vezes; i++) {
    await Promise.resolve();
  }
}

/** O controle (input/select) cujo rótulo visível é `rotulo`. */
export function campoPeloRotulo<T extends HTMLElement = HTMLInputElement>(
  raiz: ParentNode,
  rotulo: string,
): T {
  const label = Array.from(raiz.querySelectorAll('label')).find((item) =>
    item.textContent?.replace(/\s+/g, ' ').trim().startsWith(rotulo),
  );
  const id = label?.getAttribute('for');
  const campo = id ? (raiz.querySelector(`#${CSS.escape(id)}`) as T | null) : null;
  if (!campo) {
    throw new Error(`Campo "${rotulo}" não encontrado`);
  }
  return campo;
}

export function digitar(raiz: ParentNode, rotulo: string, valor: string): void {
  const campo = campoPeloRotulo<HTMLInputElement>(raiz, rotulo);
  campo.value = valor;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  campo.dispatchEvent(new Event('blur'));
}

/** Escolhe no `app-seletor` a opção com o texto dado. */
export function escolher(raiz: ParentNode, rotulo: string, opcao: string): void {
  const seletor = campoPeloRotulo<HTMLSelectElement>(raiz, rotulo);
  const indice = Array.from(seletor.options).findIndex(
    (item) => item.textContent?.trim() === opcao,
  );
  if (indice < 0) {
    throw new Error(`Opção "${opcao}" não existe em "${rotulo}"`);
  }
  seletor.selectedIndex = indice;
  seletor.dispatchEvent(new Event('change'));
}

/** Os textos das opções de um `app-seletor` (sem o placeholder). */
export function opcoesDe(raiz: ParentNode, rotulo: string): string[] {
  const seletor = campoPeloRotulo<HTMLSelectElement>(raiz, rotulo);
  return Array.from(seletor.options)
    .slice(1)
    .map((item) => item.textContent?.trim() ?? '');
}

export function botaoComTexto(raiz: ParentNode, texto: string): HTMLButtonElement {
  const botao = Array.from(raiz.querySelectorAll<HTMLButtonElement>('button')).find(
    (item) => item.textContent?.replace(/\s+/g, ' ').trim() === texto,
  );
  if (!botao) {
    throw new Error(`Botão "${texto}" não encontrado`);
  }
  return botao;
}

export function erroDaApiFalso(status: number, erro: string, mensagem: string, detalhes?: unknown) {
  return {
    corpo: { statusCode: status, erro, mensagem, detalhes, requisicaoId: 'req-teste' },
    opcoes: { status, statusText: 'Erro' },
  };
}
