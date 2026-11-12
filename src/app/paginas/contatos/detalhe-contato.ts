import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucidePencil, LucideRefreshCw } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { LigacaoService } from '../../nucleo/ligacoes/ligacao.service';
import { formatarData, formatarDataHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { NOME_PRODUTO } from '../../nucleo/titulo-pagina';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { BotaoLigar } from '../../layout/ligacao/botao-ligar';
import { BotaoLigarTresc } from '../../layout/tresc-plus/botao-ligar-tresc';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Cartao } from '../../ui/cartao/cartao';
import { Dica } from '../../ui/dica/dica';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Selo } from '../../ui/selo/selo';
import { AtividadesRelacionadas } from './atividades-relacionadas';
import { BlocoLgpd } from './bloco-lgpd';
import { ContatosApi } from './contatos.api';
import { type Contato, descreverUtm, formatarTelefone, ROTULO_ORIGEM } from './contatos.tipos';
import { listarCampos, rotuloDoCampo } from './dados-personalizados';
import { FormularioContato } from './formulario-contato';
import { CartaoQualificacao } from '../../nucleo/sdr/cartao-qualificacao';
import { RiscoChurnCartao } from '../financeiro/risco-churn';
import { LinhaDoTempo } from './linha-do-tempo';
import { MeiosDeContato } from './meios-de-contato';
import { NegociosRelacionados } from './negocios-relacionados';

type AbaDetalhe = 'linha' | 'negocios' | 'atividades' | 'dados';
const ABAS_DETALHE: readonly AbaDetalhe[] = ['linha', 'negocios', 'atividades', 'dados'];

/** Por que a pessoa não edita este contato ou esta empresa (matriz §12). */
export function motivoSemEdicao(
  escopo: string | null | undefined,
  entidade: 'contatos' | 'empresas',
): string {
  const dosQuais = entidade === 'contatos' ? 'dos quais' : 'das quais';
  switch (escopo) {
    case 'EQUIPE':
      return `Você edita ${entidade} cujo responsável é você ou alguém da sua equipe.`;
    case 'PROPRIOS':
      return `Você edita só ${entidade} ${dosQuais} é o responsável.`;
    default:
      return `Seu papel não edita ${entidade}.`;
  }
}

/**
 * Detalhe do contato (`/contatos/:id`) — TELAS-FASE1 §4.
 *
 * Cabeçalho com avatar, nome, empresa, e-mail e telefone (abrir e copiar), origem e
 * responsável; abas Linha do tempo (R3.5), Negócios (todos os funis, com a jornada),
 * Atividades e Dados; ao lado, a origem com UTM e o bloco LGPD (R4.6). A aba fica na URL
 * (`?aba=negocios`).
 */
@Component({
  selector: 'app-detalhe-contato',
  imports: [
    Abas,
    AtividadesRelacionadas,
    Avatar,
    BlocoLgpd,
    Botao,
    BotaoIcone,
    BotaoLigar,
    BotaoLigarTresc,
    Cartao,
    Dica,
    Esqueleto,
    EstadoVazio,
    FormularioContato,
    LinhaDoTempo,
    MeiosDeContato,
    NegociosRelacionados,
    CartaoQualificacao,
    RiscoChurnCartao,
    RouterLink,
    Selo,
  ],
  templateUrl: './detalhe-contato.html',
  styleUrl: './detalhe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalheContato {
  readonly id = input.required<string>();
  /** Aba (query `aba`): `negocios`, `atividades` ou `dados`; sem ela, a linha do tempo. */
  readonly aba = input<string | null>(null);

  private readonly api = inject(ContatosApi);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly titulo = inject(Title);
  private readonly sessao = inject(SessaoService);

  protected readonly icones = {
    voltar: LucideArrowLeft,
    editar: LucidePencil,
    tentar: LucideRefreshCw,
  };
  protected readonly rotuloOrigem = ROTULO_ORIGEM;
  protected readonly descreverUtm = descreverUtm;
  protected readonly formatarData = formatarData;
  protected readonly formatarDataHora = formatarDataHora;
  protected readonly formatarTempoRelativo = formatarTempoRelativo;
  protected readonly formatarTelefone = formatarTelefone;
  protected readonly rotuloDoCampo = rotuloDoCampo;

  protected readonly recurso = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.contato(params),
  });

  private readonly recursoNegocios = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.negocios('contato', params),
  });

  /** Muda depois de cada alteração: a linha do tempo recarrega. */
  protected readonly versao = signal(0);
  private readonly ligacoes = inject(LigacaoService);
  private ligacoesVistas = this.ligacoes.encerradas();
  protected readonly editando = signal(false);

  protected readonly contato = computed<Contato | null>(() =>
    this.recurso.hasValue() ? this.recurso.value() : null,
  );

  protected readonly erro = computed(() => {
    const falha = this.recurso.error();
    return falha ? erroDaApi(falha) : null;
  });

  protected readonly negocios = computed(() =>
    this.recursoNegocios.hasValue() ? this.recursoNegocios.value().itens : [],
  );
  protected readonly carregandoNegocios = computed(() => this.recursoNegocios.isLoading());
  protected readonly erroNegocios = computed(() => {
    const falha = this.recursoNegocios.error();
    return falha ? erroDaApi(falha) : null;
  });

  protected readonly abaAtual = computed<AbaDetalhe>(() => {
    const aba = this.aba();
    return ABAS_DETALHE.includes(aba as AbaDetalhe) ? (aba as AbaDetalhe) : 'linha';
  });

  protected readonly abas = computed<readonly ItemAba[]>(() => {
    const quantos = this.recursoNegocios.hasValue() ? this.recursoNegocios.value().total : null;
    return [
      { id: 'linha', rotulo: 'Linha do tempo' },
      { id: 'negocios', rotulo: quantos ? `Negócios (${quantos})` : 'Negócios' },
      { id: 'atividades', rotulo: 'Atividades' },
      { id: 'dados', rotulo: 'Dados' },
    ];
  });

  protected readonly campos = computed(() => {
    const contato = this.contato();
    return contato ? listarCampos(contato.camposPersonalizados) : [];
  });

  protected readonly motivoSemEdicao = computed(() =>
    motivoSemEdicao(this.sessao.permissoes()?.editarContatos, 'contatos'),
  );

  constructor() {
    effect(() => {
      const contato = this.contato();
      if (contato) {
        this.titulo.setTitle(`${contato.nome} · ${NOME_PRODUTO}`);
      }
    });
    // Uma ligação terminou: a atividade dela entra na linha do tempo.
    effect(() => {
      const total = this.ligacoes.encerradas();
      if (total !== this.ligacoesVistas) {
        this.ligacoesVistas = total;
        this.versao.update((versao) => versao + 1);
      }
    });
  }

  protected mudarAba(aba: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: { aba: aba === 'linha' ? null : aba },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected aoSalvar(contato: Contato): void {
    this.recurso.set(contato);
    this.versao.update((versao) => versao + 1);
  }

  protected aoMudarHistorico(): void {
    this.versao.update((versao) => versao + 1);
  }

  protected recarregarNegocios(): void {
    this.recursoNegocios.reload();
  }

  protected aoAnonimizar(): void {
    void this.router.navigate(['/contatos']);
  }
}
