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
import { LucideArrowLeft, LucideGlobe, LucidePencil, LucideRefreshCw } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { formatarDataHora } from '../../nucleo/formatos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { NOME_PRODUTO } from '../../nucleo/titulo-pagina';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Cartao } from '../../ui/cartao/cartao';
import { Dica } from '../../ui/dica/dica';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Selo } from '../../ui/selo/selo';
import { AtividadesRelacionadas } from './atividades-relacionadas';
import { ContatosApi } from './contatos.api';
import { type Empresa, formatarTelefone, linkDoSite } from './contatos.tipos';
import { listarCampos, rotuloDoCampo } from './dados-personalizados';
import { motivoSemEdicao } from './detalhe-contato';
import { FormularioEmpresa } from './formulario-empresa';
import { LinhaDoTempo } from './linha-do-tempo';
import { MeiosDeContato } from './meios-de-contato';
import { NegociosRelacionados } from './negocios-relacionados';
import { PessoasDaEmpresa } from './pessoas-da-empresa';

type AbaEmpresa = 'linha' | 'pessoas' | 'negocios' | 'atividades' | 'dados';
const ABAS_EMPRESA: readonly AbaEmpresa[] = ['linha', 'pessoas', 'negocios', 'atividades', 'dados'];

/**
 * Detalhe da empresa (`/empresas/:id`) — TELAS-FASE1 §4.
 *
 * Cabeçalho com nome, CNPJ, segmento, cidade, site, e-mail e telefone; abas Linha do tempo,
 * Pessoas (os contatos dela), Negócios (todos os funis), Atividades e Dados.
 */
@Component({
  selector: 'app-detalhe-empresa',
  imports: [
    Abas,
    AtividadesRelacionadas,
    Avatar,
    Botao,
    BotaoIcone,
    Cartao,
    Dica,
    Esqueleto,
    EstadoVazio,
    FormularioEmpresa,
    LinhaDoTempo,
    LucideGlobe,
    MeiosDeContato,
    NegociosRelacionados,
    PessoasDaEmpresa,
    RouterLink,
    Selo,
  ],
  templateUrl: './detalhe-empresa.html',
  styleUrl: './detalhe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalheEmpresa {
  readonly id = input.required<string>();
  /** Aba (query `aba`): `pessoas`, `negocios`, `atividades` ou `dados`. */
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
  protected readonly formatarDataHora = formatarDataHora;
  protected readonly formatarTelefone = formatarTelefone;
  protected readonly linkDoSite = linkDoSite;
  protected readonly rotuloDoCampo = rotuloDoCampo;

  protected readonly recurso = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.empresa(params),
  });

  private readonly recursoNegocios = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.negocios('empresa', params),
  });

  protected readonly versao = signal(0);
  protected readonly editando = signal(false);

  protected readonly empresa = computed<Empresa | null>(() =>
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

  protected readonly abaAtual = computed<AbaEmpresa>(() => {
    const aba = this.aba();
    return ABAS_EMPRESA.includes(aba as AbaEmpresa) ? (aba as AbaEmpresa) : 'linha';
  });

  protected readonly abas = computed<readonly ItemAba[]>(() => {
    const empresa = this.empresa();
    const negocios = this.recursoNegocios.hasValue() ? this.recursoNegocios.value().total : null;
    return [
      { id: 'linha', rotulo: 'Linha do tempo' },
      {
        id: 'pessoas',
        rotulo: empresa?.quantidadeContatos ? `Pessoas (${empresa.quantidadeContatos})` : 'Pessoas',
      },
      { id: 'negocios', rotulo: negocios ? `Negócios (${negocios})` : 'Negócios' },
      { id: 'atividades', rotulo: 'Atividades' },
      { id: 'dados', rotulo: 'Dados' },
    ];
  });

  protected readonly campos = computed(() => {
    const empresa = this.empresa();
    return empresa ? listarCampos(empresa.camposPersonalizados) : [];
  });

  protected readonly local = computed(() => {
    const empresa = this.empresa();
    return empresa ? [empresa.cidade, empresa.uf].filter(Boolean).join(' · ') : '';
  });

  protected readonly motivoSemEdicao = computed(() =>
    motivoSemEdicao(this.sessao.permissoes()?.editarContatos, 'empresas'),
  );

  constructor() {
    effect(() => {
      const empresa = this.empresa();
      if (empresa) {
        this.titulo.setTitle(`${empresa.nome} · ${NOME_PRODUTO}`);
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

  protected aoSalvar(empresa: Empresa): void {
    this.recurso.set(empresa);
    this.versao.update((versao) => versao + 1);
  }

  protected aoMudarHistorico(): void {
    this.versao.update((versao) => versao + 1);
  }

  protected recarregarNegocios(): void {
    this.recursoNegocios.reload();
  }
}
