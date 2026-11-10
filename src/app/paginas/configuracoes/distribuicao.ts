import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideRefreshCw } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { POR_PAGINA_MAXIMO } from '../../nucleo/api/api';
import { AvisosService } from '../../nucleo/avisos.service';
import { rotuloDoPapel } from '../../nucleo/papeis';
import { type Area } from '../../nucleo/sessao/perfil';
import { nomeDoSetor } from '../../nucleo/setores/setores';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Alternador } from '../../ui/alternador/alternador';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Carregamento } from './carregamento';
import { ConfiguracoesApi } from './configuracoes.api';
import type { RegraDistribuicao } from './configuracoes.modelos';
import { juntarNomes } from './hierarquia';
import {
  ACESSO_PENDENTE,
  destinoSemFila,
  DICA_RODIZIO,
  operacaoDeParticipacao,
  type PessoaDaArea,
  type PessoaDoRodizio,
  pessoasDoRodizio,
  QUANDO_ENTRA,
} from './rodizio';

/** O que a tela carrega: as regras que o usuário configura e as pessoas ativas de cada setor. */
interface DadosDistribuicao {
  readonly regras: readonly RegraDistribuicao[];
  readonly pessoas: Readonly<Partial<Record<Area, readonly PessoaDaArea[]>>>;
}

/** Um cartão por setor, pronto para desenhar. */
interface AreaVisual {
  readonly regra: RegraDistribuicao;
  readonly rotulo: string;
  readonly pessoas: readonly PessoaDoRodizio[];
  readonly lideres: readonly PessoaDoRodizio[];
  readonly naFila: number;
  readonly dicaLider: string;
  /** Quem vai para a fila quando ativar o acesso (R5.8): "Rodrigo Nunes ainda não ativou…". */
  readonly avisoAguardando: string | null;
}

/**
 * Distribuição de leads (`/configuracoes/distribuicao`, Admin, C-level e líder do setor) —
 * TELAS-FASE1 §6 e R5.8: por setor, quem participa do rodízio, em que ordem, quem é o próximo
 * da vez e se o líder entra. Cada alternador vale na hora (sem botão Salvar) e o aviso traz
 * "Desfazer".
 */
