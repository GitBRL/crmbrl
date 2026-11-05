import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CampoSenha } from './campo-senha';

/** O mínimo do `node:fs` que o varredor usa (o projeto não tem os tipos do Node). */
interface SistemaDeArquivos {
  readdirSync(
    caminho: string,
    opcoes: { withFileTypes: true },
  ): { name: string; isDirectory(): boolean }[];
  readFileSync(caminho: string, codificacao: 'utf-8'): string;
}

function sistemaDeArquivos(): { fs: SistemaDeArquivos; raiz: string } {
  const processo = (
    globalThis as unknown as {
      process: { getBuiltinModule(id: 'node:fs'): SistemaDeArquivos; cwd(): string };
    }
  ).process;
  const fs = processo.getBuiltinModule('node:fs');
  // O Vitest roda a partir da raiz do projeto ou de `src`, conforme o executor.
  const base = processo.cwd();
  const raiz = [`${base}/src/app`, `${base}/app`].find((c) => {
    try {
      fs.readdirSync(c, { withFileTypes: true });
      return true;
    } catch {
      return false;
    }
  });
  if (!raiz) {
    throw new Error(`Pasta src/app não encontrada a partir de ${base}`);
  }
  return { fs, raiz };
}

/** Templates (`.html` e `template:` inline) que não são specs. */
function arquivosDeTemplate(): { caminho: string; texto: string }[] {
  const { fs, raiz } = sistemaDeArquivos();
  const achados: { caminho: string; texto: string }[] = [];
  const percorrer = (pasta: string): void => {
    for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
      const completo = `${pasta}/${item.name}`;
      if (item.isDirectory()) {
        percorrer(completo);
      } else if (
        (item.name.endsWith('.html') || item.name.endsWith('.ts')) &&
        !item.name.endsWith('.spec.ts')
      ) {
        const texto = fs.readFileSync(completo, 'utf-8');
        if (texto.includes('<app-campo-senha')) {
          achados.push({ caminho: completo.slice(raiz.length + 1), texto });
        }
      }
    }
  };
  percorrer(raiz);
  return achados;
}

/** Só as telas de entrar e de senha do usuário usam a senha do CRM. */
const TELAS_DE_SENHA_DO_USUARIO = [
  'paginas/acesso/',
  'paginas/configuracoes/meu-perfil.html',
  // O comentário de documentação do próprio componente cita o uso.
  'ui/campo-senha/campo-senha.ts',
];

describe('Preenchimento automático dos campos de senha (R32.27)', () => {
  it('nenhum app-campo-senha fora das telas de acesso e da troca de senha usa current-password', () => {
    const problemas: string[] = [];
    for (const { caminho, texto } of arquivosDeTemplate()) {
      if (TELAS_DE_SENHA_DO_USUARIO.some((prefixo) => caminho.startsWith(prefixo))) {
        continue;
      }
      for (const etiqueta of texto.match(/<app-campo-senha[^>]*>/g) ?? []) {
        const ehSegredo = /(\s|^)segredo(\s|=|\/|$)/.test(
          etiqueta.replace('<app-campo-senha', ' '),
        );
        const senhaNova = /autocomplete="new-password"/.test(etiqueta);
        if (!ehSegredo && !senhaNova) {
          problemas.push(`${caminho}: ${etiqueta.replace(/\s+/g, ' ').slice(0, 120)}`);
        }
        if (/autocomplete="current-password"/.test(etiqueta)) {
          problemas.push(`${caminho}: current-password fora das telas de senha`);
        }
      }
    }
    expect(problemas).toEqual([]);
  });

  it('o varredor enxerga as telas de acesso (a regra não passa por não achar nada)', () => {
    const caminhos = arquivosDeTemplate().map((a) => a.caminho);
    expect(caminhos.some((c) => c.startsWith('paginas/acesso/'))).toBe(true);
    expect(caminhos).toContain('paginas/integracoes/passo-conexao-facebook.html');
  });
});

@Component({
  imports: [CampoSenha],
  template: `<app-campo-senha rotulo="Segredo do app" segredo />
    <app-campo-senha rotulo="Senha" />`,
})
class Hospedeiro {}

describe('CampoSenha com segredo', () => {
  it('não oferece a senha do CRM: new-password e marcas dos gerenciadores', async () => {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    const [segredo, senha] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('input'),
    );
    expect(segredo.getAttribute('autocomplete')).toBe('new-password');
    expect(segredo.hasAttribute('data-1p-ignore')).toBe(true);
    expect(segredo.getAttribute('data-lpignore')).toBe('true');
    expect(senha.getAttribute('autocomplete')).toBe('current-password');
    expect(senha.hasAttribute('data-1p-ignore')).toBe(false);
  });
});