@Component({
  selector: 'app-distribuicao',
  imports: [Alternador, Avatar, Botao, Cartao, Esqueleto, EstadoVazio, LucideRefreshCw],
  templateUrl: './distribuicao.html',
  styleUrl: './distribuicao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Distribuicao {
  private readonly api = inject(ConfiguracoesApi);
  private readonly avisos = inject(AvisosService);
  private readonly sessao = inject(SessaoService);

  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly dicaRodizio = DICA_RODIZIO;
  protected readonly dados = new Carregamento<DadosDistribuicao>();
  /** Quem está sendo salvo agora (`<area>:<id>` ou `<area>:lideres`). */
  protected readonly pendentes = signal<ReadonlySet<string>>(new Set());
  /**
   * Muda quando uma alteração falha: os alternadores são recriados e voltam a mostrar o valor
   * real (o clique já tinha mudado o desenho deles).
   */
  protected readonly revisao = signal(0);

  protected readonly frase = computed(() =>
    this.sessao.ehDiretoria()
      ? 'Quem recebe os leads novos de cada setor, em que ordem, e se o líder entra na fila.'
      : 'Quem do seu setor recebe os leads novos, em que ordem, e se você entra na fila.',
  );
  protected readonly areas = computed<readonly AreaVisual[]>(() => {
    const dados = this.dados.dados();
    if (!dados) {
      return [];
    }
    return dados.regras.map((regra) => {
      const pessoas = pessoasDoRodizio(regra, dados.pessoas[regra.area] ?? []);
      const lideres = pessoas.filter((pessoa) => pessoa.ehLider);
      const rotulo = nomeDoSetor(regra.area);
      return {
        regra,
        rotulo,
        pessoas,
        lideres,
        naFila: regra.participantes.length,
        dicaLider: this.dicaDoLider(regra.area, lideres, regra.incluirLideres),
        avisoAguardando: avisoAguardando(pessoas),
      };
    });
  });

  /**
   * Começa pela situação que o alternador mostra e diz o que muda se mexer nele (R5.8):
   * "Ligado: Camila Rocha também recebe leads na vez. Se desligar, só a equipe recebe." ou
   * "Desligado: só a equipe recebe leads. Se ligar, você também recebe na vez."
   */
  private dicaDoLider(
    area: Area,
    lideres: readonly { id: string; nome: string }[],
    incluidos: boolean,
  ): string {
    let quem: string;
    let verbo = 'recebe';
    if (lideres.length === 0) {
      quem = `quem for ${rotuloDoPapel('LIDER', nomeDoSetor(area))}`;
    } else {
      const eu = this.sessao.usuario()?.id;
      // "você" primeiro: "você e Lia Teste-Config".
      const nomes = [...lideres]
        .sort((a, b) => Number(b.id === eu) - Number(a.id === eu))
        .map((lider) => (lider.id === eu ? 'você' : lider.nome));
      quem = juntarNomes(nomes);
      verbo = nomes.length === 1 ? 'recebe' : 'recebem';
    }
    return incluidos
      ? `Ligado: ${quem} também ${verbo} leads na vez. Se desligar, só a equipe recebe.`
      : `Desligado: só a equipe recebe leads. Se ligar, ${quem} também ${verbo} na vez.`;
  }

  constructor() {
    this.carregar();
  }

  protected carregar(): void {
    void this.dados.executar(async () => {
      const regras = await this.api.regrasDistribuicao();
      const listas = await Promise.all(
        regras.map((regra) =>
          this.api
            .listarUsuarios({ area: regra.area, ativo: true, porPagina: POR_PAGINA_MAXIMO })
            .then((pagina) => pagina.itens)
            // Sem a lista, a tela ainda mostra a fila e os ajustes que a regra traz.
            .catch(() => [] as readonly PessoaDaArea[]),
        ),
      );
      const pessoas: Partial<Record<Area, readonly PessoaDaArea[]>> = {};
      regras.forEach((regra, indice) => (pessoas[regra.area] = listas[indice]));
      return { regras, pessoas };
    });
  }

  protected emAndamento(chave: string): boolean {
    return this.pendentes().has(chave);
  }

  protected chaveDa(area: Area, id: string): string {
    return `${area}:${id}`;
  }

  /** Liga/desliga a participação de alguém (ajuste manual, ou volta à regra). */
  protected async definirParticipacao(
    area: AreaVisual,
    pessoa: PessoaDoRodizio,
    participa: boolean,
    desfazendo = false,
  ): Promise<void> {
    const chave = this.chaveDa(area.regra.area, pessoa.id);
    const operacao = operacaoDeParticipacao(pessoa, participa);
    await this.salvar(chave, async () => {
      const regra =
        operacao === 'remover-ajuste'
          ? await this.api.removerAjuste(area.regra.area, pessoa.id)
          : await this.api.definirParticipacao(area.regra.area, pessoa.id, participa);
      this.substituir(regra);
      // Quem ainda não ativou o acesso só entra na fila quando ativar (R5.8).
      const espera = regra.aguardandoAcesso?.find((item) => item.id === pessoa.id);
      const mensagem = !participa
        ? `${pessoa.nome} saiu do rodízio de ${area.rotulo}.`
        : espera
          ? `${pessoa.nome} vai para o rodízio de ${area.rotulo}: ${QUANDO_ENTRA[ACESSO_PENDENTE[espera.motivo]]}.`
          : `${pessoa.nome} entrou no rodízio de ${area.rotulo}.`;
      this.avisos.sucesso(mensagem, {
        chave: `rodizio-${chave}`,
        acao: desfazendo
          ? undefined
          : {
              rotulo: 'Desfazer',
              executar: () => this.desfazerParticipacao(regra.area, pessoa.id, !participa),
            },
      });
    });
  }

  /** O líder do setor entra (ou não) no rodízio. */
  protected async definirLideres(
    area: AreaVisual,
    incluir: boolean,
    desfazendo = false,
  ): Promise<void> {
    const chave = this.chaveDa(area.regra.area, 'lideres');
    await this.salvar(chave, async () => {
      const regra = await this.api.definirIncluirLideres(area.regra.area, incluir);
      this.substituir(regra);
      this.avisos.sucesso(
        incluir
          ? `O líder de ${area.rotulo} agora entra no rodízio.`
          : `O líder de ${area.rotulo} saiu do rodízio.`,
        {
          chave: `rodizio-${chave}`,
          acao: desfazendo
            ? undefined
            : { rotulo: 'Desfazer', executar: () => this.desfazerLideres(regra.area, !incluir) },
        },
      );
    });
  }

  private desfazerParticipacao(areaId: Area, id: string, participa: boolean): void {
    const area = this.areas().find((item) => item.regra.area === areaId);
    const pessoa = area?.pessoas.find((item) => item.id === id);
    if (area && pessoa && pessoa.participa !== participa) {
      void this.definirParticipacao(area, pessoa, participa, true);
    }
  }

  private desfazerLideres(areaId: Area, incluir: boolean): void {
    const area = this.areas().find((item) => item.regra.area === areaId);
    if (area && area.regra.incluirLideres !== incluir) {
      void this.definirLideres(area, incluir, true);
    }
  }

  private async salvar(chave: string, alterar: () => Promise<void>): Promise<void> {
    if (this.emAndamento(chave)) {
      return;
    }
    this.pendentes.update((atual) => new Set(atual).add(chave));
    try {
      await alterar();
    } catch (falha) {
      this.revisao.update((valor) => valor + 1);
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.pendentes.update((atual) => {
        const proximo = new Set(atual);
        proximo.delete(chave);
        return proximo;
      });
    }
  }

  private substituir(regra: RegraDistribuicao): void {
    const dados = this.dados.dados();
    if (dados) {
      this.dados.definir({
        ...dados,
        regras: dados.regras.map((item) => (item.area === regra.area ? regra : item)),
      });
    }
  }

  protected destinoSemFila(regra: RegraDistribuicao): string {
    return destinoSemFila(regra);
  }
}

/**
 * "Rodrigo Nunes ainda não ativou o acesso: entra na fila quando ativar." — quem a regra (ou
 * um ajuste) põe no rodízio mas ainda está fora da fila (R5.8).
 */
function avisoAguardando(pessoas: readonly PessoaDoRodizio[]): string | null {
  const nomes = pessoas
    .filter((pessoa) => pessoa.acessoPendente && pessoa.participa)
    .map((pessoa) => pessoa.nome);
  if (nomes.length === 0) {
    return null;
  }
  return nomes.length === 1
    ? `${nomes[0]} ainda não ativou o acesso: entra na fila quando ativar.`
    : `${juntarNomes(nomes)} ainda não ativaram o acesso: entram na fila quando ativarem.`;
}
